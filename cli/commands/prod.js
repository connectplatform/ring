import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { getConfig } from '../config.js';
import { logger } from '../utils.js';
import { ringPlatformImage } from '../registry.js';
import {
  PROJECT_ROOT,
  KINGDOM_ROOT,
  resolveK8sDir,
  resolveLayer1CiScript,
} from '../paths.js';

const DEFAULT_SECRETS_PATH = join(
  KINGDOM_ROOT,
  'AI-SECRETS',
  'ring-platform.org',
  'ring-platform.org-secrets.json'
);

function resolveK8sProdYamlPath() {
  return process.env.RING_K8S_SECRETS_YAML || join(resolveK8sDir(), 'secrets.yaml');
}

/** Apply local k8s/secrets.yaml (Secret + ConfigMap). Editing the file does not change the cluster until this runs. */
function applyK8sProdYaml(k8sControlNode, k8sNamespace, options, label) {
  const yamlPath = resolveK8sProdYamlPath();
  if (!existsSync(yamlPath)) {
    logger.warn(
      `${label}: no file at ${yamlPath} (set RING_K8S_SECRETS_YAML); skipping Secret/ConfigMap apply`
    );
    return;
  }
  const yamlBody = readFileSync(yamlPath, 'utf8');
  const remote = `ssh ${k8sControlNode} kubectl apply -n ${k8sNamespace} -f -`;
  logger.debug(`Running: ${remote} (stdin: ${yamlPath})`);
  if (options?.dryRun) {
    logger.info(`💤 [dry-run] ${label}: ${remote} < ${yamlPath}`);
    return;
  }
  execSync(remote, {
    input: yamlBody,
    stdio: ['pipe', 'inherit', 'inherit'],
    cwd: PROJECT_ROOT,
  });
}

