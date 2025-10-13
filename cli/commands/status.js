import { execSync } from 'child_process';
import { getConfig } from '../config.js';
import { logger } from '../utils.js';

export default async function statusCommand() {
  try {
    logger.info('📊 Checking Ring Platform deployment status...');

    const config = getConfig();
    const k8sControlNode = config.k8s?.controlNode || 'k8s-control-01';
    const k8sNamespace = config.k8s?.namespace || 'ring-platform-org';

    // Check Kubernetes pods
    logger.info('☸️  Checking Kubernetes pods...');
    try {
      const podStatus = execSync(`ssh ${k8sControlNode} "kubectl get pods -n ${k8sNamespace}"`, { encoding: 'utf8' });
      console.log(podStatus);
    } catch (error) {
      logger.error('❌ Failed to check pod status:', error.message);
    }

    // Check Kubernetes services
    logger.info('🔗 Checking Kubernetes services...');
    try {
      const serviceStatus = execSync(`ssh ${k8sControlNode} "kubectl get svc -n ${k8sNamespace}"`, { encoding: 'utf8' });
      console.log(serviceStatus);
    } catch (error) {
      logger.error('❌ Failed to check service status:', error.message);
    }

    // Check ingress
    logger.info('🌐 Checking ingress status...');
    try {
      const ingressStatus = execSync(`ssh ${k8sControlNode} "kubectl get ingress -n ${k8s-control-01}"`, { encoding: 'utf8' });
      console.log(ingressStatus);
    } catch (error) {
      logger.error('❌ Failed to check ingress status:', error.message);
    }

    // Check application health
    const appUrl = config.app?.url || 'https://ring-platform.org';
    logger.info(`🏥 Checking application health at ${appUrl}...`);
    try {
      const healthResponse = execSync(`curl -s -o /dev/null -w "%{http_code}" ${appUrl}/api/health`, { encoding: 'utf8' });
      if (healthResponse === '200') {
        logger.success('✅ Application health check passed');
      } else {
        logger.warn(`⚠️  Application health check failed with status: ${healthResponse}`);
      }
    } catch (error) {
      logger.error('❌ Application health check failed:', error.message);
    }

    // Check database connectivity
    logger.info('🗄️  Checking database connectivity...');
    try {
      const dbHost = config.database?.host || 'postgres.ring-platform-org.svc.cluster.local';
      const dbPort = config.database?.port || '5432';
      const dbTest = execSync(`ssh ${k8sControlNode} "kubectl exec -n ${k8sNamespace} deployment/ring-platform -- nc -zv ${dbHost} ${dbPort}"`, { encoding: 'utf8' });
      if (dbTest.includes('succeeded')) {
        logger.success('✅ Database connectivity check passed');
      } else {
        logger.warn('⚠️  Database connectivity check failed');
      }
    } catch (error) {
      logger.error('❌ Database connectivity check failed:', error.message);
    }

  } catch (error) {
    logger.error('❌ Status check failed:', error.message);
    process.exit(1);
  }
}
