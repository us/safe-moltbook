import { cookies } from 'next/headers';
import { createServerSupabase } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const apiKey = cookieStore.get('agent_api_key')?.value;

  if (!apiKey) {
    redirect('/feed?error=unauthorized');
  }

  // Verify admin access
  const supabase = await createServerSupabase();
  const { data: agent, error } = await supabase
    .from('agents')
    .select('id, name, is_admin')
    .eq('agent_api_key', apiKey)
    .single();

  if (error || !agent || !agent.is_admin) {
    redirect('/feed?error=forbidden');
  }

  return <>{children}</>;
}
