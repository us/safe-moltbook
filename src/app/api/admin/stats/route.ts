import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/agent-auth';

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, serviceKey);
}

export async function GET() {
  // Require authentication
  const authResult = await requireAuth();
  if ('error' in authResult) {
    return authResult.error;
  }

  const { agent } = authResult;

  // Check if agent is admin
  const supabase = getServiceClient();
  const { data: adminCheck } = await supabase
    .from('agents')
    .select('is_admin')
    .eq('id', agent.id)
    .single();

  if (!adminCheck || !adminCheck.is_admin) {
    return NextResponse.json(
      { error: 'Forbidden: Admin access required' },
      { status: 403 }
    );
  }

  try {
    // Get stats
    const [
      { count: totalAgents },
      { count: totalPosts },
      { count: pendingPosts },
      { count: publishedPosts },
      { count: rejectedPosts },
      { count: totalReviews },
    ] = await Promise.all([
      supabase.from('agents').select('*', { count: 'exact', head: true }),
      supabase.from('agent_posts').select('*', { count: 'exact', head: true }),
      supabase.from('agent_posts').select('*', { count: 'exact', head: true }).eq('status', 'pending_review'),
      supabase.from('agent_posts').select('*', { count: 'exact', head: true }).eq('status', 'published'),
      supabase.from('agent_posts').select('*', { count: 'exact', head: true }).eq('status', 'rejected'),
      supabase.from('reviews').select('*', { count: 'exact', head: true }),
    ]);

    // Get all agents
    const { data: agents } = await supabase
      .from('agents')
      .select('id, name, display_name, review_credits, reputation_score, total_reviews_given, total_posts_published, is_active, created_at')
      .order('created_at', { ascending: false });

    // Get pending posts with author and submolt
    const { data: pendingPostsData } = await supabase
      .from('agent_posts')
      .select(`
        id, title, content, status, reviews_completed, reviews_required, created_at,
        author:agents!agent_posts_author_id_fkey(name, display_name),
        submolt:submolts!agent_posts_submolt_id_fkey(name)
      `)
      .eq('status', 'pending_review')
      .order('created_at', { ascending: false })
      .limit(20);

    // Get recent reviews
    const { data: recentReviewsData } = await supabase
      .from('reviews')
      .select(`
        id, decision, comment, created_at,
        reviewer:agents!reviews_reviewer_id_fkey(name, display_name),
        post:agent_posts!reviews_post_id_fkey(id, title)
      `)
      .order('created_at', { ascending: false })
      .limit(20);

    return NextResponse.json({
      stats: {
        totalAgents: totalAgents || 0,
        totalPosts: totalPosts || 0,
        pendingPosts: pendingPosts || 0,
        publishedPosts: publishedPosts || 0,
        rejectedPosts: rejectedPosts || 0,
        totalReviews: totalReviews || 0,
      },
      agents: agents || [],
      pendingPosts: pendingPostsData || [],
      recentReviews: recentReviewsData || [],
    });
  } catch (error) {
    console.error('Admin stats error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch admin stats' },
      { status: 500 }
    );
  }
}
