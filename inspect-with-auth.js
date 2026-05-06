import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

// Load environment variables
function loadEnv() {
  try {
    const envContent = readFileSync('.env', 'utf8')
    const lines = envContent.split('\n')
    const env = {}
    lines.forEach(line => {
      const match = line.match(/^([^=]+)=["']?([^"']+)["']?$/)
      if (match) env[match[1]] = match[2]
    })
    return env
  } catch (error) {
    return {}
  }
}

const env = loadEnv()
const supabaseUrl = env.VITE_SUPABASE_URL || "https://jgfzknzugqcjxwtdpgmv.supabase.co"
const supabaseKey = env.VITE_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

const tablesToCheck = [
  'workouts', 'exercises', 'workout_logs', 'user_workouts', 
  'activities', 'tracking', 'matches', 'user_matches',
  'fitness_data', 'goals', 'achievements', 'challenges',
  'exercise_categories', 'workout_plans', 'schedules',
  'profiles', 'users', 'posts', 'categories'
]

async function inspectTables() {
  console.log('=== SUPABASE DATABASE INSPECTION (Authenticated) ===\n')
  
  let foundTables = []
  let populatedTables = []
  
  for (const tableName of tablesToCheck) {
    try {
      // Try to get count
      const { data: countResult, error: countError, count } = await supabase
        .from(tableName)
        .select('*', { count: 'exact', head: true })
      
      if (countError) {
        if (!countError.message.includes('does not exist') && 
            !countError.message.includes('not found')) {
          console.log(`⚠️  ${tableName}: ${countError.message}`)
        }
        continue
      }
      
      foundTables.push(tableName)
      const recordCount = count || 0
      
      if (recordCount > 0) {
        populatedTables.push({ name: tableName, count: recordCount })
        
        // Get sample data
        const { data: sample, error: sampleError } = await supabase
          .from(tableName)
          .select('*')
          .limit(2)
        
        console.log(`\n📊 ${tableName} (${recordCount} records)`)
        console.log('─'.repeat(50))
        
        if (sample && sample.length > 0) {
          const columns = Object.keys(sample[0])
          console.log(`Columns: ${columns.join(', ')}`)
          
          sample.forEach((row, idx) => {
            console.log(`\n  Row ${idx + 1}:`)
            columns.forEach(col => {
              let value = row[col]
              if (value === null) value = 'null'
              else if (typeof value === 'object') value = JSON.stringify(value).substring(0, 50)
              else value = String(value).substring(0, 50)
              console.log(`    ${col}: ${value}`)
            })
          })
        }
      }
    } catch (err) {
      // Table likely doesn't exist
    }
  }
  
  console.log('\n' + '='.repeat(60))
  console.log('SUMMARY:')
  console.log(`Total tables found: ${foundTables.length}`)
  console.log(`Populated tables: ${populatedTables.length}`)
  
  if (populatedTables.length > 0) {
    console.log('\nPopulated tables:')
    populatedTables.forEach(t => console.log(`  • ${t.name}: ${t.count} records`))
  } else {
    console.log('\n⚠️ No populated tables found. You may need to:')
    console.log('  1. Sign in to create your profile')
    console.log('  2. Add workout data through the app')
    console.log('  3. Import existing data to Supabase')
  }
  
  // Check auth status
  console.log('\n─'.repeat(60))
  const { data: { session } } = await supabase.auth.getSession()
  if (session) {
    console.log(`✅ Authenticated as: ${session.user.email}`)
    console.log(`User ID: ${session.user.id}`)
  } else {
    console.log('ℹ️ Not authenticated (anonymous access)')
  }
}

inspectTables().catch(console.error)
