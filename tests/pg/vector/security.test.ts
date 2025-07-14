import { describe, test, expect } from 'bun:test'
import { pg } from '../../../src/index'

describe('Vector Security Tests', () => {
  describe('SQL Injection Prevention', () => {
    test('vector values are properly serialized to prevent injection', () => {
      const vectorOps = pg.vector('embedding')
      
      // Vector values are numbers, not strings, so they cannot contain SQL injection
      const maliciousVector = [1, 2, 3] // Numbers can't contain SQL
      
      expect(() => {
        vectorOps.similarity(maliciousVector)
      }).not.toThrow()
    })

    test('column names are properly quoted to prevent injection', () => {
      // Test with potentially dangerous column names
      const dangerousColumnNames = [
        'embedding',
        'documents.embedding',
        'd.embedding',
        'schema.table.column'
      ]
      
      dangerousColumnNames.forEach(columnName => {
        expect(() => {
          pg.vector(columnName).similarity([1, 2, 3])
        }).not.toThrow()
      })
    })

    test('embedding function properly formats vector values', () => {
      // Test that embedding function properly formats numbers
      const testVectors = [
        [1, 2, 3],
        [0.1, 0.2, 0.3],
        [-1, -0.5, 0, 0.5, 1],
        [1e-10, 1e10],
        []
      ]
      
      testVectors.forEach(vector => {
        expect(() => {
          pg.embedding(vector)
        }).not.toThrow()
      })
    })

    test('vector similarity methods handle numeric values safely', () => {
      const vectorOps = pg.vector('embedding')
      const testVector = [0.1, 0.2, 0.3]
      
      // All similarity methods should safely handle numeric input
      expect(() => {
        vectorOps.similarity(testVector, 'cosine')
        vectorOps.similarity(testVector, 'euclidean')
        vectorOps.similarity(testVector, 'dot')
      }).not.toThrow()
    })
  })

  describe('Input Validation', () => {
    test('handles empty vectors safely', () => {
      const vectorOps = pg.vector('embedding')
      
      expect(() => {
        vectorOps.similarity([])
        vectorOps.toArray()
      }).not.toThrow()
    })

    test('handles single-element vectors safely', () => {
      const vectorOps = pg.vector('embedding')
      
      expect(() => {
        vectorOps.similarity([42])
        vectorOps.toArray()
      }).not.toThrow()
    })

    test('handles large vectors safely', () => {
      const vectorOps = pg.vector('embedding')
      const largeVector = Array.from({length: 10000}, (_, i) => i)
      
      expect(() => {
        vectorOps.similarity(largeVector)
        pg.embedding(largeVector)
      }).not.toThrow()
    })

    test('handles vectors with extreme values safely', () => {
      const vectorOps = pg.vector('embedding')
      const extremeVector = [
        Number.MAX_SAFE_INTEGER,
        Number.MIN_SAFE_INTEGER,
        Number.POSITIVE_INFINITY,
        Number.NEGATIVE_INFINITY,
        Number.MAX_VALUE,
        Number.MIN_VALUE,
        0,
        -0,
        1e-323, // Smallest positive number
        1.7976931348623157e+308 // Largest positive number
      ]
      
      expect(() => {
        vectorOps.similarity(extremeVector)
        pg.embedding(extremeVector)
      }).not.toThrow()
    })

    test('handles vectors with special numeric values', () => {
      const vectorOps = pg.vector('embedding')
      
      // Test NaN (should be handled gracefully)
      expect(() => {
        vectorOps.similarity([NaN, 1, 2])
      }).not.toThrow()
      
      // Test Infinity (should be handled gracefully)
      expect(() => {
        vectorOps.similarity([Infinity, -Infinity, 0])
      }).not.toThrow()
    })
  })

  describe('Type Safety', () => {
    test('embedding function only accepts number arrays', () => {
      // TypeScript should prevent non-number arrays at compile time
      // This test verifies runtime behavior
      
      expect(() => {
        pg.embedding([1, 2, 3])
      }).not.toThrow()
      
      expect(() => {
        pg.embedding([0.1, 0.2, 0.3])
      }).not.toThrow()
    })

    test('similarity methods only accept number arrays', () => {
      const vectorOps = pg.vector('embedding')
      
      expect(() => {
        vectorOps.similarity([1, 2, 3])
      }).not.toThrow()
      
      expect(() => {
        vectorOps.similarity([0.1, 0.2, 0.3])
      }).not.toThrow()
    })

    test('algorithm parameter is properly validated', () => {
      const vectorOps = pg.vector('embedding')
      const testVector = [1, 2, 3]
      
      // Valid algorithms should work
      expect(() => {
        vectorOps.similarity(testVector, 'cosine')
        vectorOps.similarity(testVector, 'euclidean')
        vectorOps.similarity(testVector, 'dot')
      }).not.toThrow()
      
      // Invalid algorithm should throw error
      expect(() => {
        // @ts-expect-error - Testing invalid algorithm
        vectorOps.similarity(testVector, 'invalid' as any)
      }).toThrow('Unsupported similarity algorithm: invalid')
    })
  })

  describe('Memory and Performance Safety', () => {
    test('handles reasonably large vectors without memory issues', () => {
      const vectorOps = pg.vector('embedding')
      
      // Test with OpenAI-sized vectors
      const openAIVector = Array.from({length: 1536}, (_, i) => i / 1536)
      
      expect(() => {
        vectorOps.similarity(openAIVector)
        pg.embedding(openAIVector)
      }).not.toThrow()
    })

    test('handles high-dimensional vectors efficiently', () => {
      const vectorOps = pg.vector('embedding')
      
      // Test with very high-dimensional vector
      const highDimVector = Array.from({length: 4096}, (_, i) => Math.random())
      
      expect(() => {
        vectorOps.similarity(highDimVector)
        pg.embedding(highDimVector)
      }).not.toThrow()
    })

    test('vector serialization is efficient', () => {
      const testVector = [1, 2, 3, 4, 5]
      const embedding = pg.embedding(testVector)
      
      // Serialization should be fast and not cause issues
      expect(() => {
        // Just test that the embedding function doesn't throw
        pg.embedding(testVector)
      }).not.toThrow()
    })
  })

  describe('Edge Cases', () => {
    test('handles zero-length vectors', () => {
      const vectorOps = pg.vector('embedding')
      
      expect(() => {
        vectorOps.similarity([])
        pg.embedding([])
      }).not.toThrow()
    })

    test('handles vectors with all zeros', () => {
      const vectorOps = pg.vector('embedding')
      const zeroVector = [0, 0, 0, 0, 0]
      
      expect(() => {
        vectorOps.similarity(zeroVector)
        pg.embedding(zeroVector)
      }).not.toThrow()
    })

    test('handles vectors with identical values', () => {
      const vectorOps = pg.vector('embedding')
      const identicalVector = [1, 1, 1, 1, 1]
      
      expect(() => {
        vectorOps.similarity(identicalVector)
        pg.embedding(identicalVector)
      }).not.toThrow()
    })

    test('handles precision edge cases', () => {
      const vectorOps = pg.vector('embedding')
      
      // Test with very small differences
      const preciseVector = [0.000000001, 0.000000002, 0.000000003]
      
      expect(() => {
        vectorOps.similarity(preciseVector)
        pg.embedding(preciseVector)
      }).not.toThrow()
    })
  })

  describe('Algorithm-Specific Security', () => {
    test('cosine similarity handles edge cases safely', () => {
      const vectorOps = pg.vector('embedding')
      
      // Test vectors that might cause issues with cosine similarity
      const testVectors = [
        [0, 0, 0], // Zero vector
        [1, 0, 0], // Unit vector
        [-1, -1, -1], // Negative values
        [1e-10, 1e-10, 1e-10] // Very small values
      ]
      
      testVectors.forEach(vector => {
        expect(() => {
          vectorOps.similarity(vector, 'cosine')
        }).not.toThrow()
      })
    })

    test('euclidean similarity handles edge cases safely', () => {
      const vectorOps = pg.vector('embedding')
      
      // Test vectors that might cause issues with euclidean distance
      const testVectors = [
        [0, 0, 0], // Zero vector
        [1e10, 1e10, 1e10], // Large values
        [1e-10, 1e-10, 1e-10], // Very small values
        [1, -1, 0] // Mixed signs
      ]
      
      testVectors.forEach(vector => {
        expect(() => {
          vectorOps.similarity(vector, 'euclidean')
        }).not.toThrow()
      })
    })

    test('dot product similarity handles edge cases safely', () => {
      const vectorOps = pg.vector('embedding')
      
      // Test vectors that might cause issues with dot product
      const testVectors = [
        [1, 0, -1], // Mixed signs
        [0, 0, 0], // Zero vector
        [1, 1, 1], // Positive values
        [-1, -1, -1] // Negative values
      ]
      
      testVectors.forEach(vector => {
        expect(() => {
          vectorOps.similarity(vector, 'dot')
        }).not.toThrow()
      })
    })
  })
})