-- Rollback 051_likes_uci_favorites_indexes.sql
DROP INDEX IF EXISTS idx_likes_user_target;
DROP INDEX IF EXISTS idx_likes_target;
DROP INDEX IF EXISTS idx_uci_user_type_action;
DROP INDEX IF EXISTS idx_user_favorites_global_user_id;
DROP INDEX IF EXISTS idx_user_favorites_type_id;
DROP INDEX IF EXISTS idx_user_favorites_data_gin;
DROP TABLE IF EXISTS user_favorites;

DELETE FROM schema_versions WHERE version = '051';
