import { describe, test, expect } from 'bun:test'
import { pg } from '../../../src/index'

// Define a test database schema with pgvector types
interface Database {
  documents: {
    id: number
    title: string
    embedding: number[]  // pgvector type
    tags: string[]
  }
  images: {
    id: number
    filename: string
    feature_vector: number[]  // pgvector type
    metadata: Record<string, any>
  }
}

describe('Vector Type Safety', () => {
  describe('BUG: String usage should NOT compile (but currently does)', () => {
    test('FAILING TEST: string column references should be rejected', () => {
      // These currently compile but shouldn't after fix
      // @ts-expect-error - After fix: string usage should not be allowed
      const embeddingOp = pg.vector('embedding')

      // @ts-expect-error - After fix: string usage should not be allowed
      const featureOp = pg.vector('feature_vector')

      expect(embeddingOp).toBeDefined()
      expect(featureOp).toBeDefined()
    })

    test('FAILING TEST: should reject non-existent columns (currently no error)', () => {
      // Currently compiles without error - BAD!
      // @ts-expect-error - After fix: should error for invalid column
      const invalidOp = pg.vector<Database, 'documents'>('invalid_column')

      expect(invalidOp).toBeDefined()
    })

    test('FAILING TEST: should reject non-vector columns (currently no error)', () => {
      // Currently compiles without error - BAD!
      // @ts-expect-error - After fix: 'title' is string, not vector
      const titleOp = pg.vector<Database, 'documents'>('title')

      // @ts-expect-error - After fix: 'id' is number, not vector
      const idOp = pg.vector<Database, 'documents'>('id')

      expect(titleOp).toBeDefined()
      expect(idOp).toBeDefined()
    })
  })

  describe('CORRECT: Expression builder pattern should work', () => {
    test('should accept eb.ref() with valid vector columns', () => {
      // Mock expression builder
      const eb = {
        ref: (column: string) => ({
          __ref: column,
        })
      } as any

      // These should work after fix
      const embeddingOp = pg(eb).vector('documents.embedding')
      const featureOp = pg(eb).vector('images.feature_vector')

      expect(embeddingOp).toBeDefined()
      expect(featureOp).toBeDefined()
    })

    test('should provide operations on valid references', () => {
      const eb = { ref: (col: string) => ({ __ref: col }) } as any

      const embeddingOp = pg(eb).vector('documents.embedding')
      const result = embeddingOp.toArray()

      expect(result).toBeDefined()
    })

    test('should provide similarity operations', () => {
      const eb = { ref: (col: string) => ({ __ref: col }) } as any
      const queryVector = [0.1, 0.2, 0.3]

      const embeddingOp = pg(eb).vector('documents.embedding')
      const result = embeddingOp.similarity(queryVector)

      expect(result).toBeDefined()
    })
  })

  describe('BUG: Wrong column types should be rejected', () => {
    test('FAILING TEST: should reject string columns in pg.vector', () => {
      const eb = { ref: (col: string) => ({ __ref: col }) } as any

      // Currently compiles but shouldn't - 'title' is string, not vector
      // @ts-expect-error - After fix: should error because 'title' is not a vector
      const titleOp = pg(eb).vector('documents.title')

      // @ts-expect-error - After fix: should error because 'filename' is not a vector
      const filenameOp = pg(eb).vector('images.filename')

      expect(titleOp).toBeDefined()
      expect(filenameOp).toBeDefined()
    })

    test('FAILING TEST: should reject number columns in pg.vector', () => {
      const eb = { ref: (col: string) => ({ __ref: col }) } as any

      // @ts-expect-error - After fix: should error because 'id' is number, not vector
      const idOp = pg(eb).vector('documents.id')

      expect(idOp).toBeDefined()
    })

    test('FAILING TEST: should reject json columns in pg.vector', () => {
      const eb = { ref: (col: string) => ({ __ref: col }) } as any

      // @ts-expect-error - After fix: should error because 'metadata' is json, not vector
      const metadataOp = pg(eb).vector('images.metadata')

      expect(metadataOp).toBeDefined()
    })

    test('FAILING TEST: should reject string array columns in pg.vector', () => {
      const eb = { ref: (col: string) => ({ __ref: col }) } as any

      // @ts-expect-error - After fix: should error because 'tags' is string[], not number[]
      const tagsOp = pg(eb).vector('documents.tags')

      expect(tagsOp).toBeDefined()
    })
  })

  describe('Vector type inference', () => {
    test('should work with number[] types', () => {
      const eb = { ref: (col: string) => ({ __ref: col }) } as any

      const embeddingOp = pg(eb).vector('documents.embedding')
      const result = embeddingOp.toArray()

      expect(result).toBeDefined()
    })

    test('should accept query vectors as number arrays', () => {
      const eb = { ref: (col: string) => ({ __ref: col }) } as any
      const queryVector = [0.1, 0.2, 0.3, 0.4, 0.5]

      const embeddingOp = pg(eb).vector('documents.embedding')
      const result = embeddingOp.similarity(queryVector, 'cosine')

      expect(result).toBeDefined()
    })
  })
})
