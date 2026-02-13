-- =============================================================================
-- FILE REGISTRY SCHEMA v1.0.0
-- PostgreSQL Graph-Capable File Registry for Ringdom Kingdom
-- =============================================================================
-- 
-- Purpose: Comprehensive file metadata registry with:
--   - Graph relationships (imports, exports, dependencies)
--   - Symbol tracking (functions, classes, variables, types)
--   - Multi-project support (Ring Platform, Connect Platform, clones)
--   - Semantic search with vector embeddings
--   - Hierarchical path queries with ltree
--
-- Extensions Required:
--   - ltree: Hierarchical path queries
--   - pg_trgm: Fuzzy text search
--   - vector: pgvector for semantic embeddings
--   - btree_gin: GIN index support for JSONB
--
-- =============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "ltree";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gin";

-- pgvector extension (for semantic search - install if available)
-- CREATE EXTENSION IF NOT EXISTS "vector";

-- =============================================================================
-- ENUM TYPES
-- =============================================================================

-- Project platform types
CREATE TYPE platform_type AS ENUM (
    'ring_platform',      -- Ring Platform master
    'ring_clone',         -- Ring Platform white-label clone
    'connect_platform',   -- Connect Platform master
    'connect_clone'       -- Connect Platform white-label clone
);

-- File categories
CREATE TYPE file_category AS ENUM (
    'components',         -- React/UI components
    'lib',                -- Library/utility functions
    'app',                -- Next.js app routes
    'api',                -- API routes
    'actions',            -- Server actions
    'hooks',              -- React hooks
    'types',              -- TypeScript types
    'config',             -- Configuration files
    'docs',               -- Documentation (MDX)
    'styles',             -- CSS/Tailwind styles
    'scripts',            -- Build/utility scripts
    'tests',              -- Test files
    'contracts',          -- Smart contracts
    'migrations',         -- Database migrations
    'other'               -- Other files
);

-- Symbol types for code objects
CREATE TYPE symbol_type AS ENUM (
    'function',           -- Function/method
    'class',              -- Class definition
    'interface',          -- TypeScript interface
    'type',               -- TypeScript type alias
    'const',              -- Constant/variable
    'enum',               -- Enum definition
    'component',          -- React component
    'hook',               -- React hook
    'action',             -- Server action
    'provider',           -- Context provider
    'middleware',         -- Middleware function
    'schema',             -- Zod/validation schema
    'export_default',     -- Default export
    'export_named'        -- Named export
);

-- Relation types between files
CREATE TYPE relation_type AS ENUM (
    'imports',            -- File A imports from File B
    'exports_to',         -- File A exports to File B (inverse of imports)
    'extends',            -- Class/interface inheritance
    'implements',         -- Interface implementation
    'uses',               -- Uses function/component from another file
    'provides_type',      -- Provides type definition for
    'depends_on',         -- General dependency
    'tests',              -- Test file for source file
    'documents',          -- Documentation for
    'configures',         -- Configuration for
    'styles'              -- Styling for component
);

-- =============================================================================
-- CORE TABLES
-- =============================================================================

-- Projects table (Ring Platform, Connect Platform, and all clones)
CREATE TABLE IF NOT EXISTS file_projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL UNIQUE,                    -- e.g., 'ring-platform.org', 'ring-greenfood-live'
    display_name VARCHAR(255) NOT NULL,                   -- e.g., 'Ring Platform Master', 'GreenFood Live'
    platform platform_type NOT NULL,
    parent_project_id UUID REFERENCES file_projects(id),  -- For clones, points to master
    root_path VARCHAR(500) NOT NULL,                      -- e.g., '/Users/insight/code/ringdom/ring-platform.org'
    git_remote VARCHAR(500),                              -- Git remote URL
    description TEXT,
    metadata JSONB DEFAULT '{}',                          -- Additional project metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_file_projects_name ON file_projects(name);
CREATE INDEX idx_file_projects_platform ON file_projects(platform);
CREATE INDEX idx_file_projects_parent ON file_projects(parent_project_id);

