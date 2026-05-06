import fetch from 'node-fetch'
import { readFileSync } from 'fs'

// Load environment variables from .env file
function loadEnv() {
  try {
    const envContent = readFileSync('.env', 'utf8')
    const lines = envContent.split('\n')
    const env = {}
    
    lines.forEach(line => {
      const match = line.match(/^([^=]+)=(.*)$/)
      if (match) {
        env[match[1]] = match[2].replace(/^["']|["']$/g, '')
      }
    })
    
    return env
  } catch (error) {
    console.log('⚠️  .env file not found, using default values')
    return {}
  }
}

const env = loadEnv()

// Supabase configuration
const supabaseUrl = env.VITE_SUPABASE_URL || "https://jgfzknzugqcjxwtdpgmv.supabase.co"
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpnZnprbnp1Z3Fjanh3dGRwZ212Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTAzNzc4MSwiZXhwIjoyMDkwNjEzNzgxfQ.5YXkKWmcb2vF5RjymrmESKRPEhCTsZTgbDnRqsPEUn4"

// ExerciseDB API configuration
const RAPIDAPI_KEY = env.RAPIDAPI_KEY || "YOUR_RAPIDAPI_KEY"
const EXERCISEDB_HOST = "exercisedb.p.rapidapi.com"

// Supabase client helper
class SupabaseClient {
  constructor(url, key) {
    this.url = url
    this.key = key
    this.headers = {
      'apikey': key,
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
      'Prefer': 'resolution=merge-duplicates'
    }
  }

  async upsert(table, data) {
    const response = await fetch(`${this.url}/rest/v1/${table}`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(data)
    })
    
    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Supabase upsert error: ${response.status} - ${error}`)
    }
    
    return response.json()
  }

  async select(table, columns = '*', limit = 10) {
    const response = await fetch(`${this.url}/rest/v1/${table}?select=${columns}&limit=${limit}`, {
      method: 'GET',
      headers: this.headers
    })
    
    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Supabase select error: ${response.status} - ${error}`)
    }
    
    return response.json()
  }
}

// ExerciseDB API client
class ExerciseDBClient {
  constructor(apiKey) {
    this.apiKey = apiKey
    this.host = EXERCISEDB_HOST
    this.headers = {
      'X-RapidAPI-Key': apiKey,
      'X-RapidAPI-Host': this.host
    }
  }

  async getExercises(limit = 200) {
    const url = `https://exercisedb.p.rapidapi.com/exercises?limit=${limit}`
    
    const response = await fetch(url, {
      method: 'GET',
      headers: this.headers
    })
    
    if (!response.ok) {
      const error = await response.text()
      throw new Error(`ExerciseDB API error: ${response.status} - ${error}`)
    }
    
    return response.json()
  }
}

