import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { logger } from './utils.js';

// Configuration file location
const CONFIG_DIR = join(homedir(), '.ring-platform');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');

// Default configuration
const DEFAULT_CONFIG = {
  k8s: {
    controlNode: 'k8s-control-01',
    namespace: 'ring-platform-org'
  },
  database: {
    host: 'postgres.ring-platform-org.svc.cluster.local',
    port: '5432',
    name: 'ring_platform',
    user: 'ring_user',
    hybridMode: 'true'
  },
  auth: {
    secret: 's5dzmaQkiKWkfIBsDpRxaPrv/X93TIyy0M5Ofk/+8z0=',
    googleClientId: '919637187324-286nus771ip11266pobu98mgsbkoclc4.apps.googleusercontent.com'
  },
  firebase: {
    projectId: 'ring-main',
    apiKey: 'AIzaSyCWd2YVU7mN0FkMMO9ZDuIv6MlnunH7VX8',
    appId: '1:919637187324:web:af95cb1c3d96f2bc0bd579',
    authDomain: 'ring-main.firebaseapp.com',
    storageBucket: 'ring-main.appspot.com',
    messagingSenderId: '919637187324',
    measurementId: 'G-WVDVCRX12R',
    vapidKey: 'BKQ4OAwA-1wPgnqLXuvbf-RE-QetqqAJX-EENcmViZ97dhygWE6K7GFyNkB_fkQo_suVk06nbkDBnypsFaajSjw'
  },
  web3: {
    polygonRpcUrl: 'https://polygon-rpc.com'
  },
  app: {
    url: 'https://ring-platform.org',
    apiUrl: 'https://ring-platform.org'
  }
};

/**
 * Ensure configuration directory exists
 */
function ensureConfigDir() {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
    logger.debug(`Created configuration directory: ${CONFIG_DIR}`);
  }
}

/**
 * Load configuration from file
 */
function loadConfig() {
  try {
    if (existsSync(CONFIG_FILE)) {
      const configData = readFileSync(CONFIG_FILE, 'utf8');
      const userConfig = JSON.parse(configData);
      return deepMerge(DEFAULT_CONFIG, userConfig);
    }
  } catch (error) {
    logger.warn('Failed to load configuration file, using defaults:', error.message);
  }
  return { ...DEFAULT_CONFIG };
}

/**
 * Save configuration to file
 */
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

/**
 * Get configuration value by key path (dot notation)
 */
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

/**
 * Set configuration value by key path (dot notation)
 */
export function setConfig(key, value) {
  const config = loadConfig();
  const keys = key.split('.');
  let current = config;

  // Navigate to the parent object
  for (let i = 0; i < keys.length - 1; i++) {
    const k = keys[i];
    if (!(k in current) || typeof current[k] !== 'object') {
      current[k] = {};
    }
    current = current[k];
  }

  // Set the value
  const lastKey = keys[keys.length - 1];
  current[lastKey] = value;

  saveConfig(config);
}

/**
 * Reset configuration to defaults
 */
export function resetConfig() {
  saveConfig(DEFAULT_CONFIG);
}

/**
 * List all configuration values
 */
export function listConfig() {
  return loadConfig();
}

/**
 * Deep merge two objects
 */
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
