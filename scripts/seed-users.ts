import { createClient } from '@supabase/supabase-js'

// You need to add SUPABASE_SERVICE_ROLE_KEY to your .env.local
// Get it from: Supabase Dashboard > Settings > API > service_role key
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!serviceRoleKey) {
  console.error('SUPABASE_SERVICE_ROLE_KEY is required!')
  console.log('Add it to .env.local from Supabase Dashboard > Settings > API')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
})

// Realistic human-like usernames and names
const users = [
  { username: 'sarah_dev', email: 'sarah.mitchell@example.com', name: 'Sarah Mitchell' },
  { username: 'techie_mike', email: 'mike.johnson@example.com', name: 'Mike Johnson' },
  { username: 'curious_cat', email: 'emma.wilson@example.com', name: 'Emma Wilson' },
  { username: 'night_owl_99', email: 'alex.chen@example.com', name: 'Alex Chen' },
  { username: 'coffee_addict', email: 'jamie.taylor@example.com', name: 'Jamie Taylor' },
  { username: 'wanderlust_jo', email: 'jordan.lee@example.com', name: 'Jordan Lee' },
  { username: 'pixel_dreams', email: 'casey.brown@example.com', name: 'Casey Brown' },
  { username: 'bookworm_42', email: 'riley.garcia@example.com', name: 'Riley Garcia' },
  { username: 'sunset_chaser', email: 'morgan.davis@example.com', name: 'Morgan Davis' },
  { username: 'code_ninja', email: 'sam.martinez@example.com', name: 'Sam Martinez' },
  { username: 'stargazer_x', email: 'taylor.anderson@example.com', name: 'Taylor Anderson' },
  { username: 'urban_explorer', email: 'chris.thomas@example.com', name: 'Chris Thomas' },
  { username: 'music_lover23', email: 'pat.jackson@example.com', name: 'Pat Jackson' },
  { username: 'ocean_breeze', email: 'drew.white@example.com', name: 'Drew White' },
  { username: 'mountain_climber', email: 'quinn.harris@example.com', name: 'Quinn Harris' },
  { username: 'artsy_fartsy', email: 'avery.clark@example.com', name: 'Avery Clark' },
  { username: 'foodie_adventures', email: 'blake.lewis@example.com', name: 'Blake Lewis' },
  { username: 'gym_rat_101', email: 'cameron.walker@example.com', name: 'Cameron Walker' },
  { username: 'vintage_vibes', email: 'dakota.hall@example.com', name: 'Dakota Hall' },
  { username: 'lazy_sunday', email: 'finley.young@example.com', name: 'Finley Young' },
]

// Random avatar URLs (using DiceBear API for consistent avatars)
function getAvatarUrl(seed: string): string {
  const styles = ['avataaars', 'bottts', 'micah', 'notionists', 'open-peeps', 'personas']
  const style = styles[Math.floor(Math.random() * styles.length)]
  return `https://api.dicebear.com/7.x/${style}/svg?seed=${encodeURIComponent(seed)}`
}

async function seedUsers() {
  console.log('Starting to seed users...\n')

  for (const user of users) {
    try {
      // Create auth user
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: user.email,
        password: 'TempPass123!', // They can reset this
        email_confirm: true,
        user_metadata: {
          name: user.name,
          full_name: user.name,
          avatar_url: getAvatarUrl(user.username),
        }
      })

      if (authError) {
        if (authError.message.includes('already been registered')) {
          console.log(`⏭️  ${user.username} already exists, skipping`)
          continue
        }
        throw authError
      }

      // Update profile with username
      if (authData.user) {
        const { error: profileError } = await supabase
          .from('profiles')
          .update({
            username: user.username,
            avatar_url: getAvatarUrl(user.username),
          })
          .eq('id', authData.user.id)

        if (profileError) {
          console.error(`⚠️  Profile update failed for ${user.username}:`, profileError.message)
        } else {
          console.log(`✅ Created: ${user.username} (${user.name})`)
        }
      }
    } catch (error) {
      console.error(`❌ Failed to create ${user.username}:`, error)
    }
  }

  console.log('\n✨ Seeding complete!')
}

seedUsers()
