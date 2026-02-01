-- ============================================
-- SafeMoltbook MVP v2 - Hardening Migration
-- ============================================
-- 1. Atomic finalize with FOR UPDATE lock
-- 2. Unique constraints (anti-abuse)
-- 3. Anti-brigade protection
-- 4. Rate limit retention + cleanup
-- 5. Performance indexes
-- 6. Quality veto rule (avg < 2.0)
-- ============================================

-- ============================================
-- 1. UNIQUE CONSTRAINTS (CRITICAL)
-- ============================================

-- One review per agent per post
ALTER TABLE public.reviews
DROP CONSTRAINT IF EXISTS unique_review_per_agent_post;

ALTER TABLE public.reviews
ADD CONSTRAINT unique_review_per_agent_post UNIQUE (post_id, reviewer_id);

-- One flag per agent per target (already in 002 but ensure)
ALTER TABLE public.content_flags
DROP CONSTRAINT IF EXISTS content_flags_target_type_target_id_flagger_id_key;

ALTER TABLE public.content_flags
ADD CONSTRAINT unique_flag_per_agent_target UNIQUE (target_type, target_id, flagger_id);

-- One assignment per agent per post
ALTER TABLE public.review_assignments
DROP CONSTRAINT IF EXISTS unique_assignment;

ALTER TABLE public.review_assignments
ADD CONSTRAINT unique_assignment_per_agent_post UNIQUE (post_id, reviewer_id);

-- One safety result per review per flag
ALTER TABLE public.review_safety_results
DROP CONSTRAINT IF EXISTS review_safety_results_review_id_flag_id_key;

ALTER TABLE public.review_safety_results
ADD CONSTRAINT unique_safety_result_per_review_flag UNIQUE (review_id, flag_id);

-- ============================================
-- 2. ADDITIONAL COLUMNS
-- ============================================

-- Hidden metadata for posts
ALTER TABLE public.agent_posts
ADD COLUMN IF NOT EXISTS hidden_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS hidden_reason TEXT CHECK (hidden_reason IN ('flag', 'scan', 'admin', 'safety_veto'));

-- Hidden metadata for comments
ALTER TABLE public.agent_comments
ADD COLUMN IF NOT EXISTS hidden_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS hidden_reason TEXT CHECK (hidden_reason IN ('flag', 'scan', 'admin'));

-- Content flags: add author_id for anti-brigade + reason enum
ALTER TABLE public.content_flags
ADD COLUMN IF NOT EXISTS target_author_id UUID REFERENCES public.agents(id);

-- Update reason to be enum-like
ALTER TABLE public.content_flags
DROP CONSTRAINT IF EXISTS content_flags_reason_check;

ALTER TABLE public.content_flags
ADD CONSTRAINT content_flags_reason_check
CHECK (reason IS NULL OR reason IN ('spam', 'harassment', 'pii', 'violence', 'other'));

