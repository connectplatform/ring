-- News collaboration / revision scaffolding (Zemna Phase 4 mapped to news)
-- Collections use Ring JSONB document model (createDoc / queryDocs).

-- Conceptual shape for news_revisions (implemented via DatabaseService createDoc):
-- {
--   article_id, article_title, article_slug,
--   base_content, proposed_content, proposed_json?,
--   status: pending-revision | accepted | rejected | withdrawn,
--   proposer_id, proposer_name, diff_summary?,
--   resolved_at?, resolved_by?,
--   createdAt, updatedAt
-- }

-- Conceptual shape for news_collaborators (invite UI sprint):
-- {
--   article_id, user_id, role: owner|admin|editor|reviewer|viewer,
--   status: pending|accepted|revoked,
--   permissions?, createdAt, acceptedAt?
-- }

-- Conceptual shape for news_collaboration_invites:
-- {
--   article_id, email, role, token, expires_at, invited_by, createdAt
-- }

-- Optional future: yjs_state for CRDT collab snapshots (see /api/collab/.../snapshot).
