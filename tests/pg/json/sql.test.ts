import { describe, test, expect } from 'bun:test'
import { 
  Kysely,
  DummyDriver,
  PostgresAdapter,
  PostgresQueryCompiler
} from 'kysely'
import { pg } from '../../../src/index'

interface TestDB {
  users: {
    id: number
    email: string
    preferences: any
    metadata: any
    settings: any
  }
  products: {
    id: number
    name: string
    metadata: any
    config: any
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

describe('JSON SQL Generation', () => {
  const db = new Kysely<TestDB>({
    dialect: new TestDialect()
  })

  describe('get() SQL compilation', () => {
    test('generates correct -> operator for field access', () => {
      const query = db
        .selectFrom('users')
        .selectAll()
        .where(pg.json('preferences').get('theme').equals('dark'))
      
      const compiled = query.compile()
      
      expect(compiled.sql).toContain('"preferences"->')
      expect(compiled.sql).toContain('= \'"dark"\'')
      expect(compiled.parameters).toEqual([])
    })

    test('generates correct field access with qualified columns', () => {
      const query = db
        .selectFrom('users')
        .selectAll()
        .where(pg.json('users.preferences').get('theme').equals('light'))
      
      const compiled = query.compile()
      
      expect(compiled.sql).toContain('"users"."preferences"->')
      expect(compiled.sql).toContain('= \'"light"\'')
    })

    test('handles special characters in field names', () => {
      const query = db
        .selectFrom('users')
        .selectAll()
        .where(pg.json('preferences').get('user-theme').equals('dark'))
      
      const compiled = query.compile()
      
      expect(compiled.sql).toContain('"preferences"->')
      expect(compiled.sql).toContain('\'"dark"\'')
      expect(compiled.parameters).toEqual([])
    })

    test('asText() generates ->> operator', () => {
      const query = db
        .selectFrom('users')
        .select([
          'id',
          pg.json('preferences').get('theme').asText().as('theme')
        ])
      
      const compiled = query.compile()
      
      expect(compiled.sql).toContain('"preferences"->>')
      expect(compiled.sql).toContain('as "theme"')
    })
  })

  describe('getText() SQL compilation', () => {
    test('generates correct ->> operator', () => {
      const query = db
        .selectFrom('users')
        .selectAll()
        .where(pg.json('preferences').getText('theme'), '=', 'dark')
      
      const compiled = query.compile()
      
      expect(compiled.sql).toContain('"preferences"->>')
      expect(compiled.sql).toContain('\'theme\'')
      expect(compiled.sql).toContain('= $1')
      expect(compiled.parameters).toEqual(['dark'])
    })

    test('works in SELECT clause', () => {
      const query = db
        .selectFrom('users')
        .select([
          'id',
          pg.json('preferences').getText('theme').as('user_theme')
        ])
      
      const compiled = query.compile()
      
      expect(compiled.sql).toContain('"preferences"->>')
      expect(compiled.sql).toContain('as "user_theme"')
    })
  })

  describe('path() SQL compilation', () => {
    test('generates correct #> operator with string path', () => {
      const query = db
        .selectFrom('users')
        .selectAll()
        .where(pg.json('metadata').path('user.profile').equals({name: 'test'}))
      
      const compiled = query.compile()
      
      expect(compiled.sql).toContain('"metadata"#>')
      expect(compiled.sql).toContain('{user.profile}')
      expect(compiled.sql).toContain("= '{\"name\":\"test\"}'")
    })

    test('generates correct #> operator with array path', () => {
      const query = db
        .selectFrom('users')
        .selectAll()
        .where(pg.json('metadata').path(['user', 'profile', 'settings']).equals({theme: 'dark'}))
      
      const compiled = query.compile()
      
      expect(compiled.sql).toContain('"metadata"#>')
      expect(compiled.sql).toContain('{user,profile,settings}')
      expect(compiled.sql).toContain("= '{\"theme\":\"dark\"}'")
    })

    test('asText() with path generates #>> operator', () => {
      const query = db
        .selectFrom('users')
        .select([
          'id',
          pg.json('metadata').path(['user', 'name']).asText().as('user_name')
        ])
      
      const compiled = query.compile()
      
      expect(compiled.sql).toContain('"metadata"#>>')
      expect(compiled.sql).toContain('{user,name}')
    })

    test('handles empty path array', () => {
      const query = db
        .selectFrom('users')
        .selectAll()
        .where(pg.json('metadata').path([]).equals({root: 'value'}))
      
      const compiled = query.compile()
      
      expect(compiled.sql).toContain('"metadata"#>')
      expect(compiled.sql).toContain('{}')
    })
  })

  describe('pathText() SQL compilation', () => {
    test('generates correct #>> operator', () => {
      const query = db
        .selectFrom('users')
        .selectAll()
        .where(pg.json('metadata').pathText(['user', 'email']), '=', 'test@example.com')
      
      const compiled = query.compile()
      
      expect(compiled.sql).toContain('"metadata"#>>')
      expect(compiled.sql).toContain('{user,email}')
      expect(compiled.sql).toContain('= $1')
      expect(compiled.parameters).toEqual(['test@example.com'])
    })

    test('works with string path', () => {
      const query = db
        .selectFrom('users')
        .select([
          'id',
          pg.json('preferences').pathText('theme').as('theme_text')
        ])
      
      const compiled = query.compile()
      
      expect(compiled.sql).toContain('"preferences"#>>')
      expect(compiled.sql).toContain('{theme}')
    })
  })

  describe('contains() SQL compilation', () => {
    test('generates correct @> operator with object', () => {
      const query = db
        .selectFrom('users')
        .selectAll()
        .where(pg.json('preferences').contains({theme: 'dark', language: 'en'}))
      
      const compiled = query.compile()
      
      expect(compiled.sql).toContain('"preferences" @>')
      expect(compiled.sql).toContain('{"theme":"dark","language":"en"}')
      expect(compiled.parameters).toEqual([])
    })

    test('handles primitive values', () => {
      const query = db
        .selectFrom('users')
        .selectAll()
        .where(pg.json('preferences').contains(true))
      
      const compiled = query.compile()
      
      expect(compiled.sql).toContain('"preferences" @>')
      expect(compiled.sql).toContain('true')
    })

    test('handles arrays', () => {
      const query = db
        .selectFrom('users')
        .selectAll()
        .where(pg.json('metadata').contains(['tag1', 'tag2']))
      
      const compiled = query.compile()
      
      expect(compiled.sql).toContain('"metadata" @>')
      expect(compiled.sql).toContain('["tag1","tag2"]')
    })

    test('handles null values', () => {
      const query = db
        .selectFrom('users')
        .selectAll()
        .where(pg.json('metadata').contains(null))
      
      const compiled = query.compile()
      
      expect(compiled.sql).toContain('"metadata" @>')
      expect(compiled.sql).toContain('null')
    })
  })

  describe('containedBy() SQL compilation', () => {
    test('generates correct <@ operator', () => {
      const query = db
        .selectFrom('users')
        .selectAll()
        .where(pg.json('preferences').containedBy({theme: 'dark', language: 'en', notifications: true}))
      
      const compiled = query.compile()
      
      expect(compiled.sql).toContain('"preferences" <@')
      expect(compiled.sql).toContain('theme')
      expect(compiled.sql).toContain('language')
      expect(compiled.sql).toContain('notifications')
    })

    test('handles empty objects', () => {
      const query = db
        .selectFrom('users')
        .selectAll()
        .where(pg.json('preferences').containedBy({}))
      
      const compiled = query.compile()
      
      expect(compiled.sql).toContain('"preferences" <@')
      expect(compiled.sql).toContain('{}')
    })
  })

  describe('hasKey() SQL compilation', () => {
    test('generates correct ? operator', () => {
      const query = db
        .selectFrom('users')
        .selectAll()
        .where(pg.json('preferences').hasKey('theme'))
      
      const compiled = query.compile()
      
      expect(compiled.sql).toContain('"preferences" ?')
      expect(compiled.sql).toContain('$1')
      expect(compiled.parameters).toEqual(['theme'])
    })

    test('handles special characters in keys', () => {
      const query = db
        .selectFrom('users')
        .selectAll()
        .where(pg.json('preferences').hasKey('user-profile'))
      
      const compiled = query.compile()
      
      expect(compiled.sql).toContain('"preferences" ?')
      expect(compiled.parameters).toEqual(['user-profile'])
    })
  })

  describe('hasAllKeys() SQL compilation', () => {
    test('generates correct ?& operator', () => {
      const query = db
        .selectFrom('users')
        .selectAll()
        .where(pg.json('preferences').hasAllKeys(['theme', 'language']))
      
      const compiled = query.compile()
      
      expect(compiled.sql).toContain('"preferences" ?& ARRAY[')
      expect(compiled.sql).toContain('$1')
      expect(compiled.sql).toContain('$2')
      expect(compiled.parameters).toEqual(['theme', 'language'])
    })

    test('handles empty array', () => {
      const query = db
        .selectFrom('users')
        .selectAll()
        .where(pg.json('preferences').hasAllKeys([]))
      
      const compiled = query.compile()
      
      // Empty array for hasAllKeys should return true (has all of no keys)
      expect(compiled.sql).toContain('true')
      expect(compiled.parameters).toEqual([])
    })

    test('handles single key', () => {
      const query = db
        .selectFrom('users')
        .selectAll()
        .where(pg.json('preferences').hasAllKeys(['theme']))
      
      const compiled = query.compile()
      
      expect(compiled.sql).toContain('"preferences" ?& ARRAY[')
      expect(compiled.parameters).toEqual(['theme'])
    })
  })

  describe('hasAnyKey() SQL compilation', () => {
    test('generates correct ?| operator', () => {
      const query = db
        .selectFrom('users')
        .selectAll()
        .where(pg.json('preferences').hasAnyKey(['theme', 'style']))
      
      const compiled = query.compile()
      
      expect(compiled.sql).toContain('"preferences" ?| ARRAY[')
      expect(compiled.sql).toContain('$1')
      expect(compiled.sql).toContain('$2')
      expect(compiled.parameters).toEqual(['theme', 'style'])
    })

    test('handles large key arrays', () => {
      const keys = ['key1', 'key2', 'key3', 'key4', 'key5']
      const query = db
        .selectFrom('users')
        .selectAll()
        .where(pg.json('preferences').hasAnyKey(keys))
      
      const compiled = query.compile()
      
      expect(compiled.sql).toContain('"preferences" ?| ARRAY[')
      keys.forEach((_, index) => {
        expect(compiled.sql).toContain(`$${index + 1}`)
      })
      expect(compiled.parameters).toEqual(keys)
    })
  })

  describe('Complex queries with multiple JSON operations', () => {
    test('multiple JSON operations work together', () => {
      const query = db
        .selectFrom('users')
        .select([
          'id',
          'email',
          pg.json('preferences').getText('theme').as('theme'),
          pg.json('metadata').pathText(['user', 'name']).as('display_name')
        ])
        .where(pg.json('preferences').hasKey('theme'))
        .where(pg.json('preferences').contains({notifications: true}))
        .where(pg.json('metadata').path(['user', 'active']).equals(true))
        .orderBy('email')
      
      const compiled = query.compile()
      
      // Check that all operations are present
      expect(compiled.sql).toContain('"preferences"->>')  // getText
      expect(compiled.sql).toContain('"metadata"#>>')    // pathText
      expect(compiled.sql).toContain('"preferences" ?')   // hasKey
      expect(compiled.sql).toContain('"preferences" @>')  // contains
      expect(compiled.sql).toContain('"metadata"#>')      // path + equals
      
      // Check that query includes both operations
      expect(compiled.sql).toContain('@>')  // contains operation
      expect(compiled.sql).toContain('#>')  // path operation
    })

    test('JSON operations mixed with regular conditions', () => {
      const query = db
        .selectFrom('users')
        .selectAll()
        .where('id', '>', 100)
        .where(pg.json('preferences').get('theme').equals('dark'))
        .where('email', 'like', '%@example.com')
        .where(pg.json('metadata').hasAllKeys(['verified', 'active']))
      
      const compiled = query.compile()
      
      expect(compiled.sql).toContain('"id" > $')
      expect(compiled.sql).toContain('"preferences"->')
      expect(compiled.sql).toContain('"email" like $')
      expect(compiled.sql).toContain('"metadata" ?& ARRAY[')
      
      expect(compiled.parameters).toContain(100)
      expect(compiled.parameters).toContain('%@example.com')
      expect(compiled.parameters).toContain('verified')
      expect(compiled.parameters).toContain('active')
    })

    test('nested JSON operations in subqueries', () => {
      const subquery = db
        .selectFrom('users')
        .select('id')
        .where(pg.json('preferences').contains({premium: true}))
      
      const query = db
        .selectFrom('products')
        .selectAll()
        .where('created_by', 'in', subquery)
        .where(pg.json('config').hasKey('premium_features'))
      
      const compiled = query.compile()
      
      expect(compiled.sql).toContain('"preferences" @>')
      expect(compiled.sql).toContain('"config" ?')
      expect(compiled.sql).toContain('{"premium":true}')
      expect(compiled.parameters).toContain('premium_features')
    })
  })

  describe('Column reference handling', () => {
    test('simple column names are quoted correctly', () => {
      const query = db
        .selectFrom('users')
        .selectAll()
        .where(pg.json('preferences').hasKey('theme'))
      
      const compiled = query.compile()
      
      expect(compiled.sql).toContain('"preferences"')
    })

    test('qualified column names are quoted correctly', () => {
      const query = db
        .selectFrom('users')
        .selectAll()
        .where(pg.json('users.preferences').hasKey('theme'))
      
      const compiled = query.compile()
      
      expect(compiled.sql).toContain('"users"."preferences"')
    })

    test('aliased column names are quoted correctly', () => {
      const query = db
        .selectFrom('users as u')
        .selectAll()
        .where(pg.json('u.preferences').hasKey('theme'))
      
      const compiled = query.compile()
      
      expect(compiled.sql).toContain('"u"."preferences"')
    })
  })

  describe('JSON value serialization', () => {
    test('string values are properly JSON-encoded', () => {
      const query = db
        .selectFrom('users')
        .selectAll()
        .where(pg.json('preferences').contains({theme: 'dark mode'}))
      
      const compiled = query.compile()
      
      expect(compiled.sql).toContain('"theme":"dark mode"')
    })

    test('special characters are properly escaped', () => {
      const query = db
        .selectFrom('users')
        .selectAll()
        .where(pg.json('preferences').contains({message: 'Hello "world" with \'quotes\''}))
      
      const compiled = query.compile()
      
      expect(compiled.sql).toContain('\\"world\\"')
      expect(compiled.sql).toContain("'quotes'")
    })

    test('unicode characters are preserved', () => {
      const query = db
        .selectFrom('users')
        .selectAll()
        .where(pg.json('preferences').contains({emoji: '🚀', chinese: '中文'}))
      
      const compiled = query.compile()
      
      expect(compiled.sql).toContain('🚀')
      expect(compiled.sql).toContain('中文')
    })

    test('complex nested objects are serialized correctly', () => {
      const complexValue = {
        user: {
          profile: {
            settings: {
              notifications: {
                email: true,
                push: false
              }
            }
          }
        }
      }
      
      const query = db
        .selectFrom('users')
        .selectAll()
        .where(pg.json('metadata').contains(complexValue))
      
      const compiled = query.compile()
      
      expect(compiled.sql).toContain('notifications')
      expect(compiled.sql).toContain('email')
      expect(compiled.sql).toContain('true')
      expect(compiled.sql).toContain('false')
    })
  })
})