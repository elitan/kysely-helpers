# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Kysely Helpers is a TypeScript library providing PostgreSQL-specific utilities for the Kysely query builder. It specializes in type-safe database operations for arrays, JSONB, and vectors (pgvector), targeting AI-ready applications with semantic search capabilities.

## Build System & Scripts

This project uses **Bun** as the primary runtime and build tool:

### Essential Commands

```bash
# Development
bun run dev              # Watch mode development
bun run build           # Complete build (CJS, ESM, types)
bun run typecheck       # TypeScript type checking
bun run lint            # ESLint code linting

# Testing
bun run test            # Unit tests only (tests/unit/)
bun run test:watch      # Unit tests in watch mode
bun run test:integration # Integration tests with real PostgreSQL
bun run test:all        # All tests (unit + integration)

# Database (for integration tests)
bun run db:up           # Start PostgreSQL via Docker
bun run db:down         # Stop PostgreSQL
bun run db:logs         # View PostgreSQL logs
```

### Build Process
- **Multi-format**: Generates CJS (`dist/index.js`), ESM (`dist/index.mjs`), and TypeScript declarations (`dist/index.d.ts`)
- **Clean builds**: Always cleans `dist/` before building
- **Type safety**: Uses TypeScript with strict mode enabled

## Architecture

### Core Structure
```
src/
├── index.ts           # Main entry point, exports pg namespace
├── pg/               # PostgreSQL-specific utilities
│   ├── index.ts      # Exports all pg modules
│   ├── array.ts      # Array operations (@>, &&, <@, etc.)
│   ├── json.ts       # JSONB operations (->, ->>, @>, etc.)
│   └── vector.ts     # pgvector operations (<->, <=>, <#>, etc.)
└── types/            # TypeScript type definitions
    └── index.ts
```

### Test Organization
```
tests/
├── integration/      # Real PostgreSQL database tests
├── pg/              # Per-module test suites
│   ├── array/       # Array operation tests
│   ├── json/        # JSON operation tests
│   └── vector/      # Vector operation tests
```

Each test module contains:
- `api.test.ts` - API surface and TypeScript compatibility
- `database.test.ts` - Real database integration tests
- `security.test.ts` - SQL injection prevention tests
- `sql.test.ts` - SQL generation validation

## Development Patterns

### PostgreSQL-Native Approach
- **Database-first**: Generates optimal PostgreSQL-native SQL rather than client-side processing
- **Type safety**: Full TypeScript integration with Kysely's type system
- **Operator mapping**: Direct mapping to PostgreSQL operators (`@>`, `&&`, `<->`, etc.)

### Vector Operations (pgvector)
- `pg.embedding()` - Converts JavaScript arrays to PostgreSQL vector format for insertion
- `pg.vector().toArray()` - Converts PostgreSQL vectors back to JavaScript arrays
- Distance functions: `l2Distance()`, `cosineDistance()`, `innerProduct()`
- Similarity helpers: `similarTo()`, `distance()`, `dimensions()`, `norm()`

### Testing Strategy
- **Unit tests**: Fast feedback without database dependencies
- **Integration tests**: Validates against real PostgreSQL with Docker
- **Security tests**: Prevents SQL injection across all operations
- **SQL validation**: Ensures generated SQL matches expected PostgreSQL syntax

## Dependencies

### Peer Dependencies
- `kysely` ^0.27.0 || ^0.28.0 (query builder)

### Runtime Dependencies
- `pg` ^8.16.3 (PostgreSQL driver)
- `@types/pg` ^8.15.4 (TypeScript definitions)

### Development
- Uses Bun for runtime, testing, and builds
- TypeScript 5.0+ for development
- ESLint for code quality

## Integration Requirements

When working with integration tests:
1. Start PostgreSQL: `bun run db:up`
2. Tests automatically handle database schema setup via `tests/integration/init.sql`
3. pgvector extension required for vector operation tests
4. Clean up: `bun run db:down`

## Key Design Principles

1. **Zero runtime overhead**: All helpers compile to optimal PostgreSQL SQL
2. **Type safety first**: Leverages Kysely's expression system for perfect TypeScript integration
3. **PostgreSQL expertise**: Deep integration with PostgreSQL's advanced features
4. **AI-ready**: First-class support for vector embeddings and semantic search
5. **Security focused**: Built-in SQL injection prevention for all operations