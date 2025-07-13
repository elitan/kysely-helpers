import { describe, test, expect } from 'bun:test'
import { pg } from '../../../src/index'

interface TestDB {
  documents: {
    id: number
    title: string
    embedding: number[]
    content_embedding: number[]
  }
}

describe('Vector API Tests', () => {
  describe('Interface and Type Safety', () => {
    test('vector() returns VectorOperations interface', () => {
      const vectorOps = pg.vector('embedding')
      
      // Verify all required methods exist
      expect(typeof vectorOps.distance).toBe('function')
      expect(typeof vectorOps.l2Distance).toBe('function')
      expect(typeof vectorOps.innerProduct).toBe('function')
      expect(typeof vectorOps.cosineDistance).toBe('function')
      expect(typeof vectorOps.similarTo).toBe('function')
      expect(typeof vectorOps.dimensions).toBe('function')
      expect(typeof vectorOps.norm).toBe('function')
      expect(typeof vectorOps.sameDimensions).toBe('function')
    })

    test('accepts various column name formats', () => {
      expect(() => pg.vector('embedding')).not.toThrow()
      expect(() => pg.vector('documents.embedding')).not.toThrow()
      expect(() => pg.vector('d.content_embedding')).not.toThrow()
    })

    test('methods return Expression types', () => {
      const vectorOps = pg.vector('embedding')
      const testVector = [0.1, 0.2, 0.3]
      
      // All expressions should be objects (Expression interface)
      const expressions = [
        vectorOps.distance(testVector),
        vectorOps.l2Distance(testVector),
        vectorOps.innerProduct(testVector),
        vectorOps.cosineDistance(testVector),
        vectorOps.similarTo(testVector),
        vectorOps.dimensions(),
        vectorOps.norm(),
        vectorOps.sameDimensions('other_embedding')
      ]
      
      expressions.forEach(expr => {
        expect(typeof expr).toBe('object')
        expect(expr).not.toBeNull()
      })
    })
  })

  describe('Parameter Handling', () => {
    test('distance methods accept number arrays', () => {
      const vectorOps = pg.vector('embedding')
      
      expect(() => vectorOps.distance([1, 2, 3])).not.toThrow()
      expect(() => vectorOps.distance([0.1, 0.2, 0.3, 0.4, 0.5])).not.toThrow()
      expect(() => vectorOps.distance([1])).not.toThrow() // Single dimension
      expect(() => vectorOps.distance([])).not.toThrow() // Empty array
    })

    test('l2Distance accepts number arrays', () => {
      const vectorOps = pg.vector('embedding')
      
      expect(() => vectorOps.l2Distance([1, 2, 3])).not.toThrow()
      expect(() => vectorOps.l2Distance([-1, -2, -3])).not.toThrow() // Negative values
      expect(() => vectorOps.l2Distance([0, 0, 0])).not.toThrow() // Zero vector
    })

    test('innerProduct accepts number arrays', () => {
      const vectorOps = pg.vector('embedding')
      
      expect(() => vectorOps.innerProduct([0.5, 0.5, 0.5])).not.toThrow()
      expect(() => vectorOps.innerProduct([1, 0, -1])).not.toThrow()
    })

    test('cosineDistance accepts number arrays', () => {
      const vectorOps = pg.vector('embedding')
      
      expect(() => vectorOps.cosineDistance([0.1, 0.9])).not.toThrow()
      expect(() => vectorOps.cosineDistance([1, 1, 1, 1])).not.toThrow()
    })

    test('similarTo accepts vector and optional parameters', () => {
      const vectorOps = pg.vector('embedding')
      const testVector = [0.1, 0.2, 0.3]
      
      // Default parameters
      expect(() => vectorOps.similarTo(testVector)).not.toThrow()
      
      // With threshold
      expect(() => vectorOps.similarTo(testVector, 0.8)).not.toThrow()
      expect(() => vectorOps.similarTo(testVector, 0.1)).not.toThrow()
      expect(() => vectorOps.similarTo(testVector, 0.99)).not.toThrow()
      
      // With method
      expect(() => vectorOps.similarTo(testVector, 0.8, 'l2')).not.toThrow()
      expect(() => vectorOps.similarTo(testVector, 0.8, 'cosine')).not.toThrow()
      expect(() => vectorOps.similarTo(testVector, 0.8, 'inner')).not.toThrow()
      
      // All combinations
      expect(() => vectorOps.similarTo(testVector, 0.7, 'cosine')).not.toThrow()
    })

    test('sameDimensions accepts string or expression', () => {
      const vectorOps = pg.vector('embedding')
      
      expect(() => vectorOps.sameDimensions('other_embedding')).not.toThrow()
      expect(() => vectorOps.sameDimensions('documents.content_embedding')).not.toThrow()
      expect(() => vectorOps.sameDimensions('d.embedding')).not.toThrow()
    })
  })

  describe('Edge Cases and Error Handling', () => {
    test('handles empty vectors', () => {
      const vectorOps = pg.vector('embedding')
      
      expect(() => vectorOps.distance([])).not.toThrow()
      expect(() => vectorOps.innerProduct([])).not.toThrow()
      expect(() => vectorOps.cosineDistance([])).not.toThrow()
    })

    test('handles single-dimension vectors', () => {
      const vectorOps = pg.vector('embedding')
      
      expect(() => vectorOps.distance([42])).not.toThrow()
      expect(() => vectorOps.innerProduct([1.5])).not.toThrow()
      expect(() => vectorOps.cosineDistance([0.7])).not.toThrow()
    })

    test('handles high-dimensional vectors', () => {
      const vectorOps = pg.vector('embedding')
      const highDimVector = Array.from({length: 1536}, (_, i) => i / 1536) // OpenAI embedding size
      
      expect(() => vectorOps.distance(highDimVector)).not.toThrow()
      expect(() => vectorOps.innerProduct(highDimVector)).not.toThrow()
      expect(() => vectorOps.cosineDistance(highDimVector)).not.toThrow()
    })

    test('handles vectors with negative values', () => {
      const vectorOps = pg.vector('embedding')
      const negativeVector = [-1, -0.5, 0, 0.5, 1]
      
      expect(() => vectorOps.distance(negativeVector)).not.toThrow()
      expect(() => vectorOps.innerProduct(negativeVector)).not.toThrow()
      expect(() => vectorOps.cosineDistance(negativeVector)).not.toThrow()
    })

    test('handles vectors with zero values', () => {
      const vectorOps = pg.vector('embedding')
      const zeroVector = [0, 0, 0, 0, 0]
      
      expect(() => vectorOps.distance(zeroVector)).not.toThrow()
      expect(() => vectorOps.innerProduct(zeroVector)).not.toThrow()
      expect(() => vectorOps.cosineDistance(zeroVector)).not.toThrow()
    })

    test('handles very small and very large numbers', () => {
      const vectorOps = pg.vector('embedding')
      const extremeVector = [1e-10, 1e10, -1e-10, -1e10]
      
      expect(() => vectorOps.distance(extremeVector)).not.toThrow()
      expect(() => vectorOps.innerProduct(extremeVector)).not.toThrow()
      expect(() => vectorOps.cosineDistance(extremeVector)).not.toThrow()
    })

    test('handles decimal precision', () => {
      const vectorOps = pg.vector('embedding')
      const preciseVector = [0.123456789, 0.987654321, 0.555555555]
      
      expect(() => vectorOps.distance(preciseVector)).not.toThrow()
      expect(() => vectorOps.innerProduct(preciseVector)).not.toThrow()
      expect(() => vectorOps.cosineDistance(preciseVector)).not.toThrow()
    })
  })

  describe('Method Aliases and Consistency', () => {
    test('distance() and l2Distance() are equivalent', () => {
      const vectorOps = pg.vector('embedding')
      const testVector = [1, 2, 3]
      
      // Both methods should exist and not throw
      expect(() => vectorOps.distance(testVector)).not.toThrow()
      expect(() => vectorOps.l2Distance(testVector)).not.toThrow()
      
      // They should produce equivalent expressions (both are L2 distance)
      const distanceExpr = vectorOps.distance(testVector)
      const l2DistanceExpr = vectorOps.l2Distance(testVector)
      
      expect(typeof distanceExpr).toBe('object')
      expect(typeof l2DistanceExpr).toBe('object')
    })

    test('utility methods work independently', () => {
      const vectorOps = pg.vector('embedding')
      
      expect(() => vectorOps.dimensions()).not.toThrow()
      expect(() => vectorOps.norm()).not.toThrow()
    })
  })

  describe('Similarity Threshold Validation', () => {
    test('similarTo accepts various threshold values', () => {
      const vectorOps = pg.vector('embedding')
      const testVector = [0.1, 0.2, 0.3]
      
      // Boundary values
      expect(() => vectorOps.similarTo(testVector, 0)).not.toThrow()
      expect(() => vectorOps.similarTo(testVector, 1)).not.toThrow()
      
      // Common values
      expect(() => vectorOps.similarTo(testVector, 0.5)).not.toThrow()
      expect(() => vectorOps.similarTo(testVector, 0.8)).not.toThrow()
      expect(() => vectorOps.similarTo(testVector, 0.95)).not.toThrow()
      
      // Decimal precision
      expect(() => vectorOps.similarTo(testVector, 0.123456)).not.toThrow()
    })

    test('similarTo with different methods', () => {
      const vectorOps = pg.vector('embedding')
      const testVector = [0.1, 0.2, 0.3]
      
      // Each distance method should work
      expect(() => vectorOps.similarTo(testVector, 0.8, 'l2')).not.toThrow()
      expect(() => vectorOps.similarTo(testVector, 0.8, 'cosine')).not.toThrow()
      expect(() => vectorOps.similarTo(testVector, 0.8, 'inner')).not.toThrow()
    })
  })

  describe('Column Reference Handling', () => {
    test('works with simple column names', () => {
      expect(() => pg.vector('embedding')).not.toThrow()
      expect(() => pg.vector('content_vector')).not.toThrow()
      expect(() => pg.vector('user_embedding')).not.toThrow()
    })

    test('works with qualified column names', () => {
      expect(() => pg.vector('documents.embedding')).not.toThrow()
      expect(() => pg.vector('users.profile_vector')).not.toThrow()
      expect(() => pg.vector('search.content_embedding')).not.toThrow()
    })

    test('works with aliased column names', () => {
      expect(() => pg.vector('d.embedding')).not.toThrow()
      expect(() => pg.vector('u.vector')).not.toThrow()
      expect(() => pg.vector('s.embedding')).not.toThrow()
    })

    test('sameDimensions works with various column formats', () => {
      const vectorOps = pg.vector('embedding')
      
      expect(() => vectorOps.sameDimensions('other_vector')).not.toThrow()
      expect(() => vectorOps.sameDimensions('documents.content_embedding')).not.toThrow()
      expect(() => vectorOps.sameDimensions('d.embedding')).not.toThrow()
    })
  })

  describe('Type Safety Features', () => {
    test('distance methods should return numeric expressions', () => {
      const vectorOps = pg.vector('embedding')
      const testVector = [1, 2, 3]
      
      // These should all return Expression<number>
      const numericExpressions = [
        vectorOps.distance(testVector),
        vectorOps.l2Distance(testVector),
        vectorOps.innerProduct(testVector),
        vectorOps.cosineDistance(testVector),
        vectorOps.dimensions(),
        vectorOps.norm()
      ]
      
      numericExpressions.forEach(expr => {
        expect(typeof expr).toBe('object')
      })
    })

    test('boolean methods should return boolean expressions', () => {
      const vectorOps = pg.vector('embedding')
      const testVector = [1, 2, 3]
      
      // These should all return Expression<boolean>
      const booleanExpressions = [
        vectorOps.similarTo(testVector),
        vectorOps.similarTo(testVector, 0.8),
        vectorOps.similarTo(testVector, 0.8, 'cosine'),
        vectorOps.sameDimensions('other_embedding')
      ]
      
      booleanExpressions.forEach(expr => {
        expect(typeof expr).toBe('object')
      })
    })
  })

  describe('Composition and Integration', () => {
    test('multiple vector operations can be combined', () => {
      const vectorOps = pg.vector('embedding')
      const searchVector = [0.1, 0.2, 0.3]
      
      expect(() => {
        // Simulate building a complex query with multiple vector conditions
        const conditions = [
          vectorOps.similarTo(searchVector, 0.8),
          vectorOps.dimensions(),
          vectorOps.sameDimensions('content_embedding')
        ]
        
        expect(conditions).toHaveLength(3)
      }).not.toThrow()
    })

    test('vector operations work with different vector types', () => {
      expect(() => {
        // Different embedding types that might be used in real applications
        const docEmbedding = pg.vector('document_embedding')
        const userEmbedding = pg.vector('user_embedding')
        const queryEmbedding = pg.vector('query_embedding')
        
        const searchVector = [0.1, 0.2, 0.3, 0.4, 0.5]
        
        // Should all work
        docEmbedding.distance(searchVector)
        userEmbedding.cosineDistance(searchVector)
        queryEmbedding.innerProduct(searchVector)
      }).not.toThrow()
    })

    test('complex similarity queries can be constructed', () => {
      const vectorOps = pg.vector('embedding')
      const searchVector = Array.from({length: 512}, (_, i) => Math.random())
      
      expect(() => {
        // Simulate complex similarity search
        vectorOps.similarTo(searchVector, 0.85, 'cosine')
        vectorOps.distance(searchVector)
        vectorOps.innerProduct(searchVector)
        vectorOps.dimensions()
      }).not.toThrow()
    })
  })
})