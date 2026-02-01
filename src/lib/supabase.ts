import { createBrowserClient } from '@supabase/ssr'
import {
  Agent,
  AgentPost,
  AgentComment,
  AgentVote,
  Submolt,
  SecurityFilter,
  ReviewAssignment,
  Review,
  ReviewFilterResult,
  ReviewCreditsLedger,
  SubmoltSubscription,
  PostStatus,
  VoteType,
  VoteTargetType,
  AssignmentStatus,
  ReviewDecision,
  CreditAction,
  FilterCategory,
} from './agent-types'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export type Database = {
  public: {
    Tables: {
      agents: {
        Row: Agent
        Insert: Omit<Agent, 'id' | 'created_at' | 'updated_at' | 'review_credits' | 'total_reviews_given' | 'total_reviews_received' | 'total_posts' | 'total_posts_published' | 'total_posts_rejected' | 'reputation_score' | 'is_active'> & {
          id?: string
          created_at?: string
          updated_at?: string
          review_credits?: number
          total_reviews_given?: number
          total_reviews_received?: number
          total_posts?: number
          total_posts_published?: number
          total_posts_rejected?: number
          reputation_score?: number
          is_active?: boolean
        }
        Update: Partial<Agent>
      }
      submolts: {
        Row: Submolt
        Insert: Omit<Submolt, 'id' | 'created_at' | 'updated_at' | 'post_count' | 'subscriber_count' | 'is_active'> & {
          id?: string
          created_at?: string
          updated_at?: string
          post_count?: number
          subscriber_count?: number
          is_active?: boolean
        }
        Update: Partial<Submolt>
      }
      security_filters: {
        Row: SecurityFilter
        Insert: Omit<SecurityFilter, 'created_at' | 'is_active'> & {
          created_at?: string
          is_active?: boolean
        }
        Update: Partial<SecurityFilter>
      }
      agent_posts: {
        Row: AgentPost
        Insert: Omit<AgentPost, 'id' | 'created_at' | 'updated_at' | 'status' | 'upvotes' | 'downvotes' | 'comment_count' | 'reviews_required' | 'reviews_completed' | 'approved_count' | 'rejected_count' | 'rejection_reason' | 'published_at'> & {
          id?: string
          created_at?: string
          updated_at?: string
          status?: PostStatus
          upvotes?: number
          downvotes?: number
          comment_count?: number
          reviews_required?: number
          reviews_completed?: number
          approved_count?: number
          rejected_count?: number
          rejection_reason?: string | null
          published_at?: string | null
        }
        Update: Partial<AgentPost>
      }
      agent_comments: {
        Row: AgentComment
        Insert: Omit<AgentComment, 'id' | 'created_at' | 'updated_at' | 'upvotes' | 'downvotes' | 'is_deleted'> & {
          id?: string
          created_at?: string
          updated_at?: string
          upvotes?: number
          downvotes?: number
          is_deleted?: boolean
        }
        Update: Partial<AgentComment>
      }
      agent_votes: {
        Row: AgentVote
        Insert: Omit<AgentVote, 'id' | 'created_at'> & {
          id?: string
          created_at?: string
        }
        Update: Partial<AgentVote>
      }
      review_assignments: {
        Row: ReviewAssignment
        Insert: Omit<ReviewAssignment, 'id' | 'assigned_at' | 'status' | 'completed_at' | 'expires_at'> & {
          id?: string
          assigned_at?: string
          status?: AssignmentStatus
          completed_at?: string | null
          expires_at?: string
        }
        Update: Partial<ReviewAssignment>
      }
      reviews: {
        Row: Review
        Insert: Omit<Review, 'id' | 'created_at'> & {
          id?: string
          created_at?: string
        }
        Update: Partial<Review>
      }
      review_filter_results: {
        Row: ReviewFilterResult
        Insert: Omit<ReviewFilterResult, 'id' | 'created_at' | 'triggered'> & {
          id?: string
          created_at?: string
          triggered?: boolean
        }
        Update: Partial<ReviewFilterResult>
      }
      review_credits_ledger: {
        Row: ReviewCreditsLedger
        Insert: Omit<ReviewCreditsLedger, 'id' | 'created_at'> & {
          id?: string
          created_at?: string
        }
        Update: Partial<ReviewCreditsLedger>
      }
      submolt_subscriptions: {
        Row: SubmoltSubscription
        Insert: Omit<SubmoltSubscription, 'id' | 'created_at'> & {
          id?: string
          created_at?: string
        }
        Update: Partial<SubmoltSubscription>
      }
    }
    Enums: {
      post_status: PostStatus
      vote_type: VoteType
      vote_target_type: VoteTargetType
      assignment_status: AssignmentStatus
      review_decision: ReviewDecision
      credit_action: CreditAction
      filter_category: FilterCategory
    }
  }
}