-- File registry - main table for all files
CREATE TABLE IF NOT EXISTS file_registry (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES file_projects(id) ON DELETE CASCADE,
    
    -- File identification
    relative_path VARCHAR(1000) NOT NULL,                 -- e.g., 'lib/auth/auth.ts'
    path_tree ltree,                                      -- ltree for hierarchical queries
    filename VARCHAR(255) NOT NULL,                       -- e.g., 'auth.ts'
    extension VARCHAR(20),                                -- e.g., 'ts', 'tsx', 'json'
    
    -- File metadata
    category file_category DEFAULT 'other',
    file_size_bytes BIGINT,
    file_hash VARCHAR(64),                                -- SHA-256 hash
    line_count INTEGER,
    
    -- AI-CONTEXT integration
    purpose TEXT,                                         -- Human-readable purpose
    process_description TEXT,                             -- Business process description
    concepts TEXT[],                                      -- Related concepts array
    tags TEXT[],                                          -- Searchable tags
    
    -- Version tracking
    version VARCHAR(20),                                  -- e.g., '2.3.1'
    last_modified TIMESTAMP WITH TIME ZONE,
    last_scanned TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Semantic search (if pgvector installed)
    -- embedding vector(1536),                            -- OpenAI ada-002 embeddings
    
    -- Extended metadata
    metadata JSONB DEFAULT '{}',                          -- Comments, backlog, version log, etc.
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Uniqueness constraint
    UNIQUE(project_id, relative_path)
);

-- Indexes for file_registry
CREATE INDEX idx_file_registry_project ON file_registry(project_id);
CREATE INDEX idx_file_registry_path ON file_registry(relative_path);
CREATE INDEX idx_file_registry_path_tree ON file_registry USING GIST(path_tree);
CREATE INDEX idx_file_registry_filename ON file_registry(filename);
CREATE INDEX idx_file_registry_extension ON file_registry(extension);
CREATE INDEX idx_file_registry_category ON file_registry(category);
CREATE INDEX idx_file_registry_hash ON file_registry(file_hash);
CREATE INDEX idx_file_registry_concepts ON file_registry USING GIN(concepts);
CREATE INDEX idx_file_registry_tags ON file_registry USING GIN(tags);
CREATE INDEX idx_file_registry_metadata ON file_registry USING GIN(metadata);
CREATE INDEX idx_file_registry_modified ON file_registry(last_modified DESC);

-- Full-text search on purpose and description
CREATE INDEX idx_file_registry_search ON file_registry 
    USING GIN (to_tsvector('english', COALESCE(purpose, '') || ' ' || COALESCE(process_description, '')));

-- Trigram index for fuzzy filename search
CREATE INDEX idx_file_registry_filename_trgm ON file_registry USING GIN(filename gin_trgm_ops);
CREATE INDEX idx_file_registry_path_trgm ON file_registry USING GIN(relative_path gin_trgm_ops);

-- =============================================================================
-- SYMBOL TRACKING
-- =============================================================================

-- File symbols - functions, classes, variables, types
CREATE TABLE IF NOT EXISTS file_symbols (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    file_id UUID NOT NULL REFERENCES file_registry(id) ON DELETE CASCADE,
    
    -- Symbol identification
    name VARCHAR(255) NOT NULL,                           -- e.g., 'getDatabaseService', 'ProfileSidebar'
    symbol_type symbol_type NOT NULL,
    
    -- Location in file
    line_start INTEGER,
    line_end INTEGER,
    column_start INTEGER,
    column_end INTEGER,
    
    -- Signature and documentation
    signature TEXT,                                       -- Full type signature
    jsdoc TEXT,                                           -- JSDoc/TSDoc comments
    description TEXT,                                     -- Brief description
    
    -- Export information
    is_exported BOOLEAN DEFAULT false,
    is_default_export BOOLEAN DEFAULT false,
    export_name VARCHAR(255),                             -- If renamed on export
    
    -- Type information
    return_type VARCHAR(500),                             -- For functions
    parameters JSONB,                                     -- Array of {name, type, optional, default}
    generic_params JSONB,                                 -- Generic type parameters
    
    -- Extended metadata
    metadata JSONB DEFAULT '{}',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_file_symbols_file ON file_symbols(file_id);
CREATE INDEX idx_file_symbols_name ON file_symbols(name);
CREATE INDEX idx_file_symbols_type ON file_symbols(symbol_type);
CREATE INDEX idx_file_symbols_exported ON file_symbols(is_exported) WHERE is_exported = true;
CREATE INDEX idx_file_symbols_name_trgm ON file_symbols USING GIN(name gin_trgm_ops);

-- =============================================================================
-- FILE RELATIONS (GRAPH EDGES)
-- =============================================================================

-- Relations between files (import/export graph)
CREATE TABLE IF NOT EXISTS file_relations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Source and target files
    source_file_id UUID NOT NULL REFERENCES file_registry(id) ON DELETE CASCADE,
    target_file_id UUID NOT NULL REFERENCES file_registry(id) ON DELETE CASCADE,
    
    -- Relation type
    relation relation_type NOT NULL,
    
    -- Import details (for 'imports' relation)
    import_specifiers JSONB,                              -- [{name, alias, isDefault, isNamespace}]
    import_path VARCHAR(500),                             -- Original import path as written
    
    -- Relation metadata
    line_number INTEGER,                                  -- Line where relation is defined
    is_type_only BOOLEAN DEFAULT false,                   -- TypeScript 'import type'
    is_dynamic BOOLEAN DEFAULT false,                     -- Dynamic import()
    
    metadata JSONB DEFAULT '{}',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Prevent duplicate relations
    UNIQUE(source_file_id, target_file_id, relation)
);

