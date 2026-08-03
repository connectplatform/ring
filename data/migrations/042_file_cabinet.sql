-- 042_file_cabinet.sql
-- Personal File Cabinet: nodes, ACL, desktop layouts, gallery curation.

CREATE TABLE IF NOT EXISTS file_cabinet_nodes (
    id VARCHAR(255) PRIMARY KEY DEFAULT (gen_random_uuid()::text),
    data JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_file_cabinet_nodes_owner
  ON file_cabinet_nodes ((data->>'ownerId'));
CREATE INDEX IF NOT EXISTS idx_file_cabinet_nodes_parent
  ON file_cabinet_nodes ((data->>'parentId'));
CREATE INDEX IF NOT EXISTS idx_file_cabinet_nodes_kind
  ON file_cabinet_nodes ((data->>'kind'));
CREATE INDEX IF NOT EXISTS idx_file_cabinet_nodes_path
  ON file_cabinet_nodes ((data->>'path'));
CREATE INDEX IF NOT EXISTS idx_file_cabinet_nodes_data_gin
  ON file_cabinet_nodes USING GIN (data);
CREATE INDEX IF NOT EXISTS idx_file_cabinet_nodes_updated_at
  ON file_cabinet_nodes (updated_at DESC);

COMMENT ON TABLE file_cabinet_nodes IS
  'Personal file cabinet nodes — kind file|dir; storage via file()/RingFileBase CDN /files/{uuid}';

CREATE TABLE IF NOT EXISTS file_cabinet_acl (
    id VARCHAR(255) PRIMARY KEY DEFAULT (gen_random_uuid()::text),
    data JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_file_cabinet_acl_node_user
  ON file_cabinet_acl ((data->>'nodeId'), (data->>'userId'));
CREATE INDEX IF NOT EXISTS idx_file_cabinet_acl_user
  ON file_cabinet_acl ((data->>'userId'));
CREATE INDEX IF NOT EXISTS idx_file_cabinet_acl_role
  ON file_cabinet_acl ((data->>'role'));
CREATE INDEX IF NOT EXISTS idx_file_cabinet_acl_data_gin
  ON file_cabinet_acl USING GIN (data);

COMMENT ON TABLE file_cabinet_acl IS
  'File cabinet ACL — role owner|trustee (legacy editor→trustee); immediate grant (no invite accept)';

CREATE TABLE IF NOT EXISTS file_cabinet_desktop (
    id VARCHAR(255) PRIMARY KEY DEFAULT (gen_random_uuid()::text),
    data JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_file_cabinet_desktop_user_scope
  ON file_cabinet_desktop ((data->>'userId'), (data->>'scope'));
CREATE INDEX IF NOT EXISTS idx_file_cabinet_desktop_data_gin
  ON file_cabinet_desktop USING GIN (data);

COMMENT ON TABLE file_cabinet_desktop IS
  'Win3.11 desktop icon layouts — scope own|shared; synced via publishToUserTunnel';

CREATE TABLE IF NOT EXISTS file_cabinet_gallery_items (
    id VARCHAR(255) PRIMARY KEY DEFAULT (gen_random_uuid()::text),
    data JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_file_cabinet_gallery_owner
  ON file_cabinet_gallery_items ((data->>'ownerId'));
CREATE INDEX IF NOT EXISTS idx_file_cabinet_gallery_node
  ON file_cabinet_gallery_items ((data->>'nodeId'));
CREATE INDEX IF NOT EXISTS idx_file_cabinet_gallery_visibility
  ON file_cabinet_gallery_items ((data->>'visibility'));
CREATE INDEX IF NOT EXISTS idx_file_cabinet_gallery_data_gin
  ON file_cabinet_gallery_items USING GIN (data);

COMMENT ON TABLE file_cabinet_gallery_items IS
  'Curated gallery subset of cabinet files — visibility private|unlisted|public; public CDN /files/{uuid}';
