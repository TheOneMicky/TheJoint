import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Users, X } from 'lucide-react'

export default function InviteListener() {
  const { user: currentUser } = useAuth()
  const navigate = useNavigate()
  const [invite, setInvite] = useState(null)
  const [isDeclining, setIsDeclining] = useState(false)

  useEffect(() => {
    if (!currentUser?.id) return

    const channel = supabase
      .channel('invite-listener')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'session_participants' },
        async (payload) => {
          // Client-side filtering
          if (payload.new.user_id === currentUser.id && payload.new.status === 'pending') {

            try {
              // Fetch host profile info
              const { data: sessionData } = await supabase
                .from('live_sessions')
                .select('host_id')
                .eq('id', payload.new.session_id)
                .maybeSingle()

              if (sessionData?.host_id) {
                const { data: hostProfile } = await supabase
                  .from('profiles')
                  .select('username, avatar_url, full_name')
                  .eq('user_id', sessionData.host_id)
                  .maybeSingle()

                setInvite({
                  sessionId: payload.new.session_id,
                  participantId: payload.new.id,
                  hostId: sessionData.host_id,
                  hostName: hostProfile?.username || hostProfile?.full_name || 'Unknown',
                  hostAvatar: hostProfile?.avatar_url
                })
              }
            } catch (error) {
              console.error('Error fetching host info:', error)
            }
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [currentUser])

  /**
   * Accepts a workout invitation and joins the session.
   * 
   * Updates the session_participants status to 'joined', sets the user's
   * current_session_id in their profile, and navigates to the session lobby.
   * 
   * @returns {Promise<void>} Resolves when the user has successfully joined the session
   */
  const handleAccept = async () => {
    if (!invite) return

    try {
      // Update status to 'joined'
      const { error: updateError } = await supabase
        .from('session_participants')
        .update({ status: 'joined' })
        .eq('id', invite.participantId)

      if (updateError) throw updateError

      // Update profile current_session_id
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ current_session_id: invite.sessionId })
        .eq('user_id', currentUser.id)

      if (profileError) throw profileError

      setInvite(null)
      navigate(`/workout/session/${invite.sessionId}/lobby`)
    } catch (error) {
      console.error('Error accepting invite:', error)
      alert('Failed to accept invitation. Please try again.')
    }
  }

  /**
   * Declines a workout invitation and notifies the host.
   * 
   * Updates the session_participants status to 'declined', which triggers
   * a realtime notification to the host so they can see the invitation was rejected.
   * 
   * @returns {Promise<void>} Resolves when the invitation has been declined
   */
  const handleDecline = async () => {
    if (!invite) return

    setIsDeclining(true)
    try {
      // Update status to 'declined' to notify the host
      const { error } = await supabase
        .from('session_participants')
        .update({ status: 'declined' })
        .eq('id', invite.participantId)

      if (error) throw error

      setInvite(null)
    } catch (error) {
      console.error('Error declining invite:', error)
      alert('Failed to decline invitation. Please try again.')
    } finally {
      setIsDeclining(false)
    }
  }

  if (!invite) return null

  return (
    <div className="fixed top-4 right-4 z-50 animate-slide-in">
      <div className="bento-card p-6 max-w-sm bg-white dark:bg-zinc-800 shadow-2xl">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center">
            {invite.hostAvatar ? (
              <img
                src={invite.hostAvatar}
                alt={invite.hostName}
                className="w-12 h-12 rounded-full object-cover border-2 border-zinc-200 dark:border-zinc-700 mr-3"
              />
            ) : (
              <div className="w-12 h-12 rounded-full flex items-center justify-center bg-orange-600 dark:bg-orange-500 text-white mr-3">
                <Users className="w-6 h-6" />
              </div>
            )}
            <div>
              <h3 className="font-semibold text-zinc-950 dark:text-zinc-50">Workout Invitation!</h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">from {invite.hostName}</p>
            </div>
          </div>
          <button
            onClick={() => setInvite(null)}
            className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
          </button>
        </div>

        <p className="text-zinc-700 dark:text-zinc-300 mb-6">
          🏋️ {invite.hostName} invited you to a workout session!
        </p>

        <div className="flex gap-3">
          <button
            onClick={handleDecline}
            disabled={isDeclining}
            className="flex-1 py-2 px-4 rounded-lg font-medium text-zinc-950 dark:text-zinc-50 transition-all bg-zinc-100 dark:bg-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isDeclining ? 'Declining...' : 'Decline'}
          </button>
          <button
            onClick={handleAccept}
            className="flex-1 py-2 px-4 rounded-lg font-medium text-white transition-all btn-primary"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  )
}
