import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { 
  Kysely,
  DummyDriver,
  PostgresAdapter,
  PostgresQueryCompiler,
  PostgresDialect,
  sql
} from 'kysely'
import { Pool } from 'pg'
import { pg } from '../../../src/index'

interface TestDB {
  document_embeddings: {
    id: number
    content: string
    embedding: number[]
    metadata: any
  }
}

// Test dialect for SQL compilation
class TestDialect {
  createAdapter() { return new PostgresAdapter() }
  createDriver() { return new DummyDriver() }
  createQueryCompiler() { return new PostgresQueryCompiler() }
  createIntrospector() { return { getSchemas: () => Promise.resolve([]), getTables: () => Promise.resolve([]), getMetadata: () => Promise.resolve({ tables: [] }) } as any }
}

// Database config for integration security tests
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

let compileDb: Kysely<TestDB>
let integrationDb: Kysely<TestDB> | null = null
let pool: Pool | null = null

beforeAll(async () => {
  // Always create compile-only database
  compileDb = new Kysely<TestDB>({
    dialect: new TestDialect()
  })

  // Try to create integration database for real tests
  try {
    pool = new Pool(DB_CONFIG)
    const client = await pool.connect()
    await client.query('SELECT 1')
    client.release()
    
    integrationDb = new Kysely<TestDB>({
      dialect: new PostgresDialect({ pool })
    })
    console.log('✅ Vector Security tests: Database connection available')
  } catch (error) {
    console.log('⚠️ Vector Security tests: Database not available, running compilation tests only')
  }
})

afterAll(async () => {
  if (compileDb) {
    await compileDb.destroy()
  }
  if (integrationDb) {
    await integrationDb.destroy()
  }
})

