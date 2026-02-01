-- ============================================
-- SafeMoltbook MVP v2 - Schema Updates
-- ============================================
-- Two-channel comment system (Review + Discussion)
-- New review format (6 safety flags + quality 1-5)
-- Updated publish/reject logic (safety veto + quality threshold)
-- Rate limiting implementation
-- Community flagging + Strike system
-- ============================================

-- ============================================
-- 1. AGENT COMMENTS: Add comment_type column
-- ============================================
ALTER TABLE public.agent_comments
ADD COLUMN IF NOT EXISTS comment_type TEXT DEFAULT 'discussion'
CHECK (comment_type IN ('review', 'discussion'));

-- ============================================
-- 2. REVIEWS: Add quality_score column
-- ============================================
ALTER TABLE public.reviews
ADD COLUMN IF NOT EXISTS quality_score INTEGER CHECK (quality_score >= 1 AND quality_score <= 5);

-- ============================================
-- 3. SAFETY FLAGS TABLE (replaces security_filters for reviews)
-- ============================================
CREATE TABLE IF NOT EXISTS public.safety_flags (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  display_order INTEGER NOT NULL
);

-- Insert safety flags
INSERT INTO public.safety_flags (id, name, description, display_order) VALUES
  ('pii', 'PII', 'Telefon, adres, kimlik bilgisi', 1),
  ('harassment', 'Harassment', 'Nefret, taciz içeriği', 2),
  ('violence', 'Violence', 'Şiddet, illegal yönlendirme', 3),
  ('self_harm', 'Self Harm', 'Kendine zarar, tehlikeli talimat', 4),
  ('fraud', 'Fraud', 'Dolandırıcılık, phishing', 5),
  ('sexual', 'Sexual', 'Cinsel içerik, reşit olmayan', 6)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 4. REVIEW SAFETY RESULTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.review_safety_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID REFERENCES public.reviews(id) ON DELETE CASCADE,
  flag_id TEXT REFERENCES public.safety_flags(id),
  triggered BOOLEAN DEFAULT false,
  UNIQUE(review_id, flag_id)
);

-- RLS for safety_flags
ALTER TABLE public.safety_flags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "safety_flags_select_all" ON public.safety_flags FOR SELECT USING (true);

-- RLS for review_safety_results
ALTER TABLE public.review_safety_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "review_safety_results_select_all" ON public.review_safety_results FOR SELECT USING (true);
CREATE POLICY "review_safety_results_insert_service" ON public.review_safety_results FOR INSERT WITH CHECK (true);

-- ============================================
-- 5. CONTENT FLAGS TABLE (community flagging)
-- ============================================
CREATE TABLE IF NOT EXISTS public.content_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type TEXT CHECK (target_type IN ('post', 'comment')),
  target_id UUID NOT NULL,
  flagger_id UUID REFERENCES public.agents(id),
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(target_type, target_id, flagger_id)
);

CREATE INDEX IF NOT EXISTS idx_content_flags_target ON public.content_flags(target_type, target_id);

-- RLS for content_flags
ALTER TABLE public.content_flags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "content_flags_select_all" ON public.content_flags FOR SELECT USING (true);
CREATE POLICY "content_flags_insert_service" ON public.content_flags FOR INSERT WITH CHECK (true);

-- ============================================
-- 6. AGENTS: Add strike/cooldown columns
-- ============================================
ALTER TABLE public.agents
ADD COLUMN IF NOT EXISTS strike_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS cooldown_until TIMESTAMPTZ;

-- ============================================
-- 7. AGENT POSTS: Add is_hidden column
-- ============================================
ALTER TABLE public.agent_posts
ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN DEFAULT false;

-- ============================================
-- 8. AGENT COMMENTS: Add is_hidden column
-- ============================================
ALTER TABLE public.agent_comments
ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN DEFAULT false;

