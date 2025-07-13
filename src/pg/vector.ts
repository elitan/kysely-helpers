import { sql, type Expression, type RawBuilder } from 'kysely'

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
   * Convert PostgreSQL vector string to JavaScript array
   * Converts "[0.1,0.2,0.3]" to [0.1, 0.2, 0.3]
   * 
   * @example
   * ```ts
   * .select([
   *   'id',
   *   pg.vector('embedding').toArray().as('embedding')
   * ])
   * // Result: { id: 1, embedding: [0.1, 0.2, 0.3] }
   * ```
   * 
   * Generates: `string_to_array(trim(embedding::text, '[]'), ',')::float[]`
   */
  toArray(): RawBuilder<number[]>

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
  distance(otherVector: number[]): RawBuilder<number>

  /**
   * L2 distance operator (<->) - alias for distance()
   * 
   * @example
   * ```ts
   * .where(vector('embedding').l2Distance(searchVector), '<', 0.3)
   * ```
   */
  l2Distance(otherVector: number[]): RawBuilder<number>

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
  innerProduct(otherVector: number[]): RawBuilder<number>

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
  cosineDistance(otherVector: number[]): RawBuilder<number>

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
  dimensions(): RawBuilder<number>

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
  norm(): RawBuilder<number>

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
 * Create a vector value for inserting embeddings into PostgreSQL
 * 
 * @param embedding Array of numbers representing the embedding from OpenAI, Anthropic, etc.
 * @returns SQL expression for inserting vector data
 * 
 * @example
 * ```ts
 * import { pg } from 'kysely-helpers'
 * 
 * const embedding = await openai.embeddings.create({
 *   model: "text-embedding-3-small",
 *   input: "Hello world"
 * })
 * 
 * await db
 *   .insertInto('documents')
 *   .values({
 *     title: 'My Document',
 *     content: text,
 *     embedding: pg.embedding(embedding.data[0].embedding)
 *   })
 *   .execute()
 * ```
 */
export function embedding(embedding: number[]): RawBuilder<any> {
  return sql.raw(`'[${embedding.join(',')}]'::vector`)
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
    toArray: () => {
      return sql<number[]>`string_to_array(trim(${columnRef}::text, '[]'), ',')::float[]`
    },

    distance: (otherVector: number[]) => {
      const vectorStr = `[${otherVector.join(',')}]`
      return sql<number>`${columnRef} <-> ${vectorStr}::vector`
    },

    l2Distance: (otherVector: number[]) => {
      const vectorStr = `[${otherVector.join(',')}]`
      return sql<number>`${columnRef} <-> ${vectorStr}::vector`
    },

    innerProduct: (otherVector: number[]) => {
      const vectorStr = `[${otherVector.join(',')}]`
      return sql<number>`${columnRef} <#> ${vectorStr}::vector`
    },

    cosineDistance: (otherVector: number[]) => {
      const vectorStr = `[${otherVector.join(',')}]`
      return sql<number>`${columnRef} <=> ${vectorStr}::vector`
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
      
      const vectorStr = `[${otherVector.join(',')}]`
      return sql<boolean>`${columnRef} ${sql.raw(operator)} ${vectorStr}::vector ${sql.raw(compareOp)} ${thresholdValue}`
    },

    dimensions: () => {
      return sql<number>`vector_dims(${columnRef})`
    },

    norm: () => {
      return sql<number>`vector_norm(${columnRef})`
    },

    sameDimensions: (otherVector: Expression<any> | string) => {
      const otherRef = typeof otherVector === 'string' ? sql.ref(otherVector) : otherVector
      return sql<boolean>`vector_dims(${columnRef}) = vector_dims(${otherRef})`
    }
  }
}