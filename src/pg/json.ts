import { sql, type Expression, type RawBuilder } from 'kysely'
import type { JsonValue } from '../types/index.js'

/**
 * PostgreSQL JSONB helper functions
 * 
 * Provides type-safe JSONB operations using PostgreSQL's native JSON operators:
 * - -> (get JSON object field)
 * - ->> (get JSON object field as text)
 * - #> (get JSON object at path)
 * - #>> (get JSON object at path as text)
 * - @> (contains)
 * - <@ (contained by)
 * - ? (key exists)
 * - ?& (all keys exist)
 * - ?| (any key exists)
 */

/**
 * JSON path operations builder  
 * Extends RawBuilder so it can be used in SELECT clauses
 */
export interface JsonPathOperations<T = JsonValue> extends RawBuilder<T | null> {
  /**
   * JSON contains operation (@>)
   * Uses #> operator for JSON comparison
   * 
   * @example
   * ```ts
   * .where(pg.json('preferences').path('notifications').contains({email: true}))
   * ```
   */
  contains(value: any): Expression<boolean>

  /**
   * Equals comparison with smart JSON vs text detection
   * Uses #>> for primitives, #> for objects/arrays
   * 
   * @example
   * ```ts
   * .where(pg.json('preferences').path('theme').equals('dark'))
   * .where(pg.json('config').path('user').equals({name: 'john'}))
   * ```
   */
  equals(value: any): Expression<boolean>

  /**
   * Greater than comparison
   * Uses #>> operator for text comparison
   * 
   * @example
   * ```ts
   * .where(pg.json('profile').path('age').greaterThan(18))
   * ```
   */
  greaterThan(value: any): Expression<boolean>

  /**
   * Less than comparison
   * Uses #>> operator for text comparison
   * 
   * @example
   * ```ts
   * .where(pg.json('profile').path('score').lessThan(100))
   * ```
   */
  lessThan(value: any): Expression<boolean>

  /**
   * Path existence check
   * Uses #> with IS NOT NULL
   * 
   * @example
   * ```ts
   * .where(pg.json('account').path('premium').exists())
   * ```
   */
  exists(): Expression<boolean>

  /**
   * Force text mode for this operation
   * Returns text operations that always use #>> operator
   * Can be used in SELECT clauses with .as()
   * 
   * @example
   * ```ts
   * .where(pg.json('game').path('score').asText().equals('100'))
   * .select([pg.json('preferences').path('theme').asText().as('theme')])
   * ```
   */
  asText(): RawBuilder<string> & TextPathOperations
}

/**
 * Text path operations (always uses #>> operator)
 */
export interface TextPathOperations {
  /**
   * Equals comparison in text mode
   * Always uses #>> operator
   */
  equals(value: string): Expression<boolean>

  /**
   * Greater than comparison in text mode
   */
  greaterThan(value: string): Expression<boolean>

  /**
   * Less than comparison in text mode
   */
  lessThan(value: string): Expression<boolean>
}

/**
 * JSON update operations for use in UPDATE SET clauses
 */
export interface JsonUpdateOperations {
  /**
   * Set a value at a JSON path using jsonb_set()
   * 
   * @example
   * ```ts
   * .set({ metadata: pg.json('metadata').set('theme', 'dark') })
   * .set({ metadata: pg.json('metadata').set(['user', 'lang'], 'es') })
   * ```
   * 
   * Generates: `jsonb_set(metadata, '{path}', '"value"')`
   */
  set(path: string | string[], value: any): RawBuilder<any>

  /**
   * Increment a numeric value at a JSON path
   * Use positive numbers to increment, negative to decrement
   * 
   * @example
   * ```ts
   * .set({ stats: pg.json('stats').increment('points', 10) })
   * .set({ lives: pg.json('lives').increment('remaining', -1) })
   * ```
   * 
   * Generates: `jsonb_set(metadata, '{path}', ((metadata#>>'{path}')::numeric + value)::text::jsonb)`
   */
  increment(path: string | string[], value: number): RawBuilder<any>

  /**
   * Remove a key or path from JSON using the - operator
   * 
   * @example
   * ```ts
   * .set({ metadata: pg.json('metadata').remove('temp_flag') })
   * .set({ metadata: pg.json('metadata').remove(['cache', 'expired']) })
   * ```
   * 
   * Generates: `metadata - 'key'` or `metadata #- '{path}'`
   */
  remove(path: string | string[]): RawBuilder<any>

