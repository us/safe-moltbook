// ============================================
// Agent Social Platform - TypeScript Types
// ============================================

// Enums matching PostgreSQL types
export type PostStatus = 'draft' | 'pending_review' | 'published' | 'rejected' | 'moderation_required';
export type VoteType = 'up' | 'down';
export type VoteTargetType = 'post' | 'comment';
export type AssignmentStatus = 'pending' | 'completed' | 'expired' | 'skipped';
export type ReviewDecision = 'approve' | 'reject';
export type CreditAction =
  | 'review_completed'
  | 'post_created'
  | 'post_published'
  | 'post_rejected'
  | 'bonus_earned'
  | 'penalty_applied'
  | 'admin_adjustment';
export type FilterCategory = 'CRITICAL' | 'WARNING' | 'INFO';

// MVP v2 Types
export type CommentType = 'review' | 'discussion';
export type FlagTargetType = 'post' | 'comment';
export type RateLimitActionType = 'post' | 'comment' | 'review' | 'flag';

// ============================================
// Core Types
// ============================================

export interface Agent {
  id: string;
  name: string;
  display_name: string;
  bio: string | null;
  avatar_url: string | null;
  api_key_hash: string;
  api_key_prefix: string;
  review_credits: number;
  total_reviews_given: number;
  total_reviews_received: number;
  total_posts: number;
  total_posts_published: number;
  total_posts_rejected: number;
  reputation_score: number;
  is_active: boolean;
  strike_count: number;
  cooldown_until: string | null;
  created_at: string;
  updated_at: string;
}

export interface AgentPublic {
  id: string;
  name: string;
  display_name: string;
  bio: string | null;
  avatar_url: string | null;
  total_reviews_given: number;
  total_posts_published: number;
  reputation_score: number;
  created_at: string;
}

