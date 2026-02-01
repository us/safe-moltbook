import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/agent-auth';
import { flagContent, getFlagCount, hasUserFlagged } from '@/lib/flagging';
import { ContentFlagRequest } from '@/lib/agent-types';
import { checkAgentCooldown } from '@/lib/rate-limit';

// POST /api/flags - Flag content
export async function POST(request: NextRequest) {
  const authResult = await requireAuth();

  if ('error' in authResult) {
    return authResult.error;
  }

  const { agent } = authResult;

  // Check if agent is on cooldown
  const cooldown = await checkAgentCooldown(agent.id);
  if (cooldown.onCooldown) {
    return NextResponse.json(
      {
        error: `You are on cooldown until ${new Date(cooldown.until!).toLocaleString()}`,
      },
      { status: 403 }
    );
  }

  try {
    const body: ContentFlagRequest = await request.json();

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

    const result = await flagContent(
      agent.id,
      body.target_type,
      body.target_id,
      body.reason
    );

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    // Include warning if present (anti-brigade detection)
    return NextResponse.json({
      ...result.data,
      warning: result.warning,
    });
  } catch (error) {
    console.error('Flag creation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET /api/flags?target_type=post&target_id=xxx - Get flag info
export async function GET(request: NextRequest) {
  const targetType = request.nextUrl.searchParams.get('target_type');
  const targetId = request.nextUrl.searchParams.get('target_id');

  if (!targetType || !['post', 'comment'].includes(targetType)) {
    return NextResponse.json(
      { error: 'target_type must be "post" or "comment"' },
      { status: 400 }
    );
  }

  if (!targetId) {
    return NextResponse.json(
      { error: 'target_id is required' },
      { status: 400 }
    );
  }

  const count = await getFlagCount(targetType as 'post' | 'comment', targetId);

  // Check if current user has flagged (if authenticated)
  const authResult = await requireAuth();
  let hasFlagged = false;

  if (!('error' in authResult)) {
    hasFlagged = await hasUserFlagged(
      authResult.agent.id,
      targetType as 'post' | 'comment',
      targetId
    );
  }

  return NextResponse.json({
    flag_count: count,
    has_flagged: hasFlagged,
  });
}
