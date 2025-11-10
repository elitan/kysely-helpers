import { describe, test, expect } from 'bun:test'
import { pg } from '../../../src/index'

const eb = {
  ref: (column: string) => ({
    __ref: column,
  })
} as any

describe('Array API', () => {
  describe('Function creation', () => {
    test('pg.array() creates function with expected methods', () => {
      const arrayOps = pg(eb).array('tags')

      expect(typeof arrayOps.hasAllOf).toBe('function')
      expect(typeof arrayOps.hasAnyOf).toBe('function')
      expect(typeof arrayOps.length).toBe('function')
      expect(typeof arrayOps.first).toBe('function')
      expect(typeof arrayOps.last).toBe('function')
    })

    test('typed arrays maintain type information', () => {
      const stringArray = pg(eb).array<string>('tags')
      const numberArray = pg(eb).array<number>('scores')
      const booleanArray = pg(eb).array<boolean>('flags')

      expect(typeof stringArray.hasAllOf).toBe('function')
      expect(typeof numberArray.hasAllOf).toBe('function')
      expect(typeof booleanArray.hasAllOf).toBe('function')

      expect(typeof stringArray.hasAnyOf).toBe('function')
      expect(typeof numberArray.hasAnyOf).toBe('function')
      expect(typeof booleanArray.hasAnyOf).toBe('function')
    })

    test('works with different column name formats', () => {
      expect(() => pg(eb).array('tags')).not.toThrow()
      expect(() => pg(eb).array('products.tags')).not.toThrow()
      expect(() => pg(eb).array('p.categories')).not.toThrow()
      expect(() => pg(eb).array('"quoted_column"')).not.toThrow()
      expect(() => pg(eb).array('schema.table.column')).not.toThrow()
    })
  })

  describe('Method calls and parameters', () => {
    test('hasAllOf() accepts arrays', () => {
      const arrayOps = pg(eb).array('tags')

      expect(() => arrayOps.hasAllOf(['typescript', 'javascript'])).not.toThrow()
      expect(() => arrayOps.hasAllOf([])).not.toThrow()
      expect(() => arrayOps.hasAllOf(['single'])).not.toThrow()
    })

    test('hasAnyOf() accepts arrays', () => {
      const arrayOps = pg(eb).array('categories')

      expect(() => arrayOps.hasAnyOf(['tech', 'ai'])).not.toThrow()
      expect(() => arrayOps.hasAnyOf([])).not.toThrow()
      expect(() => arrayOps.hasAnyOf(['single'])).not.toThrow()
    })

    test('length() requires no parameters', () => {
      const arrayOps = pg(eb).array('items')

      expect(() => arrayOps.length()).not.toThrow()
    })

    test('first() requires no parameters', () => {
      const arrayOps = pg(eb).array('queue')

      expect(() => arrayOps.first()).not.toThrow()
    })

    test('last() requires no parameters', () => {
      const arrayOps = pg(eb).array('stack')

      expect(() => arrayOps.last()).not.toThrow()
    })
  })

  describe('Type safety with different data types', () => {
    test('string arrays work with string values', () => {
      const stringOps = pg(eb).array<string>('string_tags')

      expect(() => {
        stringOps.hasAllOf(['a', 'b', 'c'])
        stringOps.hasAnyOf(['x', 'y'])
      }).not.toThrow()
    })

    test('number arrays work with number values', () => {
      const numberOps = pg(eb).array<number>('scores')

      expect(() => {
        numberOps.hasAllOf([1, 2, 3])
        numberOps.hasAnyOf([10, 20])
      }).not.toThrow()
    })

    test('boolean arrays work with boolean values', () => {
      const booleanOps = pg(eb).array<boolean>('flags')

      expect(() => {
        booleanOps.hasAllOf([true, false])
        booleanOps.hasAnyOf([false])
      }).not.toThrow()
    })
  })

  describe('Edge cases and special values', () => {
    test('handles empty arrays', () => {
      const arrayOps = pg(eb).array('tags')

      expect(() => {
        arrayOps.hasAllOf([])
        arrayOps.hasAnyOf([])
      }).not.toThrow()
    })

    test('handles single element arrays', () => {
      const arrayOps = pg(eb).array('tags')

      expect(() => {
        arrayOps.hasAllOf(['single'])
        arrayOps.hasAnyOf(['single'])
      }).not.toThrow()
    })

    test('handles large arrays', () => {
      const arrayOps = pg(eb).array('items')
      const largeArray = Array.from({length: 100}, (_, i) => `item${i}`)

      expect(() => {
        arrayOps.hasAllOf(largeArray)
        arrayOps.hasAnyOf(largeArray)
      }).not.toThrow()
    })

    test('handles special characters in values', () => {
      const arrayOps = pg(eb).array('tags')

      expect(() => {
        arrayOps.hasAllOf(['tag"with"quotes', 'tag\\with\\backslashes'])
        arrayOps.hasAnyOf(['unicode: 🚀', 'newline:\nchar'])
      }).not.toThrow()
    })

    test('handles empty strings', () => {
      const arrayOps = pg(eb).array('tags')

      expect(() => {
        arrayOps.hasAllOf(['', 'non-empty'])
        arrayOps.hasAnyOf([''])
      }).not.toThrow()
    })
  })

  describe('Method chaining compatibility', () => {
    test('methods return expressions that can be used in queries', () => {
      const arrayOps = pg(eb).array('tags')

      const hasAllOfExpr = arrayOps.hasAllOf(['a', 'b'])
      const hasAnyOfExpr = arrayOps.hasAnyOf(['x', 'y'])
      const lengthExpr = arrayOps.length()
      const firstExpr = arrayOps.first()
      const lastExpr = arrayOps.last()

      expect(typeof hasAllOfExpr).toBe('object')
      expect(typeof hasAnyOfExpr).toBe('object')
      expect(typeof lengthExpr).toBe('object')
      expect(typeof firstExpr).toBe('object')
      expect(typeof lastExpr).toBe('object')

      expect(hasAllOfExpr).not.toBeNull()
      expect(hasAnyOfExpr).not.toBeNull()
      expect(lengthExpr).not.toBeNull()
      expect(firstExpr).not.toBeNull()
      expect(lastExpr).not.toBeNull()
    })

    test('multiple operations can be created from same array instance', () => {
      const arrayOps = pg(eb).array('tags')

      expect(() => {
        const expr1 = arrayOps.hasAllOf(['first'])
        const expr2 = arrayOps.hasAnyOf(['second', 'third'])
        const expr3 = arrayOps.length()

        expect(expr1).not.toBe(expr2)
        expect(expr2).not.toBe(expr3)
        expect(expr1).not.toBe(expr3)
      }).not.toThrow()
    })
  })

  describe('Column reference variations', () => {
    test('handles simple column names', () => {
      expect(() => {
        pg(eb).array('tags').hasAllOf(['test'])
        pg(eb).array('categories').length()
        pg(eb).array('scores').first()
      }).not.toThrow()
    })

    test('handles qualified column names', () => {
      expect(() => {
        pg(eb).array('products.tags').hasAllOf(['featured'])
        pg(eb).array('user.preferences').hasAnyOf(['dark_mode'])
        pg(eb).array('order.items').hasAnyOf(['item1', 'item2', 'item3'])
      }).not.toThrow()
    })

    test('handles aliased table columns', () => {
      expect(() => {
        pg(eb).array('p.categories').hasAnyOf(['electronics'])
        pg(eb).array('u.roles').hasAllOf(['admin', 'user'])
        pg(eb).array('o.statuses').length()
      }).not.toThrow()
    })

    test('handles quoted identifiers', () => {
      expect(() => {
        pg(eb).array('"quoted_column"').hasAllOf(['value'])
        pg(eb).array('"table"."column"').hasAnyOf(['items'])
        pg(eb).array('"schema"."table"."column"').length()
      }).not.toThrow()
    })
  })
})