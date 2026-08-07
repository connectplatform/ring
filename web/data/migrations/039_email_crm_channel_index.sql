-- Email CRM multi-channel indexes (sourceChannel on JSONB messages/threads)
-- Applied after 009_email_crm_jsonb.sql

CREATE INDEX IF NOT EXISTS idx_email_messages_source_channel
  ON email_messages ((data->>'sourceChannel'));

CREATE INDEX IF NOT EXISTS idx_email_threads_source_channel
  ON email_threads ((data->>'sourceChannel'));

CREATE INDEX IF NOT EXISTS idx_email_messages_channel_id
  ON email_messages ((data->>'channelId'));

CREATE INDEX IF NOT EXISTS idx_email_threads_channel_id
  ON email_threads ((data->>'channelId'));

COMMENT ON INDEX idx_email_threads_source_channel IS 'Multi-mailbox CRM filter by human channel name';
