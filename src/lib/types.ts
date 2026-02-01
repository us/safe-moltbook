export interface Post {
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

export interface PostsData {
  updated_at: string;
  posts: Post[];
}
