/**
 * PostgreSQL-specific utilities for Kysely
 *
 * Provides PostgreSQL-native operations with perfect TypeScript safety:
 * - Array operations (@>, &&, <@)
 * - JSONB operations (->, ->>, @>)
 * - Vector operations (pgvector distance functions)
 * - And much more!
 */

import type { ExpressionBuilder } from 'kysely'
import { array as arraySimple, createArrayOperations, type ArrayOperations } from './array'
import { json as jsonSimple, createJsonOperations, type JsonOperations } from './json'
import { vector as vectorSimple, createVectorOperations, type VectorOperations, embedding as embeddingFn } from './vector'

export * from './array'
export * from './json'
export * from './vector'

/**
 * Type-safe PostgreSQL helpers interface
 */
interface PgHelpers<DB, TB extends keyof DB> {
  array<CN extends string & keyof DB[TB]>(column: CN): ArrayOperations<any>
  json<CN extends string & keyof DB[TB]>(column: CN): JsonOperations
  vector<CN extends string & keyof DB[TB]>(column: CN): VectorOperations
}

/**
 * Create type-safe PostgreSQL helpers from expression builder
 *
 * @param eb Expression builder from Kysely query context
 * @returns Type-safe helper methods for PostgreSQL operations
 *
 * @example
 * ```ts
 * // Type-safe with autocomplete
 * await db
 *   .selectFrom('products')
 *   .where((eb) => pg(eb).array('tags').hasAllOf(['featured']))
 *   .execute()
 * ```
 */
export function pg<DB, TB extends keyof DB>(
  eb: ExpressionBuilder<DB, TB>
): PgHelpers<DB, TB> {
  return {
    array: <CN extends string & keyof DB[TB]>(column: CN) => {
      const ref = eb.ref(column)
      return createArrayOperations(ref)
    },
    json: <CN extends string & keyof DB[TB]>(column: CN) => {
      const ref = eb.ref(column)
      return createJsonOperations(ref)
    },
    vector: <CN extends string & keyof DB[TB]>(column: CN) => {
      const ref = eb.ref(column)
      return createVectorOperations(ref)
    }
  }
}

// Attach simple API functions to pg namespace for backward compatibility
// This allows: pg.array('tags') AND pg(eb).array('tags')
export namespace pg {
  export const array = arraySimple
  export const json = jsonSimple
  export const vector = vectorSimple
  export const embedding = embeddingFn
}
