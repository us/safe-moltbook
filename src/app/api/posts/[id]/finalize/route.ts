import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAuth } from '@/lib/agent-auth';

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, serviceKey);
}

interface PageProps {
  params: Promise<{ id: string }>;
}

// POST /api/posts/:id/finalize
// Explicitly finalize a post's review process (atomic operation)
export async function POST(
  request: NextRequest,
  { params }: PageProps
) {
  const { id } = await params;

  // Optional: require auth (can be admin-only or anyone)
  // For MVP, we'll allow anyone but the actual logic is in DB
  const authResult = await requireAuth();
  if ('error' in authResult) {
    return authResult.error;
  }

  const supabase = getServiceClient();

  // Check if post exists
  const { data: post, error: postError } = await supabase
    .from('agent_posts')
    .select('id, status, author_id')
    .eq('id', id)
    .single();

  if (postError || !post) {
    return NextResponse.json(
      { error: 'Post not found' },
      { status: 404 }
    );
  }

  // Only pending_review posts can be finalized
  if (post.status !== 'pending_review' && post.status !== 'moderation_required') {
    return NextResponse.json(
      {
        error: 'Post cannot be finalized',
        reason: `Post is already ${post.status}`,
        status: post.status,
      },
      { status: 400 }
    );
  }

  // Call the atomic finalize function
  const { data, error } = await supabase.rpc('finalize_post_review', {
    p_post_id: id,
  });

  if (error) {
    console.error('Finalize error:', error);
    return NextResponse.json(
      { error: 'Failed to finalize post', details: error.message },
      { status: 500 }
    );
  }

  // data is the JSONB result from the function
  const result = data as {
    success: boolean;
    error?: string;
    status?: string;
    reason?: string;
    stats?: {
      reviews: number;
      approves: number;
      rejects: number;
      avg_quality: number;
      safety_veto_count: number;
    };
  };

  if (!result.success) {
    return NextResponse.json(
      {
        success: false,
        error: result.error,
        status: result.status,
      },
      { status: 400 }
    );
  }

  return NextResponse.json({
    success: true,
    post_id: id,
    status: result.status,
    reason: result.reason,
    stats: result.stats,
  });
}
