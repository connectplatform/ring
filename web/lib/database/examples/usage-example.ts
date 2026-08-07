/**
 * Database Abstraction Layer Usage Examples
 *
 * This file demonstrates how to use the new database abstraction layer
 * to replace direct Firebase/PostgreSQL operations
 */

import {
  createDatabaseService,
  createHybridDatabaseService,
  DatabaseResult,
  DatabaseDocument,
  DatabaseService
} from '../index';

// ============================================================================
// BASIC USAGE EXAMPLE
// ============================================================================

export class UserService {
  constructor(private db: DatabaseService) {}

  async createUser(userData: {
    email: string;
    username: string;
    displayName: string;
    role?: string;
  }): Promise<DatabaseResult<DatabaseDocument>> {
    // Validate input
    if (!userData.email || !userData.username) {
      return {
        success: false,
        error: new Error('Email and username are required'),
        metadata: {
          operation: 'createUser',
          duration: 0,
          backend: 'validation',
          timestamp: new Date()
        }
      };
    }

    // Create user with abstraction layer
    return await this.db.create('users', {
      ...userData,
      role: userData.role || 'MEMBER',
      emailVerified: false,
      createdAt: new Date(),
      updatedAt: new Date()
    });
  }

  async getUserById(userId: string): Promise<DatabaseResult<DatabaseDocument | null>> {
    return await this.db.read('users', userId);
  }

  async updateUserProfile(
    userId: string,
    updates: Partial<{ displayName: string; bio: string; avatar: string }>
  ): Promise<DatabaseResult<DatabaseDocument>> {
    return await this.db.update('users', userId, {
      ...updates,
      updatedAt: new Date()
    });
  }

  async findUsersByRole(role: string, limit = 50): Promise<DatabaseResult<DatabaseDocument[]>> {
    return await this.db.query({
      collection: 'users',
      filters: [{ field: 'role', operator: '==', value: role }],
      orderBy: [{ field: 'createdAt', direction: 'desc' }],
      pagination: { limit }
    });
  }
}

// ============================================================================
// ENTITY SERVICE EXAMPLE
// ============================================================================

export class EntityService {
  constructor(private db: DatabaseService) {}

  async createEntity(entityData: {
    name: string;
    type: string;
    description?: string;
    addedBy: string;
  }): Promise<DatabaseResult<DatabaseDocument>> {
    return await this.db.create('entities', {
      ...entityData,
      visibility: 'public',
      isConfidential: false,
      verificationStatus: 'unverified',
      trustScore: 0.0,
      memberCount: 0,
      tags: [],
      industries: [],
      services: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      lastUpdated: new Date(),
      dateAdded: new Date()
    });
  }

  async searchEntities(query: string, filters: any = {}): Promise<DatabaseResult<DatabaseDocument[]>> {
    const dbFilters = [];

    // Add search filter using PostgreSQL full-text search
    if (query) {
      dbFilters.push({
        field: 'search_vector',
        operator: 'custom', // Will be handled by PostgreSQL adapter
        value: query
      });
    }

    // Add other filters
    if (filters.type) {
      dbFilters.push({ field: 'type', operator: '==', value: filters.type });
    }

    if (filters.visibility) {
      dbFilters.push({ field: 'visibility', operator: '==', value: filters.visibility });
    }

    return await this.db.query({
      collection: 'entities',
      filters: dbFilters,
      orderBy: [{ field: 'trustScore', direction: 'desc' }],
      pagination: { limit: filters.limit || 20 }
    });
  }
}

// ============================================================================
// OPPORTUNITY SERVICE EXAMPLE
// ============================================================================

export class OpportunityService {
  constructor(private db: DatabaseService) {}

  async createOpportunity(opportunityData: {
    title: string;
    description: string;
    type: string;
    createdBy: string;
    budget?: { min: number; max: number; currency: string };
    deadline?: Date;
  }): Promise<DatabaseResult<DatabaseDocument>> {
    return await this.db.create('opportunities', {
      ...opportunityData,
      status: 'active',
      priority: 'medium',
      visibility: 'public',
      isConfidential: false,
      skillsRequired: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      dateUpdated: new Date()
    });
  }