function loadRingPlatformSecrets() {
  const explicitPath = process.env.RING_CLI_SECRETS_PATH || DEFAULT_SECRETS_PATH;
  if (!existsSync(explicitPath)) {
    return {};
  }

  try {
    const raw = readFileSync(explicitPath, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    logger.warn('Failed to load AI-SECRETS file, continuing with CLI defaults:', error.message);
    return {};
  }
}

function resolveBuildArg(jsonOverride, configValue, fallback) {
  const j = jsonOverride !== undefined && jsonOverride !== null ? String(jsonOverride).trim() : '';
  if (j) return j;
  const c = configValue !== undefined && configValue !== null ? String(configValue).trim() : '';
  if (c) return c;
  return fallback || '';
}

function runCommand(command, options, label) {
  logger.debug(`Running: ${command}`);
  if (options?.dryRun) {
    logger.info(`💤 [dry-run] ${label}: ${command}`);
    return;
  }

  execSync(command, { stdio: 'inherit', cwd: PROJECT_ROOT });
}

/** Apply k8s/deployment.yaml so cluster matches git (replicas, strategy, probes); set-image sets the exact tag. */
function applyDeploymentYaml(k8sControlNode, k8sNamespace, options, label) {
  const deployYamlPath = join(resolveK8sDir(), 'deployment.yaml');
  if (!existsSync(deployYamlPath)) {
    logger.warn('k8s/deployment.yaml not found; skipping manifest apply (cluster may keep stale replicas/strategy)');
    return;
  }
  const yamlBody = readFileSync(deployYamlPath, 'utf8');
  const remote = `ssh ${k8sControlNode} kubectl apply -n ${k8sNamespace} -f -`;
  logger.debug(`Running: ${remote} (stdin: deployment.yaml)`);
  if (options?.dryRun) {
    logger.info(`💤 [dry-run] ${label}: ${remote} < k8s/deployment.yaml`);
    return;
  }
  execSync(remote, {
    input: yamlBody,
    stdio: ['pipe', 'inherit', 'inherit'],
    cwd: PROJECT_ROOT,
  });
}

export default async function prodCommand(options) {
  try {
    logger.info('🚀 Starting Ring Platform production deployment...');

    // Layer1 forge factory path (k3s-3 BuildKit → ringdom-clones OCI → k3s-or).
    // Prefer this over local docker build (Colima/QEMU OOM on aarch64).
    if (options.forgeBuildkit) {
      const ciScript = resolveLayer1CiScript();
      if (!existsSync(ciScript)) {
        throw new Error(`Missing Layer1 CI script: ${ciScript}`);
      }
      const args = ['bash', ciScript];
      if (options.dryRun) args.push('--dry-run');
      if (options.skipBuild) args.push('--skip-build');
      if (options.skipDeploy) args.push('--skip-deploy');
      if (options.fromForge) args.push('--from-forge');
      const ver = options.deployVersion || options.version;
      if (ver) {
        args.push('--version', String(ver).replace(/^v/i, ''));
      }
      logger.info('🏭 Layer1 CI via k3s-3 BuildKit (scripts/ci/layer1-forge-build-deploy.sh)');
      // Always execute — script owns --dry-run semantics (unlike local docker path).
      execSync(args.join(' '), { stdio: 'inherit', cwd: PROJECT_ROOT });
      return;
    }

    const config = getConfig();
    const secrets = loadRingPlatformSecrets();
    const packageJson = JSON.parse(readFileSync(join(PROJECT_ROOT, 'package.json'), 'utf8'));

    const version = options.deployVersion || options.version || packageJson.version;
    const normalizedVersion = String(version).replace(/^v/i, '');
    // Must match k8s deploy tag pattern; registry SSOT = Forgejo (cli/registry.js)
    const imageTag = `v${normalizedVersion}-ring-platform-org-amd64`;
    const imageName = ringPlatformImage(imageTag);

    const secretBuildArgs = secrets.build_args || {};
    const resolvedBuildArgs = {
      NEXT_PUBLIC_AUTH_GOOGLE_ID: resolveBuildArg(
        secretBuildArgs.NEXT_PUBLIC_AUTH_GOOGLE_ID,
        config.auth?.googleClientId,
        ''
      ),
      NEXT_PUBLIC_GOOGLE_CLIENT_ID: resolveBuildArg(
        secretBuildArgs.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
        config.auth?.googleClientId,
        ''
      ),
      NEXTAUTH_URL: resolveBuildArg(secretBuildArgs.NEXTAUTH_URL, config.app?.url, 'https://ring-platform.org'),
      NEXT_PUBLIC_FIREBASE_PROJECT_ID: resolveBuildArg(
        secretBuildArgs.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        config.firebase?.projectId,
        ''
      ),
      NEXT_PUBLIC_FIREBASE_API_KEY: resolveBuildArg(
        secretBuildArgs.NEXT_PUBLIC_FIREBASE_API_KEY,
        config.firebase?.apiKey,
        ''
      ),
      NEXT_PUBLIC_FIREBASE_APP_ID: resolveBuildArg(
        secretBuildArgs.NEXT_PUBLIC_FIREBASE_APP_ID,
        config.firebase?.appId,
        ''
      ),
      NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: resolveBuildArg(
        secretBuildArgs.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
        config.firebase?.authDomain,
        ''
      ),
      NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: resolveBuildArg(
        secretBuildArgs.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
        config.firebase?.storageBucket,
        ''
      ),
      NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: resolveBuildArg(
        secretBuildArgs.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
        config.firebase?.messagingSenderId,
        ''
      ),
      NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID: resolveBuildArg(
        secretBuildArgs.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
        config.firebase?.measurementId,
        ''
      ),
      NEXT_PUBLIC_FIREBASE_VAPID_KEY: resolveBuildArg(
        secretBuildArgs.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
        config.firebase?.vapidKey,
        ''
      ),
      NEXT_PUBLIC_APP_URL: resolveBuildArg(
        secretBuildArgs.NEXT_PUBLIC_APP_URL,
        config.app?.url,
        'https://ring-platform.org'
      ),
      NEXT_PUBLIC_API_URL: resolveBuildArg(
        secretBuildArgs.NEXT_PUBLIC_API_URL,
        config.app?.apiUrl,
        'https://ring-platform.org'
      ),
      DB_BACKEND_MODE: resolveBuildArg(
        secretBuildArgs.DB_BACKEND_MODE,
        config.database?.backendMode,
        'k8s-postgres-fcm'
      ),
      DB_HOST: resolveBuildArg(
        secretBuildArgs.DB_HOST,
        config.database?.host,
        'postgres.ring-platform-org.svc.cluster.local'
      ),
      DB_PORT: resolveBuildArg(secretBuildArgs.DB_PORT, config.database?.port, '5432'),
      DB_NAME: resolveBuildArg(secretBuildArgs.DB_NAME, config.database?.name, 'ring_platform'),
      DB_USER: resolveBuildArg(secretBuildArgs.DB_USER, config.database?.user, 'ring_user'),
      POLYGON_RPC_URL: resolveBuildArg(
        secretBuildArgs.POLYGON_RPC_URL,
        config.web3?.polygonRpcUrl,
        'https://polygon-rpc.com'
      ),
      NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID: resolveBuildArg(
        secretBuildArgs.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID,
        config.web3?.walletconnectProjectId,
        ''
      ),
      WAYFORPAY_MERCHANT_ACCOUNT: resolveBuildArg(
        secretBuildArgs.WAYFORPAY_MERCHANT_ACCOUNT,
        config.wayforpay?.merchantAccount,
        ''
      ),
      WAYFORPAY_DOMAIN: resolveBuildArg(secretBuildArgs.WAYFORPAY_DOMAIN, config.wayforpay?.domain, ''),
      NEXT_PUBLIC_PAYMENT_STORE_ALLOW_TOKEN: resolveBuildArg(
        secretBuildArgs.NEXT_PUBLIC_PAYMENT_STORE_ALLOW_TOKEN,
        process.env.NEXT_PUBLIC_PAYMENT_STORE_ALLOW_TOKEN,
        'false'
      ),
      NEXT_PUBLIC_PAYMENT_STORE_ALLOW_PAYPAL: resolveBuildArg(
        secretBuildArgs.NEXT_PUBLIC_PAYMENT_STORE_ALLOW_PAYPAL,
        process.env.NEXT_PUBLIC_PAYMENT_STORE_ALLOW_PAYPAL,
        'false'
      ),
    };

    // AUTH_SECRET is runtime-only (K8s secretKeyRef). Passing it as --build-arg
    // triggers Docker SecretsUsedInArgOrEnv and bakes the secret into image layers.
    const buildArgs = [
      'docker',
      'build',
      '--platform',
      'linux/amd64',
      '--build-arg',
      `NEXT_PUBLIC_AUTH_GOOGLE_ID="${resolvedBuildArgs.NEXT_PUBLIC_AUTH_GOOGLE_ID}"`,
      '--build-arg',
      `NEXT_PUBLIC_GOOGLE_CLIENT_ID="${resolvedBuildArgs.NEXT_PUBLIC_GOOGLE_CLIENT_ID}"`,
      '--build-arg',
      `NEXTAUTH_URL="${resolvedBuildArgs.NEXTAUTH_URL}"`,
      '--build-arg',
      `NEXT_PUBLIC_FIREBASE_PROJECT_ID="${resolvedBuildArgs.NEXT_PUBLIC_FIREBASE_PROJECT_ID}"`,
      '--build-arg',
      `NEXT_PUBLIC_FIREBASE_API_KEY="${resolvedBuildArgs.NEXT_PUBLIC_FIREBASE_API_KEY}"`,
      '--build-arg',
      `NEXT_PUBLIC_FIREBASE_APP_ID="${resolvedBuildArgs.NEXT_PUBLIC_FIREBASE_APP_ID}"`,
      '--build-arg',
      `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="${resolvedBuildArgs.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN}"`,
      '--build-arg',
      `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="${resolvedBuildArgs.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET}"`,
      '--build-arg',
      `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="${resolvedBuildArgs.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID}"`,
      '--build-arg',
      `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID="${resolvedBuildArgs.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID}"`,
      '--build-arg',
      `NEXT_PUBLIC_FIREBASE_VAPID_KEY="${resolvedBuildArgs.NEXT_PUBLIC_FIREBASE_VAPID_KEY}"`,
      '--build-arg',
      `NEXT_PUBLIC_APP_URL="${resolvedBuildArgs.NEXT_PUBLIC_APP_URL}"`,
      '--build-arg',
      `NEXT_PUBLIC_API_URL="${resolvedBuildArgs.NEXT_PUBLIC_API_URL}"`,
      '--build-arg',
      'RING_BUILD_SKIP_DB=1',
      '--build-arg',
      `DB_BACKEND_MODE="${resolvedBuildArgs.DB_BACKEND_MODE}"`,
      '--build-arg',
      `DB_HOST="${resolvedBuildArgs.DB_HOST}"`,
      '--build-arg',
      `DB_PORT="${resolvedBuildArgs.DB_PORT}"`,
      '--build-arg',
      `DB_NAME="${resolvedBuildArgs.DB_NAME}"`,
      '--build-arg',
      `DB_USER="${resolvedBuildArgs.DB_USER}"`,
      '--build-arg',
      `POLYGON_RPC_URL="${resolvedBuildArgs.POLYGON_RPC_URL}"`,
      '--build-arg',
      `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID="${resolvedBuildArgs.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID}"`,
      '--build-arg',
      `WAYFORPAY_MERCHANT_ACCOUNT="${resolvedBuildArgs.WAYFORPAY_MERCHANT_ACCOUNT}"`,
      '--build-arg',
      `WAYFORPAY_DOMAIN="${resolvedBuildArgs.WAYFORPAY_DOMAIN}"`,
      '--build-arg',
      `NEXT_PUBLIC_PAYMENT_STORE_ALLOW_TOKEN="${resolvedBuildArgs.NEXT_PUBLIC_PAYMENT_STORE_ALLOW_TOKEN}"`,
      '--build-arg',
      `NEXT_PUBLIC_PAYMENT_STORE_ALLOW_PAYPAL="${resolvedBuildArgs.NEXT_PUBLIC_PAYMENT_STORE_ALLOW_PAYPAL}"`,
      '-t',
      imageName,
      '.',
    ];

    const buildCommand = buildArgs.join(' ');

    logger.info(`📦 Deploying version: ${version}`);
    logger.info(`🐳 Image: ${imageName}`);

    const k8sControlNode =
      (process.env.RING_K8S_SSH_HOST && String(process.env.RING_K8S_SSH_HOST).trim()) ||
      config.k8s?.controlNode ||
      'k3s-or';
    const k8sNamespace = config.k8s?.namespace || 'ring-platform-org';
    const k8sDeployment = config.k8s?.deployment || 'ring-platform-org';
    const k8sContainer = config.k8s?.container || k8sDeployment;

    if (process.env.RING_K8S_SSH_HOST?.trim()) {
      logger.info(
        `🖥️  Using RING_K8S_SSH_HOST override for kubectl SSH: ${k8sControlNode}`
      );
    } else {
      logger.info(
        `🖥️  kubectl over SSH: ${k8sControlNode} (set in ~/.ring-platform.org/config.json as k8s.controlNode, or export RING_K8S_SSH_HOST=k3s-or for one-off deploys)`
      );
    }
    if (/k8s-control|k8s-1|195\.95\.233\.69/i.test(k8sControlNode)) {
      logger.warn(
        '⚠️  This SSH target looks like the legacy EU cluster (k8s-1). For US k3s-or / ring-platform.org DNS at 5.78.193.246, use: ring config --set k8s.controlNode=k3s-or'
      );
    }

    if (!options.skipBuild) {
      logger.info('🔨 Building Docker image...');
      runCommand(buildCommand, options, 'docker build');
      logger.success('✅ Docker image built successfully');
    }

    if (!options.skipPush) {
      logger.info('📤 Pushing Docker image...');
      runCommand(`docker push ${imageName}`, options, 'docker push');
      logger.success('✅ Docker image pushed successfully');
    }

    if (!options.skipDeploy) {
      logger.info('☸️  Deploying to Kubernetes...');
      if (options.applyK8sSecrets) {
        logger.info('🔐 Applying k8s prod YAML (Secret + ConfigMap) to cluster...');
        applyK8sProdYaml(k8sControlNode, k8sNamespace, options, 'kubectl apply secrets+config');
      }
      if (!options.skipManifestApply) {
        logger.info('📋 Applying k8s/deployment.yaml to cluster...');
        applyDeploymentYaml(k8sControlNode, k8sNamespace, options, 'kubectl apply deployment');
      }

      const deployCommand = [
        'ssh',
        k8sControlNode,
        `'kubectl -n ${k8sNamespace} set image deployment/${k8sDeployment} ${k8sContainer}=${imageName} && kubectl -n ${k8sNamespace} rollout status deployment/${k8sDeployment} --timeout=15m'`,
      ].join(' ');

      runCommand(deployCommand, options, 'k8s set image + rollout');
      logger.success('✅ Kubernetes deployment completed successfully');
    }

    if (options.dryRun) {
      logger.success(`✅ Ring CLI dry-run complete for ${version}. No deployment was executed.`);
      return;
    }

    logger.success(`🎉 Ring Platform v${version} deployed successfully!`);
    logger.info(`🌐 Available at: ${config.app?.url || 'https://ring-platform.org'}`);
  } catch (error) {
    logger.error('❌ Deployment failed:', error.message);
    process.exit(1);
  }
}