CREATE INDEX idx_file_relations_source ON file_relations(source_file_id);
CREATE INDEX idx_file_relations_target ON file_relations(target_file_id);
CREATE INDEX idx_file_relations_type ON file_relations(relation);

-- Symbol-to-symbol relations (for class inheritance, interface implementation)
CREATE TABLE IF NOT EXISTS symbol_relations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_symbol_id UUID NOT NULL REFERENCES file_symbols(id) ON DELETE CASCADE,
    target_symbol_id UUID NOT NULL REFERENCES file_symbols(id) ON DELETE CASCADE,
    relation relation_type NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(source_symbol_id, target_symbol_id, relation)
);

CREATE INDEX idx_symbol_relations_source ON symbol_relations(source_symbol_id);
CREATE INDEX idx_symbol_relations_target ON symbol_relations(target_symbol_id);

-- =============================================================================
-- AI-CONTEXT CONCEPTS MAPPING
-- =============================================================================

-- Link files to AI-CONTEXT concepts
CREATE TABLE IF NOT EXISTS file_concepts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    file_id UUID NOT NULL REFERENCES file_registry(id) ON DELETE CASCADE,
    
    -- Concept information
    concept_name VARCHAR(255) NOT NULL,                   -- e.g., 'authentication-auth-js-5'
    concept_path VARCHAR(500),                            -- e.g., 'AI-CONTEXT/ring-platform.org/concepts/...'
    
    -- Relationship strength
    relevance_score DECIMAL(3,2) DEFAULT 1.00,            -- 0.00 to 1.00
    is_primary BOOLEAN DEFAULT false,                     -- Primary concept for this file
    
    -- Extracted facts
    facts TEXT[],                                         -- Facts about this file from concept
    
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(file_id, concept_name)
);

CREATE INDEX idx_file_concepts_file ON file_concepts(file_id);
CREATE INDEX idx_file_concepts_name ON file_concepts(concept_name);
CREATE INDEX idx_file_concepts_primary ON file_concepts(is_primary) WHERE is_primary = true;

-- =============================================================================
-- BACKLOG AND VERSION TRACKING
-- =============================================================================

-- File backlog items
CREATE TABLE IF NOT EXISTS file_backlog (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    file_id UUID NOT NULL REFERENCES file_registry(id) ON DELETE CASCADE,
    
    backlog_id VARCHAR(50) NOT NULL,                      -- e.g., 'auth_001'
    priority VARCHAR(10) DEFAULT 'P2',                    -- P0, P1, P2, P3
    status VARCHAR(50) DEFAULT 'planned',                 -- planned, in_progress, completed, cancelled
    description TEXT NOT NULL,
    
    assigned_agent VARCHAR(255),                          -- Legion agent assigned
    estimated_hours DECIMAL(5,1),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    
    UNIQUE(file_id, backlog_id)
);

CREATE INDEX idx_file_backlog_file ON file_backlog(file_id);
CREATE INDEX idx_file_backlog_priority ON file_backlog(priority);
CREATE INDEX idx_file_backlog_status ON file_backlog(status);

