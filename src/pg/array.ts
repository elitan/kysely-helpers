import { sql, type Expression, type RawBuilder, type SimpleReferenceExpression } from 'kysely'

/**
 * PostgreSQL array helper functions
 * 
 * Provides type-safe array operations using PostgreSQL's native array operators:
 * - @> (contains)
 * - && (overlaps) 
 * - <@ (contained by)
 * - = ANY (equals any)
 * - array_length, array_dims, etc.
 */

/**
 * Array update operations for use in UPDATE SET clauses
 */
export interface ArrayUpdateOperations<T> {
  /**
   * Append element(s) to the end of array
   * 
   * @example
   * ```ts
   * .set({ tags: pg.array('tags').append('new-tag') })
   * .set({ tags: pg.array('tags').append(['tag1', 'tag2']) })
   * ```
   * 
   * Generates: `array_append(tags, 'new-tag')` or `tags || ARRAY['tag1', 'tag2']`
   */
  append(value: T | T[]): RawBuilder<T[]>

  /**
   * Prepend element(s) to the beginning of array
   * 
   * @example
   * ```ts
   * .set({ priorities: pg.array('priorities').prepend('urgent') })
   * .set({ priorities: pg.array('priorities').prepend(['urgent', 'high']) })
   * ```
   * 
   * Generates: `array_prepend('urgent', priorities)` or `ARRAY['urgent', 'high'] || priorities`
   */
  prepend(value: T | T[]): RawBuilder<T[]>

  /**
   * Remove all occurrences of a value from array
   * 
   * @example
   * ```ts
   * .set({ tags: pg.array('tags').remove('deprecated') })
   * ```
   * 
   * Generates: `array_remove(tags, 'deprecated')`
   */
  remove(value: T): RawBuilder<T[]>

  /**
   * Remove first element from array
   * 
   * @example
   * ```ts
   * .set({ queue: pg.array('queue').removeFirst() })
   * ```
   * 
   * Generates: `tags[2:array_length(tags, 1)]`
   */
  removeFirst(): RawBuilder<T[]>

  /**
   * Remove last element from array
   * 
   * @example
   * ```ts
   * .set({ stack: pg.array('stack').removeLast() })
   * ```
   * 
   * Generates: `tags[1:array_length(tags, 1)-1]`
   */
  removeLast(): RawBuilder<T[]>
}

/**
 * PostgreSQL array operations builder
 */
export interface ArrayOperations<T> extends ArrayUpdateOperations<T> {
  /**
   * Check if array contains ALL of the provided values
   * 
   * @example
   * ```ts
   * .where(array('tags').hasAllOf(['typescript', 'postgres']))
   * .where(array('permissions').hasAllOf(['read', 'write']))
   * ```
   * 
   * Generates: `tags @> ARRAY['typescript', 'postgres']`
   */
  hasAllOf(values: T[]): Expression<boolean>

  /**
   * Check if array contains ANY of the provided values (intersection)
   * 
   * @example
   * ```ts
   * .where(array('userRoles').hasAnyOf(['admin', 'moderator']))
   * .where(array('categories').hasAnyOf(['tech', 'ai']))
   * ```
   * 
   * Generates: `userRoles && ARRAY['admin', 'moderator']`
   */
  hasAnyOf(values: T[]): Expression<boolean>

  /**
   * Array length function
   * 
   * @example
   * ```ts
   * .where(array('tags').length(), '>', 3)
   * ```
   * 
   * Generates: `coalesce(array_length(tags, 1), 0) > 3`
   */
  length(): RawBuilder<number>

  /**
   * Get first element of array
   * 
   * @example
   * ```ts
   * .select(pg.array('queue').first().as('next_task'))
   * ```
   * 
   * Generates: `queue[1]`
   */
  first(): RawBuilder<T | null>

