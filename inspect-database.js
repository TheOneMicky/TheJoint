import { createClient } from '@supabase/supabase-js'

// Load environment variables
const supabaseUrl = "https://jgfzknzugqcjxwtdpgmv.supabase.co"
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpnZnprbnp1Z3Fjanh3dGRwZ212Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTAzNzc4MSwiZXhwIjoyMDkwNjEzNzgxfQ.5YXkKWmcb2vF5RjymrmESKRPEhCTsZTgbDnRqsPEUn4"

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function inspectDatabase() {
  console.log('=== SUPABASE DATABASE INSPECTION ===')
  
  // Common table names to check
  const commonTables = [
    'profiles',
    'users', 
    'posts',
    'categories',
    'comments',
    'likes',
    'settings',
    'notifications',
    'files',
    'tags',
    'projects',
    'tasks',
    'messages',
    'roles',
    'permissions'
  ]

  console.log('\n� Checking for existing tables...')
  
  for (const tableName of commonTables) {
    try {
      console.log(`\n--- 📊 Checking table: ${tableName} ---`)
      
      // Try to get count first
      const { count, error: countError } = await supabase
        .from(tableName)
        .select('*', { count: 'exact', head: true })

      if (countError) {
        console.log(`  ❌ Table does not exist or no access: ${countError.message}`)
      } else {
        console.log(`  ✅ Table EXISTS!`)
        console.log(`  📊 Total records: ${count || 0}`)
        
        // Get sample data
        const { data: sampleData, error: sampleError } = await supabase
          .from(tableName)
          .select('*')
          .limit(2)

        if (sampleError) {
          console.log(`  📄 Sample data: ${sampleError.message}`)
        } else {
          console.log(`  📄 Sample data (${sampleData.length} rows):`)
          sampleData.forEach((row, idx) => {
            console.log(`    Row ${idx + 1}:`, row)
          })
          
          // Show column structure from sample data
          if (sampleData.length > 0) {
            const columns = Object.keys(sampleData[0])
            console.log(`  � Columns detected: ${columns.join(', ')}`)
          }
        }
      }
    } catch (err) {
      console.log(`  ❌ Error checking ${tableName}: ${err.message}`)
    }
  }

  // Try to get auth users info
  try {
    console.log(`\n--- 🔐 Checking Auth Users ---`)
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError) {
      console.log(`  ℹ️ Auth check: ${userError.message}`)
    } else {
      console.log(`  ℹ️ Auth system: Connected`)
    }
  } catch (err) {
    console.log(`  ❌ Auth check error: ${err.message}`)
  }

  // Check if we can access any system tables
  try {
    console.log(`\n--- �️ System Access Check ---`)
    
    // Try to get schema info via RPC if available
    const { data: schemaInfo, error: schemaError } = await supabase
      .rpc('get_table_info', { schema_name: 'public' })
    
    if (schemaError) {
      console.log(`  ℹ️ RPC access: ${schemaError.message}`)
    } else {
      console.log(`  ✅ RPC access available`)
      console.log(`  📋 Schema info:`, schemaInfo)
    }
  } catch (err) {
    console.log(`  ℹ️ RPC access: Not available`)
  }

}

// Run the inspection
inspectDatabase().then(() => {
  console.log('\n=== INSPECTION COMPLETE ===')
  process.exit(0)
}).catch(err => {
  console.error('Script failed:', err)
  process.exit(1)
})
