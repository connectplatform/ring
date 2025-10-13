/**
 * CLI Utilities for Ring Platform
 */

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',

  // Foreground colors
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',

  // Background colors
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
};

/**
 * Logger utility with colored output
 */
export const logger = {
  info: (message, ...args) => {
    console.log(`${colors.blue}ℹ${colors.reset} ${message}`, ...args);
  },

  success: (message, ...args) => {
    console.log(`${colors.green}✅${colors.reset} ${message}`, ...args);
  },

  warn: (message, ...args) => {
    console.log(`${colors.yellow}⚠️${colors.reset} ${message}`, ...args);
  },

  error: (message, ...args) => {
    console.error(`${colors.red}❌${colors.reset} ${message}`, ...args);
  },

  debug: (message, ...args) => {
    if (process.env.DEBUG || process.env.RING_DEBUG) {
      console.log(`${colors.dim}🐛${colors.reset} ${message}`, ...args);
    }
  }
};

/**
 * Execute shell command with proper error handling
 */
export function execCommand(command, options = {}) {
  const { execSync } = require('child_process');

  try {
    logger.debug(`Executing: ${command}`);
    const result = execSync(command, {
      stdio: options.silent ? 'pipe' : 'inherit',
      encoding: 'utf8',
      ...options
    });
    return result;
  } catch (error) {
    logger.error(`Command failed: ${command}`);
    throw error;
  }
}

/**
 * Check if running on supported platform
 */
export function checkPlatform() {
  const platform = process.platform;
  const supportedPlatforms = ['linux', 'darwin', 'win32'];

  if (!supportedPlatforms.includes(platform)) {
    logger.error(`Unsupported platform: ${platform}`);
    logger.info('Supported platforms: Linux, macOS, Windows');
    process.exit(1);
  }

  return platform;
}

/**
 * Validate required tools are installed
 */
export function validateDependencies() {
  const requiredTools = ['docker', 'ssh', 'kubectl'];

  for (const tool of requiredTools) {
    try {
      execCommand(`${tool} --version`, { silent: true });
    } catch (error) {
      logger.error(`Required tool not found: ${tool}`);
      logger.info(`Please install ${tool} to use Ring CLI`);
      process.exit(1);
    }
  }
}

/**
 * Parse version string and validate format
 */
export function parseVersion(version) {
  const versionRegex = /^v?\d+\.\d+\.\d+(-[\w\.\-]+)?$/;

  if (!versionRegex.test(version)) {
    logger.error(`Invalid version format: ${version}`);
    logger.info('Version should be in format: v1.2.3 or 1.2.3');
    process.exit(1);
  }

  return version.startsWith('v') ? version : `v${version}`;
}

/**
 * Wait for a condition with timeout
 */
export async function waitFor(condition, timeout = 300000, interval = 5000) {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    try {
      if (await condition()) {
        return true;
      }
    } catch (error) {
      logger.debug('Condition check failed:', error.message);
    }

    await new Promise(resolve => setTimeout(resolve, interval));
  }

  return false;
}

/**
 * Format bytes to human readable format
 */
export function formatBytes(bytes) {
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  if (bytes === 0) return '0 Bytes';

  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Validate Kubernetes connection
 */
export function validateK8sConnection(controlNode, namespace) {
  try {
    execCommand(`ssh ${controlNode} "kubectl get ns ${namespace}"`, { silent: true });
    logger.debug('Kubernetes connection validated');
    return true;
  } catch (error) {
    logger.error('Failed to connect to Kubernetes cluster');
    logger.error(`Control node: ${controlNode}, Namespace: ${namespace}`);
    return false;
  }
}
