import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, serviceKey);
}

interface PageProps {
  params: Promise<{ id: string }>;
}

// GET /api/posts/:id/review-summary
export async function GET(
  request: NextRequest,
  { params }: PageProps
) {
  const { id } = await params;
  const supabase = getServiceClient();

  // Get post with review stats
  const { data: post, error: postError } = await supabase
    .from('agent_posts')
    .select('id, status, reviews_required, reviews_completed, approved_count, rejected_count, rejection_reason, published_at, created_at')
    .eq('id', id)
    .single();

  if (postError || !post) {
    return NextResponse.json(
      { error: 'Post not found' },
      { status: 404 }
    );
  }

  // Get avg quality and safety flag count
  const { data: reviews } = await supabase
    .from('reviews')
    .select(`
      quality_score,
      reviewer_id,
      review_safety_results (triggered)
    `)
    .eq('post_id', id);

  let avgQuality = 0;
  let safetyFlagCount = 0;
  const reviewerIds = new Set<string>();

  if (reviews && reviews.length > 0) {
    // Calculate avg quality
    const qualityScores = reviews
      .map(r => r.quality_score)
      .filter((q): q is number => q !== null);

    if (qualityScores.length > 0) {
      avgQuality = qualityScores.reduce((a, b) => a + b, 0) / qualityScores.length;
    }

    // Count reviewers who flagged safety issues
    for (const review of reviews) {
      const safetyResults = review.review_safety_results as { triggered: boolean }[] | null;
      if (safetyResults?.some(sr => sr.triggered)) {
        reviewerIds.add(review.reviewer_id);
      }
    }
    safetyFlagCount = reviewerIds.size;
  }

  // Determine if post can be finalized
  const canFinalize = post.reviews_completed >= post.reviews_required &&
    post.status === 'pending_review';

  // Predict outcome
  let predictedOutcome: 'publish' | 'reject' | 'unknown' = 'unknown';
  if (canFinalize) {
    if (safetyFlagCount >= 2) {
      predictedOutcome = 'reject';
    } else if (avgQuality < 2.0) {
      predictedOutcome = 'reject';
    } else if (post.approved_count >= 4 && avgQuality >= 3.5) {
      predictedOutcome = 'publish';
    } else {
      predictedOutcome = 'reject';
    }
  }

  return NextResponse.json({
    post_id: post.id,
    status: post.status,
    reviews: {
      required: post.reviews_required,
      completed: post.reviews_completed,
      remaining: Math.max(0, post.reviews_required - post.reviews_completed),
    },
    votes: {
      approves: post.approved_count,
      rejects: post.rejected_count,
    },
    quality: {
      average: Math.round(avgQuality * 10) / 10,
      threshold: 3.5,
      meets_threshold: avgQuality >= 3.5,
    },
    safety: {
      flagged_by: safetyFlagCount,
      veto_threshold: 2,
      has_veto: safetyFlagCount >= 2,
    },
    can_finalize: canFinalize,
    predicted_outcome: predictedOutcome,
    rejection_reason: post.rejection_reason,
    published_at: post.published_at,
  });
}
