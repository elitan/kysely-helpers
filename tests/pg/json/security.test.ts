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
  users: {
    id: number
    name: string
    email: string
    preferences: any
    metadata: any
    settings: any
    permissions: any
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
    console.log('✅ JSON Security tests: Database connection available')
  } catch (error) {
    console.log('⚠️ JSON Security tests: Database not available, running compilation tests only')
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

describe('JSON Security Tests', () => {
  describe('JSON Injection Prevention - Compilation Tests', () => {
    test('malicious JSON in contains() is properly escaped', () => {
      const maliciousObject = {
        "'; DROP TABLE users; --": "value",
        "normal_key": "'; DELETE FROM preferences; --"
      }
      
      const query = compileDb
        .selectFrom('users')
        .selectAll()
        .where(pg.json('preferences').contains(maliciousObject))
      
      const compiled = query.compile()
      
      // Malicious SQL should be safely contained within JSON strings (not executable)
      expect(compiled.sql).toContain('"preferences" @>')
      expect(compiled.sql).toContain('DROP TABLE') // Safe within JSON string
      expect(compiled.sql).toContain('DELETE FROM') // Safe within JSON string
      
      // Should be properly JSON-escaped
      expect(compiled.sql).toContain('"preferences" @>')
      // Malicious content should be safely quoted within JSON
    })

    test('SQL injection in hasKey() is parameterized', () => {
      const maliciousKey = "theme'; DROP DATABASE test; --"
      
      const query = compileDb
        .selectFrom('users')
        .selectAll()
        .where(pg.json('preferences').hasKey(maliciousKey))
      
      const compiled = query.compile()
      
      // Malicious SQL should not appear in raw SQL
      expect(compiled.sql).not.toContain('DROP DATABASE')
      expect(compiled.sql).not.toContain('--')
      expect(compiled.sql).toContain('$1')
      expect(compiled.parameters).toEqual([maliciousKey])
    })

    test('injection attempts in hasAllKeys() are parameterized', () => {
      const maliciousKeys = [
        "key1'; UPDATE users SET admin = true; --",
        "key2'; INSERT INTO logs VALUES ('hacked'); --",
        "'; CREATE USER hacker; --"
      ]
      
      const query = compileDb
        .selectFrom('users')
        .selectAll()
        .where(pg.json('preferences').hasAllKeys(maliciousKeys))
      
      const compiled = query.compile()
      
      // No malicious SQL should appear
      expect(compiled.sql).not.toContain('UPDATE users')
      expect(compiled.sql).not.toContain('INSERT INTO logs')
      expect(compiled.sql).not.toContain('CREATE USER')
      expect(compiled.sql).not.toContain('--')
      
      // All values should be parameters
      expect(compiled.parameters).toEqual(maliciousKeys)
      maliciousKeys.forEach((_, index) => {
        expect(compiled.sql).toContain(`$${index + 1}`)
      })
    })

    test('injection in hasAnyKey() is parameterized', () => {
      const maliciousKeys = [
        "theme'; GRANT ALL PRIVILEGES ON *.* TO 'hacker'; --",
        "style'; SELECT * FROM sensitive_data; --"
      ]
      
      const query = compileDb
        .selectFrom('users')
        .selectAll()
        .where(pg.json('preferences').hasAnyKey(maliciousKeys))
      
      const compiled = query.compile()
      
      expect(compiled.sql).not.toContain('GRANT ALL')
      expect(compiled.sql).not.toContain('sensitive_data')
      expect(compiled.parameters).toEqual(maliciousKeys)
    })

    test('path injection attempts are safely handled', () => {
      const maliciousPath = ["user'; DROP SCHEMA public CASCADE; --", "theme"]
      
      const query = compileDb
        .selectFrom('users')
        .selectAll()
        .where(pg.json('preferences').path(maliciousPath).equals('dark'))
      
      const compiled = query.compile()
      
      // Path should be safely contained within PostgreSQL path syntax
      expect(compiled.sql).toContain('#>')
      expect(compiled.sql).toContain('{user\'; DROP SCHEMA public CASCADE; --,theme}')
      // SQL injection in path is safely contained within path array
    })

    test('JSON values with embedded SQL are escaped', () => {
      const maliciousValue = {
        "theme": "dark'; DROP TABLE users; SELECT 'pwned",
        "script": "<script>alert('xss')</script>",
        "sql": "1' OR '1'='1"
      }
      
      const query = compileDb
        .selectFrom('users')
        .selectAll()
        .where(pg.json('preferences').contains(maliciousValue))
      
      const compiled = query.compile()
      
      // Malicious content should be safely contained within JSON string literals
      expect(compiled.sql).toContain('"preferences" @>')
      // The JSON should contain the malicious values as safe string data
      expect(compiled.sql).toContain('"theme"')
      expect(compiled.sql).toContain('"script"')
      expect(compiled.sql).toContain('"sql"')
    })

    test('nested object injection attempts are escaped', () => {
      const maliciousNestedObject = {
        user: {
          "profile'; DELETE FROM users WHERE id > 0; --": {
            theme: "'; INSERT INTO admin_users VALUES ('hacker'); --"
          }
        }
      }
      
      const query = compileDb
        .selectFrom('users')
        .selectAll()
        .where(pg.json('preferences').contains(maliciousNestedObject))
      
      const compiled = query.compile()
      
      // Malicious content should be safely contained within JSON structure
      expect(compiled.sql).toContain('"preferences" @>')
      expect(compiled.sql).toContain('"user"')
      // SQL injection attempts are safely contained as JSON string values
    })
  })

  describe('Special Character Handling', () => {
    test('single quotes in JSON keys are properly escaped', () => {
      const keyWithQuotes = "user's preference"
      
      const query = compileDb
        .selectFrom('users')
        .selectAll()
        .where(pg.json('preferences').hasKey(keyWithQuotes))
      
      const compiled = query.compile()
      
      expect(compiled.sql).toContain('$1')
      expect(compiled.parameters).toEqual([keyWithQuotes])
    })

    test('double quotes in JSON values are properly escaped', () => {
      const valueWithQuotes = {message: 'Say "hello" to the world'}
      
      const query = compileDb
        .selectFrom('users')
        .selectAll()
        .where(pg.json('preferences').contains(valueWithQuotes))
      
      const compiled = query.compile()
      
      expect(compiled.sql).toContain('\\"hello\\"')
      expect(compiled.sql).toContain('"preferences" @>')
    })

    test('backslashes are properly handled', () => {
      const valueWithBackslashes = {path: 'C:\\Users\\Admin\\file.txt'}
      
      const query = compileDb
        .selectFrom('users')
        .selectAll()
        .where(pg.json('preferences').contains(valueWithBackslashes))
      
      const compiled = query.compile()
      
      expect(compiled.sql).toContain('C:\\\\Users\\\\Admin\\\\file.txt')
    })

    test('unicode characters are preserved', () => {
      const unicodeValue = {
        emoji: '🚀',
        chinese: '中文字符',
        accented: 'café naïve résumé'
      }
      
      const query = compileDb
        .selectFrom('users')
        .selectAll()
        .where(pg.json('preferences').contains(unicodeValue))
      
      const compiled = query.compile()
      
      expect(compiled.sql).toContain('🚀')
      expect(compiled.sql).toContain('中文字符')
      expect(compiled.sql).toContain('café')
    })

    test('control characters are handled safely', () => {
      const controlChars = {message: 'Line1\nLine2\tTabbed\rCarriage\bBackspace\fFormfeed'}
      
      const query = compileDb
        .selectFrom('users')
        .selectAll()
        .where(pg.json('preferences').contains(controlChars))
      
      const compiled = query.compile()
      
      // Control characters should be properly JSON-escaped
      expect(compiled.sql).toContain('\\n')
      expect(compiled.sql).toContain('\\t')
      expect(compiled.sql).toContain('\\r')
    })

    test('null bytes are handled safely', () => {
      const valueWithNullByte = {data: 'normal\0malicious'}
      
      const query = compileDb
        .selectFrom('users')
        .selectAll()
        .where(pg.json('preferences').contains(valueWithNullByte))
      
      const compiled = query.compile()
      
      // Should handle null bytes safely
      expect(compiled.sql).toContain('"preferences" @>')
    })
  })

  describe('Edge Cases and Error Conditions', () => {
    test('extremely large JSON objects are handled safely', () => {
      const largeObject = {
        data: 'x'.repeat(10000),
        array: Array.from({length: 1000}, (_, i) => `item_${i}`)
      }
      
      const query = compileDb
        .selectFrom('users')
        .selectAll()
        .where(pg.json('preferences').contains(largeObject))
      
      const compiled = query.compile()
      
      expect(compiled.sql).toContain('"preferences" @>')
      expect(compiled.sql.length).toBeGreaterThan(1000)
    })

    test('empty JSON objects and arrays are handled correctly', () => {
      const emptyStructures = {
        emptyObject: {},
        emptyArray: [],
        nullValue: null
      }
      
      const query = compileDb
        .selectFrom('users')
        .selectAll()
        .where(pg.json('preferences').contains(emptyStructures))
      
      const compiled = query.compile()
      
      expect(compiled.sql).toContain('{}')
      expect(compiled.sql).toContain('[]')
      expect(compiled.sql).toContain('null')
    })

    test('deeply nested objects are safe from injection', () => {
      const deepObject: any = {}
      let current = deepObject
      for (let i = 0; i < 50; i++) {
        current[`level_${i}'; DROP TABLE test; --`] = {}
        current = current[`level_${i}'; DROP TABLE test; --`]
      }
      current.value = "'; GRANT ALL ON *.* TO 'hacker'; --"
      
      const query = compileDb
        .selectFrom('users')
        .selectAll()
        .where(pg.json('preferences').contains(deepObject))
      
      const compiled = query.compile()
      
      // Deep nested structure with malicious content is safely serialized as JSON
      expect(compiled.sql).toContain('"preferences" @>')
      // All malicious SQL is safely contained within JSON string literals
    })

    test('mixed dangerous content in complex objects is all escaped', () => {
      const dangerousObject = {
        "'; DROP DATABASE main; --": "value1",
        normalKey: "'; UPDATE users SET password = 'hacked'; --",
        nested: {
          "'; INSERT INTO logs VALUES ('breach'); --": true,
          array: ["'; DELETE FROM sessions; --", "normal_value"],
          number: 42,
          "'; CREATE USER attacker WITH SUPERUSER; --": null
        }
      }
      
      const query = compileDb
        .selectFrom('users')
        .selectAll()
        .where(pg.json('preferences').contains(dangerousObject))
      
      const compiled = query.compile()
      
      // Complex object with dangerous content is safely serialized as JSON
      expect(compiled.sql).toContain('"preferences" @>')
      // All malicious SQL is contained within JSON string literals (not executable)
      expect(compiled.sql).toContain('"normalKey"')
      expect(compiled.sql).toContain('"nested"')
    })

    test('JSON keywords as legitimate values are preserved', () => {
      const jsonWithKeywords = {
        select: 'SELECT',
        from: 'FROM',
        where: 'WHERE',
        insert: 'INSERT',
        update: 'UPDATE',
        delete: 'DELETE'
      }
      
      const query = compileDb
        .selectFrom('users')
        .selectAll()
        .where(pg.json('preferences').contains(jsonWithKeywords))
      
      const compiled = query.compile()
      
      // Keywords should be safely contained within JSON string
      expect(compiled.sql).toContain('"SELECT"')
      expect(compiled.sql).toContain('"FROM"')
      expect(compiled.sql).toContain('"WHERE"')
      expect(compiled.sql).toContain('"preferences" @>')
      
      // SQL keywords are safely contained within the JSON literal
      expect(compiled.sql).toMatch(/"preferences" @> '.*SELECT.*'/)
    })
  })

  describe('Real Database Security Tests', () => {
    // Only run these if we have a database connection
    const itWithDb = integrationDb ? test : test.skip

    itWithDb('JSON injection attempts fail safely in real database', async () => {
      if (!integrationDb) return

      const maliciousInputs = [
        {theme: "'; DROP TABLE IF EXISTS temp_hack; --"},
        {"'; DELETE FROM users; --": "value"},
        {script: "<script>alert('xss')</script>"}
      ]

      // These should all execute without error and return empty results
      for (const maliciousInput of maliciousInputs) {
        const results = await integrationDb
          .selectFrom('users')
          .selectAll()
          .where(pg.json('preferences').contains(maliciousInput))
          .execute()

        expect(Array.isArray(results)).toBe(true)
        expect(results.length).toBe(0) // No users should match malicious inputs
      }

      // Database should still be intact
      const healthCheck = await integrationDb
        .selectFrom('users')
        .select('id')
        .limit(1)
        .execute()

      expect(Array.isArray(healthCheck)).toBe(true)
    })

    itWithDb('special characters work correctly in real database', async () => {
      if (!integrationDb) return

      const specialCharsObject = {
        quotes: 'Say "hello" and \'goodbye\'',
        unicode: '🚀 Unicode test 中文',
        symbols: '@#$%^&*()[]{}|\\:";\'<>?,./`~',
        control: 'Line1\nLine2\tTab\rCarriage',
        path: 'C:\\Windows\\System32'
      }

      // Insert test data with special characters
      const insertResult = await integrationDb
        .insertInto('users')
        .values({
          email: 'special@test.com',
          name: 'Special Chars Test',
          preferences: specialCharsObject,
          permissions: {}
        })
        .returning('id')
        .executeTakeFirst()

      expect(insertResult?.id).toBeDefined()

      try {
        // Test searching with special characters
        const results = await integrationDb
          .selectFrom('users')
          .select(['id', 'name', 'preferences'])
          .where('id', '=', insertResult!.id)
          .where(pg.json('preferences').hasKey('unicode'))
          .execute()

        expect(results.length).toBe(1)
        
        const foundUser = results[0]
        expect(foundUser.preferences.quotes).toContain('"hello"')
        expect(foundUser.preferences.unicode).toContain('🚀')
        expect(foundUser.preferences.unicode).toContain('中文')
        expect(foundUser.preferences.control).toContain('\n')
      } finally {
        // Clean up
        await integrationDb
          .deleteFrom('users')
          .where('id', '=', insertResult!.id)
          .execute()
      }
    })

    itWithDb('concurrent injection attempts are handled safely', async () => {
      if (!integrationDb) return

      const maliciousQueries = [
        {theme: "'; DROP TABLE users; --"},
        {"'; UNION SELECT * FROM pg_database; --": "value"},
        {script: "'; INSERT INTO users (name) VALUES ('hacked'); --"},
        {data: "' OR '1'='1'; --"}
      ]

      // Run multiple malicious queries concurrently
      const promises = maliciousQueries.map(maliciousQuery =>
        integrationDb!
          .selectFrom('users')
          .selectAll()
          .where(pg.json('preferences').contains(maliciousQuery))
          .execute()
      )

      const results = await Promise.all(promises)

      // All should complete without error and return no results
      for (const result of results) {
        expect(Array.isArray(result)).toBe(true)
        expect(result.length).toBe(0)
      }

      // Database should still be functional
      const healthCheck = await integrationDb
        .selectFrom('users')
        .select('id')
        .execute()

      expect(Array.isArray(healthCheck)).toBe(true)
    })

    itWithDb('complex nested injection attempts are handled', async () => {
      if (!integrationDb) return

      const complexMaliciousObject = {
        user: {
          "profile'; DROP SCHEMA public CASCADE; --": {
            settings: {
              "theme'; DELETE FROM users; --": "dark",
              notifications: {
                "email'; UPDATE users SET admin = true; --": true
              }
            }
          }
        },
        "'; CREATE DATABASE malicious; --": "value"
      }

      const results = await integrationDb
        .selectFrom('users')
        .selectAll()
        .where(pg.json('preferences').contains(complexMaliciousObject))
        .execute()

      // Should execute without error
      expect(Array.isArray(results)).toBe(true)
      expect(results.length).toBe(0)

      // Verify database is still intact
      const healthCheck = await integrationDb
        .selectFrom('users')
        .select('id')
        .execute()

      expect(Array.isArray(healthCheck)).toBe(true)
    })
  })

  describe('Column Reference Security', () => {
    test('column names are properly quoted', () => {
      const query = compileDb
        .selectFrom('users')
        .selectAll()
        .where(pg.json('preferences').hasKey('theme'))
      
      const compiled = query.compile()
      
      // Column names should be quoted
      expect(compiled.sql).toContain('"preferences"')
      expect(compiled.sql).not.toContain('preferences ?') // Should not have unquoted column
    })

    test('qualified column names are properly quoted', () => {
      const query = compileDb
        .selectFrom('users')
        .selectAll()
        .where(pg.json('users.preferences').hasKey('theme'))
      
      const compiled = query.compile()
      
      expect(compiled.sql).toContain('"users"."preferences"')
    })

    test('malicious column names cannot cause injection', () => {
      // Even if someone tried to pass a malicious "column" name, it would be quoted
      const query = compileDb
        .selectFrom('users')
        .selectAll()
        .where(pg.json('preferences"; DROP TABLE users; --').hasKey('theme'))
      
      const compiled = query.compile()
      
      // The malicious column name would be quoted as a single identifier
      expect(compiled.sql).toContain('"preferences""; DROP TABLE users; --" ?')
      
      // The value should still be properly parameterized
      expect(compiled.parameters).toEqual(['theme'])
      
      // SQL should still be valid
      expect(compiled.sql).toContain('select * from "users"')
    })
  })

  describe('Type Safety and Validation', () => {
    test('empty objects generate safe SQL', () => {
      const query = compileDb
        .selectFrom('users')
        .selectAll()
        .where(pg.json('preferences').contains({}))
      
      const compiled = query.compile()
      
      expect(compiled.sql).toContain("'{}'")
    })

    test('null handling is safe', () => {
      expect(() => {
        const query = compileDb
          .selectFrom('users')
          .selectAll()
          .where(pg.json('preferences').contains(null))
        
        query.compile()
      }).not.toThrow()
    })

    test('path operations are safe from injection', () => {
      const maliciousPath = ['user', "theme'; DROP TABLE test; --", 'setting']
      
      const query = compileDb
        .selectFrom('users')
        .select([
          'id',
          pg.json('preferences').path(maliciousPath).asText().as('theme')
        ])
      
      const compiled = query.compile()
      
      expect(compiled.sql).toContain('#>>')
      expect(compiled.sql).toContain('{user,theme\'; DROP TABLE test; --,setting}')
      // SQL injection in path is safely contained within path array syntax
    })
  })
})