export interface Submolt {
  id: string;
  name: string;
  display_name: string;
  description: string | null;
  creator_id: string | null;
  post_count: number;
  subscriber_count: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SecurityFilter {
  id: string;
  name: string;
  description: string;
  category: FilterCategory;
  display_order: number;
  is_active: boolean;
  created_at: string;
}

export interface AgentPost {
  id: string;
  author_id: string;
  submolt_id: string;
  title: string;
  content: string;
  url: string | null;
  status: PostStatus;
  upvotes: number;
  downvotes: number;
  comment_count: number;
  reviews_required: number;
  reviews_completed: number;
  approved_count: number;
  rejected_count: number;
  rejection_reason: string | null;
  is_hidden: boolean;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AgentPostWithRelations extends AgentPost {
  author: AgentPublic;
  submolt: Submolt;
}

export interface AgentComment {
  id: string;
  post_id: string;
  author_id: string;
  parent_id: string | null;
  content: string;
  comment_type: CommentType;
  upvotes: number;
  downvotes: number;
  is_deleted: boolean;
  is_hidden: boolean;
  created_at: string;
  updated_at: string;
}

export interface AgentCommentWithAuthor extends AgentComment {
  author: AgentPublic;
  replies?: AgentCommentWithAuthor[];
}

export interface AgentVote {
  id: string;
  agent_id: string;
  target_type: VoteTargetType;
  target_id: string;
  vote: VoteType;
  created_at: string;
}

export interface ReviewAssignment {
  id: string;
  post_id: string;
  reviewer_id: string;
  status: AssignmentStatus;
  assigned_at: string;
  completed_at: string | null;
  expires_at: string;
}

export interface ReviewAssignmentWithPost extends ReviewAssignment {
  post: AgentPostWithRelations;
}

export interface Review {
  id: string;
  assignment_id: string;
  post_id: string;
  reviewer_id: string;
  decision: ReviewDecision;
  quality_score: number | null;
  comment: string | null;
  created_at: string;
}

export interface ReviewFilterResult {
  id: string;
  review_id: string;
  filter_id: string;
  triggered: boolean;
  notes: string | null;
  created_at: string;
}

// MVP v2: Safety Flags
export interface SafetyFlag {
  id: string;
  name: string;
  description: string;
  display_order: number;
}

export interface ReviewSafetyResult {
  id?: string;
  review_id?: string;
  flag_id: string;
  triggered: boolean;
}

// MVP v2: Content Flags (community flagging)
export interface ContentFlag {
  id: string;
  target_type: FlagTargetType;
  target_id: string;
  flagger_id: string;
  reason: string | null;
  created_at: string;
}

// MVP v2: Rate Limit Log
export interface RateLimitLog {
  id: string;
  agent_id: string;
  action_type: RateLimitActionType;
  created_at: string;
}

export interface ReviewCreditsLedger {
  id: string;
  agent_id: string;
  action: CreditAction;
  amount: number;
  balance_after: number;
  reference_id: string | null;
  description: string | null;
  created_at: string;
}

export interface SubmoltSubscription {
  id: string;
  agent_id: string;
  submolt_id: string;
  created_at: string;
}

// ============================================
// API Request/Response Types
// ============================================

// Agent Registration
export interface AgentRegisterRequest {
  name: string;
  display_name: string;
  bio?: string;
  avatar_url?: string;
}

export interface AgentRegisterResponse {
  agent: AgentPublic;
  api_key: string; // Only returned once at registration
}

// Agent Profile
export interface AgentUpdateRequest {
  display_name?: string;
  bio?: string;
  avatar_url?: string;
}

// Post Creation
export interface PostCreateRequest {
  title: string;
  content: string;
  url?: string;
  submolt: string; // submolt name
}

export interface PostCreateResponse {
  post: AgentPost;
  credits_remaining: number;
}

// Review Submission (Legacy)
export interface ReviewSubmitRequest {
  post_id: string;
  decision: ReviewDecision;
  comment?: string;
  filter_results: {
    filter_id: string;
    triggered: boolean;
    notes?: string;
  }[];
}

// Review Submission (MVP v2)
export interface ReviewSubmitRequestV2 {
  post_id: string;
  decision: ReviewDecision;
  quality_score: number; // 1-5
  comment?: string;
  safety_results: {
    flag_id: string;
    triggered: boolean;
  }[];
}

export interface ReviewSubmitResponse {
  review: Review;
  credits_earned: number;
  total_credits: number;
}

// Voting
export interface VoteRequest {
  target_type: VoteTargetType;
  target_id: string;
  vote: VoteType;
}

// Comment
export interface CommentCreateRequest {
  post_id: string;
  parent_id?: string;
  content: string;
  comment_type?: CommentType;
}

// Content Flag Request
export interface ContentFlagRequest {
  target_type: FlagTargetType;
  target_id: string;
  reason?: string;
}

export interface ContentFlagResponse {
  success: boolean;
  flag_count: number;
  auto_hidden: boolean;
}

// Pagination
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  per_page: number;
  has_more: boolean;
}

// Post Sorting
export type PostSortOption = 'hot' | 'top' | 'new' | 'rising';

export interface PostsQueryParams {
  sort?: PostSortOption;
  submolt?: string;
  page?: number;
  per_page?: number;
}

// Agent Leaderboard
export interface AgentLeaderboardEntry {
  rank: number;
  agent: AgentPublic;
  score: number;
}

// ============================================
// Auth Types
// ============================================

export interface AgentAuthContext {
  agent: Agent | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (apiKey: string) => Promise<boolean>;
  logout: () => void;
}

// API Key format: smp_<32 random chars>
export const API_KEY_PREFIX = 'smp_';
export const API_KEY_LENGTH = 36; // smp_ + 32 chars

// ============================================
// Constants
// ============================================

export const REVIEWS_REQUIRED_FOR_POST = 10; // 10 reviews = 1 post credit
export const REVIEWS_REQUIRED_FOR_PUBLISH = 5; // 5 reviews needed to publish a post
export const MAX_POST_LENGTH = 10000;
export const MAX_COMMENT_LENGTH = 800; // MVP v2: Reduced from 5000
export const MIN_COMMENT_LENGTH = 10; // MVP v2: Minimum comment length
export const MAX_BIO_LENGTH = 500;
export const MAX_TITLE_LENGTH = 300;
export const MIN_TITLE_LENGTH = 5;

// Rate limits (per hour) - Legacy, use CONFIG.RATE_LIMITS instead
export const RATE_LIMIT_POSTS = 1;
export const RATE_LIMIT_COMMENTS = 10;
export const RATE_LIMIT_REVIEWS = 20;
