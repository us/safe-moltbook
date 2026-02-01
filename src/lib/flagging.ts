import { createClient } from '@supabase/supabase-js';
import { CONFIG } from './config';
import { ContentFlag, ContentFlagResponse, FlagTargetType } from './agent-types';
import { checkRateLimit, logAction } from './rate-limit';

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, serviceKey);
}

export async function flagContent(
  flaggerId: string,
  targetType: FlagTargetType,
  targetId: string,
  reason?: string
): Promise<{ success: boolean; error?: string; data?: ContentFlagResponse; warning?: string }> {
  const supabase = getServiceClient();

  // Check rate limit
  const rateLimit = await checkRateLimit(flaggerId, 'flag');
  if (!rateLimit.allowed) {
    return {
      success: false,
      error: `Rate limit exceeded. Try again in ${Math.ceil((rateLimit.retryAfter || 0) / 60)} minutes.`,
    };
  }

  // Check if already flagged by this user
  const { data: existing } = await supabase
    .from('content_flags')
    .select('id')
    .eq('target_type', targetType)
    .eq('target_id', targetId)
    .eq('flagger_id', flaggerId)
    .single();

  if (existing) {
    return { success: false, error: 'You have already flagged this content' };
  }

  // Get target author
  let authorId: string | null = null;

  if (targetType === 'post') {
    const { data: post, error } = await supabase
      .from('agent_posts')
      .select('id, author_id')
      .eq('id', targetId)
      .single();

    if (error || !post) {
      return { success: false, error: 'Post not found' };
    }

    // Cannot flag own content
    if (post.author_id === flaggerId) {
      return { success: false, error: 'Cannot flag your own content' };
    }

    authorId = post.author_id;
  } else if (targetType === 'comment') {
    const { data: comment, error } = await supabase
      .from('agent_comments')
      .select('id, author_id')
      .eq('id', targetId)
      .single();

    if (error || !comment) {
      return { success: false, error: 'Comment not found' };
    }

    // Cannot flag own content
    if (comment.author_id === flaggerId) {
      return { success: false, error: 'Cannot flag your own content' };
    }

    authorId = comment.author_id;
  }

  // Anti-brigade check: Did this flagger flag this author too many times in 24h?
  let isBrigading = false;
  if (authorId) {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { count: sameAuthorFlags } = await supabase
      .from('content_flags')
      .select('*', { count: 'exact', head: true })
      .eq('flagger_id', flaggerId)
      .eq('target_author_id', authorId)
      .gte('created_at', oneDayAgo);

    // If flagger has flagged this author 2+ times in 24h, mark as brigading
    if ((sameAuthorFlags || 0) >= 2) {
      isBrigading = true;
    }
  }

  // Validate reason enum
  const validReasons = ['spam', 'harassment', 'pii', 'violence', 'other'];
  const normalizedReason = reason && validReasons.includes(reason) ? reason : null;

  // Create the flag with author_id for anti-brigade tracking
  const { error: insertError } = await supabase.from('content_flags').insert({
    target_type: targetType,
    target_id: targetId,
    flagger_id: flaggerId,
    target_author_id: authorId,
    reason: normalizedReason,
  });

  if (insertError) {
    console.error('Error creating flag:', insertError);
    return { success: false, error: 'Failed to create flag' };
  }

  // Log the action for rate limiting
  await logAction(flaggerId, 'flag');

  // Get flag count (DB trigger handles auto-hide with anti-brigade logic)
  const { count } = await supabase
    .from('content_flags')
    .select('*', { count: 'exact', head: true })
    .eq('target_type', targetType)
    .eq('target_id', targetId);

  const flagCount = count || 1;

  // Check if auto-hidden (query the target)
  let autoHidden = false;
  if (targetType === 'post') {
    const { data: post } = await supabase
      .from('agent_posts')
      .select('is_hidden')
      .eq('id', targetId)
      .single();
    autoHidden = post?.is_hidden || false;
  } else {
    const { data: comment } = await supabase
      .from('agent_comments')
      .select('is_hidden')
      .eq('id', targetId)
      .single();
    autoHidden = comment?.is_hidden || false;
  }

  return {
    success: true,
    data: {
      success: true,
      flag_count: flagCount,
      auto_hidden: autoHidden,
    },
    warning: isBrigading
      ? 'Your flag was recorded but has reduced weight due to multiple flags on the same author.'
      : undefined,
  };
}

export async function getContentFlags(
  targetType: FlagTargetType,
  targetId: string
): Promise<ContentFlag[]> {
  const supabase = getServiceClient();

  const { data, error } = await supabase
    .from('content_flags')
    .select('*')
    .eq('target_type', targetType)
    .eq('target_id', targetId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching flags:', error);
    return [];
  }

  return data as ContentFlag[];
}

export async function getFlagCount(
  targetType: FlagTargetType,
  targetId: string
): Promise<number> {
  const supabase = getServiceClient();

  const { count, error } = await supabase
    .from('content_flags')
    .select('*', { count: 'exact', head: true })
    .eq('target_type', targetType)
    .eq('target_id', targetId);

  if (error) {
    console.error('Error counting flags:', error);
    return 0;
  }

  return count || 0;
}

export async function hasUserFlagged(
  flaggerId: string,
  targetType: FlagTargetType,
  targetId: string
): Promise<boolean> {
  const supabase = getServiceClient();

  const { data } = await supabase
    .from('content_flags')
    .select('id')
    .eq('target_type', targetType)
    .eq('target_id', targetId)
    .eq('flagger_id', flaggerId)
    .single();

  return !!data;
}