-- File version history
CREATE TABLE IF NOT EXISTS file_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    file_id UUID NOT NULL REFERENCES file_registry(id) ON DELETE CASCADE,
    
    version VARCHAR(20) NOT NULL,
    date DATE NOT NULL,
    changes TEXT NOT NULL,
    author VARCHAR(255),                                  -- e.g., 'Emperor Ray + Legion'
    
    commit_hash VARCHAR(40),                              -- Git commit hash
    
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_file_versions_file ON file_versions(file_id);
CREATE INDEX idx_file_versions_version ON file_versions(version);
CREATE INDEX idx_file_versions_date ON file_versions(date DESC);

-- =============================================================================
-- CROSS-PROJECT FILE MAPPING (for clone propagation)
-- =============================================================================

-- Track equivalent files across projects
CREATE TABLE IF NOT EXISTS file_mappings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    master_file_id UUID NOT NULL REFERENCES file_registry(id) ON DELETE CASCADE,
    clone_file_id UUID NOT NULL REFERENCES file_registry(id) ON DELETE CASCADE,
    
    -- Sync status
    is_customized BOOLEAN DEFAULT false,                  -- Clone has modifications
    last_sync_hash VARCHAR(64),                           -- Hash when last synced
    sync_status VARCHAR(50) DEFAULT 'synced',             -- synced, pending, conflict
    
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(master_file_id, clone_file_id)
);

CREATE INDEX idx_file_mappings_master ON file_mappings(master_file_id);
CREATE INDEX idx_file_mappings_clone ON file_mappings(clone_file_id);
CREATE INDEX idx_file_mappings_sync ON file_mappings(sync_status);

-- =============================================================================
-- MATERIALIZED VIEWS FOR FAST QUERIES
-- =============================================================================

-- File dependency graph summary
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_file_dependencies AS
SELECT 
    fr.id AS file_id,
    fr.project_id,
    fr.relative_path,
    fr.filename,
    fr.category,
    COUNT(DISTINCT rel_out.target_file_id) AS outgoing_dependencies,
    COUNT(DISTINCT rel_in.source_file_id) AS incoming_dependencies,
    array_agg(DISTINCT sym.name) FILTER (WHERE sym.is_exported) AS exported_symbols,
    fr.updated_at
FROM file_registry fr
LEFT JOIN file_relations rel_out ON fr.id = rel_out.source_file_id AND rel_out.relation = 'imports'
LEFT JOIN file_relations rel_in ON fr.id = rel_in.target_file_id AND rel_in.relation = 'imports'
LEFT JOIN file_symbols sym ON fr.id = sym.file_id
GROUP BY fr.id, fr.project_id, fr.relative_path, fr.filename, fr.category, fr.updated_at;

CREATE UNIQUE INDEX idx_mv_file_deps_id ON mv_file_dependencies(file_id);
CREATE INDEX idx_mv_file_deps_project ON mv_file_dependencies(project_id);

-- Project file statistics
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_project_stats AS
SELECT 
    p.id AS project_id,
    p.name AS project_name,
    p.platform,
    COUNT(DISTINCT fr.id) AS total_files,
    SUM(fr.file_size_bytes) AS total_size_bytes,
    SUM(fr.line_count) AS total_lines,
    COUNT(DISTINCT fr.id) FILTER (WHERE fr.category = 'components') AS component_count,
    COUNT(DISTINCT fr.id) FILTER (WHERE fr.category = 'lib') AS lib_count,
    COUNT(DISTINCT fr.id) FILTER (WHERE fr.category = 'app') AS app_route_count,
    COUNT(DISTINCT fs.id) AS total_symbols,
    COUNT(DISTINCT fs.id) FILTER (WHERE fs.is_exported) AS exported_symbols,
    MAX(fr.last_modified) AS last_modified
FROM file_projects p
LEFT JOIN file_registry fr ON p.id = fr.project_id
LEFT JOIN file_symbols fs ON fr.id = fs.file_id
GROUP BY p.id, p.name, p.platform;

CREATE UNIQUE INDEX idx_mv_project_stats_id ON mv_project_stats(project_id);

-- =============================================================================
-- FUNCTIONS FOR GRAPH QUERIES
-- =============================================================================

