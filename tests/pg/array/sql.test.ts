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
    status: string
    created_by: number
    tags: string[]
    categories: string[]
    scores: number[]
    flags: boolean[]
  }
  users: {
    id: number
    admin: string
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
  
  createIntrospector() {
    return {
      getSchemas: () => Promise.resolve([]),
      getTables: () => Promise.resolve([]),
      getMetadata: () => Promise.resolve({ tables: [] })
    } as any
  }
}

describe('Array SQL Generation', () => {
  const db = new Kysely<TestDB>({
    dialect: new TestDialect()
  })

  describe('hasAllOf() SQL compilation', () => {
    test('generates correct PostgreSQL @> operator for multiple values', () => {
      const query = db
        .selectFrom('products')
        .selectAll()
        .where(pg.array('tags').hasAllOf(['typescript', 'postgres']))
      
      const compiled = query.compile()
      
      expect(compiled.sql).toContain('"tags" @> ARRAY[')
      expect(compiled.sql).toContain('::text[]')
      expect(compiled.sql).toContain('$1')
      expect(compiled.sql).toContain('$2')
      expect(compiled.parameters).toEqual(['typescript', 'postgres'])
    })

    test('generates correct SQL for qualified columns', () => {
      const query = db
        .selectFrom('products')
        .selectAll()
        .where(pg.array('products.tags').hasAllOf(['featured', 'popular']))
      
      const compiled = query.compile()
      
      expect(compiled.sql).toContain('"products"."tags" @> ARRAY[')
      expect(compiled.parameters).toEqual(['featured', 'popular'])
    })

    test('generates correct SQL for aliased columns', () => {
      const query = db
        .selectFrom('products as p')
        .selectAll()
        .where(pg.array('p.tags').hasAllOf(['featured', 'trending']))
      
      const compiled = query.compile()
      
      expect(compiled.sql).toContain('"p"."tags" @> ARRAY[')
      expect(compiled.parameters).toEqual(['featured', 'trending'])
    })

    test('handles special characters in values', () => {
      const specialValues = ["tag's with 'quotes'", "tag\"with\"double"]
      const query = db
        .selectFrom('products')
        .selectAll()
        .where(pg.array('tags').hasAllOf(specialValues))
      
      const compiled = query.compile()
      
      expect(compiled.sql).toContain('"tags" @> ARRAY[')
      expect(compiled.parameters).toEqual(specialValues)
    })

    test('generates correct type casting for number arrays', () => {
      const query = db
        .selectFrom('products')
        .selectAll()
        .where(pg.array<number>('scores').hasAllOf([95, 100]))
      
      const compiled = query.compile()
      
      expect(compiled.sql).toContain('"scores" @> ARRAY[')
      expect(compiled.sql).toContain('::integer[]')
      expect(compiled.parameters).toEqual([95, 100])
    })

    test('generates correct type casting for boolean arrays', () => {
      const query = db
        .selectFrom('products')
        .selectAll()
        .where(pg.array<boolean>('flags').hasAllOf([true, false]))
      
      const compiled = query.compile()
      
      expect(compiled.sql).toContain('"flags" @> ARRAY[')
      expect(compiled.sql).toContain('::boolean[]')
      expect(compiled.parameters).toEqual([true, false])
    })

    test('handles empty arrays with typed array literal', () => {
      const query = db
        .selectFrom('products')
        .selectAll()
        .where(pg.array('tags').hasAllOf([]))
      
      const compiled = query.compile()
      
      expect(compiled.sql).toContain('"tags" @> ARRAY[]::text[]')
      expect(compiled.parameters).toEqual([])
    })

    test('handles single element arrays', () => {
      const query = db
        .selectFrom('products')
        .selectAll()
        .where(pg.array('tags').hasAllOf(['single']))
      
      const compiled = query.compile()
      
      expect(compiled.sql).toContain('"tags" @> ARRAY[')
      expect(compiled.parameters).toEqual(['single'])
    })

    test('handles large arrays with multiple parameters', () => {
      const largeArray = ['tag1', 'tag2', 'tag3', 'tag4', 'tag5']
      const query = db
        .selectFrom('products')
        .selectAll()
        .where(pg.array('tags').hasAllOf(largeArray))
      
      const compiled = query.compile()
      
      expect(compiled.sql).toContain('"tags" @> ARRAY[')
      largeArray.forEach((_, index) => {
        expect(compiled.sql).toContain(`$${index + 1}`)
      })
      expect(compiled.parameters).toEqual(largeArray)
    })
  })

  describe('hasAnyOf() SQL compilation', () => {
    test('generates correct PostgreSQL && operator', () => {
      const query = db
        .selectFrom('products')
        .selectAll()
        .where(pg.array('categories').hasAnyOf(['tech', 'ai']))
      
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
        .where(pg.array('categories').hasAnyOf([]))
      
      const compiled = query.compile()
      
      expect(compiled.sql).toContain('"categories" && ARRAY[')
      expect(compiled.parameters).toEqual([])
    })

    test('handles single element arrays', () => {
      const query = db
        .selectFrom('products')
        .selectAll()
        .where(pg.array('categories').hasAnyOf(['single']))
      
      const compiled = query.compile()
      
      expect(compiled.sql).toContain('"categories" && ARRAY[')
      expect(compiled.parameters).toEqual(['single'])
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


  describe('Complex queries with multiple array operations', () => {
    test('multiple array operations work together', () => {
      const query = db
        .selectFrom('products')
        .select([
          'id',
          'name',
          pg.array('tags').length().as('tag_count')
        ])
        .where(pg.array('tags').hasAllOf(['featured']))
        .where(pg.array('categories').hasAnyOf(['electronics', 'gadgets']))
        .where(pg.array('tags').length(), '>', 2)
        .orderBy('name')
        .limit(20)
      
      const compiled = query.compile()
      
      // Check that all operations are present
      expect(compiled.sql).toContain('"tags" @> ARRAY[')  // hasAllOf
      expect(compiled.sql).toContain('"categories" && ARRAY[')  // hasAnyOf
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
        .where(pg.array('tags').hasAllOf(['typescript', 'postgres']))
        .where('id', '>', 100)
        .where('name', 'like', '%tutorial%')
        .where(pg.array('categories').hasAnyOf(['tech', 'education']))
      
      const compiled = query.compile()
      
      expect(compiled.sql).toContain('"tags" @> ARRAY[')  // hasAllOf
      expect(compiled.sql).toContain('"id" > $')  // regular condition
      expect(compiled.sql).toContain('"name" like $')  // regular condition
      expect(compiled.sql).toContain('"categories" && ARRAY[')  // hasAnyOf
      
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
        .where(pg.array('roles').hasAllOf(['admin']))
      
      const query = db
        .selectFrom('products')
        .selectAll()
        .where('created_by', 'in', subquery)
        .where(pg.array('tags').hasAnyOf(['internal', 'restricted']))
      
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
        .where(pg.array('tags').hasAllOf(['test']))
      
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
        .where(pg.array('tags').hasAnyOf(values))
      
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
        .where(pg.array('tags').hasAllOf([]))
      
      const compiled = query.compile()
      
      expect(compiled.sql).toContain('ARRAY[]::text[]')
      expect(compiled.parameters).toEqual([])
    })
  })

  describe('Array update operations SQL compilation', () => {
    test('append() single value generates array_append', () => {
      const query = db
        .updateTable('products')
        .set({ tags: pg.array('tags').append('new-tag') })
        .where('id', '=', 1)
      
      const compiled = query.compile()
      
      expect(compiled.sql).toContain('array_append("tags", $1::text)')
      expect(compiled.parameters).toContain('new-tag')
    })

    test('append() multiple values generates array concatenation', () => {
      const query = db
        .updateTable('products')
        .set({ tags: pg.array('tags').append(['tag1', 'tag2']) })
        .where('id', '=', 1)
      
      const compiled = query.compile()
      
      expect(compiled.sql).toContain('"tags" || ARRAY[$1, $2]::text[]')
      expect(compiled.parameters).toContain('tag1')
      expect(compiled.parameters).toContain('tag2')
    })

    test('prepend() single value generates array_prepend', () => {
      const query = db
        .updateTable('products')
        .set({ tags: pg.array('tags').prepend('urgent') })
        .where('id', '=', 1)
      
      const compiled = query.compile()
      
      expect(compiled.sql).toContain('array_prepend($1::text, "tags")')
      expect(compiled.parameters).toContain('urgent')
    })

    test('prepend() multiple values generates array concatenation', () => {
      const query = db
        .updateTable('products')
        .set({ tags: pg.array('tags').prepend(['urgent', 'priority']) })
        .where('id', '=', 1)
      
      const compiled = query.compile()
      
      expect(compiled.sql).toContain('ARRAY[$1, $2]::text[] || "tags"')
      expect(compiled.parameters).toContain('urgent')
      expect(compiled.parameters).toContain('priority')
    })

    test('remove() generates array_remove', () => {
      const query = db
        .updateTable('products')
        .set({ tags: pg.array('tags').remove('deprecated') })
        .where('id', '=', 1)
      
      const compiled = query.compile()
      
      expect(compiled.sql).toContain('array_remove("tags", $1)')
      expect(compiled.parameters).toContain('deprecated')
    })

    test('removeFirst() generates array slice', () => {
      const query = db
        .updateTable('products')
        .set({ tags: pg.array('tags').removeFirst() })
        .where('id', '=', 1)
      
      const compiled = query.compile()
      
      expect(compiled.sql).toContain('"tags"[2:array_length("tags", 1)]')
    })

    test('removeLast() generates array slice', () => {
      const query = db
        .updateTable('products')
        .set({ tags: pg.array('tags').removeLast() })
        .where('id', '=', 1)
      
      const compiled = query.compile()
      
      expect(compiled.sql).toContain('"tags"[1:array_length("tags", 1)-1]')
    })

    test('append() with empty array returns column unchanged', () => {
      const query = db
        .updateTable('products')
        .set({ tags: pg.array('tags').append([]) })
        .where('id', '=', 1)
      
      const compiled = query.compile()
      
      expect(compiled.sql).toContain('"tags" = "tags"')
    })

    test('prepend() with empty array returns column unchanged', () => {
      const query = db
        .updateTable('products')
        .set({ tags: pg.array('tags').prepend([]) })
        .where('id', '=', 1)
      
      const compiled = query.compile()
      
      expect(compiled.sql).toContain('"tags" = "tags"')
    })

    test('append() with number array uses correct typing', () => {
      const query = db
        .updateTable('products')
        .set({ scores: pg.array<number>('scores').append(95) })
        .where('id', '=', 1)
      
      const compiled = query.compile()
      
      expect(compiled.sql).toContain('array_append("scores", $1::integer)')
      expect(compiled.parameters).toContain(95)
    })
  })

  describe('Array select operations SQL compilation', () => {
    test('first() generates array index access', () => {
      const query = db
        .selectFrom('products')
        .select([
          'id',
          pg.array('tags').first().as('first_tag')
        ])
      
      const compiled = query.compile()
      
      expect(compiled.sql).toContain('"tags"[1] as "first_tag"')
    })

    test('last() generates array length-based access', () => {
      const query = db
        .selectFrom('products')
        .select([
          'id',
          pg.array('tags').last().as('last_tag')
        ])
      
      const compiled = query.compile()
      
      expect(compiled.sql).toContain('"tags"[array_length("tags", 1)] as "last_tag"')
    })

    test('first() can be used in WHERE clause', () => {
      const query = db
        .selectFrom('products')
        .selectAll()
        .where(pg.array('tags').first(), '=', 'priority')
      
      const compiled = query.compile()
      
      expect(compiled.sql).toContain('"tags"[1] = $1')
      expect(compiled.parameters).toContain('priority')
    })

    test('last() can be used in WHERE clause', () => {
      const query = db
        .selectFrom('products')
        .selectAll()
        .where(pg.array('tags').last(), '=', 'final')
      
      const compiled = query.compile()
      
      expect(compiled.sql).toContain('"tags"[array_length("tags", 1)] = $1')
      expect(compiled.parameters).toContain('final')
    })
  })

  describe('Column reference handling', () => {
    test('simple column names are quoted correctly', () => {
      const query = db
        .selectFrom('products')
        .selectAll()
        .where(pg.array('tags').hasAllOf(['test']))
      
      const compiled = query.compile()
      
      expect(compiled.sql).toContain('"tags"')
    })

    test('qualified column names are quoted correctly', () => {
      const query = db
        .selectFrom('products')
        .selectAll()
        .where(pg.array('products.tags').hasAllOf(['test']))
      
      const compiled = query.compile()
      
      expect(compiled.sql).toContain('"products"."tags"')
    })

    test('aliased column names are quoted correctly', () => {
      const query = db
        .selectFrom('products as p')
        .selectAll()
        .where(pg.array('p.tags').hasAllOf(['test']))
      
      const compiled = query.compile()
      
      expect(compiled.sql).toContain('"p"."tags"')
    })
  })
})