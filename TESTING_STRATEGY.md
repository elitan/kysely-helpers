# Testing Strategy for kysely-helpers

## Overview

This document outlines the comprehensive testing strategy for kysely-helpers, an AI-built PostgreSQL query builder library. Given the AI-generated nature of this codebase, testing is absolutely critical to ensure correctness and prevent regressions.

## Test Structure

Our tests follow a clear, scalable structure that mirrors the source code organization:

```
tests/
├── pg/                          # PostgreSQL-specific helpers
│   ├── array/                   # Array operations tests
│   │   ├── api.test.ts         # Function behavior & type safety
│   │   ├── sql.test.ts         # SQL generation & compilation
│   │   ├── database.test.ts    # Real database integration
│   │   └── security.test.ts    # SQL injection & edge cases
│   ├── json/                    # JSON/JSONB operations tests
│   │   ├── api.test.ts
│   │   ├── sql.test.ts
│   │   ├── database.test.ts
│   │   └── security.test.ts
│   ├── vector/                  # Vector operations tests (pgvector)
│   │   ├── api.test.ts
│   │   ├── sql.test.ts
│   │   ├── database.test.ts
│   │   └── security.test.ts
│   ├── text/                    # Full-text search operations tests
│   │   ├── api.test.ts
│   │   ├── sql.test.ts
│   │   ├── database.test.ts
│   │   └── security.test.ts
│   └── shared/                  # Cross-module tests
│       ├── performance.test.ts  # Performance & scalability
│       └── integration.test.ts  # Multi-module scenarios
├── types/                       # TypeScript type system tests
│   └── typescript.test.ts
└── utils/                       # Test utilities
    ├── test-db.ts              # Database setup helpers
    ├── fixtures.ts             # Test data & scenarios
    └── matchers.ts             # Custom test matchers
```

## Test Types & Purposes

### 1. API Tests (`api.test.ts`)
**Purpose**: Verify function behavior and type safety without SQL compilation

**What they test**:
- Function creation and method availability
- Parameter acceptance and type safety
- Edge cases (empty arrays, special characters, large datasets)
- TypeScript generic type handling
- Method chaining compatibility
- Column reference variations

**Example scenarios**:
```typescript
test('pg.array() creates function with expected methods')
test('typed arrays maintain type information')
test('handles empty arrays without throwing')
test('special characters in values work correctly')
```

### 2. SQL Tests (`sql.test.ts`)
**Purpose**: Verify correct PostgreSQL SQL generation and compilation

**What they test**:
- Correct PostgreSQL operator generation (`@>`, `&&`, `<@`, etc.)
- Parameter binding and SQL injection prevention
- Column reference quoting and qualification
- Complex query compilation
- Empty array handling with typed literals
- Multi-operation queries

**Example scenarios**:
```typescript
test('includes() generates @> ARRAY[...] syntax')
test('overlaps() generates && ARRAY[...] syntax')
test('parameters are properly bound and escaped')
test('qualified column names are quoted correctly')
```

### 3. Database Tests (`database.test.ts`)
**Purpose**: Verify real database behavior with actual PostgreSQL

**What they test**:
- Real query execution against PostgreSQL database
- Correct result sets with realistic test data
- Performance with large datasets
- Database-specific behavior and edge cases
- Extension availability (e.g., pgvector for vector operations)
- Cross-operation functionality

**Example scenarios**:
```typescript
test('finds products with specific tag using includes()')
test('complex array queries return correct results')
test('performance with arrays of 1000+ elements')
test('graceful handling when pgvector extension unavailable')
```

### 4. Security Tests (`security.test.ts`)
**Purpose**: Verify SQL injection prevention and safety measures

**What they test**:
- SQL injection attempt prevention
- Malicious input sanitization
- Parameter escaping correctness
- Edge case input handling
- Error conditions and graceful failures

**Example scenarios**:
```typescript
test('SQL injection attempts are parameterized safely')
test('malicious array values do not break query compilation')
test('special SQL characters are properly escaped')
test('invalid inputs throw appropriate errors')
```

## Testing Principles

### 1. **Complete Coverage for AI-Built Code**
Every function gets all 4 types of tests to ensure:
- The API works as designed (api tests)
- SQL generation is correct (sql tests)  
- Real database behavior matches expectations (database tests)
- Security vulnerabilities are prevented (security tests)

### 2. **Regression Protection**
- SQL compilation tests catch unintended changes in generated SQL
- Database tests verify semantic correctness beyond syntax
- Security tests prevent introduction of vulnerabilities

