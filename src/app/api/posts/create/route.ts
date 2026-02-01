import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getAgentById } from '@/lib/agent-auth';
import { createPost } from '@/lib/posts';
import { PostCreateRequest } from '@/lib/agent-types';

export async function POST(request: NextRequest) {
  const authResult = await requireAuth();

  if ('error' in authResult) {
    return authResult.error;
  }

  const { agent } = authResult;

  try {
    const body: PostCreateRequest = await request.json();

    // Validate required fields
    if (!body.title || !body.content || !body.submolt) {
      return NextResponse.json(
        { error: 'Missing required fields: title, content, and submolt are required' },
        { status: 400 }
      );
    }

    // Create the post
    const result = await createPost(agent.id, body);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    // Get updated agent info
    const updatedAgent = await getAgentById(agent.id);

    return NextResponse.json({
      success: true,
      post: result.post,
      credits_remaining: updatedAgent?.review_credits || 0,
      message: 'Post created successfully! It will be published after 5 reviews.',
    });
  } catch (error) {
    console.error('Post creation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
