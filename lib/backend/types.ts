export interface QueryFilters {
  where?: Array<{ field: string; op: '==' | '!=' | '>' | '>=' | '<' | '<=' | 'in' | 'array-contains' | 'array-contains-any'; value: any }>;
  orderBy?: Array<{ field: string; direction?: 'asc' | 'desc' }>;
  limit?: number;
  startAfterId?: string;
}

export interface BackendAdapter {
  create<T>(collection: string, data: T): Promise<{ id: string; data: T }>
  read<T>(collection: string, id: string): Promise<T | null>
  update<T>(collection: string, id: string, data: Partial<T>): Promise<void>
  delete(collection: string, id: string): Promise<void>
  query<T>(collection: string, filters: QueryFilters): Promise<Array<{ id: string; data: T }>>
}


