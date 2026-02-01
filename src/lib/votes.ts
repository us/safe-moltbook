import { createClient } from '@supabase/supabase-js';
import { AgentVote, VoteRequest, VoteTargetType, VoteType } from './agent-types';

// Service role client for vote operations
function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, serviceKey);
}

// Cast or update a vote
export async function castVote(
  agentId: string,
  request: VoteRequest
): Promise<{ success: boolean; error?: string; vote?: AgentVote | null; action: 'created' | 'updated' | 'removed' }> {
  const supabase = getServiceClient();

  // Verify target exists
  if (request.target_type === 'post') {
    const { data: post, error } = await supabase
      .from('agent_posts')
      .select('id, status')
      .eq('id', request.target_id)
      .single();

    if (error || !post) {
      return { success: false, error: 'Post not found', action: 'created' };
    }

    if (post.status !== 'published') {
      return { success: false, error: 'Cannot vote on unpublished posts', action: 'created' };
    }
  } else if (request.target_type === 'comment') {
    const { data: comment, error } = await supabase
      .from('agent_comments')
      .select('id')
      .eq('id', request.target_id)
      .single();

    if (error || !comment) {
      return { success: false, error: 'Comment not found', action: 'created' };
    }
  }

  // Check for existing vote
  const { data: existingVote } = await supabase
    .from('agent_votes')
    .select('*')
    .eq('agent_id', agentId)
    .eq('target_type', request.target_type)
    .eq('target_id', request.target_id)
    .single();

  if (existingVote) {
    // Same vote = remove it
    if (existingVote.vote === request.vote) {
      const { error: deleteError } = await supabase
        .from('agent_votes')
        .delete()
        .eq('id', existingVote.id);

      if (deleteError) {
        return { success: false, error: 'Failed to remove vote', action: 'removed' };
      }

      return { success: true, vote: null, action: 'removed' };
    }

    // Different vote = update it
    // First delete, then insert (to trigger proper count updates)
    await supabase.from('agent_votes').delete().eq('id', existingVote.id);

    const { data: newVote, error: insertError } = await supabase
      .from('agent_votes')
      .insert({
        agent_id: agentId,
        target_type: request.target_type,
        target_id: request.target_id,
        vote: request.vote,
      })
      .select()
      .single();

    if (insertError) {
      return { success: false, error: 'Failed to update vote', action: 'updated' };
    }

    return { success: true, vote: newVote as AgentVote, action: 'updated' };
  }

  // No existing vote = create new
  const { data: vote, error: voteError } = await supabase
    .from('agent_votes')
    .insert({
      agent_id: agentId,
      target_type: request.target_type,
      target_id: request.target_id,
      vote: request.vote,
    })
    .select()
    .single();

  if (voteError) {
    console.error('Error creating vote:', voteError);
    return { success: false, error: 'Failed to cast vote', action: 'created' };
  }

  return { success: true, vote: vote as AgentVote, action: 'created' };
}

// Get agent's votes for specific targets
export async function getAgentVotes(
  agentId: string,
  targetType: VoteTargetType,
  targetIds: string[]
): Promise<Map<string, VoteType>> {
  const supabase = getServiceClient();

  if (targetIds.length === 0) {
    return new Map();
  }

  const { data, error } = await supabase
    .from('agent_votes')
    .select('target_id, vote')
    .eq('agent_id', agentId)
    .eq('target_type', targetType)
    .in('target_id', targetIds);

  if (error) {
    console.error('Error fetching votes:', error);
    return new Map();
  }

  const voteMap = new Map<string, VoteType>();
  for (const vote of data) {
    voteMap.set(vote.target_id, vote.vote as VoteType);
  }

  return voteMap;
}
