# API Suggestions for Kysely Helpers

This document outlines potential improvements and additions to the kysely-helpers API based on analysis of the current implementation and common use cases.

## Current API Overview

### Array Operations
**Current API:**
```typescript
array('column').contains(value | value[])      // @> operator
array('column').includes(value)               // @> operator (single element)
array('column').overlaps(values[])            // && operator
array('column').containedBy(values[])         // <@ operator
array('column').length()                      // array_length(column, 1)
array('column').any()                         // ANY(column)
```

### JSON Operations
**Current API:**
```typescript
json('column').get(key)                       // -> operator, returns JsonPathOperations
json('column').getText(key)                   // ->> operator
json('column').path(path)                     // #> operator, returns JsonPathOperations
json('column').pathText(path)                 // #>> operator
json('column').contains(value)                // @> operator
json('column').containedBy(value)             // <@ operator
json('column').hasKey(key)                    // ? operator
json('column').hasAllKeys(keys[])             // ?& operator
json('column').hasAnyKey(keys[])              // ?| operator

// JsonPathOperations (from get() and path())
.contains(value)                              // @> operator
.equals(value)                                // = operator
.asText()                                     // ->> operator
```

### Vector Operations
**Current API:**
```typescript
vector('column').distance(vec[])              // <-> operator (L2)
vector('column').l2Distance(vec[])            // <-> operator (alias)
vector('column').innerProduct(vec[])          // <#> operator
vector('column').cosineDistance(vec[])        // <=> operator
vector('column').similarTo(vec[], threshold?, method?) // Configurable similarity
vector('column').dimensions()                 // array_length(column, 1)
vector('column').norm()                       // vector_norm(column)
vector('column').sameDimensions(other)        // Compare dimensions
```

## Array API Suggestions

### 1. Add `isEmpty()` method ⭐ **[DECIDED - IMPLEMENT]**
**Current:** No built-in method - must use `array('tags').length(), '=', 0`
**Reason:** Common need to check for empty arrays

**Options:**
- `array('tags').isEmpty()` → `array_length(tags, 1) IS NULL OR array_length(tags, 1) = 0` **[CHOSEN]**
- `array('tags').isNull()` → `array_length(tags, 1) IS NULL` (stricter) **[REJECTED - use native Kysely]**
- `array('tags').hasElements()` → `array_length(tags, 1) > 0` (inverse)

### 2. Add array element access & mutations **[DECIDED - IMPLEMENT]**
**Current:** No built-in method - must use raw SQL
**Reason:** Sometimes need specific array elements and queue/stack operations

**Access Options:**
- `array('tags').at(index)` → `tags[1]` (1-indexed PostgreSQL style) **[REJECTED - too complex]**
- `array('tags').first()` → `tags[1]` **[CHOSEN]**
- `array('tags').last()` → `tags[array_length(tags, 1)]` **[CHOSEN]**
- `array('tags').slice(start, end)` → `tags[1:3]` **[REJECTED - edge case]**

**Mutation Options:**
- `array('tasks').append(value)` → `array_append(tasks, value)` **[CHOSEN]**
- `array('tasks').prepend(value)` → `array_prepend(value, tasks)` **[CHOSEN]**
- `array('tasks').removeFirst()` → `tasks[2:]` **[CHOSEN]**
- `array('tasks').removeLast()` → `tasks[1:array_length(tasks,1)-1]` **[CHOSEN]**
- `array('tasks').appendAll([...])` → `array_cat(tasks, ARRAY[...])` **[REJECTED - maybe later]**

### 3. Improve `contains()` empty array handling **[DECIDED - REJECT]**
**Current:** `array('tags').contains([])` generates `ARRAY[]::text[]`
**Reason:** Current implementation uses `ARRAY[]::text[]` which assumes text type

**Options:**
- Pass generic type: `array<number>('scores').contains([])` **[REJECTED - use isEmpty() instead]**
- Detect from usage: Auto-infer from non-empty calls **[REJECTED - use isEmpty() instead]**
- Explicit typing: `array('scores').typed<number>().contains([])` **[REJECTED - use isEmpty() instead]**

**Decision:** Use `isEmpty()` for checking empty arrays. `contains([])` is semantically wrong and rarely needed.

### 4. Add set operations **[DECIDED - REJECT]**
**Current:** No built-in methods - must use raw SQL or multiple queries
**Reason:** Arrays often used as sets

**Options:**
- `array('tags1').union(array('tags2'))` → Custom function **[REJECTED - complex implementation]**
- `array('tags1').intersect(array('tags2'))` → Custom function **[REJECTED - use overlaps()]**
- `array('tags').distinct()` → `array(SELECT DISTINCT unnest(tags))` **[REJECTED - edge case]**

