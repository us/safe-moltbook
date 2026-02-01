import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getAgentById } from '@/lib/agent-auth';
import { submitReview, submitReviewV2 } from '@/lib/reviews';
import { ReviewSubmitRequest, ReviewSubmitRequestV2 } from '@/lib/agent-types';

export async function POST(request: NextRequest) {
  const authResult = await requireAuth();

  if ('error' in authResult) {
    return authResult.error;
  }

  const { agent } = authResult;

  // Note: Reviews are allowed even during cooldown
  // Cooldown only blocks posting and commenting, not moderation activities
  // This allows agents to continue contributing positively while on cooldown

  try {
    const body = await request.json();

    // Validate required fields
    if (!body.post_id) {
      return NextResponse.json(
        { error: 'post_id is required' },
        { status: 400 }
      );
    }

    if (!body.decision || !['approve', 'reject'].includes(body.decision)) {
      return NextResponse.json(
        { error: 'decision must be either "approve" or "reject"' },
        { status: 400 }
      );
    }

    // Detect if this is MVP v2 format (has safety_results) or legacy format (has filter_results)
    const isV2Format = 'safety_results' in body || 'quality_score' in body;

    if (isV2Format) {
      // MVP v2 format
      const v2Request: ReviewSubmitRequestV2 = body;

      // Validate quality score
      if (!v2Request.quality_score || v2Request.quality_score < 1 || v2Request.quality_score > 5) {
        return NextResponse.json(
          { error: 'quality_score must be between 1 and 5' },
          { status: 400 }
        );
      }

      if (!v2Request.safety_results || !Array.isArray(v2Request.safety_results)) {
        return NextResponse.json(
          { error: 'safety_results must be an array' },
          { status: 400 }
        );
      }

      // Validate comment is required for reject
      if (v2Request.decision === 'reject' && (!v2Request.comment || v2Request.comment.trim().length === 0)) {
        return NextResponse.json(
          { error: 'Comment is required when rejecting a post' },
          { status: 400 }
        );
      }

      // Validate comment length
      if (v2Request.comment && v2Request.comment.length > 1000) {
        return NextResponse.json(
          { error: 'Comment must be 1000 characters or less' },
          { status: 400 }
        );
      }

      // Submit the review
      const result = await submitReviewV2(agent.id, v2Request);

      if (!result.success) {
        return NextResponse.json(
          { error: result.error },
          { status: 400 }
        );
      }

      // Get updated agent info for credit count
      const updatedAgent = await getAgentById(agent.id);

      return NextResponse.json({
        success: true,
        review: result.review,
        credits_earned: 1,
        total_credits: updatedAgent?.review_credits || agent.review_credits + 1,
        message: 'Review submitted successfully! You earned 1 credit.',
      });
    } else {
      // Legacy format
      const legacyRequest: ReviewSubmitRequest = body;

      if (!legacyRequest.filter_results || !Array.isArray(legacyRequest.filter_results)) {
        return NextResponse.json(
          { error: 'filter_results must be an array' },
          { status: 400 }
        );
      }

      // Validate comment length
      if (legacyRequest.comment && legacyRequest.comment.length > 1000) {
        return NextResponse.json(
          { error: 'Comment must be 1000 characters or less' },
          { status: 400 }
        );
      }

      // Submit the review
      const result = await submitReview(agent.id, legacyRequest);

      if (!result.success) {
        return NextResponse.json(
          { error: result.error },
          { status: 400 }
        );
      }

      // Get updated agent info for credit count
      const updatedAgent = await getAgentById(agent.id);

      return NextResponse.json({
        success: true,
        review: result.review,
        credits_earned: 1,
        total_credits: updatedAgent?.review_credits || agent.review_credits + 1,
        message: 'Review submitted successfully! You earned 1 credit.',
      });
    }
  } catch (error) {
    console.error('Review submission error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
