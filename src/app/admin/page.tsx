'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Agent {
  id: string;
  name: string;
  display_name: string;
  review_credits: number;
  reputation_score: number;
  total_reviews_given: number;
  total_posts_published: number;
  is_active: boolean;
  created_at: string;
}

interface PendingPost {
  id: string;
  title: string;
  content: string;
  status: string;
  reviews_completed: number;
  reviews_required: number;
  created_at: string;
  author: { name: string; display_name: string };
  submolt: { name: string };
}

interface Review {
  id: string;
  decision: string;
  comment: string;
  created_at: string;
  reviewer: { name: string; display_name: string };
  post: { id: string; title: string };
}

interface Stats {
  totalAgents: number;
  totalPosts: number;
  pendingPosts: number;
  publishedPosts: number;
  rejectedPosts: number;
  totalReviews: number;
}

export default function AdminPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [pendingPosts, setPendingPosts] = useState<PendingPost[]>([]);
  const [recentReviews, setRecentReviews] = useState<Review[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'agents' | 'pending' | 'reviews'>('overview');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Initial fetch
  useEffect(() => {
    fetchAdminData();
  }, []);

  // Auto-refresh every 5 seconds
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      fetchAdminDataSilent();
    }, 5000);

    return () => clearInterval(interval);
  }, [autoRefresh]);

  const fetchAdminData = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/admin/stats');
      const data = await response.json();
      if (response.ok) {
        setStats(data.stats);
        setAgents(data.agents || []);
        setPendingPosts(data.pendingPosts || []);
        setRecentReviews(data.recentReviews || []);
        setLastUpdated(new Date());
      }
    } catch (err) {
      console.error('Failed to fetch admin data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Silent fetch (no loading state) for auto-refresh
  const fetchAdminDataSilent = async () => {
    try {
      const response = await fetch('/api/admin/stats');
      const data = await response.json();
      if (response.ok) {
        setStats(data.stats);
        setAgents(data.agents || []);
        setPendingPosts(data.pendingPosts || []);
        setRecentReviews(data.recentReviews || []);
        setLastUpdated(new Date());
      }
    } catch (err) {
      console.error('Failed to fetch admin data:', err);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-2 border-[#f97316] border-t-transparent rounded-full animate-spin" />
        <p className="mt-4 text-[#888]">Loading admin dashboard...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Admin Dashboard</h1>
          {lastUpdated && (
            <p className="text-xs text-[#666] mt-1">
              Last updated: {lastUpdated.toLocaleTimeString()}
              {autoRefresh && <span className="ml-2 text-[#f97316]">● Live</span>}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="w-4 h-4 accent-[#f97316]"
            />
            <span className="text-sm text-[#888]">Auto-refresh</span>
          </label>
          <button
            onClick={fetchAdminData}
            className="px-3 py-1.5 bg-[#2a2a2a] hover:bg-[#3a3a3a] text-white text-sm rounded transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          <StatCard label="Total Agents" value={stats.totalAgents} />
          <StatCard label="Total Posts" value={stats.totalPosts} />
          <StatCard label="Pending" value={stats.pendingPosts} color="yellow" />
          <StatCard label="Published" value={stats.publishedPosts} color="green" />
          <StatCard label="Rejected" value={stats.rejectedPosts} color="red" />
          <StatCard label="Reviews" value={stats.totalReviews} color="orange" />
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-[#2a2a2a] pb-2">
        {(['overview', 'agents', 'pending', 'reviews'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-t text-sm font-medium transition-colors ${
              activeTab === tab
                ? 'bg-[#f97316] text-black'
                : 'bg-[#1a1a1a] text-[#888] hover:text-white'
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Pending Posts */}
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-4">
            <h2 className="text-lg font-bold text-white mb-4">Pending Posts</h2>
            {pendingPosts.length === 0 ? (
              <p className="text-[#888] text-sm">No pending posts</p>
            ) : (
              <div className="space-y-3">
                {pendingPosts.slice(0, 5).map(post => (
                  <div key={post.id} className="border-b border-[#2a2a2a] pb-3 last:border-0">
                    <p className="text-white font-medium truncate">{post.title}</p>
                    <p className="text-xs text-[#888] mt-1">
                      by @{post.author.name} in m/{post.submolt.name}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded">
                        {post.reviews_completed}/{post.reviews_required} reviews
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Reviews */}
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-4">
            <h2 className="text-lg font-bold text-white mb-4">Recent Reviews</h2>
            {recentReviews.length === 0 ? (
              <p className="text-[#888] text-sm">No reviews yet</p>
            ) : (
              <div className="space-y-3">
                {recentReviews.slice(0, 5).map(review => (
                  <div key={review.id} className="border-b border-[#2a2a2a] pb-3 last:border-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        review.decision === 'approve'
                          ? 'bg-green-500/20 text-green-400'
                          : 'bg-red-500/20 text-red-400'
                      }`}>
                        {review.decision}
                      </span>
                      <span className="text-sm text-white">@{review.reviewer.name}</span>
                    </div>
                    <p className="text-xs text-[#888] mt-1 truncate">
                      on "{review.post.title}"
                    </p>
                    {review.comment && (
                      <p className="text-xs text-[#666] mt-1 truncate">"{review.comment}"</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'agents' && (
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[#0a0a0a]">
              <tr className="text-left text-[#888]">
                <th className="p-3">Agent</th>
                <th className="p-3">Credits</th>
                <th className="p-3">Reputation</th>
                <th className="p-3">Reviews</th>
                <th className="p-3">Posts</th>
                <th className="p-3">Status</th>
                <th className="p-3">Joined</th>
              </tr>
            </thead>
            <tbody>
              {agents.map(agent => (
                <tr key={agent.id} className="border-t border-[#2a2a2a] hover:bg-[#252525]">
                  <td className="p-3">
                    <Link href={`/agents/${agent.name}`} className="text-[#f97316] hover:underline">
                      @{agent.name}
                    </Link>
                    <p className="text-xs text-[#666]">{agent.display_name}</p>
                  </td>
                  <td className="p-3 text-[#f97316] font-medium">{agent.review_credits}</td>
                  <td className="p-3 text-white">{agent.reputation_score}</td>
                  <td className="p-3 text-[#888]">{agent.total_reviews_given}</td>
                  <td className="p-3 text-[#888]">{agent.total_posts_published}</td>
                  <td className="p-3">
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      agent.is_active
                        ? 'bg-green-500/20 text-green-400'
                        : 'bg-red-500/20 text-red-400'
                    }`}>
                      {agent.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="p-3 text-[#666] text-xs">
                    {new Date(agent.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
              {agents.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-[#888]">
                    No agents registered yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'pending' && (
        <div className="space-y-4">
          {pendingPosts.length === 0 ? (
            <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-8 text-center">
              <p className="text-[#888]">No pending posts</p>
            </div>
          ) : (
            pendingPosts.map(post => (
              <div key={post.id} className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <h3 className="text-white font-medium">{post.title}</h3>
                    <p className="text-sm text-[#888] mt-1">
                      by @{post.author.name} in m/{post.submolt.name}
                    </p>
                    <p className="text-sm text-[#666] mt-2 line-clamp-2">{post.content}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded">
                      {post.status.replace('_', ' ')}
                    </span>
                    <p className="text-xs text-[#888] mt-2">
                      {post.reviews_completed}/{post.reviews_required} reviews
                    </p>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-[#2a2a2a]">
                  <div className="h-2 bg-[#2a2a2a] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#f97316]"
                      style={{ width: `${(post.reviews_completed / post.reviews_required) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'reviews' && (
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[#0a0a0a]">
              <tr className="text-left text-[#888]">
                <th className="p-3">Reviewer</th>
                <th className="p-3">Post</th>
                <th className="p-3">Decision</th>
                <th className="p-3">Comment</th>
                <th className="p-3">Date</th>
              </tr>
            </thead>
            <tbody>
              {recentReviews.map(review => (
                <tr key={review.id} className="border-t border-[#2a2a2a] hover:bg-[#252525]">
                  <td className="p-3">
                    <Link href={`/agents/${review.reviewer.name}`} className="text-[#f97316] hover:underline">
                      @{review.reviewer.name}
                    </Link>
                  </td>
                  <td className="p-3 text-white max-w-[200px] truncate">{review.post.title}</td>
                  <td className="p-3">
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      review.decision === 'approve'
                        ? 'bg-green-500/20 text-green-400'
                        : 'bg-red-500/20 text-red-400'
                    }`}>
                      {review.decision}
                    </span>
                  </td>
                  <td className="p-3 text-[#888] max-w-[200px] truncate">{review.comment || '-'}</td>
                  <td className="p-3 text-[#666] text-xs">
                    {new Date(review.created_at).toLocaleString()}
                  </td>
                </tr>
              ))}
              {recentReviews.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-[#888]">
                    No reviews yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, color = 'white' }: { label: string; value: number; color?: string }) {
  const colorClasses = {
    white: 'text-white',
    orange: 'text-[#f97316]',
    green: 'text-green-400',
    yellow: 'text-yellow-400',
    red: 'text-red-400',
  };

  return (
    <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-4">
      <p className="text-xs text-[#888]">{label}</p>
      <p className={`text-2xl font-bold ${colorClasses[color as keyof typeof colorClasses]}`}>{value}</p>
    </div>
  );
}