**Decision:** Skip for now. Arrays work well for simple lists, but normalized tables are better for true set operations.

## JSON API Suggestions

### 5. Add path existence checking ⭐ **[DECIDED - IMPLEMENT]**
**Current:** Must use workaround like `json('data').path('$.user').equals(null)` (unreliable)
**Reason:** Need to verify paths exist before accessing

**Options:**
- `json('data').pathExists('$.user.email')` → `jsonb_path_exists(data, '$.user.email')` **[CHOSEN]**
- `json('data').hasPath(['user', 'email'])` → Alternative naming
- Built into existing: `json('data').path('$.user').isNull()` (current workaround)

### 6. Support JSONPath expressions **[DECIDED - IMPLEMENT]**
**Current:** Limited to simple paths with `path()` method
**Reason:** More powerful than simple key access

**Options:**
- `json('data').jsonPath('$.products[*].price')` → Full JSONPath support **[REJECTED - confusing naming]**
- `json('data').query('$.products[?(@.price > 100)]')` → With filters **[CHOSEN]**
- `json('data').queryText('$.user.name')` → Direct text return **[CHOSEN]**
- Keep simple: Current approach covers 90% of cases **[REJECTED - JSONPath is useful]**

**Implementation:** Use `jsonb_path_query_first()` and `jsonb_path_query()` functions, following existing naming pattern.

### 7. Add JSON aggregation functions **[DECIDED - IMPLEMENT]**
**Current:** No built-in methods - must use raw SQL
**Reason:** Common operations on JSON arrays/objects

**Options:**
- `json('data').arrayLength('$.items')` → `jsonb_array_length(data#>'$.items')` **[CHOSEN]**
- `json('data').objectKeys()` → `jsonb_object_keys(data)` **[CHOSEN]**
- `json('data').typeof('$.value')` → `jsonb_typeof(data#>'$.value')` **[CHOSEN]**

### 8. Improve nested object syntax **[DECIDED - REJECT]**
**Current:** `path(string | string[])` accepts both formats inconsistently
**Reason:** Current path syntax inconsistent between string/array

**Options:**
- Standardize on arrays: `json('data').path(['user', 'preferences', 'theme'])` **[REJECTED - breaking change]**
- Dot notation: `json('data').path('user.preferences.theme')` **[REJECTED - breaking change]**
- Keep both: Current approach (flexible but inconsistent) **[CHOSEN]**

**Decision:** Keep current approach. JSONPath via `query()` covers advanced cases.

## Vector API Suggestions

### 9. Add more distance metrics **[DECIDED - REJECT]**
**Current:** Only L2 (`<->`), cosine (`<=>`), and inner product (`<#>`)
**Reason:** pgvector supports additional metrics

**Options:**
- `vector('emb').hammingDistance(vec)` → For binary vectors **[REJECTED - edge case]**
- `vector('emb').manhattanDistance(vec)` → L1 distance **[REJECTED - edge case]**
- `vector('emb').jaccardDistance(vec)` → For sparse vectors **[REJECTED - edge case]**

**Decision:** Current L2, cosine, and inner product cover 95% of use cases. Use raw SQL for specialized metrics.

### 10. Improve `similarTo()` API ⭐ **[DECIDED - REJECT]**
**Current:** `similarTo(vec, threshold=0.5, method='l2')` with confusing threshold logic
**Reason:** Current threshold logic is confusing for different metrics

**Options:**
- Separate methods: `vector('emb').l2Similar(vec, 0.3)`, `vector('emb').cosineSimilar(vec, 0.8)` **[REJECTED - not essential]**
- Distance-based: `vector('emb').withinDistance(vec, 0.5, 'l2')` **[REJECTED - not essential]**
- Percentile-based: `vector('emb').topPercentile(vec, 0.1)` **[REJECTED - not essential]**

**Decision:** Focus on core distance functions for v1. Basic `distance()` and `cosineDistance()` are more important. 

### 11. Add vector normalization **[DECIDED - REJECT]**
**Current:** No built-in method - must use raw SQL `emb / vector_norm(emb)`
**Reason:** Often need normalized vectors for comparison

**Options:**
- `vector('emb').normalize()` → `emb / vector_norm(emb)` **[REJECTED - not essential for v1]**
- `vector('emb').unit()` → Alternative naming **[REJECTED - not essential for v1]**
- Database-side: Have database store normalized vectors **[RECOMMENDED - better approach]**

**Decision:** Store normalized vectors in database instead. Keep v1 focused on essential operations.

### 12. Add vector aggregations **[DECIDED - REJECT]**
**Current:** No built-in methods - must use raw SQL
**Reason:** Useful for analytics and clustering

