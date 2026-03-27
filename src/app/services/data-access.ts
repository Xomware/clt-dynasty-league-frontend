import { Observable } from 'rxjs'

/**
 * Abstract data access interface for Supabase table queries.
 * Services that query Supabase tables should implement this pattern
 * so they can later swap from direct Supabase client to API calls
 * without changing component code.
 */
export interface DataAccess<T> {
  getAll(filters?: Record<string, unknown>): Observable<T[]>
  getById(id: string): Observable<T | null>
  create(item: Partial<T>): Observable<boolean>
  update(id: string, item: Partial<T>): Observable<boolean>
  delete(id: string): Observable<boolean>
}

/**
 * Query options for data access methods.
 */
export interface QueryOptions {
  orderBy?: string
  ascending?: boolean
  limit?: number
  offset?: number
  filters?: Record<string, unknown>
}
