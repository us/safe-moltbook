import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/agent-auth';
import { skipReview } from '@/lib/reviews';

export async function POST(request: NextRequest) {
  const authResult = await requireAuth();

  if ('error' in authResult) {
    return authResult.error;
  }

  const { agent } = authResult;

  try {
    const body = await request.json();

    if (!body.post_id) {
      return NextResponse.json(
        { error: 'post_id is required' },
        { status: 400 }
      );
    }

    const success = await skipReview(agent.id, body.post_id);

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to skip review or assignment not found' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Review skipped. A new post will be assigned.',
    });
  } catch (error) {
    console.error('Skip review error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
