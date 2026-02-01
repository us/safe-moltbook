'use client';

import { ReviewAssignmentWithPost, SafetyFlag } from '@/lib/agent-types';
import { SAFETY_FLAGS } from '@/lib/config';
import Link from 'next/link';

interface ReviewCardProps {
  assignment: ReviewAssignmentWithPost;
  onReviewComplete: () => void;
}

import { useState } from 'react';
import { fetchWithAuth } from './AgentAuthProvider';

export default function ReviewCard({ assignment, onReviewComplete }: ReviewCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [decision, setDecision] = useState<'approve' | 'reject' | null>(null);
  const [comment, setComment] = useState('');
  const [qualityScore, setQualityScore] = useState<number>(3);
  const [safetyResults, setSafetyResults] = useState<Record<string, boolean>>({});

  const post = assignment.post;
  const author = post.author;
  const submolt = post.submolt;

  const handleSafetyToggle = (flagId: string) => {
    setSafetyResults(prev => ({
      ...prev,
      [flagId]: !prev[flagId],
    }));
  };

  const handleSkip = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetchWithAuth('/api/reviews/skip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ post_id: post.id }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to skip');
      }

      onReviewComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to skip');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async () => {
    if (!decision) {
      setError('Please select a decision (Approve or Reject)');
      return;
    }

    if (decision === 'reject' && !comment.trim()) {
      setError('Comment is required when rejecting a post');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetchWithAuth('/api/reviews/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          post_id: post.id,
          decision,
          quality_score: qualityScore,
          comment: comment || undefined,
          safety_results: SAFETY_FLAGS.map(f => ({
            flag_id: f.id,
            triggered: safetyResults[f.id] || false,
          })),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit review');
      }

      onReviewComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Check if any safety flag is triggered
  const hasSafetyIssue = Object.values(safetyResults).some(v => v);

  return (
    <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-[#2a2a2a]">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-medium text-white truncate">{post.title}</h3>
            <div className="flex items-center gap-2 mt-1 text-sm text-[#888]">
              <Link
                href={`/agents/${author.name}`}
                className="text-[#f97316] hover:underline"
              >
                @{author.name}
              </Link>
              <span>in</span>
              <span className="text-[#888]">m/{submolt.name}</span>
            </div>
          </div>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="px-3 py-1 text-sm bg-[#2a2a2a] hover:bg-[#3a3a3a] rounded text-white"
          >
            {isExpanded ? 'Collapse' : 'Review'}
          </button>
        </div>

        {/* Preview */}
        {!isExpanded && (
          <p className="mt-2 text-sm text-[#888] line-clamp-2">{post.content}</p>
        )}
      </div>

      {/* Expanded Review Form */}
      {isExpanded && (
        <div className="p-4 space-y-4">
          {/* Full Content */}
          <div className="bg-[#0a0a0a] p-4 rounded-lg max-h-64 overflow-y-auto">
            <p className="text-white whitespace-pre-wrap">{post.content}</p>
            {post.url && (
              <a
                href={post.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block mt-2 text-sm text-[#f97316] hover:underline"
              >
                {post.url}
              </a>
            )}
          </div>

          {/* Safety Flags */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-white">Safety Check</h4>
            <p className="text-xs text-[#888]">Check any safety issues you find in this post:</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {SAFETY_FLAGS.map(flag => (
                <label
                  key={flag.id}
                  className={`flex items-start gap-2 p-2 rounded cursor-pointer transition-colors ${
                    safetyResults[flag.id]
                      ? 'bg-red-500/20 border border-red-500/40'
                      : 'bg-[#2a2a2a] border border-transparent hover:border-[#3a3a3a]'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={safetyResults[flag.id] || false}
                    onChange={() => handleSafetyToggle(flag.id)}
                    className="mt-1"
                  />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm text-white font-medium">{flag.name}</span>
                    <p className="text-xs text-[#888] mt-0.5">{flag.description}</p>
                  </div>
                </label>
              ))}
            </div>
            {hasSafetyIssue && (
              <p className="text-xs text-red-400 mt-2">
                Safety issue flagged - consider rejecting this post
              </p>
            )}
          </div>

          {/* Quality Score */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-white">Quality Score</h4>
            <p className="text-xs text-[#888]">Rate the overall quality of this post (1-5):</p>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min="1"
                max="5"
                value={qualityScore}
                onChange={(e) => setQualityScore(parseInt(e.target.value))}
                className="flex-1 accent-[#f97316]"
              />
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map(score => (
                  <button
                    key={score}
                    onClick={() => setQualityScore(score)}
                    className={`w-8 h-8 rounded-full text-sm font-medium transition-colors ${
                      qualityScore === score
                        ? 'bg-[#f97316] text-black'
                        : 'bg-[#2a2a2a] text-white hover:bg-[#3a3a3a]'
                    }`}
                  >
                    {score}
                  </button>
                ))}
              </div>
            </div>
            <p className="text-xs text-[#888]">
              {qualityScore === 1 && '⛔ Okunmaz / spam - Yayınlanmamalı'}
              {qualityScore === 2 && '⚠️ Zayıf - Ciddi düzenleme gerekli'}
              {qualityScore === 3 && '🔄 Fena değil ama yüzeysel'}
              {qualityScore === 4 && '✅ İyi - Değerli katkı'}
              {qualityScore === 5 && '🌟 Yayınlanır, keyifli/öğretici'}
            </p>
          </div>

          {/* Decision */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-white">Your Decision</h4>
            <div className="flex gap-3">
              <button
                onClick={() => setDecision('approve')}
                className={`flex-1 py-2 rounded-lg font-medium transition-colors ${
                  decision === 'approve'
                    ? 'bg-[#f97316] text-black'
                    : 'bg-[#2a2a2a] text-white hover:bg-[#f97316]/20'
                }`}
              >
                Approve
              </button>
              <button
                onClick={() => setDecision('reject')}
                className={`flex-1 py-2 rounded-lg font-medium transition-colors ${
                  decision === 'reject'
                    ? 'bg-red-500 text-white'
                    : 'bg-[#2a2a2a] text-white hover:bg-red-500/20'
                }`}
              >
                Reject
              </button>
            </div>
          </div>

          {/* Comment */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-white">
              Comment {decision === 'reject' ? '(required)' : '(optional)'}
            </h4>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={decision === 'reject' ? 'Neyi düzeltirse yayınlanabilir? (zorunlu)' : 'Yazara geri bildirim (isteğe bağlı)...'}
              rows={2}
              maxLength={1000}
              className="w-full px-3 py-2 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg text-white placeholder-[#555] text-sm resize-none focus:outline-none focus:border-[#f97316]"
            />
            <p className="text-xs text-[#555] text-right">{comment.length}/1000</p>
          </div>

          {/* Error */}
          {error && (
            <p className="text-sm text-red-400">{error}</p>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || !decision}
              className="flex-1 py-2 bg-[#f97316] hover:bg-[#ea580c] disabled:bg-[#555] text-black font-medium rounded-lg transition-colors"
            >
              {isSubmitting ? 'Submitting...' : 'Submit Review (+1 credit)'}
            </button>
            <button
              onClick={handleSkip}
              disabled={isSubmitting}
              className="px-4 py-2 bg-[#2a2a2a] hover:bg-[#3a3a3a] text-white rounded-lg transition-colors"
            >
              Skip
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
