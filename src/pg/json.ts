import { sql, type Expression, type RawBuilder } from 'kysely'

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
 */
export interface JsonPathOperations {
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
 * JSON operations builder
 */
export interface JsonOperations {
  /**
   * Navigate to a JSON path with smart detection
   * Accepts both string and array paths
   * 
   * @example
   * ```ts
   * // String path
   * .where(pg.json('preferences').path('theme').equals('dark'))
   * 
   * // Array path for nested access
   * .where(pg.json('config').path(['user', 'settings', 'language']).equals('en'))
   * ```
   */
  path(path: string | string[]): JsonPathOperations

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
    path: (path: string | string[]) => {
      const pathArray = Array.isArray(path) ? path : [path]
      const pathString = `'{${pathArray.join(',')}}'`
      const jsonPathRef = sql`${columnRef}#>${sql.raw(pathString)}`
      const textPathRef = sql`${columnRef}#>>${sql.raw(pathString)}`
      
      return {
        contains: (value: any) => {
          return sql<boolean>`${jsonPathRef} @> ${serializeJsonValue(value)}`
        },

        equals: (value: any) => {
          if (isComplexValue(value)) {
            // Use JSON mode for objects and arrays
            return sql<boolean>`${jsonPathRef} = ${serializeJsonValue(value)}`
          } else {
            // Use text mode for primitives  
            return sql<boolean>`${textPathRef} = ${serializeTextValue(value)}`
          }
        },

        greaterThan: (value: any) => {
          return sql<boolean>`${textPathRef} > ${serializeTextValue(value)}`
        },

        lessThan: (value: any) => {
          return sql<boolean>`${textPathRef} < ${serializeTextValue(value)}`
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
          return Object.assign(textPathRef, textOps)
        }
      }
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