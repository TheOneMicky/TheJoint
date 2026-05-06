import { supabase } from './supabase'

/**
 * Import exercises from JSON array to Supabase
 * Maps open-source format fields to Supabase 'exercises' table columns
 * Uses upsert to handle bulk inserts/updates
 * 
 * @param {Array} exercisesJson - Array of exercise objects from JSON file
 * @param {Object} options - Optional configuration
 * @param {Function} options.onProgress - Callback for progress updates (completed, total)
 * @param {number} options.batchSize - Number of exercises to insert per batch (default: 100)
 * @returns {Promise<{success: number, failed: number, errors: Array}>}
 */
export async function importExercises(exercisesJson, options = {}) {
  const { onProgress, batchSize = 100 } = options
  
  if (!Array.isArray(exercisesJson)) {
    throw new Error('Input must be an array of exercise objects')
  }

  const results = {
    success: 0,
    failed: 0,
    errors: []
  }

  // Process in batches to avoid overwhelming the API
  for (let i = 0; i < exercisesJson.length; i += batchSize) {
    const batch = exercisesJson.slice(i, i + batchSize)
    
    // Map each exercise to Supabase schema
    const mappedBatch = batch.map(exercise => mapExerciseToSchema(exercise))
    
    try {
      // Use upsert to insert or update existing exercises
      const { data, error } = await supabase
        .from('exercises')
        .upsert(mappedBatch, {
          onConflict: 'name', // Assuming 'name' is the unique identifier
          ignoreDuplicates: false // Update existing records
        })

      if (error) {
        console.error('Batch insert error:', error)
        results.failed += batch.length
        results.errors.push({
          batchIndex: i,
          error: error.message,
          exercises: batch.map(e => e.exercise_name || e.name)
        })
      } else {
        results.success += batch.length
        console.log(`Successfully imported batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(exercisesJson.length / batchSize)}`)
      }

      // Progress callback
      if (onProgress) {
        onProgress(Math.min(i + batch.length, exercisesJson.length), exercisesJson.length)
      }

      // Small delay between batches to be nice to the API
      if (i + batchSize < exercisesJson.length) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }

    } catch (err) {
      console.error('Unexpected error during batch import:', err)
      results.failed += batch.length
      results.errors.push({
        batchIndex: i,
        error: err.message,
        exercises: batch.map(e => e.exercise_name || e.name)
      })
    }
  }

  console.log(`Import complete: ${results.success} successful, ${results.failed} failed`)
  return results
}

/**
 * Map open-source exercise format to Supabase schema
 * Handles various common field naming conventions
 * 
 * @param {Object} exercise - Exercise object from JSON
 * @returns {Object} - Mapped exercise object for Supabase
 */
function mapExerciseToSchema(exercise) {
  // Field mappings from open-source formats to Supabase columns
  const fieldMappings = {
    // Name variations
    name: ['exercise_name', 'name', 'title', 'exercise', 'workout_name'],
    
    // Target muscle/body part variations
    target: ['target', 'muscle_group', 'muscle', 'primary_muscle', 'body_part', 'muscle_targeted'],
    
    // Equipment variations
    equipment: ['equipment', 'equipment_needed', 'gear', 'tools'],
    
    // GIF/Animation URL variations
    gif_url: ['gif_url', 'gifUrl', 'animation_url', 'video_url', 'media_url', 'image_url', 'gif'],
    
    // Difficulty level variations
    difficulty: ['difficulty', 'level', 'intensity', 'skill_level'],
    
    // Exercise type/category variations
    type: ['type', 'category', 'exercise_type', 'classification'],
    
    // Description variations
    description: ['description', 'desc', 'summary', 'overview']
  }

  const mapped = {}

  // Map each field using the first matching key found
  for (const [supabaseField, possibleKeys] of Object.entries(fieldMappings)) {
    for (const key of possibleKeys) {
      if (exercise[key] !== undefined && exercise[key] !== null) {
        mapped[supabaseField] = exercise[key]
        break
      }
    }
  }

  // Handle instructions field specially - convert to JSONB
  mapped.instructions = extractInstructions(exercise)

  // Ensure required fields have defaults
  mapped.target = mapped.target || 'full body'
  mapped.equipment = mapped.equipment || 'bodyweight'
  mapped.difficulty = mapped.difficulty || 'intermediate'

  // Clean up the data
  mapped.name = mapped.name?.toString().trim()
  mapped.target = mapped.target?.toString().toLowerCase().trim()
  mapped.equipment = mapped.equipment?.toString().toLowerCase().trim()

  return mapped
}

