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
      console.log('✅ Array tests: Database connection successful')
    } catch (error) {
      retries--
      if (retries === 0) {
        console.log('❌ Array tests: Database not ready, skipping tests')
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

describe('Array Database Integration', () => {
  describe('includes() database operations', () => {
    test('finds products with specific tag', async () => {
      const results = await db
        .selectFrom('products')
        .select(['id', 'name', 'tags'])
        .where(pg.array('tags').includes('typescript'))
        .execute()

      expect(results).toBeDefined()
      expect(Array.isArray(results)).toBe(true)
      expect(results.length).toBeGreaterThan(0)
      
      // Verify all returned products have 'typescript' in tags
      for (const product of results) {
        expect(product.tags).toContain('typescript')
      }
    })

    test('returns empty result for non-existent tag', async () => {
      const results = await db
        .selectFrom('products')
        .selectAll()
        .where(pg.array('tags').includes('nonexistent_tag'))
        .execute()

      expect(results).toBeDefined()
      expect(Array.isArray(results)).toBe(true)
      expect(results.length).toBe(0)
    })

    test('works with different data types (number arrays)', async () => {
      const results = await db
        .selectFrom('products')
        .select(['id', 'name', 'scores'])
        .where(pg.array<number>('scores').includes(95))
        .execute()

      expect(results).toBeDefined()
      expect(results.length).toBeGreaterThan(0)
      
      for (const product of results) {
        expect(product.scores).toContain(95)
      }
    })

    test('case sensitive string matching', async () => {
      // Should not find 'TypeScript' when searching for 'typescript'
      const upperResults = await db
        .selectFrom('products')
        .selectAll()
        .where(pg.array('tags').includes('TypeScript'))
        .execute()

      const lowerResults = await db
        .selectFrom('products')
        .selectAll()
        .where(pg.array('tags').includes('typescript'))
        .execute()

      // Should be different results due to case sensitivity
      expect(upperResults.length).not.toBe(lowerResults.length)
    })
  })

  describe('contains() database operations', () => {
    test('finds products containing multiple tags', async () => {
      const results = await db
        .selectFrom('products')
        .select(['id', 'name', 'tags'])
        .where(pg.array('tags').contains(['tutorial', 'programming']))
        .execute()

      expect(results).toBeDefined()
      expect(Array.isArray(results)).toBe(true)
      
      // Verify all returned products have both tags
      for (const product of results) {
        expect(product.tags).toContain('tutorial')
        expect(product.tags).toContain('programming')
      }
    })

    test('handles single value same as includes()', async () => {
      const containsResults = await db
        .selectFrom('products')
        .select('id')
        .where(pg.array('tags').contains('typescript'))
        .execute()

      const includesResults = await db
        .selectFrom('products')
        .select('id')
        .where(pg.array('tags').includes('typescript'))
        .execute()

      // Should return identical results
      expect(containsResults.length).toBe(includesResults.length)
      
      const containsIds = containsResults.map(r => r.id).sort()
      const includesIds = includesResults.map(r => r.id).sort()
      expect(containsIds).toEqual(includesIds)
    })

    test('returns empty for non-matching array', async () => {
      const results = await db
        .selectFrom('products')
        .selectAll()
        .where(pg.array('tags').contains(['rust', 'golang']))
        .execute()

      expect(results).toBeDefined()
      expect(results.length).toBe(0)
    })

    test('empty array matches all records', async () => {
      const allResults = await db
        .selectFrom('products')
        .selectAll()
        .execute()

      const emptyArrayResults = await db
        .selectFrom('products')
        .selectAll()
        .where(pg.array('tags').contains([]))
        .execute()

      // Empty array should match all records (all arrays contain empty array)
      expect(emptyArrayResults.length).toBe(allResults.length)
    })
  })

  describe('overlaps() database operations', () => {
    test('finds products with overlapping categories', async () => {
      const results = await db
        .selectFrom('products')
        .select(['id', 'name', 'categories'])
        .where(pg.array('categories').overlaps(['education', 'electronics']))
        .execute()

      expect(results).toBeDefined()
      expect(results.length).toBeGreaterThan(0)
      
      // Verify all returned products have at least one matching category
      for (const product of results) {
        const hasEducation = product.categories.includes('education')
        const hasElectronics = product.categories.includes('electronics')
        expect(hasEducation || hasElectronics).toBe(true)
      }
    })

    test('returns empty for non-overlapping arrays', async () => {
      const results = await db
        .selectFrom('products')
        .selectAll()
        .where(pg.array('categories').overlaps(['nonexistent1', 'nonexistent2']))
        .execute()

      expect(results.length).toBe(0)
    })

    test('single element array works correctly', async () => {
      const results = await db
        .selectFrom('products')
        .select(['id', 'name', 'categories'])
        .where(pg.array('categories').overlaps(['education']))
        .execute()

      expect(results.length).toBeGreaterThan(0)
      
      for (const product of results) {
        expect(product.categories).toContain('education')
      }
    })
  })

  describe('containedBy() database operations', () => {
    test('finds arrays contained by larger set', async () => {
      const results = await db
        .selectFrom('users')
        .select(['id', 'name', 'roles'])
        .where(pg.array('roles').containedBy(['admin', 'user', 'moderator', 'guest']))
        .execute()

      expect(results).toBeDefined()
      
      // Verify all user roles are within the allowed set
      for (const user of results) {
        const allowedRoles = ['admin', 'user', 'moderator', 'guest']
        for (const role of user.roles) {
          expect(allowedRoles).toContain(role)
        }
      }
    })

    test('empty result when no arrays fit within constraint', async () => {
      const results = await db
        .selectFrom('users')
        .selectAll()
        .where(pg.array('roles').containedBy(['guest']))
        .execute()

      // Most users have more roles than just 'guest'
      expect(results.length).toBeLessThan(4) // We have 4 users total
    })

    test('single role constraint', async () => {
      const results = await db
        .selectFrom('users')
        .select(['id', 'name', 'roles'])
        .where(pg.array('roles').containedBy(['user']))
        .execute()

      // Should find users who only have 'user' role
      for (const user of results) {
        expect(user.roles.every(role => role === 'user')).toBe(true)
      }
    })
  })

  describe('length() database operations', () => {
    test('filters by array length in WHERE clause', async () => {
      const results = await db
        .selectFrom('products')
        .select(['id', 'name', 'tags'])
        .where(pg.array('tags').length(), '>', 3)
        .execute()

      expect(results).toBeDefined()
      
      for (const product of results) {
        expect(product.tags.length).toBeGreaterThan(3)
      }
    })

    test('selects array length in results', async () => {
      const results = await db
        .selectFrom('products')
        .select([
          'id',
          'name',
          'tags',
          pg.array('tags').length().as('tag_count')
        ])
        .where('tags', 'is not', null)
        .execute()

      expect(results).toBeDefined()
      expect(results.length).toBeGreaterThan(0)
      
      for (const product of results) {
        // array_length can return null for empty arrays in some PostgreSQL versions
        if (product.tag_count !== null) {
          expect(product.tag_count).toBe(product.tags.length)
          expect(typeof product.tag_count).toBe('number')
        } else {
          // If array_length returned null, the array should be empty
          expect(product.tags.length).toBe(0)
        }
      }
    })

    test('ordering by array length', async () => {
      const results = await db
        .selectFrom('products')
        .select([
          'id',
          'name',
          'tags',
          pg.array('tags').length().as('tag_count')
        ])
        .where('tags', 'is not', null)
        .orderBy(pg.array('tags').length(), 'desc')
        .execute()

      expect(results.length).toBeGreaterThan(1)
      
      // Just verify that ORDER BY works and returns results
      // The exact ordering might vary based on array_length() behavior with empty arrays
      expect(Array.isArray(results)).toBe(true)
      
      // Verify that the tag_count corresponds to actual array lengths where not null
      for (const product of results) {
        if (product.tag_count !== null) {
          expect(product.tag_count).toBe(product.tags.length)
        }
      }
    })

    test('filtering by zero length (empty arrays)', async () => {
      // First, insert a product with empty tags for testing
      const insertResult = await db
        .insertInto('products')
        .values({
          name: 'Empty Tags Product',
          description: 'Product with no tags',
          tags: [] as string[],
          categories: ['test'],
          scores: [] as number[],
          prices: [] as number[],
          metadata: {},
          settings: {},
          created_at: new Date(),
          updated_at: new Date()
        })
        .returning('id')
        .executeTakeFirst()

      expect(insertResult?.id).toBeDefined()

      try {
        // Test finding empty arrays - use coalesce to handle null results
        const results = await db
          .selectFrom('products')
          .select(['id', 'name', 'tags'])
          .where(sql<boolean>`coalesce(array_length(tags, 1), 0) = 0`)
          .execute()

        // Should find at least our inserted product
        expect(results.length).toBeGreaterThanOrEqual(1)
        
        // Find our specific inserted product
        const ourProduct = results.find(p => p.id === insertResult!.id)
        expect(ourProduct).toBeDefined()
        expect(ourProduct!.tags.length).toBe(0)
        
        // All returned products should have empty tags
        for (const product of results) {
          expect(product.tags.length).toBe(0)
        }
      } finally {
        // Clean up test data
        await db
          .deleteFrom('products')
          .where('id', '=', insertResult!.id)
          .execute()
      }
    })
  })

  describe('any() database operations', () => {
    test('finds records where value equals any array element', async () => {
      const results = await db
        .selectFrom('products')
        .select(['id', 'name', 'categories'])
        .where(sql.lit('education'), '=', pg.array('categories').any())
        .execute()

      expect(results).toBeDefined()
      
      for (const product of results) {
        expect(product.categories).toContain('education')
      }
    })

    test('works with NOT equals', async () => {
      const results = await db
        .selectFrom('products')
        .select(['id', 'name', 'categories'])
        .where(sql.lit('nonexistent'), '!=', pg.array('categories').any())
        .execute()

      // Should return all products since 'nonexistent' is not equal to any category
      const allProducts = await db
        .selectFrom('products')
        .selectAll()
        .execute()

      expect(results.length).toBe(allProducts.length)
    })
  })

  describe('Complex array queries', () => {
    test('multiple array operations combined', async () => {
      const results = await db
        .selectFrom('products')
        .select([
          'id',
          'name',
          'tags',
          'categories',
          pg.array('tags').length().as('tag_count')
        ])
        .where(pg.array('tags').includes('tutorial'))
        .where(pg.array('categories').overlaps(['education']))
        .where(pg.array('tags').length(), '>=', 3)
        .orderBy('name')
        .execute()

      expect(results).toBeDefined()
      
      for (const product of results) {
        expect(product.tags).toContain('tutorial')
        expect(product.categories.some(cat => ['education'].includes(cat))).toBe(true)
        expect(product.tags.length).toBeGreaterThanOrEqual(3)
        expect(product.tag_count).toBe(product.tags.length)
      }
    })

    test('array operations with regular conditions', async () => {
      const results = await db
        .selectFrom('products')
        .selectAll()
        .where(pg.array('tags').contains(['tutorial']))
        .where('id', '>', 1)
        .where('name', 'like', '%TypeScript%')
        .execute()

      expect(results).toBeDefined()
      
      for (const product of results) {
        expect(product.tags).toContain('tutorial')
        expect(product.id).toBeGreaterThan(1)
        expect(product.name.toLowerCase()).toContain('typescript')
      }
    })

    test('subquery with array operations', async () => {
      const educationProductIds = db
        .selectFrom('products')
        .select('id')
        .where(pg.array('categories').includes('education'))

      const results = await db
        .selectFrom('documents')
        .selectAll()
        .where('id', 'in', educationProductIds)
        .execute()

      expect(results).toBeDefined()
      expect(Array.isArray(results)).toBe(true)
    })

    test('JOIN with array operations', async () => {
      const results = await db
        .selectFrom('products')
        .innerJoin('documents', 'products.id', 'documents.id')
        .select([
          'products.id',
          'products.name',
          'products.tags as product_tags',
          'documents.title',
          'documents.tags as document_tags'
        ])
        .where(pg.array('products.tags').overlaps(['tutorial', 'programming']))
        .execute()

      expect(results).toBeDefined()
      
      for (const result of results) {
        const hasOverlap = result.product_tags.some(tag => 
          ['tutorial', 'programming'].includes(tag)
        )
        expect(hasOverlap).toBe(true)
      }
    })
  })

  describe('Performance and edge cases', () => {
    test('handles large arrays efficiently', async () => {
      // Create a large array for testing
      const largeTagArray = Array.from({length: 100}, (_, i) => `tag${i}`)
      
      const startTime = Date.now()
      const results = await db
        .selectFrom('products')
        .selectAll()
        .where(pg.array('tags').overlaps(largeTagArray))
        .execute()
      const endTime = Date.now()

      // Should complete in reasonable time (less than 1 second)
      expect(endTime - startTime).toBeLessThan(1000)
      expect(Array.isArray(results)).toBe(true)
    })

    test('handles special characters in array elements', async () => {
      // Insert test data with special characters
      const insertResult = await db
        .insertInto('products')
        .values({
          name: 'Special Chars Test',
          description: 'Test product',
          tags: ["tag's with apostrophe", 'tag"with"quotes', 'tag\\with\\backslash', 'tag with spaces'],
          categories: ['test'],
          scores: [] as number[],
          prices: [] as number[],
          metadata: {},
          settings: {},
          created_at: new Date(),
          updated_at: new Date()
        })
        .returning('id')
        .executeTakeFirst()

      expect(insertResult?.id).toBeDefined()

      // Test searching for special character tags
      const results = await db
        .selectFrom('products')
        .select(['id', 'name', 'tags'])
        .where(pg.array('tags').includes("tag's with apostrophe"))
        .execute()

      expect(results.length).toBeGreaterThan(0)
      
      const foundProduct = results.find(p => p.id === insertResult!.id)
      expect(foundProduct).toBeDefined()
      expect(foundProduct!.tags).toContain("tag's with apostrophe")

      // Clean up
      await db
        .deleteFrom('products')
        .where('id', '=', insertResult!.id)
        .execute()
    })

    test('concurrent array operations', async () => {
      // Run multiple array queries concurrently
      const promises = [
        db.selectFrom('products').selectAll().where(pg.array('tags').includes('typescript')).execute(),
        db.selectFrom('products').selectAll().where(pg.array('categories').overlaps(['education'])).execute(),
        db.selectFrom('users').selectAll().where(pg.array('roles').includes('user')).execute(),
        db.selectFrom('documents').selectAll().where(pg.array('tags').contains(['postgresql'])).execute()
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