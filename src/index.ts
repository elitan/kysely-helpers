/**
 * kysely-helpers - Database helpers and utilities for Kysely query builder
 *
 * Provides database-specific operations with perfect TypeScript safety.
 * Currently focused on PostgreSQL with plans to expand to other databases.
 */

// Export pg as both function and namespace
export { pg } from './pg'
export * from './types'