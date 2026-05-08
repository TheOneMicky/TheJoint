import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { 
  ArrowLeft, 
  Moon,
  Sun,
  Monitor,
  Users,
  Calendar
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export default function Profile() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [theme, setTheme] = useState('light')
  const [userProfile, setUserProfile] = useState(null)
  const [totalWorkouts, setTotalWorkouts] = useState(0)
  const [totalMinutes, setTotalMinutes] = useState(0)
  const [totalReps, setTotalReps] = useState(0)
  const [partnersMatched, setPartnersMatched] = useState(0)
  const [frequentPartners, setFrequentPartners] = useState([])
  const [recentPartners, setRecentPartners] = useState([])
  const [isEditing, setIsEditing] = useState(false)
  const [profileForm, setProfileForm] = useState({
    username: '',
    first_name: '',
    last_name: '',
    avatar_url: ''
  })

  useEffect(() => {
    if (user) {
      fetchUserProfile()
      fetchStats()
      fetchFrequentPartners()
      fetchRecentPartners()
    }
    
    // Read theme from localStorage on mount
    const savedTheme = localStorage.getItem('theme')
    if (savedTheme) {
      setTheme(savedTheme)
    }
  }, []) // Empty dependency array ensures fresh fetch on every mount

  const fetchUserProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (error) throw error
      setUserProfile(data)
      
      // Split full_name into first and last name
      const names = (data.full_name || '').split(' ')
      const firstName = names[0] || ''
      const lastName = names.slice(1).join(' ') || ''
      
      setProfileForm({
        username: data.username || '',
        first_name: firstName,
        last_name: lastName,
        avatar_url: data.avatar_url || ''
      })
    } catch (error) {
      console.error('Error fetching profile:', error)
    }
  }

  const fetchStats = async () => {
    try {
      // Fetch user stats directly from profiles table
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('user_id, total_reps, total_minutes, workouts_completed, partner_count, search_status')
        .eq('user_id', user.id)
        .single()

      if (error) throw error

      setTotalWorkouts(profile?.workouts_completed || 0)
      setTotalMinutes(profile?.total_minutes || 0)
      setTotalReps(profile?.total_reps || 0)
      setPartnersMatched(profile?.partner_count || 0)
    } catch (error) {
      console.error('Error fetching stats:', error)
    }
  }

  useEffect(() => {
    if (user) {
      fetchUserProfile()
      fetchStats()
    }
  }, [user])

  const fetchFrequentPartners = async () => {
    try {
      const { data, error } = await supabase
        .from('partner_history')
        .select('last_workout_at, partner:profiles!partner_id(username, avatar_url, total_reps)')
        .or(`user_id.eq.${user.id},partner_id.eq.${user.id}`)
        .order('last_workout_at', { ascending: false })
        .limit(5)

      if (data) {
        const partners = data.map(item => ({
          id: item.partner.id,
          name: item.partner.username || 'Unknown',
          avatar_url: item.partner.avatar_url,
          total_reps: item.partner.total_reps,
          last_workout_at: item.last_workout_at
        }))
        setFrequentPartners(partners)
      }
    } catch (error) {
      console.error('Error fetching partners:', error)
    }
  }

  const fetchRecentPartners = async () => {
    try {
      const { data } = await supabase
        .from('partner_history')
        .select('last_workout_at, profiles!partner_id(username, avatar_url, total_reps)')
        .eq('user_id', user.id)
        .order('last_workout_at', { ascending: false })
        .limit(5)

      if (data) {
        const partners = data.map(item => ({
          ...item.profiles,
          last_workout_at: item.last_workout_at
        }))
        setRecentPartners(partners)
      }
    } catch (error) {
      console.error('Error fetching recent partners:', error)
    }
  }

  const handleThemeChange = (newTheme) => {
    setTheme(newTheme)
    
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark')
      localStorage.setItem('theme', 'dark')
    } else if (newTheme === 'light') {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('theme', 'light')
    } else {
      // System - detect system preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      if (prefersDark) {
        document.documentElement.classList.add('dark')
        localStorage.setItem('theme', 'dark')
      } else {
        document.documentElement.classList.remove('dark')
        localStorage.setItem('theme', 'light')
      }
    }
  }

  const uploadAvatar = async (event) => {
    try {
      const file = event.target.files[0]
      if (!file) return

      if (file.size > 2 * 1024 * 1024) {
        alert('File size must be less than 2MB')
        return
      }

      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
      if (!allowedTypes.includes(file.type)) {
        alert('Only JPEG, PNG, and WebP images are allowed')
        return
      }

      const fileExt = file.name.split('.').pop()
      const fileName = `${user.id}/profile_pic.${fileExt}`

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, { upsert: true })

      if (uploadError) {
        console.error('Error uploading avatar:', uploadError)
        alert('Failed to upload avatar')
        return
      }

      const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName)

      setProfileForm(prev => ({ ...prev, avatar_url: urlData.publicUrl }))
    } catch (error) {
      console.error('Error uploading avatar:', error)
      alert('Failed to upload avatar')
    }
  }

  const saveProfile = async () => {
    try {
      const fullName = `${profileForm.first_name.trim()} ${profileForm.last_name.trim()}`.trim()

      const { error } = await supabase
        .from('profiles')
        .update({
          username: profileForm.username.trim(),
          full_name: fullName,
          avatar_url: profileForm.avatar_url
        })
        .eq('user_id', user.id)

      if (error) throw error

      setUserProfile(prev => ({
        ...prev,
        username: profileForm.username.trim(),
        full_name: fullName,
        avatar_url: profileForm.avatar_url
      }))

      setIsEditing(false)
      alert('Profile updated successfully!')
    } catch (error) {
      console.error('Error updating profile:', error)
      alert('Failed to update profile. Please try again.')
    }
  }

  const getInitials = (name) => {
    if (!name) return 'U'
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  }

  const getMemberSince = () => {
    // Use user.created_at from auth or userProfile.created_at
    const createdAt = user?.created_at || userProfile?.created_at
    if (!createdAt) return '2024'
    const date = new Date(createdAt)
    return date.getFullYear().toString()
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
          <h1 className="text-xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">Profile</h1>
        </div>
      </header>

      <main className="px-4 py-6 max-w-4xl mx-auto animate-slide-up">
        {/* Profile Header */}
        <div className="flex flex-col items-center mb-8">
          {/* Large Avatar or Initials */}
          {profileForm.avatar_url ? (
            <img
              src={profileForm.avatar_url}
              alt="Profile avatar"
              className="w-24 h-24 rounded-full object-cover border-4 border-zinc-200 dark:border-zinc-700 mb-4"
            />
          ) : (
            <div className="w-24 h-24 rounded-full flex items-center justify-center mb-4 bg-zinc-100 dark:bg-zinc-800 border-4 border-zinc-200 dark:border-zinc-700">
              <span className="text-3xl font-semibold text-zinc-950 dark:text-zinc-50">
                {getInitials(profileForm.first_name + ' ' + profileForm.last_name || user?.email)}
              </span>
            </div>
          )}
          
          {/* User Name */}
          <h2 className="text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50 mb-2">
            {profileForm.first_name && profileForm.last_name 
              ? `${profileForm.first_name} ${profileForm.last_name}` 
              : userProfile?.full_name || user?.email?.split('@')[0] || 'User'}
          </h2>
          
          {/* Username */}
          <p className="text-zinc-500 dark:text-zinc-400 mb-4">
            @{profileForm.username || 'No username'}
          </p>
          
          {/* Edit Button */}
          <button
            onClick={() => setIsEditing(true)}
            className="text-sm font-medium text-orange-600 dark:text-orange-500 hover:text-orange-700 dark:hover:text-orange-400"
          >
            Edit Profile
          </button>
          
          {/* Member Since Tag */}
          <div className="flex items-center text-sm text-zinc-500 dark:text-zinc-400 mt-4">
            <Calendar className="w-4 h-4 mr-1.5 text-orange-600 dark:text-orange-500" />
            <span>Member since {getMemberSince()}</span>
          </div>
        </div>

        {/* Edit Profile Form */}
        {isEditing && (
          <div className="bento-card p-6 mb-8">
            <h3 className="text-lg font-semibold tracking-tight text-zinc-950 dark:text-zinc-50 mb-4">Edit Profile</h3>
            <div className="space-y-4">
              {/* Avatar Upload */}
              <div className="flex flex-col items-center mb-6">
                <input
                  type="file"
                  ref={(input) => {
                    if (input) {
                      input.value = ''
                    }
                  }}
                  onChange={uploadAvatar}
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  id="avatar-upload"
                />
                <label
                  htmlFor="avatar-upload"
                  className="cursor-pointer text-sm font-medium text-orange-600 dark:text-orange-500 hover:text-orange-700 dark:hover:text-orange-400"
                >
                  Change Avatar
                </label>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                  JPEG, PNG, or WebP (max 2MB)
                </p>
              </div>
              {/* Username */}
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Username
                </label>
                <input
                  type="text"
                  value={profileForm.username}
                  onChange={(e) => setProfileForm({ ...profileForm, username: e.target.value })}
                  className="w-full px-4 py-3 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-950 dark:text-zinc-50 focus:outline-none focus:ring-2 focus:ring-orange-600 dark:focus:ring-orange-500"
                  placeholder="Enter username"
                />
              </div>
              {/* First Name */}
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  First Name
                </label>
                <input
                  type="text"
                  value={profileForm.first_name}
                  onChange={(e) => setProfileForm({ ...profileForm, first_name: e.target.value })}
                  className="w-full px-4 py-3 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-950 dark:text-zinc-50 focus:outline-none focus:ring-2 focus:ring-orange-600 dark:focus:ring-orange-500"
                  placeholder="Enter first name"
                />
              </div>
              {/* Last Name */}
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Last Name
                </label>
                <input
                  type="text"
                  value={profileForm.last_name}
                  onChange={(e) => setProfileForm({ ...profileForm, last_name: e.target.value })}
                  className="w-full px-4 py-3 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-950 dark:text-zinc-50 focus:outline-none focus:ring-2 focus:ring-orange-600 dark:focus:ring-orange-500"
                  placeholder="Enter last name"
                />
              </div>
              {/* Save/Cancel Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => setIsEditing(false)}
                  className="flex-1 py-3 rounded-lg font-medium text-zinc-950 dark:text-zinc-50 transition-all bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                >
                  Cancel
                </button>
                <button
                  onClick={saveProfile}
                  className="flex-1 py-3 rounded-lg font-medium text-white transition-all btn-primary"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Stats Row - Four Large Bento Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {/* Workouts */}
          <div className="bento-card p-6 text-center">
            <p className="text-4xl font-semibold tracking-tight text-orange-600 dark:text-orange-500 mb-2">
              {totalWorkouts}
            </p>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Workouts</p>
          </div>
          
          {/* Minutes */}
          <div className="bento-card p-6 text-center">
            <p className="text-4xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50 mb-2">
              {totalMinutes}
            </p>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Minutes</p>
          </div>
          
          {/* Total Reps */}
          <div className="bento-card p-6 text-center">
            <p className="text-4xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50 mb-2">
              {totalReps}
            </p>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Total Reps</p>
          </div>
          
          {/* Partners */}
          <div className="bento-card p-6 text-center">
            <p className="text-4xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50 mb-2">
              {partnersMatched}
            </p>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Partners</p>
          </div>
        </div>

        {/* Preferences Section */}
        <div className="bento-card p-6 mb-8">
          <h3 className="text-lg font-semibold tracking-tight text-zinc-950 dark:text-zinc-50 mb-4">Settings</h3>
          
          {/* Theme Toggle */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center">
                {theme === 'dark' ? (
                  <Moon className="w-5 h-5 mr-3 text-zinc-600 dark:text-zinc-400" />
                ) : theme === 'light' ? (
                  <Sun className="w-5 h-5 mr-3 text-orange-600 dark:text-orange-500" />
                ) : (
                  <Monitor className="w-5 h-5 mr-3 text-zinc-600 dark:text-zinc-400" />
                )}
                <span className="text-zinc-950 dark:text-zinc-50">Theme</span>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleThemeChange('light')}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  theme === 'light'
                    ? 'bg-orange-600 dark:bg-orange-500 text-white'
                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-950 dark:text-zinc-50 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                }`}
              >
                <Sun className="w-4 h-4" />
                Light
              </button>
              <button
                onClick={() => handleThemeChange('dark')}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  theme === 'dark'
                    ? 'bg-orange-600 dark:bg-orange-500 text-white'
                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-950 dark:text-zinc-50 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                }`}
              >
                <Moon className="w-4 h-4" />
                Dark
              </button>
              <button
                onClick={() => handleThemeChange('system')}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  theme === 'system'
                    ? 'bg-orange-600 dark:bg-orange-500 text-white'
                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-950 dark:text-zinc-50 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                }`}
              >
                <Monitor className="w-4 h-4" />
                System
              </button>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2">
              {theme === 'system' 
                ? 'Theme matches your system settings' 
                : theme === 'dark' 
                  ? 'Dark mode always enabled' 
                  : 'Light mode always enabled'}
            </p>
          </div>
        </div>

        {/* Partners List */}
        <div className="bento-card p-6">
          <h3 className="text-lg font-semibold tracking-tight text-zinc-950 dark:text-zinc-50 mb-4">Recent Partners</h3>
          
          {recentPartners.length === 0 ? (
            <div className="text-center py-8">
              <Users className="w-12 h-12 mx-auto mb-3 text-zinc-400 dark:text-zinc-600" />
              <p className="text-sm text-zinc-500 dark:text-zinc-400">No partners yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentPartners.map((partner) => (
                <div
                  key={partner.username}
                  className="flex items-center justify-between p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
                >
                  <div className="flex items-center">
                    {/* Avatar or Initials */}
                    {partner.avatar_url ? (
                      <img
                        src={partner.avatar_url}
                        alt={partner.username}
                        className="w-10 h-10 rounded-full object-cover mr-3"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full flex items-center justify-center mr-3 bg-zinc-100 dark:bg-zinc-800">
                        <span className="text-sm font-semibold text-zinc-600 dark:text-zinc-400">
                          {getInitials(partner.username)}
                        </span>
                      </div>
                    )}
                    <div>
                      <p className="font-medium text-zinc-950 dark:text-zinc-50">
                        {partner.username || 'Unknown'}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
