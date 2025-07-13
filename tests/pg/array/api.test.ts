import { describe, test, expect } from 'bun:test'
import { pg } from '../../../src/index'

describe('Array API', () => {
  describe('Function creation', () => {
    test('pg.array() creates function with expected methods', () => {
      const arrayOps = pg.array('tags')
      
      expect(typeof arrayOps.contains).toBe('function')
      expect(typeof arrayOps.includes).toBe('function')
      expect(typeof arrayOps.overlaps).toBe('function')
      expect(typeof arrayOps.containedBy).toBe('function')
      expect(typeof arrayOps.length).toBe('function')
      expect(typeof arrayOps.any).toBe('function')
    })

    test('typed arrays maintain type information', () => {
      const stringArray = pg.array<string>('tags')
      const numberArray = pg.array<number>('scores')
      const booleanArray = pg.array<boolean>('flags')
      
      // All should have the same interface
      expect(typeof stringArray.includes).toBe('function')
      expect(typeof numberArray.includes).toBe('function')
      expect(typeof booleanArray.includes).toBe('function')
      
      expect(typeof stringArray.contains).toBe('function')
      expect(typeof numberArray.contains).toBe('function')
      expect(typeof booleanArray.contains).toBe('function')
    })

    test('works with different column name formats', () => {
      expect(() => pg.array('tags')).not.toThrow()
      expect(() => pg.array('products.tags')).not.toThrow()
      expect(() => pg.array('p.categories')).not.toThrow()
      expect(() => pg.array('"quoted_column"')).not.toThrow()
      expect(() => pg.array('schema.table.column')).not.toThrow()
    })
  })

  describe('Method calls and parameters', () => {
    test('includes() accepts single values', () => {
      const arrayOps = pg.array('tags')
      
      expect(() => arrayOps.includes('typescript')).not.toThrow()
      expect(() => arrayOps.includes('')).not.toThrow()
      expect(() => arrayOps.includes('tag with spaces')).not.toThrow()
    })

    test('contains() accepts single values', () => {
      const arrayOps = pg.array('tags')
      
      expect(() => arrayOps.contains('typescript')).not.toThrow()
      expect(() => arrayOps.contains('')).not.toThrow()
    })

    test('contains() accepts arrays', () => {
      const arrayOps = pg.array('tags')
      
      expect(() => arrayOps.contains(['typescript', 'javascript'])).not.toThrow()
      expect(() => arrayOps.contains([])).not.toThrow()
      expect(() => arrayOps.contains(['single'])).not.toThrow()
    })

    test('overlaps() accepts arrays', () => {
      const arrayOps = pg.array('categories')
      
      expect(() => arrayOps.overlaps(['tech', 'ai'])).not.toThrow()
      expect(() => arrayOps.overlaps([])).not.toThrow()
      expect(() => arrayOps.overlaps(['single'])).not.toThrow()
    })

    test('containedBy() accepts arrays', () => {
      const arrayOps = pg.array('tags')
      
      expect(() => arrayOps.containedBy(['allowed', 'valid'])).not.toThrow()
      expect(() => arrayOps.containedBy([])).not.toThrow()
      expect(() => arrayOps.containedBy(['single'])).not.toThrow()
    })

    test('length() requires no parameters', () => {
      const arrayOps = pg.array('items')
      
      expect(() => arrayOps.length()).not.toThrow()
    })

    test('any() requires no parameters', () => {
      const arrayOps = pg.array('statuses')
      
      expect(() => arrayOps.any()).not.toThrow()
    })
  })

  describe('Type safety with different data types', () => {
    test('string arrays work with string values', () => {
      const stringOps = pg.array<string>('string_tags')
      
      expect(() => {
        stringOps.includes('test')
        stringOps.contains(['a', 'b', 'c'])
        stringOps.overlaps(['x', 'y'])
        stringOps.containedBy(['allowed'])
      }).not.toThrow()
    })

    test('number arrays work with number values', () => {
      const numberOps = pg.array<number>('scores')
      
      expect(() => {
        numberOps.includes(42)
        numberOps.contains([1, 2, 3])
        numberOps.overlaps([10, 20])
        numberOps.containedBy([1, 2, 3, 4, 5])
      }).not.toThrow()
    })

    test('boolean arrays work with boolean values', () => {
      const booleanOps = pg.array<boolean>('flags')
      
      expect(() => {
        booleanOps.includes(true)
        booleanOps.contains([true, false])
        booleanOps.overlaps([false])
        booleanOps.containedBy([true, false])
      }).not.toThrow()
    })
  })

  describe('Edge cases and special values', () => {
    test('handles empty arrays', () => {
      const arrayOps = pg.array('tags')
      
      expect(() => {
        arrayOps.contains([])
        arrayOps.overlaps([])
        arrayOps.containedBy([])
      }).not.toThrow()
    })

    test('handles single element arrays', () => {
      const arrayOps = pg.array('tags')
      
      expect(() => {
        arrayOps.contains(['single'])
        arrayOps.overlaps(['single'])
        arrayOps.containedBy(['single'])
      }).not.toThrow()
    })

    test('handles large arrays', () => {
      const arrayOps = pg.array('items')
      const largeArray = Array.from({length: 100}, (_, i) => `item${i}`)
      
      expect(() => {
        arrayOps.contains(largeArray)
        arrayOps.overlaps(largeArray)
        arrayOps.containedBy(largeArray)
      }).not.toThrow()
    })

    test('handles special characters in values', () => {
      const arrayOps = pg.array('tags')
      
      expect(() => {
        arrayOps.includes("tag's with 'quotes'")
        arrayOps.contains(['tag"with"quotes', 'tag\\with\\backslashes'])
        arrayOps.overlaps(['unicode: 🚀', 'newline:\nchar'])
        arrayOps.containedBy(['tab:\tchar', 'null:\0char'])
      }).not.toThrow()
    })

    test('handles empty strings', () => {
      const arrayOps = pg.array('tags')
      
      expect(() => {
        arrayOps.includes('')
        arrayOps.contains(['', 'non-empty'])
        arrayOps.overlaps([''])
        arrayOps.containedBy(['', 'allowed'])
      }).not.toThrow()
    })
  })

  describe('Method chaining compatibility', () => {
    test('methods return expressions that can be used in queries', () => {
      const arrayOps = pg.array('tags')
      
      // These should return objects that look like Kysely expressions
      const includesExpr = arrayOps.includes('test')
      const containsExpr = arrayOps.contains(['a', 'b'])
      const overlapsExpr = arrayOps.overlaps(['x', 'y'])
      const containedByExpr = arrayOps.containedBy(['allowed'])
      const lengthExpr = arrayOps.length()
      const anyExpr = arrayOps.any()
      
      // All should be objects (Kysely expressions)
      expect(typeof includesExpr).toBe('object')
      expect(typeof containsExpr).toBe('object')
      expect(typeof overlapsExpr).toBe('object')
      expect(typeof containedByExpr).toBe('object')
      expect(typeof lengthExpr).toBe('object')
      expect(typeof anyExpr).toBe('object')
      
      // Should not be null
      expect(includesExpr).not.toBeNull()
      expect(containsExpr).not.toBeNull()
      expect(overlapsExpr).not.toBeNull()
      expect(containedByExpr).not.toBeNull()
      expect(lengthExpr).not.toBeNull()
      expect(anyExpr).not.toBeNull()
    })

    test('multiple operations can be created from same array instance', () => {
      const arrayOps = pg.array('tags')
      
      expect(() => {
        const expr1 = arrayOps.includes('first')
        const expr2 = arrayOps.contains(['second', 'third'])
        const expr3 = arrayOps.length()
        
        // All should be independent expressions
        expect(expr1).not.toBe(expr2)
        expect(expr2).not.toBe(expr3)
        expect(expr1).not.toBe(expr3)
      }).not.toThrow()
    })
  })

  describe('Column reference variations', () => {
    test('handles simple column names', () => {
      expect(() => {
        pg.array('tags').includes('test')
        pg.array('categories').length()
        pg.array('scores').any()
      }).not.toThrow()
    })

    test('handles qualified column names', () => {
      expect(() => {
        pg.array('products.tags').includes('featured')
        pg.array('user.preferences').contains(['dark_mode'])
        pg.array('order.items').overlaps([1, 2, 3])
      }).not.toThrow()
    })

    test('handles aliased table columns', () => {
      expect(() => {
        pg.array('p.categories').overlaps(['electronics'])
        pg.array('u.roles').containedBy(['admin', 'user'])
        pg.array('o.statuses').length()
      }).not.toThrow()
    })

    test('handles quoted identifiers', () => {
      expect(() => {
        pg.array('"quoted_column"').includes('value')
        pg.array('"table"."column"').contains(['items'])
        pg.array('"schema"."table"."column"').length()
      }).not.toThrow()
    })
  })
})