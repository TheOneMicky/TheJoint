import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { 
  Check, 
  X,
  Users,
  Timer,
  LogOut,
  Dumbbell,
  Flame,
  HelpCircle
} from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'

export default function WorkoutTracker() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { sessionId: sessionParam } = useParams()

  const GITHUB_BASE_URL = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/'

  // Session state
  const [sessionId, setSessionId] = useState(null)
  const [sessionData, setSessionData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [partnerProfile, setPartnerProfile] = useState(null)
  const [currentUserProfile, setCurrentUserProfile] = useState(null)
  const [sessionLogs, setSessionLogs] = useState([])
  const [partnerFeed, setPartnerFeed] = useState([])
  
  // Workout state machine
  const [templateExercises, setTemplateExercises] = useState([])
  const [templateName, setTemplateName] = useState('')
  const [activeExerciseIndex, setActiveExerciseIndex] = useState(0)
  const [currentSetNumber, setCurrentSetNumber] = useState(1)
  const [isResting, setIsResting] = useState(false)
  const [restTimeLeft, setRestTimeLeft] = useState(0)
  const [workoutComplete, setWorkoutComplete] = useState(false)
  const [isWorking, setIsWorking] = useState(false)
  const [workTimeLeft, setWorkTimeLeft] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  
  // Session timer
  const [sessionTime, setSessionTime] = useState(0)
  const timerRef = useRef(null)
  const isLoggingRef = useRef(false)
  const hasCommittedStats = useRef(false) // Prevent duplicate auto-commits
  const partnerIdRef = useRef(null) // Partner Memory Bank - lock in partner ID early
  const isCompleteRef = useRef(false) // Track completion status without closure staleness
  const vaultRef = useRef({ isComplete: false, reps: 0, minutes: 0, partnerId: null }) // State Vault for fresh data in closures
  
  // UI state
  const [showEndConfirm, setShowEndConfirm] = useState(false)
  const [infoExercise, setInfoExercise] = useState(null)

  // Initialize session on component mount
  useEffect(() => {
    const initializeSession = async () => {
      if (!sessionParam) {
        navigate('/dashboard')
        return
      }

      try {
        setLoading(true)

        // Fetch session details
        const { data: session, error: sessionError } = await supabase
          .from('live_sessions')
          .select('id, template_id, status, host_id, created_at')
          .eq('id', sessionParam)
          .single()

        if (sessionError) throw sessionError

        if (session?.status === 'completed') {
          navigate('/dashboard')
          return
        }

        setSessionId(session.id)
        setSessionData(session)

        // Fetch partner's profile from session_participants
        const { data: participants, error: participantsError } = await supabase
          .from('session_participants')
          .select('user_id')
          .eq('session_id', session.id)

        if (participantsError) throw participantsError

        const partnerId = participants?.find(p => p.user_id !== user.id)?.user_id
        if (partnerId) {
          const { data: partner } = await supabase
            .from('profiles')
            .select('user_id, username, full_name, avatar_url')
            .eq('user_id', partnerId)
            .single()
          setPartnerProfile(partner)
        }

        // Fetch current user's profile
        const { data: currentUser } = await supabase
          .from('profiles')
          .select('user_id, username, full_name, avatar_url')
          .eq('user_id', user.id)
          .single()
        setCurrentUserProfile(currentUser)

        // Fetch template with nested relational data if template_id exists
        if (session.template_id) {
          const { data: templateData } = await supabase
            .from('workout_templates')
            .select('*, template_exercises(*, exercises(*))')
            .eq('id', session.template_id)
            .single()

          // Sort exercises by position field
          const sortedExercises = templateData?.template_exercises?.sort((a, b) => a.position - b.position) || []
          setTemplateExercises(sortedExercises)
          setTemplateName(templateData?.name || 'Template Workout')
        }

        // Fetch historical session logs
        const { data: logs } = await supabase
          .from('session_logs')
          .select('*')
          .eq('session_id', session.id)

        setSessionLogs(logs || [])
        // Separate partner logs into feed
        const partnerLogs = logs?.filter(log => log.user_id !== user.id) || []
        setPartnerFeed(partnerLogs)

      } catch (error) {
        console.error('Error initializing session:', error)
        navigate('/dashboard')
      } finally {
        setLoading(false)
      }
    }

    initializeSession()
  }, [sessionParam, user.id, navigate])

  // Realtime subscription for session logs (partner feed)
  useEffect(() => {
    if (!sessionId) return

    const channel = supabase
      .channel('session-logs-feed')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'session_logs',
          filter: `session_id=eq.${sessionId}`
        },
        (payload) => {
          // Only add to partner feed if it's not the current user
          if (payload.new.user_id !== user.id) {
            // Find exercise name from local templateExercises
            const exercise = templateExercises.find(te => te.exercises.id === payload.new.exercise_id)
            const exerciseName = exercise?.exercises?.name || 'Exercise'
            
            // Add exercise_name to the log
            const logWithExerciseName = {
              ...payload.new,
              exercise_name: exerciseName
            }
            
            setPartnerFeed(prev => [logWithExerciseName, ...prev])
          } else {
            // Add to session logs for current user
            setSessionLogs(prev => [...prev, payload.new])
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [sessionId, user.id, templateExercises])

  // Session timer
  useEffect(() => {
    if (!sessionId) return

    timerRef.current = setInterval(() => {
      setSessionTime(prev => prev + 1)
    }, 1000)

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
    }
  }, [sessionId])

  // Rest timer
  useEffect(() => {
    if (!isResting) return

    const restTimer = setInterval(() => {
      setRestTimeLeft(prev => {
        if (prev <= 1) {
          // Rest period complete
          handleRestComplete()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(restTimer)
  }, [isResting])

  // Partner Memory Bank: Lock in partner ID early to prevent null at session end
  useEffect(() => {
    if (partnerProfile) {
      partnerIdRef.current = partnerProfile.user_id
    }
  }, [partnerProfile])

  // Guest Eviction Listener - watch for session deletion
  useEffect(() => {
    if (!sessionId || !sessionData) return

    const isGuest = user.id !== sessionData.host_id
    if (!isGuest) return // Only guests need this listener

    const evictionChannel = supabase
      .channel('session-eviction')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'live_sessions',
          filter: `id=eq.${sessionId}`
        },
        async (payload) => {
          if (payload.eventType === 'DELETE') {
            alert('The Host has ended the session.')
            
            // Cleanup profile
            await supabase
              .from('profiles')
              .update({
                current_session_id: null,
                search_status: false
              })
              .eq('user_id', user.id)

            navigate('/dashboard')
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'live_sessions',
          filter: `id=eq.${sessionId}`
        },
        async () => {
          // Room was destroyed. Clean up and exit.
          await supabase.from('profiles').update({ current_session_id: null, search_status: false }).eq('user_id', user.id);
          navigate('/profile');
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(evictionChannel)
    }
  }, [sessionId, sessionData, user.id, navigate])

  // Update workTimeLeft when exercise or set changes
  useEffect(() => {
    if (templateExercises.length === 0 || activeExerciseIndex >= templateExercises.length) {
      setWorkTimeLeft(0)
      setIsWorking(false)
      return
    }

    const currentExercise = templateExercises[activeExerciseIndex]
    const duration = currentExercise.duration || 0
    setWorkTimeLeft(duration)
    setIsWorking(false)
  }, [activeExerciseIndex, currentSetNumber, templateExercises])

  // Work Timer - for duration-based exercises
  useEffect(() => {
    let interval = null;

    // Only set up the interval if working, NOT paused, and time remains
    if (isWorking && !isPaused && workTimeLeft > 0) {
      interval = setInterval(() => {
        setWorkTimeLeft((prev) => prev - 1);
      }, 1000);
    }

    // The auto-complete trigger (When it hits 0)
    if (isWorking && workTimeLeft === 0) {
      setIsWorking(false);
      
      const currentExercise = templateExercises[activeExerciseIndex]
      const exerciseData = currentExercise?.exercises
      
      if (currentExercise && exerciseData) {
        handleLogSet({
          session_id: sessionId,
          user_id: user.id,
          exercise_id: exerciseData.id,
          sets_number: currentSetNumber,
          reps: null,
          duration_seconds: currentExercise.duration
        })
        
        // Start rest period
        setIsResting(true)
        setRestTimeLeft(currentExercise.rest_seconds)
      }
    }

    // Cleanup function: React will run this every time isPaused changes
    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [isWorking, isPaused, workTimeLeft, activeExerciseIndex, currentSetNumber, templateExercises, sessionId, user.id]);

  // Track completion status without closure staleness
  useEffect(() => {
    if (templateExercises && templateExercises.length > 0 && activeExerciseIndex >= templateExercises.length) {
      isCompleteRef.current = true;
    }
  }, [activeExerciseIndex, templateExercises]);

  // State Vault: Synchronize freshest state to prevent stale closures
  useEffect(() => {
    if (templateExercises && templateExercises.length > 0) {
      const { totalReps, totalMinutes } = calculateSessionStats();
      vaultRef.current = {
        isComplete: activeExerciseIndex >= templateExercises.length,
        reps: Math.round(totalReps) || 0,
        minutes: Math.round(totalMinutes) || 0,
        partnerId: partnerIdRef.current
      };
    }
  }, [activeExerciseIndex, templateExercises, sessionLogs, partnerIdRef.current]);

  const handleWorkComplete = async () => {
    setIsWorking(false)
    
    // Log the set with duration
    await logSetWithDuration()
    
    // Start rest period
    setIsResting(true)
    const currentExercise = templateExercises[activeExerciseIndex]
    setRestTimeLeft(currentExercise.rest_seconds)
  }

  const advanceWorkout = () => {
    const currentExercise = templateExercises[activeExerciseIndex]
    
    if (!currentExercise) return
    
    // Calculate next states based on current state variables
    const isLastSet = currentSetNumber >= currentExercise.sets

    if (isLastSet) {
      setActiveExerciseIndex(prev => {
        if (prev < templateExercises.length - 1) {
          return prev + 1
        } else {
          // Workout complete
          setWorkoutComplete(true)
          return prev
        }
      })
      setCurrentSetNumber(1)
    } else {
      setCurrentSetNumber(prev => prev + 1)
    }

    // Reset timers
    setIsResting(false)
    setIsWorking(false)
  }

  const handleRestComplete = () => {
    advanceWorkout()
  }

  const skipRest = () => {
    handleRestComplete()
  }

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const getInitials = (name) => {
    if (!name) return 'U'
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  }

  /**
   * Handles the insertion of workout set logs into the database.
   * 
   * This function implements a debouncing mechanism to prevent duplicate log entries
   * during rapid user interactions. It extracts the exercise name from local state
   * and augments the database payload with this metadata for realtime broadcasting.
   * 
   * @param {Object} payload - The log payload containing session_id, user_id, exercise_id, sets_number, reps, duration_seconds
   * @returns {Promise<void>} Resolves when the log is successfully inserted and local state is updated
   */
  const handleLogSet = async (payload) => {
    if (isLoggingRef.current) return // Prevent double execution
    isLoggingRef.current = true

    try {
      // Get current exercise name from local state
      const currentExercise = templateExercises[activeExerciseIndex]
      const exerciseName = currentExercise?.exercises?.name || 'Exercise'

      // Insert to database without exercise_name
      await supabase.from('session_logs').insert(payload)

      // Add exercise_name locally for realtime broadcast
      const logWithExerciseName = {
        ...payload,
        exercise_name: exerciseName
      }

      // Update local state with exercise_name included
      setSessionLogs(prev => [...prev, logWithExerciseName])
    } catch (error) {
      console.error('Error logging set:', error)
      alert('Failed to log set')
    } finally {
      // Only unlock AFTER the insert is complete and state has settled
      setTimeout(() => { isLoggingRef.current = false }, 500)
    }
  }

  /**
   * Logs a completed workout set with reps-based metrics.
   * 
   * Constructs a database payload containing the current exercise details,
   * determines if the exercise is duration-based (cardio/stretching), and
   * delegates the insertion to handleLogSet. Triggers the rest period upon
   * successful logging.
   * 
   * @returns {Promise<void>} Resolves when the set is logged and rest period initiated
   */
  const logSet = async () => {
    if (!sessionId || templateExercises.length === 0) return

    const currentExercise = templateExercises[activeExerciseIndex]
    const exerciseData = currentExercise.exercises
    
    // Determine if duration-based
    const isDurationBased = 
      exerciseData.category === 'cardio' || 
      exerciseData.category === 'stretching' || 
      (currentExercise.duration && currentExercise.duration > 0)

    const payload = {
      session_id: sessionId,
      user_id: user.id,
      exercise_id: exerciseData.id,
      sets_number: currentSetNumber,
      reps: isDurationBased ? null : currentExercise.reps,
      duration_seconds: isDurationBased ? currentExercise.duration : null
    }

    await handleLogSet(payload)

    // Start rest period, then advance workout
    setIsResting(true)
    setRestTimeLeft(currentExercise.rest_seconds)
  }

  /**
   * Logs a completed workout set with duration-based metrics.
   * 
   * Used for cardio and stretching exercises where duration is the primary metric
   * rather than repetitions. Constructs a payload with duration_seconds and delegates
   * to handleLogSet for database insertion.
   * 
   * @returns {Promise<void>} Resolves when the set is logged
   */
  const logSetWithDuration = async () => {
    if (!sessionId || templateExercises.length === 0) return

    const currentExercise = templateExercises[activeExerciseIndex]
    const exerciseData = currentExercise.exercises

    const payload = {
      session_id: sessionId,
      user_id: user.id,
      exercise_id: exerciseData.id,
      sets_number: currentSetNumber,
      reps: null,
      duration_seconds: currentExercise.duration
    }

    await handleLogSet(payload)
  }

  const startWorkTimer = () => {
    setIsWorking(true)
  }

  const pauseWorkTimer = () => {
    setIsWorking(false)
  }

  const endWorkout = async () => {
    try {
      // Update session status to completed
      if (sessionId) {
        await supabase
          .from('live_sessions')
          .update({ status: 'completed' })
          .eq('id', sessionId)
      }

      // Clear user's current_session_id and search_status
      await supabase
        .from('profiles')
        .update({
          current_session_id: null,
          search_status: false
        })
        .eq('user_id', user.id)

      navigate('/dashboard')
    } catch (error) {
      console.error('Error ending workout:', error)
      alert('Failed to end workout')
    }
  }

  /**
   * Calculates cumulative workout statistics from session logs.
   * 
   * Aggregates total repetitions and duration from the current user's session logs,
   * then adds the session's rest time to compute the total workout duration.
   * 
   * @returns {Object} An object containing totalReps (number) and totalMinutes (number)
   */
  const calculateSessionStats = () => {
    const userLogs = sessionLogs.filter(log => log.user_id === user.id)
    
    const totalReps = userLogs.reduce((sum, log) => sum + (log.reps || 0), 0)
    
    const totalDurationSeconds = userLogs.reduce((sum, log) => sum + (log.duration_seconds || 0), 0)
    const durationMinutes = totalDurationSeconds / 60
    
    // Total rest time in minutes (sessionTime is in seconds)
    const restMinutes = sessionTime / 60
    
    const totalMinutes = durationMinutes + restMinutes
    
    return { totalReps, totalMinutes }
  }

  /**
   * Commits the current user's workout statistics to the database.
   * 
   * Calculates total reps and minutes from session logs, then invokes the
   * Supabase RPC function 'increment_user_stats' to update the user's profile.
   * Includes the partner ID for relationship tracking. Implements a failsafe
   * mechanism to extract partner ID from session logs if the ref is null.
   * 
   * @returns {Promise<void>} Resolves when stats are successfully committed
   */
  const commitUserStats = async () => {
    try {
      const { totalReps, totalMinutes } = calculateSessionStats()

      let finalPartnerId = partnerIdRef.current

      // FAILSAFE: If the ref is somehow null, synchronously check sessionLogs state
      if (!finalPartnerId && sessionLogs && sessionLogs.length > 0) {
        const fallback = sessionLogs.find(log => {
          const pid = log.user_id || log.id
          return pid && pid !== user.id
        })
        if (fallback) finalPartnerId = fallback.user_id || fallback.id
      }

      const { error } = await supabase.rpc('increment_user_stats', {
        target_user_id: user.id,
        added_reps: Math.round(totalReps) || 0,
        added_minutes: Math.round(totalMinutes) || 0,
        workout_partner_id: finalPartnerId
      })

      if (error) console.error('RPC ERROR:', error)
    } catch (error) {
      console.error('Error committing user stats:', error)
      // Don't crash if stats already committed or other error occurs
    }
  }

  const handleSkipExercise = () => {
    // Reset timers and states
    setIsWorking(false)
    setIsResting(false)
    setIsPaused(false)

    // Instantly advance the index to the next exercise
    setActiveExerciseIndex(prev => prev + 1)
    setCurrentSetNumber(1)
  }

  /**
   * Implements the Independent Exit Protocol for session termination.
   * 
   * This function ensures users can leave sessions individually without disrupting
   * their partners. It commits stats first, then checks if the user is the last
   * participant. If so, it deletes the entire session; otherwise, it only removes
   * the user from session_participants. Finally, it clears the user's profile state.
   * 
   * @returns {Promise<void>} Resolves when the user has successfully exited the session
   */
  const finishAndExit = async () => {
    try {
      // 1. Save stats securely
      if (!hasCommittedStats.current) {
        hasCommittedStats.current = true;
        await commitUserStats();
      }

      // 2. The 'Turn off the Lights' Protocol
      const { data: participants } = await supabase
        .from('session_participants')
        .select('user_id')
        .eq('session_id', sessionId)

      if (participants && participants.length <= 1) {
        // You are the last person here. Nuke the whole room.
        await supabase.from('live_sessions').delete().eq('id', sessionId);
      } else {
        // Partner is still working out. Just walk out the door quietly.
        await supabase.from('session_participants').delete().eq('user_id', user.id);
      }

      // 3. Clear local state and route home
      await supabase.from('profiles').update({ current_session_id: null, search_status: false }).eq('user_id', user.id);
      navigate('/profile');
    } catch (error) {
      console.error('Error during cleanup:', error)
      alert('Failed to complete workout. Please try again.')
    }
  }

  const handleLeaveSession = async () => {
    if (!sessionId || !sessionData) return

    try {
      const isHost = user.id === sessionData.host_id

      if (isHost) {
        // Host: Delete session and cleanup
        await supabase
          .from('live_sessions')
          .delete()
          .eq('id', sessionId)
      }

      // Always cleanup user profile
      await supabase
        .from('profiles')
        .update({
          current_session_id: null,
          search_status: false
        })
        .eq('user_id', user.id)

      navigate('/dashboard')
    } catch (error) {
      console.error('Error leaving session:', error)
      alert('Failed to leave session')
    }
  }

  // Show zero-state while loading
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-zinc-950">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-orange-600 dark:border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-zinc-600 dark:text-zinc-400 text-lg">Loading Workout...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950">
      {/* Header */}
      <header className="sticky top-0 z-20 px-4 py-3 border-b bg-white dark:bg-zinc-950 safe-top">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          {/* Both Users */}
          <div className="flex items-center gap-4">
            {currentUserProfile && (
              <div className="flex items-center gap-2">
                {currentUserProfile.avatar_url ? (
                  <img
                    src={currentUserProfile.avatar_url}
                    alt={currentUserProfile.username}
                    className="w-10 h-10 rounded-full object-cover border-2 border-zinc-200 dark:border-zinc-800"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm bg-orange-600 dark:bg-orange-500 text-white">
                    {getInitials(currentUserProfile.username || currentUserProfile.full_name)}
                  </div>
                )}
                <div>
                  <p className="text-sm font-medium text-zinc-950 dark:text-zinc-50">{currentUserProfile.username || currentUserProfile.full_name || 'You'}</p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">You</p>
                </div>
              </div>
            )}
            
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-green-100 dark:bg-green-900/30">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
              </span>
              <span className="text-xs font-semibold text-green-700 dark:text-green-400">LIVE</span>
            </div>

            {partnerProfile && (
              <div className="flex items-center gap-2">
                {partnerProfile.avatar_url ? (
                  <img
                    src={partnerProfile.avatar_url}
                    alt="Partner"
                    className="w-10 h-10 rounded-full object-cover border-2 border-zinc-200 dark:border-zinc-800"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm bg-zinc-600 dark:bg-zinc-500 text-white">
                    {getInitials(partnerProfile.username || partnerProfile.full_name)}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Session Timer & End Workout */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
              <Timer className="w-4 h-4" />
              <span className="font-mono font-medium">{formatTime(sessionTime)}</span>
            </div>
            <button
              onClick={handleLeaveSession}
              className="px-4 py-2 rounded-lg text-sm font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 hover:bg-red-100 dark:hover:bg-red-900/50 transition-all"
            >
              End Session Early
            </button>
          </div>
        </div>
      </header>

      {/* Main Content - Grid Layout */}
      <div className="max-w-7xl mx-auto p-4 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Area - Personal Logger */}
        <div className="lg:col-span-2">
          <div className="bento-card p-6">
            <h2 className="text-xl font-semibold text-zinc-950 dark:text-zinc-50 mb-6">
              {templateName || 'Template Workout'}
            </h2>

            {sessionData?.template_id ? (
              // Template Mode - Guided View
              <div>
                {workoutComplete ? (
                  // Workout Complete Screen
                  <div className="text-center py-12">
                    <div className="text-6xl mb-4">🎉</div>
                    <h2 className="text-3xl font-bold text-zinc-950 dark:text-zinc-50 mb-4">
                      Workout Complete!
                    </h2>
                    <p className="text-zinc-600 dark:text-zinc-400 mb-4">
                      Great job! You've completed all exercises.
                    </p>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-8">
                      Total Time: {Math.round(calculateSessionStats().totalMinutes)} mins | Total Reps: {calculateSessionStats().totalReps}
                    </p>
                    <button
                      onClick={finishAndExit}
                      className="px-8 py-4 rounded-lg font-semibold text-white text-lg transition-all btn-primary"
                    >
                      Finish & Exit
                    </button>
                  </div>
                ) : (
                  // Current Exercise View
                  (() => {
                    if (templateExercises.length === 0 || activeExerciseIndex >= templateExercises.length) {
                      return null
                    }
                    const currentExercise = templateExercises[activeExerciseIndex]
                    const exerciseData = currentExercise.exercises
                    return (
                      <div>
                        {/* Exercise Header */}
                        <div className="flex items-center gap-3 mb-6">
                          <h3 className="text-2xl font-bold text-zinc-950 dark:text-zinc-50">
                            {exerciseData.name}
                          </h3>
                          <button
                            onClick={() => setInfoExercise(exerciseData)}
                            className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                            title="View exercise info"
                          >
                            <HelpCircle className="w-5 h-5 text-zinc-500 dark:text-zinc-400" />
                          </button>
                        </div>

                        {/* Label if exists */}
                        {currentExercise.label && (
                          <div className="mb-4">
                            <span className="px-3 py-1 rounded-full text-sm bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400">
                              {currentExercise.label}
                            </span>
                          </div>
                        )}

                        {/* Metrics */}
                        <div className="grid grid-cols-3 gap-4 mb-8">
                          <div className="text-center p-4 rounded-lg bg-zinc-50 dark:bg-zinc-800">
                            <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-1">Set</p>
                            <p className="text-2xl font-bold text-zinc-950 dark:text-zinc-50">
                              {currentSetNumber} / {currentExercise.sets}
                            </p>
                          </div>
                          <div className="text-center p-4 rounded-lg bg-zinc-50 dark:bg-zinc-800">
                            <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-1">
                              {(exerciseData.category === 'cardio' || exerciseData.category === 'stretching' || currentExercise.duration > 0) ? 'Duration' : 'Reps'}
                            </p>
                            <p className="text-2xl font-bold text-zinc-950 dark:text-zinc-50">
                              {(exerciseData.category === 'cardio' || exerciseData.category === 'stretching' || currentExercise.duration > 0) 
                                ? `${currentExercise.duration}s` 
                                : currentExercise.reps}
                            </p>
                          </div>
                          <div className="text-center p-4 rounded-lg bg-zinc-50 dark:bg-zinc-800">
                            <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-1">Rest</p>
                            <p className="text-2xl font-bold text-zinc-950 dark:text-zinc-50">
                              {currentExercise.rest_seconds}s
                            </p>
                          </div>
                        </div>

                        {/* Action Area */}
                        {(() => {
                          const isDurationBased = 
                            exerciseData.category === 'cardio' || 
                            exerciseData.category === 'stretching' || 
                            (currentExercise.duration && currentExercise.duration > 0)

                          // State A: Resting
                          if (isResting) {
                            return (
                              <div className="space-y-4">
                                <div className="text-center py-8">
                                  <p className="text-3xl font-bold text-orange-600 dark:text-orange-500 mb-2">
                                    Resting: {restTimeLeft}s
                                  </p>
                                  <p className="text-zinc-600 dark:text-zinc-400">
                                    Take a breather before the next set
                                  </p>
                                </div>
                                <button
                                  onClick={skipRest}
                                  className="w-full py-3 rounded-lg font-medium text-zinc-950 dark:text-zinc-50 transition-all bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                                >
                                  Skip Rest
                                </button>
                              </div>
                            )
                          }

                          // State B: Active Work - Duration Mode
                          if (isDurationBased) {
                            if (!isWorking) {
                              return (
                                <button
                                  onClick={startWorkTimer}
                                  className="w-full py-6 rounded-lg font-bold text-white text-xl transition-all btn-primary"
                                >
                                  Start {currentExercise.duration}s Timer
                                </button>
                              )
                            } else {
                              return (
                                <div className="space-y-4">
                                  <div className="text-center py-8">
                                    <p className="text-4xl font-bold text-orange-600 dark:text-orange-500 mb-2 animate-pulse">
                                      Working: {workTimeLeft}s
                                    </p>
                                    <p className="text-zinc-600 dark:text-zinc-400">
                                      Keep going!
                                    </p>
                                  </div>
                                  <button
                                    onClick={() => setIsPaused(prev => !prev)}
                                    className="w-full py-3 rounded-lg font-medium text-zinc-950 dark:text-zinc-50 transition-all bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                                  >
                                    {isPaused ? 'Resume' : 'Pause'}
                                  </button>
                                </div>
                              )
                            }
                          }

                          // State C: Active Work - Reps Mode
                          return (
                            <button
                              onClick={logSet}
                              className="w-full py-6 rounded-lg font-bold text-white text-xl transition-all btn-primary"
                            >
                              {currentSetNumber >= currentExercise.sets ? 'Complete Exercise' : 'Complete Set'}
                            </button>
                          )
                        })()}
                      </div>
                    )
                  })()
                )}
              </div>
            ) : (
              // No template - waiting for Host to select one
              <div className="text-center py-12">
                <div className="w-16 h-16 border-4 border-orange-600 dark:border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <h3 className="text-xl font-semibold text-zinc-950 dark:text-zinc-50 mb-2">
                  Waiting for Host to select a template...
                </h3>
                <p className="text-zinc-600 dark:text-zinc-400">
                  All workouts require a premade template.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right Area - Partner Feed */}
        <div className="lg:col-span-1">
          <div className="bento-card p-6 sticky top-24">
            <h3 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50 mb-4 flex items-center gap-2">
              <Flame className="w-5 h-5 text-orange-600 dark:text-orange-500" />
              Partner Activity
            </h3>
            <div className="space-y-3 max-h-[calc(100vh-200px)] overflow-y-auto">
              {partnerFeed.length === 0 ? (
                <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center py-8">
                  Waiting for partner to log sets...
                </p>
              ) : (
                partnerFeed.map((log, index) => (
                  <div
                    key={index}
                    className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700"
                  >
                    <p className="text-sm text-zinc-950 dark:text-zinc-50">
                      🔥 {partnerProfile?.username || partnerProfile?.full_name || 'Partner'} completed a set of {log.exercise_name ? log.exercise_name.charAt(0).toUpperCase() + log.exercise_name.slice(1) : 'Exercise'}
                    </p>
                    {(log.weight || log.reps) && (
                      <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">
                        {log.weight && `Weight: ${log.weight} lbs`}
                        {log.weight && log.reps && ' • '}
                        {log.reps && `Reps: ${log.reps}`}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* End Workout Confirmation Modal */}
      {showEndConfirm && (
        <div className="fixed inset-0 flex items-center justify-center p-4 z-50" style={{ backgroundColor: 'rgba(0,0,0,0.8)' }}>
          <div className="bento-card p-6 max-w-sm w-full text-center">
            <h3 className="text-xl font-semibold text-zinc-950 dark:text-zinc-50 mb-2">End Workout?</h3>
            <p className="text-zinc-600 dark:text-zinc-400 mb-6">
              Are you sure you want to end this workout session?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowEndConfirm(false)}
                className="flex-1 py-3 rounded-lg font-medium text-zinc-950 dark:text-zinc-50 transition-all bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  endWorkout()
                  setShowEndConfirm(false)
                }}
                className="flex-1 py-3 rounded-lg font-medium text-white transition-all bg-red-600 hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600"
              >
                End Workout
              </button>
            </div>
          </div>
        </div>
      )}

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
                    Category: {infoExercise.category}
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