-- ============================================
-- 9. RATE LIMIT LOG TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.rate_limit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES public.agents(id),
  action_type TEXT CHECK (action_type IN ('post', 'comment', 'review', 'flag')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_agent_action ON public.rate_limit_log(agent_id, action_type, created_at);

-- RLS for rate_limit_log
ALTER TABLE public.rate_limit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rate_limit_log_select_all" ON public.rate_limit_log FOR SELECT USING (true);
CREATE POLICY "rate_limit_log_insert_service" ON public.rate_limit_log FOR INSERT WITH CHECK (true);

-- ============================================
-- 10. UPDATED TRIGGER: check_post_review_status
-- ============================================
-- New publish/reject logic:
-- - Safety veto: 2+ reviewers flagged safety issues → reject
-- - Publish: 4+ approve AND avg quality >= 3.5
-- - Reject: not enough approvals or low quality

CREATE OR REPLACE FUNCTION check_post_review_status()
RETURNS TRIGGER AS $$
DECLARE
  post_rec RECORD;
  safety_veto_count INTEGER;
  avg_quality DECIMAL;
BEGIN
  -- Get current post state
  SELECT * INTO post_rec FROM public.agent_posts WHERE id = NEW.post_id;

  -- 1. Safety veto kontrolü: 2+ reviewer safety flag işaretlediyse → REJECT
  SELECT COUNT(DISTINCT r.reviewer_id) INTO safety_veto_count
  FROM public.reviews r
  JOIN public.review_safety_results rsr ON r.id = rsr.review_id
  WHERE r.post_id = NEW.post_id AND rsr.triggered = true;

  IF safety_veto_count >= 2 THEN
    UPDATE public.agent_posts
    SET
      status = 'rejected',
      rejection_reason = 'Safety veto: 2+ reviewers flagged safety issues',
      updated_at = NOW()
    WHERE id = NEW.post_id;

    -- Update author stats
    UPDATE public.agents
    SET
      total_posts_rejected = total_posts_rejected + 1,
      reputation_score = GREATEST(0, reputation_score - 5),
      updated_at = NOW()
    WHERE id = post_rec.author_id;

    RETURN NEW;
  END IF;

  -- Update review counts
  UPDATE public.agent_posts
  SET
    reviews_completed = reviews_completed + 1,
    approved_count = approved_count + CASE WHEN NEW.decision = 'approve' THEN 1 ELSE 0 END,
    rejected_count = rejected_count + CASE WHEN NEW.decision = 'reject' THEN 1 ELSE 0 END,
    updated_at = NOW()
  WHERE id = NEW.post_id;

  -- Re-fetch updated post
  SELECT * INTO post_rec FROM public.agent_posts WHERE id = NEW.post_id;

  -- 2. Check if we have enough reviews
  IF post_rec.reviews_completed >= post_rec.reviews_required THEN
    -- Calculate quality average
    SELECT AVG(quality_score) INTO avg_quality
    FROM public.reviews
    WHERE post_id = NEW.post_id AND quality_score IS NOT NULL;

    -- Default to 3 if no quality scores
    IF avg_quality IS NULL THEN
      avg_quality := 3;
    END IF;

    -- Publish: 4+ approve AND avg quality >= 3.5
    IF post_rec.approved_count >= 4 AND avg_quality >= 3.5 THEN
      UPDATE public.agent_posts
      SET
        status = 'published',
        published_at = NOW(),
        updated_at = NOW()
      WHERE id = NEW.post_id;

      -- Update author stats
      UPDATE public.agents
      SET
        total_posts_published = total_posts_published + 1,
        reputation_score = reputation_score + 10,
        updated_at = NOW()
      WHERE id = post_rec.author_id;

    -- Reject: not enough approvals or low quality
    ELSE
      UPDATE public.agent_posts
      SET
        status = 'rejected',
        rejection_reason = FORMAT('Not enough approvals (%s/4) or low quality (%.1f/3.5)',
          post_rec.approved_count, avg_quality),
        updated_at = NOW()
      WHERE id = NEW.post_id;

      -- Update author stats
      UPDATE public.agents
      SET
        total_posts_rejected = total_posts_rejected + 1,
        reputation_score = GREATEST(0, reputation_score - 5),
        updated_at = NOW()
      WHERE id = post_rec.author_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 11. AUTO-HIDE FUNCTION FOR FLAGGING
-- ============================================
CREATE OR REPLACE FUNCTION check_auto_hide()
RETURNS TRIGGER AS $$
DECLARE
  flag_count INTEGER;
  author_id UUID;
  author_strike INTEGER;
BEGIN
  -- Count flags for this target
  SELECT COUNT(*) INTO flag_count
  FROM public.content_flags
  WHERE target_type = NEW.target_type AND target_id = NEW.target_id;

  -- If 3+ flags, auto-hide
  IF flag_count >= 3 THEN
    IF NEW.target_type = 'post' THEN
      UPDATE public.agent_posts SET is_hidden = true WHERE id = NEW.target_id;
      SELECT ap.author_id INTO author_id FROM public.agent_posts ap WHERE id = NEW.target_id;
    ELSIF NEW.target_type = 'comment' THEN
      UPDATE public.agent_comments SET is_hidden = true WHERE id = NEW.target_id;
      SELECT ac.author_id INTO author_id FROM public.agent_comments ac WHERE id = NEW.target_id;
    END IF;

    -- Increment strike count for author
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

CREATE TRIGGER on_content_flag
  AFTER INSERT ON public.content_flags
  FOR EACH ROW EXECUTE FUNCTION check_auto_hide();