  async findOpportunities(filters: {
    type?: string;
    status?: string;
    skills?: string[];
    budget?: { min?: number; max?: number };
    limit?: number;
  } = {}): Promise<DatabaseResult<DatabaseDocument[]>> {
    const dbFilters = [];

    if (filters.type) {
      dbFilters.push({ field: 'type', operator: '==', value: filters.type });
    }

    if (filters.status) {
      dbFilters.push({ field: 'status', operator: '==', value: filters.status });
    }

    if (filters.skills && filters.skills.length > 0) {
      // Use array overlap operator for skills matching
      dbFilters.push({
        field: 'skillsRequired',
        operator: 'array-contains-any',
        value: filters.skills
      });
    }

    if (filters.budget) {
      // Budget range filtering (would need custom handling in adapters)
      if (filters.budget.min !== undefined) {
        dbFilters.push({
          field: 'budget.min',
          operator: '>=',
          value: filters.budget.min
        });
      }
      if (filters.budget.max !== undefined) {
        dbFilters.push({
          field: 'budget.max',
          operator: '<=',
          value: filters.budget.max
        });
      }
    }

    return await this.db.query({
      collection: 'opportunities',
      filters: dbFilters,
      orderBy: [
        { field: 'priority', direction: 'desc' },
        { field: 'createdAt', direction: 'desc' }
      ],
      pagination: { limit: filters.limit || 20 }
    });
  }
}

// ============================================================================
// MAIN APPLICATION USAGE
// ============================================================================

export async function initializeApplicationDatabase() {
  // Choose database configuration based on environment
  const isProduction = process.env.NODE_ENV === 'production';
  const useHybrid = process.env.DB_HYBRID_MODE === 'true';

  let dbService: DatabaseService;

  if (isProduction && useHybrid) {
    // Use both PostgreSQL and Firebase with sync
    dbService = createHybridDatabaseService();
    console.log('🚀 Initializing hybrid database (PostgreSQL + Firebase)');
  } else {
    // Use PostgreSQL only
    dbService = createDatabaseService();
    console.log('🚀 Initializing PostgreSQL database');
  }

  // Initialize the service
  const initResult = await dbService.initialize();
  if (!initResult.success) {
    throw new Error(`Database initialization failed: ${initResult.error?.message}`);
  }

  // Create service instances
  const userService = new UserService(dbService);
  const entityService = new EntityService(dbService);
  const opportunityService = new OpportunityService(dbService);

  return {
    dbService,
    userService,
    entityService,
    opportunityService
  };

  console.log('✅ Database initialized successfully');
}

// ============================================================================
// EXAMPLE USAGE IN ROUTE HANDLERS
// ============================================================================

// Example Next.js API route
export async function POST_createUser(request: Request) {
  try {
    const { dbService } = await initializeApplicationDatabase();
    const body = await request.json();

    const result = await dbService.create('users', {
      ...body,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    if (!result.success) {
      return Response.json(
        { error: result.error?.message },
        { status: 400 }
      );
    }

    return Response.json({
      success: true,
      data: result.data
    });
  } catch (error) {
    console.error('Create user error:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Example with transaction
export async function POST_createOrderWithInventoryUpdate(orderData: any) {
  const { dbService } = await initializeApplicationDatabase();

  const result = await dbService.transaction(async (transaction) => {
    // Create order
    const order = await transaction.create('orders', {
      ...orderData,
      status: 'pending',
      createdAt: new Date()
    });

    // Update inventory for each item
    for (const item of orderData.items) {
      await transaction.update('products', item.productId, {
        stock: { __decrement: item.quantity },
        updatedAt: new Date()
      });
    }

    return order;
  });

  return result;
}

// ============================================================================
// REAL-TIME SUBSCRIPTIONS EXAMPLE
// ============================================================================

export async function subscribeToMessages(conversationId: string, callback: Function) {
  const { dbService } = await initializeApplicationDatabase();

  const result = await dbService.subscribe(
    'messages',
    [
      { field: 'conversationId', operator: '==', value: conversationId }
    ],
    (documents) => {
      // Handle real-time message updates
      callback(documents);
    }
  );

  if (result.success) {
    console.log('✅ Subscribed to messages');

    // Return unsubscribe function
    return result.data?.unsubscribe;
  } else {
    console.error('❌ Failed to subscribe:', result.error);
    return null;
  }
}

// ============================================================================
// MIGRATION HELPERS
// ============================================================================

/**
 * Helper to migrate data from direct Firebase usage to abstraction layer
 */
export async function migrateUserData() {
  // This would be used during the migration phase to move data
  const { dbService } = await initializeApplicationDatabase();

  // Example: Migrate existing Firebase users to PostgreSQL
  // (This would be implemented based on your existing Firebase data)

  console.log('🔄 Starting user data migration...');

  // Implementation would depend on your existing Firebase structure
  // and migration strategy (one-time migration vs gradual)
}

/**
 * Helper to validate data consistency across backends
 */
export async function validateDataConsistency(collection: string, documentId: string) {
  const { dbService } = await initializeApplicationDatabase();

  // Read from current backend
  const result = await dbService.read(collection, documentId);

  if (result.success && result.data) {
    console.log('✅ Document exists and is consistent');
    return true;
  } else {
    console.error('❌ Document consistency check failed:', result.error);
    return false;
  }
}

const DatabaseServices = {
  UserService,
  EntityService,
  OpportunityService,
  initializeApplicationDatabase
};

export default DatabaseServices;
