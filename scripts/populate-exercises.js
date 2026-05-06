import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { config } from 'dotenv'

// Load environment variables from .env file
config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Supabase configuration from .env file
const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Error: SUPABASE_URL and SUPABASE_ANON_KEY must be set in .env file')
  process.exit(1)
}

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// Batch size for inserts
const BATCH_SIZE = 100

async function populateExercises() {
  try {
    console.log('Reading exercises.json...')
    const jsonPath = join(__dirname, '../src/assets/exercises.json')
    const fileContent = readFileSync(jsonPath, 'utf-8')
    const exercises = JSON.parse(fileContent)
    
    console.log(`Found ${exercises.length} exercises to insert`)
    
    // Process in batches
    const totalBatches = Math.ceil(exercises.length / BATCH_SIZE)
    let successCount = 0
    let errorCount = 0
    const errors = []
    
    for (let i = 0; i < totalBatches; i++) {
      const start = i * BATCH_SIZE
      const end = Math.min(start + BATCH_SIZE, exercises.length)
      const batch = exercises.slice(start, end)
      
      console.log(`Processing batch ${i + 1}/${totalBatches} (exercises ${start + 1}-${end})`)
      
      try {
        // Map exercise data to match Supabase table structure
        const mappedData = batch.map(exercise => ({
          full_id: exercise.id,
          name: exercise.name,
          force: exercise.force,
          level: exercise.level,
          mechanic: exercise.mechanic,
          equipment: exercise.equipment,
          primary_muscles: exercise.primaryMuscles,
          secondary_muscles: exercise.secondaryMuscles,
          instructions: exercise.instructions,
          category: exercise.category,
          images: exercise.images
        }))
        
        const { data, error } = await supabase
          .from('exercises')
          .insert(mappedData)
          .select()
        
        if (error) {
          throw error
        }
        
        successCount += batch.length
        console.log(`✓ Batch ${i + 1} inserted successfully (${batch.length} records)`)
        
        // Add a small delay between batches to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100))
        
      } catch (error) {
        errorCount += batch.length
        errors.push({
          batch: i + 1,
          range: `${start + 1}-${end}`,
          error: error.message
        })
        console.error(`✗ Batch ${i + 1} failed:`, error.message)
      }
    }
    
    // Summary
    console.log('\n=== Summary ===')
    console.log(`Total exercises: ${exercises.length}`)
    console.log(`Successfully inserted: ${successCount}`)
    console.log(`Failed: ${errorCount}`)
    
    if (errors.length > 0) {
      console.log('\n=== Errors ===')
      errors.forEach((err, idx) => {
        console.log(`${idx + 1}. Batch ${err.batch} (exercises ${err.range}): ${err.error}`)
      })
    }
    
  } catch (error) {
    console.error('Fatal error:', error)
    process.exit(1)
  }
}

// Run the script
populateExercises()
  .then(() => {
    console.log('\nScript completed')
    process.exit(0)
  })
  .catch((error) => {
    console.error('Script failed:', error)
    process.exit(1)
  })
