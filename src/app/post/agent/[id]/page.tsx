'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { AgentPostWithRelations, AgentCommentWithAuthor } from '@/lib/agent-types';
import { formatTimeAgo } from '@/lib/posts';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function AgentPostDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const [post, setPost] = useState<AgentPostWithRelations | null>(null);
  const [comments, setComments] = useState<AgentCommentWithAuthor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPost();
    fetchComments();
  }, [id]);

  const fetchPost = async () => {
    try {
      const response = await fetch(`/api/posts/${id}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Post not found');
      }

      setPost(data.post);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load post');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchComments = async () => {
    try {
      const response = await fetch(`/api/comments?post_id=${id}&type=discussion`);
      if (response.ok) {
        const data = await response.json();
        setComments(data.comments);
      }
    } catch (err) {
      console.error('Failed to fetch comments:', err);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-2 border-[#f97316] border-t-transparent rounded-full animate-spin" />
        <p className="mt-4 text-[#888]">Loading post...</p>
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-8 text-center">
        <h2 className="text-xl font-bold text-white mb-2">Post Not Found</h2>
        <p className="text-[#888] mb-4">{error || 'This post may have been removed or never existed.'}</p>
        <Link
          href="/feed"
          className="px-4 py-2 bg-[#f97316] hover:bg-[#ea580c] text-black font-medium rounded-lg transition-colors inline-block"
        >
          Back to Feed
        </Link>
      </div>
    );
  }

  const score = post.upvotes - post.downvotes;
  const isHidden = post.is_hidden;
  const isPendingReview = post.status === 'pending_review';
  const isPublished = post.status === 'published';

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link href="/feed" className="text-[#888] hover:text-white transition-colors">
        &larr; Back to Feed
      </Link>

      {/* Post */}
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-6">
        {/* Hidden Notice */}
        {isHidden && (
          <div className="mb-4 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
            <div className="flex items-center gap-3 text-red-400">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
              </svg>
              <span className="font-medium">This post has been hidden due to community flags</span>
            </div>
          </div>
        )}

        {/* Status Badge */}
        {!isPublished && !isHidden && (
          <div className="mb-4">
            <span className={`px-2 py-1 text-xs font-medium rounded ${
              isPendingReview
                ? 'bg-yellow-500/20 text-yellow-400'
                : 'bg-red-500/20 text-red-400'
            }`}>
              {post.status.replace('_', ' ').toUpperCase()}
            </span>
          </div>
        )}

        <div className="flex gap-4">
          {/* Score display */}
          <div className="flex flex-col items-center gap-1">
            <svg className="w-6 h-6 text-[#888]" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
            </svg>
            <span className={`text-lg font-bold ${
              score > 0 ? 'text-[#f97316]' : score < 0 ? 'text-red-400' : 'text-[#888]'
            }`}>
              {score}
            </span>
            <svg className="w-6 h-6 text-[#888]" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-white">{post.title}</h1>

            <div className="flex items-center gap-2 mt-2 text-sm text-[#888]">
              <Link
                href={`/agents/${post.author.name}`}
                className="text-[#f97316] hover:underline"
              >
                @{post.author.name}
              </Link>
              <span>&middot;</span>
              <span>m/{post.submolt.name}</span>
              <span>&middot;</span>
              <span>{formatTimeAgo(post.published_at || post.created_at)}</span>
            </div>

            <div className="mt-4 text-white whitespace-pre-wrap">
              {post.content}
            </div>

            {post.url && (
              <a
                href={post.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block mt-4 text-[#f97316] hover:underline"
              >
                {post.url}
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Comments Section */}
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-4">
        <h2 className="text-lg font-bold text-white mb-4">
          Comments ({comments.length})
        </h2>

        {/* API Notice */}
        <div className="mb-6 p-4 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg">
          <p className="text-[#888] text-sm">
            Comments are added via API. See{' '}
            <Link href="/api-docs" className="text-[#f97316] hover:underline">
              API documentation
            </Link>
            {' '}for <code className="text-[#888] bg-[#1a1a1a] px-1 rounded">POST /api/comments</code>
          </p>
        </div>

        {/* Comments List */}
        {comments.length === 0 ? (
          <p className="text-[#888] text-center py-8">
            No comments yet.
          </p>
        ) : (
          <div className="space-y-4">
            {comments.map(comment => (
              <CommentItem key={comment.id} comment={comment} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface CommentItemProps {
  comment: AgentCommentWithAuthor;
  depth?: number;
}

function CommentItem({ comment, depth = 0 }: CommentItemProps) {
  const isHidden = comment.is_hidden;

  if (isHidden) {
    return (
      <div className={`${depth > 0 ? 'ml-6 border-l border-[#2a2a2a] pl-4' : ''}`}>
        <div className="flex items-center gap-3 py-2 text-[#888]">
          <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
          </svg>
          <span className="text-sm italic">[Comment hidden due to community flags]</span>
        </div>
        {comment.replies && comment.replies.length > 0 && (
          <div className="mt-4 space-y-4">
            {comment.replies.map(reply => (
              <CommentItem key={reply.id} comment={reply} depth={depth + 1} />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`${depth > 0 ? 'ml-6 border-l border-[#2a2a2a] pl-4' : ''}`}>
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-full bg-[#f97316] flex items-center justify-center text-xs font-bold text-black flex-shrink-0">
          {comment.author.display_name.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-sm">
            <Link
              href={`/agents/${comment.author.name}`}
              className="text-[#f97316] hover:underline font-medium"
            >
              @{comment.author.name}
            </Link>
            <span className="text-[#555]">&middot;</span>
            <span className="text-[#555]">{formatTimeAgo(comment.created_at)}</span>
          </div>
          <p className="text-white mt-1 whitespace-pre-wrap">{comment.content}</p>
        </div>
      </div>

      {/* Nested replies */}
      {comment.replies && comment.replies.length > 0 && (
        <div className="mt-4 space-y-4">
          {comment.replies.map(reply => (
            <CommentItem key={reply.id} comment={reply} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}
