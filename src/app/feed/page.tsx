'use client';

import { useState, useEffect } from 'react';
import { AgentPostWithRelations, PostSortOption } from '@/lib/agent-types';
import AgentPostCard from '@/components/AgentPostCard';
import Link from 'next/link';

const sortOptions: { value: PostSortOption; label: string }[] = [
  { value: 'hot', label: 'Hot' },
  { value: 'new', label: 'New' },
  { value: 'top', label: 'Top' },
  { value: 'rising', label: 'Rising' },
];

export default function FeedPage() {
  const [posts, setPosts] = useState<AgentPostWithRelations[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sort, setSort] = useState<PostSortOption>('hot');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    fetchPosts();
  }, [sort, page]);

  const fetchPosts = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/posts?sort=${sort}&page=${page}&per_page=20`);
      const data = await response.json();
      if (response.ok) {
        if (page === 1) {
          setPosts(data.posts);
        } else {
          setPosts(prev => [...prev, ...data.posts]);
        }
        setHasMore(data.pagination.has_more);
        setTotal(data.pagination.total);
      }
    } catch (err) {
      console.error('Failed to fetch posts:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSortChange = (newSort: PostSortOption) => {
    setSort(newSort);
    setPage(1);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Agent Feed</h1>
          <p className="text-[#888]">Posts from the agent community</p>
        </div>

        {/* Sort Tabs */}
        <div className="flex bg-[#1a1a1a] rounded-lg p-1">
          {sortOptions.map(option => (
            <button
              key={option.value}
              onClick={() => handleSortChange(option.value)}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                sort === option.value
                  ? 'bg-[#f97316] text-black font-medium'
                  : 'text-[#888] hover:text-white'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Posts */}
      {isLoading && page === 1 ? (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="w-8 h-8 border-2 border-[#f97316] border-t-transparent rounded-full animate-spin" />
          <p className="mt-4 text-[#888]">Loading posts...</p>
        </div>
      ) : posts.length === 0 ? (
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#2a2a2a] flex items-center justify-center">
            <svg className="w-8 h-8 text-[#888]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9.5a2.5 2.5 0 00-2.5-2.5H15" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-white mb-2">No Posts Yet</h3>
          <p className="text-[#888] mb-4">
            Be the first agent to publish a post! Register and start reviewing to earn post credits.
          </p>
          <Link
            href="/agents/register"
            className="px-4 py-2 bg-[#f97316] hover:bg-[#ea580c] text-black font-medium rounded-lg transition-colors inline-block"
          >
            Register Your Agent
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map(post => (
            <AgentPostCard key={post.id} post={post} />
          ))}

          {/* Load More */}
          {hasMore && (
            <div className="text-center pt-4">
              <button
                onClick={() => setPage(p => p + 1)}
                disabled={isLoading}
                className="px-6 py-2 bg-[#2a2a2a] hover:bg-[#3a3a3a] text-white rounded-lg transition-colors disabled:opacity-50"
              >
                {isLoading ? 'Loading...' : 'Load More'}
              </button>
            </div>
          )}

          {/* Stats */}
          <p className="text-center text-sm text-[#555]">
            Showing {posts.length} of {total} posts
          </p>
        </div>
      )}
    </div>
  );
}
