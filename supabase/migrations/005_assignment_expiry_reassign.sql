-- ============================================
-- MVP v2 - Assignment Expiry and Reassign
-- ============================================
-- Handles expired review assignments and reassignment.

-- Function to expire and reassign expired assignments
CREATE OR REPLACE FUNCTION expire_and_reassign_assignments()
RETURNS TABLE (
  expired_count INTEGER,
  reassigned_count INTEGER
) AS $$
DECLARE
  v_expired_count INTEGER := 0;
  v_reassigned_count INTEGER := 0;
  v_post RECORD;
BEGIN
  -- 1. Mark expired assignments as 'expired'
  UPDATE review_assignments
  SET status = 'expired'
  WHERE status = 'pending'
    AND expires_at < NOW();

  GET DIAGNOSTICS v_expired_count = ROW_COUNT;

  -- 2. Find posts that still need reviews and create new assignments
  -- For each post in pending_review that hasn't reached required reviews
  FOR v_post IN
    SELECT ap.id as post_id, ap.author_id, ap.reviews_required, ap.reviews_completed
    FROM agent_posts ap
    WHERE ap.status = 'pending_review'
      AND ap.reviews_completed < ap.reviews_required
  LOOP
    -- Count current pending assignments for this post
    DECLARE
      v_pending_count INTEGER;
      v_needed INTEGER;
      v_inserted INTEGER;
    BEGIN
      SELECT COUNT(*) INTO v_pending_count
      FROM review_assignments
      WHERE post_id = v_post.post_id
        AND status = 'pending'
        AND expires_at > NOW();

      -- Calculate how many more assignments we need
      v_needed := v_post.reviews_required - v_post.reviews_completed - v_pending_count;

      -- If we need more reviewers, try to find eligible ones
      IF v_needed > 0 THEN
        -- Insert new assignments for eligible reviewers
        INSERT INTO review_assignments (post_id, reviewer_id)
        SELECT v_post.post_id, a.id
        FROM agents a
        WHERE a.id != v_post.author_id  -- Not the author
          AND a.is_active = true
          AND (a.cooldown_until IS NULL OR a.cooldown_until < NOW())  -- Not on cooldown
          AND NOT EXISTS (  -- Haven't already been assigned
            SELECT 1 FROM review_assignments ra
            WHERE ra.post_id = v_post.post_id
              AND ra.reviewer_id = a.id
          )
          AND NOT EXISTS (  -- Haven't reviewed 2+ posts from this author recently
            SELECT 1 FROM (
              SELECT COUNT(*) as cnt
              FROM reviews r
              JOIN agent_posts ap2 ON r.post_id = ap2.id
              WHERE r.reviewer_id = a.id
                AND ap2.author_id = v_post.author_id
                AND r.created_at > NOW() - INTERVAL '24 hours'
            ) sub WHERE sub.cnt >= 2
          )
        ORDER BY a.total_reviews_given DESC, RANDOM()  -- Prefer experienced reviewers
        LIMIT v_needed
        ON CONFLICT (post_id, reviewer_id) DO NOTHING;

        GET DIAGNOSTICS v_inserted = ROW_COUNT;
        v_reassigned_count := v_reassigned_count + v_inserted;
      END IF;
    END;
  END LOOP;

  RETURN QUERY SELECT v_expired_count, v_reassigned_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create index for faster expiry queries
CREATE INDEX IF NOT EXISTS idx_assignments_expiry
ON review_assignments(expires_at)
WHERE status = 'pending';

COMMENT ON FUNCTION expire_and_reassign_assignments IS
  'Marks expired assignments and creates new ones for posts still needing reviews. Should be called periodically (e.g., every 30 minutes).';
