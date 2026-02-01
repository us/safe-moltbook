import { createClient } from '@supabase/supabase-js';
import { AgentPublic } from './agent-types';

// Service role client
function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, serviceKey);
}

// Get all agents (public info only)
export async function getAgents(
  sortBy: 'reputation' | 'reviews' | 'posts' | 'newest' = 'reputation',
  page: number = 1,
  perPage: number = 20
): Promise<{ agents: AgentPublic[]; total: number }> {
  const supabase = getServiceClient();
  const offset = (page - 1) * perPage;

  let query = supabase
    .from('agents')
    .select(`
      id,
      name,
      display_name,
      bio,
      avatar_url,
      total_reviews_given,
      total_posts_published,
      reputation_score,
      created_at
    `, { count: 'exact' })
    .eq('is_active', true);

  // Apply sorting
  switch (sortBy) {
    case 'reviews':
      query = query.order('total_reviews_given', { ascending: false });
      break;
    case 'posts':
      query = query.order('total_posts_published', { ascending: false });
      break;
    case 'newest':
      query = query.order('created_at', { ascending: false });
      break;
    case 'reputation':
    default:
      query = query.order('reputation_score', { ascending: false });
      break;
  }

  const { data, error, count } = await query.range(offset, offset + perPage - 1);

  if (error) {
    console.error('Error fetching agents:', error);
    return { agents: [], total: 0 };
  }

  return { agents: data as AgentPublic[], total: count || 0 };
}

// Get agent by name (public info only)
export async function getAgentPublicByName(name: string): Promise<AgentPublic | null> {
  const supabase = getServiceClient();

  const { data, error } = await supabase
    .from('agents')
    .select(`
      id,
      name,
      display_name,
      bio,
      avatar_url,
      total_reviews_given,
      total_posts_published,
      reputation_score,
      created_at
    `)
    .eq('name', name.toLowerCase())
    .eq('is_active', true)
    .single();

  if (error) {
    return null;
  }

  return data as AgentPublic;
}

// Get agent's published posts
export async function getAgentPosts(
  agentId: string,
  page: number = 1,
  perPage: number = 10
): Promise<{ posts: any[]; total: number }> {
  const supabase = getServiceClient();
  const offset = (page - 1) * perPage;

  const { data, error, count } = await supabase
    .from('agent_posts')
    .select(`
      id,
      title,
      content,
      upvotes,
      downvotes,
      comment_count,
      published_at,
      submolt:submolts (name, display_name)
    `, { count: 'exact' })
    .eq('author_id', agentId)
    .eq('status', 'published')
    .order('published_at', { ascending: false })
    .range(offset, offset + perPage - 1);

  if (error) {
    console.error('Error fetching agent posts:', error);
    return { posts: [], total: 0 };
  }

  return { posts: data || [], total: count || 0 };
}

// Get top agents (leaderboard)
export async function getLeaderboard(
  limit: number = 10
): Promise<AgentPublic[]> {
  const supabase = getServiceClient();

  const { data, error } = await supabase
    .from('agents')
    .select(`
      id,
      name,
      display_name,
      bio,
      avatar_url,
      total_reviews_given,
      total_posts_published,
      reputation_score,
      created_at
    `)
    .eq('is_active', true)
    .order('reputation_score', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching leaderboard:', error);
    return [];
  }

  return data as AgentPublic[];
}
