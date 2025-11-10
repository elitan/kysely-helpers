import { describe, test, expect } from 'bun:test'
import { pg } from '../../../src/index'

// Define a test database schema
interface Database {
  products: {
    id: number
    name: string
    tags: string[]
    category_ids: number[]
    is_featured: boolean
    metadata: Record<string, any>
  }
  users: {
    id: number
    email: string
    roles: string[]
    preferences: boolean[]
  }
}

describe('Array Type Safety', () => {
  describe('BUG: String usage should NOT compile (but currently does)', () => {
    test('FAILING TEST: string column references should be rejected', () => {
      // These currently compile but shouldn't after fix
      // @ts-expect-error - After fix: string usage should not be allowed
      const tagsOp = pg.array('tags')

      // @ts-expect-error - After fix: string usage should not be allowed
      const categoryOp = pg.array('category_ids')

      expect(tagsOp).toBeDefined()
      expect(categoryOp).toBeDefined()
    })

    test('FAILING TEST: should reject non-existent columns (currently no error)', () => {
      // Currently compiles without error - BAD!
      // @ts-expect-error - After fix: should error for invalid column
      const invalidOp = pg.array<Database, 'products'>('invalid_column')

      expect(invalidOp).toBeDefined()
    })

    test('FAILING TEST: should reject non-array columns (currently no error)', () => {
      // Currently compiles without error - BAD!
      // @ts-expect-error - After fix: 'name' is string, not array
      const nameOp = pg.array<Database, 'products'>('name')

      // @ts-expect-error - After fix: 'is_featured' is boolean, not array
      const featuredOp = pg.array<Database, 'products'>('is_featured')

      expect(nameOp).toBeDefined()
      expect(featuredOp).toBeDefined()
    })
  })

  describe('CORRECT: Expression builder pattern should work', () => {
    test('should accept eb.ref() with valid array columns', () => {
      // Mock expression builder that returns proper type
      const eb = {
        ref: (column: string) => ({
          __ref: column,
          // Simulate Kysely's ReferenceExpression structure
        })
      } as any

      // These should work after fix
      const tagsOp = pg(eb).array('products.tags')
      const categoryOp = pg(eb).array('products.category_ids')
      const rolesOp = pg(eb).array('users.roles')

      expect(tagsOp).toBeDefined()
      expect(categoryOp).toBeDefined()
      expect(rolesOp).toBeDefined()
    })

    test('should provide operations on valid references', () => {
      const eb = { ref: (col: string) => ({ __ref: col }) } as any

      const tagsOp = pg(eb).array('products.tags')
      const result = tagsOp.hasAllOf(['typescript', 'postgres'])

      expect(result).toBeDefined()
    })
  })

  describe('BUG: Wrong column types should be rejected', () => {
    test('FAILING TEST: should reject string columns in pg.array', () => {
      const eb = { ref: (col: string) => ({ __ref: col }) } as any

      // Currently compiles but shouldn't - 'name' is string, not array
      // @ts-expect-error - After fix: should error because 'name' is not an array
      const nameOp = pg(eb).array('products.name')

      // @ts-expect-error - After fix: should error because 'email' is not an array
      const emailOp = pg(eb).array('users.email')

      expect(nameOp).toBeDefined()
      expect(emailOp).toBeDefined()
    })

    test('FAILING TEST: should reject boolean columns in pg.array', () => {
      const eb = { ref: (col: string) => ({ __ref: col }) } as any

      // @ts-expect-error - After fix: should error because 'is_featured' is boolean, not array
      const boolOp = pg(eb).array('products.is_featured')

      expect(boolOp).toBeDefined()
    })

    test('FAILING TEST: should reject number columns in pg.array', () => {
      const eb = { ref: (col: string) => ({ __ref: col }) } as any

      // @ts-expect-error - After fix: should error because 'id' is number, not array
      const idOp = pg(eb).array('products.id')

      expect(idOp).toBeDefined()
    })
  })

  describe('Array element type inference', () => {
    test('should infer string[] for tags column', () => {
      const eb = { ref: (col: string) => ({ __ref: col }) } as any

      const tagsOp = pg(eb).array('products.tags')
      const result = tagsOp.hasAllOf(['typescript', 'nodejs'])

      expect(result).toBeDefined()
    })

    test('should infer number[] for category_ids column', () => {
      const eb = { ref: (col: string) => ({ __ref: col }) } as any

      const categoryOp = pg(eb).array('products.category_ids')
      const result = categoryOp.hasAllOf([1, 2, 3])

      expect(result).toBeDefined()
    })
  })
})
