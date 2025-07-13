-- PostgreSQL initialization script for @pgvibe/kysely integration tests
-- Creates test database with array, JSONB, and pgvector support

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
-- Note: pgvector extension will be enabled in tests if available

-- Create test tables with various PostgreSQL data types
CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    tags TEXT[] DEFAULT '{}',
    categories TEXT[] DEFAULT '{}',
    scores INTEGER[] DEFAULT '{}',
    prices DECIMAL[] DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE documents (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    author VARCHAR(255),
    tags TEXT[] DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    word_count INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    roles TEXT[] DEFAULT '{}',
    preferences JSONB DEFAULT '{}',
    permissions JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert test data for products
INSERT INTO products (name, description, tags, categories, scores, prices, metadata, settings) VALUES
('TypeScript Tutorial', 'Learn TypeScript fundamentals', 
 ARRAY['typescript', 'tutorial', 'programming'], 
 ARRAY['education', 'programming'], 
 ARRAY[95, 88, 92],
 ARRAY[29.99, 19.99],
 '{"difficulty": "beginner", "duration": "4 hours", "rating": 4.8}',
 '{"notifications": true, "theme": "dark"}'
),
('PostgreSQL Guide', 'Advanced PostgreSQL techniques',
 ARRAY['postgresql', 'database', 'advanced'],
 ARRAY['education', 'database'],
 ARRAY[98, 95, 90],
 ARRAY[49.99, 39.99],
 '{"difficulty": "advanced", "duration": "8 hours", "rating": 4.9}',
 '{"notifications": false, "theme": "light"}'
),
('JavaScript Basics', 'Introduction to JavaScript',
 ARRAY['javascript', 'tutorial', 'web'],
 ARRAY['education', 'web-development'],
 ARRAY[85, 80, 88],
 ARRAY[19.99, 14.99],
 '{"difficulty": "beginner", "duration": "3 hours", "rating": 4.5}',
 '{"notifications": true, "theme": "auto"}'
),
('Vector Database Course', 'AI and vector databases',
 ARRAY['ai', 'vector', 'database', 'machine-learning'],
 ARRAY['education', 'ai', 'database'],
 ARRAY[92, 94, 96],
 ARRAY[79.99, 59.99],
 '{"difficulty": "intermediate", "duration": "6 hours", "rating": 4.7, "ai_related": true}',
 '{"notifications": true, "theme": "dark", "experimental": true}'
),
('Electronics Gadget', 'Latest tech gadget',
 ARRAY['electronics', 'gadget', 'tech'],
 ARRAY['electronics', 'gadgets'],
 ARRAY[88, 90, 85],
 ARRAY[199.99, 179.99, 159.99],
 '{"brand": "TechCorp", "warranty": "2 years", "color": "black"}',
 '{"notifications": false, "theme": "light"}'
);

-- Insert test data for documents
INSERT INTO documents (title, content, author, tags, metadata, word_count) VALUES
('Introduction to Arrays', 'PostgreSQL arrays are powerful data structures...', 'John Doe',
 ARRAY['postgresql', 'arrays', 'tutorial'],
 '{"category": "tutorial", "published": true, "featured": false}',
 1250
),
('JSONB Deep Dive', 'Working with JSONB in PostgreSQL provides...', 'Jane Smith',
 ARRAY['postgresql', 'jsonb', 'advanced'],
 '{"category": "guide", "published": true, "featured": true}',
 2800
),
('Vector Similarity Search', 'Implementing semantic search with pgvector...', 'AI Expert',
 ARRAY['ai', 'vector', 'search', 'machine-learning'],
 '{"category": "advanced", "published": true, "featured": true, "ai_content": true}',
 3200
),
('Draft Article', 'This is a draft article about...', 'Draft Author',
 ARRAY['draft', 'unpublished'],
 '{"category": "draft", "published": false, "featured": false}',
 500
);

-- Insert test data for users
INSERT INTO users (email, name, roles, preferences, permissions) VALUES
('admin@example.com', 'Admin User',
 ARRAY['admin', 'user'],
 '{"theme": "dark", "notifications": {"email": true, "push": false}, "language": "en"}',
 '{"read": true, "write": true, "delete": true, "admin": true}'
),
('editor@example.com', 'Editor User',
 ARRAY['editor', 'user'],
 '{"theme": "light", "notifications": {"email": true, "push": true}, "language": "en"}',
 '{"read": true, "write": true, "delete": false, "admin": false}'
),
('viewer@example.com', 'Viewer User',
 ARRAY['user'],
 '{"theme": "auto", "notifications": {"email": false, "push": false}, "language": "es"}',
 '{"read": true, "write": false, "delete": false, "admin": false}'
),
('ai_researcher@example.com', 'AI Researcher',
 ARRAY['researcher', 'ai_specialist', 'user'],
 '{"theme": "dark", "notifications": {"email": true, "push": true}, "language": "en", "experimental_features": true}',
 '{"read": true, "write": true, "delete": false, "admin": false, "ai_access": true}'
);

-- Create indexes for better performance in tests
CREATE INDEX idx_products_tags ON products USING GIN (tags);
CREATE INDEX idx_products_categories ON products USING GIN (categories);
CREATE INDEX idx_products_metadata ON products USING GIN (metadata);
CREATE INDEX idx_documents_tags ON documents USING GIN (tags);
CREATE INDEX idx_documents_metadata ON documents USING GIN (metadata);
CREATE INDEX idx_users_roles ON users USING GIN (roles);
CREATE INDEX idx_users_preferences ON users USING GIN (preferences);

-- Create a function to test if pgvector is available
CREATE OR REPLACE FUNCTION pgvector_available() RETURNS BOOLEAN AS $$
BEGIN
    BEGIN
        CREATE EXTENSION IF NOT EXISTS vector;
        RETURN TRUE;
    EXCEPTION WHEN OTHERS THEN
        RETURN FALSE;
    END;
END;
$$ LANGUAGE plpgsql;

-- Only create vector tables if pgvector is available
DO $$
BEGIN
    IF pgvector_available() THEN
        -- Create table with vector embeddings (requires pgvector)
        CREATE TABLE document_embeddings (
            id SERIAL PRIMARY KEY,
            document_id INTEGER REFERENCES documents(id),
            content TEXT NOT NULL,
            embedding vector(5), -- 5-dimensional embeddings for testing
            metadata JSONB DEFAULT '{}',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        -- Insert sample embeddings (mock data)
        INSERT INTO document_embeddings (document_id, content, embedding, metadata) VALUES
        (1, 'PostgreSQL arrays tutorial', 
         ARRAY[0.1, 0.2, 0.3, 0.4, 0.5]::real[]::vector(5),
         '{"source": "tutorial", "confidence": 0.95}'
        ),
        (2, 'JSONB guide advanced', 
         ARRAY[0.2, 0.3, 0.4, 0.5, 0.6]::real[]::vector(5),
         '{"source": "guide", "confidence": 0.98}'
        ),
        (3, 'Vector similarity AI search', 
         ARRAY[0.3, 0.4, 0.5, 0.6, 0.7]::real[]::vector(5),
         '{"source": "ai", "confidence": 0.99}'
        );
        
        -- Create vector index for similarity search
        CREATE INDEX idx_document_embeddings_vector ON document_embeddings 
        USING ivfflat (embedding vector_cosine_ops) WITH (lists = 10);
        
        RAISE NOTICE 'pgvector extension enabled and test data created';
    ELSE
        RAISE NOTICE 'pgvector extension not available - vector tests will be skipped';
    END IF;
END;
$$;

-- Create a view for easy testing
CREATE VIEW test_statistics AS
WITH products_stats AS (
    SELECT 
        'products' as table_name,
        count(*) as row_count,
        array_agg(DISTINCT tag) as all_tags
    FROM products, unnest(tags) as tag
),
documents_stats AS (
    SELECT 
        'documents' as table_name,
        count(*) as row_count,
        array_agg(DISTINCT tag) as all_tags
    FROM documents, unnest(tags) as tag
),
users_stats AS (
    SELECT 
        'users' as table_name,
        count(*) as row_count,
        array_agg(DISTINCT role) as all_tags
    FROM users, unnest(roles) as role
)
SELECT * FROM products_stats
UNION ALL
SELECT * FROM documents_stats
UNION ALL
SELECT * FROM users_stats;

ANALYZE; -- Update statistics for better query planning