-- Find all files that import a given file (direct + transitive)
CREATE OR REPLACE FUNCTION get_file_importers(target_file_id UUID, max_depth INTEGER DEFAULT 10)
RETURNS TABLE (
    file_id UUID,
    relative_path VARCHAR(1000),
    depth INTEGER,
    import_chain UUID[]
) AS $$
WITH RECURSIVE importers AS (
    -- Base case: direct importers
    SELECT 
        fr.source_file_id AS file_id,
        r.relative_path,
        1 AS depth,
        ARRAY[target_file_id, fr.source_file_id] AS import_chain
    FROM file_relations fr
    JOIN file_registry r ON fr.source_file_id = r.id
    WHERE fr.target_file_id = target_file_id 
      AND fr.relation = 'imports'
    
    UNION ALL
    
    -- Recursive case: importers of importers
    SELECT 
        fr.source_file_id,
        r.relative_path,
        i.depth + 1,
        i.import_chain || fr.source_file_id
    FROM file_relations fr
    JOIN file_registry r ON fr.source_file_id = r.id
    JOIN importers i ON fr.target_file_id = i.file_id
    WHERE fr.relation = 'imports'
      AND i.depth < max_depth
      AND NOT (fr.source_file_id = ANY(i.import_chain))  -- Prevent cycles
)
SELECT DISTINCT ON (file_id) file_id, relative_path, depth, import_chain
FROM importers
ORDER BY file_id, depth;
$$ LANGUAGE SQL;

-- Find all files imported by a given file (direct + transitive)
CREATE OR REPLACE FUNCTION get_file_dependencies(source_file_id UUID, max_depth INTEGER DEFAULT 10)
RETURNS TABLE (
    file_id UUID,
    relative_path VARCHAR(1000),
    depth INTEGER,
    dependency_chain UUID[]
) AS $$
WITH RECURSIVE dependencies AS (
    -- Base case: direct dependencies
    SELECT 
        fr.target_file_id AS file_id,
        r.relative_path,
        1 AS depth,
        ARRAY[source_file_id, fr.target_file_id] AS dependency_chain
    FROM file_relations fr
    JOIN file_registry r ON fr.target_file_id = r.id
    WHERE fr.source_file_id = source_file_id 
      AND fr.relation = 'imports'
    
    UNION ALL
    
    -- Recursive case: dependencies of dependencies
    SELECT 
        fr.target_file_id,
        r.relative_path,
        d.depth + 1,
        d.dependency_chain || fr.target_file_id
    FROM file_relations fr
    JOIN file_registry r ON fr.target_file_id = r.id
    JOIN dependencies d ON fr.source_file_id = d.file_id
    WHERE fr.relation = 'imports'
      AND d.depth < max_depth
      AND NOT (fr.target_file_id = ANY(d.dependency_chain))  -- Prevent cycles
)
SELECT DISTINCT ON (file_id) file_id, relative_path, depth, dependency_chain
FROM dependencies
ORDER BY file_id, depth;
$$ LANGUAGE SQL;

-- Search files by symbol name (fuzzy)
CREATE OR REPLACE FUNCTION search_by_symbol(search_term TEXT, limit_count INTEGER DEFAULT 20)
RETURNS TABLE (
    file_id UUID,
    relative_path VARCHAR(1000),
    symbol_name VARCHAR(255),
    symbol_type symbol_type,
    signature TEXT,
    similarity REAL
) AS $$
SELECT 
    fr.id AS file_id,
    fr.relative_path,
    fs.name AS symbol_name,
    fs.symbol_type,
    fs.signature,
    similarity(fs.name, search_term) AS similarity
FROM file_symbols fs
JOIN file_registry fr ON fs.file_id = fr.id
WHERE fs.name % search_term  -- Trigram similarity operator
ORDER BY similarity DESC
LIMIT limit_count;
$$ LANGUAGE SQL;

