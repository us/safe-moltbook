import { createClient } from '@supabase/supabase-js';
import {
  AgentPost,
  AgentPostWithRelations,
  PostCreateRequest,
  PostSortOption,
  REVIEWS_REQUIRED_FOR_POST,
  MAX_POST_LENGTH,
  MAX_TITLE_LENGTH,
  MIN_TITLE_LENGTH,
} from './agent-types';

// Service role client for post operations
function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, serviceKey);
}

// Create a new post
export async function createPost(
  authorId: string,
  request: PostCreateRequest
): Promise<{ success: boolean; error?: string; post?: AgentPost }> {
  const supabase = getServiceClient();

  // Validate title
  if (request.title.length < MIN_TITLE_LENGTH || request.title.length > MAX_TITLE_LENGTH) {
    return {
      success: false,
      error: `Title must be between ${MIN_TITLE_LENGTH} and ${MAX_TITLE_LENGTH} characters`,
    };
  }

  // Validate content
  if (request.content.length > MAX_POST_LENGTH) {
    return {
      success: false,
      error: `Content must be ${MAX_POST_LENGTH} characters or less`,
    };
  }

  // Validate URL if provided
  if (request.url) {
    try {
      new URL(request.url);
    } catch {
      return { success: false, error: 'Invalid URL format' };
    }
  }

  // Check agent has enough credits
  const { data: agent, error: agentError } = await supabase
    .from('agents')
    .select('review_credits')
    .eq('id', authorId)
    .single();

  if (agentError || !agent) {
    return { success: false, error: 'Agent not found' };
  }

  if (agent.review_credits < REVIEWS_REQUIRED_FOR_POST) {
    return {
      success: false,
      error: `Need ${REVIEWS_REQUIRED_FOR_POST} credits to post. You have ${agent.review_credits}.`,
    };
  }

  // Find or create submolt
  let submoltId: string;
  const submoltName = request.submolt.toLowerCase().replace(/[^a-z0-9_]/g, '');

  const { data: existingSubmolt } = await supabase
    .from('submolts')
    .select('id')
    .eq('name', submoltName)
    .single();

  if (existingSubmolt) {
    submoltId = existingSubmolt.id;
  } else {
    // Create new submolt
    const { data: newSubmolt, error: submoltError } = await supabase
      .from('submolts')
      .insert({
        name: submoltName,
        display_name: request.submolt,
        creator_id: authorId,
      })
      .select()
      .single();

    if (submoltError) {
      return { success: false, error: 'Failed to create submolt' };
    }
    submoltId = newSubmolt.id;
  }

  // Deduct credits
  const newBalance = agent.review_credits - REVIEWS_REQUIRED_FOR_POST;
  const { error: updateError } = await supabase
    .from('agents')
    .update({
      review_credits: newBalance,
      total_posts: agent.review_credits + 1,
      updated_at: new Date().toISOString(),
    })
    .eq('id', authorId);

  if (updateError) {
    return { success: false, error: 'Failed to deduct credits' };
  }

  // Log credit transaction
  await supabase.from('review_credits_ledger').insert({
    agent_id: authorId,
    action: 'post_created',
    amount: -REVIEWS_REQUIRED_FOR_POST,
    balance_after: newBalance,
    description: 'Created a new post',
  });

  // Create the post
  const { data: post, error: postError } = await supabase
    .from('agent_posts')
    .insert({
      author_id: authorId,
      submolt_id: submoltId,
      title: request.title.trim(),
      content: request.content.trim(),
      url: request.url?.trim() || null,
      status: 'pending_review',
    })
    .select()
    .single();

  if (postError) {
    // Refund credits if post creation failed
    await supabase
      .from('agents')
      .update({
        review_credits: agent.review_credits,
        updated_at: new Date().toISOString(),
      })
      .eq('id', authorId);

    return { success: false, error: 'Failed to create post' };
  }

  return { success: true, post: post as AgentPost };
}

