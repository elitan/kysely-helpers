import { sql, type Expression, type RawBuilder } from 'kysely'

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
   * Array contains operation (@>)
   * Checks if array contains all elements of another array
   * 
   * @example
   * ```ts
   * .where(array('tags').contains('typescript'))
   * .where(array('tags').contains(['typescript', 'postgres']))
   * ```
   * 
   * Generates: `tags @> ARRAY['typescript']` or `tags @> ARRAY['typescript', 'postgres']`
   */
  contains(value: T | T[]): Expression<boolean>

  /**
   * Array contains element operation (@>)  
   * Alias for contains() with single element
   * 
   * @example
   * ```ts
   * .where(array('tags').includes('typescript'))
   * ```
   */
  includes(value: T): Expression<boolean>

  /**
   * Array overlaps operation (&&)
   * Checks if arrays have any elements in common
   * 
   * @example
   * ```ts
   * .where(array('tags').overlaps(['typescript', 'javascript']))
   * ```
   * 
   * Generates: `tags && ARRAY['typescript', 'javascript']`
   */
  overlaps(values: T[]): Expression<boolean>

  /**
   * Array contained by operation (<@)
   * Checks if array is contained by another array
   * 
   * @example
   * ```ts
   * .where(array('tags').containedBy(['typescript', 'javascript', 'python']))
   * ```
   * 
   * Generates: `tags <@ ARRAY['typescript', 'javascript', 'python']`
   */
  containedBy(values: T[]): Expression<boolean>

  /**
   * Array length function
   * 
   * @example
   * ```ts
   * .where(array('tags').length(), '>', 3)
   * ```
   * 
   * Generates: `array_length(tags, 1) > 3`
   */
  length(): RawBuilder<number>

  /**
   * Array element equals any (= ANY)
   * 
   * @example
   * ```ts
   * .where('status', '=', array('allowed_statuses').any())
   * ```
   * 
   * Generates: `status = ANY(allowed_statuses)`
   */
  any(): RawBuilder<T>

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
 * Create PostgreSQL array operations for a column
 * 
 * @param column Column name or expression
 * @returns Array operations builder
 * 
 * @example
 * ```ts
 * import { pg } from 'kysely-helpers'
 * 
 * const results = await db
 *   .selectFrom('products')
 *   .selectAll()
 *   .where(pg.array('tags').includes('featured'))
 *   .where(pg.array('categories').overlaps(['electronics', 'gadgets']))
 *   .execute()
 * ```
 */
export function array<T = string>(column: string): ArrayOperations<T> {
  const columnRef = sql.ref(column)

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
          return columnRef as RawBuilder<T[]>
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
          return columnRef as RawBuilder<T[]>
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

    contains: (value: T | T[]) => {
      const arrayValue = Array.isArray(value) ? value : [value]
      if (arrayValue.length === 0) {
        // Empty array - use text[] as default
        return sql<boolean>`${columnRef} @> ARRAY[]::text[]`
      }
      const arrayType = getArrayType(arrayValue)
      return sql<boolean>`${columnRef} @> ARRAY[${sql.join(arrayValue)}]::${sql.raw(arrayType)}`
    },

    includes: (value: T) => {
      const arrayType = getArrayType([value])
      return sql<boolean>`${columnRef} @> ARRAY[${value}]::${sql.raw(arrayType)}`
    },

    overlaps: (values: T[]) => {
      if (values.length === 0) {
        return sql<boolean>`${columnRef} && ARRAY[]::text[]`
      }
      const arrayType = getArrayType(values)
      return sql<boolean>`${columnRef} && ARRAY[${sql.join(values)}]::${sql.raw(arrayType)}`
    },

    containedBy: (values: T[]) => {
      if (values.length === 0) {
        return sql<boolean>`${columnRef} <@ ARRAY[]::text[]`
      }
      const arrayType = getArrayType(values)
      return sql<boolean>`${columnRef} <@ ARRAY[${sql.join(values)}]::${sql.raw(arrayType)}`
    },

    length: () => {
      return sql<number>`coalesce(array_length(${columnRef}, 1), 0)`
    },

    any: () => {
      return sql<T>`ANY(${columnRef})`
    },

    first: () => {
      return sql<T | null>`${columnRef}[1]`
    },

    last: () => {
      return sql<T | null>`${columnRef}[array_length(${columnRef}, 1)]`
    }
  }
}