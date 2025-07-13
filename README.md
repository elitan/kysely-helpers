# Kysely Helpers

**Database helpers and utilities for Kysely query builder**

Database-specific operations with beautiful TypeScript syntax. Currently focused on PostgreSQL with comprehensive support for arrays, JSONB, vectors (pgvector), and full-text search with complete type safety.

## ✨ Features

- 🎯 **PostgreSQL-native** - Designed specifically for PostgreSQL's advanced features
- 🔒 **Type-safe** - Full TypeScript support with perfect autocompletion
- ⚡ **Zero overhead** - Generates optimal PostgreSQL SQL
- 🤖 **AI-ready** - First-class pgvector support for embeddings and similarity search
- 📚 **Comprehensive** - Arrays, JSONB, vectors, and more
- 🔥 **Beautiful API** - Intuitive syntax that makes complex queries simple
- 🧪 **Battle-tested** - 88 comprehensive tests with real PostgreSQL integration

## 🚀 Quick Start

```bash
npm install kysely-helpers kysely
# or
bun add kysely-helpers kysely
```

```typescript
import { Kysely, PostgresDialect } from "kysely";
import { pg } from "kysely-helpers";

const db = new Kysely<Database>({
  dialect: new PostgresDialect({
    // your config
  }),
});

// Beautiful PostgreSQL queries
const results = await db
  .selectFrom("documents")
  .select([
    "id",
    "title",
    pg.array("tags").length().as("tag_count"),
    pg.json("metadata").getText("author").as("author"),
  ])
  .where(pg.array("tags").includes("typescript")) // tags @> ARRAY['typescript']
  .where(pg.json("metadata").get("published").equals(true)) // metadata->'published' = true
  .where(pg.vector("embedding").similarTo(searchVector)) // embedding <-> $1 < 0.5
  .orderBy("tag_count", "desc")
  .execute();
```

## 📚 API Reference

### Array Operations

```typescript
import { pg } from 'kysely-helpers'

// Array containment and overlap
.where(pg.array('tags').includes('featured'))              // tags @> ARRAY['featured']
.where(pg.array('tags').contains(['ai', 'ml']))            // tags @> ARRAY['ai', 'ml']
.where(pg.array('categories').overlaps(['tech', 'ai']))    // categories && ARRAY['tech', 'ai']
.where(pg.array('sizes').containedBy(['S', 'M', 'L']))     // sizes <@ ARRAY['S', 'M', 'L']

// Array functions
.where(pg.array('items').length(), '>', 5)                 // array_length(items, 1) > 5
.where('status', '=', pg.array('valid_statuses').any())    // status = ANY(valid_statuses)
```

### JSON/JSONB Operations

```typescript
import { pg } from 'kysely-helpers'

// JSON field access
.where(pg.json('metadata').get('theme').equals('dark'))           // metadata->'theme' = '"dark"'
.where(pg.json('settings').getText('language'), '=', 'en')       // settings->>'language' = 'en'

// JSON path operations
.where(pg.json('data').path(['user', 'preferences']).contains({notifications: true}))

// JSON containment and key existence
.where(pg.json('profile').contains({verified: true}))            // profile @> '{"verified":true}'
.where(pg.json('permissions').hasKey('admin'))                   // permissions ? 'admin'
.where(pg.json('metadata').hasAllKeys(['title', 'author']))      // metadata ?& array['title','author']
```

### Vector Operations (pgvector)

```typescript
import { pg } from 'kysely-helpers'

// Similarity search
.where(pg.vector('embedding').similarTo(searchVector, 0.8))      // embedding <-> $1 < 0.2
.orderBy(pg.vector('embedding').distance(searchVector))          // ORDER BY embedding <-> $1

// Different distance functions
.where(pg.vector('embedding').l2Distance(searchVector), '<', 0.5)     // L2 distance
.where(pg.vector('embedding').cosineDistance(searchVector), '<', 0.3) // Cosine distance
.where(pg.vector('embedding').innerProduct(searchVector), '>', 0.7)   // Inner product

// Vector utilities
.select([pg.vector('embedding').dimensions().as('dims')])             // array_length(embedding, 1)
.select([pg.vector('embedding').norm().as('magnitude')])              // vector_norm(embedding)
```

## 🎯 Real-World Examples

### E-commerce Product Search

```typescript
const products = await db
  .selectFrom("products")
  .select([
    "id",
    "name",
    "description",
    "price",
    pg.array("tags").length().as("tag_count"),
    pg.json("metadata").getText("difficulty").as("difficulty"),
  ])
  .where(pg.array("categories").includes("electronics"))
  .where(pg.json("specs").path(["display", "size"]).equals(15))
  .where(pg.json("availability").hasKey("in_stock"))
  .where(pg.array("tags").overlaps(["featured", "bestseller"]))
  .orderBy("tag_count", "desc")
  .execute();
```

### AI Semantic Search

```typescript
const searchEmbedding = await generateEmbedding("machine learning tutorials");

const results = await db
  .selectFrom("documents")
  .select([
    "id",
    "title",
    "content",
    pg.json("metadata").getText("author").as("author"),
    pg.vector("embedding").distance(searchEmbedding).as("similarity"),
    pg.array("tags").length().as("tag_count"),
  ])
  .where(pg.array("tags").overlaps(["ai", "machine-learning"]))
  .where(pg.json("metadata").get("published").equals(true))
  .where(pg.vector("embedding").similarTo(searchEmbedding, 0.8))
  .orderBy("similarity")
  .limit(20)
  .execute();
```

### User Permissions & Preferences

```typescript
const userData = await db
  .selectFrom("users")
  .select([
    "id",
    "email",
    pg.json("preferences").getText("theme").as("theme"),
    pg.json("preferences")
      .path(["notifications", "email"])
      .as("email_notifications"),
  ])
  .where(pg.array("roles").includes("admin"))
  .where(pg.json("preferences").hasKey("theme"))
  .where(pg.json("profile").contains({ verified: true, active: true }))
  .execute();
```

## ✅ Test Results

**Complete test coverage with real PostgreSQL validation:**

- **Unit Tests**: 66/66 passing ✅
- **Integration Tests**: 22/22 passing ✅
- **Total**: 88/88 tests passing ✅

All operations tested against real PostgreSQL database including:

- PostgreSQL array operators (`@>`, `&&`, `<@`, `ANY`, `array_length`)
- JSONB operations (`->`, `->>`, `#>`, `#>>`, `@>`, `?`, `?&`)
- pgvector distance functions (with graceful fallback)
- SQL injection prevention
- Performance with large datasets
- Edge cases and error handling

## 🔧 Requirements

- **Kysely** ^0.27.0 || ^0.28.0
- **PostgreSQL** 12+ (for full feature support)
- **pgvector** extension (optional, for vector operations)
- **TypeScript** 4.7+ (for best type inference)

## 🧪 Development & Testing

```bash
# Run unit tests
bun run test

# Start PostgreSQL for integration tests
bun run db:up

# Run integration tests
bun run test:integration

# Run all tests
bun run test:all

# Clean up database
bun run db:down
```

## 🤝 Contributing

We love contributions! This package aims to provide the best database utilities for Kysely across different database systems.

## 📄 License

MIT

---

**Made with ❤️ for the database and TypeScript community**