  /**
   * Append a value to a JSON array using the || operator
   * 
   * @example
   * ```ts
   * .set({ tags: pg.json('tags').push('new-tag') })
   * ```
   * 
   * Generates: `tags || '"new-tag"'::jsonb`
   */
  push(value: any): RawBuilder<any>
}

/**
 * JSON operations builder
 */
export interface JsonOperations extends JsonUpdateOperations {
  /**
   * Navigate to a JSON path with smart detection
   * Accepts both string and array paths
   * 
   * @example
   * ```ts
   * // String path with automatic JsonValue typing
   * .where(pg.json('preferences').path('theme').equals('dark'))
   * .select([pg.json('preferences').path('theme').as('theme')]) // Type: JsonValue | null
   * 
   * // Array path for nested access
   * .where(pg.json('config').path(['user', 'settings', 'language']).equals('en'))
   * 
   * // Explicit typing for better type safety
   * .select([pg.json('profile').path<number>('age').as('age')]) // Type: number | null
   * .select([pg.json('profile').path<string>('name').as('name')]) // Type: string | null
   * ```
   */
  path<T = JsonValue>(path: string | string[]): JsonPathOperations<T>

  /**
   * JSON contains operation (@>)
   * 
   * @example
   * ```ts
   * .where(pg.json('metadata').contains({theme: 'dark'}))
   * ```
   * 
   * Generates: `metadata @> '{"theme":"dark"}'`
   */
  contains(value: any): Expression<boolean>

  /**
   * JSON key exists (?)
   * 
   * @example
   * ```ts
   * .where(pg.json('metadata').hasKey('theme'))
   * ```
   * 
   * Generates: `metadata ? 'theme'`
   */
  hasKey(key: string): Expression<boolean>

  /**
   * All JSON keys exist (?&)
   * 
   * @example
   * ```ts
   * .where(pg.json('metadata').hasAllKeys(['theme', 'language']))
   * ```
   * 
   * Generates: `metadata ?& array['theme','language']`
   */
  hasAllKeys(keys: string[]): Expression<boolean>

  /**
   * Any JSON key exists (?|)
   * 
   * @example
   * ```ts
   * .where(pg.json('metadata').hasAnyKey(['theme', 'style']))
   * ```
   * 
   * Generates: `metadata ?| array['theme','style']`
   */
  hasAnyKey(keys: string[]): Expression<boolean>
}

/**
 * Create PostgreSQL JSON operations for a column
 * 
 * @param column Column name or expression
 * @returns JSON operations builder
 * 
 * @example
 * ```ts
 * import { pg } from 'kysely-helpers'
 * 
 * const results = await db
 *   .selectFrom('users')
 *   .selectAll()
 *   .where(pg.json('preferences').get('theme').equals('dark'))
 *   .where(pg.json('metadata').contains({verified: true}))
 *   .execute()
 * ```
 */
/**
 * Helper function to determine if a value should use JSON mode (#>) or text mode (#>>)
 */
function isComplexValue(value: any): boolean {
  return value !== null && 
         (typeof value === 'object' || Array.isArray(value))
}

/**
 * Helper function to serialize value for JSON operations
 */