// Main caching function
async function cacheExercises() {
  console.log('=== EXERCISE DATABASE CACHING ===')
  
  if (RAPIDAPI_KEY === 'YOUR_RAPIDAPI_KEY') {
    console.error('❌ Please set your RapidAPI key in the RAPIDAPI_KEY variable')
    console.log('📝 Get your key from: https://rapidapi.com/hub')
    process.exit(1)
  }

  const supabase = new SupabaseClient(supabaseUrl, supabaseAnonKey)
  const exerciseDB = new ExerciseDBClient(RAPIDAPI_KEY)
  
  try {
    // Step 1: Check existing exercises
    console.log('\n🔍 Checking existing exercises...')
    const existingExercises = await supabase.select('exercises', 'id, name', 1)
    console.log(`📊 Found ${existingExercises.length} existing exercises`)
    
    // Step 2: Fetch exercises from ExerciseDB API
    console.log('\n📥 Fetching exercises from ExerciseDB API...')
    const exercises = await exerciseDB.getExercises(200)
    console.log(`✅ Fetched ${exercises.length} exercises from API`)
    
    // Step 3: Transform and filter exercises
    console.log('\n🔄 Processing exercises...')
    const processedExercises = exercises
      .filter(exercise => 
        exercise.name && 
        exercise.target && 
        exercise.gifUrl && 
        exercise.equipment
      )
      .map(exercise => ({
        id: exercise.id || generateId(), // Use API ID or generate one
        name: exercise.name.trim(),
        target: exercise.target?.trim() || 'general',
        gif_url: exercise.gifUrl?.trim(),
        equipment: exercise.equipment?.trim() || 'bodyweight',
        body_part: exercise.bodyPart?.trim() || null,
        instructions: Array.isArray(exercise.instructions) 
          ? exercise.instructions.join(' ').substring(0, 500)
          : (exercise.instructions || '').substring(0, 500),
        secondary_muscles: Array.isArray(exercise.secondaryMuscles)
          ? exercise.secondaryMuscles.join(', ')
          : null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }))
    
    console.log(`📝 Processed ${processedExercises.length} valid exercises`)
    
    // Step 4: Batch upsert to Supabase
    console.log('\n💾 Caching exercises to Supabase...')
    
    const batchSize = 50 // Process in batches to avoid timeouts
    let totalInserted = 0
    
    for (let i = 0; i < processedExercises.length; i += batchSize) {
      const batch = processedExercises.slice(i, i + batchSize)
      
      try {
        await supabase.upsert('exercises', batch)
        totalInserted += batch.length
        console.log(`✅ Batch ${Math.floor(i/batchSize) + 1}: Inserted ${batch.length} exercises (${totalInserted}/${processedExercises.length})`)
      } catch (error) {
        console.error(`❌ Batch ${Math.floor(i/batchSize) + 1} failed:`, error.message)
        // Continue with next batch
      }
    }
    
    // Step 5: Verify results
    console.log('\n🔍 Verifying cached exercises...')
    const finalCount = await supabase.select('exercises', 'count', 1)
    console.log(`📊 Total exercises in database: ${finalCount.length}`)
    
    // Show sample data
    if (finalCount.length > 0) {
      const sample = await supabase.select('exercises', 'name, target, equipment', 5)
      console.log('\n📄 Sample exercises:')
      sample.forEach((ex, idx) => {
        console.log(`  ${idx + 1}. ${ex.name} (${ex.target}) - ${ex.equipment}`)
      })
    }
    
    console.log('\n🎉 Exercise caching completed successfully!')
    console.log(`📈 Summary: ${totalInserted} exercises cached from ExerciseDB API`)
    
  } catch (error) {
    console.error('❌ Exercise caching failed:', error.message)
    process.exit(1)
  }
}

// Helper function to generate ID if needed
function generateId() {
  return Math.random().toString(36).substring(2) + Date.now().toString(36)
}

// Create exercises table if needed
async function createExercisesTable() {
  const supabase = new SupabaseClient(supabaseUrl, supabaseAnonKey)
  
  console.log('🔧 Creating exercises table if needed...')
  
  const createTableSQL = `
    CREATE TABLE IF NOT EXISTS exercises (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      target TEXT NOT NULL,
      gif_url TEXT NOT NULL,
      equipment TEXT NOT NULL,
      body_part TEXT,
      instructions TEXT,
      secondary_muscles TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    
    -- Enable RLS
    ALTER TABLE exercises ENABLE ROW LEVEL SECURITY;
    
    -- Allow public read access
    CREATE POLICY "Public read access" ON exercises FOR SELECT USING (true);
    
    -- Allow service role to insert/update
    CREATE POLICY "Service role full access" ON exercises FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');
  `
  
  try {
    // This would need to be run manually in Supabase SQL editor
    console.log('📝 Please run this SQL in your Supabase SQL editor:')
    console.log(createTableSQL)
  } catch (error) {
    console.log('ℹ️ Table creation info provided above')
  }
}

// Run the caching
if (process.argv.includes('--create-table')) {
  createExercisesTable()
} else {
  cacheExercises()
}
