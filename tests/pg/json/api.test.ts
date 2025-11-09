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
      const jsonOps = pg.json(eb.ref('preferences'))

      // Verify all required methods exist
      expect(typeof jsonOps.path).toBe('function')
      expect(typeof jsonOps.contains).toBe('function')
      expect(typeof jsonOps.hasKey).toBe('function')
      expect(typeof jsonOps.hasAllKeys).toBe('function')
      expect(typeof jsonOps.hasAnyKey).toBe('function')
    })

    test('path() returns JsonPathOperations interface', () => {
      const pathOps = pg.json(eb.ref('preferences')).path('theme')

      expect(typeof pathOps.contains).toBe('function')
      expect(typeof pathOps.equals).toBe('function')
      expect(typeof pathOps.greaterThan).toBe('function')
      expect(typeof pathOps.lessThan).toBe('function')
      expect(typeof pathOps.exists).toBe('function')
      expect(typeof pathOps.asText).toBe('function')
    })

    test('path() with array returns JsonPathOperations interface', () => {
      const pathOps = pg.json(eb.ref('preferences')).path(['user', 'theme'])

      expect(typeof pathOps.contains).toBe('function')
      expect(typeof pathOps.equals).toBe('function')
      expect(typeof pathOps.greaterThan).toBe('function')
      expect(typeof pathOps.lessThan).toBe('function')
      expect(typeof pathOps.exists).toBe('function')
      expect(typeof pathOps.asText).toBe('function')
    })

    test('accepts various column name formats', () => {
      expect(() => pg.json(eb.ref('preferences'))).not.toThrow()
      expect(() => pg.json(eb.ref('users.preferences'))).not.toThrow()
      expect(() => pg.json(eb.ref('u.preferences'))).not.toThrow()
    })
  })

  describe('Method Chaining and Fluent API', () => {
    test('string path method chaining works', () => {
      expect(() => {
        pg.json(eb.ref('preferences')).path('theme').equals('dark')
        pg.json(eb.ref('preferences')).path('language').asText().equals('en')
        pg.json(eb.ref('preferences')).path('settings').contains({notifications: true})
      }).not.toThrow()
    })

    test('array path method chaining works', () => {
      expect(() => {
        pg.json(eb.ref('metadata')).path(['user', 'profile']).equals({name: 'test'})
        pg.json(eb.ref('metadata')).path(['user', 'profile', 'name']).asText().equals('john')
        pg.json(eb.ref('metadata')).path(['notifications', 'email']).contains(true)
      }).not.toThrow()
    })

    test('complex path operations work', () => {
      expect(() => {
        pg.json(eb.ref('preferences')).path(['notifications', 'email', 'enabled']).equals(true)
        pg.json(eb.ref('metadata')).path(['user', 'settings', 'advanced']).contains({debug: true})
        pg.json(eb.ref('profile')).path('age').greaterThan(18)
        pg.json(eb.ref('config')).path(['user', 'score']).lessThan(100)
      }).not.toThrow()
    })

    test('existence checks work', () => {
      expect(() => {
        pg.json(eb.ref('preferences')).path('theme').exists()
        pg.json(eb.ref('metadata')).path(['user', 'profile']).exists()
      }).not.toThrow()
    })
  })

  describe('Parameter Handling', () => {
    test('hasKey() accepts string parameter', () => {
      expect(() => pg.json(eb.ref('preferences')).hasKey('theme')).not.toThrow()
      expect(() => pg.json(eb.ref('preferences')).hasKey('')).not.toThrow()
      expect(() => pg.json(eb.ref('preferences')).hasKey('very_long_key_name_with_underscores')).not.toThrow()
    })

    test('hasAllKeys() accepts string array', () => {
      expect(() => pg.json(eb.ref('preferences')).hasAllKeys(['theme', 'language'])).not.toThrow()
      expect(() => pg.json(eb.ref('preferences')).hasAllKeys([])).not.toThrow()
      expect(() => pg.json(eb.ref('preferences')).hasAllKeys(['single_key'])).not.toThrow()
    })

    test('hasAnyKey() accepts string array', () => {
      expect(() => pg.json(eb.ref('preferences')).hasAnyKey(['theme', 'style'])).not.toThrow()
      expect(() => pg.json(eb.ref('preferences')).hasAnyKey([])).not.toThrow()
      expect(() => pg.json(eb.ref('preferences')).hasAnyKey(['multiple', 'keys', 'here'])).not.toThrow()
    })

    test('contains() accepts various value types', () => {
      expect(() => {
        pg.json(eb.ref('preferences')).contains({theme: 'dark'})
        pg.json(eb.ref('preferences')).contains({enabled: true})
        pg.json(eb.ref('preferences')).contains({count: 42})
        pg.json(eb.ref('preferences')).contains({values: [1, 2, 3]})
        pg.json(eb.ref('preferences')).contains('string_value')
        pg.json(eb.ref('preferences')).contains(123)
        pg.json(eb.ref('preferences')).contains(true)
        pg.json(eb.ref('preferences')).contains(null)
      }).not.toThrow()
    })

    test('path() accepts string or string array', () => {
      expect(() => {
        pg.json(eb.ref('metadata')).path('theme')
        pg.json(eb.ref('metadata')).path(['user', 'preferences'])
        pg.json(eb.ref('metadata')).path(['nested', 'deep', 'path', 'here'])
      }).not.toThrow()
    })

    test('comparison operations accept various value types', () => {
      expect(() => {
        pg.json(eb.ref('preferences')).path('theme').equals('dark')
        pg.json(eb.ref('preferences')).path('count').equals(42)
        pg.json(eb.ref('preferences')).path('enabled').equals(true)
        pg.json(eb.ref('preferences')).path('config').equals(null)
        pg.json(eb.ref('preferences')).path('age').greaterThan(18)
        pg.json(eb.ref('preferences')).path('score').lessThan(100)
      }).not.toThrow()
    })
  })

  describe('Edge Cases and Error Handling', () => {
    test('handles empty string keys', () => {
      expect(() => pg.json(eb.ref('preferences')).hasKey('')).not.toThrow()
      expect(() => pg.json(eb.ref('preferences')).path('')).not.toThrow()
    })

    test('handles empty arrays', () => {
      expect(() => pg.json(eb.ref('preferences')).hasAllKeys([])).not.toThrow()
      expect(() => pg.json(eb.ref('preferences')).hasAnyKey([])).not.toThrow()
      expect(() => pg.json(eb.ref('preferences')).path([])).not.toThrow()
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
      
      expect(() => pg.json(eb.ref('metadata')).contains(complexObject)).not.toThrow()
    })

    test('handles special characters in keys', () => {
      expect(() => {
        pg.json(eb.ref('preferences')).hasKey('key-with-dashes')
        pg.json(eb.ref('preferences')).hasKey('key_with_underscores')
        pg.json(eb.ref('preferences')).hasKey('key.with.dots')
        pg.json(eb.ref('preferences')).hasKey('key with spaces')
        pg.json(eb.ref('preferences')).hasKey('key@with#special$chars')
        pg.json(eb.ref('preferences')).path('key-with-dashes').equals('value')
        pg.json(eb.ref('preferences')).path(['key_with_underscores']).exists()
      }).not.toThrow()
    })

    test('handles unicode in keys and values', () => {
      expect(() => {
        pg.json(eb.ref('preferences')).hasKey('键名')
        pg.json(eb.ref('preferences')).contains({emoji: '🚀', chinese: '中文'})
        pg.json(eb.ref('preferences')).path('français').equals('café')
      }).not.toThrow()
    })

    test('handles null and undefined values', () => {
      expect(() => {
        pg.json(eb.ref('preferences')).contains(null)
        pg.json(eb.ref('preferences')).contains({value: null})
        pg.json(eb.ref('preferences')).path('nullable').equals(null)
      }).not.toThrow()
    })
  })

  describe('Return Type Validation', () => {
    test('methods return Expression types', () => {
      // These should be usable in Kysely query contexts
      const expressions = [
        pg.json(eb.ref('preferences')).contains({theme: 'dark'}),
        pg.json(eb.ref('preferences')).hasKey('theme'),
        pg.json(eb.ref('preferences')).path('theme').equals('dark'),
        pg.json(eb.ref('preferences')).path(['user', 'theme']).asText(),
        pg.json(eb.ref('preferences')).path('age').greaterThan(18),
        pg.json(eb.ref('preferences')).path('score').lessThan(100),
        pg.json(eb.ref('preferences')).path('premium').exists()
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
        pg.json(eb.ref('preferences')).path('theme'),                    // Default JsonValue type
        pg.json(eb.ref('preferences')).path(['user', 'profile']),       // Nested path
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
      const textExpr = pg.json(eb.ref('preferences')).path('theme').asText()
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
        pg.json(eb.ref('preferences')).contains({theme: 'dark'}),
        pg.json(eb.ref('preferences')).hasKey('theme'),
        pg.json(eb.ref('preferences')).hasAllKeys(['theme', 'lang']),
        pg.json(eb.ref('preferences')).hasAnyKey(['theme', 'style']),
        pg.json(eb.ref('preferences')).path('enabled').equals(true),
        pg.json(eb.ref('preferences')).path(['user', 'active']).contains(true),
        pg.json(eb.ref('preferences')).path('age').greaterThan(18),
        pg.json(eb.ref('preferences')).path('score').lessThan(100),
        pg.json(eb.ref('preferences')).path('premium').exists()
      ]
      
      booleanExpressions.forEach(expr => {
        expect(typeof expr).toBe('object')
      })
    })

    test('string expressions have correct type inference', () => {
      // These should all be Expression<string>
      const stringExpressions = [
        pg.json(eb.ref('preferences')).path('theme').asText(),
        pg.json(eb.ref('preferences')).path(['user', 'name']).asText(),
        pg.json(eb.ref('preferences')).path(['user', 'email']).asText()
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
          pg.json(eb.ref('profile')).path('age'),                          // JsonValue | null
          pg.json(eb.ref('profile')).path(['user', 'name']),               // JsonValue | null  
          pg.json(eb.ref('metadata')).path('created_at')                   // JsonValue | null
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
        const textExpr = pg.json(eb.ref('preferences')).path('theme').asText()
        expect(typeof textExpr.equals).toBe('function')
        expect(typeof textExpr.greaterThan).toBe('function')
        expect(typeof textExpr.lessThan).toBe('function')
      }).not.toThrow()
    })

    test('backward compatibility for WHERE clauses', () => {
      expect(() => {
        // All existing WHERE functionality should still work
        const whereConditions = [
          pg.json(eb.ref('preferences')).path('theme').equals('dark'),
          pg.json(eb.ref('profile')).path('age').greaterThan(18),
          pg.json(eb.ref('metadata')).path(['user', 'active']).equals(true),
          pg.json(eb.ref('settings')).path('enabled').exists()
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
        const pathExpr = pg.json(eb.ref('profile')).path('age')
        
        // Can be used for comparison
        const whereCondition = pathExpr.greaterThan(18)
        expect(typeof whereCondition).toBe('object')
        
        // Same expression type can be used for selection (conceptually)
        const selectExpr = pg.json(eb.ref('profile')).path('age')
        expect(typeof selectExpr.equals).toBe('function')
      }).not.toThrow()
    })
  })

  describe('Composition and Complex Usage', () => {
    test('multiple json operations can be combined', () => {
      expect(() => {
        // Simulate building a complex query with multiple JSON conditions
        const conditions = [
          pg.json(eb.ref('preferences')).hasKey('theme'),
          pg.json(eb.ref('preferences')).path('theme').equals('dark'),
          pg.json(eb.ref('metadata')).contains({verified: true}),
          pg.json(eb.ref('settings')).path(['notifications', 'email']).equals(true),
          pg.json(eb.ref('profile')).path('age').greaterThan(18),
          pg.json(eb.ref('account')).path('premium').exists()
        ]
        
        // Should be able to create multiple conditions
        expect(conditions).toHaveLength(6)
      }).not.toThrow()
    })

    test('nested path operations work correctly', () => {
      expect(() => {
        const deepPath = ['user', 'profile', 'settings', 'notifications', 'email', 'frequency']
        pg.json(eb.ref('metadata')).path(deepPath).equals('daily')
        pg.json(eb.ref('metadata')).path(deepPath).asText()
        pg.json(eb.ref('metadata')).path(deepPath).exists()
      }).not.toThrow()
    })

    test('array-like JSON values can be queried', () => {
      expect(() => {
        pg.json(eb.ref('preferences')).contains({tags: ['typescript', 'postgres']})
        pg.json(eb.ref('preferences')).path('tags').contains(['typescript'])
        pg.json(eb.ref('preferences')).path(['user', 'roles']).contains(['admin'])
      }).not.toThrow()
    })

    test('text mode operations work correctly', () => {
      expect(() => {
        pg.json(eb.ref('preferences')).path('theme').asText().equals('dark')
        pg.json(eb.ref('preferences')).path(['user', 'name']).asText().equals('john')
        pg.json(eb.ref('game')).path('score').asText().equals('100')
      }).not.toThrow()
    })
  })
})