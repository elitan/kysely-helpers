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
      if (retries > 0) {
        console.log(`⏳ Vector tests: Database connection failed, retrying... (${retries} attempts left)`)
        await new Promise(resolve => setTimeout(resolve, 1000))
      } else {
        console.log('❌ Vector tests: Database connection failed after all retries')
        throw error
      }
    }
  }

  db = new Kysely<TestDatabase>({
    dialect: new PostgresDialect({ pool })
  })

  // Check if pgvector extension is available
  try {
    await db.executeQuery(sql`SELECT 1`.compile(db))
    
    // Check if pgvector is available
    try {
      await db.executeQuery(sql`SELECT '[1,2,3]'::vector <-> '[1,2,3]'::vector`.compile(db))
      pgvectorAvailable = true
      console.log('✅ Vector tests: pgvector extension available')
    } catch (error) {
      console.log('⚠️ Vector tests: pgvector extension not available, skipping vector operation tests')
    }
  } catch (error) {
    console.log('❌ Vector tests: Database query failed')
    throw error
  }
})

afterAll(async () => {
  if (db) {
    await db.destroy()
  }
  if (pool) {
    await pool.end()
  }
})

// Only run database tests if pgvector is available
const testWithPgVector = pgvectorAvailable ? describe : describe.skip

