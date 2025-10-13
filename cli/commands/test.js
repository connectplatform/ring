import { Pool } from 'pg';
import { getDatabaseService } from '../../lib/database/DatabaseService.js';
import { initializeDatabase, getDatabaseService as getDatabaseServiceFromIndex } from '../../lib/database/index.js';

export default async function testCommand(options) {
  const { logger } = await import('../utils.js');

  try {
    logger.info('🧪 Running Ring Platform tests...');

    switch (options.type) {
      case 'db-connection':
        await testDbConnection();
        break;
      case 'db-service':
        await testDbService();
        break;
      case 'user-data':
        await testUserData();
        break;
      case 'username':
        await testUsername();
        break;
      default:
        logger.error('❌ Invalid test type. Use: db-connection, db-service, user-data, or username');
        process.exit(1);
    }

    logger.success('✅ Test completed successfully!');
  } catch (error) {
    logger.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

async function testDbConnection() {
  const { logger } = await import('../utils.js');
  logger.info('Testing PostgreSQL connection...');

  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'ring_platform',
    user: process.env.DB_USER || 'ring_user',
    password: process.env.DB_PASSWORD || 'ring_password_2024',
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });

  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    logger.success('✅ PostgreSQL connection successful!');

    // Test if users table exists
    const result = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users'");
    logger.info(`Users table exists: ${result.rows.length > 0 ? '✅' : '❌'}`);

    if (result.rows.length > 0) {
      const userCount = await pool.query('SELECT COUNT(*) FROM users');
      logger.info(`User count: ${userCount.rows[0].count}`);
    }

    await pool.end();
  } catch (error) {
    logger.error('❌ PostgreSQL connection failed:', error.message);
    logger.error('Error details:', error);
    throw error;
  }
}

async function testDbService() {
  const { logger } = await import('../utils.js');
  logger.info('Testing DatabaseService initialization...');

  try {
    const db = getDatabaseService();
    logger.info('Database service created');

    const result = await db.initialize();
    logger.info('Database initialization result:', {
      success: result.success,
      error: result.error?.message,
      metadata: result.metadata
    });

    if (result.success) {
      logger.success('✅ Database service initialized successfully!');

      // Test reading from users table
      const readResult = await db.read('users', 'test-user-id');
      logger.info('Test read result:', {
        success: readResult.success,
        data: readResult.data,
        error: readResult.error?.message
      });
    } else {
      logger.error('❌ Database service initialization failed:', result.error);
      throw new Error(result.error);
    }
  } catch (error) {
    logger.error('❌ Error testing database service:', error);
    throw error;
  }
}

async function testUserData() {
  const { logger } = await import('../utils.js');
  logger.info('Testing user data retrieval...');

  try {
    const initResult = await initializeDatabase();
    if (!initResult.success) {
      logger.error('Database initialization failed:', initResult.error);
      throw new Error(initResult.error);
    }

    const db = getDatabaseServiceFromIndex();
    const userId = '106810940377182887408'; // The Google user ID

    const result = await db.read('users', userId);
    logger.info('Database read result:', JSON.stringify(result, null, 2));

    if (result.success && result.data) {
      const userData = result.data.data || result.data;
      logger.info('User data structure:', {
        hasData: !!userData,
        keys: userData ? Object.keys(userData) : [],
        email: userData?.email,
        name: userData?.name,
        wallets: userData?.wallets,
        role: userData?.role
      });
    } else {
      logger.error('❌ No user data found');
    }
  } catch (error) {
    logger.error('❌ Test failed:', error);
    throw error;
  }
}

async function testUsername() {
  const { logger } = await import('../utils.js');
  logger.info('Testing username query functionality...');

  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'ring_platform',
    user: process.env.DB_USER || 'ring_user',
    password: process.env.DB_PASSWORD || 'ring_password_2024'
  });

  try {
    // Check if we can query by username
    const result = await pool.query(
      "SELECT id, data->>'username' as username FROM users WHERE data->>'username' = $1 LIMIT 1",
      ['testuser']
    );
    logger.info('Username query result:', result.rows);

    // Check the data structure
    const dataResult = await pool.query('SELECT id, data FROM users LIMIT 1');
    if (dataResult.rows.length > 0) {
      logger.info('Sample user data structure:', JSON.stringify(dataResult.rows[0], null, 2));
    } else {
      logger.info('No users found');
    }

    await pool.end();
  } catch (error) {
    logger.error('❌ Error testing username functionality:', error);
    throw error;
  }
}
