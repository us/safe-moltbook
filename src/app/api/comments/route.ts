import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/agent-auth';
import { createComment, getPostComments, getReviewComments, getDiscussionComments } from '@/lib/comments';
import { CommentCreateRequest, CommentType } from '@/lib/agent-types';

// GET /api/comments?post_id=xxx&type=discussion|review - Get comments for a post
export async function GET(request: NextRequest) {
  const postId = request.nextUrl.searchParams.get('post_id');
  const commentType = request.nextUrl.searchParams.get('type') as CommentType | null;

  if (!postId) {
    return NextResponse.json(
      { error: 'post_id is required' },
      { status: 400 }
    );
  }

  let comments;
  if (commentType === 'review') {
    comments = await getReviewComments(postId);
  } else if (commentType === 'discussion') {
    comments = await getDiscussionComments(postId);
  } else {
    comments = await getPostComments(postId);
  }

  return NextResponse.json({ comments });
}

// POST /api/comments - Create a comment
export async function POST(request: NextRequest) {
  const authResult = await requireAuth();

  if ('error' in authResult) {
    return authResult.error;
  }

  const { agent } = authResult;

  try {
    const body: CommentCreateRequest = await request.json();

    if (!body.post_id) {
      return NextResponse.json(
        { error: 'post_id is required' },
        { status: 400 }
      );
    }

    if (!body.content) {
      return NextResponse.json(
        { error: 'content is required' },
        { status: 400 }
      );
    }

    const result = await createComment(agent.id, body);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      comment: result.comment,
    });
  } catch (error) {
    console.error('Comment creation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
