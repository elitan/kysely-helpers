# Kysely Helpers

**Database helpers and utilities for Kysely**

PostgreSQL-focused with comprehensive support for arrays, JSONB, vectors (pgvector), and full-text search.

## Features

- **Type-safe** - Full TypeScript support with perfect autocompletion
- **PostgreSQL-first** - Rich support for advanced features (arrays, JSONB, vectors)
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
    pg.json("metadata").path("author").asText().as("author"),
  ])
  .where(pg.array("tags").hasAllOf(["typescript"])) // tags @> ARRAY['typescript']
  .where(pg.json("metadata").path("published").equals(true)) // metadata#>'{"published"}' = true
  .where(pg.vector("embedding").similarTo(searchVector)) // embedding <-> $1 < 0.5
  .orderBy("tag_count", "desc")
  .execute();
```

### Array Operations - Product filtering, tag-based search, permission checking, queue/stack operations

Work with PostgreSQL arrays like JavaScript arrays, but with database-level performance.

```typescript
import { pg } from 'kysely-helpers'

// Query operations - Array contains all specified values
.where(pg.array('tags').hasAllOf(['featured']))
.where(pg.array('tags').hasAllOf(['ai', 'ml']))

// Array contains any of the specified values
.where(pg.array('categories').hasAnyOf(['tech', 'ai']))

// Array length and element access
.where(pg.array('items').length(), '>', 5)
.select(pg.array('tags').first().as('first_tag'))
.select(pg.array('tags').last().as('last_tag'))

// Update operations - Add elements
await db.updateTable('products')
  .set({ tags: pg.array('tags').append('new-tag') })
  .set({ tags: pg.array('tags').append(['tag1', 'tag2']) })
  .set({ priorities: pg.array('priorities').prepend('urgent') })
  .execute()

// Remove elements
await db.updateTable('products')
  .set({ tags: pg.array('tags').remove('deprecated') })
  .set({ queue: pg.array('queue').removeFirst() })
  .set({ stack: pg.array('stack').removeLast() })
  .execute()
```

### JSON/JSONB Operations - User preferences, product configurations, dynamic schemas, analytics counters

Query and filter JSON data stored in your database without parsing it in your application. Atomic updates, efficient (no full object reads), type-safe, PostgreSQL-native.

```typescript
import { pg } from 'kysely-helpers'

// Query operations - Path navigation and filtering
.where(pg.json('metadata').path('theme').equals('dark'))
.where(pg.json('settings').path('language').asText().equals('en'))
.where(pg.json('data').path(['user', 'preferences']).contains({notifications: true}))

// Key and value checks
.where(pg.json('profile').contains({verified: true}))
.where(pg.json('permissions').hasKey('admin'))
.where(pg.json('metadata').hasAllKeys(['title', 'author']))

// Update operations - Set, increment, remove, and push operations
await db.updateTable('users')
  .set({
    metadata: pg.json('metadata').set('theme', 'dark'),
    settings: pg.json('settings').set(['user', 'preferences', 'lang'], 'es'),
    stats: pg.json('stats').increment('points', 10),
    cache: pg.json('cache').remove('temp_data'),
    tags: pg.json('tags').push('premium')
  })
  .where('id', '=', userId)
  .execute()
```

### Vector Operations (pgvector) - Semantic search, recommendation engines, document similarity

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
    embedding: pg.embedding(embedding.data[0].embedding),
  })
  .execute()

// Semantic search with similarity (0-1 scale, higher = more similar)
const results = await db
  .selectFrom("documents")
  .select([
    "id",
    "title", 
    "content",
    pg.vector("embedding").similarity(searchVector).as("similarity")
  ])
  .where(pg.vector("embedding").similarity(searchVector), '>', 0.8)
  .orderBy("similarity", "desc")
  .limit(10)
  .execute()

// Different similarity algorithms: 'cosine' (default), 'euclidean', 'dot'
.where(pg.vector("embedding").similarity(searchVector, 'cosine'), '>', 0.8)

// Convert vectors back to JavaScript arrays
.select(["id", "title", pg.vector("embedding").toArray().as("embedding")])
```

**Key features:** `pg.embedding()` for insertion, `pg.vector().similarity()` for search, `pg.vector().toArray()` for conversion. AI-native design for OpenAI, Anthropic, and other embedding providers.