function serializeJsonValue(value: any): string {
  return JSON.stringify(value).replace(/'/g, "''")
}

/**
 * Helper function to serialize value for text operations
 */
function serializeTextValue(value: any): string {
  if (value === null) return 'null'
  if (typeof value === 'boolean') return value.toString()
  if (typeof value === 'number') return value.toString()
  if (typeof value === 'object') return JSON.stringify(value)
  return value.toString()
}

export function json(column: string): JsonOperations {
  const columnRef = sql.ref(column)

  return {
    // Update operations
    set: (path: string | string[], value: any) => {
      const pathArray = Array.isArray(path) ? path : [path]
      const pathString = `'{${pathArray.join(',')}}'`
      const serializedValue = serializeJsonValue(value)
      return sql`jsonb_set(${columnRef}, ${sql.raw(pathString)}, ${sql.raw(`'${serializedValue}'`)})`
    },

    increment: (path: string | string[], value: number) => {
      const pathArray = Array.isArray(path) ? path : [path]
      const pathString = `'{${pathArray.join(',')}}'`
      return sql`jsonb_set(${columnRef}, ${sql.raw(pathString)}, ((${columnRef}#>>${sql.raw(pathString)})::numeric + ${value})::text::jsonb)`
    },

    remove: (path: string | string[]) => {
      if (Array.isArray(path)) {
        if (path.length === 1) {
          // Single key removal: metadata - 'key'
          return sql`${columnRef} - ${path[0]}`
        } else {
          // Deep path removal: metadata #- '{path,to,key}'
          const pathString = `'{${path.join(',')}}'`
          return sql`${columnRef} #- ${sql.raw(pathString)}`
        }
      } else {
        // Single key removal: metadata - 'key'
        return sql`${columnRef} - ${path}`
      }
    },

    push: (value: any) => {
      const serializedValue = serializeJsonValue(value)
      return sql`${columnRef} || ${sql.raw(`'${serializedValue}'`)}::jsonb`
    },
    path: <T = JsonValue>(path: string | string[]) => {
      const pathArray = Array.isArray(path) ? path : [path]
      const pathString = `'{${pathArray.join(',')}}'`
      const jsonPathRef = sql`${columnRef}#>${sql.raw(pathString)}`
      const textPathRef = sql`${columnRef}#>>${sql.raw(pathString)}`
      
      const operations = {
        contains: (value: any) => {
          return sql<boolean>`${jsonPathRef} @> ${serializeJsonValue(value)}`
        },

        equals: (value: any) => {
          if (isComplexValue(value)) {
            // Use JSON mode for objects and arrays
            return sql<boolean>`${jsonPathRef} = ${serializeJsonValue(value)}`
          } else if (typeof value === 'number') {
            // Use JSON mode for numbers to preserve numeric type
            return sql<boolean>`${jsonPathRef} = ${value}`
          } else {
            // Use text mode for strings, booleans, null
            return sql<boolean>`${textPathRef} = ${serializeTextValue(value)}`
          }
        },

        greaterThan: (value: any) => {
          if (typeof value === 'number') {
            // Use JSON mode for numeric comparisons
            return sql<boolean>`${jsonPathRef} > ${value}`
          } else {
            // Use text mode for string comparisons
            return sql<boolean>`${textPathRef} > ${value}`
          }
        },

        lessThan: (value: any) => {
          if (typeof value === 'number') {
            // Use JSON mode for numeric comparisons
            return sql<boolean>`${jsonPathRef} < ${value}`
          } else {
            // Use text mode for string comparisons
            return sql<boolean>`${textPathRef} < ${value}`
          }
        },

        exists: () => {
          return sql<boolean>`${jsonPathRef} IS NOT NULL`
        },

        asText: () => {
          const textOps = {
            equals: (value: string) => sql<boolean>`${textPathRef} = ${value}`,
            greaterThan: (value: string) => sql<boolean>`${textPathRef} > ${value}`,
            lessThan: (value: string) => sql<boolean>`${textPathRef} < ${value}`
          }
          // Return textPathRef with additional methods for when used in SELECT
          // Cast to RawBuilder<string> for proper typing
          const typedTextPathRef = textPathRef as RawBuilder<string>
          return Object.assign(typedTextPathRef, textOps)
        }
      }
      
      // Return jsonPathRef with additional methods for when used in SELECT
      // Cast to RawBuilder<T | null> for proper typing
      const typedJsonPathRef = jsonPathRef as RawBuilder<T | null>
      return Object.assign(typedJsonPathRef, operations)
    },

    contains: (value: any) => {
      return sql<boolean>`${columnRef} @> ${sql.raw(`'${serializeJsonValue(value)}'`)}`
    },

    hasKey: (key: string) => {
      return sql<boolean>`${columnRef} ? ${key}`
    },

    hasAllKeys: (keys: string[]) => {
      if (keys.length === 0) {
        // Empty array means "has all of no keys" which is always true
        return sql<boolean>`true`
      }
      return sql<boolean>`${columnRef} ?& ARRAY[${sql.join(keys)}]`
    },

    hasAnyKey: (keys: string[]) => {
      if (keys.length === 0) {
        // Empty array means "has any of no keys" which is always false
        return sql<boolean>`false`
      }
      return sql<boolean>`${columnRef} ?| ARRAY[${sql.join(keys)}]`
    }
  }
}