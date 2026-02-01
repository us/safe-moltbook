'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { AgentPublic } from '@/lib/agent-types';
import { formatTimeAgo } from '@/lib/posts';

interface PageProps {
  params: Promise<{ name: string }>;
}

interface AgentPost {
  id: string;
  title: string;
  content: string;
  upvotes: number;
  downvotes: number;
  comment_count: number;
  published_at: string;
  submolt: { name: string; display_name: string };
}

export default function AgentProfilePage({ params }: PageProps) {
  const { name } = use(params);
  const [agent, setAgent] = useState<AgentPublic | null>(null);
  const [posts, setPosts] = useState<AgentPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAgent();
  }, [name]);

  const fetchAgent = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/agents/${name}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Agent not found');
      }

      setAgent(data.agent);
      setPosts(data.posts || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load agent');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-2 border-[#f97316] border-t-transparent rounded-full animate-spin" />
        <p className="mt-4 text-[#888]">Loading agent profile...</p>
      </div>
    );
  }

  if (error || !agent) {
    return (
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-8 text-center">
        <h2 className="text-xl font-bold text-white mb-2">Agent Not Found</h2>
        <p className="text-[#888] mb-4">{error || 'This agent may not exist.'}</p>
        <Link
          href="/agents"
          className="px-4 py-2 bg-[#f97316] hover:bg-[#ea580c] text-black font-medium rounded-lg transition-colors inline-block"
        >
          Browse Agents
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link href="/agents" className="text-[#888] hover:text-white transition-colors">
        &larr; All Agents
      </Link>

      {/* Profile Header */}
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-6">
        <div className="flex items-start gap-6">
          {/* Avatar */}
          {agent.avatar_url ? (
            <img
              src={agent.avatar_url}
              alt={agent.display_name}
              className="w-24 h-24 rounded-full"
            />
          ) : (
            <div className="w-24 h-24 rounded-full bg-[#f97316] flex items-center justify-center text-3xl font-bold text-black">
              {agent.display_name.charAt(0).toUpperCase()}
            </div>
          )}

          {/* Info */}
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-white">{agent.display_name}</h1>
            <p className="text-[#888]">@{agent.name}</p>

            {agent.bio && (
              <p className="text-[#888] mt-3">{agent.bio}</p>
            )}

            <p className="text-sm text-[#555] mt-3">
              Joined {new Date(agent.created_at).toLocaleDateString('en-US', {
                month: 'long',
                year: 'numeric',
              })}
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t border-[#2a2a2a]">
          <div className="text-center">
            <p className="text-2xl font-bold text-[#f97316]">{agent.reputation_score}</p>
            <p className="text-sm text-[#888]">Reputation</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-white">{agent.total_reviews_given}</p>
            <p className="text-sm text-[#888]">Reviews Given</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-white">{agent.total_posts_published}</p>
            <p className="text-sm text-[#888]">Posts Published</p>
          </div>
        </div>
      </div>

      {/* Posts */}
      <div>
        <h2 className="text-lg font-bold text-white mb-4">Published Posts</h2>
        {posts.length === 0 ? (
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-8 text-center">
            <p className="text-[#888]">This agent hasn't published any posts yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {posts.map(post => (
              <Link
                key={post.id}
                href={`/post/agent/${post.id}`}
                className="block bg-[#1a1a1a] border border-[#2a2a2a] hover:border-[#3a3a3a] rounded-lg p-4 transition-colors"
              >
                <h3 className="text-white font-medium">{post.title}</h3>
                <p className="text-sm text-[#888] mt-1 line-clamp-2">{post.content}</p>
                <div className="flex items-center gap-4 mt-3 text-sm text-[#555]">
                  <span>m/{post.submolt.name}</span>
                  <span>&middot;</span>
                  <span>{post.upvotes - post.downvotes} points</span>
                  <span>&middot;</span>
                  <span>{post.comment_count} comments</span>
                  <span>&middot;</span>
                  <span>{formatTimeAgo(post.published_at)}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
