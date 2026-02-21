/**
 * PostgreSQL Adapter for Database Abstraction Layer
 *
 * Implements IDatabaseService for PostgreSQL with Firebase-compatible operations
 */

import { monotime } from '../timer'
import { Pool, PoolClient, QueryResult } from 'pg';
import {
  IDatabaseService,
  DatabaseResult,
  DatabaseFilter,
  DatabaseOrderBy,
  DatabasePagination,
  DatabaseQuery,
  DatabaseDocument,
  IDatabaseTransaction,
  DatabaseSchema,
  DatabaseBackendConfig
} from '../interfaces/IDatabaseService';

export class PostgreSQLAdapter implements IDatabaseService {
  private pool: Pool | null = null;
  private config: DatabaseBackendConfig;

  // Static flag to prevent repeated connection testing across instances
  private static connectionTested = false;

  // Field mapping for hybrid schema (top-level columns vs JSONB data)
  // Tables with a JSONB 'data' column: list only their real top-level columns here.
  // Tables with fully-normalized schemas (no 'data' column): list ALL columns so
  // the query builder uses direct column references instead of data->>'field'.
  private fieldMappings: Record<string, Set<string>> = {
    // --- JSONB-based tables (id + data + timestamps) ---
    users: new Set([
      'id', 'created_at', 'updated_at'
    ]),
    entities: new Set([
      'id', 'created_at', 'updated_at'
    ]),
    // --- Fully-normalized tables (no 'data' column) ---
    // Note: include both snake_case (DB columns) and camelCase (app code) so
    // getFieldReference() recognises either form as a real column.
    fcm_tokens: new Set([
      'id', 'user_id', 'userId', 'token', 'device_info', 'deviceInfo',
      'platform', 'browser', 'user_agent', 'userAgent',
      'is_active', 'isActive', 'last_seen', 'lastSeen',
      'created_at', 'createdAt', 'updated_at', 'updatedAt'
    ]),
    comment_likes: new Set([
      'id', 'comment_id', 'commentId', 'user_id', 'userId',
      'user_name', 'userName', 'user_avatar', 'userAvatar',
      'created_at', 'createdAt', 'updated_at', 'updatedAt'
    ]),
    news_likes: new Set([
      'id', 'news_id', 'newsId', 'user_id', 'userId', 'created_at', 'createdAt'
    ]),
    vendor_applications: new Set([
      'id', 'entity_id', 'entityId', 'user_id', 'userId',
      'business_name', 'businessName', 'business_description', 'businessDescription',
      'contact_email', 'contactEmail', 'contact_phone', 'contactPhone',
      'website', 'business_type', 'businessType', 'tax_id', 'taxId',
      'documents', 'status',
      'submitted_at', 'submittedAt', 'reviewed_at', 'reviewedAt',
      'reviewed_by', 'reviewedBy', 'review_notes', 'reviewNotes',
      'rejection_reason', 'rejectionReason',
      'created_at', 'createdAt', 'updated_at', 'updatedAt'
    ]),
    vendor_profiles: new Set([
      'id', 'entity_id', 'entityId', 'user_id', 'userId',
      'onboarding_status', 'onboardingStatus',
      'onboarding_started_at', 'onboardingStartedAt',
      'onboarding_completed_at', 'onboardingCompletedAt',
      'trust_level', 'trustLevel', 'trust_score', 'trustScore',
      'performance_metrics', 'performanceMetrics',
      'compliance_status', 'complianceStatus',
      'suspension_history', 'suspensionHistory',
      'tier_progression_history', 'tierProgressionHistory',
      'notes', 'created_at', 'createdAt', 'updated_at', 'updatedAt',
      'last_active_at', 'lastActiveAt'
    ]),
  };

  constructor(config: DatabaseBackendConfig) {
    this.config = config;
  }

