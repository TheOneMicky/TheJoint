import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { useSearchParams } from 'react-router-dom'
import { 
  Search, 
  Plus, 
  X, 
  ChevronDown,
  Dumbbell,
  Clock,
  ArrowLeft,
  Loader2,
  Check,
  HelpCircle,
  Filter,
  ChevronUp,
  ChevronDown as ArrowDown
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'

// Debounce hook
function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return debouncedValue
}

export default function CreateTemplate() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const editTemplateId = searchParams.get('edit')

  const GITHUB_BASE_URL = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/'

  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [isSearching, setIsSearching] = useState(false)
  const [selectedExercises, setSelectedExercises] = useState([])
  const [templateName, setTemplateName] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [isLoading, setIsLoading] = useState(!!editTemplateId)
  const [selectedCategory, setSelectedCategory] = useState('')
  const [selectedExercise, setSelectedExercise] = useState(null) // For instruction modal
  const [infoExercise, setInfoExercise] = useState(null) // For info modal with question mark
  const [masterLibrary, setMasterLibrary] = useState([]) // All exercises loaded once
  const [libraryLoading, setLibraryLoading] = useState(true)
  const [selectedForce, setSelectedForce] = useState('')
  const [selectedLevel, setSelectedLevel] = useState('')
  const [selectedMechanic, setSelectedMechanic] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const searchContainerRef = useRef(null)

  const debouncedSearch = useDebounce(searchQuery, 300)

  // Load master library on component mount
  useEffect(() => {
    loadMasterLibrary()
  }, [])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target)) {
        setShowDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const loadMasterLibrary = async () => {
    try {
      const { data, error } = await supabase
        .from('exercises')
        .select('*')

      if (error) throw error
      setMasterLibrary(data || [])
    } catch (error) {
      console.error('Error loading exercise library:', error)
    } finally {
      setLibraryLoading(false)
    }
  }

  // Search exercises when debounced query changes or any filter changes
  useEffect(() => {
    if (masterLibrary.length > 0) {
      // Filtering is now done via useMemo, just trigger re-render
    }
  }, [debouncedSearch, selectedCategory, selectedForce, selectedLevel, selectedMechanic, masterLibrary])

  // Load template data if editing
  useEffect(() => {
    if (editTemplateId) {
      loadTemplateForEdit()
    }
  }, [editTemplateId])

  // Extract unique categories and primaryMuscles for filter chips
  const uniqueCategories = useMemo(() => {
    const categories = new Set()
    masterLibrary.forEach(ex => {
      if (ex.category) categories.add(ex.category)
    })
    return Array.from(categories).sort()
  }, [masterLibrary])

  const uniquePrimaryMuscles = useMemo(() => {
    const muscles = new Set()
    masterLibrary.forEach(ex => {
      if (ex.primaryMuscles && Array.isArray(ex.primaryMuscles)) {
        ex.primaryMuscles.forEach(m => muscles.add(m))
      }
    })
    return Array.from(muscles).sort()
  }, [masterLibrary])

  // Extract unique force, level, and mechanic values
  const uniqueForce = useMemo(() => {
    const forces = new Set()
    masterLibrary.forEach(ex => {
      if (ex.force) forces.add(ex.force)
    })
    return Array.from(forces).filter(f => f).sort()
  }, [masterLibrary])

  const uniqueLevel = useMemo(() => {
    const levels = new Set()
    masterLibrary.forEach(ex => {
      if (ex.level) levels.add(ex.level)
    })
    return Array.from(levels).filter(l => l).sort()
  }, [masterLibrary])

  const uniqueMechanic = useMemo(() => {
    const mechanics = new Set()
    masterLibrary.forEach(ex => {
      if (ex.mechanic) mechanics.add(ex.mechanic)
    })
    return Array.from(mechanics).filter(m => m).sort()
  }, [masterLibrary])

  // Client-side filtering with useMemo for performance
  const filteredResults = useMemo(() => {
    let results = masterLibrary

    // Filter by search query
    if (debouncedSearch.trim()) {
      const query = debouncedSearch.toLowerCase()
      results = results.filter(ex => 
        ex.name?.toLowerCase().includes(query) ||
        ex.primaryMuscles?.some(m => m?.toLowerCase().includes(query))
      )
    }

    // Filter by selected category
    if (selectedCategory) {
      results = results.filter(ex => 
        ex.category === selectedCategory ||
        ex.primaryMuscles?.includes(selectedCategory)
      )
    }

    // Filter by force
    if (selectedForce) {
      results = results.filter(ex => ex.force === selectedForce)
    }

    // Filter by level
    if (selectedLevel) {
      results = results.filter(ex => ex.level === selectedLevel)
    }

    // Filter by mechanic
    if (selectedMechanic) {
      results = results.filter(ex => ex.mechanic === selectedMechanic)
    }

    return results
  }, [masterLibrary, debouncedSearch, selectedCategory, selectedForce, selectedLevel, selectedMechanic])

  // Update searchResults when filteredResults changes
  useEffect(() => {
    setSearchResults(filteredResults)
  }, [filteredResults])

  const loadTemplateForEdit = async () => {
    try {
      const { data: template, error } = await supabase
        .from('workout_templates')
        .select(`
          name,
          template_exercises (
            position,
            label,
            sets,
            reps,
            duration,
            rest_seconds,
            exercises (
              id,
              name,
              category
            )
          )
        `)
        .eq('id', editTemplateId)
        .single()

      if (error) {
        // Handle RLS policy violations
        if (error.code === '42501' || error.message.includes('permission denied')) {
          alert('You do not have permission to edit this template.')
          navigate('/dashboard')
          return
        }
        throw error
      }

      if (template) {
        setTemplateName(template.name)
        const exercises = template.template_exercises
          .sort((a, b) => a.position - b.position)
          .map(te => ({
            ...te.exercises,
            id: te.exercises.id,
            tempId: Date.now() + Math.random(),
            label: te.label,
            sets: te.sets,
            reps: te.reps,
            duration: te.duration,
            restSeconds: te.rest_seconds
          }))
        setSelectedExercises(exercises)
      }
    } catch (error) {
      console.error('Error loading template:', error)
      alert('Failed to load template. Please try again.')
      navigate('/dashboard')
    } finally {
      setIsLoading(false)
    }
  }

  /**
   * Adds an exercise from the master library to the current template.
   * 
   * Creates a new exercise object with default values for sets, reps, duration,
   * and rest seconds. Determines if the exercise is duration-based (cardio/stretching)
   * and sets appropriate default metrics. Assigns a temporary ID for local tracking.
   * 
   * @param {Object} exercise - The exercise object from the master library
   * @returns {void} Updates the selectedExercises state
   */
  const addExercise = (exercise) => {
    const isDurationBased = exercise.category === 'cardio' || exercise.category === 'stretching'
    const newExercise = {
      ...exercise,
      tempId: Date.now() + Math.random(),
      label: 'main',
      sets: 3,
      reps: isDurationBased ? null : 10,
      duration: isDurationBased ? 30 : null,
      restSeconds: 60
    }
    
    setSelectedExercises(prev => [...prev, newExercise])
    setSearchQuery('')
    setSearchResults([])
    setShowDropdown(false) // Hide dropdown after adding exercise
  }

  /**
   * Removes an exercise from the current template by its temporary ID.
   * 
   * @param {number} tempId - The temporary ID of the exercise to remove
   * @returns {void} Updates the selectedExercises state
   */
  const removeExercise = (tempId) => {
    setSelectedExercises(prev => prev.filter(ex => ex.tempId !== tempId))
  }

  /**
   * Updates a specific field of an exercise in the current template.
   * 
   * @param {number} tempId - The temporary ID of the exercise to update
   * @param {string} field - The field name to update (e.g., 'sets', 'reps', 'duration')
   * @param {any} value - The new value for the field
   * @returns {void} Updates the selectedExercises state
   */
  const updateExercise = (tempId, field, value) => {
    setSelectedExercises(prev => prev.map(ex => 
      ex.tempId === tempId ? { ...ex, [field]: value } : ex
    ))
  }

  /**
   * Reorders exercises in the template by moving an item from one index to another.
   * 
   * Uses array splicing to move the item, then recalculates the position field
   * for all exercises to maintain sequential ordering.
   * 
   * @param {number} oldIndex - The current index of the exercise to move
   * @param {number} newIndex - The target index for the exercise
   * @returns {void} Updates the selectedExercises state with new positions
   */
  const reorderExercises = (oldIndex, newIndex) => {
    setSelectedExercises(prev => {
      const newExercises = [...prev]
      const [movedItem] = newExercises.splice(oldIndex, 1)
      newExercises.splice(newIndex, 0, movedItem)
      
      // Recalculate position for all items
      return newExercises.map((ex, index) => ({
        ...ex,
        position: index + 1
      }))
    })
  }

  /**
   * Saves the current workout template to the database.
   * 
   * Validates the template name and exercise list, performs UUID validation on
   * all exercise IDs, then either creates a new template or updates an existing one.
   * In CREATE mode, implements a rollback mechanism to delete orphaned templates
   * if exercise insertion fails. In UPDATE mode, replaces all template_exercises.
   * 
   * @returns {Promise<void>} Resolves when the template is successfully saved
   */
  const saveTemplate = async () => {
    // Strict Validation: Cannot trigger unless selectedExercises.length > 0
    if (!templateName.trim()) {
      alert('Please enter a template name.');
      return;
    }
    if (selectedExercises.length === 0) {
      alert('Please add at least one exercise to your template.');
      return;
    }

    setIsSaving(true);
    try {
      let templateId;

      // UUID Validation: Check if any exercise_id is not a valid UUID
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      
      for (const exercise of selectedExercises) {
        const exerciseId = exercise.id;
        if (!exerciseId || typeof exerciseId !== 'string' || !uuidRegex.test(exerciseId)) {
          console.error('INVALID UUID DETECTED:', {
            exercise: exercise.name,
            exerciseId: exerciseId,
            type: typeof exerciseId,
            isValidUUID: exerciseId && typeof exerciseId === 'string' ? uuidRegex.test(exerciseId) : false
          });
          throw new Error(`Invalid exercise_id for "${exercise.name}". Expected UUID format, got: ${exerciseId}`);
        }
      }

      if (editTemplateId) {
        // UPDATE MODE: Delete existing template_exercises then insert new ones
        templateId = editTemplateId;
        
        // Step 1: Update template name
        const { error: updateError } = await supabase
          .from('workout_templates')
          .update({ name: templateName.trim() })
          .eq('id', templateId);

        if (updateError) {
          console.error('TEMPLATE UPDATE ERROR:', updateError);
          throw new Error(`Failed to update template: ${updateError.message}`);
        }

        // Step 2: Delete all existing template_exercises
        const { error: deleteError } = await supabase
          .from('template_exercises')
          .delete()
          .eq('template_id', templateId);

        if (deleteError) {
          console.error('DELETE TEMPLATE_EXERCISES ERROR:', deleteError);
          throw new Error(`Failed to update exercises: ${deleteError.message}`);
        }

        console.log('UPDATE MODE: Deleted existing exercises, ready to insert new ones');
      } else {
        // CREATE MODE: Insert new template
        const { data: template, error: templateError } = await supabase
          .from('workout_templates')
          .insert({
            name: templateName.trim(),
            user_id: user.id
          })
          .select()
          .single();

        if (templateError) {
          console.error('TEMPLATE CREATE ERROR:', templateError);
          
          if (templateError.code === '42501' || templateError.message.includes('permission denied')) {
            throw new Error('Permission Denied: You do not have permission to create templates.');
          }
          
          throw new Error(`Failed to create template: ${templateError.message}`);
        }

        templateId = template.id;
        console.log('CREATE MODE: Template created with ID:', templateId);
      }

      // Step 3: Map exercises with proper UUID identity mapping
      const templateExercises = selectedExercises.map((ex) => {
        const isDurationBased = ex.category === 'cardio' || ex.category === 'stretching';
        
        return {
          template_id: templateId,
          exercise_id: ex.id, // Using validated UUID
          position: ex.position || 0, // Use updated position from state
          label: ex.label || 'main',
          sets: parseInt(ex.sets) || 3,
          reps: isDurationBased ? null : (parseInt(ex.reps) || 10),
          duration: isDurationBased ? (parseInt(ex.duration) || 30) : null,
          rest_seconds: parseInt(ex.restSeconds) || 60
        };
      });

      console.log('MAPPED EXERCISES:', templateExercises.length, 'exercises ready for insert');

      // Step 4: Insert the mapped exercises
      const { error: exercisesError } = await supabase
        .from('template_exercises')
        .insert(templateExercises);

      if (exercisesError) {
        console.error('TEMPLATE_EXERCISES INSERT ERROR:', exercisesError);
        
        // If this was CREATE mode, perform rollback
        if (!editTemplateId) {
          await supabase
            .from('workout_templates')
            .delete()
            .eq('id', templateId);
        }
        
        if (exercisesError.code === '23503') {
          throw new Error('Foreign Key Error: One or more exercise_ids do not exist in the exercises table.');
        }
        
        throw new Error(`Failed to save exercises: ${exercisesError.message}`);
      }

      console.log('SUCCESS: Template exercises saved successfully');

      // Show success state before navigating
      setSaveSuccess(true);
      setTimeout(() => {
        navigate('/dashboard');
      }, 1000);
    } catch (error) {
      console.error('SAVE TEMPLATE ERROR:', error);
      alert(error.message || 'Failed to save template. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const labelOptions = [
    { value: 'warmup', label: 'Warmup' },
    { value: 'main', label: 'Main Set' },
    { value: 'finisher', label: 'Finisher' },
    { value: 'cooldown', label: 'Cooldown' }
  ]

  const bodyPartOptions = [
    { value: 'back', label: 'Back' },
    { value: 'chest', label: 'Chest' },
    { value: 'legs', label: 'Legs' },
    { value: 'shoulders', label: 'Shoulders' },
    { value: 'arms', label: 'Arms' },
    { value: 'core', label: 'Core' },
    { value: 'cardio', label: 'Cardio' },
    { value: 'full body', label: 'Full Body' }
  ]

  // Use dynamic filter options from the data
  const filterOptions = useMemo(() => {
    return [
      { value: '', label: 'All' },
      ...uniqueCategories.map(cat => ({ value: cat, label: cat })),
      ...uniquePrimaryMuscles.map(muscle => ({ value: muscle, label: muscle }))
    ].filter((item, index, self) => 
      index === self.findIndex(t => t.value === item.value)
    )
  }, [uniqueCategories, uniquePrimaryMuscles])

  // Group exercises by category if no search query
  const groupedResults = searchQuery.trim() 
    ? { '': searchResults }
    : searchResults.reduce((groups, exercise) => {
      const part = exercise.category || exercise.primaryMuscles?.[0] || 'Other'
      if (!groups[part]) groups[part] = []
      groups[part].push(exercise)
      return groups
    }, {})

  if (isLoading || libraryLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-zinc-950">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto border-orange-600 dark:border-orange-500"></div>
          <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
            {isLoading ? 'Loading template...' : 'Loading exercise library...'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen pb-32 bg-white dark:bg-zinc-950 scrollbar-thin">
      {/* Header */}
      <header className="nav-bar sticky top-0 z-20 px-4 py-4 safe-top">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center">
            <button 
              onClick={() => navigate('/dashboard')}
              className="btn-icon mr-3"
            >
              <ArrowLeft className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
            </button>
            <h1 className="text-xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
              {editTemplateId ? 'Edit Template' : 'Create Template'}
            </h1>
          </div>
          <button
            onClick={saveTemplate}
            disabled={!templateName.trim() || selectedExercises.length === 0 || isSaving || saveSuccess}
            className="btn-primary px-6 py-2.5"
          >
            {isSaving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : saveSuccess ? (
              <Check className="w-5 h-5 font-bold" strokeWidth={3} />
            ) : (
              'Save'
            )}
          </button>
        </div>
      </header>

      <main className="px-4 py-6 max-w-4xl mx-auto animate-slide-up">
        {/* Template Name Input */}
        <div className="mb-6">
          <label className="block text-sm font-medium mb-2 text-zinc-600 dark:text-zinc-400">
            Template Name
          </label>
          <input
            type="text"
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
            placeholder="e.g., Morning HIIT Blast"
            className="input-field text-base"
          />
        </div>

        {/* Search Bar */}
        <div className="mb-6 relative" ref={searchContainerRef}>
          <label className="block text-sm font-medium mb-2 text-zinc-600 dark:text-zinc-400">
            Add Exercises
          </label>
          <div className="relative">
            <div className="flex items-center gap-3">
              <Search className="w-5 h-5 text-zinc-400 dark:text-zinc-500 flex-shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setShowDropdown(true)}
                onClick={() => setShowDropdown(true)}
                placeholder="Search exercises..."
                className="input-field"
              />
            </div>
          </div>

          {/* Category Filter - Dynamic chips */}
          <div className="mt-3">
            <div className="flex items-center gap-2 mb-2">
              <Filter className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
              <span className="text-sm text-zinc-600 dark:text-zinc-400">Filter by:</span>
            </div>
            <div className="flex flex-wrap gap-2 mb-3">
              {filterOptions.slice(0, 15).map(option => (
                <button
                  key={option.value}
                  onClick={() => setSelectedCategory(option.value)}
                  className={`text-xs px-3 py-1.5 rounded-full transition-colors ${
                    selectedCategory === option.value
                      ? 'bg-orange-600 dark:bg-orange-500 text-white'
                      : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                  }`}
                >
                  {option.label}
                </button>
              ))}
              {selectedCategory && (
                <button
                  onClick={() => setSelectedCategory('')}
                  className="text-xs px-3 py-1.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Advanced Filters */}
            <div className="grid grid-cols-3 gap-2">
              {/* Force Filter */}
              <select
                value={selectedForce}
                onChange={(e) => setSelectedForce(e.target.value)}
                className="text-xs px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-950 dark:text-zinc-50 focus:outline-none focus:ring-2 focus:ring-orange-500"
              >
                <option value="">Force</option>
                {uniqueForce.map(force => (
                  <option key={force} value={force}>{force}</option>
                ))}
              </select>

              {/* Level Filter */}
              <select
                value={selectedLevel}
                onChange={(e) => setSelectedLevel(e.target.value)}
                className="text-xs px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-950 dark:text-zinc-50 focus:outline-none focus:ring-2 focus:ring-orange-500"
              >
                <option value="">Level</option>
                {uniqueLevel.map(level => (
                  <option key={level} value={level}>{level}</option>
                ))}
              </select>

              {/* Mechanic Filter */}
              <select
                value={selectedMechanic}
                onChange={(e) => setSelectedMechanic(e.target.value)}
                className="text-xs px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-950 dark:text-zinc-50 focus:outline-none focus:ring-2 focus:ring-orange-500"
              >
                <option value="">Mechanic</option>
                {uniqueMechanic.map(mechanic => (
                  <option key={mechanic} value={mechanic}>{mechanic}</option>
                ))}
              </select>
            </div>

            {/* Clear All Filters */}
            {(selectedForce || selectedLevel || selectedMechanic) && (
              <button
                onClick={() => {
                  setSelectedForce('')
                  setSelectedLevel('')
                  setSelectedMechanic('')
                }}
                className="text-xs text-orange-600 dark:text-orange-500 hover:underline mt-2"
              >
                Clear advanced filters
              </button>
            )}
          </div>

          {/* Search Results */}
          {showDropdown && searchResults.length > 0 && (
            <div className="absolute z-20 w-full mt-2 rounded-xl overflow-hidden shadow-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 max-h-[400px] overflow-y-auto scrollbar-custom">
              {Object.entries(groupedResults).map(([bodyPart, exercises]) => (
                <div key={bodyPart}>
                  {bodyPart && (
                    <div className="px-4 py-2 bg-zinc-100 dark:bg-zinc-800 text-xs font-semibold text-zinc-600 dark:text-zinc-400">
                      {bodyPart}
                    </div>
                  )}
                  {exercises.map((exercise) => (
                    <div 
                      key={exercise.id}
                      className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 transition-colors cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800"
                      onClick={() => addExercise(exercise)}
                    >
                      <div className="flex items-center flex-1">
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center mr-3 bg-orange-100 dark:bg-orange-900/30">
                          <Dumbbell className="w-5 h-5 text-orange-600 dark:text-orange-500" />
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-zinc-950 dark:text-zinc-50">{exercise.name}</p>
                          <div className="flex items-center gap-2 mt-1">
                            {exercise.primaryMuscles && exercise.primaryMuscles.length > 0 && (
                              <span className="text-xs px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">
                                {exercise.primaryMuscles[0]}
                              </span>
                            )}
                            {exercise.equipment && (
                              <span className="text-xs px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                                {exercise.equipment}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setInfoExercise(exercise)
                          }}
                          className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                          title="View exercise info"
                        >
                          <HelpCircle className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
                        </button>
                        <button 
                          className="p-2 rounded-lg bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-500 hover:bg-orange-200 dark:hover:bg-orange-900/50 transition-colors"
                        >
                          <Plus className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}

          {debouncedSearch && !isSearching && searchResults.length === 0 && (
            <div className="absolute z-20 w-full mt-2 rounded-xl p-4 text-center bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
              <p className="text-zinc-500 dark:text-zinc-400">No exercises found</p>
            </div>
          )}
        </div>

        {/* Selected Exercises List */}
        <div className="space-y-4 scrollbar-custom">
          <h2 className="text-lg font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
            Exercises ({selectedExercises.length})
          </h2>

          {selectedExercises.length === 0 ? (
            <div className="bento-card p-8 text-center border-dashed">
              <Dumbbell className="w-12 h-12 mx-auto mb-3 text-zinc-400 dark:text-zinc-600" />
              <p className="text-zinc-500 dark:text-zinc-400">
                Search and add exercises to build your template
              </p>
            </div>
          ) : (
            selectedExercises.map((exercise, index) => (
              <div 
                key={exercise.tempId}
                className="bento-card p-4"
              >
                {/* Exercise Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center flex-1">
                    <span 
                      className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium mr-3 bg-orange-600 dark:bg-orange-500 text-white"
                    >
                      {index + 1}
                    </span>
                    <div className="flex-1">
                      <h3 className="font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">{exercise.name}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        {exercise.primaryMuscles && exercise.primaryMuscles.length > 0 && (
                          <span className="text-xs px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">
                            {exercise.primaryMuscles[0]}
                          </span>
                        )}
                        {exercise.equipment && (
                          <span className="text-xs px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                            {exercise.equipment}
                          </span>
                        )}
                        {exercise.level && (
                          <span className="text-xs px-2 py-0.5 rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                            {exercise.level}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        if (index > 0) reorderExercises(index, index - 1)
                      }}
                      disabled={index === 0}
                      className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Move Up"
                    >
                      <ChevronUp className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        if (index < selectedExercises.length - 1) reorderExercises(index, index + 1)
                      }}
                      disabled={index === selectedExercises.length - 1}
                      className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Move Down"
                    >
                      <ArrowDown className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setInfoExercise(exercise)
                      }}
                      className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                      title="View exercise info"
                    >
                      <HelpCircle className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
                    </button>
                    <button
                      onClick={() => removeExercise(exercise.tempId)}
                      className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Exercise Settings */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {/* Label Dropdown */}
                  <div>
                    <label className="text-xs mb-1 block text-zinc-500 dark:text-zinc-400">
                      Label
                    </label>
                    <div className="relative">
                      <select
                        value={exercise.label}
                        onChange={(e) => updateExercise(exercise.tempId, 'label', e.target.value)}
                        className="w-full px-3 py-2 rounded-lg text-sm appearance-none cursor-pointer bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-950 dark:text-zinc-50 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      >
                        {labelOptions.map(option => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <ChevronDown 
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 pointer-events-none text-zinc-500 dark:text-zinc-400" 
                      />
                    </div>
                  </div>

                  {/* Sets Input */}
                  <div>
                    <label className="text-xs mb-1 block text-zinc-500 dark:text-zinc-400">
                      Sets
                    </label>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => updateExercise(exercise.tempId, 'sets', Math.max(1, (exercise.sets || 1) - 1))}
                        className="p-1.5 rounded bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-colors text-xs font-bold"
                        title="-1"
                      >
                        -1
                      </button>
                      <input
                        type="number"
                        value={exercise.sets}
                        onChange={(e) => updateExercise(exercise.tempId, 'sets', parseInt(e.target.value) || 1)}
                        min="1"
                        className="w-16 px-2 py-2 rounded-lg text-center text-sm bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-950 dark:text-zinc-50 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent appearance-none [-moz-appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                      <button
                        onClick={() => updateExercise(exercise.tempId, 'sets', (exercise.sets || 1) + 1)}
                        className="p-1.5 rounded bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-colors text-xs font-bold"
                        title="+1"
                      >
                        +1
                      </button>
                    </div>
                  </div>

                  {/* Reps/Duration Input */}
                  <div>
                    <label className="text-xs mb-1 block text-zinc-500 dark:text-zinc-400">
                      {exercise.category === 'cardio' || exercise.category === 'stretching' ? (
                        <><Clock className="inline w-3 h-3 mr-1" />Duration (s)</>
                      ) : (
                        <><Dumbbell className="inline w-3 h-3 mr-1" />Reps</>
                      )}
                    </label>
                    <div className="flex items-center gap-1">
                      {exercise.category === 'cardio' || exercise.category === 'stretching' ? (
                        // Duration-based inputs
                        <>
                          <button
                            onClick={() => updateExercise(exercise.tempId, 'duration', Math.max(1, (exercise.duration || 1) - 10))}
                            className="p-1.5 rounded bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-colors text-xs font-bold"
                            title="-10"
                          >
                            -10
                          </button>
                          <button
                            onClick={() => updateExercise(exercise.tempId, 'duration', Math.max(1, (exercise.duration || 1) - 1))}
                            className="p-1.5 rounded bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-colors text-xs font-bold"
                            title="-1"
                          >
                            -1
                          </button>
                          <input
                            type="number"
                            value={exercise.duration || ''}
                            onChange={(e) => updateExercise(exercise.tempId, 'duration', parseInt(e.target.value) || 0)}
                            min="1"
                            className="w-16 px-2 py-2 rounded-lg text-center text-sm bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-950 dark:text-zinc-50 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent appearance-none [-moz-appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                          <button
                            onClick={() => updateExercise(exercise.tempId, 'duration', (exercise.duration || 1) + 1)}
                            className="p-1.5 rounded bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-colors text-xs font-bold"
                            title="+1"
                          >
                            +1
                          </button>
                          <button
                            onClick={() => updateExercise(exercise.tempId, 'duration', (exercise.duration || 1) + 10)}
                            className="p-1.5 rounded bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-colors text-xs font-bold"
                            title="+10"
                          >
                            +10
                          </button>
                        </>
                      ) : (
                        // Rep-based inputs
                        <>
                          <button
                            onClick={() => updateExercise(exercise.tempId, 'reps', Math.max(1, (exercise.reps || 1) - 10))}
                            className="p-1.5 rounded bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-colors text-xs font-bold"
                            title="-10"
                          >
                            -10
                          </button>
                          <button
                            onClick={() => updateExercise(exercise.tempId, 'reps', Math.max(1, (exercise.reps || 1) - 1))}
                            className="p-1.5 rounded bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-colors text-xs font-bold"
                            title="-1"
                          >
                            -1
                          </button>
                          <input
                            type="number"
                            value={exercise.reps}
                            onChange={(e) => updateExercise(exercise.tempId, 'reps', parseInt(e.target.value) || 1)}
                            min="1"
                            className="w-16 px-2 py-2 rounded-lg text-center text-sm bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-950 dark:text-zinc-50 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent appearance-none [-moz-appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                          <button
                            onClick={() => updateExercise(exercise.tempId, 'reps', (exercise.reps || 1) + 1)}
                            className="p-1.5 rounded bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-colors text-xs font-bold"
                            title="+1"
                          >
                            +1
                          </button>
                          <button
                            onClick={() => updateExercise(exercise.tempId, 'reps', (exercise.reps || 1) + 10)}
                            className="p-1.5 rounded bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-colors text-xs font-bold"
                            title="+10"
                          >
                            +10
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Rest Duration */}
                  <div>
                    <label className="text-xs mb-1 block text-zinc-500 dark:text-zinc-400">
                      <Clock className="w-3 h-3 inline mr-1 text-orange-600 dark:text-orange-500" />
                      Rest (s)
                    </label>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => updateExercise(exercise.tempId, 'restSeconds', Math.max(0, (exercise.restSeconds || 0) - 10))}
                        className="p-1.5 rounded bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-colors text-xs font-bold"
                        title="-10"
                      >
                        -10
                      </button>
                      <button
                        onClick={() => updateExercise(exercise.tempId, 'restSeconds', Math.max(0, (exercise.restSeconds || 0) - 1))}
                        className="p-1.5 rounded bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-colors text-xs font-bold"
                        title="-1"
                      >
                        -1
                      </button>
                      <input
                        type="number"
                        value={exercise.restSeconds}
                        onChange={(e) => updateExercise(exercise.tempId, 'restSeconds', parseInt(e.target.value) || 0)}
                        min="0"
                        step="15"
                        className="w-16 px-2 py-2 rounded-lg text-center text-sm bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-950 dark:text-zinc-50 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent appearance-none [-moz-appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                      <button
                        onClick={() => updateExercise(exercise.tempId, 'restSeconds', (exercise.restSeconds || 0) + 1)}
                        className="p-1.5 rounded bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-colors text-xs font-bold"
                        title="+1"
                      >
                        +1
                      </button>
                      <button
                        onClick={() => updateExercise(exercise.tempId, 'restSeconds', (exercise.restSeconds || 0) + 10)}
                        className="p-1.5 rounded bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-colors text-xs font-bold"
                        title="+10"
                      >
                        +10
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </main>

      {/* Info Modal */}
      {infoExercise && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={() => setInfoExercise(null)}
        >
          <div 
            className="bg-white dark:bg-zinc-900 rounded-2xl max-w-lg w-full max-h-[80vh] overflow-hidden shadow-2xl animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-800">
              <h3 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">{infoExercise.name}</h3>
              <button
                onClick={() => setInfoExercise(null)}
                className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                <X className="w-5 h-5 text-zinc-500 dark:text-zinc-400" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[60vh]">
              {/* Exercise Image/GIF */}
              {(() => {
                const imageUrl = infoExercise.images && infoExercise.images.length > 0 
                  ? infoExercise.images[0] 
                  : `${GITHUB_BASE_URL}${infoExercise.id}/0.jpg`;
                
                return (
                  <div className="mb-4">
                    <img 
                      src={imageUrl} 
                      alt={infoExercise.name}
                      className="w-full h-48 object-contain rounded-lg bg-zinc-100 dark:bg-zinc-800"
                      onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.parentElement.innerHTML = `
                          <div class="w-full h-48 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex flex-col items-center justify-center border-2 border-dashed border-zinc-300 dark:border-zinc-700">
                            <svg class="w-12 h-12 text-zinc-400 dark:text-zinc-600 mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
                            </svg>
                            <p class="text-sm text-zinc-500 dark:text-zinc-400">Visual Guide Coming Soon</p>
                          </div>
                        `;
                      }}
                    />
                  </div>
                );
              })()}

              {/* Muscle Badges */}
              <div className="space-y-2 mb-4">
                {/* Row 1: Targets (Primary Muscles) - Solid orange background */}
                {infoExercise.primaryMuscles && infoExercise.primaryMuscles.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400 mr-2">Targets:</span>
                    {infoExercise.primaryMuscles.map((muscle, idx) => (
                      <span 
                        key={idx}
                        className="text-xs px-2 py-1 rounded-full bg-orange-600 dark:bg-orange-500 text-white"
                      >
                        {muscle}
                      </span>
                    ))}
                  </div>
                )}

                {/* Row 2: Assisting (Secondary Muscles) - Outlined grey badges */}
                {infoExercise.secondaryMuscles && infoExercise.secondaryMuscles.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400 mr-2">Assisting:</span>
                    {infoExercise.secondaryMuscles.map((muscle, idx) => (
                      <span 
                        key={idx}
                        className="text-xs px-2 py-1 rounded-full border border-zinc-400 dark:border-zinc-600 text-zinc-600 dark:text-zinc-400 bg-transparent"
                      >
                        {muscle}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Other Metadata badges */}
              <div className="flex flex-wrap gap-2 mb-4">
                {infoExercise.equipment && (
                  <span className="text-xs px-2 py-1 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                    Equipment: {infoExercise.equipment}
                  </span>
                )}
                {infoExercise.level && (
                  <span className="text-xs px-2 py-1 rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                    Level: {infoExercise.level}
                  </span>
                )}
                {infoExercise.category && (
                  <span className="text-xs px-2 py-1 rounded bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400">
                    {infoExercise.category}
                  </span>
                )}
              </div>

              {/* Instructions */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">Instructions:</h4>
                {infoExercise.instructions && Array.isArray(infoExercise.instructions) ? (
                  <ol className="list-decimal list-inside space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
                    {infoExercise.instructions.map((instruction, idx) => (
                      <li key={idx}>{instruction}</li>
                    ))}
                  </ol>
                ) : infoExercise.instructions ? (
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">{infoExercise.instructions}</p>
                ) : (
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">No instructions available.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
