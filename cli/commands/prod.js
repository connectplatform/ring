import { execSync, spawn } from 'child_process';
import { readFileSync } from 'fs';
import { join } from 'path';
import { getConfig, setConfig } from '../config.js';
import { logger } from '../utils.js';

export default async function prodCommand(options) {
  try {
    logger.info('🚀 Starting Ring Platform production deployment...');

    // Get version from package.json or options
    const packageJson = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8'));
    const version = options.version || packageJson.version;
    const imageTag = `v${version}-ring-platform.org-amd64`;
    const imageName = `ghcr.io/connectplatform/ring:${imageTag}`;

    logger.info(`📦 Deploying version: ${version}`);
    logger.info(`🐳 Image: ${imageName}`);

    // Get configuration
    const config = getConfig();
    const k8sControlNode = config.k8s?.controlNode || 'k8s-control-01';
    const k8sNamespace = config.k8s?.namespace || 'ring-platform-org';

    // Build Docker image
    if (!options.skipBuild) {
      logger.info('🔨 Building Docker image...');

      const buildArgs = [
        'docker', 'build',
        '--platform', 'linux/amd64',
        // Authentication (Critical)
        '--build-arg', `AUTH_SECRET="${config.auth?.secret || 's5dzmaQkiKWkfIBsDpRxaPrv/X93TIyy0M5Ofk/+8z0='}"`,
        '--build-arg', `NEXT_PUBLIC_AUTH_GOOGLE_ID="${config.auth?.googleClientId || '919637187324-286nus771ip11266pobu98mgsbkoclc4.apps.googleusercontent.com'}"`,
        '--build-arg', `NEXT_PUBLIC_GOOGLE_CLIENT_ID="${config.auth?.googleClientId || '919637187324-286nus771ip11266pobu98mgsbkoclc4.apps.googleusercontent.com'}"`,
        '--build-arg', `NEXTAUTH_URL="${config.app?.url || 'https://ring-platform.org'}"`,
        // Firebase Client SDK (Critical)
        '--build-arg', `NEXT_PUBLIC_FIREBASE_PROJECT_ID="${config.firebase?.projectId || 'ring-main'}"`,
        '--build-arg', `NEXT_PUBLIC_FIREBASE_API_KEY="${config.firebase?.apiKey || 'AIzaSyCWd2YVU7mN0FkMMO9ZDuIv6MlnunH7VX8'}"`,
        '--build-arg', `NEXT_PUBLIC_FIREBASE_APP_ID="${config.firebase?.appId || '1:919637187324:web:af95cb1c3d96f2bc0bd579'}"`,
        '--build-arg', `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="${config.firebase?.authDomain || 'ring-main.firebaseapp.com'}"`,
        '--build-arg', `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="${config.firebase?.storageBucket || 'ring-main.appspot.com'}"`,
        '--build-arg', `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="${config.firebase?.messagingSenderId || '919637187324'}"`,
        '--build-arg', `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID="${config.firebase?.measurementId || 'G-WVDVCRX12R'}"`,
        '--build-arg', `NEXT_PUBLIC_FIREBASE_VAPID_KEY="${config.firebase?.vapidKey || 'BKQ4OAwA-1wPgnqLXuvbf-RE-QetqqAJX-EENcmViZ97dhygWE6K7GFyNkB_fkQo_suVk06nbkDBnypsFaajSjw'}"`,
        // Application URLs
        '--build-arg', `NEXT_PUBLIC_APP_URL="${config.app?.url || 'https://ring-platform.org'}"`,
        '--build-arg', `NEXT_PUBLIC_API_URL="${config.app?.apiUrl || 'https://ring-platform.org'}"`,
        // Database Configuration
        '--build-arg', `DB_HOST="${config.database?.host || 'postgres.ring-platform-org.svc.cluster.local'}"`,
        '--build-arg', `DB_PORT="${config.database?.port || '5432'}"`,
        '--build-arg', `DB_NAME="${config.database?.name || 'ring_platform'}"`,
        '--build-arg', `DB_USER="${config.database?.user || 'ring_user'}"`,
        '--build-arg', `DB_HYBRID_MODE="${config.database?.hybridMode || 'true'}"`,
        // Web3 Configuration
        '--build-arg', `POLYGON_RPC_URL="${config.web3?.polygonRpcUrl || 'https://polygon-rpc.com'}"`,
        '-t', imageName,
        '.'
      ];

      logger.debug(`Running: ${buildArgs.join(' ')}`);
      execSync(buildArgs.join(' '), { stdio: 'inherit', cwd: process.cwd() });
      logger.success('✅ Docker image built successfully');
    }

    // Push Docker image
    if (!options.skipPush) {
      logger.info('📤 Pushing Docker image...');
      execSync(`docker push ${imageName}`, { stdio: 'inherit' });
      logger.success('✅ Docker image pushed successfully');
    }

    // Deploy to Kubernetes
    if (!options.skipDeploy) {
      logger.info('☸️  Deploying to Kubernetes...');

      const deployCommand = [
        'ssh', k8sControlNode,
        `'kubectl -n ${k8sNamespace} set image deployment/ring-platform ring-platform=${imageName} && kubectl -n ${k8sNamespace} rollout status deployment/ring-platform'`
      ].join(' ');

      logger.debug(`Running: ${deployCommand}`);
      execSync(deployCommand, { stdio: 'inherit' });
      logger.success('✅ Kubernetes deployment completed successfully');
    }

    logger.success(`🎉 Ring Platform v${version} deployed successfully!`);
    logger.info(`🌐 Available at: ${config.app?.url || 'https://ring-platform.org'}`);

  } catch (error) {
    logger.error('❌ Deployment failed:', error.message);
    process.exit(1);
  }
}
