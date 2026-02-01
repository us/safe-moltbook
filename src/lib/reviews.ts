import { createClient } from '@supabase/supabase-js';
import {
  AgentPost,
  AgentPostWithRelations,
  ReviewAssignment,
  ReviewAssignmentWithPost,
  Review,
  SecurityFilter,
  SafetyFlag,
  ReviewSubmitRequest,
  ReviewSubmitRequestV2,
  REVIEWS_REQUIRED_FOR_PUBLISH,
} from './agent-types';
import { checkRateLimit, logAction } from './rate-limit';
import { SAFETY_FLAGS } from './config';

// Service role client for review operations
function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, serviceKey);
}

// Get all security filters (legacy)
export async function getSecurityFilters(): Promise<SecurityFilter[]> {
  const supabase = getServiceClient();

  const { data, error } = await supabase
    .from('security_filters')
    .select('*')
    .eq('is_active', true)
    .order('display_order');

  if (error) {
    console.error('Error fetching security filters:', error);
    return [];
  }

  return data as SecurityFilter[];
}

// Get safety flags (MVP v2)
export async function getSafetyFlags(): Promise<SafetyFlag[]> {
  const supabase = getServiceClient();

  const { data, error } = await supabase
    .from('safety_flags')
    .select('*')
    .order('display_order');

  if (error) {
    console.error('Error fetching safety flags:', error);
    // Return hardcoded flags as fallback
    return SAFETY_FLAGS.map((f, i) => ({ ...f, display_order: i + 1 }));
  }

  return data as SafetyFlag[];
}

// Get pending review assignments for an agent
export async function getPendingReviews(
  agentId: string,
  limit: number = 5
): Promise<ReviewAssignmentWithPost[]> {
  const supabase = getServiceClient();

  // First, get or create assignments for the agent
  await ensureReviewAssignments(agentId, limit);

  // Fetch pending assignments with post details
  const { data: assignments, error } = await supabase
    .from('review_assignments')
    .select(`
      *,
      post:agent_posts (
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
      )
    `)
    .eq('reviewer_id', agentId)
    .eq('status', 'pending')
    .gt('expires_at', new Date().toISOString())
    .order('assigned_at')
    .limit(limit);

  if (error) {
    console.error('Error fetching pending reviews:', error);
    return [];
  }

  return assignments as ReviewAssignmentWithPost[];
}

// Check if agent is eligible to review a specific post
async function checkReviewerEligibility(
  supabase: ReturnType<typeof getServiceClient>,
  reviewerId: string,
  postId: string,
  authorId: string
): Promise<boolean> {
  // Basic check: can't review own post
  if (reviewerId === authorId) {
    return false;
  }

  // Try DB function for comprehensive check
  const { data, error } = await supabase.rpc('is_eligible_reviewer', {
    p_reviewer_id: reviewerId,
    p_post_id: postId,
    p_author_id: authorId,
  });

  if (error) {
    console.error('Eligibility check error (using fallback):', error);
    // Fallback: just allow if not own post
    // This is lenient but better than blocking all reviews
    return true;
  }

  return data as boolean;
}

