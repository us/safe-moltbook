import { createServerSupabase } from '@/lib/supabase-server'
import { MetadataRoute } from 'next'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = await createServerSupabase()

  // Static pages
  const staticPages = [
    { url: SITE_URL, lastModified: new Date(), changeFrequency: 'hourly' as const, priority: 1 },
    { url: `${SITE_URL}/about`, lastModified: new Date(), changeFrequency: 'monthly' as const, priority: 0.8 },
    { url: `${SITE_URL}/api-docs`, lastModified: new Date(), changeFrequency: 'monthly' as const, priority: 0.7 },
    { url: `${SITE_URL}/submit`, lastModified: new Date(), changeFrequency: 'monthly' as const, priority: 0.6 },
    { url: `${SITE_URL}/explore`, lastModified: new Date(), changeFrequency: 'daily' as const, priority: 0.8 },
    { url: `${SITE_URL}/top`, lastModified: new Date(), changeFrequency: 'hourly' as const, priority: 0.9 },
    { url: `${SITE_URL}/topics`, lastModified: new Date(), changeFrequency: 'daily' as const, priority: 0.7 },
  ]

  // Dynamic: Posts
  const { data: posts } = await supabase
    .from('submissions')
    .select('moltbook_post_id, created_at')
    .order('created_at', { ascending: false })
    .limit(500)

  const postPages = (posts || []).map((post) => ({
    url: `${SITE_URL}/post/${post.moltbook_post_id}`,
    lastModified: new Date(post.created_at),
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }))

  // Dynamic: Authors (agents)
  const { data: authors } = await supabase
    .from('submissions')
    .select('author')
    .not('author', 'is', null)

  const uniqueAuthors = [...new Set((authors || []).map(a => a.author))]
  const authorPages = uniqueAuthors.map((author) => ({
    url: `${SITE_URL}/u/${author}`,
    lastModified: new Date(),
    changeFrequency: 'daily' as const,
    priority: 0.7,
  }))

  // Dynamic: Submolts
  const { data: submolts } = await supabase
    .from('submissions')
    .select('submolt')
    .not('submolt', 'is', null)

  const uniqueSubmolts = [...new Set((submolts || []).map(s => s.submolt))]
  const submoltPages = uniqueSubmolts.map((submolt) => ({
    url: `${SITE_URL}/m/${submolt}`,
    lastModified: new Date(),
    changeFrequency: 'daily' as const,
    priority: 0.7,
  }))

  return [...staticPages, ...postPages, ...authorPages, ...submoltPages]
}
