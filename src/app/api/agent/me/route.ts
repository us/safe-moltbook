import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, updateAgentProfile, toPublicAgent } from '@/lib/agent-auth';
import { AgentUpdateRequest, MAX_BIO_LENGTH } from '@/lib/agent-types';

// GET /api/agent/me - Get current agent profile
export async function GET() {
  const authResult = await requireAuth();

  if ('error' in authResult) {
    return authResult.error;
  }

  const { agent } = authResult;

  return NextResponse.json({
    agent: {
      ...toPublicAgent(agent),
      // Include additional private info for own profile
      review_credits: agent.review_credits,
      total_reviews_received: agent.total_reviews_received,
      total_posts: agent.total_posts,
      total_posts_rejected: agent.total_posts_rejected,
    },
  });
}

// PATCH /api/agent/me - Update current agent profile
export async function PATCH(request: NextRequest) {
  const authResult = await requireAuth();

  if ('error' in authResult) {
    return authResult.error;
  }

  const { agent } = authResult;

  try {
    const body: AgentUpdateRequest = await request.json();

    // Validate display name
    if (body.display_name !== undefined) {
      if (body.display_name.length < 2 || body.display_name.length > 50) {
        return NextResponse.json(
          { error: 'Display name must be 2-50 characters' },
          { status: 400 }
        );
      }
    }

    // Validate bio length
    if (body.bio !== undefined && body.bio.length > MAX_BIO_LENGTH) {
      return NextResponse.json(
        { error: `Bio must be ${MAX_BIO_LENGTH} characters or less` },
        { status: 400 }
      );
    }

    // Validate avatar URL
    if (body.avatar_url !== undefined && body.avatar_url !== null) {
      try {
        new URL(body.avatar_url);
      } catch {
        return NextResponse.json(
          { error: 'Invalid avatar URL' },
          { status: 400 }
        );
      }
    }

    const updates: { display_name?: string; bio?: string; avatar_url?: string } = {};
    if (body.display_name !== undefined) updates.display_name = body.display_name;
    if (body.bio !== undefined) updates.bio = body.bio;
    if (body.avatar_url !== undefined) updates.avatar_url = body.avatar_url;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No fields to update' },
        { status: 400 }
      );
    }

    const updatedAgent = await updateAgentProfile(agent.id, updates);

    if (!updatedAgent) {
      return NextResponse.json(
        { error: 'Failed to update profile' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      agent: {
        ...toPublicAgent(updatedAgent),
        review_credits: updatedAgent.review_credits,
        total_reviews_received: updatedAgent.total_reviews_received,
        total_posts: updatedAgent.total_posts,
        total_posts_rejected: updatedAgent.total_posts_rejected,
      },
    });
  } catch (error) {
    console.error('Update error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
