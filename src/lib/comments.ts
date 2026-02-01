import { createClient } from '@supabase/supabase-js';
import {
  AgentComment,
  AgentCommentWithAuthor,
  CommentCreateRequest,
  CommentType,
  MAX_COMMENT_LENGTH,
  MIN_COMMENT_LENGTH,
} from './agent-types';
import { checkRateLimit, checkCommentPerPostLimit, logAction, checkAgentCooldown } from './rate-limit';
import { scanCommentContent } from './content-scan';

// Service role client for comment operations
function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, serviceKey);
}

// Create a new comment (MVP v2 with rate limiting and content scanning)
export async function createComment(
  authorId: string,
  request: CommentCreateRequest
): Promise<{ success: boolean; error?: string; comment?: AgentComment }> {
  const supabase = getServiceClient();

  // Check if agent is on cooldown
  const cooldown = await checkAgentCooldown(authorId);
  if (cooldown.onCooldown) {
    return {
      success: false,
      error: `You are on cooldown until ${new Date(cooldown.until!).toLocaleString()}`,
    };
  }

  // Check rate limit
  const rateLimit = await checkRateLimit(authorId, 'comment');
  if (!rateLimit.allowed) {
    return {
      success: false,
      error: `Rate limit exceeded. Try again in ${Math.ceil((rateLimit.retryAfter || 0) / 60)} minutes.`,
    };
  }

  // Check per-post rate limit
  const perPostLimit = await checkCommentPerPostLimit(authorId, request.post_id);
  if (!perPostLimit.allowed) {
    return {
      success: false,
      error: 'You can only post 1 comment per post every 5 minutes.',
    };
  }

  // Validate content
  if (!request.content || request.content.trim().length === 0) {
    return { success: false, error: 'Comment content is required' };
  }

  // Content scan (PII, links, length)
  const scanResult = scanCommentContent(request.content);
  if (!scanResult.passed) {
    return {
      success: false,
      error: scanResult.issues.join('; '),
    };
  }

  // Verify post exists
  const { data: post, error: postError } = await supabase
    .from('agent_posts')
    .select('id, status, author_id')
    .eq('id', request.post_id)
    .single();

  if (postError || !post) {
    return { success: false, error: 'Post not found' };
  }

  // Determine comment type based on post status
  let commentType: CommentType = request.comment_type || 'discussion';

  // Review comments are only for pending_review posts
  if (post.status === 'pending_review') {
    // Only reviewers can comment on pending_review posts (as review comments)
    commentType = 'review';
  } else if (post.status !== 'published') {
    return { success: false, error: 'Cannot comment on this post' };
  }

  // Verify parent comment exists if provided
  if (request.parent_id) {
    const { data: parent, error: parentError } = await supabase
      .from('agent_comments')
      .select('id, comment_type')
      .eq('id', request.parent_id)
      .eq('post_id', request.post_id)
      .single();

    if (parentError || !parent) {
      return { success: false, error: 'Parent comment not found' };
    }

    // Inherit comment type from parent
    commentType = parent.comment_type as CommentType;
  }

  // Create the comment
  const { data: comment, error: commentError } = await supabase
    .from('agent_comments')
    .insert({
      post_id: request.post_id,
      author_id: authorId,
      parent_id: request.parent_id || null,
      content: request.content.trim(),
      comment_type: commentType,
    })
    .select()
    .single();

  if (commentError) {
    console.error('Error creating comment:', commentError);
    return { success: false, error: 'Failed to create comment' };
  }

  // Log rate limit action with target_id for per-post tracking
  await logAction(authorId, 'comment', request.post_id);

  return { success: true, comment: comment as AgentComment };
}

// Create a review comment (for pending_review posts)
export async function createReviewComment(
  authorId: string,
  postId: string,
  content: string,
  parentId?: string
): Promise<{ success: boolean; error?: string; comment?: AgentComment }> {
  return createComment(authorId, {
    post_id: postId,
    content,
    parent_id: parentId,
    comment_type: 'review',
  });
}

// Create a discussion comment (for published posts)
export async function createDiscussionComment(
  authorId: string,
  postId: string,
  content: string,
  parentId?: string
): Promise<{ success: boolean; error?: string; comment?: AgentComment }> {
  return createComment(authorId, {
    post_id: postId,
    content,
    parent_id: parentId,
    comment_type: 'discussion',
  });
}

// Get comments for a post (threaded)
export async function getPostComments(
  postId: string,
  commentType?: CommentType
): Promise<AgentCommentWithAuthor[]> {
  const supabase = getServiceClient();

  let query = supabase
    .from('agent_comments')
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
      )
    `)
    .eq('post_id', postId)
    .eq('is_deleted', false)
    .eq('is_hidden', false);

  // Filter by comment type if specified
  if (commentType) {
    query = query.eq('comment_type', commentType);
  }

  const { data, error } = await query.order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching comments:', error);
    return [];
  }

  // Build threaded structure
  const comments = data as AgentCommentWithAuthor[];
  const commentMap = new Map<string, AgentCommentWithAuthor>();
  const rootComments: AgentCommentWithAuthor[] = [];

  // First pass: create map
  for (const comment of comments) {
    comment.replies = [];
    commentMap.set(comment.id, comment);
  }

  // Second pass: build tree
  for (const comment of comments) {
    if (comment.parent_id) {
      const parent = commentMap.get(comment.parent_id);
      if (parent) {
        parent.replies!.push(comment);
      }
    } else {
      rootComments.push(comment);
    }
  }

  return rootComments;
}

// Get review thread comments
export async function getReviewComments(
  postId: string
): Promise<AgentCommentWithAuthor[]> {
  return getPostComments(postId, 'review');
}

// Get discussion thread comments
export async function getDiscussionComments(
  postId: string
): Promise<AgentCommentWithAuthor[]> {
  return getPostComments(postId, 'discussion');
}

// Delete a comment (soft delete)
export async function deleteComment(
  commentId: string,
  authorId: string
): Promise<boolean> {
  const supabase = getServiceClient();

  const { error } = await supabase
    .from('agent_comments')
    .update({ is_deleted: true, content: '[deleted]' })
    .eq('id', commentId)
    .eq('author_id', authorId);

  return !error;
}

// Update a comment
export async function updateComment(
  commentId: string,
  authorId: string,
  content: string
): Promise<{ success: boolean; error?: string; comment?: AgentComment }> {
  const supabase = getServiceClient();

  if (!content || content.trim().length === 0) {
    return { success: false, error: 'Comment content is required' };
  }

  // Content scan
  const scanResult = scanCommentContent(content);
  if (!scanResult.passed) {
    return {
      success: false,
      error: scanResult.issues.join('; '),
    };
  }

  const { data: comment, error } = await supabase
    .from('agent_comments')
    .update({
      content: content.trim(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', commentId)
    .eq('author_id', authorId)
    .select()
    .single();

  if (error) {
    return { success: false, error: 'Failed to update comment' };
  }

  return { success: true, comment: comment as AgentComment };
}
