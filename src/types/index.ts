/**
 * @pgvibe/kysely type definitions
 * 
 * Type utilities and interfaces for PostgreSQL operations
 */

import type { Expression } from 'kysely'

/**
 * PostgreSQL array type
 */
export type PgArray<T> = T[]

/**
 * PostgreSQL JSONB type (for full columns)
 */
export type PgJsonb = Record<string, any> | any[]

/**
 * Valid JSON value types (for individual path extractions)
 * Represents any value that can exist in JSON
 */
export type JsonValue = 
  | null
  | string
  | number
  | boolean
  | { [key: string]: JsonValue }
  | JsonValue[]

/**
 * PostgreSQL vector type (pgvector extension)
 */
export type PgVector = number[]

/**
 * PostgreSQL tsvector type
 */
export type PgTsVector = string

/**
 * Distance function types for vectors
 */
export type VectorDistanceFunction = 'l2' | 'cosine' | 'inner'

/**
 * Text search configuration languages
 */
export type TextSearchConfig = 
  | 'english'
  | 'spanish' 
  | 'french'
  | 'german'
  | 'italian'
  | 'portuguese'
  | 'russian'
  | 'simple'

/**
 * Utility type to extract array element type
 */
export type ArrayElement<T> = T extends (infer U)[] ? U : never

/**
 * Utility type for JSON path operations
 */
export type JsonPath = string | string[]

/**
 * PostgreSQL operator types
 */
export namespace PgOperators {
  // Array operators
  export type ArrayContains = '@>'
  export type ArrayOverlaps = '&&'
  export type ArrayContainedBy = '<@'
  
  // JSON operators  
  export type JsonGet = '->'
  export type JsonGetText = '->>'
  export type JsonPath = '#>'
  export type JsonPathText = '#>>'
  export type JsonContains = '@>'
  export type JsonContainedBy = '<@'
  export type JsonKeyExists = '?'
  export type JsonAllKeysExist = '?&'
  export type JsonAnyKeyExists = '?|'
  
  // Vector operators
  export type VectorL2Distance = '<->'
  export type VectorInnerProduct = '<#>'
  export type VectorCosineDistance = '<=>'
  
  // Text search operators
  export type TextSearch = '@@'
}

/**
 * Type-safe column reference helpers
 */
export interface ColumnHelpers {
  /** Array column operations */
  array<T>(column: string): T extends Array<infer U> ? U : never
  /** JSON column operations */
  json(column: string): PgJsonb
  /** Vector column operations */  
  vector(column: string): PgVector
  /** Text search column operations */
  text(column: string): string
}

/**
 * Re-export commonly used Kysely types
 */
export type { Expression } from 'kysely'