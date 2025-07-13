import { describe, test, expect } from 'bun:test'
import { pg } from '../../src/index'

describe('Vector Operations - Basic Function Tests', () => {
  const testVector = [0.1, 0.2, 0.3, 0.4, 0.5]

  describe('Function creation', () => {
    test('pg.vector() returns an object with expected methods', () => {
      const vectorOps = pg.vector('embedding')
      
      expect(typeof vectorOps.distance).toBe('function')
      expect(typeof vectorOps.l2Distance).toBe('function')
      expect(typeof vectorOps.innerProduct).toBe('function')
      expect(typeof vectorOps.cosineDistance).toBe('function')
      expect(typeof vectorOps.similarTo).toBe('function')
      expect(typeof vectorOps.dimensions).toBe('function')
      expect(typeof vectorOps.norm).toBe('function')
      expect(typeof vectorOps.sameDimensions).toBe('function')
    })
  })

  describe('Distance methods', () => {
    test('distance() method can be called', () => {
      const vectorOps = pg.vector('embedding')
      
      expect(() => {
        vectorOps.distance(testVector)
      }).not.toThrow()
    })

    test('l2Distance() method can be called', () => {
      const vectorOps = pg.vector('embedding')
      
      expect(() => {
        vectorOps.l2Distance(testVector)
      }).not.toThrow()
    })

    test('innerProduct() method can be called', () => {
      const vectorOps = pg.vector('embedding')
      
      expect(() => {
        vectorOps.innerProduct(testVector)
      }).not.toThrow()
    })

    test('cosineDistance() method can be called', () => {
      const vectorOps = pg.vector('embedding')
      
      expect(() => {
        vectorOps.cosineDistance(testVector)
      }).not.toThrow()
    })
  })

  describe('Similarity methods', () => {
    test('similarTo() with default parameters', () => {
      const vectorOps = pg.vector('embedding')
      
      expect(() => {
        vectorOps.similarTo(testVector)
      }).not.toThrow()
    })

    test('similarTo() with custom threshold', () => {
      const vectorOps = pg.vector('embedding')
      
      expect(() => {
        vectorOps.similarTo(testVector, 0.8)
      }).not.toThrow()
    })

    test('similarTo() with different methods', () => {
      const vectorOps = pg.vector('embedding')
      
      expect(() => {
        vectorOps.similarTo(testVector, 0.8, 'l2')
        vectorOps.similarTo(testVector, 0.8, 'cosine')
        vectorOps.similarTo(testVector, 0.8, 'inner')
      }).not.toThrow()
    })
  })

  describe('Utility methods', () => {
    test('dimensions() method can be called', () => {
      const vectorOps = pg.vector('embedding')
      
      expect(() => {
        vectorOps.dimensions()
      }).not.toThrow()
    })

    test('norm() method can be called', () => {
      const vectorOps = pg.vector('embedding')
      
      expect(() => {
        vectorOps.norm()
      }).not.toThrow()
    })

    test('sameDimensions() with string column', () => {
      const vectorOps = pg.vector('embedding1')
      
      expect(() => {
        vectorOps.sameDimensions('embedding2')
      }).not.toThrow()
    })

    test('sameDimensions() with expression', () => {
      const vectorOps1 = pg.vector('embedding1')
      const vectorOps2 = pg.vector('embedding2')
      
      expect(() => {
        vectorOps1.sameDimensions(vectorOps2.dimensions())
      }).not.toThrow()
    })
  })

  describe('Different vector formats', () => {
    test('handles single dimension vectors', () => {
      const singleDim = [0.5]
      
      expect(() => {
        pg.vector('simple').distance(singleDim)
      }).not.toThrow()
    })

    test('handles high-dimensional vectors', () => {
      const highDim = Array.from({length: 1536}, (_, i) => i * 0.001)
      
      expect(() => {
        pg.vector('openai_embedding').distance(highDim)
      }).not.toThrow()
    })

    test('handles integer vectors', () => {
      const intVector = [1, 2, 3, 4, 5]
      
      expect(() => {
        pg.vector('int_embedding').distance(intVector)
      }).not.toThrow()
    })

    test('handles negative values', () => {
      const negativeVector = [-0.1, -0.2, 0.3, -0.4, 0.5]
      
      expect(() => {
        pg.vector('embedding').innerProduct(negativeVector)
      }).not.toThrow()
    })
  })

  describe('Edge cases', () => {
    test('handles empty vectors', () => {
      expect(() => {
        pg.vector('embedding').distance([])
      }).not.toThrow()
    })

    test('handles zero vectors', () => {
      const zeroVector = [0, 0, 0, 0, 0]
      
      expect(() => {
        pg.vector('embedding').similarTo(zeroVector, 0.5)
      }).not.toThrow()
    })

    test('handles extreme threshold values', () => {
      expect(() => {
        pg.vector('embedding').similarTo(testVector, 0.0)  // Exact match
        pg.vector('embedding').similarTo(testVector, 1.0)  // Maximum similarity
      }).not.toThrow()
    })

    test('handles very small and large values', () => {
      const extremeVector = [0.000001, 999999.9, -0.000001, -999999.9]
      
      expect(() => {
        pg.vector('embedding').distance(extremeVector)
      }).not.toThrow()
    })
  })

  describe('Column formats', () => {
    test('works with simple column names', () => {
      expect(() => {
        pg.vector('embedding').distance(testVector)
      }).not.toThrow()
    })

    test('works with qualified column names', () => {
      expect(() => {
        pg.vector('documents.embedding').distance(testVector)
      }).not.toThrow()
    })

    test('works with aliased table columns', () => {
      expect(() => {
        pg.vector('d.content_vector').cosineDistance(testVector)
      }).not.toThrow()
    })
  })
})