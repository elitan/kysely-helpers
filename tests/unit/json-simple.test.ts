import { describe, test, expect } from 'bun:test'
import { pg } from '../../src/index'

describe('JSON Operations - Basic Function Tests', () => {
  describe('Function creation', () => {
    test('pg.json() returns an object with expected methods', () => {
      const jsonOps = pg.json('metadata')
      
      expect(typeof jsonOps.get).toBe('function')
      expect(typeof jsonOps.getText).toBe('function')
      expect(typeof jsonOps.path).toBe('function')
      expect(typeof jsonOps.pathText).toBe('function')
      expect(typeof jsonOps.contains).toBe('function')
      expect(typeof jsonOps.containedBy).toBe('function')
      expect(typeof jsonOps.hasKey).toBe('function')
      expect(typeof jsonOps.hasAllKeys).toBe('function')
      expect(typeof jsonOps.hasAnyKey).toBe('function')
    })
  })

  describe('Method calls', () => {
    test('get() method can be called', () => {
      const jsonOps = pg.json('metadata')
      
      expect(() => {
        const result = jsonOps.get('theme')
        expect(typeof result.equals).toBe('function')
        expect(typeof result.contains).toBe('function')
        expect(typeof result.asText).toBe('function')
      }).not.toThrow()
    })

    test('getText() method can be called', () => {
      const jsonOps = pg.json('settings')
      
      expect(() => {
        jsonOps.getText('language')
      }).not.toThrow()
    })

    test('path() method can be called with array', () => {
      const jsonOps = pg.json('metadata')
      
      expect(() => {
        const result = jsonOps.path(['user', 'preferences'])
        expect(typeof result.equals).toBe('function')
      }).not.toThrow()
    })

    test('path() method can be called with string', () => {
      const jsonOps = pg.json('data')
      
      expect(() => {
        const result = jsonOps.path('$.user.name')
        expect(typeof result.asText).toBe('function')
      }).not.toThrow()
    })

    test('contains() method can be called', () => {
      const jsonOps = pg.json('profile')
      
      expect(() => {
        jsonOps.contains({verified: true})
      }).not.toThrow()
    })

    test('hasKey() method can be called', () => {
      const jsonOps = pg.json('metadata')
      
      expect(() => {
        jsonOps.hasKey('published')
      }).not.toThrow()
    })

    test('hasAllKeys() method can be called', () => {
      const jsonOps = pg.json('permissions')
      
      expect(() => {
        jsonOps.hasAllKeys(['read', 'write'])
      }).not.toThrow()
    })

    test('hasAnyKey() method can be called', () => {
      const jsonOps = pg.json('metadata')
      
      expect(() => {
        jsonOps.hasAnyKey(['title', 'subject'])
      }).not.toThrow()
    })
  })

  describe('Edge cases', () => {
    test('handles complex objects', () => {
      const complexObject = {
        user: { 
          id: 1, 
          preferences: { theme: 'dark', notifications: true },
          roles: ['admin', 'user']
        }
      }
      
      expect(() => {
        pg.json('data').contains(complexObject)
      }).not.toThrow()
    })

    test('handles empty arrays and objects', () => {
      expect(() => {
        pg.json('data').contains({})
        pg.json('data').contains([])
        pg.json('data').hasAllKeys([])
        pg.json('data').hasAnyKey([])
      }).not.toThrow()
    })

    test('handles special characters in keys', () => {
      expect(() => {
        pg.json('data').hasKey('user-email')
        pg.json('data').hasKey('user_id')
        pg.json('data').hasKey('user.name')
      }).not.toThrow()
    })
  })
})