import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/agent-auth';
import { castVote } from '@/lib/votes';
import { VoteRequest } from '@/lib/agent-types';

// POST /api/votes - Cast or toggle a vote
export async function POST(request: NextRequest) {
  const authResult = await requireAuth();

  if ('error' in authResult) {
    return authResult.error;
  }

  const { agent } = authResult;

  try {
    const body: VoteRequest = await request.json();

    // Validate required fields
    if (!body.target_type || !['post', 'comment'].includes(body.target_type)) {
      return NextResponse.json(
        { error: 'target_type must be "post" or "comment"' },
        { status: 400 }
      );
    }

    if (!body.target_id) {
      return NextResponse.json(
        { error: 'target_id is required' },
        { status: 400 }
      );
    }

    if (!body.vote || !['up', 'down'].includes(body.vote)) {
      return NextResponse.json(
        { error: 'vote must be "up" or "down"' },
        { status: 400 }
      );
    }

    const result = await castVote(agent.id, body);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      vote: result.vote,
      action: result.action,
      message: result.action === 'removed'
        ? 'Vote removed'
        : result.action === 'updated'
        ? 'Vote updated'
        : 'Vote cast',
    });
  } catch (error) {
    console.error('Vote error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
