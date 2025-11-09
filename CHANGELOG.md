# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-01-07

### Breaking Changes

**Type-Safe API with Expression Builder Pattern**

This release introduces full type safety for column parameters by requiring the use of Kysely's expression builder pattern. This ensures compile-time validation of column names and types.

#### Migration Guide

**Before (v0.x):**
```typescript
// String column references (no type safety)
.where(pg.array('tags').hasAllOf(['featured']))
.set({ metadata: pg.json('metadata').set('theme', 'dark') })
```

**After (v1.0):**
```typescript
// Expression builder pattern (full type safety)
.where((eb) => pg.array(eb.ref('tags')).hasAllOf(['featured']))
.set((eb) => ({
  metadata: pg.json(eb.ref('metadata')).set('theme', 'dark')
}))
```

#### What Changed

- **Removed**: String column parameter overloads from `pg.array()`, `pg.json()`, and `pg.vector()`
- **Required**: All column references must now use `eb.ref()` from Kysely's expression builder
- **Added**: Type-level validation that columns are the correct type (arrays for `pg.array()`, JSON for `pg.json()`, vectors for `pg.vector()`)
- **Benefit**: TypeScript now catches invalid column names and wrong column types at compile time

#### Why This Change?

1. **Type Safety**: Prevents runtime errors by catching issues at compile time
2. **Better DX**: Autocomplete for column names based on your database schema
3. **Kysely Alignment**: Follows Kysely's recommended patterns for reusable helpers
4. **Correctness**: Impossible to pass wrong column types (e.g., string column to `pg.array()`)

#### Examples

**Array Operations:**
```typescript
// ✅ Correct - type-safe
.where((eb) => pg.array(eb.ref('tags')).hasAllOf(['featured']))

// ❌ Compile error - 'name' is not an array
.where((eb) => pg.array(eb.ref('name')).hasAllOf(['test']))
```

**JSON Operations:**
```typescript
// ✅ Correct - type-safe
.where((eb) => pg.json(eb.ref('metadata')).path('theme').equals('dark'))
.set((eb) => ({ metadata: pg.json(eb.ref('metadata')).set('key', 'value') }))
```

**Vector Operations:**
```typescript
// ✅ Correct - type-safe
.select((eb) => [
  pg.vector(eb.ref('embedding')).similarity(searchVector).as('score')
])

// ❌ Compile error - 'title' is not a vector
.select((eb) => [
  pg.vector(eb.ref('title')).toArray()
])
```

### Fixed

- Resolves issue #8: Type safety for column parameters

### Notes

This is a **major version** release due to breaking API changes. All users must update their code to use the expression builder pattern. The migration is straightforward and provides immediate benefits through improved type safety.

## [0.1.0] - Previous Release

- Initial release with PostgreSQL helpers for arrays, JSON, and vectors
