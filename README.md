# Kysely Helpers

**Database helpers and utilities for Kysely**

Currently focused on PostgreSQL with comprehensive support for arrays, JSONB, vectors (pgvector), and full-text search.

## Features

- **Type-safe** - Full TypeScript support with perfect autocompletion
- **PostgreSQL-first** - Rich support for PostgreSQL's advanced features (arrays, JSONB, vectors)
- **AI-ready** - First-class pgvector support for embeddings and similarity search
- **Zero overhead** - Generates optimal database-native SQL
- **Beautiful API** - Intuitive syntax that makes complex queries simple

## Installation

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

// PostgreSQL-specific operations
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

## API Reference

### PostgreSQL Helpers

#### Array Operations

Work with PostgreSQL arrays like you would with JavaScript arrays, but with database-level performance.

```typescript
import { pg } from 'kysely-helpers'

// Does tags array contain 'featured'? → tags @> ARRAY['featured']
.where(pg.array('tags').includes('featured'))

// Does tags array contain both 'ai' AND 'ml'? → tags @> ARRAY['ai', 'ml']
.where(pg.array('tags').contains(['ai', 'ml']))

// Do categories share ANY values with ['tech', 'ai']? → categories && ARRAY['tech', 'ai']
.where(pg.array('categories').overlaps(['tech', 'ai']))

// Are all sizes within the allowed list? → sizes <@ ARRAY['S', 'M', 'L']
.where(pg.array('sizes').containedBy(['S', 'M', 'L']))

// Does array have more than 5 items? → array_length(items, 1) > 5
.where(pg.array('items').length(), '>', 5)

// Is status one of the valid options? → status = ANY(valid_statuses)
.where('status', '=', pg.array('valid_statuses').any())
```

**Use cases:** Product filtering, tag-based search, permission checking, category management.

#### JSON/JSONB Operations

Query and filter JSON data stored in your database without parsing it in your application.

```typescript
import { pg } from 'kysely-helpers'

// Get theme value, keeps JSON type → metadata->'theme' = '"dark"'
.where(pg.json('metadata').get('theme').equals('dark'))

// Get language as plain text → settings->>'language' = 'en'
.where(pg.json('settings').getText('language'), '=', 'en')

// Navigate to nested object → data#>'{user,preferences}' @> '{"notifications":true}'
.where(pg.json('data').path(['user', 'preferences']).contains({notifications: true}))

// Does profile include verified: true? → profile @> '{"verified":true}'
.where(pg.json('profile').contains({verified: true}))

// Does permissions object have 'admin' key? → permissions ? 'admin'
.where(pg.json('permissions').hasKey('admin'))

// Does metadata have both required keys? → metadata ?& array['title','author']
.where(pg.json('metadata').hasAllKeys(['title', 'author']))
```

**Use cases:** User preferences, product configurations, dynamic schemas, API responses, settings storage.

#### Vector Operations (pgvector)

Power AI applications with semantic search and similarity matching directly in your database.

```typescript
import { pg } from "kysely-helpers";

// Insert embeddings from OpenAI, Anthropic, etc.
const embedding = await openai.embeddings.create({
  model: "text-embedding-3-small",
  input: "Hello world",
});

await db
  .insertInto("documents")
  .values({
    title: "Machine Learning Guide",
    content: "A comprehensive guide...",
    embedding: pg.embedding(embedding.data[0].embedding), // Proper vector format
  })
  .execute()

  // Convert vectors back to JavaScript arrays → string_to_array(...)
  .select(["id", "title", pg.vector("embedding").toArray().as("embedding")])

  // Find vectors with 80%+ similarity → embedding <-> $1 < 0.2
  .where(pg.vector("embedding").similarTo(searchVector, 0.8))

  // Order by most similar first → ORDER BY embedding <-> $1
  .orderBy(pg.vector("embedding").distance(searchVector))

  // Euclidean distance → embedding <-> $1 < 0.5
  .where(pg.vector("embedding").l2Distance(searchVector), "<", 0.5)

  // Cosine similarity → embedding <=> $1 < 0.3
  .where(pg.vector("embedding").cosineDistance(searchVector), "<", 0.3)

  // Dot product → embedding <#> $1 > 0.7
  .where(pg.vector("embedding").innerProduct(searchVector), ">", 0.7)

  // Get vector dimensions → vector_dims(embedding)
  .select([pg.vector("embedding").dimensions().as("dims")])

  // Get vector magnitude → vector_norm(embedding)
  .select([pg.vector("embedding").norm().as("magnitude")]);
```

**Use cases:** Semantic search, recommendation engines, document similarity, image recognition, chatbot context matching.

**Key features:**

- `pg.embedding()` - Convert arrays to proper PostgreSQL vector format for insertion
- `pg.vector().toArray()` - Convert PostgreSQL vectors back to JavaScript arrays
- Full compatibility with OpenAI, Anthropic, and other embedding providers

## Examples

### Product Search with Multiple Filters

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

### Semantic Search with Embeddings

```typescript
const searchEmbedding = await openai.embeddings.create({
  model: "text-embedding-3-small",
  input: "machine learning tutorials",
});

const results = await db
  .selectFrom("documents")
  .select([
    "id",
    "title",
    "content",
    pg.json("metadata").getText("author").as("author"),
    pg
      .vector("embedding")
      .distance(searchEmbedding.data[0].embedding)
      .as("similarity"),
    pg.array("tags").length().as("tag_count"),
  ])
  .where(pg.array("tags").overlaps(["ai", "machine-learning"]))
  .where(pg.json("metadata").get("published").equals(true))
  .where(
    pg.vector("embedding").similarTo(searchEmbedding.data[0].embedding, 0.8)
  )
  .orderBy("similarity")
  .limit(20)
  .execute();
```

### User Data Management

```typescript
const userData = await db
  .selectFrom("users")
  .select([
    "id",
    "email",
    pg.json("preferences").getText("theme").as("theme"),
    pg
      .json("preferences")
      .path(["notifications", "email"])
      .as("email_notifications"),
  ])
  .where(pg.array("roles").includes("admin"))
  .where(pg.json("preferences").hasKey("theme"))
  .where(pg.json("profile").contains({ verified: true, active: true }))
  .execute();
```

## Testing

Comprehensive test suite with real PostgreSQL validation:

- Unit tests for all helper functions
- Integration tests against live PostgreSQL database
- Coverage for all PostgreSQL operators and functions
- SQL injection prevention validation
- Performance testing with large datasets

## Requirements

- **Kysely** ^0.27.0 || ^0.28.0
- **TypeScript** 4.7+ (for best type inference)

### PostgreSQL-specific features

- **PostgreSQL** 12+ (for full feature support)
- **pgvector** extension (optional, for vector operations)

## Development

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

## Contributing

Contributions welcome! This package aims to provide the best database utilities for Kysely across different database systems.

**Roadmap:**

- Generic Kysely helpers (pagination, transactions, migrations)
- MySQL-specific helpers
- SQLite-specific helpers
- Additional PostgreSQL features

## License

MIT

---

**Made for the database and TypeScript community**