**Options:**
- `vector('emb').avg()` → Average vector across rows **[REJECTED - advanced use case]**
- `vector('emb').centroid()` → Alternative naming **[REJECTED - advanced use case]**
- `vector('emb').sum()` → Vector addition **[REJECTED - advanced use case]**

**Decision:** Advanced analytics operations. Keep v1 focused on core distance/similarity queries.

## Cross-cutting API Suggestions

### 13. Add raw SQL escape hatch ⭐ **[DECIDED - REJECT]**
**Current:** Must fall back to kysely's `sql` template for custom operations
**Reason:** For advanced cases not covered by helpers

**Options:**
- `pg.raw('custom_array_function(tags, $1)', [param])` **[REJECTED - Kysely's sql template works]**
- `array('tags').raw('custom_op', [param])` **[REJECTED - unnecessary complexity]**
- Per-type: `json('data').raw('jsonb_custom_func($1)', [data])` **[REJECTED - scope creep]**

**Decision:** Kysely's `sql` template already provides perfect escape hatch functionality.

### 14. Improve TypeScript inference ⭐ **[DECIDED - IMPLEMENT]**
**Current:** Generic `<T = string>` on `array()`, no column type inference
**Reason:** Better developer experience

**Options:**
- Column typing: `pg.array<string>('tags')` **[CHOSEN]**
- Return type inference: Auto-detect from database schema **[REJECTED - too complex for v1]**
- Generic constraints: Ensure type safety **[CHOSEN]**

**Decision:** Add generic parameters for better type safety and developer experience.

### 15. Add batch operations **[DECIDED - REJECT]**
**Current:** Must chain multiple `.where()` calls
**Reason:** Performance for multiple operations

**Options:**
- `pg.batch([array('tags').contains('js'), json('meta').hasKey('id')])` **[REJECTED - Kysely has eb.and()]**
- Expression builder: `pg.and(...conditions)` **[REJECTED - Kysely has eb.and()]**
- Keep separate: Current approach (explicit) **[CHOSEN]**

**Decision:** Kysely's expression builder already handles batching. Current approach is clear and explicit.

### 16. Namespace organization **[DECIDED - REJECT]**
**Current:** Flat namespace: `pg.array()`, `pg.json()`, `pg.vector()`
**Reason:** Current `pg.array()` might conflict with future additions

**Options:**
- Nested: `pg.array.contains()`, `pg.json.hasKey()`, `pg.vector.distance()` **[REJECTED - breaking change]**
- Prefixed: `pg.arrayContains()`, `pg.jsonHasKey()`, `pg.vectorDistance()` **[REJECTED - breaking change]**
- Keep current: Simple and clean **[CHOSEN]**

**Decision:** Current flat namespace is clean and intuitive. No evidence of actual naming conflicts.

## Performance & Optimization Suggestions

### 17. Add index hints **[DECIDED - REJECT]**
**Current:** No built-in index optimization hints
**Reason:** Help developers optimize queries

**Options:**
- `array('tags').contains('js').useIndex('tags_gin_idx')` **[REJECTED - PostgreSQL doesn't use index hints]**
- Comments: Auto-generate index suggestions in SQL comments **[REJECTED - complex implementation]**
- Documentation: Better docs on when to use GIN/GiST indexes **[RECOMMENDED - better approach]**

**Decision:** PostgreSQL's query planner chooses indexes automatically. Focus on better documentation instead.

### 18. Query plan helpers **[DECIDED - REJECT]**
**Current:** Must use separate database tools for query analysis
**Reason:** Debug performance issues

**Options:**
- `pg.explain(query)` → Wrapper for EXPLAIN ANALYZE **[REJECTED - out of scope]**
- Performance warnings: Detect potentially slow operations **[REJECTED - complex implementation]**
- Keep external: Use database tools **[CHOSEN]**

**Decision:** Performance analysis is best left to dedicated database tools. Out of scope for a query builder library.

## Priority Recommendations

**High Priority (⭐):**
1. **#5 - JSON path existence checking** - Very common need
2. **#10 - Improve vector `similarTo()` API** - Current confusion around thresholds
3. **#13 - Raw SQL escape hatch** - Necessary for edge cases
4. **#14 - TypeScript inference** - Better DX
5. **#1 - Array `isEmpty()` method** - Common operation

**Medium Priority:**
- #3 - Empty array type handling
- #7 - JSON aggregation functions
- #9 - Additional vector distance metrics
- #11 - Vector normalization

**Low Priority:**
- #2, #4 - Array advanced operations
- #6, #8 - JSON advanced features
- #12, #15-18 - Nice-to-have features

## Implementation Notes

- Maintain the current fluent, type-safe design
- Ensure all new methods follow existing patterns
- Add comprehensive tests for new functionality
- Update documentation with examples
- Consider backwards compatibility for any breaking changes
- Prioritize PostgreSQL native functions over custom implementations