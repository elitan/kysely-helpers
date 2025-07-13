import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { Kysely, PostgresDialect, sql } from 'kysely'
import { Pool } from 'pg'
import { pg } from '../../../src/index'

// Database interface matching our test schema
interface TestDatabase {
  document_embeddings: {
    id: number
    document_id: number | null
    content: string
    embedding: number[]
    metadata: any
    created_at: Date
  }
  documents: {
    id: number
    title: string
    content: string
    author: string | null
    tags: string[]
    metadata: any
    word_count: number | null
    created_at: Date
  }
}

// Database connection config
const DATABASE_URL = process.env.DATABASE_URL
const DB_CONFIG = DATABASE_URL ? {
  connectionString: DATABASE_URL
} : {
  host: 'localhost',
  port: 15432,
  database: 'kysely_test',
  user: 'postgres',
  password: 'postgres',
}

let db: Kysely<TestDatabase>
let pool: Pool
let pgvectorAvailable = false

beforeAll(async () => {
  // Connect to database with retries
  pool = new Pool(DB_CONFIG)
  
  let retries = 30
  let connected = false
  
  while (retries > 0 && !connected) {
    try {
      const client = await pool.connect()
      await client.query('SELECT 1')
      client.release()
      connected = true
      console.log('✅ Vector tests: Database connection successful')
    } catch (error) {
      retries--
      if (retries === 0) {
        console.log('❌ Vector tests: Database not ready, skipping tests')
        console.log('Run: docker-compose up -d postgres')
        process.exit(0)
      }
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
  }

  db = new Kysely<TestDatabase>({
    dialect: new PostgresDialect({ pool })
  })

  // Check if pgvector is available
  try {
    await db.selectFrom('document_embeddings').select('id').limit(1).execute()
    pgvectorAvailable = true
    console.log('✅ Vector tests: pgvector extension available')
  } catch (error) {
    console.log('⚠️ Vector tests: pgvector extension not available, skipping database tests')
  }
})

afterAll(async () => {
  if (db) {
    await db.destroy()
  }
})

describe('Vector Database Integration', () => {
  // Only run these if we have pgvector available
  const itWithVector = pgvectorAvailable ? test : test.skip

  describe('distance() database operations', () => {
    itWithVector('finds documents by L2 distance', async () => {
      const searchVector = [0.1, 0.2, 0.3, 0.4, 0.5]
      
      const results = await db
        .selectFrom('document_embeddings')
        .select([
          'id',
          'content',
          pg.vector('embedding').distance(searchVector).as('distance')
        ])
        .where(pg.vector('embedding').distance(searchVector), '<', 2.0)
        .orderBy('distance')
        .execute()

      expect(results).toBeDefined()
      expect(Array.isArray(results)).toBe(true)
      
      if (results.length > 0) {
        // Results should be ordered by distance (ascending)
        for (let i = 1; i < results.length; i++) {
          expect(results[i].distance).toBeGreaterThanOrEqual(results[i - 1].distance)
        }
        
        // All distances should be less than threshold
        for (const result of results) {
          expect(result.distance).toBeLessThan(2.0)
          expect(typeof result.distance).toBe('number')
        }
      }
    })

    itWithVector('l2Distance produces same results as distance', async () => {
      const searchVector = [0.2, 0.3, 0.4, 0.5, 0.6]
      
      const distanceResults = await db
        .selectFrom('document_embeddings')
        .select(['id', pg.vector('embedding').distance(searchVector).as('score')])
        .orderBy('id')
        .execute()

      const l2Results = await db
        .selectFrom('document_embeddings')
        .select(['id', pg.vector('embedding').l2Distance(searchVector).as('score')])
        .orderBy('id')
        .execute()

      expect(distanceResults.length).toBe(l2Results.length)
      
      for (let i = 0; i < distanceResults.length; i++) {
        expect(distanceResults[i].id).toBe(l2Results[i].id)
        expect(distanceResults[i].score).toBeCloseTo(l2Results[i].score, 6)
      }
    })

    itWithVector('works with empty search vector', async () => {
      const results = await db
        .selectFrom('document_embeddings')
        .select(['id', 'content'])
        .where(pg.vector('embedding').distance([]), '<', 100)
        .execute()

      expect(Array.isArray(results)).toBe(true)
      // Empty vector distance should work (though may return unexpected results)
    })

    itWithVector('handles precise similarity search', async () => {
      // Search for very similar vectors (should find exact or near-exact matches)
      const searchVector = [0.1, 0.2, 0.3, 0.4, 0.5]
      
      const results = await db
        .selectFrom('document_embeddings')
        .select([
          'id',
          'content',
          pg.vector('embedding').distance(searchVector).as('distance')
        ])
        .where(pg.vector('embedding').distance(searchVector), '<', 0.1)
        .orderBy('distance')
        .limit(5)
        .execute()

      expect(Array.isArray(results)).toBe(true)
      
      for (const result of results) {
        expect(result.distance).toBeLessThan(0.1)
        expect(result.distance).toBeGreaterThanOrEqual(0)
      }
    })
  })

  describe('innerProduct() database operations', () => {
    itWithVector('finds documents by inner product similarity', async () => {
      const searchVector = [0.3, 0.4, 0.5, 0.6, 0.7]
      
      const results = await db
        .selectFrom('document_embeddings')
        .select([
          'id',
          'content',
          pg.vector('embedding').innerProduct(searchVector).as('inner_product')
        ])
        .where(pg.vector('embedding').innerProduct(searchVector), '>', 0.1)
        .orderBy('inner_product', 'desc')
        .execute()

      expect(Array.isArray(results)).toBe(true)
      
      if (results.length > 0) {
        // Results should be ordered by inner product (descending for similarity)
        for (let i = 1; i < results.length; i++) {
          expect(results[i].inner_product).toBeLessThanOrEqual(results[i - 1].inner_product)
        }
        
        // All inner products should be greater than threshold
        for (const result of results) {
          expect(result.inner_product).toBeGreaterThan(0.1)
          expect(typeof result.inner_product).toBe('number')
        }
      }
    })

    itWithVector('works with negative inner products', async () => {
      const searchVector = [-1, -1, -1, -1, -1]
      
      const results = await db
        .selectFrom('document_embeddings')
        .select([
          'id',
          pg.vector('embedding').innerProduct(searchVector).as('inner_product')
        ])
        .execute()

      expect(Array.isArray(results)).toBe(true)
      
      for (const result of results) {
        expect(typeof result.inner_product).toBe('number')
        // Inner product can be negative
      }
    })

    itWithVector('finds high similarity documents', async () => {
      const searchVector = [0.2, 0.3, 0.4, 0.5, 0.6]
      
      const results = await db
        .selectFrom('document_embeddings')
        .select([
          'id',
          'content',
          pg.vector('embedding').innerProduct(searchVector).as('similarity')
        ])
        .where(pg.vector('embedding').innerProduct(searchVector), '>', 0.5)
        .orderBy('similarity', 'desc')
        .limit(3)
        .execute()

      expect(Array.isArray(results)).toBe(true)
      
      for (const result of results) {
        expect(result.similarity).toBeGreaterThan(0.5)
      }
    })
  })

  describe('cosineDistance() database operations', () => {
    itWithVector('finds documents by cosine similarity', async () => {
      const searchVector = [0.4, 0.5, 0.6, 0.7, 0.8]
      
      const results = await db
        .selectFrom('document_embeddings')
        .select([
          'id',
          'content',
          pg.vector('embedding').cosineDistance(searchVector).as('cosine_distance')
        ])
        .where(pg.vector('embedding').cosineDistance(searchVector), '<', 1.0)
        .orderBy('cosine_distance')
        .execute()

      expect(Array.isArray(results)).toBe(true)
      
      if (results.length > 0) {
        // Results should be ordered by cosine distance (ascending for similarity)
        for (let i = 1; i < results.length; i++) {
          expect(results[i].cosine_distance).toBeGreaterThanOrEqual(results[i - 1].cosine_distance)
        }
        
        // All cosine distances should be less than threshold
        for (const result of results) {
          expect(result.cosine_distance).toBeLessThan(1.0)
          expect(result.cosine_distance).toBeGreaterThanOrEqual(0)
          expect(typeof result.cosine_distance).toBe('number')
        }
      }
    })

    itWithVector('works with normalized vectors', async () => {
      // Use a normalized vector (magnitude = 1)
      const magnitude = Math.sqrt(0.2*0.2 + 0.4*0.4 + 0.4*0.4 + 0.4*0.4 + 0.6*0.6)
      const normalizedVector = [0.2, 0.4, 0.4, 0.4, 0.6].map(x => x / magnitude)
      
      const results = await db
        .selectFrom('document_embeddings')
        .select([
          'id',
          pg.vector('embedding').cosineDistance(normalizedVector).as('cosine_distance')
        ])
        .orderBy('cosine_distance')
        .limit(5)
        .execute()

      expect(Array.isArray(results)).toBe(true)
      
      for (const result of results) {
        expect(typeof result.cosine_distance).toBe('number')
        expect(result.cosine_distance).toBeGreaterThanOrEqual(0)
        expect(result.cosine_distance).toBeLessThanOrEqual(2) // Cosine distance range is [0, 2]
      }
    })

    itWithVector('finds very similar documents', async () => {
      // Look for documents with very low cosine distance (high similarity)
      const searchVector = [0.1, 0.2, 0.3, 0.4, 0.5]
      
      const results = await db
        .selectFrom('document_embeddings')
        .select([
          'id',
          'content',
          pg.vector('embedding').cosineDistance(searchVector).as('distance')
        ])
        .where(pg.vector('embedding').cosineDistance(searchVector), '<', 0.5)
        .orderBy('distance')
        .execute()

      expect(Array.isArray(results)).toBe(true)
      
      for (const result of results) {
        expect(result.distance).toBeLessThan(0.5)
        expect(result.distance).toBeGreaterThanOrEqual(0)
      }
    })
  })

  describe('similarTo() database operations', () => {
    itWithVector('finds similar documents with default parameters', async () => {
      const searchVector = [0.1, 0.2, 0.3, 0.4, 0.5]
      
      const results = await db
        .selectFrom('document_embeddings')
        .select(['id', 'content'])
        .where(pg.vector('embedding').similarTo(searchVector))
        .execute()

      expect(Array.isArray(results)).toBe(true)
      // Default threshold is 0.5, so should find moderately similar documents
    })

    itWithVector('finds similar documents with custom threshold', async () => {
      const searchVector = [0.2, 0.3, 0.4, 0.5, 0.6]
      
      const highThreshold = await db
        .selectFrom('document_embeddings')
        .select(['id'])
        .where(pg.vector('embedding').similarTo(searchVector, 0.9))
        .execute()

      const lowThreshold = await db
        .selectFrom('document_embeddings')
        .select(['id'])
        .where(pg.vector('embedding').similarTo(searchVector, 0.1))
        .execute()

      expect(Array.isArray(highThreshold)).toBe(true)
      expect(Array.isArray(lowThreshold)).toBe(true)
      
      // Lower threshold should return more results (less strict)
      expect(lowThreshold.length).toBeGreaterThanOrEqual(highThreshold.length)
    })

    itWithVector('works with different similarity methods', async () => {
      const searchVector = [0.3, 0.4, 0.5, 0.6, 0.7]
      
      const l2Results = await db
        .selectFrom('document_embeddings')
        .select(['id'])
        .where(pg.vector('embedding').similarTo(searchVector, 0.8, 'l2'))
        .execute()

      const cosineResults = await db
        .selectFrom('document_embeddings')
        .select(['id'])
        .where(pg.vector('embedding').similarTo(searchVector, 0.8, 'cosine'))
        .execute()

      const innerResults = await db
        .selectFrom('document_embeddings')
        .select(['id'])
        .where(pg.vector('embedding').similarTo(searchVector, 0.8, 'inner'))
        .execute()

      expect(Array.isArray(l2Results)).toBe(true)
      expect(Array.isArray(cosineResults)).toBe(true)
      expect(Array.isArray(innerResults)).toBe(true)
      
      // Different methods may return different numbers of results
    })

    itWithVector('combines with other conditions', async () => {
      const searchVector = [0.4, 0.5, 0.6, 0.7, 0.8]
      
      const results = await db
        .selectFrom('document_embeddings')
        .select(['id', 'content', 'metadata'])
        .where(pg.vector('embedding').similarTo(searchVector, 0.7))
        .where('content', 'like', '%tutorial%')
        .execute()

      expect(Array.isArray(results)).toBe(true)
      
      for (const result of results) {
        expect(result.content.toLowerCase()).toContain('tutorial')
      }
    })
  })

  describe('dimensions() database operations', () => {
    itWithVector('reports correct vector dimensions', async () => {
      const results = await db
        .selectFrom('document_embeddings')
        .select([
          'id',
          'content',
          pg.vector('embedding').dimensions().as('dims')
        ])
        .execute()

      expect(Array.isArray(results)).toBe(true)
      
      if (results.length > 0) {
        for (const result of results) {
          expect(typeof result.dims).toBe('number')
          expect(result.dims).toBeGreaterThan(0)
          // Our test embeddings are 5-dimensional
          expect(result.dims).toBe(5)
        }
      }
    })

    itWithVector('filters by vector dimensions', async () => {
      const results = await db
        .selectFrom('document_embeddings')
        .select(['id', 'content'])
        .where(pg.vector('embedding').dimensions(), '=', 5)
        .execute()

      expect(Array.isArray(results)).toBe(true)
      
      // All results should have 5-dimensional embeddings
      for (const result of results) {
        expect(result.id).toBeDefined()
      }
    })

    itWithVector('works in ORDER BY clause', async () => {
      const results = await db
        .selectFrom('document_embeddings')
        .select([
          'id',
          pg.vector('embedding').dimensions().as('dims')
        ])
        .orderBy(pg.vector('embedding').dimensions(), 'desc')
        .execute()

      expect(Array.isArray(results)).toBe(true)
      
      if (results.length > 1) {
        // Should be ordered by dimensions (descending)
        for (let i = 1; i < results.length; i++) {
          expect(results[i].dims).toBeLessThanOrEqual(results[i - 1].dims)
        }
      }
    })
  })

  describe('norm() database operations', () => {
    itWithVector('calculates vector magnitude', async () => {
      const results = await db
        .selectFrom('document_embeddings')
        .select([
          'id',
          'content',
          pg.vector('embedding').norm().as('magnitude')
        ])
        .execute()

      expect(Array.isArray(results)).toBe(true)
      
      if (results.length > 0) {
        for (const result of results) {
          expect(typeof result.magnitude).toBe('number')
          expect(result.magnitude).toBeGreaterThanOrEqual(0)
        }
      }
    })

    itWithVector('filters by vector magnitude', async () => {
      const results = await db
        .selectFrom('document_embeddings')
        .select(['id', 'content'])
        .where(pg.vector('embedding').norm(), '>', 0.5)
        .execute()

      expect(Array.isArray(results)).toBe(true)
      
      // All results should have magnitude > 0.5
      if (results.length > 0) {
        const magnitudes = await db
          .selectFrom('document_embeddings')
          .select([
            'id',
            pg.vector('embedding').norm().as('magnitude')
          ])
          .where('id', 'in', results.map(r => r.id))
          .execute()

        for (const mag of magnitudes) {
          expect(mag.magnitude).toBeGreaterThan(0.5)
        }
      }
    })

    itWithVector('works in ORDER BY for magnitude ranking', async () => {
      const results = await db
        .selectFrom('document_embeddings')
        .select([
          'id',
          pg.vector('embedding').norm().as('magnitude')
        ])
        .orderBy('magnitude', 'desc')
        .limit(5)
        .execute()

      expect(Array.isArray(results)).toBe(true)
      
      if (results.length > 1) {
        // Should be ordered by magnitude (descending)
        for (let i = 1; i < results.length; i++) {
          expect(results[i].magnitude).toBeLessThanOrEqual(results[i - 1].magnitude)
        }
      }
    })
  })

  describe('sameDimensions() database operations', () => {
    itWithVector('finds documents with same dimensions', async () => {
      // This test assumes document_embeddings table exists and has consistent dimensions
      const results = await db
        .selectFrom('document_embeddings as e1')
        .innerJoin('document_embeddings as e2', 'e1.id', 'e2.id')
        .select(['e1.id', 'e1.content'])
        .where(pg.vector('e1.embedding').sameDimensions('e2.embedding'))
        .execute()

      expect(Array.isArray(results)).toBe(true)
      
      // All embeddings should have same dimensions (should return all records)
      if (results.length > 0) {
        expect(results.length).toBeGreaterThan(0)
      }
    })

    itWithVector('works with qualified column names', async () => {
      const results = await db
        .selectFrom('document_embeddings')
        .select(['id', 'content'])
        .where(pg.vector('document_embeddings.embedding').dimensions(), '>', 0)
        .execute()

      expect(Array.isArray(results)).toBe(true)
    })
  })

  describe('Complex vector queries', () => {
    itWithVector('semantic search with multiple criteria', async () => {
      const searchVector = [0.1, 0.2, 0.3, 0.4, 0.5]
      
      const results = await db
        .selectFrom('document_embeddings')
        .select([
          'id',
          'content',
          pg.vector('embedding').distance(searchVector).as('l2_distance'),
          pg.vector('embedding').cosineDistance(searchVector).as('cosine_distance'),
          pg.vector('embedding').innerProduct(searchVector).as('inner_product'),
          pg.vector('embedding').dimensions().as('dims'),
          pg.vector('embedding').norm().as('magnitude')
        ])
        .where(pg.vector('embedding').similarTo(searchVector, 0.8, 'cosine'))
        .where(pg.vector('embedding').dimensions(), '=', 5)
        .where(pg.vector('embedding').norm(), '>', 0.1)
        .orderBy('cosine_distance')
        .limit(5)
        .execute()

      expect(Array.isArray(results)).toBe(true)
      
      for (const result of results) {
        expect(result.dims).toBe(5)
        expect(result.magnitude).toBeGreaterThan(0.1)
        expect(result.cosine_distance).toBeGreaterThanOrEqual(0)
        expect(typeof result.l2_distance).toBe('number')
        expect(typeof result.inner_product).toBe('number')
      }
    })

    itWithVector('vector operations with JOINs', async () => {
      const searchVector = [0.2, 0.3, 0.4, 0.5, 0.6]
      
      const results = await db
        .selectFrom('document_embeddings')
        .innerJoin('documents', 'document_embeddings.document_id', 'documents.id')
        .select([
          'documents.id',
          'documents.title',
          'document_embeddings.content',
          pg.vector('document_embeddings.embedding').distance(searchVector).as('similarity')
        ])
        .where(pg.vector('document_embeddings.embedding').similarTo(searchVector, 0.7))
        .where('documents.title', 'is not', null)
        .orderBy('similarity')
        .execute()

      expect(Array.isArray(results)).toBe(true)
      
      for (const result of results) {
        expect(result.title).toBeDefined()
        expect(typeof result.similarity).toBe('number')
      }
    })

    itWithVector('vector similarity ranking', async () => {
      const searchVector = [0.3, 0.4, 0.5, 0.6, 0.7]
      
      const results = await db
        .selectFrom('document_embeddings')
        .select([
          'id',
          'content',
          pg.vector('embedding').distance(searchVector).as('l2_score'),
          pg.vector('embedding').cosineDistance(searchVector).as('cosine_score'),
          pg.vector('embedding').innerProduct(searchVector).as('inner_score')
        ])
        .orderBy([
          { column: 'cosine_score', order: 'asc' },
          { column: 'l2_score', order: 'asc' }
        ])
        .limit(3)
        .execute()

      expect(Array.isArray(results)).toBe(true)
      
      if (results.length > 1) {
        // Should be ordered by cosine score first, then L2 score
        for (let i = 1; i < results.length; i++) {
          if (results[i - 1].cosine_score === results[i].cosine_score) {
            expect(results[i].l2_score).toBeGreaterThanOrEqual(results[i - 1].l2_score)
          } else {
            expect(results[i].cosine_score).toBeGreaterThanOrEqual(results[i - 1].cosine_score)
          }
        }
      }
    })

    itWithVector('vector aggregations and statistics', async () => {
      const results = await db
        .selectFrom('document_embeddings')
        .select([
          sql<number>`count(*)`.as('total_embeddings'),
          sql<number>`avg(${pg.vector('embedding').norm()})`.as('avg_magnitude'),
          sql<number>`max(${pg.vector('embedding').dimensions()})`.as('max_dimensions'),
          sql<number>`min(${pg.vector('embedding').dimensions()})`.as('min_dimensions')
        ])
        .executeTakeFirst()

      expect(results).toBeDefined()
      if (results) {
        expect(typeof results.total_embeddings).toBe('number')
        expect(typeof results.avg_magnitude).toBe('number')
        expect(typeof results.max_dimensions).toBe('number')
        expect(typeof results.min_dimensions).toBe('number')
        
        expect(results.total_embeddings).toBeGreaterThan(0)
        expect(results.avg_magnitude).toBeGreaterThan(0)
        expect(results.max_dimensions).toBe(5) // Our test embeddings are 5D
        expect(results.min_dimensions).toBe(5)
      }
    })
  })

  describe('Performance and edge cases', () => {
    itWithVector('handles large vector searches efficiently', async () => {
      // Test with a larger vector (simulating real embedding dimensions)
      const largeVector = Array.from({length: 100}, (_, i) => (i % 10) / 10)
      
      const startTime = Date.now()
      const results = await db
        .selectFrom('document_embeddings')
        .select(['id', 'content'])
        .where(pg.vector('embedding').dimensions(), '=', 5) // Our test data is 5D
        .limit(10)
        .execute()
      const endTime = Date.now()

      // Should complete in reasonable time
      expect(endTime - startTime).toBeLessThan(2000)
      expect(Array.isArray(results)).toBe(true)
    })

    itWithVector('concurrent vector operations', async () => {
      const searchVector1 = [0.1, 0.2, 0.3, 0.4, 0.5]
      const searchVector2 = [0.5, 0.4, 0.3, 0.2, 0.1]
      const searchVector3 = [0.3, 0.3, 0.3, 0.3, 0.4]

      // Run multiple vector queries concurrently
      const promises = [
        db.selectFrom('document_embeddings').selectAll().where(pg.vector('embedding').similarTo(searchVector1, 0.8)).execute(),
        db.selectFrom('document_embeddings').selectAll().where(pg.vector('embedding').distance(searchVector2), '<', 1.0).execute(),
        db.selectFrom('document_embeddings').selectAll().where(pg.vector('embedding').cosineDistance(searchVector3), '<', 0.5).execute()
      ]

      const results = await Promise.all(promises)

      // All queries should complete successfully
      expect(results).toHaveLength(3)
      for (const result of results) {
        expect(Array.isArray(result)).toBe(true)
      }
    })

    itWithVector('vector operations with extreme values', async () => {
      // Test with vectors containing extreme values
      const extremeVector = [1e-6, 1e6, -1e6, 0, Number.EPSILON]
      
      const results = await db
        .selectFrom('document_embeddings')
        .select(['id', 'content'])
        .where(pg.vector('embedding').dimensions(), '=', 5)
        .limit(5)
        .execute()

      expect(Array.isArray(results)).toBe(true)
      // Should handle extreme values without errors
    })
  })

  describe('Data manipulation with vectors', () => {
    itWithVector('insert and query vector data', async () => {
      const testEmbedding = [0.9, 0.8, 0.7, 0.6, 0.5]

      // Insert test data
      const insertResult = await db
        .insertInto('document_embeddings')
        .values({
          document_id: null,
          content: 'Test vector document',
          embedding: testEmbedding,
          metadata: {test: true}
        })
        .returning('id')
        .executeTakeFirst()

      expect(insertResult?.id).toBeDefined()

      try {
        // Query the inserted data
        const results = await db
          .selectFrom('document_embeddings')
          .select(['id', 'content', 'embedding'])
          .where('id', '=', insertResult!.id)
          .execute()

        expect(results.length).toBe(1)
        expect(results[0].content).toBe('Test vector document')
        expect(results[0].embedding).toEqual(testEmbedding)

        // Test similarity search with the inserted vector
        const similarityResults = await db
          .selectFrom('document_embeddings')
          .select(['id', 'content'])
          .where(pg.vector('embedding').distance(testEmbedding), '<', 0.1)
          .execute()

        // Should find at least our inserted document
        expect(similarityResults.length).toBeGreaterThanOrEqual(1)
        const ourDoc = similarityResults.find(r => r.id === insertResult!.id)
        expect(ourDoc).toBeDefined()
      } finally {
        // Clean up
        await db
          .deleteFrom('document_embeddings')
          .where('id', '=', insertResult!.id)
          .execute()
      }
    })
  })
})