### 3. **Realistic Test Scenarios**
- Use domain-specific test data (e-commerce, content management)
- Test with realistic data volumes and complexity
- Include edge cases found in real-world usage

### 4. **Performance Awareness**
- Test with large datasets to catch performance regressions
- Verify query efficiency with complex operations
- Monitor memory usage with large arrays/objects

## Test Data Strategy

### Realistic Test Scenarios
Our tests use realistic e-commerce and content management scenarios:

```typescript
// E-commerce products with realistic tags and categories
{
  name: 'TypeScript Guide',
  tags: ['typescript', 'programming', 'tutorial'],
  categories: ['education', 'tech'],
  scores: [95, 87, 92]
}

// Content with realistic metadata
{
  title: 'Advanced PostgreSQL',
  metadata: { author: 'Jane Doe', difficulty: 'advanced' },
  embedding: [0.1, 0.2, 0.3, ...] // Realistic vector data
}
```

### Edge Case Coverage
- Empty arrays and objects
- Special characters and Unicode
- Large datasets (100+ elements)
- Malformed inputs
- SQL injection attempts

## Database Setup

### Integration Test Database
- **Docker-based**: `pgvector/pgvector:pg17` for vector operations
- **Isolated**: Runs on port 15432 to avoid conflicts
- **Automated setup**: Schema and test data initialization
- **Extension handling**: Graceful degradation when extensions unavailable

### Test Data Management
- **Fresh data per test**: Each test gets clean, predictable data
- **Realistic volumes**: Test with meaningful data sizes
- **Cross-module scenarios**: Data that exercises multiple operations

## Running Tests

### By Test Type
```bash
# All API tests across modules
bun test tests/pg/*/api.test.ts

# All SQL compilation tests
bun test tests/pg/*/sql.test.ts

# All database integration tests
bun test tests/pg/*/database.test.ts

# All security tests
bun test tests/pg/*/security.test.ts
```

### By Module
```bash
# All array tests
bun test tests/pg/array/

# All vector tests  
bun test tests/pg/vector/

# Specific test file
bun test tests/pg/array/sql.test.ts
```

### Full Test Suite
```bash
# Run everything
bun test

# Run with coverage
bun test --coverage
```

## Quality Metrics

### Coverage Targets
- **Functions**: 95%+ across all modules
- **Lines**: 90%+ across all modules
- **Critical paths**: 100% (SQL generation, security)

### Test Quality Indicators
- All 4 test types implemented for each module
- Realistic test scenarios with domain-specific data
- Performance tests with meaningful data volumes
- Security tests covering common attack vectors

## AI-Specific Considerations

### Why This Strategy Matters for AI-Built Code

1. **Semantic Verification**: AI can generate syntactically correct but semantically wrong code
2. **Regression Prevention**: AI updates might introduce subtle bugs
3. **Safety First**: AI code needs extra security validation
4. **Confidence Building**: Comprehensive tests build trust in AI-generated functionality

### Best Practices for AI-Built Testing

1. **Test Behavior, Not Implementation**: Focus on what the code should do
2. **Multiple Verification Layers**: API → SQL → Database → Security
3. **Realistic Scenarios**: Use real-world data and use cases
4. **Property-Based Testing**: Consider adding property-based tests for invariants
5. **Mutation Testing**: Consider using mutation testing to verify test quality

## Contributing to Tests

### Adding New Modules
1. Create the module directory: `tests/pg/{module}/`
2. Implement all 4 test types: `api.test.ts`, `sql.test.ts`, `database.test.ts`, `security.test.ts`
3. Follow existing patterns and naming conventions
4. Include realistic test scenarios and edge cases

### Updating Existing Tests
1. Maintain the 4-test-type structure
2. Add new test cases for new functionality
3. Update database tests with new realistic scenarios
4. Ensure security tests cover new attack vectors

### Test Quality Checklist
- [ ] All 4 test types implemented
- [ ] Realistic test data and scenarios
- [ ] Edge cases covered (empty, large, special characters)
- [ ] Security scenarios included
- [ ] Performance considerations addressed
- [ ] TypeScript type safety verified

## Future Enhancements

### Planned Improvements
- **Property-based testing** with libraries like fast-check
- **Mutation testing** to verify test quality
- **Snapshot testing** for complex SQL compilation
- **Cross-database testing** (MySQL, SQLite support)
- **Performance benchmarking** integration
- **Fuzzing** for robust input validation

### Monitoring & CI/CD
- **Automated coverage reporting**
- **Performance regression detection**
- **Security vulnerability scanning**
- **Multi-version PostgreSQL testing**

This testing strategy ensures that our AI-built query builder is reliable, secure, and performs well in real-world scenarios.