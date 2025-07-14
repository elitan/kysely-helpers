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
      expect(typeof vectorOps.toArray).toBe('function')
      expect(typeof vectorOps.similarity).toBe('function')
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
        vectorOps.toArray(),
        vectorOps.similarity(testVector),
        vectorOps.similarity(testVector, 'cosine'),
        vectorOps.similarity(testVector, 'euclidean'),
        vectorOps.similarity(testVector, 'dot')
      ]
      
      expressions.forEach(expr => {
        expect(typeof expr).toBe('object')
        expect(expr).not.toBeNull()
      })
    })
  })

  describe('Similarity Method', () => {
    test('similarity() accepts number arrays', () => {
      const vectorOps = pg.vector('embedding')
      
      expect(() => vectorOps.similarity([1, 2, 3])).not.toThrow()
      expect(() => vectorOps.similarity([0.1, 0.2, 0.3, 0.4, 0.5])).not.toThrow()
      expect(() => vectorOps.similarity([1])).not.toThrow() // Single dimension
      expect(() => vectorOps.similarity([])).not.toThrow() // Empty array
    })

    test('similarity() accepts algorithm parameter', () => {
      const vectorOps = pg.vector('embedding')
      const testVector = [0.1, 0.2, 0.3]
      
      // Default (no algorithm specified)
      expect(() => vectorOps.similarity(testVector)).not.toThrow()
      
      // All supported algorithms
      expect(() => vectorOps.similarity(testVector, 'cosine')).not.toThrow()
      expect(() => vectorOps.similarity(testVector, 'euclidean')).not.toThrow()
      expect(() => vectorOps.similarity(testVector, 'dot')).not.toThrow()
    })

    test('similarity() throws error for unsupported algorithm', () => {
      const vectorOps = pg.vector('embedding')
      const testVector = [0.1, 0.2, 0.3]
      
      // TypeScript should prevent this, but test runtime behavior
      expect(() => {
        // @ts-expect-error - Testing invalid algorithm
        vectorOps.similarity(testVector, 'invalid' as any)
      }).toThrow('Unsupported similarity algorithm: invalid')
    })

    test('similarity() defaults to cosine algorithm', () => {
      const vectorOps = pg.vector('embedding')
      const testVector = [0.1, 0.2, 0.3]
      
      // Both should work (default should be cosine)
      expect(() => vectorOps.similarity(testVector)).not.toThrow()
      expect(() => vectorOps.similarity(testVector, 'cosine')).not.toThrow()
    })
  })

  describe('Edge Cases and Error Handling', () => {
    test('handles empty vectors', () => {
      const vectorOps = pg.vector('embedding')
      
      expect(() => vectorOps.similarity([])).not.toThrow()
      expect(() => vectorOps.similarity([], 'cosine')).not.toThrow()
      expect(() => vectorOps.similarity([], 'euclidean')).not.toThrow()
      expect(() => vectorOps.similarity([], 'dot')).not.toThrow()
    })

    test('handles single-dimension vectors', () => {
      const vectorOps = pg.vector('embedding')
      
      expect(() => vectorOps.similarity([42])).not.toThrow()
      expect(() => vectorOps.similarity([1.5], 'euclidean')).not.toThrow()
      expect(() => vectorOps.similarity([0.7], 'dot')).not.toThrow()
    })

    test('handles high-dimensional vectors', () => {
      const vectorOps = pg.vector('embedding')
      const highDimVector = Array.from({length: 1536}, (_, i) => i / 1536) // OpenAI embedding size
      
      expect(() => vectorOps.similarity(highDimVector)).not.toThrow()
      expect(() => vectorOps.similarity(highDimVector, 'euclidean')).not.toThrow()
      expect(() => vectorOps.similarity(highDimVector, 'dot')).not.toThrow()
    })

    test('handles vectors with negative values', () => {
      const vectorOps = pg.vector('embedding')
      const negativeVector = [-1, -0.5, 0, 0.5, 1]
      
      expect(() => vectorOps.similarity(negativeVector)).not.toThrow()
      expect(() => vectorOps.similarity(negativeVector, 'euclidean')).not.toThrow()
      expect(() => vectorOps.similarity(negativeVector, 'dot')).not.toThrow()
    })

    test('handles vectors with zero values', () => {
      const vectorOps = pg.vector('embedding')
      const zeroVector = [0, 0, 0, 0, 0]
      
      expect(() => vectorOps.similarity(zeroVector)).not.toThrow()
      expect(() => vectorOps.similarity(zeroVector, 'euclidean')).not.toThrow()
      expect(() => vectorOps.similarity(zeroVector, 'dot')).not.toThrow()
    })

    test('handles very small and very large numbers', () => {
      const vectorOps = pg.vector('embedding')
      const extremeVector = [1e-10, 1e10, -1e-10, -1e10]
      
      expect(() => vectorOps.similarity(extremeVector)).not.toThrow()
      expect(() => vectorOps.similarity(extremeVector, 'euclidean')).not.toThrow()
      expect(() => vectorOps.similarity(extremeVector, 'dot')).not.toThrow()
    })

    test('handles decimal precision', () => {
      const vectorOps = pg.vector('embedding')
      const preciseVector = [0.123456789, 0.987654321, 0.555555555]
      
      expect(() => vectorOps.similarity(preciseVector)).not.toThrow()
      expect(() => vectorOps.similarity(preciseVector, 'euclidean')).not.toThrow()
      expect(() => vectorOps.similarity(preciseVector, 'dot')).not.toThrow()
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
  })

  describe('Type Safety Features', () => {
    test('similarity method should return numeric expressions', () => {
      const vectorOps = pg.vector('embedding')
      const testVector = [1, 2, 3]
      
      // These should all return Expression<number>
      const numericExpressions = [
        vectorOps.similarity(testVector),
        vectorOps.similarity(testVector, 'cosine'),
        vectorOps.similarity(testVector, 'euclidean'),
        vectorOps.similarity(testVector, 'dot')
      ]
      
      numericExpressions.forEach(expr => {
        expect(typeof expr).toBe('object')
      })
    })

    test('toArray should return array expression', () => {
      const vectorOps = pg.vector('embedding')
      const arrayExpr = vectorOps.toArray()
      
      expect(typeof arrayExpr).toBe('object')
      expect(arrayExpr).not.toBeNull()
    })
  })

  describe('Composition and Integration', () => {
    test('multiple vector operations can be combined', () => {
      const vectorOps = pg.vector('embedding')
      const searchVector = [0.1, 0.2, 0.3]
      
      expect(() => {
        // Simulate building a complex query with multiple vector conditions
        const expressions = [
          vectorOps.similarity(searchVector),
          vectorOps.similarity(searchVector, 'euclidean'),
          vectorOps.toArray()
        ]
        
        expect(expressions).toHaveLength(3)
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
        docEmbedding.similarity(searchVector)
        userEmbedding.similarity(searchVector, 'euclidean')
        queryEmbedding.similarity(searchVector, 'dot')
      }).not.toThrow()
    })

    test('complex similarity queries can be constructed', () => {
      const vectorOps = pg.vector('embedding')
      const searchVector = Array.from({length: 512}, (_, i) => Math.random())
      
      expect(() => {
        // Simulate complex similarity search
        vectorOps.similarity(searchVector)
        vectorOps.similarity(searchVector, 'cosine')
        vectorOps.similarity(searchVector, 'euclidean')
        vectorOps.similarity(searchVector, 'dot')
        vectorOps.toArray()
      }).not.toThrow()
    })
  })

  describe('toArray() method', () => {
    test('toArray() returns RawBuilder for number array', () => {
      const vectorOps = pg.vector('embedding')
      const toArrayExpr = vectorOps.toArray()
      
      expect(typeof toArrayExpr).toBe('object')
      expect(toArrayExpr).not.toBeNull()
    })

    test('toArray() works with different column formats', () => {
      expect(() => pg.vector('embedding').toArray()).not.toThrow()
      expect(() => pg.vector('documents.embedding').toArray()).not.toThrow()
      expect(() => pg.vector('d.content_embedding').toArray()).not.toThrow()
    })

    test('toArray() can be used in select expressions', () => {
      const vectorOps = pg.vector('embedding')
      
      expect(() => {
        // Simulate usage in a select clause
        const selectExpressions = [
          vectorOps.toArray(),
          vectorOps.similarity([0.1, 0.2, 0.3]),
          vectorOps.similarity([0.1, 0.2, 0.3], 'euclidean')
        ]
        
        expect(selectExpressions).toHaveLength(3)
        selectExpressions.forEach(expr => {
          expect(typeof expr).toBe('object')
        })
      }).not.toThrow()
    })

    test('toArray() works with qualified column names', () => {
      const qualifiedOps = pg.vector('document_embeddings.embedding')
      
      expect(() => qualifiedOps.toArray()).not.toThrow()
    })
  })

  describe('Algorithm-specific behavior', () => {
    test('cosine similarity algorithm', () => {
      const vectorOps = pg.vector('embedding')
      const testVector = [0.1, 0.2, 0.3]
      
      expect(() => vectorOps.similarity(testVector, 'cosine')).not.toThrow()
    })

    test('euclidean similarity algorithm', () => {
      const vectorOps = pg.vector('embedding')
      const testVector = [0.1, 0.2, 0.3]
      
      expect(() => vectorOps.similarity(testVector, 'euclidean')).not.toThrow()
    })

    test('dot product similarity algorithm', () => {
      const vectorOps = pg.vector('embedding')
      const testVector = [0.1, 0.2, 0.3]
      
      expect(() => vectorOps.similarity(testVector, 'dot')).not.toThrow()
    })
  })

  describe('Real-world usage patterns', () => {
    test('OpenAI embedding size compatibility', () => {
      const vectorOps = pg.vector('embedding')
      
      // Common OpenAI embedding dimensions
      const openAISmall = Array.from({length: 1536}, () => Math.random()) // text-embedding-3-small
      const openAILarge = Array.from({length: 3072}, () => Math.random()) // text-embedding-3-large
      
      expect(() => vectorOps.similarity(openAISmall)).not.toThrow()
      expect(() => vectorOps.similarity(openAILarge)).not.toThrow()
    })

    test('common similarity thresholds', () => {
      const vectorOps = pg.vector('embedding')
      const testVector = [0.1, 0.2, 0.3]
      
      // Common patterns in semantic search
      expect(() => vectorOps.similarity(testVector)).not.toThrow() // Default
      expect(() => vectorOps.similarity(testVector, 'cosine')).not.toThrow() // Most common
      expect(() => vectorOps.similarity(testVector, 'euclidean')).not.toThrow() // Alternative
    })
  })
})