  /**
   * Get last element of array
   * 
   * @example
   * ```ts
   * .select(pg.array('history').last().as('last_action'))
   * ```
   * 
   * Generates: `queue[array_length(queue, 1)]`
   */
  last(): RawBuilder<T | null>
}

/**
 * Internal: Create array operations from a column reference
 * Used by both simple API and type-safe pg(eb) pattern
 */
export function createArrayOperations<T = string>(columnRef: any): ArrayOperations<T> {

  // Helper function to determine PostgreSQL array type for casting
  const getArrayType = (values: T[]): string => {
    if (values.length === 0) return 'text[]'
    
    const firstValue = values[0]
    if (typeof firstValue === 'number') return 'integer[]'
    if (typeof firstValue === 'boolean') return 'boolean[]'
    return 'text[]'
  }

  return {
    // Update operations
    append: (value: T | T[]) => {
      if (Array.isArray(value)) {
        if (value.length === 0) {
          return sql<T[]>`${columnRef}`
        }
        const arrayType = getArrayType(value)
        return sql<T[]>`${columnRef} || ARRAY[${sql.join(value)}]::${sql.raw(arrayType)}`
      } else {
        const arrayType = getArrayType([value])
        return sql<T[]>`array_append(${columnRef}, ${value}::${sql.raw(arrayType.replace('[]', ''))})`
      }
    },

    prepend: (value: T | T[]) => {
      if (Array.isArray(value)) {
        if (value.length === 0) {
          return sql<T[]>`${columnRef}`
        }
        const arrayType = getArrayType(value)
        return sql<T[]>`ARRAY[${sql.join(value)}]::${sql.raw(arrayType)} || ${columnRef}`
      } else {
        const arrayType = getArrayType([value])
        return sql<T[]>`array_prepend(${value}::${sql.raw(arrayType.replace('[]', ''))}, ${columnRef})`
      }
    },

    remove: (value: T) => {
      return sql<T[]>`array_remove(${columnRef}, ${value})`
    },

    removeFirst: () => {
      return sql<T[]>`${columnRef}[2:array_length(${columnRef}, 1)]`
    },

    removeLast: () => {
      return sql<T[]>`${columnRef}[1:array_length(${columnRef}, 1)-1]`
    },

    hasAllOf: (values: T[]) => {
      if (values.length === 0) {
        // Empty array - use text[] as default
        return sql<boolean>`${columnRef} @> ARRAY[]::text[]`
      }
      const arrayType = getArrayType(values)
      return sql<boolean>`${columnRef} @> ARRAY[${sql.join(values)}]::${sql.raw(arrayType)}`
    },

    hasAnyOf: (values: T[]) => {
      if (values.length === 0) {
        return sql<boolean>`${columnRef} && ARRAY[]::text[]`
      }
      const arrayType = getArrayType(values)
      return sql<boolean>`${columnRef} && ARRAY[${sql.join(values)}]::${sql.raw(arrayType)}`
    },

    length: () => {
      return sql<number>`coalesce(array_length(${columnRef}, 1), 0)`
    },

    first: () => {
      return sql<T | null>`${columnRef}[1]`
    },

    last: () => {
      return sql<T | null>`${columnRef}[array_length(${columnRef}, 1)]`
    }
  }
}

/**
 * Create PostgreSQL array operations for a column (simple API)
 *
 * For quick prototyping and simple use cases. For type-safe column validation,
 * use the pg(eb).array() pattern instead.
 *
 * @param column Column name as string
 * @returns Array operations builder
 *
 * @example
 * ```ts
 * import { pg } from 'kysely-helpers'
 *
 * // Simple API - no type safety for column names
 * const results = await db
 *   .selectFrom('products')
 *   .where(pg.array('tags').hasAllOf(['featured']))
 *   .execute()
 * ```
 *
 * @see pg(eb).array() for type-safe column validation
 */
export function array<T = string>(column: string): ArrayOperations<T> {
  const columnRef = sql.ref(column)
  return createArrayOperations<T>(columnRef)
}