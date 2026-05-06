import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Users, Loader2, Play, LayoutTemplate } from 'lucide-react'

export default function SessionLobby() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { sessionId } = useParams()
  
  const [session, setSession] = useState(null)
  const [participants, setParticipants] = useState([])
  const [loading, setLoading] = useState(true)
  const [profiles, setProfiles] = useState({})
  
  useEffect(() => {
    if (!sessionId) return
    
    const fetchSession = async () => {
      try {
        // Fetch session details
        const { data: sessionData, error: sessionError } = await supabase
          .from('live_sessions')
          .select('*')
          .eq('id', sessionId)
          .single()
        
        if (sessionError) throw sessionError
        setSession(sessionData)
        
        // Fetch participants
        const { data: participantsData, error: participantsError } = await supabase
          .from('session_participants')
          .select('*')
          .eq('session_id', sessionId)
        
        if (participantsError) throw participantsError
        setParticipants(participantsData || [])
        
        // Fetch profiles for all participants
        const userIds = participantsData?.map(p => p.user_id) || []
        if (userIds.length > 0) {
          const { data: profilesData } = await supabase
            .from('profiles')
            .select('user_id, username, avatar_url, full_name')
            .in('user_id', userIds)
          
          const profilesMap = {}
          profilesData?.forEach(profile => {
            profilesMap[profile.user_id] = profile
          })
          setProfiles(profilesMap)
        }
      } catch (error) {
        console.error('Error fetching session:', error)
        navigate('/dashboard')
      } finally {
        setLoading(false)
      }
    }
    
    fetchSession()
    
    // Subscribe to session_participants changes for general updates
    const participantsChannel = supabase
      .channel('session-lobby-participants')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'session_participants',
          filter: `session_id=eq.${sessionId}`
        },
        async (payload) => {
          // Refetch participants on any change
          const { data } = await supabase
            .from('session_participants')
            .select('*')
            .eq('session_id', sessionId)
          setParticipants(data || [])
        }
      )
      .subscribe()

    // Dedicated listener for declined status (UPDATE events only)
    const participantListener = supabase
      .channel('lobby_participants')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'session_participants',
          filter: `session_id=eq.${sessionId}`
        },
        async (payload) => {
          // If anyone in this room declines or leaves
          if (payload.new.status === 'declined' || payload.new.status === 'left') {
            alert('Your partner left the lobby.')

            // 1. Wipe Host Profile
            await supabase
              .from('profiles')
              .update({
                current_session_id: null,
                search_status: false
              })
              .eq('user_id', user.id)

            // 2. Cancel Session
            await supabase
              .from('live_sessions')
              .update({
                status: 'cancelled'
              })
              .eq('id', sessionId)

            // 3. Send Host Home
            navigate('/dashboard')
          }
        }
      )
      .subscribe()

    // Subscribe to live_sessions changes (for template_id updates and deletion)
    const sessionChannel = supabase
      .channel('session-lobby-template')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'live_sessions',
          filter: `id=eq.${sessionId}`
        },
        async (payload) => {
          // Handle DELETE events (session deleted by host)
          if (payload.eventType === 'DELETE' && !isHost) {
            alert('The Host cancelled the session.')
            
            // Guest cleanup
            await supabase
              .from('profiles')
              .update({
                current_session_id: null,
                search_status: false
              })
              .eq('user_id', user.id)
            
            navigate('/dashboard')
            return
          }
          
          // Handle UPDATE events (template selection)
          if (payload.eventType === 'UPDATE') {
            setSession(payload.new)
            
            // If template_id is set and user is not the host, auto-navigate to workout
            if (payload.new.template_id && payload.new.host_id !== user?.id) {
              navigate(`/workout/session/${sessionId}`)
            }
          }
        }
      )
      .subscribe()
    
    return () => {
      supabase.removeChannel(participantsChannel)
      supabase.removeChannel(participantListener)
      supabase.removeChannel(sessionChannel)
    }
  }, [sessionId, navigate])
  
  const getParticipantProfile = (userId) => {
    return profiles[userId]
  }
  
  const getInitials = (name) => {
    if (!name) return 'U'
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  }
  
  const AvatarWithFallback = ({ userId, defaultColor = 'orange' }) => {
    const profile = getParticipantProfile(userId)
    const avatarUrl = profile?.avatar_url
    const name = profile?.username || profile?.full_name
    const initials = getInitials(name)
    const [imageError, setImageError] = useState(false)
    
    const colorClass = defaultColor === 'orange' 
      ? 'bg-orange-600 dark:bg-orange-500' 
      : 'bg-zinc-600 dark:bg-zinc-500'
    
    if (avatarUrl && !imageError) {
      return (
        <img
          src={avatarUrl}
          alt={name || 'User'}
          className="w-20 h-20 rounded-full object-cover mb-3"
          onError={() => setImageError(true)}
        />
      )
    }
    
    return (
      <div className={`w-20 h-20 rounded-full flex items-center justify-center font-bold text-2xl text-white mb-3 ${colorClass}`}>
        {initials}
      </div>
    )
  }
  
  const isHost = session?.host_id === user?.id
  const currentUserParticipant = participants.find(p => p.user_id === user?.id)
  const partnerParticipant = participants.find(p => p.user_id !== user?.id)
  const isBothReady = participants.length === 2 && 
    participants.every(p => p.status === 'joined' || p.status === 'host')
  
  /**
   * Handles leaving the session lobby.
   * 
   * If the user is the host, deletes the entire session. If the user is a guest,
   * only removes themselves from session_participants. Updates the user's profile
   * to clear the current_session_id and search_status.
   * 
   * @returns {Promise<void>} Resolves when the user has successfully left the lobby
   */
  const handleLeaveLobby = async () => {
    if (isHost) {
      // Host leaves - delete the session
      await supabase
        .from('live_sessions')
        .delete()
        .eq('id', sessionId)
      
      await supabase
        .from('profiles')
        .update({
          current_session_id: null,
          search_status: false
        })
        .eq('user_id', user.id)
    } else {
      // Guest leaves - update participant status
      if (currentUserParticipant) {
        await supabase
          .from('session_participants')
          .update({ status: 'left' })
          .eq('id', currentUserParticipant.id)
      }
      
      await supabase
        .from('profiles')
        .update({
          current_session_id: null,
          search_status: false
        })
        .eq('user_id', user.id)
    }
    
    navigate('/dashboard')
  }
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-zinc-950">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-orange-600 dark:text-orange-500" />
          <p className="text-zinc-600 dark:text-zinc-400 text-lg">Loading lobby...</p>
        </div>
      </div>
    )
  }
  
  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950 flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-20 px-4 py-3 border-b bg-white dark:bg-zinc-950 safe-top">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-semibold text-zinc-950 dark:text-zinc-50">
            Workout Lobby
          </h1>
          <button
            onClick={handleLeaveLobby}
            className="px-4 py-2 rounded-lg text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all"
          >
            Leave
          </button>
        </div>
      </header>
      
      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="max-w-2xl w-full">
          <div className="bento-card p-8 text-center">
            {/* Participants */}
            <div className="flex items-center justify-center gap-8 mb-8">
              {/* Current User */}
              <div className="flex flex-col items-center">
                <AvatarWithFallback userId={user?.id} defaultColor="orange" />
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2">
                  {currentUserParticipant?.status === 'host' ? 'Host' : 'Guest'}
                </p>
              </div>
              
              {/* VS or Connection */}
              <div className="flex flex-col items-center">
                <Users className="w-8 h-8 text-zinc-400 mb-2" />
                <span className="text-sm text-zinc-500 dark:text-zinc-400">
                  {participants.length === 2 ? 'Connected' : 'Waiting...'}
                </span>
              </div>
              
              {/* Partner */}
              {partnerParticipant ? (
                <div className="flex flex-col items-center">
                  <AvatarWithFallback userId={partnerParticipant.user_id} defaultColor="gray" />
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2">
                    {partnerParticipant.status === 'pending' ? 'Pending' : 'Joined'}
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  <div className="w-20 h-20 rounded-full flex items-center justify-center font-bold text-2xl bg-zinc-200 dark:bg-zinc-800 text-zinc-400 mb-3">
                    ?
                  </div>
                  <p className="font-medium text-zinc-500 dark:text-zinc-400">
                    Waiting for partner...
                  </p>
                </div>
              )}
            </div>
            
            {/* Status Message */}
            {!isBothReady ? (
              <div className="mb-8">
                {partnerParticipant?.status === 'pending' ? (
                  <div className="flex items-center justify-center gap-3">
                    <Loader2 className="w-5 h-5 animate-spin text-orange-600 dark:text-orange-500" />
                    <p className="text-lg text-zinc-600 dark:text-zinc-400">
                      Waiting for partner to accept...
                    </p>
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-3">
                    <Loader2 className="w-5 h-5 animate-spin text-orange-600 dark:text-orange-500" />
                    <p className="text-lg text-zinc-600 dark:text-zinc-400">
                      Connecting to lobby...
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="mb-8">
                <div className="flex items-center justify-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                  <p className="text-lg font-semibold text-green-600 dark:text-green-400">
                    Both athletes are ready!
                  </p>
                </div>
              </div>
            )}
            
            {/* Host Controls */}
            {isHost && isBothReady && (
              <div className="space-y-3">
                <button
                  onClick={() => navigate('/dashboard')}
                  className="w-full py-4 rounded-lg font-semibold text-white text-lg transition-all btn-primary flex items-center justify-center gap-2"
                >
                  <LayoutTemplate className="w-5 h-5" />
                  Choose or Create Template
                </button>
              </div>
            )}
            
            {/* Guest View */}
            {!isHost && isBothReady && (
              <div className="space-y-3">
                <div className="flex items-center justify-center gap-3 p-4 rounded-lg bg-zinc-50 dark:bg-zinc-800">
                  <Loader2 className="w-5 h-5 animate-spin text-orange-600 dark:text-orange-500" />
                  <p className="text-lg text-zinc-600 dark:text-zinc-400">
                    Waiting for Host to select a workout...
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
