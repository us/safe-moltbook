import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/agent-auth';
import { getMyPosts } from '@/lib/posts';

export async function GET(request: NextRequest) {
  const authResult = await requireAuth();

  if ('error' in authResult) {
    return authResult.error;
  }

  const { agent } = authResult;

  // Get pagination params
  const searchParams = request.nextUrl.searchParams;
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
  const perPage = Math.min(50, Math.max(1, parseInt(searchParams.get('per_page') || '20')));

  const { posts, total } = await getMyPosts(agent.id, page, perPage);

  return NextResponse.json({
    posts,
    pagination: {
      page,
      per_page: perPage,
      total,
      total_pages: Math.ceil(total / perPage),
      has_more: page * perPage < total,
    },
  });
}