  async connect(): Promise<DatabaseResult<void>> {
    try {
      const startTime = monotime();
      
      const poolConfig = {
        host: this.config.connection.host || 'localhost',
        port: this.config.connection.port || 5432,
        database: this.config.connection.database || 'ring_platform',
        user: this.config.connection.username || 'ring_user',
        password: this.config.connection.password || 'ring_dev_password',
        max: this.config.options.poolSize || 20,
        idleTimeoutMillis: this.config.options.timeout || 30000,
        connectionTimeoutMillis: this.config.options.timeout || 2000,
      };

      this.pool = new Pool(poolConfig);

      // Test connection (only once across all instances to reduce noise)
      if (!PostgreSQLAdapter.connectionTested) {
        const client = await this.pool.connect();
        await client.query('SELECT 1');
        client.release();
        PostgreSQLAdapter.connectionTested = true;
      }

      return {
        success: true,
        metadata: {
          operation: 'connect',
          duration: monotime() - startTime,
          backend: 'postgresql',
          timestamp: new Date()
        }
      };
    } catch (error) {
      const code = (error as any).code;
      if (code === 'ECONNREFUSED' || code === 'ENOTFOUND') {
        const host = this.config.connection.host || 'localhost';
        const port = this.config.connection.port || 5432;
        console.warn(`PostgreSQLAdapter: Connection unavailable (${host}:${port}) — ${code}`);
      } else {
        console.error('PostgreSQLAdapter: Connection failed:', error instanceof Error ? error.message : String(error));
      }
      
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
        metadata: {
          operation: 'connect',
          duration: 0,
          backend: 'postgresql',
          timestamp: new Date()
        }
      };
    }
  }

  async disconnect(): Promise<DatabaseResult<void>> {
    try {
      const startTime = monotime();

      if (this.pool) {
        await this.pool.end();
        this.pool = null;
      }

      return {
        success: true,
        metadata: {
          operation: 'disconnect',
          duration: monotime() - startTime,
          backend: 'postgresql',
          timestamp: new Date()
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
        metadata: {
          operation: 'disconnect',
          duration: monotime() - monotime(),
          backend: 'postgresql',
          timestamp: new Date()
        }
      };
    }
  }

  async healthCheck(): Promise<DatabaseResult<boolean>> {
    try {
      if (!this.pool) {
        return { success: true, data: false };
      }

      const client = await this.pool.connect();
      await client.query('SELECT 1');
      client.release();

      return { success: true, data: true };
    } catch (error) {
      return { success: true, data: false };
    }
  }

  getBackendType(): string {
    return 'postgresql';
  }

  async create<T = any>(
    collection: string,
    data: T,
    options: { id?: string; merge?: boolean } = {}
  ): Promise<DatabaseResult<DatabaseDocument<T>>> {
    try {
      const startTime = monotime();

      if (!this.pool) {
        throw new Error('Database not connected');
      }

      const client = await this.pool.connect();

      try {
        const id = options.id || this.generateId();
        const now = new Date();

        // For JSONB-based tables, store all data in the 'data' column
        const documentData = {
          id,
          data: {
            ...data,
            id,
            created_at: now,
            updated_at: now,
            version: 1
          },
          created_at: now,
          updated_at: now
        };

        // Build insert query for JSONB schema
        const columns = ['id', 'data', 'created_at', 'updated_at'];
        const values = [documentData.id, JSON.stringify(documentData.data), documentData.created_at, documentData.updated_at];
        const placeholders = ['$1', '$2', '$3', '$4'];

        const query = `
          INSERT INTO ${collection} (${columns.join(', ')})
          VALUES (${placeholders.join(', ')})
          RETURNING *
        `;

        const result = await client.query(query, values);
        const row = result.rows[0];

        // Convert snake_case to camelCase for consistency
        const convertedData = this.convertRowToDocument<T>(row);

        return {
          success: true,
          data: {
            id: row.id,
            data: convertedData,
            metadata: {
              createdAt: row.created_at || now,
              updatedAt: row.updated_at || now,
              version: row.version || 1
            }
          },
          metadata: {
            operation: 'create',
            duration: monotime() - startTime,
            backend: 'postgresql',
            timestamp: new Date()
          }
        };
      } finally {
        client.release();
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
        metadata: {
          operation: 'create',
          duration: 0,
          backend: 'postgresql',
          timestamp: new Date()
        }
      };
    }
  }

  async read<T = any>(
    collection: string,
    id: string
  ): Promise<DatabaseResult<DatabaseDocument<T> | null>> {
    try {
      const startTime = monotime();

      if (!this.pool) {
        throw new Error('Database not connected');
      }

      const client = await this.pool.connect();

      try {
        // For users table, the id field contains the firebase_uid
        // For other collections, use id field as normal
        const lookupField = 'id';
        const lookupValue = id;

        const query = `SELECT * FROM ${collection} WHERE ${lookupField} = $1`;
        const result = await client.query(query, [lookupValue]);

        if (result.rows.length === 0) {
          return {
            success: true,
            data: null,
            metadata: {
              operation: 'read',
              duration: monotime() - startTime,
              backend: 'postgresql',
              timestamp: new Date()
            }
          };
        }

        const row = result.rows[0];
        const convertedData = this.convertRowToDocument<T>(row);

        return {
          success: true,
          data: {
            id: row.id,
            data: convertedData,
            metadata: {
              createdAt: row.created_at,
              updatedAt: row.updated_at,
              version: row.version || 1
            }
          },
          metadata: {
            operation: 'read',
            duration: monotime() - startTime,
            backend: 'postgresql',
            timestamp: new Date()
          }
        };
      } finally {
        client.release();
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
        metadata: {
          operation: 'read',
          duration: 0,
          backend: 'postgresql',
          timestamp: new Date()
        }
      };
    }
  }

  async update<T = any>(
    collection: string,
    id: string,
    data: Partial<T>,
    options: { merge?: boolean } = {}
  ): Promise<DatabaseResult<DatabaseDocument<T>>> {
    try {
      const startTime = monotime();

      if (!this.pool) {
        throw new Error('Database not connected');
      }

      const client = await this.pool.connect();

      try {
        const now = new Date();

        // For users table, the id field contains the firebase_uid
        // For other collections, use id field as normal
        const lookupField = 'id';
        const lookupValue = id;

        // For JSONB-based tables, we need to merge the data into the existing JSONB column
        // First, get the current data
        const selectQuery = `SELECT * FROM ${collection} WHERE ${lookupField} = $1`;
        const selectResult = await client.query(selectQuery, [lookupValue]);

        if (selectResult.rows.length === 0) {
          throw new Error('Document not found');
        }

        const currentRow = selectResult.rows[0];
        // PostgreSQL automatically parses JSONB columns, so check if it's already an object
        const currentData = currentRow.data ?
          (typeof currentRow.data === 'string' ? JSON.parse(currentRow.data) : currentRow.data) :
          {};

        // Merge the new data with existing data
        const mergedData = options.merge !== false ? { ...currentData, ...data } : data;
        mergedData.updated_at = now;

        // Update the document using the same field we used for lookup
        const updateQuery = `
          UPDATE ${collection}
          SET data = $1, updated_at = $2
          WHERE id = $3
          RETURNING *
        `;

        const result = await client.query(updateQuery, [JSON.stringify(mergedData), now, lookupValue]);

        if (result.rows.length === 0) {
          throw new Error('Document not found');
        }

        const row = result.rows[0];
        const convertedData = this.convertRowToDocument<T>(row);

        return {
          success: true,
          data: {
            id: row.id,
            data: convertedData,
            metadata: {
              createdAt: row.created_at,
              updatedAt: row.updated_at,
              version: row.version || 1
            }
          },
          metadata: {
            operation: 'update',
            duration: monotime() - startTime,
            backend: 'postgresql',
            timestamp: new Date()
          }
        };
      } finally {
        client.release();
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
        metadata: {
          operation: 'update',
          duration: 0,
          backend: 'postgresql',
          timestamp: new Date()
        }
      };
    }
  }

  async delete(
    collection: string,
    id: string
  ): Promise<DatabaseResult<void>> {
    try {
      const startTime = monotime();

      if (!this.pool) {
        throw new Error('Database not connected');
      }

      const client = await this.pool.connect();

      try {
        // For users table, the id field contains the firebase_uid
        // For other collections, use id field as normal
        const lookupField = 'id';
        const lookupValue = id;

        const query = `DELETE FROM ${collection} WHERE ${lookupField} = $1`;
        await client.query(query, [lookupValue]);

        return {
          success: true,
          metadata: {
            operation: 'delete',
            duration: monotime() - startTime,
            backend: 'postgresql',
            timestamp: new Date()
          }
        };
      } finally {
        client.release();
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
        metadata: {
          operation: 'delete',
          duration: 0,
          backend: 'postgresql',
          timestamp: new Date()
        }
      };
    }
  }

  async query<T = any>(
    querySpec: DatabaseQuery
  ): Promise<DatabaseResult<DatabaseDocument<T>[]>> {
    try {
      const startTime = monotime();

      if (!this.pool) {
        throw new Error('Database not connected');
      }

      const client = await this.pool.connect();

      try {
        const { sql, params } = this.buildQuery(querySpec);
        const result = await client.query(sql, params);

        const documents = result.rows.map(row => {
          const convertedData = this.convertRowToDocument<T>(row);
          return {
            id: row.id,
            data: convertedData,
            metadata: {
              createdAt: row.created_at,
              updatedAt: row.updated_at,
              version: row.version || 1
            }
          };
        });

        return {
          success: true,
          data: documents,
          metadata: {
            operation: 'query',
            duration: monotime() - startTime,
            backend: 'postgresql',
            timestamp: new Date()
          }
        };
      } finally {
        client.release();
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
        metadata: {
          operation: 'query',
          duration: 0,
          backend: 'postgresql',
          timestamp: new Date()
        }
      };
    }
  }

  async count(
    collection: string,
    filters: DatabaseFilter[] = []
  ): Promise<DatabaseResult<number>> {
    try {
      const startTime = monotime();

      if (!this.pool) {
        throw new Error('Database not connected');
      }

      const client = await this.pool.connect();

      try {
        const whereClause = this.buildWhereClause(filters, collection);
        const query = `SELECT COUNT(*) as count FROM ${collection}${whereClause.sql}`;

        const result = await client.query(query, whereClause.params);
        const count = parseInt(result.rows[0].count);

        return {
          success: true,
          data: count,
          metadata: {
            operation: 'count',
            duration: monotime() - startTime,
            backend: 'postgresql',
            timestamp: new Date()
          }
        };
      } finally {
        client.release();
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
        metadata: {
          operation: 'count',
          duration: 0,
          backend: 'postgresql',
          timestamp: new Date()
        }
      };
    }
  }

  async readAll<T = any>(
    collection: string,
    options: { limit?: number; offset?: number; orderBy?: DatabaseOrderBy } = {}
  ): Promise<DatabaseResult<DatabaseDocument<T>[]>> {
    try {
      const startTime = monotime();

      if (!this.pool) {
        throw new Error('Database not connected');
      }

      const client = await this.pool.connect();

      try {
        let query = `SELECT * FROM ${collection}`;
        const params: any[] = [];
        let paramIndex = 1;

        // Add ORDER BY if specified
        if (options.orderBy) {
          const orderFieldRef = this.getFieldReference(collection, options.orderBy.field);
          query += ` ORDER BY ${orderFieldRef} ${options.orderBy.direction}`;
        } else {
          // Default ordering by created_at
          query += ` ORDER BY created_at DESC`;
        }

        // Add LIMIT and OFFSET
        if (options.limit) {
          query += ` LIMIT $${paramIndex++}`;
          params.push(options.limit);
        }

        if (options.offset) {
          query += ` OFFSET $${paramIndex++}`;
          params.push(options.offset);
        }

        const result = await client.query(query, params);
        const documents: DatabaseDocument<T>[] = [];

        for (const row of result.rows) {
          const convertedData = this.convertRowToDocument<T>(row);
          documents.push({
            id: row.id,
            data: convertedData,
            metadata: {
              createdAt: row.created_at,
              updatedAt: row.updated_at,
              version: row.version || 1
            }
          });
        }

        return {
          success: true,
          data: documents,
          metadata: {
            operation: 'readAll',
            duration: monotime() - startTime,
            backend: 'postgresql',
            timestamp: new Date()
          }
        };
      } finally {
        client.release();
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
        metadata: {
          operation: 'readAll',
          duration: 0,
          backend: 'postgresql',
          timestamp: new Date()
        }
      };
    }
  }

  async findByField<T = any>(
    collection: string,
    field: string,
    value: any,
    options: { limit?: number; orderBy?: DatabaseOrderBy } = {}
  ): Promise<DatabaseResult<DatabaseDocument<T>[]>> {
    try {
      const startTime = monotime();

      if (!this.pool) {
        throw new Error('Database not connected');
      }

      const client = await this.pool.connect();

      try {
        const fieldRef = this.getFieldReference(collection, field);
        let query = `SELECT * FROM ${collection} WHERE ${fieldRef} = $1`;
        const params: any[] = [value];
        let paramIndex = 2;

        // Add ORDER BY if specified
        if (options.orderBy) {
          const orderFieldRef = this.getFieldReference(collection, options.orderBy.field);
          query += ` ORDER BY ${orderFieldRef} ${options.orderBy.direction}`;
        } else {
          // Default ordering by created_at
          query += ` ORDER BY created_at DESC`;
        }

        // Add LIMIT
        if (options.limit) {
          query += ` LIMIT $${paramIndex++}`;
          params.push(options.limit);
        }

        const result = await client.query(query, params);
        const documents: DatabaseDocument<T>[] = [];

        for (const row of result.rows) {
          const convertedData = this.convertRowToDocument<T>(row);
          documents.push({
            id: row.id,
            data: convertedData,
            metadata: {
              createdAt: row.created_at,
              updatedAt: row.updated_at,
              version: row.version || 1
            }
          });
        }

        return {
          success: true,
          data: documents,
          metadata: {
            operation: 'findByField',
            duration: monotime() - startTime,
            backend: 'postgresql',
            timestamp: new Date()
          }
        };
      } finally {
        client.release();
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
        metadata: {
          operation: 'findByField',
          duration: 0,
          backend: 'postgresql',
          timestamp: new Date()
        }
      };
    }
  }

  async exists(
    collection: string,
    id: string
  ): Promise<DatabaseResult<boolean>> {
    try {
      const startTime = monotime();

      if (!this.pool) {
        throw new Error('Database not connected');
      }

      const client = await this.pool.connect();

      try {
        // For users table, the id field contains the firebase_uid
        // For other collections, use id field as normal
        const lookupField = 'id';
        const lookupValue = id;

        const query = `SELECT 1 FROM ${collection} WHERE ${lookupField} = $1 LIMIT 1`;
        const result = await client.query(query, [lookupValue]);
        const exists = result.rows.length > 0;

        return {
          success: true,
          data: exists,
          metadata: {
            operation: 'exists',
            duration: monotime() - startTime,
            backend: 'postgresql',
            timestamp: new Date()
          }
        };
      } finally {
        client.release();
      }
    } catch (error) {
      return {
        success: false,
        data: false,
        error: error instanceof Error ? error : new Error(String(error)),
        metadata: {
          operation: 'exists',
          duration: 0,
          backend: 'postgresql',
          timestamp: new Date()
        }
      };
    }
  }

  // Batch operations implementation would go here...
  async batchCreate<T = any>(
    collection: string,
    documents: Array<{ id?: string; data: T }>
  ): Promise<DatabaseResult<DatabaseDocument<T>[]>> {
    // Implementation for batch create
    return {
      success: false,
      error: new Error('Batch create not implemented yet'),
      metadata: {
        operation: 'batchCreate',
        duration: 0,
        backend: 'postgresql',
        timestamp: new Date()
      }
    };
  }

  async batchUpdate<T = any>(
    collection: string,
    updates: Array<{ id: string; data: Partial<T> }>
  ): Promise<DatabaseResult<DatabaseDocument<T>[]>> {
    // Implementation for batch update
    return {
      success: false,
      error: new Error('Batch update not implemented yet'),
      metadata: {
        operation: 'batchUpdate',
        duration: 0,
        backend: 'postgresql',
        timestamp: new Date()
      }
    };
  }

  async batchDelete(
    collection: string,
    ids: string[]
  ): Promise<DatabaseResult<void>> {
    // Implementation for batch delete
    return {
      success: false,
      error: new Error('Batch delete not implemented yet'),
      metadata: {
        operation: 'batchDelete',
        duration: 0,
        backend: 'postgresql',
        timestamp: new Date()
      }
    };
  }

  async runTransaction<T>(
    operation: (transaction: IDatabaseTransaction) => Promise<T>
  ): Promise<DatabaseResult<T>> {
    try {
      const startTime = monotime();

      if (!this.pool) {
        throw new Error('Database not connected');
      }

      const client = await this.pool.connect();

      try {
        await client.query('BEGIN');
        const transaction = new PostgreSQLTransaction(client);
        const result = await operation(transaction);
        await client.query('COMMIT');

        return {
          success: true,
          data: result,
          metadata: {
            operation: 'transaction',
            duration: monotime() - startTime,
            backend: 'postgresql',
            timestamp: new Date()
          }
        };
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
        metadata: {
          operation: 'transaction',
          duration: 0,
          backend: 'postgresql',
          timestamp: new Date()
        }
      };
    }
  }

  // Real-time subscriptions not implemented for PostgreSQL yet
  async subscribe<T = any>(
    collection: string,
    filters: DatabaseFilter[],
    callback: (documents: DatabaseDocument<T>[]) => void
  ): Promise<DatabaseResult<{ unsubscribe: () => void }>> {
    return {
      success: false,
      error: new Error('Real-time subscriptions not implemented for PostgreSQL yet'),
      metadata: {
        operation: 'subscribe',
        duration: 0,
        backend: 'postgresql',
        timestamp: new Date()
      }
    };
  }

  async createCollection(
    collection: string,
    schema?: DatabaseSchema
  ): Promise<DatabaseResult<void>> {
    // Implementation for dynamic collection creation
    return {
      success: false,
      error: new Error('Dynamic collection creation not implemented yet'),
      metadata: {
        operation: 'createCollection',
        duration: 0,
        backend: 'postgresql',
        timestamp: new Date()
      }
    };
  }

  async migrateData(
    fromCollection: string,
    toCollection: string,
    transform?: (doc: DatabaseDocument) => DatabaseDocument
  ): Promise<DatabaseResult<{ migrated: number; errors: Error[] }>> {
    // Implementation for data migration
    return {
      success: false,
      error: new Error('Data migration not implemented yet'),
      metadata: {
        operation: 'migrateData',
        duration: 0,
        backend: 'postgresql',
        timestamp: new Date()
      }
    };
  }

  // Private helper methods
  private generateId(): string {
    return require('crypto').randomUUID();
  }

  private isTopLevelField(collection: string, field: string): boolean {
    const mapping = this.fieldMappings[collection];
    return mapping ? mapping.has(field) : false;
  }

  private getFieldReference(collection: string, field: string): string {
    if (this.isTopLevelField(collection, field)) {
      // Convert camelCase to snake_case for actual SQL column reference
      return field.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
    } else {
      return `data->>'${field}'`;
    }
  }

  private convertRowToDocument<T>(row: any): T {
    // For JSONB-based schema, parse the data column and convert snake_case columns to camelCase
    const converted: any = {};
    for (const [key, value] of Object.entries(row)) {
      if (key === 'data') {
        // Parse JSONB data - could be string or already parsed object
        let parsedData;
        if (typeof value === 'string') {
          parsedData = JSON.parse(value);
        } else if (typeof value === 'object' && value !== null) {
          parsedData = value;
        } else {
          parsedData = {};
        }
        Object.assign(converted, parsedData);
      } else if (key === 'id') {
        converted.id = value;
      } else {
        // Convert snake_case to camelCase for other columns
        const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
        converted[camelKey] = value;
      }
    }
    return converted as T;
  }

  private buildQuery(querySpec: DatabaseQuery): { sql: string; params: any[] } {
    const { collection, filters = [], orderBy = [], pagination } = querySpec;

    let sql = `SELECT * FROM ${collection}`;
    const params: any[] = [];

    // WHERE clause
    if (filters.length > 0) {
      const whereClause = this.buildWhereClause(filters, collection);
      sql += whereClause.sql;
      params.push(...whereClause.params);
    }

    // ORDER BY clause
    if (orderBy.length > 0) {
      const orderClause = orderBy
        .map(order => {
          const fieldRef = this.getFieldReference(collection, order.field);
          return `${fieldRef} ${order.direction.toUpperCase()}`;
        })
        .join(', ');
      sql += ` ORDER BY ${orderClause}`;
    }

    // LIMIT and OFFSET
    if (pagination?.limit) {
      sql += ` LIMIT $${params.length + 1}`;
      params.push(pagination.limit);
    }

    if (pagination?.offset) {
      sql += ` OFFSET $${params.length + 1}`;
      params.push(pagination.offset);
    }

    return { sql, params };
  }

  private buildWhereClause(filters: DatabaseFilter[], collection: string): { sql: string; params: any[] } {
    if (filters.length === 0) {
      return { sql: '', params: [] };
    }

    const conditions: string[] = [];
    const params: any[] = [];

    for (const filter of filters) {
      const paramIndex = params.length + 1;
      const { field, operator, value } = filter;
      const fieldRef = this.getFieldReference(collection, field);

      // Convert Firebase operators to SQL
      switch (operator) {
        case '==':
          conditions.push(`${fieldRef} = $${paramIndex}`);
          params.push(value);
          break;
        case '!=':
          conditions.push(`${fieldRef} != $${paramIndex}`);
          params.push(value);
          break;
        case '<':
          conditions.push(`${fieldRef} < $${paramIndex}`);
          params.push(value);
          break;
        case '<=':
          conditions.push(`${fieldRef} <= $${paramIndex}`);
          params.push(value);
          break;
        case '>':
          conditions.push(`${fieldRef} > $${paramIndex}`);
          params.push(value);
          break;
        case '>=':
          conditions.push(`${fieldRef} >= $${paramIndex}`);
          params.push(value);
          break;
        case 'in':
          conditions.push(`${fieldRef} = ANY($${paramIndex})`);
          params.push(value);
          break;
        case 'array-contains':
          conditions.push(`$${paramIndex} = ANY(${fieldRef})`);
          params.push(value);
          break;
        case 'array-contains-any':
          conditions.push(`${fieldRef} && $${paramIndex}`);
          params.push(value);
          break;
        default:
          throw new Error(`Unsupported operator: ${operator}`);
      }
    }

    return {
      sql: ` WHERE ${conditions.join(' AND ')}`,
      params
    };
  }
}