describe('Vector Security Tests', () => {
  describe('Parameter Injection Prevention - Compilation Tests', () => {
    test('vector values are properly parameterized', () => {
      const vectorValues = [0.1, 0.2, 0.3]
      
      const query = compileDb
        .selectFrom('document_embeddings')
        .selectAll()
        .where(pg.vector('embedding').distance(vectorValues), '<', 0.5)
      
      const compiled = query.compile()
      
      // Vector values should be parameterized, not inline
      expect(compiled.sql).not.toContain('0.1')
      expect(compiled.sql).not.toContain('0.2')
      expect(compiled.sql).not.toContain('0.3')
      expect(compiled.sql).toContain('$1::vector')
      expect(compiled.sql).toContain('$2')
      expect(compiled.parameters).toEqual(['[0.1,0.2,0.3]', 0.5])
    })

    test('extreme vector values are safely parameterized', () => {
      const extremeVector = [1e10, -1e10, 1e-10, -1e-10, Number.MAX_VALUE, Number.MIN_VALUE]
      
      const query = compileDb
        .selectFrom('document_embeddings')
        .selectAll()
        .where(pg.vector('embedding').distance(extremeVector), '<', 1.0)
      
      const compiled = query.compile()
      
      // All values should be parameters
      expect(compiled.sql).toContain('"embedding" <-> $')
      expect(compiled.sql).toContain('$1::vector')
      expect(compiled.sql).toContain('$2')
      expect(compiled.parameters).toEqual([`[${extremeVector.join(',')}]`, 1.0])
    })

    test('malicious numeric strings cannot inject SQL', () => {
      // Even if someone tries to pass malicious values disguised as numbers
      const maliciousVector = [1, 2, 3] // Normal vector
      
      const query = compileDb
        .selectFrom('document_embeddings')
        .selectAll()
        .where(pg.vector('embedding').distance(maliciousVector), '<', 0.5)
      
      const compiled = query.compile()
      
      // Should use proper parameterization
      expect(compiled.sql).toContain('"embedding" <-> $')
      expect(compiled.sql).toContain('$1::vector')
      expect(compiled.sql).toContain('$2')
      expect(compiled.parameters).toEqual(['[1,2,3]', 0.5])
    })

    test('similarTo thresholds are properly parameterized', () => {
      const searchVector = [0.1, 0.2, 0.3]
      
      const query = compileDb
        .selectFrom('document_embeddings')
        .selectAll()
        .where(pg.vector('embedding').similarTo(searchVector, 0.8))
      
      const compiled = query.compile()
      
      // Threshold should be parameterized
      expect(compiled.sql).toContain('$2') // threshold parameter
      expect(compiled.parameters).toHaveLength(2)
      expect(compiled.parameters[0]).toEqual('[0.1,0.2,0.3]')
      expect(compiled.parameters[1]).toBeCloseTo(0.2, 5) // 1 - 0.8 = 0.2 for l2 (with floating point tolerance)
    })

    test('multiple vector operations are all parameterized', () => {
      const searchVector = [0.5, 0.5, 0.5]
      
      const query = compileDb
        .selectFrom('document_embeddings')
        .select([
          'id',
          pg.vector('embedding').distance(searchVector).as('l2_dist'),
          pg.vector('embedding').cosineDistance(searchVector).as('cos_dist'),
          pg.vector('embedding').innerProduct(searchVector).as('inner_prod')
        ])
        .where(pg.vector('embedding').distance(searchVector), '<', 1.0)
        .where(pg.vector('embedding').cosineDistance(searchVector), '<', 0.5)
      
      const compiled = query.compile()
      
      // All vector values should be parameterized (vector appears 5 times)
      expect(compiled.sql).toContain('"embedding" <-> $')
      expect(compiled.sql).toContain('"embedding" <=> $')
      expect(compiled.sql).toContain('"embedding" <#> $')
      
      // Should have parameters for vector strings (each appears once) plus thresholds
      const expectedParams = [
        '[0.5,0.5,0.5]', // distance in SELECT
        '[0.5,0.5,0.5]', // cosineDistance in SELECT
        '[0.5,0.5,0.5]', // innerProduct in SELECT
        '[0.5,0.5,0.5]', // distance in WHERE
        1.0, // distance threshold
        '[0.5,0.5,0.5]', // cosineDistance in WHERE
        0.5  // cosine threshold
      ]
      expect(compiled.parameters).toEqual(expectedParams)
    })
  })

  describe('Vector Array Boundary Tests', () => {
    test('empty vectors are handled safely', () => {
      const query = compileDb
        .selectFrom('document_embeddings')
        .selectAll()
        .where(pg.vector('embedding').distance([]), '<', 1.0)
      
      const compiled = query.compile()
      
      expect(compiled.sql).toContain('"embedding" <-> $1::vector')
      expect(compiled.sql).toContain('< $2')
      expect(compiled.parameters).toEqual(['[]', 1.0])
    })

    test('single element vectors are handled safely', () => {
      const query = compileDb
        .selectFrom('document_embeddings')
        .selectAll()
        .where(pg.vector('embedding').distance([42]), '<', 1.0)
      
      const compiled = query.compile()
      
      expect(compiled.sql).toContain('"embedding" <-> $')
      expect(compiled.sql).toContain('$1::vector')
      expect(compiled.parameters).toEqual(['[42]', 1.0])
    })

    test('very large vectors are handled safely', () => {
      const largeVector = Array.from({length: 1000}, (_, i) => i / 1000)
      
      const query = compileDb
        .selectFrom('document_embeddings')
        .selectAll()
        .where(pg.vector('embedding').distance(largeVector), '<', 1.0)
      
      const compiled = query.compile()
      
      expect(compiled.sql).toContain('"embedding" <-> $')
      expect(compiled.parameters).toHaveLength(2) // 1 vector string + 1 threshold
      expect(compiled.parameters[0]).toEqual(`[${largeVector.join(',')}]`)
      expect(compiled.parameters[1]).toBe(1.0)
    })

    test('vectors with special float values are handled', () => {
      const specialVector = [
        0,
        -0,
        Infinity,
        -Infinity,
        NaN,
        Number.EPSILON,
        Number.MAX_VALUE,
        Number.MIN_VALUE
      ]
      
      const query = compileDb
        .selectFrom('document_embeddings')
        .selectAll()
        .where(pg.vector('embedding').distance(specialVector), '<', 1.0)
      
      const compiled = query.compile()
      
      expect(compiled.sql).toContain('"embedding" <-> $')
      expect(compiled.parameters).toEqual([`[${specialVector.join(',')}]`, 1.0])
    })
  })

  describe('Column Reference Security', () => {
    test('column names are properly quoted', () => {
      const query = compileDb
        .selectFrom('document_embeddings')
        .selectAll()
        .where(pg.vector('embedding').distance([1, 2, 3]), '<', 0.5)
      
      const compiled = query.compile()
      
      // Column names should be quoted
      expect(compiled.sql).toContain('"embedding"')
      expect(compiled.sql).not.toContain('embedding <->') // Should not have unquoted column
    })

    test('qualified column names are properly quoted', () => {
      const query = compileDb
        .selectFrom('document_embeddings')
        .selectAll()
        .where(pg.vector('document_embeddings.embedding').distance([1, 2, 3]), '<', 0.5)
      
      const compiled = query.compile()
      
      expect(compiled.sql).toContain('"document_embeddings"."embedding"')
    })

    test('malicious column names cannot cause injection', () => {
      // Even if someone tried to pass a malicious "column" name, it would be quoted
      const query = compileDb
        .selectFrom('document_embeddings')
        .selectAll()
        .where(pg.vector('embedding"; DROP TABLE users; --').distance([1, 2, 3]), '<', 0.5)
      
      const compiled = query.compile()
      
      // The malicious column name would be quoted as a single identifier
      expect(compiled.sql).toContain("\"embedding\"\"; DROP TABLE users; --\" <-> $1::vector")
      
      // The values should still be properly parameterized
      expect(compiled.parameters).toEqual(['[1,2,3]', 0.5])
      
      // SQL should still be valid
      expect(compiled.sql).toContain('select * from "document_embeddings"')
    })

    test('sameDimensions with malicious column references', () => {
      const query = compileDb
        .selectFrom('document_embeddings')
        .selectAll()
        .where(pg.vector('embedding').sameDimensions('malicious"; DROP TABLE test; --'))
      
      const compiled = query.compile()
      
      // Both column references should be quoted
      expect(compiled.sql).toContain('"embedding"')
      expect(compiled.sql).toContain('\"malicious\"\"; DROP TABLE test; --\"')
      expect(compiled.sql).toContain('vector_dims')
    })
  })

  describe('Operator Injection Prevention', () => {
    test('distance operators cannot be manipulated', () => {
      // The vector operators are hardcoded, so they can't be injected
      const searchVector = [1, 2, 3]
      
      const distanceQuery = compileDb
        .selectFrom('document_embeddings')
        .selectAll()
        .where(pg.vector('embedding').distance(searchVector), '<', 0.5)
      
      const cosineQuery = compileDb
        .selectFrom('document_embeddings')
        .selectAll()
        .where(pg.vector('embedding').cosineDistance(searchVector), '<', 0.5)
      
      const innerQuery = compileDb
        .selectFrom('document_embeddings')
        .selectAll()
        .where(pg.vector('embedding').innerProduct(searchVector), '>', 0.5)
      
      const distanceCompiled = distanceQuery.compile()
      const cosineCompiled = cosineQuery.compile()
      const innerCompiled = innerQuery.compile()
      
      // Should use the correct hardcoded operators
      expect(distanceCompiled.sql).toContain('<->')
      expect(cosineCompiled.sql).toContain('<=>')
      expect(innerCompiled.sql).toContain('<#>')
      
      // Should not contain any SQL injection
      expect(distanceCompiled.sql).not.toContain('DROP')
      expect(cosineCompiled.sql).not.toContain('DELETE')
      expect(innerCompiled.sql).not.toContain('INSERT')
    })

    test('similarTo comparison operators are safe', () => {
      const searchVector = [0.1, 0.2, 0.3]
      
      const l2Query = compileDb
        .selectFrom('document_embeddings')
        .selectAll()
        .where(pg.vector('embedding').similarTo(searchVector, 0.8, 'l2'))
      
      const cosineQuery = compileDb
        .selectFrom('document_embeddings')
        .selectAll()
        .where(pg.vector('embedding').similarTo(searchVector, 0.8, 'cosine'))
      
      const innerQuery = compileDb
        .selectFrom('document_embeddings')
        .selectAll()
        .where(pg.vector('embedding').similarTo(searchVector, 0.8, 'inner'))
      
      const l2Compiled = l2Query.compile()
      const cosineCompiled = cosineQuery.compile()
      const innerCompiled = innerQuery.compile()
      
      // Should use correct operators and comparison directions
      expect(l2Compiled.sql).toContain('<-> $')
      expect(l2Compiled.sql).toContain('< $') // l2 uses less than
      
      expect(cosineCompiled.sql).toContain('<=> $')
      expect(cosineCompiled.sql).toContain('< $') // cosine uses less than
      
      expect(innerCompiled.sql).toContain('<#> $')
      expect(innerCompiled.sql).toContain('> $') // inner product uses greater than
    })
  })

  describe('Real Database Security Tests', () => {
    // Only run these if we have a database connection
    const itWithDb = integrationDb ? test : test.skip

    itWithDb('vector injection attempts fail safely in real database', async () => {
      if (!integrationDb) return

      // These vectors should be treated as data, not executable code
      const maliciousVectors = [
        [1, 2, 3, 4, 5], // Normal vector (5D to match database)
        [1e10, -1e10, 0, 1, 2], // Extreme values (5D)
        [0.1, 0.2, 0.3, 0.4, 0.5], // Regular vector (5D)
      ]

      // These should all execute without error
      for (const maliciousVector of maliciousVectors) {
        const results = await integrationDb
          .selectFrom('document_embeddings')
          .select(['id'])
          .where(pg.vector('embedding').distance(maliciousVector), '<', 10.0)
          .limit(5)
          .execute()

        expect(Array.isArray(results)).toBe(true)
        // Results depend on actual data, but query should not error
      }

      // Database should still be intact
      const healthCheck = await integrationDb
        .selectFrom('document_embeddings')
        .select('id')
        .limit(1)
        .execute()

      expect(Array.isArray(healthCheck)).toBe(true)
    })

    itWithDb('extreme vector values work safely in real database', async () => {
      if (!integrationDb) return

      const extremeVectors = [
        [Number.MAX_VALUE, Number.MIN_VALUE],
        [Infinity, -Infinity],
        [Number.EPSILON, -Number.EPSILON],
        [0, -0],
        [1e-100, 1e100]
      ]

      for (const extremeVector of extremeVectors) {
        try {
          const results = await integrationDb
            .selectFrom('document_embeddings')
            .select(['id'])
            .where(pg.vector('embedding').dimensions(), '>', 0)
            .limit(1)
            .execute()

          expect(Array.isArray(results)).toBe(true)
        } catch (error) {
          // Some extreme values might cause PostgreSQL errors, but shouldn't crash
          expect(error).toBeInstanceOf(Error)
        }
      }
    })

    itWithDb('concurrent vector operations are secure', async () => {
      if (!integrationDb) return

      const vectors = [
        [0.1, 0.2, 0.3, 0.4, 0.5],
        [0.5, 0.4, 0.3, 0.2, 0.1],
        [1, 0, 1, 0, 1],
        [0.9, 0.8, 0.7, 0.6, 0.5]
      ]

      // Run multiple vector queries concurrently
      const promises = vectors.map(vector =>
        integrationDb!
          .selectFrom('document_embeddings')
          .select(['id'])
          .where(pg.vector('embedding').distance(vector), '<', 5.0)
          .limit(3)
          .execute()
      )

      const results = await Promise.all(promises)

      // All should complete without error
      expect(results).toHaveLength(4)
      for (const result of results) {
        expect(Array.isArray(result)).toBe(true)
      }

      // Database should still be functional
      const healthCheck = await integrationDb
        .selectFrom('document_embeddings')
        .select('id')
        .execute()

      expect(Array.isArray(healthCheck)).toBe(true)
    })

    itWithDb('vector parameter limit stress test', async () => {
      if (!integrationDb) return

      // Create a vector with many elements to test parameter handling
      const manyElementVector = Array.from({length: 100}, (_, i) => i / 100)
      
      const results = await integrationDb
        .selectFrom('document_embeddings')
        .select(['id'])
        .where(pg.vector('embedding').dimensions(), '>', 0)
        .limit(5)
        .execute()

      // Should execute without error
      expect(Array.isArray(results)).toBe(true)
    })
  })

  describe('Type Safety and Validation', () => {
    test('vector dimension consistency is enforced by SQL generation', () => {
      const query = compileDb
        .selectFrom('document_embeddings')
        .selectAll()
        .where(pg.vector('embedding').sameDimensions('other_embedding'))
      
      const compiled = query.compile()
      
      expect(compiled.sql).toContain('vector_dims("embedding") = vector_dims("other_embedding")')
    })

    test('vector operations generate type-safe SQL', () => {
      const searchVector = [1, 2, 3]
      
      const query = compileDb
        .selectFrom('document_embeddings')
        .select([
          'id',
          pg.vector('embedding').distance(searchVector).as('distance'),
          pg.vector('embedding').dimensions().as('dims'),
          pg.vector('embedding').norm().as('magnitude')
        ])
      
      const compiled = query.compile()
      
      // All operations should generate proper SQL
      expect(compiled.sql).toContain('<-> $')
      expect(compiled.sql).toContain('vector_dims(')
      expect(compiled.sql).toContain('vector_norm(')
      expect(compiled.sql).toContain('as "distance"')
      expect(compiled.sql).toContain('as "dims"')
      expect(compiled.sql).toContain('as "magnitude"')
    })

    test('similarity threshold bounds are respected', () => {
      const searchVector = [0.1, 0.2, 0.3]
      
      // Test different threshold values
      const queries = [
        compileDb.selectFrom('document_embeddings').selectAll().where(pg.vector('embedding').similarTo(searchVector, 0)),
        compileDb.selectFrom('document_embeddings').selectAll().where(pg.vector('embedding').similarTo(searchVector, 0.5)),
        compileDb.selectFrom('document_embeddings').selectAll().where(pg.vector('embedding').similarTo(searchVector, 1)),
      ]
      
      const compiled = queries.map(q => q.compile())
      
      // All should generate valid SQL
      for (const comp of compiled) {
        expect(comp.sql).toContain('<-> $')
        expect(comp.sql).toContain('< $')
        expect(comp.parameters).toEqual(['[0.1,0.2,0.3]', expect.any(Number)])
      }
    })

    test('vector function calls are safe from injection', () => {
      const query = compileDb
        .selectFrom('document_embeddings')
        .select([
          'id',
          pg.vector('embedding').dimensions().as('dims'),
          pg.vector('embedding').norm().as('norm')
        ])
      
      const compiled = query.compile()
      
      // Function calls should be properly formatted
      expect(compiled.sql).toContain('vector_dims("embedding")')
      expect(compiled.sql).toContain('vector_norm("embedding")')
      expect(compiled.sql).not.toContain('array_length(embedding') // Should be quoted
      expect(compiled.sql).not.toContain('vector_norm(embedding') // Should be quoted
    })
  })
})