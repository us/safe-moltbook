import { createClient } from '@supabase/supabase-js';
import { headers } from 'next/headers';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { Agent, API_KEY_PREFIX, API_KEY_LENGTH } from './agent-types';

// Service role client for API operations
function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, serviceKey);
}

// Generate a new API key
export function generateApiKey(): string {
  const randomBytes = crypto.randomBytes(24).toString('base64url');
  return `${API_KEY_PREFIX}${randomBytes.slice(0, 32)}`;
}

// Hash an API key for storage
export async function hashApiKey(apiKey: string): Promise<string> {
  return bcrypt.hash(apiKey, 12);
}

// Verify an API key against a hash
export async function verifyApiKey(apiKey: string, hash: string): Promise<boolean> {
  return bcrypt.compare(apiKey, hash);
}

// Get API key prefix for identification
export function getApiKeyPrefix(apiKey: string): string {
  return apiKey.slice(0, 8);
}

// Validate API key format
export function isValidApiKeyFormat(apiKey: string): boolean {
  return (
    apiKey.startsWith(API_KEY_PREFIX) &&
    apiKey.length === API_KEY_LENGTH
  );
}

// Extract API key from Authorization header
export function extractApiKey(authHeader: string | null): string | null {
  if (!authHeader) return null;

  // Support both "Bearer <key>" and "<key>" formats
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }

  if (authHeader.startsWith(API_KEY_PREFIX)) {
    return authHeader;
  }

  return null;
}

// Get authenticated agent from request headers
export async function getAuthenticatedAgent(): Promise<Agent | null> {
  const headersList = await headers();
  const authHeader = headersList.get('authorization');
  const apiKey = extractApiKey(authHeader);

  if (!apiKey || !isValidApiKeyFormat(apiKey)) {
    return null;
  }

  const prefix = getApiKeyPrefix(apiKey);
  const supabase = getServiceClient();

  // Find agents with matching prefix
  const { data: agents, error } = await supabase
    .from('agents')
    .select('*')
    .eq('api_key_prefix', prefix)
    .eq('is_active', true);

  if (error || !agents || agents.length === 0) {
    return null;
  }

  // Verify the full API key against stored hashes
  for (const agent of agents) {
    const isValid = await verifyApiKey(apiKey, agent.api_key_hash);
    if (isValid) {
      return agent as Agent;
    }
  }

  return null;
}

// Middleware helper: require authentication
export async function requireAuth(): Promise<{ agent: Agent } | { error: Response }> {
  const agent = await getAuthenticatedAgent();

  if (!agent) {
    return {
      error: new Response(
        JSON.stringify({ error: 'Unauthorized', message: 'Valid API key required' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      ),
    };
  }

  return { agent };
}

// Check if agent has enough credits to post
export async function hasPostCredits(agentId: string): Promise<boolean> {
  const supabase = getServiceClient();
  const { data: agent } = await supabase
    .from('agents')
    .select('review_credits')
    .eq('id', agentId)
    .single();

  return !!(agent && agent.review_credits >= 10);
}

// Deduct post credit from agent
export async function deductPostCredit(agentId: string): Promise<boolean> {
  const supabase = getServiceClient();

  const { data: agent, error: fetchError } = await supabase
    .from('agents')
    .select('review_credits')
    .eq('id', agentId)
    .single();

  if (fetchError || !agent || agent.review_credits < 10) {
    return false;
  }

  const newBalance = agent.review_credits - 10;

  const { error: updateError } = await supabase
    .from('agents')
    .update({
      review_credits: newBalance,
      total_posts: agent.review_credits + 1,
      updated_at: new Date().toISOString(),
    })
    .eq('id', agentId);

  if (updateError) {
    return false;
  }

  // Log credit transaction
  await supabase.from('review_credits_ledger').insert({
    agent_id: agentId,
    action: 'post_created',
    amount: -10,
    balance_after: newBalance,
    description: 'Created a new post',
  });

  return true;
}

// Register a new agent
export async function registerAgent(
  name: string,
  displayName: string,
  bio?: string,
  avatarUrl?: string
): Promise<{ agent: Agent; apiKey: string } | { error: string }> {
  const supabase = getServiceClient();

  // Check if name is already taken
  const { data: existing } = await supabase
    .from('agents')
    .select('id')
    .eq('name', name.toLowerCase())
    .single();

  if (existing) {
    return { error: 'Agent name already taken' };
  }

  // Generate API key
  const apiKey = generateApiKey();
  const apiKeyHash = await hashApiKey(apiKey);
  const apiKeyPrefix = getApiKeyPrefix(apiKey);

  // Insert agent
  const { data: agent, error } = await supabase
    .from('agents')
    .insert({
      name: name.toLowerCase(),
      display_name: displayName,
      bio: bio || null,
      avatar_url: avatarUrl || null,
      api_key_hash: apiKeyHash,
      api_key_prefix: apiKeyPrefix,
    })
    .select()
    .single();

  if (error) {
    console.error('Error registering agent:', error);
    return { error: 'Failed to register agent' };
  }

  return { agent: agent as Agent, apiKey };
}

// Update agent profile
export async function updateAgentProfile(
  agentId: string,
  updates: { display_name?: string; bio?: string; avatar_url?: string }
): Promise<Agent | null> {
  const supabase = getServiceClient();

  const { data: agent, error } = await supabase
    .from('agents')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', agentId)
    .select()
    .single();

  if (error) {
    console.error('Error updating agent:', error);
    return null;
  }

  return agent as Agent;
}

// Get agent by name
export async function getAgentByName(name: string): Promise<Agent | null> {
  const supabase = getServiceClient();

  const { data: agent, error } = await supabase
    .from('agents')
    .select('*')
    .eq('name', name.toLowerCase())
    .eq('is_active', true)
    .single();

  if (error) {
    return null;
  }

  return agent as Agent;
}

// Get agent by ID
export async function getAgentById(id: string): Promise<Agent | null> {
  const supabase = getServiceClient();

  const { data: agent, error } = await supabase
    .from('agents')
    .select('*')
    .eq('id', id)
    .eq('is_active', true)
    .single();

  if (error) {
    return null;
  }

  return agent as Agent;
}

// Get public agent info (strips sensitive fields)
export function toPublicAgent(agent: Agent) {
  return {
    id: agent.id,
    name: agent.name,
    display_name: agent.display_name,
    bio: agent.bio,
    avatar_url: agent.avatar_url,
    total_reviews_given: agent.total_reviews_given,
    total_posts_published: agent.total_posts_published,
    reputation_score: agent.reputation_score,
    created_at: agent.created_at,
  };
}
