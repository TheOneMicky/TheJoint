import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { 
  Dumbbell, 
  Plus, 
  Play,
  MoreVertical,
  Users,
  Trash2,
  Edit,
  X
} from 'lucide-react'
import { useNavigate, useLocation } from 'react-router-dom'
import LoadingScreen from '../components/LoadingScreen'
import MatchmakingLobby from '../components/MatchmakingLobby'

export default function WorkoutDashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [templates, setTemplates] = useState([])
  const [userProfile, setUserProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showLoadingScreen, setShowLoadingScreen] = useState(true)
  const [stats, setStats] = useState({
    totalWorkouts: 0,
    totalMinutes: 0,
    totalReps: 0,
    workoutsCompleted: 0,
    partners: 0
  })
  const [searchStatus, setSearchStatus] = useState(false)
  const [isInitializing, setIsInitializing] = useState(true)
  const [staleSessionId, setStaleSessionId] = useState(null)

  // Gatekeeper useEffect - Runs exactly once on mount
  useEffect(() => {
    if (user) {
      gatekeeperCheck()
    }
  }, [user, location.state])

  const gatekeeperCheck = async () => {
    try {
      // Check if user is coming from lobby - skip stale session check
      const fromLobby = location.state?.fromLobby

      // Fetch current user's profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('full_name, username, avatar_url, total_reps, total_minutes, workouts_completed, partner_count, search_status, current_session_id')
        .eq('user_id', user.id)
        .single()

      if (profileError) throw profileError

      // Set user profile data
      setUserProfile(profile)
      setSearchStatus(profile.search_status || false)
      setStats({
        totalWorkouts: profile.workouts_completed || 0,
        totalMinutes: profile.total_minutes || 0,
        totalReps: profile.total_reps || 0,
        workoutsCompleted: profile.workouts_completed || 0,
        partners: profile.partner_count || 0
      })

      // Skip stale session check if coming from lobby
      if (fromLobby) {
        setIsInitializing(false)
        return
      }

      // Check for current_session_id
      if (!profile.current_session_id) {
        // No session - allow entry
        setIsInitializing(false)
        return
      }

      // Session exists in profile - fetch from live_sessions
      const { data: session, error: sessionError } = await supabase
        .from('live_sessions')
        .select('id, status')
        .eq('id', profile.current_session_id)
        .single()

      if (sessionError) {
        // Session doesn't exist (deleted by CASCADE or host) - cleanup profile and allow entry
        await supabase
          .from('profiles')
          .update({ current_session_id: null, search_status: false })
          .eq('user_id', user.id)
        setIsInitializing(false)
        return
      }

      // Session exists - check if completed
      if (session.status === 'completed') {
        await supabase
          .from('profiles')
          .update({ current_session_id: null, search_status: false })
          .eq('user_id', user.id)
        setIsInitializing(false)
        return
      }

      // Session exists and is active - set staleSessionId to trigger modal
      setStaleSessionId(session.id)
      setIsInitializing(false)
    } catch (error) {
      console.error('Error in gatekeeper check:', error)
      setIsInitializing(false)
    } finally {
      setLoading(false)
    }
  }

  // Fetch templates separately (not blocking)
  useEffect(() => {
    if (user && !isInitializing && !staleSessionId) {
      fetchTemplates()
    }
  }, [user, isInitializing, staleSessionId])

  const fetchTemplates = async () => {
    try {
      const { data: templates, error } = await supabase
        .from('workout_templates')
        .select(`
          id,
          name,
          created_at,
          template_exercises (
            position,
            label,
            sets,
            reps,
            rest_seconds,
            exercises (
              id,
              name,
              primary_muscles,
              category,
              level
            )
          )
        `)
        .eq('user_id', user.id)
        .eq('is_archived', false)
        .order('created_at', { ascending: false })

      if (error) {
        // Handle RLS policy violations
        if (error.code === '42501' || error.message.includes('permission denied')) {
          console.error('Permission denied fetching templates')
          setTemplates([])
          setLoading(false)
          return
        }
        throw error
      }

      if (templates) {
        // Transform data to match expected format
        const transformedTemplates = templates.map(template => ({
          id: template.id,
          name: template.name,
          exercises: template.template_exercises
            .sort((a, b) => a.position - b.position)
            .map(te => ({
              id: te.exercises.id,
              name: te.exercises.name,
              primaryMuscles: te.exercises.primary_muscles,
              category: te.exercises.category,
              level: te.exercises.level,
              label: te.label,
              sets: te.sets,
              reps: te.reps,
              restSeconds: te.rest_seconds
            })),
          color: '#FF6B35' // Default color, can be customized later
        }))
        
        setTemplates(transformedTemplates)
      }
    } catch (error) {
      console.error('Error fetching templates:', error)
      setTemplates([])
    } finally {
      setLoading(false)
    }
  }

  const [isStarting, setIsStarting] = useState(false)

  const startWorkout = async (templateId) => {
    if (isStarting) return // Prevent double clicks
    
    setIsStarting(true)
    try {
      // Check if user already has an active session
      const { data: profile } = await supabase
        .from('profiles')
        .select('current_session_id')
        .eq('user_id', user.id)
        .single()

      if (profile?.current_session_id) {
        // Multiplayer Mode: Update existing session with template_id
        const { error: updateError } = await supabase
          .from('live_sessions')
          .update({ template_id: templateId })
          .eq('id', profile.current_session_id)

        if (updateError) throw updateError

        // Navigate to existing session
        navigate(`/workout/session/${profile.current_session_id}`)
      } else {
        // Solo Mode: Create new session
        const { data: sessionData, error: sessionError } = await supabase
          .from('live_sessions')
          .insert({
            host_id: user.id,
            template_id: templateId
          })
          .select()
          .single()

        if (sessionError) throw sessionError

        // Update user's profile current_session_id
        const { error: profileError } = await supabase
          .from('profiles')
          .update({ current_session_id: sessionData.id })
          .eq('user_id', user.id)

        if (profileError) throw profileError

        // Navigate to workout with session ID
        navigate(`/workout/session/${sessionData.id}`)
      }
    } catch (error) {
      console.error('Error starting workout:', error)
      alert('Failed to start workout. Please try again.')
    } finally {
      setIsStarting(false)
    }
  }

  const deleteTemplate = async (templateId) => {
    if (!confirm('Are you sure you want to delete this template?')) return

    try {
      // Soft delete: Archive the template instead of hard delete
      const { error: templateError } = await supabase
        .from('workout_templates')
        .update({ is_archived: true })
        .eq('id', templateId)

      if (templateError) {
        // Handle RLS policy violations
        if (templateError.code === '42501' || templateError.message.includes('permission denied')) {
          throw new Error('You do not have permission to delete this template.')
        }
        throw templateError
      }

      // Refresh templates
      fetchTemplates()
    } catch (error) {
      console.error('Error deleting template:', error)
      alert(error.message || 'Failed to delete template. Please try again.')
    }
  }

  const editTemplate = (templateId) => {
    navigate(`/create-template?edit=${templateId}`)
  }

  const createNewTemplate = () => {
    navigate('/create-template')
  }

  const leaveSession = async () => {
    if (!userProfile?.current_session_id) return

    try {
      // Delete from session_participants
      await supabase
        .from('session_participants')
        .delete()
        .eq('user_id', user.id)

      // Clear current_session_id from profile
      await supabase
        .from('profiles')
        .update({ current_session_id: null, search_status: false })
        .eq('user_id', user.id)

      // Refresh profile
      fetchUserProfile()
    } catch (error) {
      console.error('Error leaving session:', error)
      alert('Failed to leave session. Please try again.')
    }
  }

  /**
   * Toggles the user's matchmaking search status.
   * 
   * Updates the user's profile search_status field in the database, enabling or
   * disabling their visibility to other users searching for workout partners.
   * Includes validation to prevent searching while already in an active session.
   * 
   * @returns {Promise<void>} Resolves when the search status is successfully toggled
   */
  const toggleSearchStatus = async () => {
    if (!userProfile) return
    
    // Check if user is in an active session
    if (userProfile.current_session_id !== null) {
      alert('You must end your current active workout before looking for a partner!')
      return
    }
    
    // Calculate the inverse of the current status
    const newStatus = !userProfile.search_status

    try {
      const { data, error } = await supabase
        .from('profiles')
        .update({ search_status: newStatus })
        .eq('user_id', user.id)
        .select()

      if (error) throw error

      // Strict validation: check if rows were updated
      if (!data || data.length === 0) {
        console.error('Supabase updated 0 rows. RLS policy might be blocking this.')
        alert('Failed to update search status. RLS policy may be blocking this action.')
        return
      }

      // Only update local state if DB update succeeded
      setSearchStatus(newStatus)
      setUserProfile(prev => ({ ...prev, search_status: newStatus }))
    } catch (error) {
      console.error('Error toggling search status:', error)
      alert('Failed to update search status')
    }
  }

  const getInitials = (name) => {
    if (!name) return 'U'
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  }

  const handleResume = () => {
    if (!staleSessionId) return
    navigate(`/workout/session/${staleSessionId}`)
  }

  const handleDiscard = async () => {
    if (!staleSessionId) return

    try {
      // Query session_participants for this session
      const { data: participants } = await supabase
        .from('session_participants')
        .select('user_id')
        .eq('session_id', staleSessionId)

      // Delete current user from session_participants
      await supabase
        .from('session_participants')
        .delete()
        .eq('user_id', user.id)
        .eq('session_id', staleSessionId)

      // If user was the last participant, delete the live_sessions record
      if (!participants || participants.length <= 1) {
        await supabase
          .from('live_sessions')
          .delete()
          .eq('id', staleSessionId)
      }

      // Update user's profile: current_session_id: null and search_status: false
      await supabase
        .from('profiles')
        .update({
          current_session_id: null,
          search_status: false
        })
        .eq('user_id', user.id)

      // Clear staleSessionId to reveal the standard dashboard
      setStaleSessionId(null)
      // Refresh profile data
      await gatekeeperCheck()
    } catch (error) {
      console.error('Error discarding session:', error)
      alert('Failed to discard session. Please try again.')
    }
  }

  // Strict Conditional Rendering
  if (isInitializing) {
    return (
      <LoadingScreen 
        isLoading={isInitializing}
        onComplete={() => setShowLoadingScreen(false)} 
      />
    )
  }

  if (staleSessionId) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl animate-scale-in">
          <div className="text-center mb-6">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 bg-orange-100 dark:bg-orange-900/30">
              <Dumbbell className="w-8 h-8 text-orange-600 dark:text-orange-500" />
            </div>
            <h2 className="text-2xl font-bold text-zinc-950 dark:text-zinc-50 mb-2">
              Unfinished Workout
            </h2>
            <p className="text-zinc-600 dark:text-zinc-400">
              You have an unfinished workout. Would you like to resume or discard it?
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={handleResume}
              className="flex-1 py-3 px-6 rounded-lg font-semibold text-white bg-orange-600 dark:bg-orange-500 hover:bg-orange-700 dark:hover:bg-orange-600 transition-all"
            >
              Resume
            </button>
            <button
              onClick={handleDiscard}
              className="flex-1 py-3 px-6 rounded-lg font-semibold text-zinc-700 dark:text-zinc-300 bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 transition-all"
            >
              Discard
            </button>
          </div>
        </div>
      </div>
    )
  }

  const displayName = userProfile?.username || userProfile?.full_name || user?.email?.split('@')[0] || 'User'

  return (
    <div className="min-h-screen pb-24 bg-white dark:bg-zinc-950 scrollbar-thin">
      {/* Header */}
      <header className="nav-bar sticky top-0 z-20 px-6 py-6 safe-top">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-4">
            {/* Minimalist Avatar */}
            {userProfile?.avatar_url ? (
              <img 
                src={userProfile.avatar_url} 
                alt={displayName}
                className="w-12 h-12 rounded-full object-cover border-2 border-zinc-200 dark:border-zinc-800 hover:border-orange-600 dark:hover:border-orange-500 transition-colors"
              />
            ) : (
              <div className="w-12 h-12 rounded-full flex items-center justify-center font-semibold text-sm bg-orange-600 dark:bg-orange-500 text-white">
                {getInitials(displayName)}
              </div>
            )}
            <div>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">Welcome back,</p>
              <h1 className="text-xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">{displayName}</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Leave Session button - only show when in active lobby */}
            {userProfile?.current_session_id && (
              <button 
                className="px-3 py-2 text-sm rounded-lg transition-all bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50"
                onClick={() => leaveSession()}
                title="Leave Session"
              >
                <X className="w-4 h-4" />
                Leave Session
              </button>
            )}
            {/* Find Partner button - hide when in active lobby */}
            {!userProfile?.current_session_id && (
              <button 
                className={`px-3 py-2 text-sm rounded-lg transition-all ${
                  searchStatus 
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' 
                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                }`}
                onClick={() => toggleSearchStatus()}
                title={searchStatus ? 'Stop searching for partners' : 'Search for partners'}
              >
                <Users className="w-4 h-4" />
                {searchStatus ? 'Searching' : 'Find Partner'}
              </button>
            )}
            {/* Profile button - hide when in active lobby */}
            {!userProfile?.current_session_id && (
              <button 
                className="btn-icon text-zinc-600 dark:text-zinc-400"
                onClick={() => navigate('/profile')}
                title="Profile"
              >
                <MoreVertical className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="px-6 py-4 max-w-6xl mx-auto">
        {/* Lobby Active Banner */}
        {userProfile?.current_session_id && (
          <div className="bento-card p-4 mb-6 bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800">
            <p className="text-sm font-medium text-orange-700 dark:text-orange-400 text-center">
              Lobby Active: Choose or create a template to begin.
            </p>
          </div>
        )}

        {/* Matchmaking Section - hide when in active lobby */}
        {!userProfile?.current_session_id && !searchStatus ? (
          <div className="bento-card p-8 text-center mb-6">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 bg-orange-100 dark:bg-orange-900/30">
              <Users className="w-8 h-8 text-orange-600 dark:text-orange-500" />
            </div>
            <h3 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50 mb-2">
              Find a Workout Partner
            </h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
              Click "Find Partner" to start searching for people ready to workout together
            </p>
          </div>
        ) : null}

        {/* Matchmaking Lobby - only show when not in active lobby and searching */}
        {!userProfile?.current_session_id && searchStatus && (
          <div className="mb-6">
            <MatchmakingLobby />
          </div>
        )}

        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">Workout Templates</h2>
          <span className="text-sm text-zinc-500 dark:text-zinc-400">{templates.length} templates</span>
        </div>
        
        {/* Templates Grid - Bento Style */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((template, index) => (
            <div 
              key={template.id}
              className="bento-card p-5 animate-slide-up"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              {/* Template Header */}
              <div className="flex items-start justify-between mb-4">
                <div 
                  className="w-11 h-11 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: `${template.color}15` }}
                >
                  <Dumbbell className="w-5 h-5" style={{ color: template.color }} />
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      editTemplate(template.id)
                    }}
                    className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                    title="Edit template"
                  >
                    <Edit className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      deleteTemplate(template.id)
                    }}
                    className="p-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                    title="Delete template"
                  >
                    <Trash2 className="w-4 h-4 text-zinc-500 dark:text-zinc-400 hover:text-red-600 dark:hover:text-red-400" />
                  </button>
                </div>
              </div>

              {/* Template Name */}
              <h3 className="font-semibold tracking-tight text-zinc-950 dark:text-zinc-50 mb-1">{template.name}</h3>

              {/* Exercises Count */}
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
                {template.exercises.length} exercises
              </p>

              {/* Exercise Preview */}
              <div className="flex flex-wrap gap-2 mb-4">
                {template.exercises.slice(0, 3).map((exercise, idx) => (
                  <span 
                    key={idx}
                    className="text-xs px-2 py-1 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
                  >
                    {exercise.name || exercise}
                  </span>
                ))}
                {template.exercises.length > 3 && (
                  <span className="text-xs px-2 py-1 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-500">
                    +{template.exercises.length - 3}
                  </span>
                )}
              </div>

              {/* Start Session Button */}
              {template.exercises.length > 0 ? (
                <button
                  onClick={() => startWorkout(template.id)}
                  disabled={isStarting}
                  className="w-full py-3 rounded-lg font-medium text-orange-600 dark:text-orange-500 border-2 border-orange-600 dark:border-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Play className="w-4 h-4 inline mr-2" />
                  {isStarting ? 'Starting...' : 'Start Session'}
                </button>
              ) : (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    editTemplate(template.id)
                  }}
                  className="w-full py-3 rounded-lg font-medium text-zinc-600 dark:text-zinc-400 border-2 border-dashed border-zinc-300 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-all"
                >
                  <Edit className="w-4 h-4 inline mr-2" />
                  Add exercises to start
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Empty State */}
        {templates.length === 0 && (
          <div className="bento-card p-8 text-center mt-4">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 bg-zinc-100 dark:bg-zinc-800">
              <Dumbbell className="w-8 h-8 text-zinc-400 dark:text-zinc-600" />
            </div>
            <h3 className="font-semibold tracking-tight text-zinc-950 dark:text-zinc-50 mb-2">No templates yet</h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
              Click the '+' button to create your first workout template to get started.
            </p>
          </div>
        )}
      </main>

      {/* Floating Action Button */}
      <button
        onClick={createNewTemplate}
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full flex items-center justify-center btn-primary hover:scale-110 transition-transform safe-bottom z-30"
        title="Create New Template"
      >
        <Plus className="w-6 h-6" />
      </button>
    </div>
  )
}
