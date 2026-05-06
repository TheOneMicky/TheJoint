import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { 
  Users, 
  Search, 
  UserPlus, 
  Check, 
  X, 
  MessageCircle,
  Dumbbell,
  ArrowLeft,
  Loader2
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export default function UserMatching() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('discover')
  const [users, setUsers] = useState([])
  const [matches, setMatches] = useState([])
  const [pendingRequests, setPendingRequests] = useState([])
  const [sentRequests, setSentRequests] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user) {
      fetchUsersAndMatches()
    }
  }, [user])

  const fetchUsersAndMatches = async () => {
    setLoading(true)
    try {
      // Fetch all profiles except current user
      const { data: allProfiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, username, full_name, avatar_url, updated_at')
        .neq('user_id', user.id)

      if (profilesError) throw profilesError

      // Fetch existing matches
      const { data: userMatches, error: matchesError } = await supabase
        .from('user_matches')
        .select('*')
        .or(`user_id.eq.${user.id},matched_user_id.eq.${user.id}`)

      if (matchesError) throw matchesError

      // Process matches
      const accepted = []
      const pending = []
      const sent = []

      userMatches?.forEach(match => {
        if (match.status === 'accepted') {
          accepted.push(match)
        } else if (match.status === 'pending') {
          if (match.user_id === user.id) {
            sent.push(match)
          } else {
            pending.push(match)
          }
        }
      })

      setMatches(accepted)
      setPendingRequests(pending)
      setSentRequests(sent)

      // Filter out users who are already matched or have pending requests
      const matchedIds = userMatches?.map(m => 
        m.user_id === user.id ? m.matched_user_id : m.user_id
      ) || []

      const availableUsers = allProfiles?.filter(p => !matchedIds.includes(p.id)) || []
      setUsers(availableUsers)

    } catch (error) {
      console.error('Error fetching users:', error)
    } finally {
      setLoading(false)
    }
  }

  const sendMatchRequest = async (matchedUserId) => {
    try {
      const { error } = await supabase
        .from('user_matches')
        .insert({
          user_id: user.id,
          matched_user_id: matchedUserId,
          status: 'pending',
          created_at: new Date().toISOString()
        })

      if (error) throw error

      // Refresh data
      fetchUsersAndMatches()
    } catch (error) {
      console.error('Error sending match request:', error)
    }
  }

  const acceptMatchRequest = async (matchId) => {
    try {
      const { error } = await supabase
        .from('user_matches')
        .update({ status: 'accepted', updated_at: new Date().toISOString() })
        .eq('id', matchId)

      if (error) throw error

      fetchUsersAndMatches()
    } catch (error) {
      console.error('Error accepting match:', error)
    }
  }

  const rejectMatchRequest = async (matchId) => {
    try {
      const { error } = await supabase
        .from('user_matches')
        .update({ status: 'rejected', updated_at: new Date().toISOString() })
        .eq('id', matchId)

      if (error) throw error

      fetchUsersAndMatches()
    } catch (error) {
      console.error('Error rejecting match:', error)
    }
  }

  const filteredUsers = users.filter(u => {
    const matchesSearch = 
      (u.full_name && u.full_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (u.username && u.username.toLowerCase().includes(searchQuery.toLowerCase()))
    return matchesSearch
  })

  const getMatchDetails = (match) => {
    const isIncoming = match.user_id !== user.id
    const otherUserId = isIncoming ? match.user_id : match.matched_user_id
    return { isIncoming, otherUserId }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-zinc-950 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-orange-600 dark:text-orange-500 mx-auto" />
          <p className="mt-4 text-zinc-600 dark:text-zinc-400">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950">
      {/* Header */}
      <header className="nav-bar sticky top-0 z-20 px-4 py-4 safe-top">
        <div className="max-w-4xl mx-auto flex items-center">
          <button 
            onClick={() => navigate('/dashboard')}
            className="btn-icon mr-3"
          >
            <ArrowLeft className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
          </button>
          <Users className="w-6 h-6 text-orange-600 dark:text-orange-500 mr-2" />
          <h1 className="text-xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">Find Workout Partners</h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto py-6 px-4 animate-slide-up">
        {/* Tabs */}
        <div className="bento-card mb-6">
          <div className="flex border-b border-zinc-200 dark:border-zinc-800">
            <button
              onClick={() => setActiveTab('discover')}
              className={`flex-1 py-4 text-sm font-medium text-center transition-colors ${
                activeTab === 'discover' 
                  ? 'border-b-2 border-orange-600 dark:border-orange-500 text-orange-600 dark:text-orange-500' 
                  : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
              }`}
            >
              <div className="flex items-center justify-center">
                <Search className="w-4 h-4 mr-2" />
                Discover
                {users.length > 0 && (
                  <span className="ml-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 px-2 py-0.5 rounded-full text-xs">
                    {users.length}
                  </span>
                )}
              </div>
            </button>
            <button
              onClick={() => setActiveTab('requests')}
              className={`flex-1 py-4 text-sm font-medium text-center transition-colors ${
                activeTab === 'requests' 
                  ? 'border-b-2 border-orange-600 dark:border-orange-500 text-orange-600 dark:text-orange-500' 
                  : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
              }`}
            >
              <div className="flex items-center justify-center">
                <UserPlus className="w-4 h-4 mr-2" />
                Requests
                {pendingRequests.length > 0 && (
                  <span className="ml-2 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 px-2 py-0.5 rounded-full text-xs">
                    {pendingRequests.length}
                  </span>
                )}
              </div>
            </button>
            <button
              onClick={() => setActiveTab('matches')}
              className={`flex-1 py-4 text-sm font-medium text-center transition-colors ${
                activeTab === 'matches' 
                  ? 'border-b-2 border-orange-600 dark:border-orange-500 text-orange-600 dark:text-orange-500' 
                  : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
              }`}
            >
              <div className="flex items-center justify-center">
                <Users className="w-4 h-4 mr-2" />
                My Partners
                {matches.length > 0 && (
                  <span className="ml-2 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 px-2 py-0.5 rounded-full text-xs">
                    {matches.length}
                  </span>
                )}
              </div>
            </button>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'discover' && (
          <div>
            {/* Search */}
            <div className="bento-card p-4 mb-6">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-zinc-400 dark:text-zinc-500 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search by name or username..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="input-field pl-11"
                />
              </div>
            </div>

            {/* Users Grid */}
            {filteredUsers.length === 0 ? (
              <div className="bento-card p-12 text-center">
                <Users className="w-16 h-16 text-zinc-400 dark:text-zinc-600 mx-auto mb-4" />
                <h3 className="text-lg font-semibold tracking-tight text-zinc-950 dark:text-zinc-50 mb-2">
                  {searchQuery ? 'No users found' : 'No more users to discover'}
                </h3>
                <p className="text-zinc-500 dark:text-zinc-400">
                  {searchQuery 
                    ? 'Try a different search term' 
                    : 'Check back later for more workout partners!'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredUsers.map((user) => (
                  <UserCard 
                    key={user.id} 
                    user={user} 
                    onConnect={() => sendMatchRequest(user.id)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'requests' && (
          <div className="space-y-4">
            {/* Incoming Requests */}
            {pendingRequests.length > 0 && (
              <div className="bento-card p-4">
                <h3 className="text-sm font-medium text-zinc-950 dark:text-zinc-50 mb-4">Incoming Requests</h3>
                <div className="space-y-3">
                  {pendingRequests.map((request) => {
                    const requestUser = users.find(u => u.id === request.user_id) || {}
                    return (
                      <RequestCard
                        key={request.id}
                        user={requestUser}
                        type="incoming"
                        onAccept={() => acceptMatchRequest(request.id)}
                        onReject={() => rejectMatchRequest(request.id)}
                      />
                    )
                  })}
                </div>
              </div>
            )}

            {/* Sent Requests */}
            {sentRequests.length > 0 && (
              <div className="bento-card p-4">
                <h3 className="text-sm font-medium text-zinc-950 dark:text-zinc-50 mb-4">Sent Requests</h3>
                <div className="space-y-3">
                  {sentRequests.map((request) => {
                    const requestUser = users.find(u => u.id === request.matched_user_id) || {}
                    return (
                      <RequestCard
                        key={request.id}
                        user={requestUser}
                        type="sent"
                      />
                    )
                  })}
                </div>
              </div>
            )}

            {pendingRequests.length === 0 && sentRequests.length === 0 && (
              <div className="bento-card p-12 text-center">
                <UserPlus className="w-16 h-16 text-zinc-400 dark:text-zinc-600 mx-auto mb-4" />
                <h3 className="text-lg font-semibold tracking-tight text-zinc-950 dark:text-zinc-50 mb-2">No pending requests</h3>
                <p className="text-zinc-500 dark:text-zinc-400 mb-4">Start discovering and connecting with workout partners!</p>
                <button
                  onClick={() => setActiveTab('discover')}
                  className="btn-primary px-6 py-2.5"
                >
                  Discover Users
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'matches' && (
          <div>
            {matches.length === 0 ? (
              <div className="bento-card p-12 text-center">
                <Users className="w-16 h-16 text-zinc-400 dark:text-zinc-600 mx-auto mb-4" />
                <h3 className="text-lg font-semibold tracking-tight text-zinc-950 dark:text-zinc-50 mb-2">No workout partners yet</h3>
                <p className="text-zinc-500 dark:text-zinc-400 mb-4">Connect with other users to start working out together!</p>
                <button
                  onClick={() => setActiveTab('discover')}
                  className="btn-primary px-6 py-2.5"
                >
                  Find Partners
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {matches.map((match) => {
                  const { otherUserId } = getMatchDetails(match)
                  const matchUser = users.find(u => u.id === otherUserId) || 
                    { id: otherUserId, full_name: 'Unknown User', username: 'user' }
                  
                  return (
                    <MatchCard 
                      key={match.id} 
                      user={matchUser} 
                      matchDate={match.updated_at}
                    />
                  )
                })}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}

// Component helpers
function UserCard({ user, onConnect }) {
  const initials = (user.full_name || user.username || 'U').split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
  
  return (
    <div className="bento-card p-4 flex items-center justify-between">
      <div className="flex items-center">
        <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center text-orange-600 dark:text-orange-500 font-medium">
          {initials}
        </div>
        <div className="ml-3">
          <p className="font-medium text-zinc-950 dark:text-zinc-50">{user.full_name || user.username || 'Anonymous'}</p>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">@{user.username || 'user'}</p>
        </div>
      </div>
      <button
        onClick={onConnect}
        className="flex items-center px-3 py-2 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-500 rounded-lg hover:bg-orange-200 dark:hover:bg-orange-900/50 transition-colors"
      >
        <UserPlus className="w-4 h-4 mr-1" /> Connect
      </button>
    </div>
  )
}

function RequestCard({ user, type, onAccept, onReject }) {
  const initials = (user?.full_name || user?.username || 'U').split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
  
  return (
    <div className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-900 rounded-lg">
      <div className="flex items-center">
        <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center text-green-600 dark:text-green-500 text-sm font-medium">
          {initials}
        </div>
        <div className="ml-3">
          <p className="font-medium text-zinc-950 dark:text-zinc-50">{user?.full_name || user?.username || 'Unknown User'}</p>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">@{user?.username || 'user'}</p>
        </div>
      </div>
      
      {type === 'incoming' ? (
        <div className="flex space-x-2">
          <button
            onClick={onAccept}
            className="p-2 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-500 rounded-lg hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors"
          >
            <Check className="w-5 h-5" />
          </button>
          <button
            onClick={onReject}
            className="p-2 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      ) : (
        <span className="text-sm text-zinc-500 dark:text-zinc-400">Pending...</span>
      )}
    </div>
  )
}

function MatchCard({ user, matchDate }) {
  const initials = (user?.full_name || user?.username || 'U').split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
  
  return (
    <div className="bento-card p-4">
      <div className="flex items-center mb-4">
        <div className="w-12 h-12 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center text-zinc-600 dark:text-zinc-400 font-medium">
          {initials}
        </div>
        <div className="ml-3 flex-1">
          <p className="font-medium text-zinc-950 dark:text-zinc-50">{user?.full_name || user?.username || 'Unknown User'}</p>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">@{user?.username || 'user'}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-zinc-400 dark:text-zinc-500">
            Matched {new Date(matchDate).toLocaleDateString()}
          </p>
        </div>
      </div>
      
      <div className="flex space-x-2">
        <button className="flex-1 flex items-center justify-center px-3 py-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 text-sm transition-colors">
          <MessageCircle className="w-4 h-4 mr-1" /> Message
        </button>
        <button className="flex-1 flex items-center justify-center px-3 py-2 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-500 rounded-lg hover:bg-orange-200 dark:hover:bg-orange-900/50 text-sm transition-colors">
          <Dumbbell className="w-4 h-4 mr-1" /> Workout
        </button>
      </div>
    </div>
  )
}
