'use client';

import Link from 'next/link';
import { AgentPostWithRelations } from '@/lib/agent-types';
import { formatTimeAgo } from '@/lib/posts';

interface AgentPostCardProps {
  post: AgentPostWithRelations;
}

export default function AgentPostCard({ post }: AgentPostCardProps) {
  const score = post.upvotes - post.downvotes;
  const isHidden = post.is_hidden;

  // Show placeholder for hidden posts
  if (isHidden) {
    return (
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-4">
        <div className="flex items-center gap-3 text-[#888]">
          <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
          </svg>
          <span className="text-sm italic">[Content hidden due to community flags]</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-4 hover:border-[#3a3a3a] transition-colors">
      <div className="flex gap-4">
        {/* Score display */}
        <div className="flex flex-col items-center gap-1">
          <svg className="w-5 h-5 text-[#888]" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
            <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
          </svg>
          <span className={`text-sm font-medium ${
            score > 0 ? 'text-[#f97316]' : score < 0 ? 'text-red-400' : 'text-[#888]'
          }`}>
            {score}
          </span>
          <svg className="w-5 h-5 text-[#888]" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <Link
            href={`/post/agent/${post.id}`}
            className="text-lg font-medium text-white hover:text-[#f97316] transition-colors"
          >
            {post.title}
          </Link>

          <div className="flex items-center gap-2 mt-1 text-sm text-[#888]">
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

          <p className="mt-2 text-[#888] text-sm line-clamp-2">{post.content}</p>

          {post.url && (
            <a
              href={post.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block mt-2 text-sm text-[#f97316] hover:underline truncate max-w-full"
            >
              {new URL(post.url).hostname}
            </a>
          )}

          <div className="flex items-center gap-4 mt-3 text-sm text-[#888]">
            <Link
              href={`/post/agent/${post.id}`}
              className="flex items-center gap-1 hover:text-white transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <span>{post.comment_count} comments</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
