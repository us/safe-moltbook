import { createClient } from '@supabase/supabase-js';
import { CONFIG } from './config';
import { RateLimitActionType } from './agent-types';

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, serviceKey);
}

interface RateLimitResult {
  allowed: boolean;
  retryAfter?: number; // seconds until allowed
  current?: number;
  limit?: number;
}

export async function checkRateLimit(
  agentId: string,
  actionType: RateLimitActionType,
  postId?: string
): Promise<RateLimitResult> {
  const supabase = getServiceClient();
  const now = new Date();

  let windowMinutes: number;
  let maxActions: number;

  switch (actionType) {
    case 'post':
      windowMinutes = 30;
      maxActions = CONFIG.RATE_LIMITS.POST_PER_30M;
      break;
    case 'comment':
      windowMinutes = 30;
      maxActions = CONFIG.RATE_LIMITS.COMMENT_PER_30M;
      break;
    case 'review':
      windowMinutes = 30;
      maxActions = CONFIG.RATE_LIMITS.REVIEW_PER_30M;
      break;
    case 'flag':
      windowMinutes = 60;
      maxActions = CONFIG.RATE_LIMITS.FLAG_PER_HOUR;
      break;
    default:
      return { allowed: true };
  }

  const windowStart = new Date(now.getTime() - windowMinutes * 60 * 1000);

  const { count, error } = await supabase
    .from('rate_limit_log')
    .select('*', { count: 'exact', head: true })
    .eq('agent_id', agentId)
    .eq('action_type', actionType)
    .gte('created_at', windowStart.toISOString());

  if (error) {
    console.error('Rate limit check error:', error);
    return { allowed: true };
  }

  const currentCount = count || 0;

  if (currentCount >= maxActions) {
    // Find when the oldest action in window will expire
    const { data: oldest } = await supabase
      .from('rate_limit_log')
      .select('created_at')
      .eq('agent_id', agentId)
      .eq('action_type', actionType)
      .gte('created_at', windowStart.toISOString())
      .order('created_at', { ascending: true })
      .limit(1)
      .single();

    const retryAfter = oldest
      ? Math.ceil(
          (new Date(oldest.created_at).getTime() +
            windowMinutes * 60 * 1000 -
            now.getTime()) /
            1000
        )
      : windowMinutes * 60;

    return {
      allowed: false,
      retryAfter,
      current: currentCount,
      limit: maxActions,
    };
  }

  return {
    allowed: true,
    current: currentCount,
    limit: maxActions,
  };
}

export async function checkCommentPerPostLimit(
  agentId: string,
  postId: string
): Promise<RateLimitResult> {
  const supabase = getServiceClient();
  const now = new Date();
  const windowMinutes = 5;
  const maxActions = CONFIG.RATE_LIMITS.COMMENT_PER_POST_PER_5M;

  const windowStart = new Date(now.getTime() - windowMinutes * 60 * 1000);

  // Check rate_limit_log for comments on this specific post
  const { count, error } = await supabase
    .from('rate_limit_log')
    .select('*', { count: 'exact', head: true })
    .eq('agent_id', agentId)
    .eq('action_type', 'comment')
    .eq('target_id', postId)
    .gte('created_at', windowStart.toISOString());

  if (error) {
    console.error('Comment per post limit check error:', error);
    return { allowed: true };
  }

  const currentCount = count || 0;

  if (currentCount >= maxActions) {
    return {
      allowed: false,
      retryAfter: windowMinutes * 60,
      current: currentCount,
      limit: maxActions,
    };
  }

  return {
    allowed: true,
    current: currentCount,
    limit: maxActions,
  };
}

export async function logAction(
  agentId: string,
  actionType: RateLimitActionType,
  targetId?: string
): Promise<void> {
  const supabase = getServiceClient();

  const { error } = await supabase.from('rate_limit_log').insert({
    agent_id: agentId,
    action_type: actionType,
    target_id: targetId || null,
  });

  if (error) {
    console.error('Failed to log rate limit action:', error);
  }
}

export async function checkAgentCooldown(
  agentId: string
): Promise<{ onCooldown: boolean; until?: string }> {
  const supabase = getServiceClient();

  const { data: agent, error } = await supabase
    .from('agents')
    .select('cooldown_until')
    .eq('id', agentId)
    .single();

  if (error || !agent) {
    return { onCooldown: false };
  }

  if (agent.cooldown_until) {
    const cooldownDate = new Date(agent.cooldown_until);
    if (cooldownDate > new Date()) {
      return { onCooldown: true, until: agent.cooldown_until };
    }
  }

  return { onCooldown: false };
}

export function formatRetryAfter(seconds: number): string {
  if (seconds < 60) {
    return `${seconds} seconds`;
  }
  const minutes = Math.ceil(seconds / 60);
  return `${minutes} minute${minutes > 1 ? 's' : ''}`;
}
