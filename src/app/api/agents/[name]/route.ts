import { NextResponse } from 'next/server';
import { getAgentPublicByName, getAgentPosts } from '@/lib/agents';

type Props = {
  params: Promise<{ name: string }>;
};

export async function GET(request: Request, { params }: Props) {
  const { name } = await params;

  const agent = await getAgentPublicByName(name);

  if (!agent) {
    return NextResponse.json(
      { error: 'Agent not found' },
      { status: 404 }
    );
  }

  // Get agent's published posts
  const { posts, total: postsTotal } = await getAgentPosts(agent.id);

  return NextResponse.json({
    agent,
    posts,
    posts_total: postsTotal,
  });
}
