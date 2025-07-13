import { describe, test, expect } from 'bun:test'
import { 
  Kysely,
  DummyDriver,
  PostgresAdapter,
  PostgresQueryCompiler
} from 'kysely'
import { pg } from '../../../src/index'

interface TestDB {
  products: {
    id: number
    name: string
    tags: string[]
    categories: string[]
    scores: number[]
    flags: boolean[]
  }
  users: {
    id: number
    roles: string[]
    permissions: string[]
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
}

describe('Array SQL Generation', () => {
  const db = new Kysely<TestDB>({
    dialect: new TestDialect()
  })

  describe('includes() SQL compilation', () => {
    test('generates correct PostgreSQL @> operator for single value', () => {
      const query = db
        .selectFrom('products')
        .selectAll()
        .where(pg.array('tags').includes('typescript'))
      
      const compiled = query.compile()
      
      expect(compiled.sql).toContain('"tags" @> ARRAY[')
      expect(compiled.sql).toContain('::text[]')
      expect(compiled.sql).toContain('$1')
      expect(compiled.parameters).toEqual(['typescript'])
    })

    test('generates correct SQL for qualified columns', () => {
      const query = db
        .selectFrom('products')
        .selectAll()
        .where(pg.array('products.tags').includes('featured'))
      
      const compiled = query.compile()
      
      expect(compiled.sql).toContain('"products"."tags" @> ARRAY[')
      expect(compiled.parameters).toEqual(['featured'])
    })

    test('generates correct SQL for aliased columns', () => {
      const query = db
        .selectFrom('products as p')
        .selectAll()
        .where(pg.array('p.tags').includes('featured'))
      
      const compiled = query.compile()
      
      expect(compiled.sql).toContain('"p"."tags" @> ARRAY[')
      expect(compiled.parameters).toEqual(['featured'])
    })

    test('handles special characters in values', () => {
      const specialValue = "tag's with 'quotes' and \"double\""
      const query = db
        .selectFrom('products')
        .selectAll()
        .where(pg.array('tags').includes(specialValue))
      
      const compiled = query.compile()
      
      expect(compiled.sql).toContain('"tags" @> ARRAY[')
      expect(compiled.parameters).toEqual([specialValue])
    })

    test('generates correct type casting for number arrays', () => {
      const query = db
        .selectFrom('products')
        .selectAll()
        .where(pg.array<number>('scores').includes(95))
      
      const compiled = query.compile()
      
      expect(compiled.sql).toContain('"scores" @> ARRAY[')
      expect(compiled.sql).toContain('::integer[]')
      expect(compiled.parameters).toEqual([95])
    })

    test('generates correct type casting for boolean arrays', () => {
      const query = db
        .selectFrom('products')
        .selectAll()
        .where(pg.array<boolean>('flags').includes(true))
      
      const compiled = query.compile()
      
      expect(compiled.sql).toContain('"flags" @> ARRAY[')
      expect(compiled.sql).toContain('::boolean[]')
      expect(compiled.parameters).toEqual([true])
    })
  })

  describe('contains() SQL compilation', () => {
    test('generates correct PostgreSQL @> operator for single value', () => {
      const query = db
        .selectFrom('products')
        .selectAll()
        .where(pg.array('tags').contains('typescript'))
      
      const compiled = query.compile()
      
      expect(compiled.sql).toContain('"tags" @> ARRAY[')
      expect(compiled.parameters).toEqual(['typescript'])
    })

    test('generates correct PostgreSQL @> operator for multiple values', () => {
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

    test('handles empty arrays with typed array literal', () => {
      const query = db
        .selectFrom('products')
        .selectAll()
        .where(pg.array('tags').contains([]))
      
      const compiled = query.compile()
      
      expect(compiled.sql).toContain('"tags" @> ARRAY[]::text[]')
      expect(compiled.parameters).toEqual([])
    })

    test('handles single element arrays', () => {
      const query = db
        .selectFrom('products')
        .selectAll()
        .where(pg.array('tags').contains(['single']))
      
      const compiled = query.compile()
      
      expect(compiled.sql).toContain('"tags" @> ARRAY[')
      expect(compiled.parameters).toEqual(['single'])
    })

    test('handles large arrays with multiple parameters', () => {
      const largeArray = ['tag1', 'tag2', 'tag3', 'tag4', 'tag5']
      const query = db
        .selectFrom('products')
        .selectAll()
        .where(pg.array('tags').contains(largeArray))
      
      const compiled = query.compile()
      
      expect(compiled.sql).toContain('"tags" @> ARRAY[')
      largeArray.forEach((_, index) => {
        expect(compiled.sql).toContain(`$${index + 1}`)
      })
      expect(compiled.parameters).toEqual(largeArray)
    })
  })

  describe('overlaps() SQL compilation', () => {
    test('generates correct PostgreSQL && operator', () => {
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

    test('handles empty arrays', () => {
      const query = db
        .selectFrom('products')
        .selectAll()
        .where(pg.array('categories').overlaps([]))
      
      const compiled = query.compile()
      
      expect(compiled.sql).toContain('"categories" && ARRAY[')
      expect(compiled.parameters).toEqual([])
    })

    test('handles single element arrays', () => {
      const query = db
        .selectFrom('products')
        .selectAll()
        .where(pg.array('categories').overlaps(['single']))
      
      const compiled = query.compile()
      
      expect(compiled.sql).toContain('"categories" && ARRAY[')
      expect(compiled.parameters).toEqual(['single'])
    })
  })

  describe('containedBy() SQL compilation', () => {
    test('generates correct PostgreSQL <@ operator', () => {
      const query = db
        .selectFrom('products')
        .selectAll()
        .where(pg.array('tags').containedBy(['allowed', 'permitted', 'valid']))
      
      const compiled = query.compile()
      
      expect(compiled.sql).toContain('"tags" <@ ARRAY[')
      expect(compiled.sql).toContain('$1')
      expect(compiled.sql).toContain('$2')
      expect(compiled.sql).toContain('$3')
      expect(compiled.parameters).toEqual(['allowed', 'permitted', 'valid'])
    })

    test('handles empty arrays', () => {
      const query = db
        .selectFrom('products')
        .selectAll()
        .where(pg.array('tags').containedBy([]))
      
      const compiled = query.compile()
      
      expect(compiled.sql).toContain('"tags" <@ ARRAY[')
      expect(compiled.parameters).toEqual([])
    })
  })

  describe('length() SQL compilation', () => {
    test('generates correct array_length function call in WHERE clause', () => {
      const query = db
        .selectFrom('products')
        .selectAll()
        .where(pg.array('tags').length(), '>', 3)
      
      const compiled = query.compile()
      
      expect(compiled.sql).toContain('coalesce(array_length("tags", 1), 0) > $1')
      expect(compiled.parameters).toEqual([3])
    })

    test('generates correct array_length function call in SELECT clause', () => {
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

    test('works with qualified column names', () => {
      const query = db
        .selectFrom('products')
        .selectAll()
        .where(pg.array('products.tags').length(), '>=', 2)
      
      const compiled = query.compile()
      
      expect(compiled.sql).toContain('coalesce(array_length("products"."tags", 1), 0) >= $1')
      expect(compiled.parameters).toEqual([2])
    })

    test('can be used in ORDER BY clause', () => {
      const query = db
        .selectFrom('products')
        .selectAll()
        .orderBy(pg.array('tags').length(), 'desc')
      
      const compiled = query.compile()
      
      expect(compiled.sql).toContain('order by coalesce(array_length("tags", 1), 0) desc')
    })
  })

  describe('any() SQL compilation', () => {
    test('generates correct ANY(...) function call', () => {
      const query = db
        .selectFrom('products')
        .selectAll()
        .where('name', '=', pg.array('categories').any())
      
      const compiled = query.compile()
      
      expect(compiled.sql).toContain('"name" = ANY("categories")')
    })

    test('works with qualified column names', () => {
      const query = db
        .selectFrom('users')
        .selectAll()
        .where('admin', '=', pg.array('users.roles').any())
      
      const compiled = query.compile()
      
      expect(compiled.sql).toContain('"admin" = ANY("users"."roles")')
    })

    test('can be used with different comparison operators', () => {
      const query = db
        .selectFrom('products')
        .selectAll()
        .where('status', '!=', pg.array('categories').any())
      
      const compiled = query.compile()
      
      expect(compiled.sql).toContain('"status" != ANY("categories")')
    })
  })

  describe('Complex queries with multiple array operations', () => {
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
      expect(compiled.sql).toContain('coalesce(array_length("tags", 1), 0) > $')  // length comparison
      expect(compiled.sql).toContain('coalesce(array_length("tags", 1), 0) as "tag_count"')  // length in select
      expect(compiled.sql).toContain('order by "name"')
      expect(compiled.sql).toContain('limit $')
      
      // Check parameters are in correct order
      const params = compiled.parameters
      expect(params).toContain('featured')
      expect(params).toContain('electronics')
      expect(params).toContain('gadgets')
      expect(params).toContain(2)
      expect(params).toContain(20)
    })

    test('array operations mixed with regular conditions', () => {
      const query = db
        .selectFrom('products')
        .selectAll()
        .where(pg.array('tags').contains(['typescript', 'postgres']))
        .where('id', '>', 100)
        .where('name', 'like', '%tutorial%')
        .where(pg.array('categories').containedBy(['tech', 'education']))
      
      const compiled = query.compile()
      
      expect(compiled.sql).toContain('"tags" @> ARRAY[')  // contains
      expect(compiled.sql).toContain('"id" > $')  // regular condition
      expect(compiled.sql).toContain('"name" like $')  // regular condition
      expect(compiled.sql).toContain('"categories" <@ ARRAY[')  // containedBy
      
      expect(compiled.parameters).toContain('typescript')
      expect(compiled.parameters).toContain('postgres')
      expect(compiled.parameters).toContain(100)
      expect(compiled.parameters).toContain('%tutorial%')
      expect(compiled.parameters).toContain('tech')
      expect(compiled.parameters).toContain('education')
    })

    test('nested array operations in subqueries', () => {
      const subquery = db
        .selectFrom('users')
        .select('id')
        .where(pg.array('roles').includes('admin'))
      
      const query = db
        .selectFrom('products')
        .selectAll()
        .where('created_by', 'in', subquery)
        .where(pg.array('tags').overlaps(['internal', 'restricted']))
      
      const compiled = query.compile()
      
      expect(compiled.sql).toContain('"roles" @> ARRAY[')  // subquery array operation
      expect(compiled.sql).toContain('"tags" && ARRAY[')  // main query array operation
      expect(compiled.parameters).toContain('admin')
      expect(compiled.parameters).toContain('internal')
      expect(compiled.parameters).toContain('restricted')
    })
  })

  describe('Parameter binding and SQL injection prevention', () => {
    test('all values are properly parameterized', () => {
      const query = db
        .selectFrom('products')
        .selectAll()
        .where(pg.array('tags').includes('test'))
      
      const compiled = query.compile()
      
      // Should use parameter placeholders, not inline values
      expect(compiled.sql).not.toContain("'test'")
      expect(compiled.sql).toContain('$1')
      expect(compiled.parameters).toEqual(['test'])
    })

    test('multiple values create multiple parameters', () => {
      const values = ['value1', 'value2', 'value3']
      const query = db
        .selectFrom('products')
        .selectAll()
        .where(pg.array('tags').overlaps(values))
      
      const compiled = query.compile()
      
      // Should have parameter for each value
      expect(compiled.sql).toContain('$1')
      expect(compiled.sql).toContain('$2')
      expect(compiled.sql).toContain('$3')
      expect(compiled.parameters).toEqual(values)
    })

    test('empty arrays do not create parameters', () => {
      const query = db
        .selectFrom('products')
        .selectAll()
        .where(pg.array('tags').contains([]))
      
      const compiled = query.compile()
      
      expect(compiled.sql).toContain('ARRAY[]::text[]')
      expect(compiled.parameters).toEqual([])
    })
  })

  describe('Column reference handling', () => {
    test('simple column names are quoted correctly', () => {
      const query = db
        .selectFrom('products')
        .selectAll()
        .where(pg.array('tags').includes('test'))
      
      const compiled = query.compile()
      
      expect(compiled.sql).toContain('"tags"')
    })

    test('qualified column names are quoted correctly', () => {
      const query = db
        .selectFrom('products')
        .selectAll()
        .where(pg.array('products.tags').includes('test'))
      
      const compiled = query.compile()
      
      expect(compiled.sql).toContain('"products"."tags"')
    })

    test('aliased column names are quoted correctly', () => {
      const query = db
        .selectFrom('products as p')
        .selectAll()
        .where(pg.array('p.tags').includes('test'))
      
      const compiled = query.compile()
      
      expect(compiled.sql).toContain('"p"."tags"')
    })
  })
})