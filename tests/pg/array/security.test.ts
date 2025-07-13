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
  products: {
    id: number
    name: string
    tags: string[]
    categories: string[]
    scores: number[]
  }
}

// Test dialect for SQL compilation
class TestDialect {
  createAdapter() { return new PostgresAdapter() }
  createDriver() { return new DummyDriver() }
  createQueryCompiler() { return new PostgresQueryCompiler() }
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
    console.log('✅ Security tests: Database connection available')
  } catch (error) {
    console.log('⚠️ Security tests: Database not available, running compilation tests only')
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

describe('Array Security Tests', () => {
  describe('SQL Injection Prevention - Compilation Tests', () => {
    test('malicious SQL in includes() is parameterized', () => {
      const maliciousInput = "'; DROP TABLE products; --"
      
      const query = compileDb
        .selectFrom('products')
        .selectAll()
        .where(pg.array('tags').includes(maliciousInput))
      
      const compiled = query.compile()
      
      // The malicious input should be parameterized, not directly in SQL
      expect(compiled.sql).not.toContain('DROP TABLE')
      expect(compiled.sql).not.toContain('--')
      expect(compiled.sql).toContain('$1')
      expect(compiled.parameters).toEqual([maliciousInput])
    })

    test('malicious SQL in contains() array is parameterized', () => {
      const maliciousArray = [
        "'; DELETE FROM products; --",
        "' OR 1=1; --",
        "'; SELECT * FROM users; --"
      ]
      
      const query = compileDb
        .selectFrom('products')
        .selectAll()
        .where(pg.array('tags').contains(maliciousArray))
      
      const compiled = query.compile()
      
      // None of the SQL injection attempts should appear in the compiled SQL
      expect(compiled.sql).not.toContain('DELETE FROM')
      expect(compiled.sql).not.toContain('OR 1=1')
      expect(compiled.sql).not.toContain('SELECT * FROM users')
      expect(compiled.sql).not.toContain('--')
      
      // All values should be parameters
      expect(compiled.parameters).toEqual(maliciousArray)
      maliciousArray.forEach((_, index) => {
        expect(compiled.sql).toContain(`$${index + 1}`)
      })
    })

    test('SQL injection in overlaps() is prevented', () => {
      const maliciousValues = [
        "admin'; DROP DATABASE test; --",
        "'; GRANT ALL ON *.* TO 'hacker'@'%'; --"
      ]
      
      const query = compileDb
        .selectFrom('products')
        .selectAll()
        .where(pg.array('categories').overlaps(maliciousValues))
      
      const compiled = query.compile()
      
      expect(compiled.sql).not.toContain('DROP DATABASE')
      expect(compiled.sql).not.toContain('GRANT ALL')
      expect(compiled.parameters).toEqual(maliciousValues)
    })

    test('SQL injection in containedBy() is prevented', () => {
      const maliciousConstraints = [
        "allowed'; UPDATE products SET price = 0; --",
        "valid'; INSERT INTO admin_users VALUES ('hacker'); --"
      ]
      
      const query = compileDb
        .selectFrom('products')
        .selectAll()
        .where(pg.array('tags').containedBy(maliciousConstraints))
      
      const compiled = query.compile()
      
      expect(compiled.sql).not.toContain('UPDATE products')
      expect(compiled.sql).not.toContain('INSERT INTO admin_users')
      expect(compiled.parameters).toEqual(maliciousConstraints)
    })

    test('union-based SQL injection attempts are parameterized', () => {
      const unionAttack = "tag' UNION SELECT password FROM users --"
      
      const query = compileDb
        .selectFrom('products')
        .selectAll()
        .where(pg.array('tags').includes(unionAttack))
      
      const compiled = query.compile()
      
      expect(compiled.sql).not.toContain('UNION SELECT')
      expect(compiled.sql).not.toContain('FROM users')
      expect(compiled.parameters).toEqual([unionAttack])
    })

    test('nested query injection attempts are parameterized', () => {
      const nestedAttack = "tag'; SELECT COUNT(*) FROM (SELECT * FROM sensitive_data) AS x; --"
      
      const query = compileDb
        .selectFrom('products')
        .selectAll()
        .where(pg.array('tags').contains([nestedAttack]))
      
      const compiled = query.compile()
      
      expect(compiled.sql).not.toContain('sensitive_data')
      expect(compiled.sql).not.toContain('COUNT(*)')
      expect(compiled.parameters).toEqual([nestedAttack])
    })

    test('time-based injection attempts are parameterized', () => {
      const timeAttack = "tag'; WAITFOR DELAY '00:00:05'; --"
      
      const query = compileDb
        .selectFrom('products')
        .selectAll()
        .where(pg.array('tags').includes(timeAttack))
      
      const compiled = query.compile()
      
      expect(compiled.sql).not.toContain('WAITFOR')
      expect(compiled.sql).not.toContain('DELAY')
      expect(compiled.parameters).toEqual([timeAttack])
    })
  })

  describe('Special Character Handling', () => {
    test('single quotes are properly escaped', () => {
      const valueWithQuotes = "O'Reilly's JavaScript Guide"
      
      const query = compileDb
        .selectFrom('products')
        .selectAll()
        .where(pg.array('tags').includes(valueWithQuotes))
      
      const compiled = query.compile()
      
      expect(compiled.sql).toContain('$1')
      expect(compiled.parameters).toEqual([valueWithQuotes])
    })

    test('double quotes are properly handled', () => {
      const valueWithDoubleQuotes = 'Book: "Advanced PostgreSQL"'
      
      const query = compileDb
        .selectFrom('products')
        .selectAll()
        .where(pg.array('tags').includes(valueWithDoubleQuotes))
      
      const compiled = query.compile()
      
      expect(compiled.parameters).toEqual([valueWithDoubleQuotes])
    })

    test('backslashes are properly handled', () => {
      const valueWithBackslashes = 'C:\\Users\\Admin\\file.txt'
      
      const query = compileDb
        .selectFrom('products')
        .selectAll()
        .where(pg.array('tags').includes(valueWithBackslashes))
      
      const compiled = query.compile()
      
      expect(compiled.parameters).toEqual([valueWithBackslashes])
    })

    test('null bytes are handled safely', () => {
      const valueWithNullByte = 'normal_value\0malicious'
      
      const query = compileDb
        .selectFrom('products')
        .selectAll()
        .where(pg.array('tags').includes(valueWithNullByte))
      
      const compiled = query.compile()
      
      expect(compiled.parameters).toEqual([valueWithNullByte])
    })

    test('unicode characters are preserved', () => {
      const unicodeValues = ['🚀 rocket', '中文字符', 'émojï tëst', 'Ñoël']
      
      const query = compileDb
        .selectFrom('products')
        .selectAll()
        .where(pg.array('tags').overlaps(unicodeValues))
      
      const compiled = query.compile()
      
      expect(compiled.parameters).toEqual(unicodeValues)
    })

    test('control characters are handled', () => {
      const controlChars = 'value\t\n\r\b\f'
      
      const query = compileDb
        .selectFrom('products')
        .selectAll()
        .where(pg.array('tags').includes(controlChars))
      
      const compiled = query.compile()
      
      expect(compiled.parameters).toEqual([controlChars])
    })
  })

  describe('Edge Cases and Error Conditions', () => {
    test('extremely long strings are handled safely', () => {
      const longString = 'a'.repeat(10000)
      
      const query = compileDb
        .selectFrom('products')
        .selectAll()
        .where(pg.array('tags').includes(longString))
      
      const compiled = query.compile()
      
      expect(compiled.parameters).toEqual([longString])
      expect(compiled.sql).toContain('$1')
    })

    test('empty strings are handled correctly', () => {
      const emptyString = ''
      
      const query = compileDb
        .selectFrom('products')
        .selectAll()
        .where(pg.array('tags').includes(emptyString))
      
      const compiled = query.compile()
      
      expect(compiled.parameters).toEqual([emptyString])
    })

    test('arrays with mixed dangerous content are all parameterized', () => {
      const dangerousArray = [
        "'; DROP TABLE users; --",
        "normal_tag",
        "'; INSERT INTO logs VALUES ('hack attempt'); --",
        "",
        "tag with spaces",
        "'; CREATE USER hacker; --"
      ]
      
      const query = compileDb
        .selectFrom('products')
        .selectAll()
        .where(pg.array('tags').contains(dangerousArray))
      
      const compiled = query.compile()
      
      // All dangerous SQL should be absent
      expect(compiled.sql).not.toContain('DROP TABLE')
      expect(compiled.sql).not.toContain('INSERT INTO logs')
      expect(compiled.sql).not.toContain('CREATE USER')
      
      // All values should be parameters
      expect(compiled.parameters).toEqual(dangerousArray)
      dangerousArray.forEach((_, index) => {
        expect(compiled.sql).toContain(`$${index + 1}`)
      })
    })

    test('SQL keywords as legitimate values are preserved', () => {
      const sqlKeywords = ['SELECT', 'FROM', 'WHERE', 'INSERT', 'UPDATE', 'DELETE']
      
      const query = compileDb
        .selectFrom('products')
        .selectAll()
        .where(pg.array('tags').overlaps(sqlKeywords))
      
      const compiled = query.compile()
      
      // Keywords should be parameterized when used as values
      expect(compiled.parameters).toEqual(sqlKeywords)
      
      // But should not appear as unparameterized SQL
      const sqlWithoutArrayOperator = compiled.sql.replace('"tags" && ARRAY[', '')
      sqlKeywords.forEach(keyword => {
        expect(sqlWithoutArrayOperator).not.toContain(keyword)
      })
    })
  })

  describe('Real Database Security Tests', () => {
    // Only run these if we have a database connection
    const itWithDb = integrationDb ? test : test.skip

    itWithDb('SQL injection attempts fail safely in real database', async () => {
      if (!integrationDb) return

      const maliciousInputs = [
        "'; DROP TABLE IF EXISTS temp_hack; --",
        "' OR 1=1; --",
        "'; SELECT pg_sleep(5); --"
      ]

      // These should all execute without error and return empty results
      for (const maliciousInput of maliciousInputs) {
        const results = await integrationDb
          .selectFrom('products')
          .selectAll()
          .where(pg.array('tags').includes(maliciousInput))
          .execute()

        expect(Array.isArray(results)).toBe(true)
        expect(results.length).toBe(0) // No products should match malicious inputs
      }

      // Database should still be intact
      const healthCheck = await integrationDb
        .selectFrom('products')
        .select('id')
        .limit(1)
        .execute()

      expect(Array.isArray(healthCheck)).toBe(true)
    })

    itWithDb('special characters work correctly in real database', async () => {
      if (!integrationDb) return

      const specialChars = [
        "O'Reilly",
        'Book: "Advanced SQL"',
        'Path: C:\\Windows\\System32',
        '🚀 Unicode Test 中文',
        'Line1\nLine2\tTab'
      ]

      // Insert test data with special characters
      const insertResult = await integrationDb
        .insertInto('products')
        .values({
          name: 'Special Chars Test',
          tags: specialChars,
          categories: ['test'],
          scores: []
        })
        .returning('id')
        .executeTakeFirst()

      expect(insertResult?.id).toBeDefined()

      try {
        // Test searching for each special character
        for (const specialChar of specialChars) {
          const results = await integrationDb
            .selectFrom('products')
            .select(['id', 'name', 'tags'])
            .where(pg.array('tags').includes(specialChar))
            .execute()

          expect(results.length).toBeGreaterThan(0)
          
          const foundProduct = results.find(p => p.id === insertResult!.id)
          expect(foundProduct).toBeDefined()
          expect(foundProduct!.tags).toContain(specialChar)
        }
      } finally {
        // Clean up
        await integrationDb
          .deleteFrom('products')
          .where('id', '=', insertResult!.id)
          .execute()
      }
    })

    itWithDb('concurrent injection attempts are handled safely', async () => {
      if (!integrationDb) return

      const maliciousQueries = [
        "'; DROP TABLE products; --",
        "' UNION SELECT * FROM pg_database; --",
        "'; INSERT INTO products (name) VALUES ('hacked'); --",
        "' OR '1'='1'; --"
      ]

      // Run multiple malicious queries concurrently
      const promises = maliciousQueries.map(maliciousQuery =>
        integrationDb!
          .selectFrom('products')
          .selectAll()
          .where(pg.array('tags').includes(maliciousQuery))
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
        .selectFrom('products')
        .select('id')
        .execute()

      expect(Array.isArray(healthCheck)).toBe(true)
    })

    itWithDb('parameter limit stress test', async () => {
      if (!integrationDb) return

      // Create an array with many elements to test parameter handling
      const manyTags = Array.from({length: 50}, (_, i) => `tag${i}`)
      
      const results = await integrationDb
        .selectFrom('products')
        .selectAll()
        .where(pg.array('tags').overlaps(manyTags))
        .execute()

      // Should execute without error
      expect(Array.isArray(results)).toBe(true)
    })
  })

  describe('Column Reference Security', () => {
    test('column names are properly quoted', () => {
      const query = compileDb
        .selectFrom('products')
        .selectAll()
        .where(pg.array('tags').includes('test'))
      
      const compiled = query.compile()
      
      // Column names should be quoted
      expect(compiled.sql).toContain('"tags"')
      expect(compiled.sql).not.toContain('tags @>') // Should not have unquoted column
    })

    test('qualified column names are properly quoted', () => {
      const query = compileDb
        .selectFrom('products')
        .selectAll()
        .where(pg.array('products.tags').includes('test'))
      
      const compiled = query.compile()
      
      expect(compiled.sql).toContain('"products"."tags"')
    })

    test('malicious column names cannot cause injection', () => {
      // Even if someone tried to pass a malicious "column" name, it would be quoted
      const query = compileDb
        .selectFrom('products')
        .selectAll()
        .where(pg.array('tags"; DROP TABLE users; --').includes('test'))
      
      const compiled = query.compile()
      
      // The malicious column name would be quoted as a single identifier, making it harmless
      // The injection code appears in quotes, so it's treated as a column name, not executable SQL
      expect(compiled.sql).toContain('"tags\"\"; DROP TABLE users; --" @>')
      
      // The value should still be properly parameterized
      expect(compiled.parameters).toEqual(['test'])
      
      // SQL should still be valid (no syntax errors from injection)
      expect(compiled.sql).toContain('select * from "products"')
      expect(compiled.sql).toContain('ARRAY[$1]')
    })
  })

  describe('Type Safety and Validation', () => {
    test('empty arrays generate safe SQL', () => {
      const query = compileDb
        .selectFrom('products')
        .selectAll()
        .where(pg.array('tags').contains([]))
      
      const compiled = query.compile()
      
      expect(compiled.sql).toContain('ARRAY[]::text[]')
      expect(compiled.parameters).toEqual([])
    })

    test('null handling is safe', () => {
      // Test that null values in arrays don't cause issues
      expect(() => {
        const query = compileDb
          .selectFrom('products')
          .selectAll()
          .where(pg.array('tags').includes('null'))
        
        query.compile()
      }).not.toThrow()
    })

    test('length operations are safe from injection', () => {
      const query = compileDb
        .selectFrom('products')
        .select([
          'id',
          pg.array('tags').length().as('tag_count')
        ])
        .where(pg.array('tags').length(), '>', 0)
      
      const compiled = query.compile()
      
      expect(compiled.sql).toContain('coalesce(array_length("tags", 1), 0)')
      expect(compiled.sql).not.toContain('array_length(tags')
    })
  })
})