-- Get file with all its metadata
CREATE OR REPLACE FUNCTION get_file_full_info(p_project_name VARCHAR, p_relative_path VARCHAR)
RETURNS JSONB AS $$
DECLARE
    result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'file', jsonb_build_object(
            'id', fr.id,
            'relative_path', fr.relative_path,
            'filename', fr.filename,
            'extension', fr.extension,
            'category', fr.category,
            'file_size_bytes', fr.file_size_bytes,
            'line_count', fr.line_count,
            'purpose', fr.purpose,
            'process_description', fr.process_description,
            'concepts', fr.concepts,
            'tags', fr.tags,
            'version', fr.version,
            'last_modified', fr.last_modified,
            'metadata', fr.metadata
        ),
        'project', jsonb_build_object(
            'name', fp.name,
            'display_name', fp.display_name,
            'platform', fp.platform
        ),
        'symbols', (
            SELECT jsonb_agg(jsonb_build_object(
                'name', fs.name,
                'type', fs.symbol_type,
                'signature', fs.signature,
                'is_exported', fs.is_exported,
                'line_start', fs.line_start,
                'line_end', fs.line_end
            ))
            FROM file_symbols fs WHERE fs.file_id = fr.id
        ),
        'imports', (
            SELECT jsonb_agg(jsonb_build_object(
                'path', target.relative_path,
                'specifiers', rel.import_specifiers,
                'is_type_only', rel.is_type_only
            ))
            FROM file_relations rel
            JOIN file_registry target ON rel.target_file_id = target.id
            WHERE rel.source_file_id = fr.id AND rel.relation = 'imports'
        ),
        'imported_by', (
            SELECT jsonb_agg(jsonb_build_object(
                'path', source.relative_path,
                'specifiers', rel.import_specifiers
            ))
            FROM file_relations rel
            JOIN file_registry source ON rel.source_file_id = source.id
            WHERE rel.target_file_id = fr.id AND rel.relation = 'imports'
        ),
        'concepts', (
            SELECT jsonb_agg(jsonb_build_object(
                'name', fc.concept_name,
                'relevance', fc.relevance_score,
                'is_primary', fc.is_primary,
                'facts', fc.facts
            ))
            FROM file_concepts fc WHERE fc.file_id = fr.id
        ),
        'backlog', (
            SELECT jsonb_agg(jsonb_build_object(
                'id', fb.backlog_id,
                'priority', fb.priority,
                'status', fb.status,
                'description', fb.description,
                'assigned_agent', fb.assigned_agent
            ))
            FROM file_backlog fb WHERE fb.file_id = fr.id
        ),
        'versions', (
            SELECT jsonb_agg(jsonb_build_object(
                'version', fv.version,
                'date', fv.date,
                'changes', fv.changes,
                'author', fv.author
            ) ORDER BY fv.date DESC)
            FROM file_versions fv WHERE fv.file_id = fr.id
        )
    ) INTO result
    FROM file_registry fr
    JOIN file_projects fp ON fr.project_id = fp.id
    WHERE fp.name = p_project_name AND fr.relative_path = p_relative_path;
    
    RETURN COALESCE(result, '{"error": "File not found"}'::jsonb);
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- TRIGGERS
-- =============================================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_file_registry_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_file_registry_updated
    BEFORE UPDATE ON file_registry
    FOR EACH ROW EXECUTE FUNCTION update_file_registry_timestamp();

CREATE TRIGGER tr_file_projects_updated
    BEFORE UPDATE ON file_projects
    FOR EACH ROW EXECUTE FUNCTION update_file_registry_timestamp();

CREATE TRIGGER tr_file_symbols_updated
    BEFORE UPDATE ON file_symbols
    FOR EACH ROW EXECUTE FUNCTION update_file_registry_timestamp();

CREATE TRIGGER tr_file_backlog_updated
    BEFORE UPDATE ON file_backlog
    FOR EACH ROW EXECUTE FUNCTION update_file_registry_timestamp();

