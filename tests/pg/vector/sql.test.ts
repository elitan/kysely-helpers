import { describe, test, expect } from 'bun:test'
import { 
  Kysely,
  DummyDriver,
  PostgresAdapter,
  PostgresQueryCompiler
} from 'kysely'
import { pg } from '../../../src/index'

interface TestDB {
  documents: {
    id: number
    title: string
    content: string
    embedding: number[]
    content_embedding: number[]
  }
  search_queries: {
    id: number
    query: string
    embedding: number[]
  }
}

// Test dialect for SQL compilation without execution
class TestDialect {
  createAdapter() {
    return new PostgresAdapter()
  }
  
  createDriver() {
    return new DummyDriver()
  }
  
  createQueryCompiler() {
    return new PostgresQueryCompiler()
  }
  
  createIntrospector() {
    return {
      getSchemas: () => Promise.resolve([]),
      getTables: () => Promise.resolve([]),
      getMetadata: () => Promise.resolve({ tables: [] })
    } as any
  }
}

describe('Vector SQL Generation', () => {
  const db = new Kysely<TestDB>({
    dialect: new TestDialect()
  })

  describe('distance() SQL compilation', () => {
    test('generates correct <-> operator for L2 distance', () => {
      const searchVector = [0.1, 0.2, 0.3]
      const query = db
        .selectFrom('documents')
        .selectAll()
        .where(pg.vector('embedding').distance(searchVector), '<', 0.5)
      
      const compiled = query.compile()
      
      expect(compiled.sql).toContain("\"embedding\" <-> $")
      expect(compiled.sql).toContain('$1::vector')
      expect(compiled.sql).toContain('< $2')
      expect(compiled.parameters).toEqual(['[0.1,0.2,0.3]', 0.5])
    })

    test('works in ORDER BY clause', () => {
      const searchVector = [1, 2, 3]
      const query = db
        .selectFrom('documents')
        .selectAll()
        .orderBy(pg.vector('embedding').distance(searchVector))
      
      const compiled = query.compile()
      
      expect(compiled.sql).toContain('order by "embedding" <-> $1::vector')
      expect(compiled.parameters).toEqual(['[1,2,3]'])
    })

    test('works in SELECT clause with alias', () => {
      const searchVector = [0.5, 0.5]
      const query = db
        .selectFrom('documents')
        .select([
          'id',
          'title',
          pg.vector('embedding').distance(searchVector).as('similarity_score')
        ])
      
      const compiled = query.compile()
      
      expect(compiled.sql).toContain("\"embedding\" <-> $")
      expect(compiled.sql).toContain('as "similarity_score"')
      expect(compiled.parameters).toEqual(['[0.5,0.5]'])
    })

    test('handles empty vectors', () => {
      const query = db
        .selectFrom('documents')
        .selectAll()
        .orderBy(pg.vector('embedding').distance([]))
      
      const compiled = query.compile()
      
      expect(compiled.sql).toContain("\"embedding\" <-> $1::vector")
      expect(compiled.parameters).toEqual(['[]'])
    })

    test('handles single dimension vectors', () => {
      const query = db
        .selectFrom('documents')
        .selectAll()
        .orderBy(pg.vector('embedding').distance([42]))
      
      const compiled = query.compile()
      
      expect(compiled.sql).toContain("\"embedding\" <-> $")
      expect(compiled.parameters).toEqual(['[42]'])
    })
  })

  describe('l2Distance() SQL compilation', () => {
    test('generates same SQL as distance()', () => {
      const searchVector = [0.1, 0.2, 0.3]
      
      const distanceQuery = db
        .selectFrom('documents')
        .selectAll()
        .where(pg.vector('embedding').distance(searchVector), '<', 0.5)
      
      const l2Query = db
        .selectFrom('documents')
        .selectAll()
        .where(pg.vector('embedding').l2Distance(searchVector), '<', 0.5)
      
      const distanceCompiled = distanceQuery.compile()
      const l2Compiled = l2Query.compile()
      
      // Should generate identical SQL since they're the same operation
      expect(distanceCompiled.sql).toBe(l2Compiled.sql)
      expect(distanceCompiled.parameters).toEqual(l2Compiled.parameters)
    })

    test('works with negative values', () => {
      const searchVector = [-1, -0.5, 0, 0.5, 1]
      const query = db
        .selectFrom('documents')
        .selectAll()
        .orderBy(pg.vector('embedding').l2Distance(searchVector))
      
      const compiled = query.compile()
      
      expect(compiled.sql).toContain("\"embedding\" <-> $")
      expect(compiled.parameters).toEqual(['[-1,-0.5,0,0.5,1]'])
    })
  })

  describe('innerProduct() SQL compilation', () => {
    test('generates correct <#> operator', () => {
      const searchVector = [0.7, 0.8, 0.9]
      const query = db
        .selectFrom('documents')
        .selectAll()
        .where(pg.vector('embedding').innerProduct(searchVector), '>', 0.8)
      
      const compiled = query.compile()
      
      expect(compiled.sql).toContain("\"embedding\" <#> $")
      expect(compiled.sql).toContain('> $2')
      expect(compiled.parameters).toEqual(['[0.7,0.8,0.9]', 0.8])
    })

    test('works in ORDER BY descending for similarity ranking', () => {
      const searchVector = [1, 0, -1]
      const query = db
        .selectFrom('documents')
        .selectAll()
        .orderBy(pg.vector('embedding').innerProduct(searchVector), 'desc')
      
      const compiled = query.compile()
      
      expect(compiled.sql).toContain('order by "embedding" <#> $1::vector')
      expect(compiled.sql).toContain('desc')
      expect(compiled.parameters).toEqual(['[1,0,-1]'])
    })

    test('works in SELECT clause', () => {
      const searchVector = [0.2, 0.4, 0.6]
      const query = db
        .selectFrom('documents')
        .select([
          'id',
          pg.vector('embedding').innerProduct(searchVector).as('inner_product_score')
        ])
      
      const compiled = query.compile()
      
      expect(compiled.sql).toContain("\"embedding\" <#> $")
      expect(compiled.sql).toContain('as "inner_product_score"')
      expect(compiled.parameters).toEqual(['[0.2,0.4,0.6]'])
    })
  })

  describe('cosineDistance() SQL compilation', () => {
    test('generates correct <=> operator', () => {
      const searchVector = [0.3, 0.6, 0.9]
      const query = db
        .selectFrom('documents')
        .selectAll()
        .where(pg.vector('embedding').cosineDistance(searchVector), '<', 0.2)
      
      const compiled = query.compile()
      
      expect(compiled.sql).toContain("\"embedding\" <=> $")
      expect(compiled.sql).toContain('< $2')
      expect(compiled.parameters).toEqual(['[0.3,0.6,0.9]', 0.2])
    })

    test('works in ORDER BY for similarity ranking', () => {
      const searchVector = [1, 1, 1]
      const query = db
        .selectFrom('documents')
        .selectAll()
        .orderBy(pg.vector('embedding').cosineDistance(searchVector))
      
      const compiled = query.compile()
      
      expect(compiled.sql).toContain('order by "embedding" <=> $1::vector')
      expect(compiled.parameters).toEqual(['[1,1,1]'])
    })

    test('handles normalized vectors', () => {
      // Typical normalized embedding vector
      const normalizedVector = [0.577, 0.577, 0.577] // roughly [1,1,1] normalized
      const query = db
        .selectFrom('documents')
        .select([
          'id',
          pg.vector('embedding').cosineDistance(normalizedVector).as('cosine_distance')
        ])
      
      const compiled = query.compile()
      
      expect(compiled.sql).toContain("\"embedding\" <=> $")
      expect(compiled.parameters).toEqual(['[0.577,0.577,0.577]'])
    })
  })

  describe('similarTo() SQL compilation', () => {
    test('generates correct SQL with default parameters (l2, 0.5 threshold)', () => {
      const searchVector = [0.1, 0.2, 0.3]
      const query = db
        .selectFrom('documents')
        .selectAll()
        .where(pg.vector('embedding').similarTo(searchVector))
      
      const compiled = query.compile()
      
      expect(compiled.sql).toContain("\"embedding\" <-> $")
      expect(compiled.sql).toContain('< $2') // l2 distance should be less than threshold
      expect(compiled.parameters).toEqual(['[0.1,0.2,0.3]', 0.5]) // 1 - 0.5 = 0.5 for l2
    })

    test('generates correct SQL with custom threshold', () => {
      const searchVector = [0.5, 0.5, 0.5]
      const query = db
        .selectFrom('documents')
        .selectAll()
        .where(pg.vector('embedding').similarTo(searchVector, 0.8))
      
      const compiled = query.compile()
      
      expect(compiled.sql).toContain("\"embedding\" <-> $")
      expect(compiled.sql).toContain('< $2')
      expect(compiled.parameters).toHaveLength(2)
      expect(compiled.parameters[0]).toEqual('[0.5,0.5,0.5]')
      expect(compiled.parameters[1]).toBeCloseTo(0.2, 5) // 1 - 0.8 = 0.2 for l2
    })

    test('generates correct SQL with cosine method', () => {
      const searchVector = [1, 0, 0]
      const query = db
        .selectFrom('documents')
        .selectAll()
        .where(pg.vector('embedding').similarTo(searchVector, 0.9, 'cosine'))
      
      const compiled = query.compile()
      
      expect(compiled.sql).toContain("\"embedding\" <=> $")
      expect(compiled.sql).toContain('< $2')
      expect(compiled.parameters).toHaveLength(2)
      expect(compiled.parameters[0]).toEqual('[1,0,0]')
      expect(compiled.parameters[1]).toBeCloseTo(0.1, 5) // 1 - 0.9 = 0.1 for cosine
    })

    test('generates correct SQL with inner product method', () => {
      const searchVector = [0.7, 0.8, 0.9]
      const query = db
        .selectFrom('documents')
        .selectAll()
        .where(pg.vector('embedding').similarTo(searchVector, 0.8, 'inner'))
      
      const compiled = query.compile()
      
      expect(compiled.sql).toContain("\"embedding\" <#> $")
      expect(compiled.sql).toContain('> $2') // inner product should be greater than threshold
      expect(compiled.parameters).toEqual(['[0.7,0.8,0.9]', 0.8]) // threshold used directly for inner product
    })

    test('handles edge case thresholds', () => {
      const searchVector = [1, 2, 3]
      
      // Very high similarity threshold
      const highQuery = db
        .selectFrom('documents')
        .selectAll()
        .where(pg.vector('embedding').similarTo(searchVector, 0.99))
      
      const highCompiled = highQuery.compile()
      expect(highCompiled.parameters).toHaveLength(2)
      expect(highCompiled.parameters[0]).toEqual('[1,2,3]')
      expect(highCompiled.parameters[1]).toBeCloseTo(0.01, 5) // 1 - 0.99
      
      // Very low similarity threshold
      const lowQuery = db
        .selectFrom('documents')
        .selectAll()
        .where(pg.vector('embedding').similarTo(searchVector, 0.1))
      
      const lowCompiled = lowQuery.compile()
      expect(lowCompiled.parameters).toEqual(['[1,2,3]', 0.9]) // 1 - 0.1
    })
  })

  describe('dimensions() SQL compilation', () => {
    test('generates correct vector_dims function call', () => {
      const query = db
        .selectFrom('documents')
        .select([
          'id',
          pg.vector('embedding').dimensions().as('embedding_dims')
        ])
      
      const compiled = query.compile()
      
      expect(compiled.sql).toContain('vector_dims("embedding")')
      expect(compiled.sql).toContain('as "embedding_dims"')
      expect(compiled.parameters).toEqual([])
    })

    test('works in WHERE clause for dimension filtering', () => {
      const query = db
        .selectFrom('documents')
        .selectAll()
        .where(pg.vector('embedding').dimensions(), '=', 512)
      
      const compiled = query.compile()
      
      expect(compiled.sql).toContain('vector_dims("embedding") = $1')
      expect(compiled.parameters).toEqual([512])
    })

    test('works with qualified column names', () => {
      const query = db
        .selectFrom('documents')
        .select([
          'id',
          pg.vector('documents.embedding').dimensions().as('dims')
        ])
      
      const compiled = query.compile()
      
      expect(compiled.sql).toContain('vector_dims("documents"."embedding")')
    })
  })

  describe('norm() SQL compilation', () => {
    test('generates correct vector_norm function call', () => {
      const query = db
        .selectFrom('documents')
        .select([
          'id',
          pg.vector('embedding').norm().as('embedding_magnitude')
        ])
      
      const compiled = query.compile()
      
      expect(compiled.sql).toContain('vector_norm("embedding")')
      expect(compiled.sql).toContain('as "embedding_magnitude"')
      expect(compiled.parameters).toEqual([])
    })

    test('works in WHERE clause for magnitude filtering', () => {
      const query = db
        .selectFrom('documents')
        .selectAll()
        .where(pg.vector('embedding').norm(), '>', 1.0)
      
      const compiled = query.compile()
      
      expect(compiled.sql).toContain('vector_norm("embedding") > $1')
      expect(compiled.parameters).toEqual([1.0])
    })

    test('works in ORDER BY for sorting by magnitude', () => {
      const query = db
        .selectFrom('documents')
        .selectAll()
        .orderBy(pg.vector('embedding').norm(), 'desc')
      
      const compiled = query.compile()
      
      expect(compiled.sql).toContain('order by vector_norm("embedding") desc')
    })
  })

  describe('sameDimensions() SQL compilation', () => {
    test('generates correct array_length comparison with string column', () => {
      const query = db
        .selectFrom('documents')
        .selectAll()
        .where(pg.vector('embedding').sameDimensions('content_embedding'))
      
      const compiled = query.compile()
      
      expect(compiled.sql).toContain('vector_dims("embedding") = vector_dims("content_embedding")')
      expect(compiled.parameters).toEqual([])
    })

    test('works with qualified column names', () => {
      const query = db
        .selectFrom('documents')
        .selectAll()
        .where(pg.vector('documents.embedding').sameDimensions('documents.content_embedding'))
      
      const compiled = query.compile()
      
      expect(compiled.sql).toContain('vector_dims("documents"."embedding") = vector_dims("documents"."content_embedding")')
    })

    test('works with aliased tables', () => {
      const query = db
        .selectFrom('documents as d')
        .selectAll()
        .where(pg.vector('d.embedding').sameDimensions('d.content_embedding'))
      
      const compiled = query.compile()
      
      expect(compiled.sql).toContain('vector_dims("d"."embedding") = vector_dims("d"."content_embedding")')
    })
  })

  describe('Complex queries with multiple vector operations', () => {
    test('multiple vector operations work together', () => {
      const searchVector = [0.1, 0.2, 0.3, 0.4, 0.5]
      const query = db
        .selectFrom('documents')
        .select([
          'id',
          'title',
          pg.vector('embedding').distance(searchVector).as('l2_distance'),
          pg.vector('embedding').cosineDistance(searchVector).as('cosine_distance'),
          pg.vector('embedding').innerProduct(searchVector).as('inner_product'),
          pg.vector('embedding').dimensions().as('dims')
        ])
        .where(pg.vector('embedding').similarTo(searchVector, 0.8, 'cosine'))
        .where(pg.vector('embedding').dimensions(), '=', 5)
        .orderBy(pg.vector('embedding').cosineDistance(searchVector))
        .limit(10)
      
      const compiled = query.compile()
      
      // Check that all operations are present
      expect(compiled.sql).toContain("\"embedding\" <-> $")  // distance
      expect(compiled.sql).toContain("\"embedding\" <=> $")  // cosineDistance
      expect(compiled.sql).toContain("\"embedding\" <#> $")  // innerProduct
      expect(compiled.sql).toContain('vector_dims("embedding")')  // dimensions
      expect(compiled.sql).toContain('limit $')
      
      // Check parameters include vector strings and other params
      expect(compiled.parameters).toContain('[0.1,0.2,0.3,0.4,0.5]')
      expect(compiled.parameters).toContain(5)
      expect(compiled.parameters).toContain(10)
    })

    test('vector operations mixed with regular conditions', () => {
      const searchVector = [1, 0, 1]
      const query = db
        .selectFrom('documents')
        .selectAll()
        .where('id', '>', 100)
        .where('title', 'like', '%AI%')
        .where(pg.vector('embedding').similarTo(searchVector, 0.85))
        .where(pg.vector('embedding').sameDimensions('content_embedding'))
      
      const compiled = query.compile()
      
      expect(compiled.sql).toContain('"id" > $')
      expect(compiled.sql).toContain('"title" like $')
      expect(compiled.sql).toContain("\"embedding\" <-> $")
      expect(compiled.sql).toContain('vector_dims("embedding") = vector_dims("content_embedding")')
      
      expect(compiled.parameters).toContain(100)
      expect(compiled.parameters).toContain('%AI%')
      expect(compiled.parameters).toContain('[1,0,1]')
    })

    test('subqueries with vector operations', () => {
      const searchVector = [0.5, 0.5, 0.5]
      
      const subquery = db
        .selectFrom('search_queries')
        .select('id')
        .where(pg.vector('embedding').similarTo(searchVector, 0.9))
      
      const query = db
        .selectFrom('documents')
        .selectAll()
        .where('id', 'in', subquery)
        .where(pg.vector('embedding').distance(searchVector), '<', 0.3)
      
      const compiled = query.compile()
      
      expect(compiled.sql).toContain("\"embedding\" <-> $")
      expect(compiled.sql).toContain('in (')
      expect(compiled.parameters).toContain('[0.5,0.5,0.5]')
    })

    test('JOIN queries with vector operations', () => {
      const searchVector = [0.2, 0.4, 0.6]
      const query = db
        .selectFrom('documents')
        .innerJoin('search_queries', 'documents.id', 'search_queries.id')
        .select([
          'documents.id',
          'documents.title',
          'search_queries.query',
          pg.vector('documents.embedding').distance(searchVector).as('doc_similarity'),
          pg.vector('search_queries.embedding').distance(searchVector).as('query_similarity')
        ])
        .where(pg.vector('documents.embedding').similarTo(searchVector, 0.8))
        .orderBy('doc_similarity')
      
      const compiled = query.compile()
      
      expect(compiled.sql).toContain('"documents"."embedding" <-> $')
      expect(compiled.sql).toContain('"search_queries"."embedding" <-> $')
      expect(compiled.sql).toContain('inner join')
      expect(compiled.sql).toContain('order by "doc_similarity"')
    })
  })

  describe('Column reference handling', () => {
    test('simple column names are quoted correctly', () => {
      const query = db
        .selectFrom('documents')
        .selectAll()
        .orderBy(pg.vector('embedding').distance([1, 2, 3]))
      
      const compiled = query.compile()
      
      expect(compiled.sql).toContain('"embedding"')
    })

    test('qualified column names are quoted correctly', () => {
      const query = db
        .selectFrom('documents')
        .selectAll()
        .orderBy(pg.vector('documents.embedding').distance([1, 2, 3]))
      
      const compiled = query.compile()
      
      expect(compiled.sql).toContain('"documents"."embedding"')
    })

    test('aliased column names are quoted correctly', () => {
      const query = db
        .selectFrom('documents as d')
        .selectAll()
        .orderBy(pg.vector('d.embedding').distance([1, 2, 3]))
      
      const compiled = query.compile()
      
      expect(compiled.sql).toContain('"d"."embedding"')
    })
  })

  describe('Vector array parameter handling', () => {
    test('vector values are properly parameterized', () => {
      const searchVector = [0.123, 0.456, 0.789]
      const query = db
        .selectFrom('documents')
        .selectAll()
        .where(pg.vector('embedding').distance(searchVector), '<', 0.5)
      
      const compiled = query.compile()
      
      // Should use parameter placeholders, not inline values
      expect(compiled.sql).not.toContain('0.123')
      expect(compiled.sql).not.toContain('0.456')
      expect(compiled.sql).not.toContain('0.789')
      expect(compiled.sql).toContain('$1::vector')
      expect(compiled.sql).toContain('$2')
      expect(compiled.parameters).toEqual(['[0.123,0.456,0.789]', 0.5])
    })

    test('large vectors create appropriate parameters', () => {
      const largeVector = Array.from({length: 100}, (_, i) => i / 100)
      const query = db
        .selectFrom('documents')
        .selectAll()
        .orderBy(pg.vector('embedding').distance(largeVector))
      
      const compiled = query.compile()
      
      // Should have single parameter for the vector string
      expect(compiled.parameters).toHaveLength(1)
      expect(compiled.parameters[0]).toEqual(`[${largeVector.join(',')}]`)
      
      // Should contain single parameter placeholder
      expect(compiled.sql).toContain('$1::vector')
    })

    test('empty vectors create empty ARRAY[]', () => {
      const query = db
        .selectFrom('documents')
        .selectAll()
        .orderBy(pg.vector('embedding').distance([]))
      
      const compiled = query.compile()
      
      expect(compiled.sql).toContain('$1::vector')
      expect(compiled.parameters).toEqual(['[]'])
    })
  })
})