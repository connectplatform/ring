import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { logger } from './utils.js';
import { configLayerFromK8sYaml } from './load-k8s-prod-yaml.js';
import { PROJECT_ROOT } from './paths.js';

const CONFIG_DIR = join(homedir(), '.ring-platform.org');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');

/**
 * Safe defaults only — no production secrets in git.
 * Prod values: merge from k8s/secrets.yaml (Secret stringData + ConfigMap data), optional AI-SECRETS JSON (see prod),
 * then ~/.ring-platform.org/config.json overrides.
 */
const DEFAULT_CONFIG = {
  k8s: {
    controlNode: 'k3s-or',
    namespace: 'ring-platform-org',
    deployment: 'ring-platform-org',
    container: 'ring-platform-org',
  },
  database: {
    host: 'postgres.ring-platform-org.svc.cluster.local',
    port: '5432',
    name: 'ring_platform',
    user: 'ring_user',
    backendMode: 'k8s-postgres-fcm',
  },
  auth: {
    secret: '',
    googleClientId: '',
  },
  firebase: {
    projectId: '',
    apiKey: '',
    appId: '',
    authDomain: '',
    storageBucket: '',
    messagingSenderId: '',
    measurementId: '',
    vapidKey: '',
  },
  web3: {
    polygonRpcUrl: 'https://polygon-rpc.com',
    walletconnectProjectId: '',
  },
  wayforpay: {
    merchantAccount: '',
    domain: '',
  },
  app: {
    url: 'https://ring-platform.org',
    apiUrl: 'https://ring-platform.org',
  },
  upgrade: {
    // Upstream Ring Platform git repository to pull system updates from.
    // Community default; private clones override via: ring config --set upgrade.repoUrl=<url>
    repoUrl: 'https://github.com/connectplatform/ring',
    branch: 'main',
    // Local git remote name used to track upstream inside this clone.
    remote: 'ring-upstream',
    // Last upstream commit successfully synced into this clone (enables 3-way merges).
    // Auto-updated by `ring upgrade --apply`; leave empty for the first sync.
    lastSyncedRef: '',
  },
};

function loadK8sYamlLayer() {
  try {
    // PROJECT_ROOT = ring/web (k8s/ is a DX symlink to ring-platform-org/k8s)
    return configLayerFromK8sYaml(PROJECT_ROOT);
  } catch (e) {
    logger.warn('k8s/secrets.yaml overlay skipped:', e.message);
    return {};
  }
}

function ensureConfigDir() {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
    logger.debug(`Created configuration directory: ${CONFIG_DIR}`);
  }
}

function loadConfig() {
  const yamlLayer = loadK8sYamlLayer();
  let base = deepMerge({ ...DEFAULT_CONFIG }, yamlLayer);

  try {
    if (existsSync(CONFIG_FILE)) {
      const configData = readFileSync(CONFIG_FILE, 'utf8');
      const userConfig = JSON.parse(configData);
      return deepMerge(base, userConfig);
    }
  } catch (error) {
    logger.warn('Failed to load configuration file, using defaults + k8s yaml:', error.message);
  }
  return base;
}

function saveConfig(config) {
  try {
    ensureConfigDir();
    writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
    logger.debug(`Configuration saved to: ${CONFIG_FILE}`);
  } catch (error) {
    logger.error('Failed to save configuration:', error.message);
    throw error;
  }
}

export function getConfig(key) {
  const config = loadConfig();

  if (!key) {
    return config;
  }

  const keys = key.split('.');
  let value = config;

  for (const k of keys) {
    if (value && typeof value === 'object' && k in value) {
      value = value[k];
    } else {
      return undefined;
    }
  }

  return value;
}

export function setConfig(key, value) {
  const config = loadConfig();
  const keys = key.split('.');
  let current = config;

  for (let i = 0; i < keys.length - 1; i++) {
    const k = keys[i];
    if (!(k in current) || typeof current[k] !== 'object') {
      current[k] = {};
    }
    current = current[k];
  }

  const lastKey = keys[keys.length - 1];
  current[lastKey] = value;

  saveConfig(config);
}

export function resetConfig() {
  ensureConfigDir();
  writeFileSync(CONFIG_FILE, JSON.stringify({}, null, 2));
}

export function listConfig() {
  return loadConfig();
}

function deepMerge(target, source) {
  const result = { ...target };

  for (const key in source) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(result[key] || {}, source[key]);
    } else {
      result[key] = source[key];
    }
  }

  return result;
}
