/**
 * PostgreSQL Adapter for Database Abstraction Layer
 *
 * Implements IDatabaseService for PostgreSQL with Firebase-compatible operations
 */

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

  constructor(config: DatabaseBackendConfig) {
    this.config = config;
  }

  async connect(): Promise<DatabaseResult<void>> {
    try {
      const startTime = Date.now();

      this.pool = new Pool({
        host: this.config.connection.host || 'localhost',
        port: this.config.connection.port || 5432,
        database: this.config.connection.database || 'ring_platform',
        user: this.config.connection.username || 'ring_user',
        password: this.config.connection.password || 'ring_password_2024',
        max: this.config.options.poolSize || 20,
        idleTimeoutMillis: this.config.options.timeout || 30000,
        connectionTimeoutMillis: this.config.options.timeout || 2000,
      });

      // Test connection
      const client = await this.pool.connect();
      await client.query('SELECT 1');
      client.release();

      return {
        success: true,
        metadata: {
          operation: 'connect',
          duration: Date.now() - startTime,
          backend: 'postgresql',
          timestamp: new Date()
        }
      };
    } catch (error) {
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
      const startTime = Date.now();

      if (this.pool) {
        await this.pool.end();
        this.pool = null;
      }

      return {
        success: true,
        metadata: {
          operation: 'disconnect',
          duration: Date.now() - startTime,
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
          duration: Date.now() - Date.now(),
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
      const startTime = Date.now();

      if (!this.pool) {
        throw new Error('Database not connected');
      }

      const client = await this.pool.connect();

      try {
        const id = options.id || this.generateId();
        const now = new Date();

        // Prepare data with metadata
        const documentData = {
          ...data,
          id,
          created_at: now,
          updated_at: now,
          version: 1
        };

        // Build insert query
        const columns = Object.keys(documentData);
        const values = Object.values(documentData);
        const placeholders = columns.map((_, i) => `$${i + 1}`);

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
            duration: Date.now() - startTime,
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
      const startTime = Date.now();

      if (!this.pool) {
        throw new Error('Database not connected');
      }

      const client = await this.pool.connect();

      try {
        const query = `SELECT * FROM ${collection} WHERE id = $1`;
        const result = await client.query(query, [id]);

        if (result.rows.length === 0) {
          return {
            success: true,
            data: null,
            metadata: {
              operation: 'read',
              duration: Date.now() - startTime,
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
            duration: Date.now() - startTime,
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
      const startTime = Date.now();

      if (!this.pool) {
        throw new Error('Database not connected');
      }

      const client = await this.pool.connect();

      try {
        const now = new Date();
        const updateData = {
          ...data,
          updated_at: now,
          version: { __increment: 1 } // Special marker for increment
        };

        // Build update query
        const columns = Object.keys(updateData);
        const values = Object.values(updateData);
        const setClause = columns.map((col, i) => {
          if (col === 'version' && updateData[col]?.__increment) {
            return `version = version + 1`;
          }
          return `${col} = $${i + 1}`;
        }).join(', ');

        // Filter out the special increment marker
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

        const result = await client.query(query, [...filteredValues, id]);

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
            duration: Date.now() - startTime,
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
      const startTime = Date.now();

      if (!this.pool) {
        throw new Error('Database not connected');
      }

      const client = await this.pool.connect();

      try {
        const query = `DELETE FROM ${collection} WHERE id = $1`;
        await client.query(query, [id]);

        return {
          success: true,
          metadata: {
            operation: 'delete',
            duration: Date.now() - startTime,
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
      const startTime = Date.now();

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
            duration: Date.now() - startTime,
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
      const startTime = Date.now();

      if (!this.pool) {
        throw new Error('Database not connected');
      }

      const client = await this.pool.connect();

      try {
        const whereClause = this.buildWhereClause(filters);
        const query = `SELECT COUNT(*) as count FROM ${collection}${whereClause.sql}`;

        const result = await client.query(query, whereClause.params);
        const count = parseInt(result.rows[0].count);

        return {
          success: true,
          data: count,
          metadata: {
            operation: 'count',
            duration: Date.now() - startTime,
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
      const startTime = Date.now();

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
            duration: Date.now() - startTime,
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

  private convertRowToDocument<T>(row: any): T {
    // Convert snake_case database columns to camelCase
    const converted: any = {};
    for (const [key, value] of Object.entries(row)) {
      if (key === 'id') {
        converted.id = value;
      } else {
        // Convert snake_case to camelCase
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
      const whereClause = this.buildWhereClause(filters);
      sql += whereClause.sql;
      params.push(...whereClause.params);
    }

    // ORDER BY clause
    if (orderBy.length > 0) {
      const orderClause = orderBy
        .map(order => `${order.field} ${order.direction.toUpperCase()}`)
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

  private buildWhereClause(filters: DatabaseFilter[]): { sql: string; params: any[] } {
    if (filters.length === 0) {
      return { sql: '', params: [] };
    }

    const conditions: string[] = [];
    const params: any[] = [];

    for (const filter of filters) {
      const paramIndex = params.length + 1;
      const { field, operator, value } = filter;

      // Convert Firebase operators to SQL
      switch (operator) {
        case '==':
          conditions.push(`${field} = $${paramIndex}`);
          params.push(value);
          break;
        case '!=':
          conditions.push(`${field} != $${paramIndex}`);
          params.push(value);
          break;
        case '<':
          conditions.push(`${field} < $${paramIndex}`);
          params.push(value);
          break;
        case '<=':
          conditions.push(`${field} <= $${paramIndex}`);
          params.push(value);
          break;
        case '>':
          conditions.push(`${field} > $${paramIndex}`);
          params.push(value);
          break;
        case '>=':
          conditions.push(`${field} >= $${paramIndex}`);
          params.push(value);
          break;
        case 'in':
          conditions.push(`${field} = ANY($${paramIndex})`);
          params.push(value);
          break;
        case 'array-contains':
          conditions.push(`$${paramIndex} = ANY(${field})`);
          params.push(value);
          break;
        case 'array-contains-any':
          conditions.push(`${field} && $${paramIndex}`);
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
