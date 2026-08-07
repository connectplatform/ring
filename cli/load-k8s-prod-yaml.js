/**
 * Parse ring-platform.org/k8s/secrets.yaml (gitignored in some workflows; may ship templates locally).
 * File contains a Secret (stringData) + ConfigMap (data) — same shape the cluster applies.
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { parseAllDocuments } from 'yaml';
import { logger } from './utils.js';

function trimDefined(obj) {
  if (!obj || typeof obj !== 'object') return {};
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined && v !== null && String(v).trim() !== '') {
      out[k] = typeof v === 'string' ? v.trimEnd() : v;
    }
  }
  return out;
}

/**
 * @param {string} projectRoot - ring-platform.org repo root (parent of k8s/)
 * @returns {{ stringData: Record<string, string>, configMapData: Record<string, string> } | null}
 */
export function loadK8sSecretsYamlDocs(projectRoot) {
  const path =
    process.env.RING_K8S_SECRETS_YAML || join(projectRoot, 'k8s', 'secrets.yaml');
  if (!existsSync(path)) {
    logger.debug(`No k8s secrets file at ${path} (set RING_K8S_SECRETS_YAML or add k8s/secrets.yaml)`);
    return null;
  }
  try {
    const raw = readFileSync(path, 'utf8');
    const docs = parseAllDocuments(raw)
      .map((d) => (d && typeof d.toJSON === 'function' ? d.toJSON() : null))
      .filter(Boolean);

    let stringData = {};
    let configMapData = {};
    for (const doc of docs) {
      if (doc.kind === 'Secret' && doc.stringData && typeof doc.stringData === 'object') {
        stringData = { ...stringData, ...doc.stringData };
      }
      if (doc.kind === 'ConfigMap' && doc.data && typeof doc.data === 'object') {
        configMapData = { ...configMapData, ...doc.data };
      }
    }
    return {
      stringData: trimDefined(stringData),
      configMapData: trimDefined(configMapData),
    };
  } catch (e) {
    logger.warn('Failed to parse k8s/secrets.yaml:', e.message);
    return null;
  }
}

/**
 * Maps Secret + ConfigMap entries into the same shape as cli/config.js (for deepMerge).
 * @param {string} projectRoot
 * @returns {Record<string, unknown>}
 */
export function configLayerFromK8sYaml(projectRoot) {
  const docs = loadK8sSecretsYamlDocs(projectRoot);
  if (!docs) return {};

  const d = docs.configMapData;
  const s = docs.stringData;

  const layer = {};

  if (d.DB_HOST || d.DB_PORT || d.DB_NAME || d.DB_USER || d.DB_BACKEND_MODE) {
    layer.database = {
      ...(d.DB_HOST && { host: d.DB_HOST }),
      ...(d.DB_PORT && { port: d.DB_PORT }),
      ...(d.DB_NAME && { name: d.DB_NAME }),
      ...(d.DB_USER && { user: d.DB_USER }),
      ...(d.DB_BACKEND_MODE && { backendMode: d.DB_BACKEND_MODE }),
    };
  }

  const googleId =
    d.NEXT_PUBLIC_AUTH_GOOGLE_ID || d.AUTH_GOOGLE_ID || d.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  if (s.AUTH_SECRET || googleId) {
    layer.auth = {
      ...(s.AUTH_SECRET && { secret: s.AUTH_SECRET }),
      ...(googleId && { googleClientId: googleId }),
    };
  }

  if (
    d.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
    d.NEXT_PUBLIC_FIREBASE_API_KEY ||
    d.NEXT_PUBLIC_FIREBASE_APP_ID
  ) {
    layer.firebase = {
      ...(d.NEXT_PUBLIC_FIREBASE_PROJECT_ID && { projectId: d.NEXT_PUBLIC_FIREBASE_PROJECT_ID }),
      ...(d.NEXT_PUBLIC_FIREBASE_API_KEY && { apiKey: d.NEXT_PUBLIC_FIREBASE_API_KEY }),
      ...(d.NEXT_PUBLIC_FIREBASE_APP_ID && { appId: d.NEXT_PUBLIC_FIREBASE_APP_ID }),
      ...(d.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN && { authDomain: d.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN }),
      ...(d.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET && {
        storageBucket: d.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      }),
      ...(d.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID && {
        messagingSenderId: d.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      }),
      ...(d.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID && {
        measurementId: d.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
      }),
      ...(d.NEXT_PUBLIC_FIREBASE_VAPID_KEY && { vapidKey: d.NEXT_PUBLIC_FIREBASE_VAPID_KEY }),
    };
  }

  if (d.POLYGON_RPC_URL || d.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID) {
    layer.web3 = {
      ...(d.POLYGON_RPC_URL && { polygonRpcUrl: d.POLYGON_RPC_URL }),
      ...(d.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID && {
        walletconnectProjectId: d.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID,
      }),
    };
  }

  const appUrl = d.NEXTAUTH_URL || d.NEXT_PUBLIC_APP_URL;
  const apiUrl = d.NEXT_PUBLIC_API_URL;
  if (appUrl || apiUrl) {
    layer.app = {
      ...(appUrl && { url: appUrl }),
      ...(apiUrl && { apiUrl: apiUrl }),
    };
  }

  if (d.WAYFORPAY_MERCHANT_ACCOUNT || d.WAYFORPAY_DOMAIN) {
    layer.wayforpay = {
      ...(d.WAYFORPAY_MERCHANT_ACCOUNT && { merchantAccount: d.WAYFORPAY_MERCHANT_ACCOUNT }),
      ...(d.WAYFORPAY_DOMAIN && { domain: d.WAYFORPAY_DOMAIN }),
    };
  }

  return layer;
}
