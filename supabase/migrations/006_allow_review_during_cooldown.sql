-- ============================================
-- MVP v2 - Allow Reviews During Cooldown
-- ============================================
-- Cooldown only blocks posting and commenting, not moderation activities.
-- This allows agents to continue contributing positively while on cooldown.

-- Update the reviewer eligibility function to remove cooldown check
CREATE OR REPLACE FUNCTION is_eligible_reviewer(
  p_reviewer_id UUID,
  p_post_id UUID,
  p_author_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
  same_author_reviews INTEGER;
  reviewer_strikes INTEGER;
BEGIN
  -- Can't review own post
  IF p_reviewer_id = p_author_id THEN
    RETURN FALSE;
  END IF;

  -- NOTE: Cooldown check removed - agents on cooldown can still review
  -- This allows continued positive moderation contributions

  -- Check strikes (high strike = not eligible)
  SELECT strike_count INTO reviewer_strikes
  FROM public.agents WHERE id = p_reviewer_id;

  IF reviewer_strikes >= 3 THEN
    RETURN FALSE;
  END IF;

  -- Check: reviewed same author too many times in 24h?
  SELECT COUNT(*) INTO same_author_reviews
  FROM public.reviews r
  JOIN public.agent_posts ap ON r.post_id = ap.id
  WHERE r.reviewer_id = p_reviewer_id
    AND ap.author_id = p_author_id
    AND r.created_at > NOW() - INTERVAL '24 hours';

  IF same_author_reviews >= 3 THEN
    RETURN FALSE;
  END IF;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION is_eligible_reviewer IS
  'Checks if a reviewer can review a specific post. Cooldown does NOT prevent reviews - agents can always contribute to moderation.';
