import { sql, type Expression } from 'kysely'

/**
 * PostgreSQL vector helper functions (pgvector extension)
 * 
 * Provides type-safe vector operations for AI/ML workloads:
 * - Distance functions (<->, <#>, <=>)
 * - Similarity operations
 * - Vector aggregations
 * - Dimension utilities
 */

/**
 * Vector operations builder
 */
export interface VectorOperations {
  /**
   * L2 distance operator (<->)
   * Euclidean distance between vectors
   * 
   * @example
   * ```ts
   * .where(vector('embedding').distance(searchVector), '<', 0.5)
   * .orderBy(vector('embedding').distance(searchVector))
   * ```
   * 
   * Generates: `embedding <-> $1`
   */
  distance(otherVector: number[]): Expression<number>

  /**
   * L2 distance operator (<->) - alias for distance()
   * 
   * @example
   * ```ts
   * .where(vector('embedding').l2Distance(searchVector), '<', 0.3)
   * ```
   */
  l2Distance(otherVector: number[]): Expression<number>

  /**
   * Inner product operator (<#>)
   * Higher values indicate more similarity
   * 
   * @example
   * ```ts
   * .where(vector('embedding').innerProduct(searchVector), '>', 0.7)
   * .orderBy(vector('embedding').innerProduct(searchVector), 'desc')
   * ```
   * 
   * Generates: `embedding <#> $1`
   */
  innerProduct(otherVector: number[]): Expression<number>

  /**
   * Cosine distance operator (<=>)
   * Range: 0 (identical) to 2 (opposite)
   * 
   * @example
   * ```ts
   * .where(vector('embedding').cosineDistance(searchVector), '<', 0.2)
   * ```
   * 
   * Generates: `embedding <=> $1`
   */
  cosineDistance(otherVector: number[]): Expression<number>

  /**
   * Vector similarity with threshold
   * Convenience method for common similarity queries
   * 
   * @param otherVector Vector to compare against
   * @param threshold Similarity threshold (0-1, where 1 is identical)
   * @param method Distance method to use
   * 
   * @example
   * ```ts
   * .where(vector('embedding').similarTo(searchVector, 0.8))
   * .where(vector('embedding').similarTo(searchVector, 0.9, 'cosine'))
   * ```
   */
  similarTo(
    otherVector: number[], 
    threshold?: number, 
    method?: 'l2' | 'cosine' | 'inner'
  ): Expression<boolean>

  /**
   * Vector dimensions/length
   * 
   * @example
   * ```ts
   * .select([vector('embedding').dimensions().as('embedding_dims')])
   * ```
   * 
   * Generates: `array_length(embedding, 1)`
   */
  dimensions(): Expression<number>

  /**
   * Vector norm/magnitude
   * 
   * @example
   * ```ts
   * .select([vector('embedding').norm().as('magnitude')])
   * ```
   * 
   * Generates: `vector_norm(embedding)`
   */
  norm(): Expression<number>

  /**
   * Check if vectors have same dimensions
   * 
   * @example
   * ```ts
   * .where(vector('embedding').sameDimensions(vector('other_embedding')))
   * ```
   */
  sameDimensions(otherVector: Expression<any> | string): Expression<boolean>
}

/**
 * Create PostgreSQL vector operations for a column
 * 
 * @param column Column name or expression
 * @returns Vector operations builder
 * 
 * @example
 * ```ts
 * import { pg } from 'kysely-helpers'
 * 
 * // Semantic search query
 * const searchEmbedding = await generateEmbedding(userQuery)
 * 
 * const results = await db
 *   .selectFrom('documents')
 *   .select([
 *     'id',
 *     'title',
 *     'content',
 *     pg.vector('embedding').distance(searchEmbedding).as('similarity')
 *   ])
 *   .where(pg.vector('embedding').similarTo(searchEmbedding, 0.8))
 *   .orderBy('similarity')
 *   .limit(10)
 *   .execute()
 * ```
 */
export function vector(column: string): VectorOperations {
  const columnRef = sql.ref(column)

  return {
    distance: (otherVector: number[]) => {
      return sql<number>`${columnRef} <-> ARRAY[${sql.join(otherVector)}]`
    },

    l2Distance: (otherVector: number[]) => {
      return sql<number>`${columnRef} <-> ARRAY[${sql.join(otherVector)}]`
    },

    innerProduct: (otherVector: number[]) => {
      return sql<number>`${columnRef} <#> ARRAY[${sql.join(otherVector)}]`
    },

    cosineDistance: (otherVector: number[]) => {
      return sql<number>`${columnRef} <=> ARRAY[${sql.join(otherVector)}]`
    },

    similarTo: (
      otherVector: number[], 
      threshold: number = 0.5, 
      method: 'l2' | 'cosine' | 'inner' = 'l2'
    ) => {
      const operators = {
        l2: '<->',
        cosine: '<=>',
        inner: '<#>'
      }
      
      const operator = operators[method]
      const compareOp = method === 'inner' ? '>' : '<'
      const thresholdValue = method === 'inner' ? threshold : (1 - threshold)
      
      return sql<boolean>`${columnRef} ${sql.raw(operator)} ARRAY[${sql.join(otherVector)}] ${sql.raw(compareOp)} ${thresholdValue}`
    },

    dimensions: () => {
      return sql<number>`array_length(${columnRef}, 1)`
    },

    norm: () => {
      return sql<number>`vector_norm(${columnRef})`
    },

    sameDimensions: (otherVector: Expression<any> | string) => {
      const otherRef = typeof otherVector === 'string' ? sql.ref(otherVector) : otherVector
      return sql<boolean>`array_length(${columnRef}, 1) = array_length(${otherRef}, 1)`
    }
  }
}