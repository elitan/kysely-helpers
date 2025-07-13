/**
 * PostgreSQL-specific utilities for Kysely
 * 
 * Provides PostgreSQL-native operations with perfect TypeScript safety:
 * - Array operations (@>, &&, <@)
 * - JSONB operations (->, ->>, @>)  
 * - Vector operations (pgvector distance functions)
 * - Full-text search (@@, to_tsquery)
 * - And much more!
 */

export * from './array'
export * from './json'
export * from './vector'
export * from './text'