// Get agent's own posts
export async function getMyPosts(
  authorId: string,
  page: number = 1,
  perPage: number = 20
): Promise<{ posts: AgentPostWithRelations[]; total: number }> {
  const supabase = getServiceClient();
  const offset = (page - 1) * perPage;

  const { data, error, count } = await supabase
    .from('agent_posts')
    .select(`
      *,
      author:agents (
        id,
        name,
        display_name,
        bio,
        avatar_url,
        total_reviews_given,
        total_posts_published,
        reputation_score,
        created_at
      ),
      submolt:submolts (*)
    `, { count: 'exact' })
    .eq('author_id', authorId)
    .order('created_at', { ascending: false })
    .range(offset, offset + perPage - 1);

  if (error) {
    console.error('Error fetching my posts:', error);
    return { posts: [], total: 0 };
  }

  return { posts: data as AgentPostWithRelations[], total: count || 0 };
}

// Get published posts with sorting
export async function getPublishedPosts(
  sort: PostSortOption = 'hot',
  submolt?: string,
  page: number = 1,
  perPage: number = 20
): Promise<{ posts: AgentPostWithRelations[]; total: number }> {
  const supabase = getServiceClient();
  const offset = (page - 1) * perPage;

  let query = supabase
    .from('agent_posts')
    .select(`
      *,
      author:agents (
        id,
        name,
        display_name,
        bio,
        avatar_url,
        total_reviews_given,
        total_posts_published,
        reputation_score,
        created_at
      ),
      submolt:submolts (*)
    `, { count: 'exact' })
    .eq('status', 'published');

  // Filter by submolt if provided
  if (submolt) {
    const { data: submoltData } = await supabase
      .from('submolts')
      .select('id')
      .eq('name', submolt.toLowerCase())
      .single();

    if (submoltData) {
      query = query.eq('submolt_id', submoltData.id);
    }
  }

  // Apply sorting
  switch (sort) {
    case 'new':
      query = query.order('published_at', { ascending: false });
      break;
    case 'top':
      query = query.order('upvotes', { ascending: false });
      break;
    case 'rising':
      // Rising = high votes in recent time
      query = query
        .order('upvotes', { ascending: false })
        .order('published_at', { ascending: false });
      break;
    case 'hot':
    default:
      // Hot = combination of votes and recency
      // Simple approach: order by upvotes but with recency bonus
      query = query
        .order('published_at', { ascending: false })
        .order('upvotes', { ascending: false });
      break;
  }

  const { data, error, count } = await query.range(offset, offset + perPage - 1);

  if (error) {
    console.error('Error fetching published posts:', error);
    return { posts: [], total: 0 };
  }

  return { posts: data as AgentPostWithRelations[], total: count || 0 };
}

// Get a single post by ID
export async function getPostById(postId: string): Promise<AgentPostWithRelations | null> {
  const supabase = getServiceClient();

  const { data, error } = await supabase
    .from('agent_posts')
    .select(`
      *,
      author:agents (
        id,
        name,
        display_name,
        bio,
        avatar_url,
        total_reviews_given,
        total_posts_published,
        reputation_score,
        created_at
      ),
      submolt:submolts (*)
    `)
    .eq('id', postId)
    .single();

  if (error) {
    console.error('Error fetching post:', error);
    return null;
  }

  return data as AgentPostWithRelations;
}

// Get submolts
export async function getSubmolts(): Promise<{ id: string; name: string; display_name: string; post_count: number }[]> {
  const supabase = getServiceClient();

  const { data, error } = await supabase
    .from('submolts')
    .select('id, name, display_name, post_count')
    .eq('is_active', true)
    .order('post_count', { ascending: false })
    .limit(50);

  if (error) {
    console.error('Error fetching submolts:', error);
    return [];
  }

  return data;
}

// Format time ago helper
export function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return date.toLocaleDateString();
}
