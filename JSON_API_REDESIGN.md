# JSON API Redesign

## Overview

This document outlines the redesign of the `pg.json()` API to be more intuitive, consistent, and aligned with PostgreSQL JSON terminology.

## Current Problems

The existing API has several confusing aspects:

1. **Inconsistent patterns**: Mix of chainable and non-chainable methods
2. **Unclear naming**: `get()` vs `getText()` vs `path()` vs `pathText()`
3. **Different usage patterns**: Some methods require manual operators, others don't
4. **Confusing semantics**: When quotes are added, when they're not

```typescript
// Current confusing API
.where(pg.json('metadata').get('theme').equals('dark'))           // chainable
.where(pg.json('settings').getText('language'), '=', 'en')        // manual operator
.where(pg.json('data').path(['user', 'prefs']).contains({...}))   // chainable  
.where(pg.json('data').pathText(['user', 'theme']), '=', 'dark')  // manual operator
```

## New Unified API Design

### Core Principle
**One path method + operations pattern**: `pg.json(column).path(field_or_array).operation()`

### API Structure

```typescript
interface JsonOperations {
  // Unified path method - works with string or array
  path(path: string | string[]): JsonPathOperations
  
  // Top-level operations (no path needed)
  contains(value: any): Expression<boolean>        // @> operator
  hasKey(key: string): Expression<boolean>         // ? operator  
  hasAllKeys(keys: string[]): Expression<boolean>  // ?& operator
  hasAnyKey(keys: string[]): Expression<boolean>   // ?| operator
}

interface JsonPathOperations {
  // Value operations (smart JSON vs text detection)
  equals(value: any): Expression<boolean>
  greaterThan(value: any): Expression<boolean>
  lessThan(value: any): Expression<boolean>
  // ... other comparison operators
  
  // JSON-specific operations
  contains(value: any): Expression<boolean>        // path + @>
  
  // Existence operations  
  exists(): Expression<boolean>                    // path existence check
  
  // Explicit text mode when needed
  asText(): TextPathOperations
}

interface TextPathOperations {
  equals(value: string): Expression<boolean>
  // ... other text-specific operations
}
```

## User Scenarios & Examples

### 1. Simple Field Checks
```typescript
// Find users where theme is dark
.where(pg.json('preferences').path('theme').equals('dark'))
// → preferences #>> '{theme}' = 'dark'

// Find users where age is over 18  
.where(pg.json('profile').path('age').greaterThan(18))
// → profile #>> '{age}' > '18'
```

### 2. Nested Path Checks
```typescript
// Find users where profile.settings.language is 'en'
.where(pg.json('data').path(['profile', 'settings', 'language']).equals('en'))
// → data #>> '{profile,settings,language}' = 'en'

// Find users where user.preferences.notifications is enabled
.where(pg.json('config').path(['user', 'preferences', 'notifications']).equals(true))
// → config #>> '{user,preferences,notifications}' = 'true'
```

### 3. Object Containment
```typescript
// Find users whose preferences contain these settings
.where(pg.json('preferences').path('notifications').contains({email: true, sms: false}))
// → preferences #> '{notifications}' @> '{"email":true,"sms":false}'

// Find users whose profile contains verified: true
.where(pg.json('profile').contains({verified: true}))
// → profile @> '{"verified":true}'
```

### 4. Key Existence
```typescript
// Find users who have a 'premium' flag
.where(pg.json('account').path('premium').exists())
// → account #> '{premium}' IS NOT NULL

// Find users who have notification settings
.where(pg.json('preferences').path(['notifications']).exists())
// → preferences #> '{notifications}' IS NOT NULL

// Find users who have both name and email
.where(pg.json('profile').hasAllKeys(['name', 'email']))
// → profile ?& ARRAY['name','email']

// Find users who have any social media account  
.where(pg.json('social').hasAnyKey(['twitter', 'linkedin', 'github']))
// → social ?| ARRAY['twitter','linkedin','github']
```

### 5. Complex Selections
```typescript
// Get user's theme preference (JsonValue | null)
.select([pg.json('preferences').path('theme').as('user_theme')])

// Get user's full notification settings (JsonValue | null)
.select([pg.json('config').path(['notifications']).as('notification_config')])

// With explicit typing for better type safety
.select([
  pg.json('profile').path<number>('age').as('age'),           // number | null
  pg.json('profile').path<string>('name').as('name'),        // string | null
  pg.json('profile').path<boolean>('active').as('active')    // boolean | null
])

// Get as text when needed
.select([pg.json('preferences').path('theme').asText().as('theme_text')]) // string | null
```

### 6. Explicit Text Mode
```typescript
// When you need text mode explicitly (rare cases)
.where(pg.json('game').path('score').asText().equals('100'))
// → game #>> '{score}' = '100'
```

## Smart JSON vs Text Detection

The API automatically chooses between JSON (#>) and text (#>>) modes based on the operation:

### Auto-Text Mode (uses #>>)
- Scalar comparisons: `equals()`, `greaterThan()`, `lessThan()`, etc.
- Most common use case for simple values

### Auto-JSON Mode (uses #>)  
- Object/array operations: `contains()`
- When operating on complex JSON structures
- When you need to preserve JSON types

### Manual Override
- Use `.asText()` when auto-detection doesn't match your needs

## Type System

### JsonValue Type
All path extractions return `JsonValue | null` by default, where:

```typescript
type JsonValue = 
  | null
  | string
  | number
  | boolean
  | { [key: string]: JsonValue }
  | JsonValue[]
```

### Explicit Typing
Users can specify expected types for better type safety:

```typescript
.select([
  pg.json('profile').path<number>('age').as('age'),        // number | null
  pg.json('profile').path<string>('name').as('name'),      // string | null
  pg.json('profile').path<User>('user').as('user')         // User | null
])
```

### Text Mode
`.asText()` always returns `string | null`:

```typescript
.select([
  pg.json('data').path('anything').asText().as('text')     // string | null
])
```

## Benefits

1. **Single Pattern**: Always `path()` then operation - easy to learn
2. **Intuitive**: Path mirrors your JSON structure exactly  
3. **Smart Defaults**: Usually does what you expect
4. **PostgreSQL Aligned**: Uses official PostgreSQL terminology
5. **Flexible**: String or array paths work identically
6. **Consistent**: All operations chain the same way
7. **Clean**: No legacy methods or confusing alternatives
8. **Type Honest**: Types reflect runtime reality (JSON is untyped)
9. **Selectable**: `path()` works in both WHERE and SELECT clauses

## Implementation Approach

Since this package is in early development, we can make breaking changes to improve the API:

1. **Replace Current API**: Remove existing confusing methods (`get()`, `getText()`, `pathText()`)
2. **Implement New API**: Add the unified `path()` method with smart detection
3. **Update Tests**: Rewrite all JSON tests to use the new API patterns
4. **Update Documentation**: Replace all examples with the new cleaner syntax

**Breaking Changes**:
- Remove: `get()`, `getText()`, `pathText()` methods
- Add: Unified `path()` method with overloads
- Change: All existing JSON code will need to be updated

## Implementation Notes

- The `path()` method should accept both `string` and `string[]` via TypeScript overloads
- Smart detection logic should be well-tested with edge cases
- Error messages should guide users toward correct usage
- Type inference should work properly with TypeScript