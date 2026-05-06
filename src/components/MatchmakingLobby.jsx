import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { UserPlus, UserCheck, X, Loader2 } from 'lucide-react'

export default function MatchmakingLobby() {
  const { user } = useAuth()
  const [availablePartners, setAvailablePartners] = useState([])
  const [loading, setLoading] = useState(true)
  const [inviting, setInviting] = useState(null)

  useEffect(() => {
    if (!user?.id) return

    // Real-time subscription to profiles table
    const channel = supabase
      .channel('profiles-searching')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'profiles',
          filter: `search_status=eq.true`
        },
        (payload) => {
          fetchAvailablePartners()
        }
      )
      .subscribe()

    fetchAvailablePartners()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user])

  const fetchAvailablePartners = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, full_name, username, avatar_url')
        .eq('search_status', true)
        .is('current_session_id', null)
        .neq('user_id', user.id)

      if (error) throw error
      setAvailablePartners(data || [])
    } catch (error) {
      console.error('Error fetching available partners:', error)
    } finally {
      setLoading(false)
    }
  }

  /**
   * Initiates a workout invitation to a partner.
   * 
   * Creates a new live_sessions record with the current user as host,
   * inserts both users into session_participants (host with 'host' status,
   * partner with 'pending' status), and updates the host's profile to reflect
   * the active session. The partner receives a realtime notification via
   * InviteListener.
   * 
   * @param {string} partnerId - The UUID of the user being invited
   * @returns {Promise<void>} Resolves when the invitation is successfully sent
   */
  const invitePartner = async (partnerId) => {
    try {
      setInviting(partnerId)

      // Create new live_sessions row (current user becomes host)
      const { data: session, error: sessionError } = await supabase
        .from('live_sessions')
        .insert({
          host_id: user.id,
          status: 'pending'
        })
        .select()
        .single()

      if (sessionError) throw sessionError

      const sessionId = session.id

      // Insert current user as host
      const { error: hostError } = await supabase
        .from('session_participants')
        .insert({
          session_id: sessionId,
          user_id: user.id,
          status: 'host'
        })

      if (hostError) throw hostError

      // Insert partner as pending
      const { error: partnerError, data: partnerData } = await supabase
        .from('session_participants')
        .insert({
          session_id: sessionId,
          user_id: partnerId,
          status: 'pending'
        })
        .select()

      if (partnerError) throw partnerError

      // Update current user's session
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ current_session_id: sessionId, search_status: false })
        .eq('user_id', user.id)

      if (updateError) throw updateError

      // Navigate to session lobby to wait for partner
      window.location.href = `/workout/session/${sessionId}/lobby`
    } catch (error) {
      console.error('Error inviting partner:', error)
    } finally {
      setInviting(null)
    }
  }

  const getInitials = (name) => {
    if (!name) return 'U'
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
      </div>
    )
  }

  if (availablePartners.length === 0) {
    return (
      <div className="text-center p-8">
        <UserCheck className="w-12 h-12 mx-auto mb-3 text-zinc-400" />
        <p className="text-zinc-500 dark:text-zinc-400">
          Cannot find anyone? Tell your workout partner to click "Find Partner" (like you did) and you'll see them here!
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-zinc-600 dark:text-zinc-400 mb-3">
        Available Partners ({availablePartners.length})
      </h3>
      {availablePartners.map((partner) => (
        <div
          key={partner.user_id}
          className="bento-card p-3 flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            {partner.avatar_url ? (
              <img
                src={partner.avatar_url}
                alt={partner.full_name}
                className="w-10 h-10 rounded-full object-cover border-2 border-zinc-200 dark:border-zinc-800"
              />
            ) : (
              <div className="w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm bg-orange-600 dark:bg-orange-500 text-white">
                {getInitials(partner.username || partner.full_name)}
              </div>
            )}
            <div>
              <p className="font-medium text-zinc-950 dark:text-zinc-50">
                {partner.username || partner.full_name || 'Anonymous'}
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Looking for workout partner
              </p>
            </div>
          </div>
          <button
            onClick={() => invitePartner(partner.user_id)}
            disabled={inviting === partner.user_id}
            className="btn-primary px-3 py-2 text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {inviting === partner.user_id ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <UserPlus className="w-4 h-4" />
            )}
            {inviting === partner.user_id ? 'Inviting...' : 'Invite'}
          </button>
        </div>
      ))}
    </div>
  )
}
