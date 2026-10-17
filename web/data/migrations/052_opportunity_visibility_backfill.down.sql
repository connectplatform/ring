-- Data backfill is not reversed (legacy nulls were treated as public / not confidential).
DELETE FROM schema_versions WHERE version = '052';
