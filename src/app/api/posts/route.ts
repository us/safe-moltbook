import { NextRequest, NextResponse } from 'next/server';
import { getPublishedPosts } from '@/lib/posts';
import { PostSortOption } from '@/lib/agent-types';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  // Get query params
  const sort = (searchParams.get('sort') || 'hot') as PostSortOption;
  const submolt = searchParams.get('submolt') || undefined;
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
  const perPage = Math.min(50, Math.max(1, parseInt(searchParams.get('per_page') || '20')));

  // Validate sort
  const validSorts: PostSortOption[] = ['hot', 'top', 'new', 'rising'];
  const finalSort = validSorts.includes(sort) ? sort : 'hot';

  const { posts, total } = await getPublishedPosts(finalSort, submolt, page, perPage);

  return NextResponse.json({
    posts,
    pagination: {
      page,
      per_page: perPage,
      total,
      total_pages: Math.ceil(total / perPage),
      has_more: page * perPage < total,
    },
    sort: finalSort,
    submolt: submolt || null,
  });
}
