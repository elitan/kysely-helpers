import { describe, test, expect } from 'bun:test'
import { pg } from '../../../src/index'

interface TestDB {
  users: {
    id: number
    preferences: any
    metadata: any
    settings: any
  }
}

describe('JSON API Tests', () => {
  describe('Interface and Type Safety', () => {
    test('json() returns JsonOperations interface', () => {
      const jsonOps = pg.json('preferences')
      
      // Verify all required methods exist
      expect(typeof jsonOps.path).toBe('function')
      expect(typeof jsonOps.contains).toBe('function')
      expect(typeof jsonOps.hasKey).toBe('function')
      expect(typeof jsonOps.hasAllKeys).toBe('function')
      expect(typeof jsonOps.hasAnyKey).toBe('function')
    })

    test('path() returns JsonPathOperations interface', () => {
      const pathOps = pg.json('preferences').path('theme')
      
      expect(typeof pathOps.contains).toBe('function')
      expect(typeof pathOps.equals).toBe('function')
      expect(typeof pathOps.greaterThan).toBe('function')
      expect(typeof pathOps.lessThan).toBe('function')
      expect(typeof pathOps.exists).toBe('function')
      expect(typeof pathOps.asText).toBe('function')
    })

    test('path() with array returns JsonPathOperations interface', () => {
      const pathOps = pg.json('preferences').path(['user', 'theme'])
      
      expect(typeof pathOps.contains).toBe('function')
      expect(typeof pathOps.equals).toBe('function')
      expect(typeof pathOps.greaterThan).toBe('function')
      expect(typeof pathOps.lessThan).toBe('function')
      expect(typeof pathOps.exists).toBe('function')
      expect(typeof pathOps.asText).toBe('function')
    })

    test('accepts various column name formats', () => {
      expect(() => pg.json('preferences')).not.toThrow()
      expect(() => pg.json('users.preferences')).not.toThrow()
      expect(() => pg.json('u.preferences')).not.toThrow()
    })
  })

  describe('Method Chaining and Fluent API', () => {
    test('string path method chaining works', () => {
      expect(() => {
        pg.json('preferences').path('theme').equals('dark')
        pg.json('preferences').path('language').asText().equals('en')
        pg.json('preferences').path('settings').contains({notifications: true})
      }).not.toThrow()
    })

    test('array path method chaining works', () => {
      expect(() => {
        pg.json('metadata').path(['user', 'profile']).equals({name: 'test'})
        pg.json('metadata').path(['user', 'profile', 'name']).asText().equals('john')
        pg.json('metadata').path(['notifications', 'email']).contains(true)
      }).not.toThrow()
    })

    test('complex path operations work', () => {
      expect(() => {
        pg.json('preferences').path(['notifications', 'email', 'enabled']).equals(true)
        pg.json('metadata').path(['user', 'settings', 'advanced']).contains({debug: true})
        pg.json('profile').path('age').greaterThan(18)
        pg.json('config').path(['user', 'score']).lessThan(100)
      }).not.toThrow()
    })

    test('existence checks work', () => {
      expect(() => {
        pg.json('preferences').path('theme').exists()
        pg.json('metadata').path(['user', 'profile']).exists()
      }).not.toThrow()
    })
  })

  describe('Parameter Handling', () => {
    test('hasKey() accepts string parameter', () => {
      expect(() => pg.json('preferences').hasKey('theme')).not.toThrow()
      expect(() => pg.json('preferences').hasKey('')).not.toThrow()
      expect(() => pg.json('preferences').hasKey('very_long_key_name_with_underscores')).not.toThrow()
    })

    test('hasAllKeys() accepts string array', () => {
      expect(() => pg.json('preferences').hasAllKeys(['theme', 'language'])).not.toThrow()
      expect(() => pg.json('preferences').hasAllKeys([])).not.toThrow()
      expect(() => pg.json('preferences').hasAllKeys(['single_key'])).not.toThrow()
    })

    test('hasAnyKey() accepts string array', () => {
      expect(() => pg.json('preferences').hasAnyKey(['theme', 'style'])).not.toThrow()
      expect(() => pg.json('preferences').hasAnyKey([])).not.toThrow()
      expect(() => pg.json('preferences').hasAnyKey(['multiple', 'keys', 'here'])).not.toThrow()
    })

    test('contains() accepts various value types', () => {
      expect(() => {
        pg.json('preferences').contains({theme: 'dark'})
        pg.json('preferences').contains({enabled: true})
        pg.json('preferences').contains({count: 42})
        pg.json('preferences').contains({values: [1, 2, 3]})
        pg.json('preferences').contains('string_value')
        pg.json('preferences').contains(123)
        pg.json('preferences').contains(true)
        pg.json('preferences').contains(null)
      }).not.toThrow()
    })

    test('path() accepts string or string array', () => {
      expect(() => {
        pg.json('metadata').path('theme')
        pg.json('metadata').path(['user', 'preferences'])
        pg.json('metadata').path(['nested', 'deep', 'path', 'here'])
      }).not.toThrow()
    })

    test('comparison operations accept various value types', () => {
      expect(() => {
        pg.json('preferences').path('theme').equals('dark')
        pg.json('preferences').path('count').equals(42)
        pg.json('preferences').path('enabled').equals(true)
        pg.json('preferences').path('config').equals(null)
        pg.json('preferences').path('age').greaterThan(18)
        pg.json('preferences').path('score').lessThan(100)
      }).not.toThrow()
    })
  })

  describe('Edge Cases and Error Handling', () => {
    test('handles empty string keys', () => {
      expect(() => pg.json('preferences').hasKey('')).not.toThrow()
      expect(() => pg.json('preferences').path('')).not.toThrow()
    })

    test('handles empty arrays', () => {
      expect(() => pg.json('preferences').hasAllKeys([])).not.toThrow()
      expect(() => pg.json('preferences').hasAnyKey([])).not.toThrow()
      expect(() => pg.json('preferences').path([])).not.toThrow()
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
      
      expect(() => pg.json('metadata').contains(complexObject)).not.toThrow()
    })

    test('handles special characters in keys', () => {
      expect(() => {
        pg.json('preferences').hasKey('key-with-dashes')
        pg.json('preferences').hasKey('key_with_underscores')
        pg.json('preferences').hasKey('key.with.dots')
        pg.json('preferences').hasKey('key with spaces')
        pg.json('preferences').hasKey('key@with#special$chars')
        pg.json('preferences').path('key-with-dashes').equals('value')
        pg.json('preferences').path(['key_with_underscores']).exists()
      }).not.toThrow()
    })

    test('handles unicode in keys and values', () => {
      expect(() => {
        pg.json('preferences').hasKey('键名')
        pg.json('preferences').contains({emoji: '🚀', chinese: '中文'})
        pg.json('preferences').path('français').equals('café')
      }).not.toThrow()
    })

    test('handles null and undefined values', () => {
      expect(() => {
        pg.json('preferences').contains(null)
        pg.json('preferences').contains({value: null})
        pg.json('preferences').path('nullable').equals(null)
      }).not.toThrow()
    })
  })

  describe('Return Type Validation', () => {
    test('methods return Expression types', () => {
      // These should be usable in Kysely query contexts
      const expressions = [
        pg.json('preferences').contains({theme: 'dark'}),
        pg.json('preferences').hasKey('theme'),
        pg.json('preferences').path('theme').equals('dark'),
        pg.json('preferences').path(['user', 'theme']).asText(),
        pg.json('preferences').path('age').greaterThan(18),
        pg.json('preferences').path('score').lessThan(100),
        pg.json('preferences').path('premium').exists()
      ]
      
      // Verify all expressions are objects (Expression interface)
      expressions.forEach(expr => {
        expect(typeof expr).toBe('object')
        expect(expr).not.toBeNull()
      })
    })

    test('boolean expressions have correct type inference', () => {
      // These should all be Expression<boolean>
      const booleanExpressions = [
        pg.json('preferences').contains({theme: 'dark'}),
        pg.json('preferences').hasKey('theme'),
        pg.json('preferences').hasAllKeys(['theme', 'lang']),
        pg.json('preferences').hasAnyKey(['theme', 'style']),
        pg.json('preferences').path('enabled').equals(true),
        pg.json('preferences').path(['user', 'active']).contains(true),
        pg.json('preferences').path('age').greaterThan(18),
        pg.json('preferences').path('score').lessThan(100),
        pg.json('preferences').path('premium').exists()
      ]
      
      booleanExpressions.forEach(expr => {
        expect(typeof expr).toBe('object')
      })
    })

    test('string expressions have correct type inference', () => {
      // These should all be Expression<string>
      const stringExpressions = [
        pg.json('preferences').path('theme').asText(),
        pg.json('preferences').path(['user', 'name']).asText(),
        pg.json('preferences').path(['user', 'email']).asText()
      ]
      
      stringExpressions.forEach(expr => {
        expect(typeof expr).toBe('object')
      })
    })
  })

  describe('Composition and Complex Usage', () => {
    test('multiple json operations can be combined', () => {
      expect(() => {
        // Simulate building a complex query with multiple JSON conditions
        const conditions = [
          pg.json('preferences').hasKey('theme'),
          pg.json('preferences').path('theme').equals('dark'),
          pg.json('metadata').contains({verified: true}),
          pg.json('settings').path(['notifications', 'email']).equals(true),
          pg.json('profile').path('age').greaterThan(18),
          pg.json('account').path('premium').exists()
        ]
        
        // Should be able to create multiple conditions
        expect(conditions).toHaveLength(6)
      }).not.toThrow()
    })

    test('nested path operations work correctly', () => {
      expect(() => {
        const deepPath = ['user', 'profile', 'settings', 'notifications', 'email', 'frequency']
        pg.json('metadata').path(deepPath).equals('daily')
        pg.json('metadata').path(deepPath).asText()
        pg.json('metadata').path(deepPath).exists()
      }).not.toThrow()
    })

    test('array-like JSON values can be queried', () => {
      expect(() => {
        pg.json('preferences').contains({tags: ['typescript', 'postgres']})
        pg.json('preferences').path('tags').contains(['typescript'])
        pg.json('preferences').path(['user', 'roles']).contains(['admin'])
      }).not.toThrow()
    })

    test('text mode operations work correctly', () => {
      expect(() => {
        pg.json('preferences').path('theme').asText().equals('dark')
        pg.json('preferences').path(['user', 'name']).asText().equals('john')
        pg.json('game').path('score').asText().equals('100')
      }).not.toThrow()
    })
  })
})