-- Auto-generate ltree path from relative_path
CREATE OR REPLACE FUNCTION generate_path_tree()
RETURNS TRIGGER AS $$
BEGIN
    -- Convert path separators to dots and remove extension for ltree
    -- e.g., 'lib/auth/auth.ts' -> 'lib.auth.auth_ts'
    NEW.path_tree = text2ltree(
        regexp_replace(
            regexp_replace(NEW.relative_path, '/', '.', 'g'),
            '\.([^.]+)$',
            '_\1'
        )
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_file_registry_path_tree
    BEFORE INSERT OR UPDATE OF relative_path ON file_registry
    FOR EACH ROW EXECUTE FUNCTION generate_path_tree();

-- =============================================================================
-- INITIAL DATA - Register Ringdom Projects
-- =============================================================================

-- Ring Platform Master
INSERT INTO file_projects (name, display_name, platform, root_path, description)
VALUES (
    'ring-platform.org',
    'Ring Platform Master',
    'ring_platform',
    '/Users/insight/code/ringdom/ring-platform.org',
    'Master Ring Platform - Open source gateway. React 19 + Next.js 15 + Web3. Clone, customize, deploy.'
) ON CONFLICT (name) DO UPDATE SET updated_at = NOW();

-- Connect Platform Master
INSERT INTO file_projects (name, display_name, platform, root_path, description)
VALUES (
    'connect-backend',
    'Connect Platform Backend',
    'connect_platform',
    '/Users/insight/code/ringdom/connect-backend',
    'Enterprise BaaS. Erlang/OTP 28. 75-500x faster than HTTP. Millions concurrent. Real-time collaboration.'
) ON CONFLICT (name) DO UPDATE SET updated_at = NOW();

-- Ring Clones
INSERT INTO file_projects (name, display_name, platform, parent_project_id, root_path, description)
SELECT 
    'ring-greenfood-live',
    'GreenFood Live',
    'ring_clone',
    (SELECT id FROM file_projects WHERE name = 'ring-platform.org'),
    '/Users/insight/code/ringdom/ring-greenfood-live',
    'GreenFood Live - Agricultural cooperative marketplace'
ON CONFLICT (name) DO UPDATE SET updated_at = NOW();

INSERT INTO file_projects (name, display_name, platform, parent_project_id, root_path, description)
SELECT 
    'ring-wellness-gov-ua',
    'Wellness Gov UA',
    'ring_clone',
    (SELECT id FROM file_projects WHERE name = 'ring-platform.org'),
    '/Users/insight/code/ringdom/ring-wellness-gov-ua',
    'Wellness Gov UA - Government wellness platform'
ON CONFLICT (name) DO UPDATE SET updated_at = NOW();

INSERT INTO file_projects (name, display_name, platform, parent_project_id, root_path, description)
SELECT 
    'ring-zemna-ai',
    'Zemna AI',
    'ring_clone',
    (SELECT id FROM file_projects WHERE name = 'ring-platform.org'),
    '/Users/insight/code/ringdom/ring-zemna-ai',
    'Zemna AI - AI-powered agricultural assistant'
ON CONFLICT (name) DO UPDATE SET updated_at = NOW();

-- =============================================================================
-- REFRESH MATERIALIZED VIEWS FUNCTION
-- =============================================================================

CREATE OR REPLACE FUNCTION refresh_file_registry_views()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_file_dependencies;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_project_stats;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- GRANTS
-- =============================================================================

-- Grant permissions (adjust user as needed)
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO ring_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO ring_user;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO ring_user;

-- =============================================================================
-- USAGE EXAMPLES
-- =============================================================================

-- Find all files in lib/auth directory using ltree:
-- SELECT * FROM file_registry WHERE path_tree <@ 'lib.auth';

-- Find files that import DatabaseService:
-- SELECT * FROM get_file_importers((SELECT id FROM file_registry WHERE relative_path = 'lib/database/DatabaseService.ts'));

-- Search for files with 'wallet' in symbol names:
-- SELECT * FROM search_by_symbol('wallet');

-- Get full file info with all metadata:
-- SELECT get_file_full_info('ring-platform.org', 'lib/auth/auth.ts');

-- Find all React components:
-- SELECT fr.*, fs.name FROM file_registry fr 
-- JOIN file_symbols fs ON fr.id = fs.file_id 
-- WHERE fs.symbol_type = 'component';

-- Cross-project comparison - find files in clone that differ from master:
-- SELECT m.relative_path, m.file_hash AS master_hash, c.file_hash AS clone_hash
-- FROM file_registry m
-- JOIN file_mappings fm ON m.id = fm.master_file_id
-- JOIN file_registry c ON fm.clone_file_id = c.id
-- WHERE m.file_hash != c.file_hash;

COMMENT ON TABLE file_registry IS 'Core file registry for Ringdom Kingdom - all platform files with metadata, symbols, and relations';
COMMENT ON TABLE file_symbols IS 'Code symbols (functions, classes, types) extracted from files';
COMMENT ON TABLE file_relations IS 'Graph edges representing import/export and other relationships between files';
COMMENT ON TABLE file_concepts IS 'Links files to AI-CONTEXT concepts for intelligent discovery';











