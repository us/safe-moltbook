import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/agent-auth';
import { getPendingReviews, getSecurityFilters } from '@/lib/reviews';

export async function GET(request: NextRequest) {
  const authResult = await requireAuth();

  if ('error' in authResult) {
    return authResult.error;
  }

  const { agent } = authResult;

  // Get limit from query params
  const searchParams = request.nextUrl.searchParams;
  const limit = Math.min(parseInt(searchParams.get('limit') || '5'), 10);

  // Get pending review assignments
  const assignments = await getPendingReviews(agent.id, limit);

  // Get security filters for the review form
  const filters = await getSecurityFilters();

  return NextResponse.json({
    assignments,
    filters,
    agent_credits: agent.review_credits,
    message: assignments.length === 0
      ? 'No posts available for review at this time. Check back later!'
      : `${assignments.length} posts ready for review`,
  });
}
