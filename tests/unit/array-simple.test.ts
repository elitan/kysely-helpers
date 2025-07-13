import { describe, test, expect } from 'bun:test'
import { pg } from '../../src/index'

describe('Array Operations - Basic Function Tests', () => {
  describe('Function creation', () => {
    test('array() returns an object with expected methods', () => {
      const arrayOps = pg.array('tags')
      
      expect(typeof arrayOps.includes).toBe('function')
      expect(typeof arrayOps.contains).toBe('function')
      expect(typeof arrayOps.overlaps).toBe('function')
      expect(typeof arrayOps.containedBy).toBe('function')
      expect(typeof arrayOps.length).toBe('function')
      expect(typeof arrayOps.any).toBe('function')
    })

    test('typed array operations work', () => {
      const stringArray = pg.array<string>('tags')
      const numberArray = pg.array<number>('scores')
      
      expect(typeof stringArray.includes).toBe('function')
      expect(typeof numberArray.includes).toBe('function')
    })
  })

  describe('Method calls', () => {
    test('includes() method can be called', () => {
      const arrayOps = pg.array('tags')
      
      expect(() => {
        arrayOps.includes('typescript')
      }).not.toThrow()
    })

    test('contains() method can be called with single value', () => {
      const arrayOps = pg.array('tags')
      
      expect(() => {
        arrayOps.contains('typescript')
      }).not.toThrow()
    })

    test('contains() method can be called with array', () => {
      const arrayOps = pg.array('tags')
      
      expect(() => {
        arrayOps.contains(['typescript', 'javascript'])
      }).not.toThrow()
    })

    test('overlaps() method can be called', () => {
      const arrayOps = pg.array('categories')
      
      expect(() => {
        arrayOps.overlaps(['tech', 'ai'])
      }).not.toThrow()
    })

    test('containedBy() method can be called', () => {
      const arrayOps = pg.array('tags')
      
      expect(() => {
        arrayOps.containedBy(['allowed', 'valid'])
      }).not.toThrow()
    })

    test('length() method can be called', () => {
      const arrayOps = pg.array('items')
      
      expect(() => {
        arrayOps.length()
      }).not.toThrow()
    })

    test('any() method can be called', () => {
      const arrayOps = pg.array('statuses')
      
      expect(() => {
        arrayOps.any()
      }).not.toThrow()
    })
  })

  describe('Different column formats', () => {
    test('works with simple column names', () => {
      expect(() => {
        pg.array('tags').includes('test')
      }).not.toThrow()
    })

    test('works with qualified column names', () => {
      expect(() => {
        pg.array('products.tags').includes('featured')
      }).not.toThrow()
    })

    test('works with aliased table columns', () => {
      expect(() => {
        pg.array('p.categories').overlaps(['electronics'])
      }).not.toThrow()
    })
  })

  describe('Edge cases', () => {
    test('handles empty arrays', () => {
      expect(() => {
        pg.array('tags').contains([])
        pg.array('tags').overlaps([])
        pg.array('tags').containedBy([])
      }).not.toThrow()
    })

    test('handles single element arrays', () => {
      expect(() => {
        pg.array('tags').contains(['single'])
        pg.array('tags').overlaps(['single'])
        pg.array('tags').containedBy(['single'])
      }).not.toThrow()
    })

    test('handles long arrays', () => {
      const longArray = Array.from({length: 100}, (_, i) => `item${i}`)
      
      expect(() => {
        pg.array('items').overlaps(longArray)
      }).not.toThrow()
    })

    test('handles special characters in values', () => {
      expect(() => {
        pg.array('tags').includes("tag's with 'quotes'")
        pg.array('tags').contains(['tag"with"quotes', 'tag\\with\\backslashes'])
      }).not.toThrow()
    })
  })

  describe('Type safety', () => {
    test('maintains type information', () => {
      // These should not throw TypeScript errors
      const stringOps = pg.array<string>('string_tags')
      const numberOps = pg.array<number>('number_array')
      const booleanOps = pg.array<boolean>('boolean_flags')

      expect(typeof stringOps.includes).toBe('function')
      expect(typeof numberOps.contains).toBe('function')
      expect(typeof booleanOps.overlaps).toBe('function')
    })
  })
})