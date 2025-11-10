import { describe, test, expect } from 'bun:test'
import { pg } from '../../../src/index'

// Define a test database schema
interface Database {
  products: {
    id: number
    name: string
    metadata: Record<string, any>
    config: { theme: string; settings: Record<string, boolean> }
    tags: string[]
  }
  users: {
    id: number
    email: string
    profile: { bio: string; avatar: string }
    preferences: Record<string, string>
  }
}

describe('JSON Type Safety', () => {
  describe('BUG: String usage should NOT compile (but currently does)', () => {
    test('FAILING TEST: string column references should be rejected', () => {
      // These currently compile but shouldn't after fix
      // @ts-expect-error - After fix: string usage should not be allowed
      const metadataOp = pg.json('metadata')

      // @ts-expect-error - After fix: string usage should not be allowed
      const configOp = pg.json('config')

      expect(metadataOp).toBeDefined()
      expect(configOp).toBeDefined()
    })

    test('FAILING TEST: should reject non-existent columns (currently no error)', () => {
      // Currently compiles without error - BAD!
      // @ts-expect-error - After fix: should error for invalid column
      const invalidOp = pg.json<Database, 'products'>('invalid_column')

      expect(invalidOp).toBeDefined()
    })

    test('FAILING TEST: should reject non-json columns (currently no error)', () => {
      // Currently compiles without error - BAD!
      // @ts-expect-error - After fix: 'name' is string, not json
      const nameOp = pg.json<Database, 'products'>('name')

      // @ts-expect-error - After fix: 'id' is number, not json
      const idOp = pg.json<Database, 'products'>('id')

      // @ts-expect-error - After fix: 'tags' is array, not json object
      const tagsOp = pg.json<Database, 'products'>('tags')

      expect(nameOp).toBeDefined()
      expect(idOp).toBeDefined()
      expect(tagsOp).toBeDefined()
    })
  })

  describe('CORRECT: Expression builder pattern should work', () => {
    test('should accept eb.ref() with valid json columns', () => {
      // Mock expression builder
      const eb = {
        ref: (column: string) => ({
          __ref: column,
        })
      } as any

      // These should work after fix
      const metadataOp = pg.json(eb.ref('products.metadata'))
      const configOp = pg.json(eb.ref('products.config'))
      const profileOp = pg.json(eb.ref('users.profile'))

      expect(metadataOp).toBeDefined()
      expect(configOp).toBeDefined()
      expect(profileOp).toBeDefined()
    })

    test('should provide operations on valid references', () => {
      const eb = { ref: (col: string) => ({ __ref: col }) } as any

      const metadataOp = pg.json(eb.ref('products.metadata'))
      const result = metadataOp.path('theme')

      expect(result).toBeDefined()
    })
  })

  describe('BUG: Wrong column types should be rejected', () => {
    test('FAILING TEST: should reject string columns in pg.json', () => {
      const eb = { ref: (col: string) => ({ __ref: col }) } as any

      // Currently compiles but shouldn't - 'name' is string, not json
      // @ts-expect-error - After fix: should error because 'name' is not json
      const nameOp = pg.json(eb.ref('products.name'))

      // @ts-expect-error - After fix: should error because 'email' is not json
      const emailOp = pg.json(eb.ref('users.email'))

      expect(nameOp).toBeDefined()
      expect(emailOp).toBeDefined()
    })

    test('FAILING TEST: should reject number columns in pg.json', () => {
      const eb = { ref: (col: string) => ({ __ref: col }) } as any

      // @ts-expect-error - After fix: should error because 'id' is number, not json
      const idOp = pg.json(eb.ref('products.id'))

      expect(idOp).toBeDefined()
    })

    test('FAILING TEST: should reject array columns in pg.json', () => {
      const eb = { ref: (col: string) => ({ __ref: col }) } as any

      // @ts-expect-error - After fix: should error because 'tags' is array, not json object
      const tagsOp = pg.json(eb.ref('products.tags'))

      expect(tagsOp).toBeDefined()
    })
  })

  describe('JSON type inference', () => {
    test('should work with Record<string, any> types', () => {
      const eb = { ref: (col: string) => ({ __ref: col }) } as any

      const metadataOp = pg.json(eb.ref('products.metadata'))
      const result = metadataOp.path('key')

      expect(result).toBeDefined()
    })

    test('should work with specific object types', () => {
      const eb = { ref: (col: string) => ({ __ref: col }) } as any

      const configOp = pg.json(eb.ref('products.config'))
      const result = configOp.path('theme')

      expect(result).toBeDefined()
    })
  })
})