/**
 * Extract and format instructions as JSONB
 * Handles various instruction formats (string, array, object)
 * 
 * @param {Object} exercise - Exercise object
 * @returns {Object|null} - Formatted instructions for JSONB storage
 */
function extractInstructions(exercise) {
  const instructionFields = [
    'instructions',
    'steps',
    'procedure',
    'how_to',
    'howTo',
    'guide',
    'directions',
    'execution',
    'technique'
  ]

  let instructions = null

  // Find the first matching instruction field
  for (const field of instructionFields) {
    if (exercise[field] !== undefined && exercise[field] !== null) {
      instructions = exercise[field]
      break
    }
  }

  if (!instructions) {
    return null
  }

  // Format based on type
  if (typeof instructions === 'string') {
    // Split by newlines or periods to create an array of steps
    const steps = instructions
      .split(/\n|\r\n|\.(?=\s)/)
      .map(step => step.trim())
      .filter(step => step.length > 0)
    
    return {
      text: instructions,
      steps: steps,
      format: 'text'
    }
  }

  if (Array.isArray(instructions)) {
    return {
      text: instructions.join('. '),
      steps: instructions.filter(step => step && step.trim()),
      format: 'array'
    }
  }

  if (typeof instructions === 'object') {
    // Already an object, store as-is with metadata
    return {
      ...instructions,
      format: 'structured'
    }
  }

  return { text: String(instructions), format: 'unknown' }
}

/**
 * Preview the mapping without importing
 * Useful for validating data before actual import
 * 
 * @param {Array} exercisesJson - Array of exercise objects
 * @param {number} limit - Number of exercises to preview (default: 5)
 * @returns {Array} - Array of mapped exercises
 */
export function previewMapping(exercisesJson, limit = 5) {
  if (!Array.isArray(exercisesJson)) {
    throw new Error('Input must be an array of exercise objects')
  }

  return exercisesJson
    .slice(0, limit)
    .map(exercise => ({
      original: exercise,
      mapped: mapExerciseToSchema(exercise)
    }))
}

/**
 * Validate exercise data before import
 * Checks for required fields and data integrity
 * 
 * @param {Array} exercisesJson - Array of exercise objects
 * @returns {Object} - Validation results with valid and invalid exercises
 */
export function validateExercises(exercisesJson) {
  if (!Array.isArray(exercisesJson)) {
    return {
      valid: [],
      invalid: [{ error: 'Input must be an array', index: -1 }],
      summary: { total: 0, valid: 0, invalid: 1 }
    }
  }

  const valid = []
  const invalid = []

  exercisesJson.forEach((exercise, index) => {
    const errors = []

    // Check for name (required)
    const hasName = ['exercise_name', 'name', 'title', 'exercise', 'workout_name']
      .some(key => exercise[key] && String(exercise[key]).trim())

    if (!hasName) {
      errors.push('Missing required field: name')
    }

    if (errors.length === 0) {
      valid.push({ exercise, index })
    } else {
      invalid.push({ exercise, index, errors })
    }
  })

  return {
    valid,
    invalid,
    summary: {
      total: exercisesJson.length,
      valid: valid.length,
      invalid: invalid.length
    }
  }
}

// Example usage:
/*
import exerciseData from '../data/exercises.json'
import { importExercises, previewMapping, validateExercises } from './lib/importExercises'

// Preview mapping
const preview = previewMapping(exerciseData, 3)
console.log('Preview:', preview)

// Validate data
const validation = validateExercises(exerciseData)
console.log('Validation:', validation.summary)

// Import with progress tracking
const results = await importExercises(exerciseData, {
  onProgress: (completed, total) => {
    console.log(`Progress: ${completed}/${total}`)
  },
  batchSize: 50
})

console.log('Import results:', results)
*/
