# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-01-10

### Added

**Hybrid API: Type-Safe `pg(eb)` Pattern + Simple API**

This release adds a new type-safe API while keeping the simple API for backwards compatibility.

#### ✅ New: Type-Safe API with `pg(eb)`

```typescript
// Column names validated at compile time
.where((eb) => pg(eb).array('tags').hasAllOf(['featured']))
.set((eb) => ({ metadata: pg(eb).json('metadata').set('theme', 'dark') }))
```

**Benefits:**
- ✅ Column name validation
- ✅ Column type checking
- ✅ IDE autocomplete
- ✅ Catches typos at compile time

#### ⚡ Simple API (Still Works - No Breaking Changes)

```typescript
// Quick & easy, no type safety
.where(pg.array('tags').hasAllOf(['featured']))
.set({ metadata: pg.json('metadata').set('theme', 'dark') })
```

### Examples

**Array operations:**
```typescript
// Type-safe
.where((eb) => pg(eb).array('tags').hasAllOf(['typescript']))

// Simple
.where(pg.array('tags').hasAllOf(['typescript']))
```

**JSON operations:**
```typescript
// Type-safe
.where((eb) => pg(eb).json('metadata').path('theme').equals('dark'))

// Simple
.where(pg.json('metadata').path('theme').equals('dark'))
```

**Vector operations:**
```typescript
// Type-safe
.select((eb) => [pg(eb).vector('embedding').similarity(vec).as('score')])

// Simple
.select([pg.vector('embedding').similarity(vec).as('score')])
```

### Migration

**No migration required!** The simple API continues to work. Adopt the type-safe API gradually:

1. Start using `pg(eb)` in new code
2. Optionally migrate existing code over time
3. Enjoy improved type safety and IDE support

### Technical Details

- Added `pg()` function that accepts `ExpressionBuilder` and returns type-safe helpers
- Refactored internals: `createArrayOperations()`, `createJsonOperations()`, `createVectorOperations()`
- Simple API (`pg.array()`, `pg.json()`, `pg.vector()`) wraps the new internals
- Function + namespace merge allows both patterns to coexist
- Zero performance overhead - compiles to identical SQL

## [0.1.0] - Previous Release

- Initial release with PostgreSQL helpers for arrays, JSON, and vectors
