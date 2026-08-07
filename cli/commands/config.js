import { getConfig, setConfig, resetConfig, listConfig } from '../config.js';
import { logger } from '../utils.js';

export default async function configCommand(options) {
  try {
    if (options.set) {
      // Set configuration value
      const [key, value] = options.set.split('=');
      if (!key || value === undefined) {
        logger.error('❌ Invalid format. Use: ring config --set key=value');
        process.exit(1);
      }

      setConfig(key, value);
      logger.success(`✅ Configuration set: ${key} = ${value}`);

    } else if (options.get) {
      // Get configuration value
      const value = getConfig(options.get);
      if (value !== undefined) {
        console.log(`${options.get}: ${JSON.stringify(value, null, 2)}`);
      } else {
        logger.warn(`⚠️  Configuration key not found: ${options.get}`);
      }

    } else if (options.list) {
      // List all configuration
      const config = getConfig();
      console.log('Current Ring Platform Configuration:');
      console.log('=====================================');
      console.log(JSON.stringify(config, null, 2));

    } else if (options.reset) {
      // Reset configuration
      resetConfig();
      logger.success('✅ Configuration reset to defaults');

    } else {
      // Show help
      console.log(`
Ring Platform Configuration

USAGE:
  ring config --set <key=value>    Set a configuration value
  ring config --get <key>          Get a configuration value
  ring config --list               List all configuration values
  ring config --reset              Reset configuration to defaults

EXAMPLES:
  ring config --set k8s.controlNode=k3s-or
  ring config --set database.host=postgres.ring-platform-org.svc.cluster.local
  ring config --set app.url=https://ring-platform.org
  ring config --get k8s.namespace
  ring config --list

CONFIGURATION KEYS:
  k8s.controlNode          Kubernetes SSH host (e.g. k3s-or)
  k8s.namespace            Kubernetes namespace for deployment
  k8s.deployment           Deployment name (default ring-platform-org)
  k8s.container            Container name for kubectl set image
  database.host            PostgreSQL host
  database.port            PostgreSQL port
  database.name            PostgreSQL database name
  database.user            PostgreSQL username
  database.backendMode     DB_BACKEND_MODE (e.g. k8s-postgres-fcm)
  auth.secret              NextAuth secret
  auth.googleClientId      Google OAuth client ID
  firebase.projectId       Firebase project ID
  firebase.apiKey          Firebase API key
  firebase.appId           Firebase app ID
  firebase.authDomain      Firebase auth domain
  firebase.storageBucket   Firebase storage bucket
  firebase.messagingSenderId Firebase messaging sender ID
  firebase.measurementId   Firebase measurement ID
  firebase.vapidKey        Firebase VAPID key
  web3.polygonRpcUrl       Polygon RPC URL
  app.url                  Application URL
  app.apiUrl               API URL
  upgrade.repoUrl          Upstream Ring git repo for \`ring upgrade\` (community: https://github.com/connectplatform/ring)
  upgrade.branch           Upstream branch to sync from (default main)
  upgrade.remote           Local git remote name tracking upstream (default ring-upstream)
  upgrade.lastSyncedRef    Last upstream commit synced (auto-managed by \`ring upgrade --apply\`)
      `);
    }

  } catch (error) {
    logger.error('❌ Configuration command failed:', error.message);
    process.exit(1);
  }
}