// Ensure agent has enough review assignments
async function ensureReviewAssignments(
  agentId: string,
  targetCount: number
): Promise<void> {
  const supabase = getServiceClient();

  // Count current pending assignments
  const { count: currentCount } = await supabase
    .from('review_assignments')
    .select('*', { count: 'exact', head: true })
    .eq('reviewer_id', agentId)
    .eq('status', 'pending')
    .gt('expires_at', new Date().toISOString());

  const neededCount = targetCount - (currentCount || 0);
  if (neededCount <= 0) return;

  // Find authors we've reviewed too many times in 24h (same-author limit is 5)
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: recentReviews } = await supabase
    .from('reviews')
    .select('post_id')
    .eq('reviewer_id', agentId)
    .gte('created_at', twentyFourHoursAgo);

  const blockedAuthorIds: string[] = [];
  if (recentReviews && recentReviews.length > 0) {
    const reviewedPostIds = recentReviews.map(r => r.post_id);
    const { data: reviewedPosts } = await supabase
      .from('agent_posts')
      .select('author_id')
      .in('id', reviewedPostIds);

    // Count reviews per author
    const authorCounts: Record<string, number> = {};
    reviewedPosts?.forEach(p => {
      authorCounts[p.author_id] = (authorCounts[p.author_id] || 0) + 1;
    });

    // Block authors with 5+ reviews
    Object.entries(authorCounts).forEach(([authorId, count]) => {
      if (count >= 5) blockedAuthorIds.push(authorId);
    });
  }

  // Get posts pending review, excluding blocked authors
  let query = supabase
    .from('agent_posts')
    .select('id, author_id')
    .eq('status', 'pending_review')
    .neq('author_id', agentId)
    .lt('reviews_completed', REVIEWS_REQUIRED_FOR_PUBLISH);

  // Exclude blocked authors if any
  if (blockedAuthorIds.length > 0) {
    // Use NOT IN by filtering client-side since Supabase doesn't have direct NOT IN
    // We'll filter after fetching
  }

  const { data: allPosts, error: postsError } = await query.limit(100);

  // Filter out blocked authors client-side
  const allEligiblePosts = allPosts?.filter(
    p => !blockedAuthorIds.includes(p.author_id)
  ) || [];

  if (postsError || !allEligiblePosts?.length) {
    return;
  }

  // Shuffle for random selection
  const shuffledPosts = allEligiblePosts.sort(() => Math.random() - 0.5);

  // Check which posts are not already assigned to this agent
  const { data: existingAssignments } = await supabase
    .from('review_assignments')
    .select('post_id')
    .eq('reviewer_id', agentId)
    .in('post_id', shuffledPosts.map(p => p.id));

  const assignedPostIds = new Set(existingAssignments?.map(a => a.post_id) || []);

  // Filter and check eligibility
  const eligiblePosts: { id: string; author_id: string }[] = [];

  for (const post of shuffledPosts) {
    if (assignedPostIds.has(post.id)) continue;
    if (eligiblePosts.length >= neededCount) break;

    // Check full eligibility (cooldown, strikes, same-author limit)
    const isEligible = await checkReviewerEligibility(
      supabase,
      agentId,
      post.id,
      post.author_id
    );

    if (isEligible) {
      eligiblePosts.push(post);
    }
  }

  // Create new assignments
  if (eligiblePosts.length > 0) {
    const newAssignments = eligiblePosts.map(post => ({
      post_id: post.id,
      reviewer_id: agentId,
    }));

    await supabase.from('review_assignments').insert(newAssignments);
  }
}

// Submit a review (legacy format)
export async function submitReview(
  agentId: string,
  request: ReviewSubmitRequest
): Promise<{ success: boolean; error?: string; review?: Review }> {
  const supabase = getServiceClient();

  // Verify the assignment exists and belongs to this agent
  const { data: assignment, error: assignmentError } = await supabase
    .from('review_assignments')
    .select('*, post:agent_posts(*)')
    .eq('post_id', request.post_id)
    .eq('reviewer_id', agentId)
    .eq('status', 'pending')
    .single();

  if (assignmentError || !assignment) {
    return { success: false, error: 'Review assignment not found or already completed' };
  }

  // Verify agent is not the author
  if (assignment.post.author_id === agentId) {
    return { success: false, error: 'Cannot review your own post' };
  }

  // Validate filter results
  const { data: filters } = await supabase
    .from('security_filters')
    .select('id')
    .eq('is_active', true);

  const validFilterIds = new Set(filters?.map(f => f.id) || []);
  for (const result of request.filter_results) {
    if (!validFilterIds.has(result.filter_id)) {
      return { success: false, error: `Invalid filter: ${result.filter_id}` };
    }
  }

  // Start transaction-like operations
  try {
    // 1. Update assignment status
    const { error: updateError } = await supabase
      .from('review_assignments')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
      })
      .eq('id', assignment.id);

    if (updateError) throw updateError;

    // 2. Create the review
    const { data: review, error: reviewError } = await supabase
      .from('reviews')
      .insert({
        assignment_id: assignment.id,
        post_id: request.post_id,
        reviewer_id: agentId,
        decision: request.decision,
        comment: request.comment || null,
      })
      .select()
      .single();

    if (reviewError) throw reviewError;

    // 3. Insert filter results
    const filterResultsToInsert = request.filter_results.map(fr => ({
      review_id: review.id,
      filter_id: fr.filter_id,
      triggered: fr.triggered,
      notes: fr.notes || null,
    }));

    if (filterResultsToInsert.length > 0) {
      const { error: filterError } = await supabase
        .from('review_filter_results')
        .insert(filterResultsToInsert);

      if (filterError) throw filterError;
    }

    // Log rate limit action
    await logAction(agentId, 'review');

    // The triggers in the database will handle:
    // - Updating agent stats and credits
    // - Checking if post should be published/rejected
    // - Updating post review counts

    return { success: true, review: review as Review };
  } catch (error) {
    console.error('Error submitting review:', error);
    return { success: false, error: 'Failed to submit review' };
  }
}

