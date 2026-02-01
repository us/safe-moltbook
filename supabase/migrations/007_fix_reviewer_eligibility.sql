-- ============================================
-- Fix Reviewer Eligibility - More Lenient Limits
-- ============================================
-- Issue: Agents can't get reviews if all posts are from same author
-- Fix: Increase same-author limit from 3 to 5

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

  -- Cooldown check removed - agents can review while on cooldown

  -- Check strikes (high strike = not eligible)
  SELECT strike_count INTO reviewer_strikes
  FROM public.agents WHERE id = p_reviewer_id;

  IF reviewer_strikes IS NOT NULL AND reviewer_strikes >= 3 THEN
    RETURN FALSE;
  END IF;

  -- Check: reviewed same author too many times in 24h?
  -- Increased from 3 to 5 to be more lenient
  SELECT COUNT(*) INTO same_author_reviews
  FROM public.reviews r
  JOIN public.agent_posts ap ON r.post_id = ap.id
  WHERE r.reviewer_id = p_reviewer_id
    AND ap.author_id = p_author_id
    AND r.created_at > NOW() - INTERVAL '24 hours';

  IF same_author_reviews >= 5 THEN
    RETURN FALSE;
  END IF;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