/**
 * PostgreSQL Transaction Implementation
 */
class PostgreSQLTransaction implements IDatabaseTransaction {
  constructor(private client: PoolClient) {}

  async create<T = any>(
    collection: string,
    data: T,
    options: { id?: string } = {}
  ): Promise<DatabaseDocument<T>> {
    const id = options.id || require('crypto').randomUUID();
    const now = new Date();

    const documentData = {
      ...data,
      id,
      created_at: now,
      updated_at: now,
      version: 1
    };

    const columns = Object.keys(documentData);
    const values = Object.values(documentData);
    const placeholders = columns.map((_, i) => `$${i + 1}`);

    const query = `
      INSERT INTO ${collection} (${columns.join(', ')})
      VALUES (${placeholders.join(', ')})
      RETURNING *
    `;

    const result = await this.client.query(query, values);
    const row = result.rows[0];

    return {
      id: row.id,
      data: row as T,
      metadata: {
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        version: row.version || 1
      }
    };
  }

  async read<T = any>(
    collection: string,
    id: string
  ): Promise<DatabaseDocument<T> | null> {
    const query = `SELECT * FROM ${collection} WHERE id = $1`;
    const result = await this.client.query(query, [id]);

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      data: row as T,
      metadata: {
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        version: row.version || 1
      }
    };
  }

  async update<T = any>(
    collection: string,
    id: string,
    data: Partial<T>
  ): Promise<DatabaseDocument<T>> {
    const now = new Date();
    const updateData = {
      ...data,
      updated_at: now,
      version: { __increment: 1 }
    };

    const columns = Object.keys(updateData);
    const values = Object.values(updateData);
    const setClause = columns.map((col, i) => {
      if (col === 'version' && updateData[col]?.__increment) {
        return `version = version + 1`;
      }
      return `${col} = $${i + 1}`;
    }).join(', ');

      const filteredValues = values.filter((val, i) => {
        const col = columns[i];
        return !(col === 'version' && typeof val === 'object' && val && '__increment' in val);
      });

    const query = `
      UPDATE ${collection}
      SET ${setClause}
      WHERE id = $${filteredValues.length + 1}
      RETURNING *
    `;

    const result = await this.client.query(query, [...filteredValues, id]);

    if (result.rows.length === 0) {
      throw new Error('Document not found');
    }

    const row = result.rows[0];
    return {
      id: row.id,
      data: row as T,
      metadata: {
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        version: row.version || 1
      }
    };
  }

  async delete(collection: string, id: string): Promise<void> {
    const query = `DELETE FROM ${collection} WHERE id = $1`;
    await this.client.query(query, [id]);
  }

  async commit(): Promise<void> {
    await this.client.query('COMMIT');
  }

  async rollback(): Promise<void> {
    await this.client.query('ROLLBACK');
  }
}