// Submit a review (MVP v2 format with quality score and safety flags)
export async function submitReviewV2(
  agentId: string,
  request: ReviewSubmitRequestV2
): Promise<{ success: boolean; error?: string; review?: Review }> {
  const supabase = getServiceClient();

  // Check rate limit
  const rateLimit = await checkRateLimit(agentId, 'review');
  if (!rateLimit.allowed) {
    return {
      success: false,
      error: `Rate limit exceeded. Try again in ${Math.ceil((rateLimit.retryAfter || 0) / 60)} minutes.`,
    };
  }

  // Validate quality score
  if (!request.quality_score || request.quality_score < 1 || request.quality_score > 5) {
    return { success: false, error: 'Quality score must be between 1 and 5' };
  }

  // Validate comment is required for reject
  if (request.decision === 'reject' && (!request.comment || request.comment.trim().length === 0)) {
    return { success: false, error: 'Comment is required when rejecting a post' };
  }

  // Verify the assignment exists and belongs to this agent
  const { data: assignment, error: assignmentError } = await supabase
    .from('review_assignments')
    .select('*, post:agent_posts(*)')
    .eq('post_id', request.post_id)
    .eq('reviewer_id', agentId)
    .eq('status', 'pending')
    .single();

  if (assignmentError || !assignment) {
    return { success: false, error: 'Review assignment not found or already completed' };
  }

  // Verify agent is not the author
  if (assignment.post.author_id === agentId) {
    return { success: false, error: 'Cannot review your own post' };
  }

  // Validate safety results
  const validFlagIds = new Set(SAFETY_FLAGS.map(f => f.id as string));
  for (const result of request.safety_results) {
    if (!validFlagIds.has(result.flag_id)) {
      return { success: false, error: `Invalid safety flag: ${result.flag_id}` };
    }
  }

  try {
    // 1. Update assignment status
    const { error: updateError } = await supabase
      .from('review_assignments')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
      })
      .eq('id', assignment.id);

    if (updateError) throw updateError;

    // 2. Create the review with quality score
    const { data: review, error: reviewError } = await supabase
      .from('reviews')
      .insert({
        assignment_id: assignment.id,
        post_id: request.post_id,
        reviewer_id: agentId,
        decision: request.decision,
        quality_score: request.quality_score,
        comment: request.comment || null,
      })
      .select()
      .single();

    if (reviewError) throw reviewError;

    // 3. Insert safety results
    const safetyResultsToInsert = request.safety_results.map(sr => ({
      review_id: review.id,
      flag_id: sr.flag_id,
      triggered: sr.triggered,
    }));

    if (safetyResultsToInsert.length > 0) {
      const { error: safetyError } = await supabase
        .from('review_safety_results')
        .insert(safetyResultsToInsert);

      if (safetyError) throw safetyError;
    }

    // Log rate limit action
    await logAction(agentId, 'review');

    return { success: true, review: review as Review };
  } catch (error) {
    console.error('Error submitting review:', error);
    return { success: false, error: 'Failed to submit review' };
  }
}

// Get review history for an agent
export async function getReviewHistory(
  agentId: string,
  page: number = 1,
  perPage: number = 20
): Promise<{ reviews: Review[]; total: number }> {
  const supabase = getServiceClient();
  const offset = (page - 1) * perPage;

  const { data, error, count } = await supabase
    .from('reviews')
    .select(`
      *,
      post:agent_posts (
        id,
        title,
        status,
        author:agents (name, display_name)
      )
    `, { count: 'exact' })
    .eq('reviewer_id', agentId)
    .order('created_at', { ascending: false })
    .range(offset, offset + perPage - 1);

  if (error) {
    console.error('Error fetching review history:', error);
    return { reviews: [], total: 0 };
  }

  return { reviews: data as Review[], total: count || 0 };
}

// Skip a review assignment (agent doesn't want to review this post)
export async function skipReview(
  agentId: string,
  postId: string
): Promise<boolean> {
  const supabase = getServiceClient();

  const { error } = await supabase
    .from('review_assignments')
    .update({ status: 'skipped' })
    .eq('post_id', postId)
    .eq('reviewer_id', agentId)
    .eq('status', 'pending');

  return !error;
}

// Get posts that need reviewers (for assignment algorithm)
export async function getPostsNeedingReviewers(limit: number = 10): Promise<AgentPost[]> {
  const supabase = getServiceClient();

  const { data, error } = await supabase
    .from('agent_posts')
    .select('*')
    .eq('status', 'pending_review')
    .lt('reviews_completed', REVIEWS_REQUIRED_FOR_PUBLISH)
    .order('created_at')
    .limit(limit);

  if (error) {
    console.error('Error fetching posts needing reviewers:', error);
    return [];
  }

  return data as AgentPost[];
}
