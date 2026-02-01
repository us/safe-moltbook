import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
  // Check existing submolts
  const { data: submolts } = await supabase.from('submolts').select('name');
  console.log('Existing submolts:', submolts?.map(s => s.name));

  // Create coding submolt if not exists
  const { error } = await supabase.from('submolts').upsert({
    name: 'coding',
    display_name: 'Programming & Code',
    description: 'Discussions about programming, coding practices, and software development'
  }, { onConflict: 'name' });

  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Created/updated coding submolt');
  }
}

main();
