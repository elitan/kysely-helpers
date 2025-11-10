import { describe, test, expect } from 'bun:test'
import { sql } from 'kysely'
import { pg } from '../../../src/index'

interface TestDB {
  users: {
    id: number
    preferences: any
    metadata: any
    settings: any
  }
}

const eb = { ref: (col: string) => sql.ref(col) } as any

describe('JSON API Tests', () => {
  describe('Interface and Type Safety', () => {
    test('json() returns JsonOperations interface', () => {
      const jsonOps = pg(eb).json('preferences')

      // Verify all required methods exist
      expect(typeof jsonOps.path).toBe('function')
      expect(typeof jsonOps.contains).toBe('function')
      expect(typeof jsonOps.hasKey).toBe('function')
      expect(typeof jsonOps.hasAllKeys).toBe('function')
      expect(typeof jsonOps.hasAnyKey).toBe('function')
    })

    test('path() returns JsonPathOperations interface', () => {
      const pathOps = pg(eb).json('preferences').path('theme')

      expect(typeof pathOps.contains).toBe('function')
      expect(typeof pathOps.equals).toBe('function')
      expect(typeof pathOps.greaterThan).toBe('function')
      expect(typeof pathOps.lessThan).toBe('function')
      expect(typeof pathOps.exists).toBe('function')
      expect(typeof pathOps.asText).toBe('function')
    })

    test('path() with array returns JsonPathOperations interface', () => {
      const pathOps = pg(eb).json('preferences').path(['user', 'theme'])

      expect(typeof pathOps.contains).toBe('function')
      expect(typeof pathOps.equals).toBe('function')
      expect(typeof pathOps.greaterThan).toBe('function')
      expect(typeof pathOps.lessThan).toBe('function')
      expect(typeof pathOps.exists).toBe('function')
      expect(typeof pathOps.asText).toBe('function')
    })

    test('accepts various column name formats', () => {
      expect(() => pg(eb).json('preferences')).not.toThrow()
      expect(() => pg(eb).json('users.preferences')).not.toThrow()
      expect(() => pg(eb).json('u.preferences')).not.toThrow()
    })
  })

  describe('Method Chaining and Fluent API', () => {
    test('string path method chaining works', () => {
      expect(() => {
        pg(eb).json('preferences').path('theme').equals('dark')
        pg(eb).json('preferences').path('language').asText().equals('en')
        pg(eb).json('preferences').path('settings').contains({notifications: true})
      }).not.toThrow()
    })

    test('array path method chaining works', () => {
      expect(() => {
        pg(eb).json('metadata').path(['user', 'profile']).equals({name: 'test'})
        pg(eb).json('metadata').path(['user', 'profile', 'name']).asText().equals('john')
        pg(eb).json('metadata').path(['notifications', 'email']).contains(true)
      }).not.toThrow()
    })

    test('complex path operations work', () => {
      expect(() => {
        pg(eb).json('preferences').path(['notifications', 'email', 'enabled']).equals(true)
        pg(eb).json('metadata').path(['user', 'settings', 'advanced']).contains({debug: true})
        pg(eb).json('profile').path('age').greaterThan(18)
        pg(eb).json('config').path(['user', 'score']).lessThan(100)
      }).not.toThrow()
    })

    test('existence checks work', () => {
      expect(() => {
        pg(eb).json('preferences').path('theme').exists()
        pg(eb).json('metadata').path(['user', 'profile']).exists()
      }).not.toThrow()
    })
  })

  describe('Parameter Handling', () => {
    test('hasKey() accepts string parameter', () => {
      expect(() => pg(eb).json('preferences').hasKey('theme')).not.toThrow()
      expect(() => pg(eb).json('preferences').hasKey('')).not.toThrow()
      expect(() => pg(eb).json('preferences').hasKey('very_long_key_name_with_underscores')).not.toThrow()
    })

    test('hasAllKeys() accepts string array', () => {
      expect(() => pg(eb).json('preferences').hasAllKeys(['theme', 'language'])).not.toThrow()
      expect(() => pg(eb).json('preferences').hasAllKeys([])).not.toThrow()
      expect(() => pg(eb).json('preferences').hasAllKeys(['single_key'])).not.toThrow()
    })

    test('hasAnyKey() accepts string array', () => {
      expect(() => pg(eb).json('preferences').hasAnyKey(['theme', 'style'])).not.toThrow()
      expect(() => pg(eb).json('preferences').hasAnyKey([])).not.toThrow()
      expect(() => pg(eb).json('preferences').hasAnyKey(['multiple', 'keys', 'here'])).not.toThrow()
    })

    test('contains() accepts various value types', () => {
      expect(() => {
        pg(eb).json('preferences').contains({theme: 'dark'})
        pg(eb).json('preferences').contains({enabled: true})
        pg(eb).json('preferences').contains({count: 42})
        pg(eb).json('preferences').contains({values: [1, 2, 3]})
        pg(eb).json('preferences').contains('string_value')
        pg(eb).json('preferences').contains(123)
        pg(eb).json('preferences').contains(true)
        pg(eb).json('preferences').contains(null)
      }).not.toThrow()
    })

    test('path() accepts string or string array', () => {
      expect(() => {
        pg(eb).json('metadata').path('theme')
        pg(eb).json('metadata').path(['user', 'preferences'])
        pg(eb).json('metadata').path(['nested', 'deep', 'path', 'here'])
      }).not.toThrow()
    })

    test('comparison operations accept various value types', () => {
      expect(() => {
        pg(eb).json('preferences').path('theme').equals('dark')
        pg(eb).json('preferences').path('count').equals(42)
        pg(eb).json('preferences').path('enabled').equals(true)
        pg(eb).json('preferences').path('config').equals(null)
        pg(eb).json('preferences').path('age').greaterThan(18)
        pg(eb).json('preferences').path('score').lessThan(100)
      }).not.toThrow()
    })
  })

  describe('Edge Cases and Error Handling', () => {
    test('handles empty string keys', () => {
      expect(() => pg(eb).json('preferences').hasKey('')).not.toThrow()
      expect(() => pg(eb).json('preferences').path('')).not.toThrow()
    })

    test('handles empty arrays', () => {
      expect(() => pg(eb).json('preferences').hasAllKeys([])).not.toThrow()
      expect(() => pg(eb).json('preferences').hasAnyKey([])).not.toThrow()
      expect(() => pg(eb).json('preferences').path([])).not.toThrow()
    })

    test('handles complex nested objects', () => {
      const complexObject = {
        user: {
          profile: {
            settings: {
              notifications: {
                email: true,
                push: false,
                sms: {
                  enabled: true,
                  frequency: 'daily'
                }
              }
            }
          }
        }
      }
      
      expect(() => pg(eb).json('metadata').contains(complexObject)).not.toThrow()
    })

    test('handles special characters in keys', () => {
      expect(() => {
        pg(eb).json('preferences').hasKey('key-with-dashes')
        pg(eb).json('preferences').hasKey('key_with_underscores')
        pg(eb).json('preferences').hasKey('key.with.dots')
        pg(eb).json('preferences').hasKey('key with spaces')
        pg(eb).json('preferences').hasKey('key@with#special$chars')
        pg(eb).json('preferences').path('key-with-dashes').equals('value')
        pg(eb).json('preferences').path(['key_with_underscores']).exists()
      }).not.toThrow()
    })

    test('handles unicode in keys and values', () => {
      expect(() => {
        pg(eb).json('preferences').hasKey('键名')
        pg(eb).json('preferences').contains({emoji: '🚀', chinese: '中文'})
        pg(eb).json('preferences').path('français').equals('café')
      }).not.toThrow()
    })

    test('handles null and undefined values', () => {
      expect(() => {
        pg(eb).json('preferences').contains(null)
        pg(eb).json('preferences').contains({value: null})
        pg(eb).json('preferences').path('nullable').equals(null)
      }).not.toThrow()
    })
  })

  describe('Return Type Validation', () => {
    test('methods return Expression types', () => {
      // These should be usable in Kysely query contexts
      const expressions = [
        pg(eb).json('preferences').contains({theme: 'dark'}),
        pg(eb).json('preferences').hasKey('theme'),
        pg(eb).json('preferences').path('theme').equals('dark'),
        pg(eb).json('preferences').path(['user', 'theme']).asText(),
        pg(eb).json('preferences').path('age').greaterThan(18),
        pg(eb).json('preferences').path('score').lessThan(100),
        pg(eb).json('preferences').path('premium').exists()
      ]
      
      // Verify all expressions are objects (Expression interface)
      expressions.forEach(expr => {
        expect(typeof expr).toBe('object')
        expect(expr).not.toBeNull()
      })
    })

    test('path() returns selectable expressions', () => {
      // path() should be usable in SELECT clauses
      const pathExpressions = [
        pg(eb).json('preferences').path('theme'),                    // Default JsonValue type
        pg(eb).json('preferences').path(['user', 'profile']),       // Nested path
      ]
      
      pathExpressions.forEach(expr => {
        expect(typeof expr).toBe('object')
        expect(expr).not.toBeNull()
        // Should have both SELECT capabilities and operation methods
        expect(typeof expr.equals).toBe('function')
        expect(typeof expr.contains).toBe('function')
        expect(typeof expr.exists).toBe('function')
        expect(typeof expr.greaterThan).toBe('function')
        expect(typeof expr.asText).toBe('function')
      })

      // asText() returns a different interface (text-specific)
      const textExpr = pg(eb).json('preferences').path('theme').asText()
      expect(typeof textExpr).toBe('object')
      expect(textExpr).not.toBeNull()
      expect(typeof textExpr.equals).toBe('function')
      expect(typeof textExpr.greaterThan).toBe('function')
      expect(typeof textExpr.lessThan).toBe('function')
      // asText() should NOT have contains() or exists() - these are JSON-specific
    })

    test('boolean expressions have correct type inference', () => {
      // These should all be Expression<boolean>
      const booleanExpressions = [
        pg(eb).json('preferences').contains({theme: 'dark'}),
        pg(eb).json('preferences').hasKey('theme'),
        pg(eb).json('preferences').hasAllKeys(['theme', 'lang']),
        pg(eb).json('preferences').hasAnyKey(['theme', 'style']),
        pg(eb).json('preferences').path('enabled').equals(true),
        pg(eb).json('preferences').path(['user', 'active']).contains(true),
        pg(eb).json('preferences').path('age').greaterThan(18),
        pg(eb).json('preferences').path('score').lessThan(100),
        pg(eb).json('preferences').path('premium').exists()
      ]
      
      booleanExpressions.forEach(expr => {
        expect(typeof expr).toBe('object')
      })
    })

    test('string expressions have correct type inference', () => {
      // These should all be Expression<string>
      const stringExpressions = [
        pg(eb).json('preferences').path('theme').asText(),
        pg(eb).json('preferences').path(['user', 'name']).asText(),
        pg(eb).json('preferences').path(['user', 'email']).asText()
      ]
      
      stringExpressions.forEach(expr => {
        expect(typeof expr).toBe('object')
      })
    })
  })

  describe('New SELECT Functionality', () => {
    test('path() can be used in SELECT clauses', () => {
      expect(() => {
        // path() expressions should be valid for SELECT clauses
        const pathExpressions = [
          pg(eb).json('profile').path('age'),                          // JsonValue | null
          pg(eb).json('profile').path(['user', 'name']),               // JsonValue | null  
          pg(eb).json('metadata').path('created_at')                   // JsonValue | null
        ]
        
        pathExpressions.forEach(expr => {
          // Should have both selector and operation capabilities
          expect(typeof expr.equals).toBe('function')
          expect(typeof expr.contains).toBe('function')
          expect(typeof expr.exists).toBe('function')
          expect(typeof expr.greaterThan).toBe('function')
          expect(typeof expr.asText).toBe('function')
        })

        // asText() expressions have different capabilities (text-specific)
        const textExpr = pg(eb).json('preferences').path('theme').asText()
        expect(typeof textExpr.equals).toBe('function')
        expect(typeof textExpr.greaterThan).toBe('function')
        expect(typeof textExpr.lessThan).toBe('function')
      }).not.toThrow()
    })

    test('backward compatibility for WHERE clauses', () => {
      expect(() => {
        // All existing WHERE functionality should still work
        const whereConditions = [
          pg(eb).json('preferences').path('theme').equals('dark'),
          pg(eb).json('profile').path('age').greaterThan(18),
          pg(eb).json('metadata').path(['user', 'active']).equals(true),
          pg(eb).json('settings').path('enabled').exists()
        ]
        
        whereConditions.forEach(condition => {
          expect(typeof condition).toBe('object')
          expect(condition).not.toBeNull()
        })
      }).not.toThrow()
    })

    test('mixed SELECT and WHERE usage works', () => {
      expect(() => {
        // Should be able to use same expressions in both contexts
        const pathExpr = pg(eb).json('profile').path('age')
        
        // Can be used for comparison
        const whereCondition = pathExpr.greaterThan(18)
        expect(typeof whereCondition).toBe('object')
        
        // Same expression type can be used for selection (conceptually)
        const selectExpr = pg(eb).json('profile').path('age')
        expect(typeof selectExpr.equals).toBe('function')
      }).not.toThrow()
    })
  })

  describe('Composition and Complex Usage', () => {
    test('multiple json operations can be combined', () => {
      expect(() => {
        // Simulate building a complex query with multiple JSON conditions
        const conditions = [
          pg(eb).json('preferences').hasKey('theme'),
          pg(eb).json('preferences').path('theme').equals('dark'),
          pg(eb).json('metadata').contains({verified: true}),
          pg(eb).json('settings').path(['notifications', 'email']).equals(true),
          pg(eb).json('profile').path('age').greaterThan(18),
          pg(eb).json('account').path('premium').exists()
        ]
        
        // Should be able to create multiple conditions
        expect(conditions).toHaveLength(6)
      }).not.toThrow()
    })

    test('nested path operations work correctly', () => {
      expect(() => {
        const deepPath = ['user', 'profile', 'settings', 'notifications', 'email', 'frequency']
        pg(eb).json('metadata').path(deepPath).equals('daily')
        pg(eb).json('metadata').path(deepPath).asText()
        pg(eb).json('metadata').path(deepPath).exists()
      }).not.toThrow()
    })

    test('array-like JSON values can be queried', () => {
      expect(() => {
        pg(eb).json('preferences').contains({tags: ['typescript', 'postgres']})
        pg(eb).json('preferences').path('tags').contains(['typescript'])
        pg(eb).json('preferences').path(['user', 'roles']).contains(['admin'])
      }).not.toThrow()
    })

    test('text mode operations work correctly', () => {
      expect(() => {
        pg(eb).json('preferences').path('theme').asText().equals('dark')
        pg(eb).json('preferences').path(['user', 'name']).asText().equals('john')
        pg(eb).json('game').path('score').asText().equals('100')
      }).not.toThrow()
    })
  })
})