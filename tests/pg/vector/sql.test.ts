import { describe, test, expect } from 'bun:test'
import { sql } from 'kysely'
import { pg } from '../../../src/index'

const eb = { ref: (col: string) => sql.ref(col) } as any

describe('Vector SQL Generation Tests', () => {
  describe('API Surface Tests', () => {
    test('embedding() function exists and is callable', () => {
      expect(() => {
        pg.embedding([1, 2, 3])
      }).not.toThrow()
    })

    test('vector() function exists and returns operations', () => {
      const vectorOps = pg(eb).vector('embedding')
      
      expect(typeof vectorOps.similarity).toBe('function')
      expect(typeof vectorOps.toArray).toBe('function')
    })

    test('similarity() method generates expressions', () => {
      const vectorOps = pg(eb).vector('embedding')
      
      expect(() => {
        vectorOps.similarity([1, 2, 3])
        vectorOps.similarity([1, 2, 3], 'cosine')
        vectorOps.similarity([1, 2, 3], 'euclidean')
        vectorOps.similarity([1, 2, 3], 'dot')
      }).not.toThrow()
    })

    test('toArray() method generates expressions', () => {
      const vectorOps = pg(eb).vector('embedding')
      
      expect(() => {
        vectorOps.toArray()
      }).not.toThrow()
    })
  })

  describe('Error Handling', () => {
    test('throws error for unsupported algorithm', () => {
      const vectorOps = pg(eb).vector('embedding')
      
      expect(() => {
        // @ts-expect-error - Testing invalid algorithm
        vectorOps.similarity([1, 2, 3], 'invalid' as any)
      }).toThrow('Unsupported similarity algorithm: invalid')
    })
  })
})