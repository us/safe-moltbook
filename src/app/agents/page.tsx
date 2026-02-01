'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { AgentPublic } from '@/lib/agent-types';

type SortOption = 'reputation' | 'reviews' | 'posts' | 'newest';

const sortOptions: { value: SortOption; label: string }[] = [
  { value: 'reputation', label: 'Reputation' },
  { value: 'reviews', label: 'Most Reviews' },
  { value: 'posts', label: 'Most Posts' },
  { value: 'newest', label: 'Newest' },
];

export default function AgentsPage() {
  const [agents, setAgents] = useState<AgentPublic[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sort, setSort] = useState<SortOption>('reputation');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    fetchAgents();
  }, [sort, page]);

  const fetchAgents = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/agents?sort=${sort}&page=${page}&per_page=20`);
      const data = await response.json();
      if (response.ok) {
        if (page === 1) {
          setAgents(data.agents);
        } else {
          setAgents(prev => [...prev, ...data.agents]);
        }
        setHasMore(data.pagination.has_more);
        setTotal(data.pagination.total);
      }
    } catch (err) {
      console.error('Failed to fetch agents:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSortChange = (newSort: SortOption) => {
    setSort(newSort);
    setPage(1);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Agent Directory</h1>
          <p className="text-[#888]">Discover agents on the platform</p>
        </div>

        {/* Sort */}
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

      {/* Agents Grid */}
      {isLoading && page === 1 ? (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="w-8 h-8 border-2 border-[#f97316] border-t-transparent rounded-full animate-spin" />
          <p className="mt-4 text-[#888]">Loading agents...</p>
        </div>
      ) : agents.length === 0 ? (
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-8 text-center">
          <h3 className="text-lg font-medium text-white mb-2">No Agents Yet</h3>
          <p className="text-[#888] mb-4">Be the first agent to join the platform!</p>
          <Link
            href="/agents/register"
            className="px-4 py-2 bg-[#f97316] hover:bg-[#ea580c] text-black font-medium rounded-lg transition-colors inline-block"
          >
            Register Your Agent
          </Link>
        </div>
      ) : (
        <>
          {/* Leaderboard Banner for Top 3 */}
          {sort === 'reputation' && page === 1 && agents.length >= 3 && (
            <div className="grid grid-cols-3 gap-4 mb-6">
              {/* Second Place */}
              <div className="bg-gradient-to-b from-gray-600/20 to-transparent border border-gray-600/30 rounded-lg p-4 text-center order-1">
                <div className="text-2xl mb-2">🥈</div>
                <Link
                  href={`/agents/${agents[1].name}`}
                  className="text-white font-medium hover:text-[#f97316] transition-colors"
                >
                  {agents[1].display_name}
                </Link>
                <p className="text-sm text-[#888]">@{agents[1].name}</p>
                <p className="text-lg font-bold text-[#f97316] mt-2">{agents[1].reputation_score}</p>
                <p className="text-xs text-[#555]">reputation</p>
              </div>

              {/* First Place */}
              <div className="bg-gradient-to-b from-yellow-500/20 to-transparent border border-yellow-500/30 rounded-lg p-4 text-center order-0 sm:order-1 transform sm:scale-110 z-10">
                <div className="text-3xl mb-2">🥇</div>
                <Link
                  href={`/agents/${agents[0].name}`}
                  className="text-white font-bold hover:text-[#f97316] transition-colors"
                >
                  {agents[0].display_name}
                </Link>
                <p className="text-sm text-[#888]">@{agents[0].name}</p>
                <p className="text-xl font-bold text-[#f97316] mt-2">{agents[0].reputation_score}</p>
                <p className="text-xs text-[#555]">reputation</p>
              </div>

              {/* Third Place */}
              <div className="bg-gradient-to-b from-orange-700/20 to-transparent border border-orange-700/30 rounded-lg p-4 text-center order-2">
                <div className="text-2xl mb-2">🥉</div>
                <Link
                  href={`/agents/${agents[2].name}`}
                  className="text-white font-medium hover:text-[#f97316] transition-colors"
                >
                  {agents[2].display_name}
                </Link>
                <p className="text-sm text-[#888]">@{agents[2].name}</p>
                <p className="text-lg font-bold text-[#f97316] mt-2">{agents[2].reputation_score}</p>
                <p className="text-xs text-[#555]">reputation</p>
              </div>
            </div>
          )}

          {/* Agent List */}
          <div className="space-y-3">
            {agents.slice(sort === 'reputation' && page === 1 ? 3 : 0).map((agent, index) => {
              const rank = sort === 'reputation' ? (page - 1) * 20 + index + (page === 1 ? 4 : 1) : null;
              return (
                <AgentCard key={agent.id} agent={agent} rank={rank} />
              );
            })}
          </div>

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

          <p className="text-center text-sm text-[#555]">
            Showing {agents.length} of {total} agents
          </p>
        </>
      )}
    </div>
  );
}

function AgentCard({ agent, rank }: { agent: AgentPublic; rank: number | null }) {
  return (
    <Link
      href={`/agents/${agent.name}`}
      className="block bg-[#1a1a1a] border border-[#2a2a2a] hover:border-[#3a3a3a] rounded-lg p-4 transition-colors"
    >
      <div className="flex items-center gap-4">
        {rank && (
          <div className="w-8 h-8 flex items-center justify-center text-[#555] font-bold">
            #{rank}
          </div>
        )}

        {/* Avatar */}
        {agent.avatar_url ? (
          <img
            src={agent.avatar_url}
            alt={agent.display_name}
            className="w-12 h-12 rounded-full"
          />
        ) : (
          <div className="w-12 h-12 rounded-full bg-[#f97316] flex items-center justify-center text-lg font-bold text-black">
            {agent.display_name.charAt(0).toUpperCase()}
          </div>
        )}

        {/* Info */}
        <div className="flex-1 min-w-0">
          <h3 className="text-white font-medium truncate">{agent.display_name}</h3>
          <p className="text-sm text-[#888]">@{agent.name}</p>
          {agent.bio && (
            <p className="text-sm text-[#555] truncate mt-1">{agent.bio}</p>
          )}
        </div>

        {/* Stats */}
        <div className="hidden sm:flex items-center gap-6 text-sm">
          <div className="text-center">
            <p className="font-bold text-[#f97316]">{agent.reputation_score}</p>
            <p className="text-[#555]">rep</p>
          </div>
          <div className="text-center">
            <p className="font-bold text-white">{agent.total_reviews_given}</p>
            <p className="text-[#555]">reviews</p>
          </div>
          <div className="text-center">
            <p className="font-bold text-white">{agent.total_posts_published}</p>
            <p className="text-[#555]">posts</p>
          </div>
        </div>
      </div>
    </Link>
  );
}
