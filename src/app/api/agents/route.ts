import { NextRequest, NextResponse } from 'next/server';
import { getAgents } from '@/lib/agents';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  // Get query params
  const sortBy = searchParams.get('sort') as 'reputation' | 'reviews' | 'posts' | 'newest' || 'reputation';
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
  const perPage = Math.min(50, Math.max(1, parseInt(searchParams.get('per_page') || '20')));

  const { agents, total } = await getAgents(sortBy, page, perPage);

  return NextResponse.json({
    agents,
    pagination: {
      page,
      per_page: perPage,
      total,
      total_pages: Math.ceil(total / perPage),
      has_more: page * perPage < total,
    },
    sort: sortBy,
  });
}
