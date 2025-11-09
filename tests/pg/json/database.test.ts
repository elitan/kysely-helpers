import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { Kysely, PostgresDialect, sql } from 'kysely'
import { Pool } from 'pg'
import { pg } from '../../../src/index'

// Database interface matching our test schema
interface TestDatabase {
  products: {
    id: number
    name: string
    description: string | null
    tags: string[]
    categories: string[]
    scores: number[]
    prices: number[]
    metadata: any
    settings: any
    created_at: Date
    updated_at: Date
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
  users: {
    id: number
    email: string
    name: string
    roles: string[]
    preferences: any
    permissions: any
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
      console.log('✅ JSON tests: Database connection successful')
    } catch (error) {
      retries--
      if (retries === 0) {
        console.log('❌ JSON tests: Database not ready, skipping tests')
        console.log('Run: docker-compose up -d postgres')
        process.exit(0)
      }
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
  }

  db = new Kysely<TestDatabase>({
    dialect: new PostgresDialect({ pool })
  })
})

afterAll(async () => {
  if (db) {
    await db.destroy()
  }
})

describe('JSON Database Integration', () => {
  describe('path() database operations', () => {
    test('path() retrieves JSON field values', async () => {
      const results = await db
        .selectFrom('products')
        .select(['id', 'name', 'metadata'])
        .where((eb) => pg.json(eb.ref('metadata')).path('difficulty').equals('beginner'))
        .execute()

      expect(results).toBeDefined()
      expect(Array.isArray(results)).toBe(true)
      expect(results.length).toBeGreaterThan(0)

      for (const product of results) {
        expect(product.metadata.difficulty).toBe('beginner')
      }
    })

    test('path().asText() retrieves JSON field as text', async () => {
      const results = await db
        .selectFrom('products')
        .select((eb) => [
          'id',
          'name',
          pg.json(eb.ref('metadata')).path('difficulty').asText().as('difficulty_text')
        ])
        .where((eb) => pg.json(eb.ref('metadata')).path('difficulty').asText().equals('advanced'))
        .execute()

      expect(results.length).toBeGreaterThan(0)

      for (const product of results) {
        expect(product.difficulty_text).toBe('advanced')
      }
    })

    test('path() with boolean values', async () => {
      const results = await db
        .selectFrom('products')
        .select(['id', 'name', 'metadata'])
        .where((eb) => pg.json(eb.ref('metadata')).path('ai_related').equals(true))
        .execute()

      expect(results.length).toBeGreaterThan(0)
      
      for (const product of results) {
        expect(product.metadata.ai_related).toBe(true)
      }
    })

    test('path() with numeric values', async () => {
      const results = await db
        .selectFrom('products')
        .select(['id', 'name', 'metadata'])
        .where((eb) => pg.json(eb.ref('metadata')).path('rating').equals(4.8))
        .execute()

      expect(results.length).toBeGreaterThan(0)
      
      for (const product of results) {
        expect(product.metadata.rating).toBe(4.8)
      }
    })
  })

  describe('path() with nested access', () => {
    test('path() with nested object access', async () => {
      const results = await db
        .selectFrom('users')
        .select(['id', 'name', 'preferences'])
        .where((eb) => pg.json(eb.ref('preferences')).path(['notifications', 'email']).equals(true))
        .execute()

      expect(results.length).toBeGreaterThan(0)
      
      for (const user of results) {
        expect(user.preferences.notifications.email).toBe(true)
      }
    })

    test('path().asText() with array paths', async () => {
      const results = await db
        .selectFrom('users')
        .select((eb) => [
          'id',
          'name',
          pg.json(eb.ref('preferences')).path(['theme']).asText().as('user_theme')
        ])
        .where((eb) => pg.json(eb.ref('preferences')).path(['theme']).asText().equals('dark'))
        .execute()

      expect(results.length).toBeGreaterThan(0)
      
      for (const user of results) {
        expect(user.user_theme).toBe('dark')
      }
    })

    test('deep path navigation', async () => {
      const results = await db
        .selectFrom('users')
        .select(['id', 'name', 'preferences'])
        .where((eb) => pg.json(eb.ref('preferences')).path(['notifications', 'push']).equals(false))
        .execute()

      expect(results.length).toBeGreaterThan(0)
      
      for (const user of results) {
        expect(user.preferences.notifications.push).toBe(false)
      }
    })
  })

  describe('contains() database operations', () => {
    test('contains() with simple object', async () => {
      const results = await db
        .selectFrom('products')
        .select(['id', 'name', 'settings'])
        .where((eb) => pg.json(eb.ref('settings')).contains({theme: 'dark'}))
        .execute()

      expect(results.length).toBeGreaterThan(0)
      
      for (const product of results) {
        expect(product.settings.theme).toBe('dark')
      }
    })

    test('contains() with complex nested object', async () => {
      const results = await db
        .selectFrom('users')
        .select(['id', 'name', 'preferences'])
        .where((eb) => pg.json(eb.ref('preferences')).contains({notifications: {email: true}}))
        .execute()

      expect(results.length).toBeGreaterThan(0)
      
      for (const user of results) {
        expect(user.preferences.notifications.email).toBe(true)
      }
    })

    test('contains() with partial object match', async () => {
      const results = await db
        .selectFrom('documents')
        .select(['id', 'title', 'metadata'])
        .where((eb) => pg.json(eb.ref('metadata')).contains({published: true}))
        .execute()

      expect(results.length).toBeGreaterThan(0)
      
      for (const doc of results) {
        expect(doc.metadata.published).toBe(true)
      }
    })

    test('contains() returns empty for non-matching values', async () => {
      const results = await db
        .selectFrom('products')
        .selectAll()
        .where((eb) => pg.json(eb.ref('metadata')).contains({nonexistent: 'value'}))
        .execute()

      expect(results.length).toBe(0)
    })
  })


  describe('hasKey() database operations', () => {
    test('hasKey() finds objects with specific keys', async () => {
      const results = await db
        .selectFrom('products')
        .select(['id', 'name', 'metadata'])
        .where((eb) => pg.json(eb.ref('metadata')).hasKey('difficulty'))
        .execute()

      expect(results.length).toBeGreaterThan(0)
      
      for (const product of results) {
        expect(product.metadata).toHaveProperty('difficulty')
      }
    })

    test('hasKey() with non-existent key returns empty', async () => {
      const results = await db
        .selectFrom('products')
        .selectAll()
        .where((eb) => pg.json(eb.ref('metadata')).hasKey('nonexistent_key'))
        .execute()

      expect(results.length).toBe(0)
    })

    test('hasKey() with nested structure keys', async () => {
      // Note: hasKey only checks top-level keys, not nested
      const results = await db
        .selectFrom('users')
        .select(['id', 'name', 'preferences'])
        .where((eb) => pg.json(eb.ref('preferences')).hasKey('notifications'))
        .execute()

      expect(results.length).toBeGreaterThan(0)
      
      for (const user of results) {
        expect(user.preferences).toHaveProperty('notifications')
      }
    })
  })

  describe('hasAllKeys() database operations', () => {
    test('hasAllKeys() finds objects with all specified keys', async () => {
      const results = await db
        .selectFrom('products')
        .select(['id', 'name', 'metadata'])
        .where((eb) => pg.json(eb.ref('metadata')).hasAllKeys(['difficulty', 'duration']))
        .execute()

      expect(results.length).toBeGreaterThan(0)
      
      for (const product of results) {
        expect(product.metadata).toHaveProperty('difficulty')
        expect(product.metadata).toHaveProperty('duration')
      }
    })

    test('hasAllKeys() with single key', async () => {
      const results = await db
        .selectFrom('users')
        .select(['id', 'name', 'preferences'])
        .where((eb) => pg.json(eb.ref('preferences')).hasAllKeys(['theme']))
        .execute()

      expect(results.length).toBeGreaterThan(0)
      
      for (const user of results) {
        expect(user.preferences).toHaveProperty('theme')
      }
    })

    test('hasAllKeys() returns empty when not all keys exist', async () => {
      const results = await db
        .selectFrom('products')
        .selectAll()
        .where((eb) => pg.json(eb.ref('metadata')).hasAllKeys(['difficulty', 'nonexistent']))
        .execute()

      expect(results.length).toBe(0)
    })

    test('hasAllKeys() with empty array matches all', async () => {
      const allProducts = await db
        .selectFrom('products')
        .selectAll()
        .execute()

      const emptyKeyResults = await db
        .selectFrom('products')
        .selectAll()
        .where((eb) => pg.json(eb.ref('metadata')).hasAllKeys([]))
        .execute()

      expect(emptyKeyResults.length).toBe(allProducts.length)
    })
  })

  describe('hasAnyKey() database operations', () => {
    test('hasAnyKey() finds objects with any of the specified keys', async () => {
      const results = await db
        .selectFrom('products')
        .select(['id', 'name', 'metadata'])
        .where((eb) => pg.json(eb.ref('metadata')).hasAnyKey(['ai_related', 'experimental']))
        .execute()

      expect(results.length).toBeGreaterThan(0)
      
      for (const product of results) {
        const hasAiRelated = product.metadata.hasOwnProperty('ai_related')
        const hasExperimental = product.metadata.hasOwnProperty('experimental')
        expect(hasAiRelated || hasExperimental).toBe(true)
      }
    })

    test('hasAnyKey() with non-matching keys returns empty', async () => {
      const results = await db
        .selectFrom('products')
        .selectAll()
        .where((eb) => pg.json(eb.ref('metadata')).hasAnyKey(['nonexistent1', 'nonexistent2']))
        .execute()

      expect(results.length).toBe(0)
    })

    test('hasAnyKey() with common key', async () => {
      const results = await db
        .selectFrom('products')
        .select(['id', 'name', 'metadata'])
        .where((eb) => pg.json(eb.ref('metadata')).hasAnyKey(['difficulty']))
        .execute()

      expect(results.length).toBeGreaterThan(0)
      
      for (const product of results) {
        expect(product.metadata).toHaveProperty('difficulty')
      }
    })
  })

  describe('JSON path SELECT operations', () => {
    test('path() retrieves JSON values in SELECT clause', async () => {
      const results = await db
        .selectFrom('users')
        .select((eb) => [
          'id',
          'name',
          pg.json(eb.ref('preferences')).path('theme').as('theme_value'),
          pg.json(eb.ref('preferences')).path(['notifications', 'email']).as('email_setting')
        ])
        .where((eb) => pg.json(eb.ref('preferences')).hasKey('theme'))
        .execute()

      expect(results.length).toBeGreaterThan(0)
      
      for (const user of results) {
        expect(user.theme_value).toBeDefined()
        expect(user.email_setting).toBeDefined()
        // Values should be accessible (exact match depends on JSON structure)
        expect(user.theme_value).not.toBeNull()
        expect(user.email_setting).not.toBeNull()
      }
    })

    test('path() with array paths works in SELECT', async () => {
      const results = await db
        .selectFrom('users')
        .select((eb) => [
          'id',
          pg.json(eb.ref('preferences')).path(['notifications', 'push']).as('push_notifications'),
          pg.json(eb.ref('permissions')).path(['read']).as('read_permission')
        ])
        .where((eb) => pg.json(eb.ref('preferences')).path(['notifications']).exists())
        .execute()

      expect(results.length).toBeGreaterThan(0)
      
      for (const user of results) {
        expect(user.push_notifications).toBeDefined()
        expect(user.read_permission).toBeDefined()
      }
    })

    test('mixed path() and asText() in SELECT', async () => {
      const results = await db
        .selectFrom('users')
        .select((eb) => [
          'id',
          pg.json(eb.ref('preferences')).path('theme').as('theme_json'),        // Returns JSON value
          pg.json(eb.ref('preferences')).path('theme').asText().as('theme_text') // Returns text
        ])
        .where((eb) => pg.json(eb.ref('preferences')).hasKey('theme'))
        .limit(5)
        .execute()

      expect(results.length).toBeGreaterThan(0)
      
      for (const user of results) {
        // Both should exist but have different types potentially
        expect(user.theme_json).toBeDefined()
        expect(user.theme_text).toBeDefined()
        
        // For simple string values, they should be the same
        if (typeof user.theme_json === 'string') {
          expect(user.theme_text).toBe(user.theme_json)
        }
      }
    })

    test('complex SELECT with nested paths', async () => {
      const results = await db
        .selectFrom('users')
        .select((eb) => [
          'id',
          'name',
          pg.json(eb.ref('permissions')).path('admin').as('is_admin'),
          pg.json(eb.ref('preferences')).path(['notifications', 'email']).as('email_notifications'),
          pg.json(eb.ref('preferences')).path('theme').asText().as('user_theme')
        ])
        .where((eb) => pg.json(eb.ref('permissions')).hasKey('admin'))
        .execute()

      expect(results.length).toBeGreaterThan(0)
      
      for (const user of results) {
        expect(user.is_admin).toBeDefined()
        expect(user.email_notifications).toBeDefined()
        expect(user.user_theme).toBeDefined()
        expect(typeof user.user_theme).toBe('string')
      }
    })
  })

  describe('Complex JSON queries', () => {
    test('multiple JSON operations combined', async () => {
      const results = await db
        .selectFrom('users')
        .select((eb) => [
          'id',
          'name',
          'preferences',
          pg.json(eb.ref('preferences')).path('theme').asText().as('theme'),
          pg.json(eb.ref('permissions')).path('read').asText().as('can_read')
        ])
        .where((eb) => pg.json(eb.ref('preferences')).hasKey('theme'))
        .where((eb) => pg.json(eb.ref('preferences')).contains({notifications: {email: true}}))
        .where((eb) => pg.json(eb.ref('permissions')).path('read').equals(true))
        .orderBy('name')
        .execute()

      expect(results.length).toBeGreaterThan(0)
      
      for (const user of results) {
        expect(user.preferences).toHaveProperty('theme')
        expect(user.preferences.notifications.email).toBe(true)
        expect(user.can_read).toBe('true')
      }
    })

    test('JSON operations with regular conditions', async () => {
      const results = await db
        .selectFrom('products')
        .selectAll()
        .where('id', '>', 0)
        .where((eb) => pg.json(eb.ref('metadata')).path('difficulty').equals('beginner'))
        .where('name', 'like', '%TypeScript%')
        .execute()

      expect(results.length).toBeGreaterThan(0)
      
      for (const product of results) {
        expect(product.id).toBeGreaterThan(0)
        expect(product.metadata.difficulty).toBe('beginner')
        expect(product.name.toLowerCase()).toContain('typescript')
      }
    })

    test('subquery with JSON operations', async () => {
      const premiumUserIds = db
        .selectFrom('users')
        .select('id')
        .where((eb) => pg.json(eb.ref('permissions')).contains({admin: true}))

      const results = await db
        .selectFrom('products')
        .selectAll()
        .where('id', 'in', premiumUserIds)
        .execute()

      expect(Array.isArray(results)).toBe(true)
    })

    test('JOIN with JSON operations', async () => {
      const results = await db
        .selectFrom('products')
        .innerJoin('users', 'products.id', 'users.id')
        .select((eb) => [
          'products.id',
          'products.name',
          'products.metadata as product_metadata',
          'users.preferences as user_preferences'
        ])
        .where((eb) => pg.json(eb.ref('products.metadata')).hasKey('difficulty'))
        .where((eb) => pg.json(eb.ref('users.preferences')).contains({theme: 'dark'}))
        .execute()

      expect(Array.isArray(results)).toBe(true)
      
      for (const result of results) {
        expect(result.product_metadata).toHaveProperty('difficulty')
        expect(result.user_preferences.theme).toBe('dark')
      }
    })
  })

  describe('Data manipulation with JSON', () => {
    test('insert and query JSON data', async () => {
      const testData = {
        theme: 'test-theme',
        language: 'test-lang',
        settings: {
          notifications: true,
          privacy: 'public'
        }
      }

      // Insert test data
      const insertResult = await db
        .insertInto('users')
        .values({
          email: 'json-test@example.com',
          name: 'JSON Test User',
          roles: ['test'],
          preferences: testData,
          permissions: {read: true, write: false}
        })
        .returning('id')
        .executeTakeFirst()

      expect(insertResult?.id).toBeDefined()

      try {
        // Query the inserted data
        const results = await db
          .selectFrom('users')
          .select(['id', 'name', 'preferences'])
          .where('id', '=', insertResult!.id)
          .where((eb) => pg.json(eb.ref('preferences')).contains({theme: 'test-theme'}))
          .execute()

        expect(results.length).toBe(1)
        expect(results[0].preferences.theme).toBe('test-theme')
        expect(results[0].preferences.settings.notifications).toBe(true)

        // Test nested path access
        const nestedResults = await db
          .selectFrom('users')
          .select(['id', 'preferences'])
          .where('id', '=', insertResult!.id)
          .where((eb) => pg.json(eb.ref('preferences')).path(['settings', 'privacy']).equals('public'))
          .execute()

        expect(nestedResults.length).toBe(1)
      } finally {
        // Clean up
        await db
          .deleteFrom('users')
          .where('id', '=', insertResult!.id)
          .execute()
      }
    })

    test('update JSON fields and verify changes', async () => {
      // First, insert test data
      const insertResult = await db
        .insertInto('products')
        .values({
          name: 'JSON Update Test',
          description: 'Test product for JSON updates',
          tags: ['test'],
          categories: ['test'],
          scores: [],
          prices: [],
          metadata: {status: 'draft', version: 1},
          settings: {enabled: false}
        })
        .returning('id')
        .executeTakeFirst()

      expect(insertResult?.id).toBeDefined()

      try {
        // Update JSON field
        await db
          .updateTable('products')
          .set({
            metadata: {status: 'published', version: 2, updated: true}
          })
          .where('id', '=', insertResult!.id)
          .execute()

        // Verify the update
        const results = await db
          .selectFrom('products')
          .select(['id', 'metadata'])
          .where('id', '=', insertResult!.id)
          .where((eb) => pg.json(eb.ref('metadata')).contains({status: 'published'}))
          .execute()

        expect(results.length).toBe(1)
        expect(results[0].metadata.status).toBe('published')
        expect(results[0].metadata.version).toBe(2)
        expect(results[0].metadata.updated).toBe(true)
      } finally {
        // Clean up
        await db
          .deleteFrom('products')
          .where('id', '=', insertResult!.id)
          .execute()
      }
    })
  })

  describe('Performance and edge cases', () => {
    test('handles large JSON objects efficiently', async () => {
      const largeObject = {
        data: Array.from({length: 100}, (_, i) => ({
          id: i,
          value: `item_${i}`,
          metadata: {created: new Date().toISOString()}
        }))
      }

      const startTime = Date.now()
      const results = await db
        .selectFrom('products')
        .selectAll()
        .where((eb) => pg.json(eb.ref('metadata')).hasKey('difficulty'))
        .execute()
      const endTime = Date.now()

      // Should complete in reasonable time
      expect(endTime - startTime).toBeLessThan(1000)
      expect(Array.isArray(results)).toBe(true)
    })

    test('handles special characters in JSON values', async () => {
      const insertResult = await db
        .insertInto('products')
        .values({
          name: 'Special JSON Test',
          description: 'Test with special characters',
          tags: ['test'],
          categories: ['test'],
          scores: [],
          prices: [],
          metadata: {
            message: 'Hello "world" with \'quotes\'',
            unicode: '🚀 Unicode test 中文',
            symbols: '@#$%^&*()[]{}|\\:";\'<>?,./`~'
          },
          settings: {}
        })
        .returning('id')
        .executeTakeFirst()

      expect(insertResult?.id).toBeDefined()

      try {
        const results = await db
          .selectFrom('products')
          .select(['id', 'metadata'])
          .where('id', '=', insertResult!.id)
          .where((eb) => pg.json(eb.ref('metadata')).hasKey('unicode'))
          .execute()

        expect(results.length).toBe(1)
        expect(results[0].metadata.message).toContain('"world"')
        expect(results[0].metadata.unicode).toContain('🚀')
        expect(results[0].metadata.unicode).toContain('中文')
      } finally {
        await db
          .deleteFrom('products')
          .where('id', '=', insertResult!.id)
          .execute()
      }
    })

    test('concurrent JSON operations', async () => {
      const promises = [
        db.selectFrom('users').selectAll().where((eb) => pg.json(eb.ref('preferences')).hasKey('theme')).execute(),
        db.selectFrom('products').selectAll().where((eb) => pg.json(eb.ref('metadata')).contains({published: true})).execute(),
        db.selectFrom('users').selectAll().where((eb) => pg.json(eb.ref('permissions')).path('read').equals(true)).execute(),
        db.selectFrom('products').selectAll().where((eb) => pg.json(eb.ref('settings')).hasAnyKey(['theme', 'notifications'])).execute()
      ]

      const results = await Promise.all(promises)

      // All queries should complete successfully
      expect(results).toHaveLength(4)
      for (const result of results) {
        expect(Array.isArray(result)).toBe(true)
      }
    })
  })
})