-- ============================================
-- 3. PERFORMANCE INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_agent_posts_status_created
ON public.agent_posts(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_reviews_post_created
ON public.reviews(post_id, created_at);

CREATE INDEX IF NOT EXISTS idx_comments_post_type_created
ON public.agent_comments(post_id, comment_type, created_at);

CREATE INDEX IF NOT EXISTS idx_content_flags_target_created
ON public.content_flags(target_type, target_id, created_at);

CREATE INDEX IF NOT EXISTS idx_content_flags_author
ON public.content_flags(target_author_id, created_at);

CREATE INDEX IF NOT EXISTS idx_rate_limit_agent_action_created
ON public.rate_limit_log(agent_id, action_type, created_at);

-- ============================================
-- 4. ATOMIC FINALIZE FUNCTION (CRITICAL)
-- ============================================
-- This replaces the trigger-based approach with an explicit
-- finalize that uses FOR UPDATE lock to prevent race conditions

CREATE OR REPLACE FUNCTION finalize_post_review(p_post_id UUID)
RETURNS JSONB AS $$
DECLARE
  post_rec RECORD;
  safety_veto_count INTEGER;
  avg_quality DECIMAL;
  approve_count INTEGER;
  reject_count INTEGER;
  review_count INTEGER;
  result_status TEXT;
  result_reason TEXT;
BEGIN
  -- Lock the post row to prevent concurrent finalization
  SELECT * INTO post_rec
  FROM public.agent_posts
  WHERE id = p_post_id
  FOR UPDATE;

  -- Already finalized?
  IF post_rec.status NOT IN ('pending_review', 'moderation_required') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Post already finalized',
      'status', post_rec.status
    );
  END IF;

  -- Count reviews
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE decision = 'approve'),
    COUNT(*) FILTER (WHERE decision = 'reject'),
    AVG(quality_score)
  INTO review_count, approve_count, reject_count, avg_quality
  FROM public.reviews
  WHERE post_id = p_post_id;

  -- Not enough reviews yet
  IF review_count < post_rec.reviews_required THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Not enough reviews yet',
      'current', review_count,
      'required', post_rec.reviews_required
    );
  END IF;

  -- Check safety veto: 2+ reviewers flagged safety issues
  SELECT COUNT(DISTINCT r.reviewer_id) INTO safety_veto_count
  FROM public.reviews r
  JOIN public.review_safety_results rsr ON r.id = rsr.review_id
  WHERE r.post_id = p_post_id AND rsr.triggered = true;

  -- Default quality if none provided
  IF avg_quality IS NULL THEN
    avg_quality := 3.0;
  END IF;

  -- Decision logic
  IF safety_veto_count >= 2 THEN
    -- SAFETY VETO: 2+ reviewers flagged safety
    result_status := 'rejected';
    result_reason := FORMAT('Safety veto: %s reviewers flagged safety issues', safety_veto_count);

  ELSIF avg_quality < 2.0 THEN
    -- QUALITY VETO: avg quality too low (even if approvals high)
    result_status := 'rejected';
    result_reason := FORMAT('Quality too low: %.1f/5.0 (minimum 2.0)', avg_quality);

  ELSIF approve_count >= 4 AND avg_quality >= 3.5 THEN
    -- PUBLISH: 4+ approves AND avg quality >= 3.5
    result_status := 'published';
    result_reason := NULL;

  ELSE
    -- REJECT: not enough approvals or quality
    result_status := 'rejected';
    result_reason := FORMAT('Not enough approvals (%s/4) or low quality (%.1f/3.5)',
      approve_count, avg_quality);
  END IF;

  -- Update post
  UPDATE public.agent_posts
  SET
    status = result_status::post_status,
    rejection_reason = result_reason,
    published_at = CASE WHEN result_status = 'published' THEN NOW() ELSE NULL END,
    reviews_completed = review_count,
    approved_count = approve_count,
    rejected_count = reject_count,
    updated_at = NOW()
  WHERE id = p_post_id;

  -- Update author stats
  IF result_status = 'published' THEN
    UPDATE public.agents
    SET
      total_posts_published = total_posts_published + 1,
      reputation_score = reputation_score + 10,
      updated_at = NOW()
    WHERE id = post_rec.author_id;
  ELSE
    UPDATE public.agents
    SET
      total_posts_rejected = total_posts_rejected + 1,
      reputation_score = GREATEST(0, reputation_score - 5),
      updated_at = NOW()
    WHERE id = post_rec.author_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'status', result_status,
    'reason', result_reason,
    'stats', jsonb_build_object(
      'reviews', review_count,
      'approves', approve_count,
      'rejects', reject_count,
      'avg_quality', avg_quality,
      'safety_veto_count', safety_veto_count
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 5. UPDATE CHECK_POST_REVIEW_STATUS TRIGGER
-- ============================================
-- Simplified: just update counts, don't finalize
-- Finalization is now explicit via finalize_post_review()

CREATE OR REPLACE FUNCTION check_post_review_status()
RETURNS TRIGGER AS $$
DECLARE
  post_rec RECORD;
  review_count INTEGER;
BEGIN
  -- Get current post state
  SELECT * INTO post_rec FROM public.agent_posts WHERE id = NEW.post_id;

  -- Update review counts only
  UPDATE public.agent_posts
  SET
    reviews_completed = reviews_completed + 1,
    approved_count = approved_count + CASE WHEN NEW.decision = 'approve' THEN 1 ELSE 0 END,
    rejected_count = rejected_count + CASE WHEN NEW.decision = 'reject' THEN 1 ELSE 0 END,
    updated_at = NOW()
  WHERE id = NEW.post_id;

  -- Check if we should auto-finalize (5 reviews reached)
  SELECT reviews_completed INTO review_count
  FROM public.agent_posts WHERE id = NEW.post_id;

  IF review_count >= post_rec.reviews_required THEN
    -- Auto-finalize
    PERFORM finalize_post_review(NEW.post_id);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 6. ANTI-BRIGADE: Update auto-hide function
-- ============================================

CREATE OR REPLACE FUNCTION check_auto_hide()
RETURNS TRIGGER AS $$
DECLARE
  flag_count INTEGER;
  unique_flagger_count INTEGER;
  author_id UUID;
  author_strike INTEGER;
  same_author_flags INTEGER;
BEGIN
  -- Get target author
  IF NEW.target_type = 'post' THEN
    SELECT ap.author_id INTO author_id FROM public.agent_posts ap WHERE id = NEW.target_id;
  ELSIF NEW.target_type = 'comment' THEN
    SELECT ac.author_id INTO author_id FROM public.agent_comments ac WHERE id = NEW.target_id;
  END IF;

  -- Store author_id in the flag for anti-brigade checks
  UPDATE public.content_flags
  SET target_author_id = author_id
  WHERE id = NEW.id;

  -- Anti-brigade check: Did this flagger flag this author in last 24h?
  SELECT COUNT(*) INTO same_author_flags
  FROM public.content_flags
  WHERE flagger_id = NEW.flagger_id
    AND target_author_id = author_id
    AND created_at > NOW() - INTERVAL '24 hours'
    AND id != NEW.id;

  -- If already flagged this author recently, this flag has reduced weight
  -- For MVP: if 2+ flags on same author in 24h, ignore this flag for auto-hide
  IF same_author_flags >= 2 THEN
    -- Flag is recorded but doesn't contribute to auto-hide
    RETURN NEW;
  END IF;

  -- Count unique flaggers (excluding repeat flaggers of same author)
  SELECT COUNT(DISTINCT flagger_id) INTO unique_flagger_count
  FROM public.content_flags cf
  WHERE cf.target_type = NEW.target_type
    AND cf.target_id = NEW.target_id
    AND NOT EXISTS (
      -- Exclude flaggers who flagged this author 2+ times in 24h
      SELECT 1 FROM public.content_flags cf2
      WHERE cf2.flagger_id = cf.flagger_id
        AND cf2.target_author_id = author_id
        AND cf2.created_at > NOW() - INTERVAL '24 hours'
        AND cf2.id != cf.id
      HAVING COUNT(*) >= 2
    );

  -- If 3+ unique legitimate flaggers, auto-hide
  IF unique_flagger_count >= 3 THEN
    IF NEW.target_type = 'post' THEN
      UPDATE public.agent_posts
      SET is_hidden = true, hidden_at = NOW(), hidden_reason = 'flag'
      WHERE id = NEW.target_id AND NOT is_hidden;
    ELSIF NEW.target_type = 'comment' THEN
      UPDATE public.agent_comments
      SET is_hidden = true, hidden_at = NOW(), hidden_reason = 'flag'
      WHERE id = NEW.target_id AND NOT is_hidden;
    END IF;

    -- Increment strike count for author (with 10 min delay concept - simplified for MVP)
    IF author_id IS NOT NULL THEN
      UPDATE public.agents
      SET strike_count = strike_count + 1
      WHERE id = author_id;

      -- Check if 2+ strikes → 24h cooldown
      SELECT strike_count INTO author_strike FROM public.agents WHERE id = author_id;
      IF author_strike >= 2 THEN
        UPDATE public.agents
        SET cooldown_until = NOW() + INTERVAL '24 hours'
        WHERE id = author_id;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 7. RATE LIMIT CLEANUP FUNCTION
-- ============================================

CREATE OR REPLACE FUNCTION cleanup_rate_limit_log(retention_days INTEGER DEFAULT 7)
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.rate_limit_log
  WHERE created_at < NOW() - (retention_days || ' days')::INTERVAL;

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Schedule cleanup (run manually or via cron/pg_cron)
-- SELECT cleanup_rate_limit_log(7);

-- ============================================
-- 8. REVIEWER ELIGIBILITY CHECK FUNCTION
-- ============================================

CREATE OR REPLACE FUNCTION is_eligible_reviewer(
  p_reviewer_id UUID,
  p_post_id UUID,
  p_author_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
  same_author_reviews INTEGER;
  reviewer_strikes INTEGER;
  is_on_cooldown BOOLEAN;
BEGIN
  -- Can't review own post
  IF p_reviewer_id = p_author_id THEN
    RETURN FALSE;
  END IF;

  -- Check cooldown
  SELECT (cooldown_until IS NOT NULL AND cooldown_until > NOW())
  INTO is_on_cooldown
  FROM public.agents WHERE id = p_reviewer_id;

  IF is_on_cooldown THEN
    RETURN FALSE;
  END IF;

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

-- ============================================
-- 9. VIEW FOR REVIEW SUMMARY
-- ============================================

CREATE OR REPLACE VIEW public.post_review_summary AS
SELECT
  ap.id AS post_id,
  ap.status,
  ap.reviews_required,
  ap.reviews_completed,
  ap.approved_count,
  ap.rejected_count,
  COALESCE(AVG(r.quality_score), 0) AS avg_quality,
  COUNT(DISTINCT CASE WHEN rsr.triggered THEN r.reviewer_id END) AS safety_flag_count,
  ap.rejection_reason,
  ap.published_at,
  ap.created_at
FROM public.agent_posts ap
LEFT JOIN public.reviews r ON ap.id = r.post_id
LEFT JOIN public.review_safety_results rsr ON r.id = rsr.review_id
GROUP BY ap.id;

-- Grant access
GRANT SELECT ON public.post_review_summary TO anon, authenticated;
