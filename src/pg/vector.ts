import { sql, type RawBuilder, type SimpleReferenceExpression } from 'kysely'

/**
 * PostgreSQL vector helper functions (pgvector extension)
 * 
 * Provides type-safe vector operations for AI/ML workloads:
 * - Semantic similarity search
 * - Vector conversion utilities
 */

/**
 * Supported similarity algorithms
 */
export type SimilarityAlgorithm = 'cosine' | 'euclidean' | 'dot'

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
   * Calculate similarity between vectors
   * Returns 0-1 where higher values indicate more similarity
   * 
   * @param targetVector Vector to compare against
   * @param algorithm Similarity algorithm to use (default: 'cosine')
   * 
   * @example
   * ```ts
   * // Find similar documents (default cosine similarity)
   * .where(pg.vector('embedding').similarity(searchVector), '>', 0.8)
   * .orderBy(pg.vector('embedding').similarity(searchVector), 'desc')
   * 
   * // Use specific algorithm
   * .where(pg.vector('embedding').similarity(searchVector, 'euclidean'), '>', 0.7)
   * ```
   * 
   * Algorithm mappings:
   * - 'cosine': 1 - (embedding <=> target) - Range: 0-1
   * - 'euclidean': 1 / (1 + (embedding <-> target)) - Range: 0-1  
   * - 'dot': (embedding <#> target + 1) / 2 - Range: 0-1
   */
  similarity(targetVector: number[], algorithm?: SimilarityAlgorithm): RawBuilder<number>
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
 * Internal: Create vector operations from a column reference
 * Used by both simple API and type-safe pg(eb) pattern
 */
export function createVectorOperations(columnRef: any): VectorOperations {

  return {
    toArray: () => {
      return sql<number[]>`string_to_array(trim(${columnRef}::text, '[]'), ',')::float[]`
    },

    similarity: (targetVector: number[], algorithm: SimilarityAlgorithm = 'cosine') => {
      const vectorStr = `[${targetVector.join(',')}]`
      
      switch (algorithm) {
        case 'cosine':
          // Convert cosine distance (0=identical, 2=opposite) to similarity (1=identical, 0=opposite)
          return sql<number>`1 - (${columnRef} <=> ${vectorStr}::vector)`
        
        case 'euclidean':
          // Convert euclidean distance to similarity using inverse formula
          return sql<number>`1.0 / (1.0 + (${columnRef} <-> ${vectorStr}::vector))`
        
        case 'dot':
          // Convert dot product to 0-1 range (assuming normalized vectors)
          // Dot product range is typically [-1, 1], so we map to [0, 1]
          return sql<number>`((${columnRef} <#> ${vectorStr}::vector) + 1.0) / 2.0`
        
        default:
          throw new Error(`Unsupported similarity algorithm: ${algorithm}`)
      }
    }
  }
}

/**
 * Create PostgreSQL vector operations for a column (simple API)
 *
 * For quick prototyping. For type-safe column validation, use pg(eb).vector()
 *
 * @param column Column name as string
 * @returns Vector operations builder
 */
export function vector(column: string): VectorOperations {
  const columnRef = sql.ref(column)
  return createVectorOperations(columnRef)
}
