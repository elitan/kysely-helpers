import { sql, type Expression } from 'kysely'

/**
 * PostgreSQL full-text search helper functions
 * 
 * Provides type-safe full-text search operations:
 * - Text search operators (@@ with to_tsquery, plainto_tsquery)
 * - Ranking functions (ts_rank, ts_rank_cd)
 * - Highlighting (ts_headline)
 * - Vector creation (to_tsvector)
 */

/**
 * Text search operations builder
 */
export interface TextOperations {
  /**
   * Full-text search with to_tsquery (@@)
   * Supports complex query syntax with & (AND), | (OR), ! (NOT), () grouping
   * 
   * @example
   * ```ts
   * .where(text('content').matches('typescript & (tutorial | guide)'))
   * .where(text('title').matches('machine & learning & !beginner'))
   * ```
   * 
   * Generates: `content @@ to_tsquery('typescript & (tutorial | guide)')`
   */
  matches(query: string, config?: string): Expression<boolean>

  /**
   * Plain text search with plainto_tsquery (@@)
   * Automatically handles spaces as AND operations
   * 
   * @example
   * ```ts
   * .where(text('content').matchesPlain('machine learning tutorial'))
   * ```
   * 
   * Generates: `content @@ plainto_tsquery('machine learning tutorial')`
   */
  matchesPlain(query: string, config?: string): Expression<boolean>

  /**
   * Phrase search with phraseto_tsquery (@@)
   * Searches for exact phrase
   * 
   * @example
   * ```ts
   * .where(text('content').matchesPhrase('machine learning'))
   * ```
   * 
   * Generates: `content @@ phraseto_tsquery('machine learning')`
   */
  matchesPhrase(query: string, config?: string): Expression<boolean>

  /**
   * Websearch-style search with websearch_to_tsquery (@@)
   * Supports quotes, +/- operators like Google
   * 
   * @example
   * ```ts
   * .where(text('content').matchesWeb('"machine learning" +tutorial -beginner'))
   * ```
   * 
   * Generates: `content @@ websearch_to_tsquery('"machine learning" +tutorial -beginner')`
   */
  matchesWeb(query: string, config?: string): Expression<boolean>

  /**
   * Text search ranking with ts_rank
   * Returns relevance score for search results
   * 
   * @example
   * ```ts
   * .select([text('content').rank('machine learning').as('relevance')])
   * .orderBy('relevance', 'desc')
   * ```
   * 
   * Generates: `ts_rank(content, to_tsquery('machine learning'))`
   */
  rank(query: string, config?: string): Expression<number>

  /**
   * Cover density ranking with ts_rank_cd
   * Alternative ranking algorithm
   * 
   * @example
   * ```ts
   * .select([text('content').rankCd('tutorial').as('density')])
   * ```
   * 
   * Generates: `ts_rank_cd(content, to_tsquery('tutorial'))`
   */
  rankCd(query: string, config?: string): Expression<number>

  /**
   * Generate highlighted snippets with ts_headline
   * 
   * @example
   * ```ts
   * .select([
   *   text('content').headline('machine learning', {
   *     MaxWords: 50,
   *     MinWords: 20,
   *     StartSel: '<mark>',
   *     StopSel: '</mark>'
   *   }).as('snippet')
   * ])
   * ```
   * 
   * Generates: `ts_headline(content, to_tsquery('machine learning'), 'MaxWords=50,...')`
   */
  headline(query: string, options?: HeadlineOptions, config?: string): Expression<string>

  /**
   * Convert text to tsvector for indexing
   * 
   * @example
   * ```ts
   * .select([text('content').toVector().as('search_vector')])
   * ```
   * 
   * Generates: `to_tsvector(content)`
   */
  toVector(config?: string): Expression<any>
}

/**
 * Options for ts_headline function
 */
export interface HeadlineOptions {
  /** Maximum words in headline */
  MaxWords?: number
  /** Minimum words in headline */
  MinWords?: number
  /** String to mark start of highlighted text */
  StartSel?: string
  /** String to mark end of highlighted text */
  StopSel?: string
  /** Maximum fragments to show */
  MaxFragments?: number
  /** Fragment delimiter */
  FragmentDelimiter?: string
}

/**
 * Create PostgreSQL full-text search operations for a column
 * 
 * @param column Column name or expression (should be tsvector type for best performance)
 * @returns Text search operations builder
 * 
 * @example
 * ```ts
 * import { pg } from 'kysely-helpers'
 * 
 * // Full-text search with ranking
 * const results = await db
 *   .selectFrom('articles')
 *   .select([
 *     'id',
 *     'title',
 *     pg.text('content').rank('postgresql tutorial').as('relevance'),
 *     pg.text('content').headline('postgresql tutorial', {
 *       MaxWords: 50,
 *       StartSel: '<strong>',
 *       StopSel: '</strong>'
 *     }).as('snippet')
 *   ])
 *   .where(pg.text('search_vector').matches('postgresql & tutorial'))
 *   .orderBy('relevance', 'desc')
 *   .limit(20)
 *   .execute()
 * 
 * // Simple plain text search
 * const simple = await db
 *   .selectFrom('documents')
 *   .selectAll()
 *   .where(pg.text('content').matchesPlain('machine learning basics'))
 *   .execute()
 * ```
 */
export function text(column: string): TextOperations {
  const columnRef = sql.ref(column)

  const formatConfig = (config?: string) => config ? `'${config}'` : "'english'"

  const formatHeadlineOptions = (options: HeadlineOptions = {}): string => {
    const opts = Object.entries(options)
      .map(([key, value]) => `${key}=${typeof value === 'string' ? value : value}`)
      .join(', ')
    return opts ? `'${opts}'` : "''"
  }

  return {
    matches: (query: string, config?: string) => {
      return sql<boolean>`${columnRef} @@ to_tsquery(${sql.raw(formatConfig(config))}, ${query})`
    },

    matchesPlain: (query: string, config?: string) => {
      return sql<boolean>`${columnRef} @@ plainto_tsquery(${sql.raw(formatConfig(config))}, ${query})`
    },

    matchesPhrase: (query: string, config?: string) => {
      return sql<boolean>`${columnRef} @@ phraseto_tsquery(${sql.raw(formatConfig(config))}, ${query})`
    },

    matchesWeb: (query: string, config?: string) => {
      return sql<boolean>`${columnRef} @@ websearch_to_tsquery(${sql.raw(formatConfig(config))}, ${query})`
    },

    rank: (query: string, config?: string) => {
      return sql<number>`ts_rank(${columnRef}, to_tsquery(${sql.raw(formatConfig(config))}, ${query}))`
    },

    rankCd: (query: string, config?: string) => {
      return sql<number>`ts_rank_cd(${columnRef}, to_tsquery(${sql.raw(formatConfig(config))}, ${query}))`
    },

    headline: (query: string, options: HeadlineOptions = {}, config?: string) => {
      const optionsStr = formatHeadlineOptions(options)
      return sql<string>`ts_headline(${sql.raw(formatConfig(config))}, ${columnRef}, to_tsquery(${sql.raw(formatConfig(config))}, ${query}), ${sql.raw(optionsStr)})`
    },

    toVector: (config?: string) => {
      return sql`to_tsvector(${sql.raw(formatConfig(config))}, ${columnRef})`
    }
  }
}