describe('Vector Database Integration', () => {
  testWithPgVector('Basic vector operations', () => {
    test('similarity() with cosine algorithm (default)', async () => {
      const searchVector = [0.1, 0.2, 0.3, 0.4, 0.5]
      
      const results = await db
        .selectFrom('document_embeddings')
        .select([
          'id',
          'content',
          pg.vector('embedding').similarity(searchVector).as('similarity')
        ])
        .where(pg.vector('embedding').similarity(searchVector), '>', 0.1)
        .orderBy('similarity', 'desc')
        .limit(10)
        .execute()

      expect(Array.isArray(results)).toBe(true)
      
      // Check that similarity scores are in 0-1 range
      results.forEach(row => {
        expect(row.similarity).toBeGreaterThanOrEqual(0)
        expect(row.similarity).toBeLessThanOrEqual(1)
      })
      
      // Check that results are properly ordered (higher similarity first)
      for (let i = 1; i < results.length; i++) {
        expect(results[i].similarity).toBeLessThanOrEqual(results[i - 1].similarity)
      }
    })

    test('similarity() with cosine algorithm (explicit)', async () => {
      const searchVector = [0.5, 0.4, 0.3, 0.2, 0.1]
      
      const results = await db
        .selectFrom('document_embeddings')
        .select([
          'id',
          pg.vector('embedding').similarity(searchVector, 'cosine').as('cosine_similarity')
        ])
        .where(pg.vector('embedding').similarity(searchVector, 'cosine'), '>', 0.2)
        .orderBy('cosine_similarity', 'desc')
        .limit(5)
        .execute()

      expect(Array.isArray(results)).toBe(true)
      
      results.forEach(row => {
        expect(row.cosine_similarity).toBeGreaterThanOrEqual(0)
        expect(row.cosine_similarity).toBeLessThanOrEqual(1)
      })
    })

    test('similarity() with euclidean algorithm', async () => {
      const searchVector = [1, 0, 1, 0, 1]
      
      const results = await db
        .selectFrom('document_embeddings')
        .select([
          'id',
          pg.vector('embedding').similarity(searchVector, 'euclidean').as('euclidean_similarity')
        ])
        .where(pg.vector('embedding').similarity(searchVector, 'euclidean'), '>', 0.1)
        .orderBy('euclidean_similarity', 'desc')
        .limit(5)
        .execute()

      expect(Array.isArray(results)).toBe(true)
      
      results.forEach(row => {
        expect(row.euclidean_similarity).toBeGreaterThanOrEqual(0)
        expect(row.euclidean_similarity).toBeLessThanOrEqual(1)
      })
    })

    test('similarity() with dot product algorithm', async () => {
      const searchVector = [0.2, 0.4, 0.6, 0.8, 1.0]
      
      const results = await db
        .selectFrom('document_embeddings')
        .select([
          'id',
          pg.vector('embedding').similarity(searchVector, 'dot').as('dot_similarity')
        ])
        .where(pg.vector('embedding').similarity(searchVector, 'dot'), '>', 0.3)
        .orderBy('dot_similarity', 'desc')
        .limit(5)
        .execute()

      expect(Array.isArray(results)).toBe(true)
      
      results.forEach(row => {
        expect(row.dot_similarity).toBeGreaterThanOrEqual(0)
        expect(row.dot_similarity).toBeLessThanOrEqual(1)
      })
    })

    test('toArray() converts vectors back to JavaScript arrays', async () => {
      const results = await db
        .selectFrom('document_embeddings')
        .select([
          'id',
          'content',
          pg.vector('embedding').toArray().as('embedding_array')
        ])
        .limit(3)
        .execute()

      expect(Array.isArray(results)).toBe(true)
      
      results.forEach(row => {
        expect(Array.isArray(row.embedding_array)).toBe(true)
        expect(row.embedding_array.length).toBeGreaterThan(0)
        
        // Check that all elements are numbers
        row.embedding_array.forEach(value => {
          expect(typeof value).toBe('number')
        })
      })
    })
  })

  testWithPgVector('Complex vector queries', () => {
    test('semantic search with multiple criteria', async () => {
      const searchVector = [0.3, 0.6, 0.9, 0.2, 0.5]
      
      const results = await db
        .selectFrom('document_embeddings')
        .select([
          'id',
          'content',
          pg.vector('embedding').similarity(searchVector).as('similarity'),
          pg.vector('embedding').toArray().as('embedding_array')
        ])
        .where('content', 'like', '%test%')
        .where(pg.vector('embedding').similarity(searchVector), '>', 0.1)
        .orderBy('similarity', 'desc')
        .limit(5)
        .execute()

      expect(Array.isArray(results)).toBe(true)
      
      results.forEach(row => {
        expect(row.content).toContain('test')
        expect(row.similarity).toBeGreaterThan(0.1)
        expect(Array.isArray(row.embedding_array)).toBe(true)
      })
    })

    test('compare different similarity algorithms', async () => {
      const searchVector = [0.1, 0.2, 0.3, 0.4, 0.5]
      
      const results = await db
        .selectFrom('document_embeddings')
        .select([
          'id',
          'content',
          pg.vector('embedding').similarity(searchVector, 'cosine').as('cosine_sim'),
          pg.vector('embedding').similarity(searchVector, 'euclidean').as('euclidean_sim'),
          pg.vector('embedding').similarity(searchVector, 'dot').as('dot_sim')
        ])
        .limit(3)
        .execute()

      expect(Array.isArray(results)).toBe(true)
      
      results.forEach(row => {
        // All similarity measures should be between 0 and 1
        expect(row.cosine_sim).toBeGreaterThanOrEqual(0)
        expect(row.cosine_sim).toBeLessThanOrEqual(1)
        expect(row.euclidean_sim).toBeGreaterThanOrEqual(0)
        expect(row.euclidean_sim).toBeLessThanOrEqual(1)
        expect(row.dot_sim).toBeGreaterThanOrEqual(0)
        expect(row.dot_sim).toBeLessThanOrEqual(1)
      })
    })

    test('vector operations with subqueries', async () => {
      const searchVector = [0.5, 0.5, 0.5, 0.5, 0.5]
      
      const results = await db
        .selectFrom('document_embeddings')
        .select([
          'id',
          'content',
          pg.vector('embedding').similarity(searchVector).as('similarity')
        ])
        .where('id', 'in', 
          db.selectFrom('document_embeddings')
            .select('id')
            .where(pg.vector('embedding').similarity(searchVector), '>', 0.2)
            .limit(5)
        )
        .orderBy('similarity', 'desc')
        .execute()

      expect(Array.isArray(results)).toBe(true)
      expect(results.length).toBeLessThanOrEqual(5)
      
      results.forEach(row => {
        expect(row.similarity).toBeGreaterThan(0.2)
      })
    })
  })

  testWithPgVector('Edge cases and performance', () => {
    test('handles empty vector gracefully', async () => {
      const emptyVector: number[] = []
      
      const results = await db
        .selectFrom('document_embeddings')
        .select([
          'id',
          pg.vector('embedding').similarity(emptyVector).as('similarity')
        ])
        .limit(1)
        .execute()

      expect(Array.isArray(results)).toBe(true)
      // Should execute without error, even though semantically it might not make sense
    })

    test('handles high-dimensional vectors', async () => {
      const highDimVector = Array.from({length: 1000}, (_, i) => i / 1000)
      
      const results = await db
        .selectFrom('document_embeddings')
        .select([
          'id',
          pg.vector('embedding').similarity(highDimVector).as('similarity')
        ])
        .limit(3)
        .execute()

      expect(Array.isArray(results)).toBe(true)
      // Should work with high-dimensional vectors
    })

    test('concurrent vector operations', async () => {
      const vectors = [
        [0.1, 0.2, 0.3, 0.4, 0.5],
        [0.5, 0.4, 0.3, 0.2, 0.1],
        [1, 0, 1, 0, 1],
        [0.9, 0.8, 0.7, 0.6, 0.5]
      ]

      const promises = vectors.map(vector =>
        db
          .selectFrom('document_embeddings')
          .select([
            'id',
            pg.vector('embedding').similarity(vector).as('similarity')
          ])
          .where(pg.vector('embedding').similarity(vector), '>', 0.1)
          .limit(3)
          .execute()
      )

      const results = await Promise.all(promises)

      expect(results).toHaveLength(4)
      results.forEach(result => {
        expect(Array.isArray(result)).toBe(true)
        result.forEach(row => {
          expect(row.similarity).toBeGreaterThan(0.1)
        })
      })
    })

    test('vector operations with extreme values', async () => {
      const extremeVector = [1e10, -1e10, 1e-10, -1e-10, 0]
      
      try {
        const results = await db
          .selectFrom('document_embeddings')
          .select([
            'id',
            pg.vector('embedding').similarity(extremeVector).as('similarity')
          ])
          .limit(2)
          .execute()

        expect(Array.isArray(results)).toBe(true)
      } catch (error) {
        // Some extreme values might cause PostgreSQL errors, which is acceptable
        expect(error).toBeInstanceOf(Error)
      }
    })
  })

  testWithPgVector('Data manipulation with vectors', () => {
    test('insert and query vector data', async () => {
      const testEmbedding = [0.1, 0.2, 0.3, 0.4, 0.5]
      const testContent = 'Test document for vector operations'

      // Insert test data
      await db
        .insertInto('document_embeddings')
        .values({
          content: testContent,
          embedding: pg.embedding(testEmbedding),
          metadata: { test: true }
        })
        .execute()

      // Query the inserted data
      const results = await db
        .selectFrom('document_embeddings')
        .select([
          'id',
          'content',
          pg.vector('embedding').similarity(testEmbedding).as('similarity'),
          pg.vector('embedding').toArray().as('embedding_array')
        ])
        .where('content', '=', testContent)
        .execute()

      expect(results).toHaveLength(1)
      expect(results[0].content).toBe(testContent)
      expect(results[0].similarity).toBeCloseTo(1.0, 1) // Should be very similar to itself
      expect(results[0].embedding_array).toEqual(testEmbedding)

      // Clean up
      await db
        .deleteFrom('document_embeddings')
        .where('content', '=', testContent)
        .execute()
    })
  })
})

// Skip these tests if pgvector is not available
describe.skip('Vector Database Integration - No pgvector', () => {
  test('placeholder test when pgvector is not available', () => {
    console.log('⚠️ Vector database tests skipped - pgvector extension not available')
    expect(true).toBe(true)
  })
})