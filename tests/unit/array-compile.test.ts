import { describe, test, expect } from 'bun:test'
import { 
  Kysely,
  DummyDriver,
  PostgresAdapter,
  PostgresQueryCompiler
} from 'kysely'
import { pg } from '../../src/index'

interface TestDB {
  products: {
    id: number
    name: string
    tags: string[]
    categories: string[]
    scores: number[]
  }
}

// Create a test dialect that can compile SQL but not execute
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

describe('Array Operations - SQL Compilation', () => {
  const db = new Kysely<TestDB>({
    dialect: new TestDialect()
  })

  describe('includes() SQL compilation', () => {
    test('generates correct PostgreSQL for single value', () => {
      const query = db
        .selectFrom('products')
        .selectAll()
        .where(pg.array('tags').includes('typescript'))
      
      const compiled = query.compile()
      
      expect(compiled.sql).toContain('"tags" @> ARRAY[')
      expect(compiled.sql).toContain('$1')
      expect(compiled.parameters).toEqual(['typescript'])
    })

    test('generates correct PostgreSQL for qualified columns', () => {
      const query = db
        .selectFrom('products')
        .selectAll()
        .where(pg.array('products.tags').includes('featured'))
      
      const compiled = query.compile()
      
      expect(compiled.sql).toContain('"products"."tags" @> ARRAY[')
      expect(compiled.parameters).toEqual(['featured'])
    })
  })

  describe('contains() SQL compilation', () => {
    test('generates correct PostgreSQL for single value', () => {
      const query = db
        .selectFrom('products')
        .selectAll()
        .where(pg.array('tags').contains('typescript'))
      
      const compiled = query.compile()
      
      expect(compiled.sql).toContain('"tags" @> ARRAY[')
      expect(compiled.parameters).toEqual(['typescript'])
    })

    test('generates correct PostgreSQL for array values', () => {
      const query = db
        .selectFrom('products')
        .selectAll()
        .where(pg.array('tags').contains(['typescript', 'javascript']))
      
      const compiled = query.compile()
      
      expect(compiled.sql).toContain('"tags" @> ARRAY[')
      expect(compiled.sql).toContain('$1')
      expect(compiled.sql).toContain('$2')
      expect(compiled.parameters).toEqual(['typescript', 'javascript'])
    })

    test('handles empty arrays', () => {
      const query = db
        .selectFrom('products')
        .selectAll()
        .where(pg.array('tags').contains([]))
      
      const compiled = query.compile()
      
      expect(compiled.sql).toContain('"tags" @> ARRAY[]')
      expect(compiled.parameters).toEqual([])
    })
  })

  describe('overlaps() SQL compilation', () => {
    test('generates correct PostgreSQL syntax', () => {
      const query = db
        .selectFrom('products')
        .selectAll()
        .where(pg.array('categories').overlaps(['tech', 'ai']))
      
      const compiled = query.compile()
      
      expect(compiled.sql).toContain('"categories" && ARRAY[')
      expect(compiled.sql).toContain('$1')
      expect(compiled.sql).toContain('$2')
      expect(compiled.parameters).toEqual(['tech', 'ai'])
    })
  })

  describe('containedBy() SQL compilation', () => {
    test('generates correct PostgreSQL syntax', () => {
      const query = db
        .selectFrom('products')
        .selectAll()
        .where(pg.array('tags').containedBy(['allowed', 'permitted', 'valid']))
      
      const compiled = query.compile()
      
      expect(compiled.sql).toContain('"tags" <@ ARRAY[')
      expect(compiled.parameters).toEqual(['allowed', 'permitted', 'valid'])
    })
  })

  describe('length() SQL compilation', () => {
    test('generates correct PostgreSQL function call', () => {
      const query = db
        .selectFrom('products')
        .selectAll()
        .where(pg.array('tags').length(), '>', 3)
      
      const compiled = query.compile()
      
      expect(compiled.sql).toContain('coalesce(array_length("tags", 1), 0) > $1')
      expect(compiled.parameters).toEqual([3])
    })

    test('works in SELECT clause', () => {
      const query = db
        .selectFrom('products')
        .select([
          'id',
          'name',
          pg.array('tags').length().as('tag_count')
        ])
      
      const compiled = query.compile()
      
      expect(compiled.sql).toContain('coalesce(array_length("tags", 1), 0) as "tag_count"')
    })
  })

  describe('any() SQL compilation', () => {
    test('generates correct PostgreSQL ANY syntax', () => {
      const query = db
        .selectFrom('products')
        .selectAll()
        .where('name', '=', pg.array('categories').any())
      
      const compiled = query.compile()
      
      expect(compiled.sql).toContain('= ANY("categories")')
    })
  })

  describe('complex query compilation', () => {
    test('multiple array operations work together', () => {
      const query = db
        .selectFrom('products')
        .select([
          'id',
          'name',
          pg.array('tags').length().as('tag_count')
        ])
        .where(pg.array('tags').includes('featured'))
        .where(pg.array('categories').overlaps(['electronics', 'gadgets']))
        .where(pg.array('tags').length(), '>', 2)
        .orderBy('name')
        .limit(20)
      
      const compiled = query.compile()
      
      // Check that all operations are present
      expect(compiled.sql).toContain('"tags" @> ARRAY[')  // includes
      expect(compiled.sql).toContain('"categories" && ARRAY[')  // overlaps
      expect(compiled.sql).toContain('coalesce(array_length("tags", 1), 0) > $')  // length
      expect(compiled.sql).toContain('order by "name"')
      expect(compiled.sql).toContain('limit $')
      
      // Check parameters
      expect(compiled.parameters).toContain('featured')
      expect(compiled.parameters).toContain('electronics')
      expect(compiled.parameters).toContain('gadgets')
      expect(compiled.parameters).toContain(2)
      expect(compiled.parameters).toContain(20)
    })

    test('array operations mixed with regular conditions', () => {
      const query = db
        .selectFrom('products')
        .selectAll()
        .where(pg.array('tags').contains(['typescript', 'postgres']))
        .where('id', '>', 100)
        .where('name', 'like', '%tutorial%')
      
      const compiled = query.compile()
      
      expect(compiled.sql).toContain('"tags" @> ARRAY[')
      expect(compiled.sql).toContain('"id" > $')
      expect(compiled.sql).toContain('"name" like $')
      
      expect(compiled.parameters).toContain('typescript')
      expect(compiled.parameters).toContain('postgres')
      expect(compiled.parameters).toContain(100)
      expect(compiled.parameters).toContain('%tutorial%')
    })
  })

  describe('SQL injection safety', () => {
    test('parameters are properly escaped', () => {
      const maliciousInput = "'; DROP TABLE products; --"
      
      const query = db
        .selectFrom('products')
        .selectAll()
        .where(pg.array('tags').includes(maliciousInput))
      
      const compiled = query.compile()
      
      // The malicious input should be parameterized, not directly in SQL
      expect(compiled.sql).not.toContain('DROP TABLE')
      expect(compiled.sql).toContain('$1')
      expect(compiled.parameters).toEqual([maliciousInput])
    })

    test('multiple suspicious values are parameterized', () => {
      const suspiciousValues = [
        "'; DELETE FROM products; --",
        "' OR 1=1; --",
        "'; SELECT * FROM users; --"
      ]
      
      const query = db
        .selectFrom('products')
        .selectAll()
        .where(pg.array('tags').overlaps(suspiciousValues))
      
      const compiled = query.compile()
      
      // None of the SQL injection attempts should appear in the compiled SQL
      expect(compiled.sql).not.toContain('DELETE FROM')
      expect(compiled.sql).not.toContain('OR 1=1')
      expect(compiled.sql).not.toContain('SELECT * FROM users')
      
      // All values should be parameters
      expect(compiled.parameters).toEqual(suspiciousValues)
    })
  })
})