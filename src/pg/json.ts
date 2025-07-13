import { sql, type Expression } from 'kysely'

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
   * Get value at path as JSON
   * 
   * @example
   * ```ts
   * .where(json('metadata').path('$.user.preferences').contains({theme: 'dark'}))
   * ```
   */
  contains(value: any): Expression<boolean>

  /**
   * Equals comparison
   * 
   * @example
   * ```ts
   * .where(json('metadata').path('$.theme').equals('dark'))
   * ```
   */
  equals(value: any): Expression<boolean>

  /**
   * Get as text
   * 
   * @example
   * ```ts
   * .select([json('metadata').path('$.theme').asText().as('theme')])
   * ```
   */
  asText(): Expression<string>
}

/**
 * JSON operations builder
 */
export interface JsonOperations {
  /**
   * Get JSON object field (->)
   * 
   * @example
   * ```ts
   * .where(json('metadata').get('theme').equals('dark'))
   * ```
   * 
   * Generates: `metadata->'theme' = '"dark"'`
   */
  get(key: string): JsonPathOperations

  /**
   * Get JSON object field as text (->>)
   * 
   * @example
   * ```ts
   * .where(json('metadata').getText('theme'), '=', 'dark')
   * ```
   * 
   * Generates: `metadata->>'theme' = 'dark'`
   */
  getText(key: string): Expression<string>

  /**
   * Get JSON object at path (#>)
   * 
   * @example
   * ```ts
   * .where(json('metadata').path('{user,preferences,theme}').equals('dark'))
   * ```
   * 
   * Generates: `metadata#>'{user,preferences,theme}' = '"dark"'`
   */
  path(path: string | string[]): JsonPathOperations

  /**
   * Get JSON object at path as text (#>>)
   * 
   * @example
   * ```ts
   * .where(json('metadata').pathText('{user,theme}'), '=', 'dark')
   * ```
   * 
   * Generates: `metadata#>>'{user,theme}' = 'dark'`
   */
  pathText(path: string | string[]): Expression<string>

  /**
   * JSON contains operation (@>)
   * 
   * @example
   * ```ts
   * .where(json('metadata').contains({theme: 'dark'}))
   * ```
   * 
   * Generates: `metadata @> '{"theme":"dark"}'`
   */
  contains(value: any): Expression<boolean>

  /**
   * JSON contained by operation (<@)
   * 
   * @example
   * ```ts
   * .where(json('user_prefs').containedBy({theme: 'dark', lang: 'en'}))
   * ```
   */
  containedBy(value: any): Expression<boolean>

  /**
   * JSON key exists (?)
   * 
   * @example
   * ```ts
   * .where(json('metadata').hasKey('theme'))
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
   * .where(json('metadata').hasAllKeys(['theme', 'language']))
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
   * .where(json('metadata').hasAnyKey(['theme', 'style']))
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
export function json(column: string): JsonOperations {
  const columnRef = sql.ref(column)

  return {
    get: (key: string) => {
      const pathRef = sql`${columnRef}->${key}`
      return {
        contains: (value: any) => sql<boolean>`${pathRef} @> ${JSON.stringify(value)}`,
        equals: (value: any) => sql<boolean>`${pathRef} = ${JSON.stringify(value)}`,
        asText: () => sql<string>`${columnRef}->>${key}`
      }
    },

    getText: (key: string) => {
      return sql<string>`${columnRef}->>${key}`
    },

    path: (path: string | string[]) => {
      const pathArray = Array.isArray(path) ? path : [path]
      const pathString = `{${pathArray.join(',')}}`
      const pathRef = sql`${columnRef}#>${pathString}`
      return {
        contains: (value: any) => sql<boolean>`${pathRef} @> ${JSON.stringify(value)}`,
        equals: (value: any) => sql<boolean>`${pathRef} = ${JSON.stringify(value)}`,
        asText: () => sql<string>`${columnRef}#>>${pathString}`
      }
    },

    pathText: (path: string | string[]) => {
      const pathArray = Array.isArray(path) ? path : [path]
      const pathString = `{${pathArray.join(',')}}`
      return sql<string>`${columnRef}#>>${pathString}`
    },

    contains: (value: any) => {
      return sql<boolean>`${columnRef} @> ${JSON.stringify(value)}`
    },

    containedBy: (value: any) => {
      return sql<boolean>`${columnRef} <@ ${JSON.stringify(value)}`
    },

    hasKey: (key: string) => {
      return sql<boolean>`${columnRef} ? ${key}`
    },

    hasAllKeys: (keys: string[]) => {
      return sql<boolean>`${columnRef} ?& ARRAY[${sql.join(keys)}]`
    },

    hasAnyKey: (keys: string[]) => {
      return sql<boolean>`${columnRef} ?| ARRAY[${sql.join(keys)}]`
    }
  }
}