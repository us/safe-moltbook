import * as fs from 'fs';
import * as path from 'path';

interface MoltbookPost {
  id: string;
  title: string;
  content: string;
  url?: string | null;
  upvotes: number;
  comment_count: number;
  author: {
    name: string;
  };
  submolt: {
    name: string;
  };
  created_at: string;
}

interface Post {
  id: string;
  title: string;
  content: string;
  url?: string;
  upvotes: number;
  comment_count: number;
  author: string;
  submolt: string;
  created_at: string;
}

interface PostsData {
  updated_at: string;
  posts: Post[];
}

const API_BASE = 'https://www.moltbook.com/api/v1';
const API_KEY = process.env.MOLTBOOK_API_KEY;

async function fetchPosts(sort: string, limit: number): Promise<MoltbookPost[]> {
  const url = `${API_BASE}/posts?sort=${sort}&limit=${limit}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (API_KEY) {
    headers['Authorization'] = `Bearer ${API_KEY}`;
  }

  const response = await fetch(url, { headers });

  if (!response.ok) {
    throw new Error(`Failed to fetch posts: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data.posts || data;
}

function transformPost(post: MoltbookPost): Post {
  return {
    id: post.id,
    title: post.title,
    content: post.content || '',
    url: post.url || undefined,
    upvotes: post.upvotes,
    comment_count: post.comment_count,
    author: post.author?.name || 'anonymous',
    submolt: post.submolt?.name || 'unknown',
    created_at: post.created_at,
  };
}

async function main() {
  console.log('Fetching posts from Moltbook...');

  try {
    // Fetch top and hot posts
    const [topPosts, hotPosts] = await Promise.all([
      fetchPosts('top', 50),
      fetchPosts('hot', 50),
    ]);

    console.log(`Fetched ${topPosts.length} top posts and ${hotPosts.length} hot posts`);

    // Merge and deduplicate by id
    const postsMap = new Map<string, MoltbookPost>();

    for (const post of [...topPosts, ...hotPosts]) {
      if (!postsMap.has(post.id)) {
        postsMap.set(post.id, post);
      }
    }

    // Transform and filter
    let posts = Array.from(postsMap.values())
      .map(transformPost)
      .filter(post => post.upvotes >= 3);

    // Sort by upvotes descending
    posts.sort((a, b) => b.upvotes - a.upvotes);

    // Limit to 100 posts
    posts = posts.slice(0, 100);

    console.log(`After filtering: ${posts.length} posts with 3+ upvotes`);

    // Prepare output
    const output: PostsData = {
      updated_at: new Date().toISOString(),
      posts,
    };

    // Write to file
    const outputPath = path.join(__dirname, '..', 'data', 'posts.json');
    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));

    console.log(`Wrote ${posts.length} posts to ${outputPath}`);
    console.log('Done!');
  } catch (error) {
    console.error('Error fetching posts:', error);
    process.exit(1);
  }
}

main();
