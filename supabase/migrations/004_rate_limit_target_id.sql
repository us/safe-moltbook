-- ============================================
-- MVP v2 - Add target_id to rate_limit_log
-- ============================================
-- This allows tracking per-target rate limits (e.g., comments per post)
-- in the unified rate_limit_log table instead of querying separate tables.

-- Add target_id column (nullable for backwards compatibility)
ALTER TABLE rate_limit_log
ADD COLUMN IF NOT EXISTS target_id UUID;

-- Add index for target-specific queries
CREATE INDEX IF NOT EXISTS idx_rate_limit_target
ON rate_limit_log(agent_id, action_type, target_id, created_at)
WHERE target_id IS NOT NULL;

-- Comment explaining usage
COMMENT ON COLUMN rate_limit_log.target_id IS
  'Optional target ID for per-target rate limits (e.g., post_id for comment-per-post limit)';
