import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Lock, Eye, EyeOff, Check, AlertCircle, Loader2 } from 'lucide-react'

export default function ResetPassword() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [verifying, setVerifying] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [verified, setVerified] = useState(false)
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  useEffect(() => {
    // Get token_hash and type from URL query params
    const token_hash = searchParams.get('token_hash')
    const type = searchParams.get('type')

    if (!token_hash || type !== 'recovery') {
      setError('Invalid or missing reset token. Please request a new password reset link.')
      setVerifying(false)
      return
    }

    // Verify the OTP token
    const verifyToken = async () => {
      try {
        const { error } = await supabase.auth.verifyOtp({
          token_hash,
          type: 'recovery'
        })

        if (error) {
          // Check for specific token expired error
          if (error.message?.toLowerCase().includes('token') && error.message?.toLowerCase().includes('expired')) {
            setError('Link expired. Please request a new one.')
          } else {
            setError('Invalid or expired reset link. Please request a new one.')
          }
        } else {
          setVerified(true)
        }
      } catch (err) {
        setError('An error occurred while verifying your reset link.')
      } finally {
        setVerifying(false)
      }
    }

    verifyToken()
  }, [searchParams])

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    setLoading(true)
    setError('')

    try {
      // Update user password
      const { error } = await supabase.auth.updateUser({
        password: password
      })

      if (error) {
        setError(error.message)
      } else {
        setSuccess(true)
        // Sign out the user after password reset
        await supabase.auth.signOut()
        // Redirect to login after 3 seconds
        setTimeout(() => {
          navigate('/auth', { state: { message: 'Password reset successful. Please sign in with your new password.' } })
        }, 3000)
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const passwordsMatch = password === confirmPassword && password !== ''

  return (
    <div className="min-h-screen flex flex-col justify-center py-12 sm:px-6 lg:px-8" style={{ backgroundColor: '#1A1A1A' }}>
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 rounded-full flex items-center justify-center mb-4" style={{ backgroundColor: '#FF6B35' }}>
            <Lock className="h-7 w-7 text-white" />
          </div>
          <h2 className="text-3xl font-bold text-white">
            Create new password
          </h2>
          <p className="mt-2 text-sm" style={{ color: '#9A9A9A' }}>
            Enter your new password below.
          </p>
        </div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div 
          className="py-8 px-4 sm:px-10 rounded-xl border"
          style={{ 
            backgroundColor: '#2A2A2A', 
            borderColor: '#3A3A3A',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.3)'
          }}
        >
          {verifying ? (
            <div className="text-center py-8">
              <Loader2 className="h-8 w-8 mx-auto mb-4 animate-spin" style={{ color: '#FF6B35' }} />
              <p className="text-sm" style={{ color: '#9A9A9A' }}>
                Verifying your reset link...
              </p>
            </div>
          ) : success ? (
            <div className="text-center">
              <div 
                className="mx-auto h-12 w-12 rounded-full flex items-center justify-center mb-4"
                style={{ backgroundColor: 'rgba(34, 197, 94, 0.2)' }}
              >
                <Check className="h-6 w-6 text-green-500" />
              </div>
              <h3 className="text-lg font-medium text-white mb-2">Password updated!</h3>
              <p className="text-sm" style={{ color: '#9A9A9A' }}>
                Your password has been successfully reset. Redirecting to sign in...
              </p>
            </div>
          ) : verified ? (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="password" className="block text-sm font-medium mb-2" style={{ color: '#BABABA' }}>
                  New password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5" style={{ color: '#7A7A7A' }} />
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-12 py-3 rounded-lg focus:outline-none transition-all"
                    style={{ 
                      backgroundColor: '#3A3A3A', 
                      border: '1px solid #4A4A4A',
                      color: '#FFFFFF'
                    }}
                    placeholder="Enter new password"
                    required
                    minLength="6"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 transition-colors"
                    style={{ color: '#7A7A7A' }}
                    onMouseEnter={(e) => e.currentTarget.style.color = '#BABABA'}
                    onMouseLeave={(e) => e.currentTarget.style.color = '#7A7A7A'}
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium mb-2" style={{ color: '#BABABA' }}>
                  Confirm password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5" style={{ color: '#7A7A7A' }} />
                  <input
                    id="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full pl-10 pr-12 py-3 rounded-lg focus:outline-none transition-all"
                    style={{ 
                      backgroundColor: '#3A3A3A', 
                      border: confirmPassword && !passwordsMatch ? '1px solid #EF4444' : '1px solid #4A4A4A',
                      color: '#FFFFFF'
                    }}
                    placeholder="Confirm new password"
                    required
                    minLength="6"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 transition-colors"
                    style={{ color: '#7A7A7A' }}
                    onMouseEnter={(e) => e.currentTarget.style.color = '#BABABA'}
                    onMouseLeave={(e) => e.currentTarget.style.color = '#7A7A7A'}
                  >
                    {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                {confirmPassword && !passwordsMatch && (
                  <p className="mt-1 text-sm" style={{ color: '#FCA5A5' }}>Passwords do not match</p>
                )}
              </div>

              {error && (
                <div 
                  className="flex items-center px-4 py-3 rounded-lg"
                  style={{ 
                    backgroundColor: 'rgba(239, 68, 68, 0.1)', 
                    border: '1px solid rgba(239, 68, 68, 0.2)',
                    color: '#FCA5A5'
                  }}
                >
                  <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0" />
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !passwordsMatch}
                className="w-full py-3 rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ 
                  backgroundColor: loading ? '#CC4A22' : '#FF6B35', 
                  color: '#FFFFFF'
                }}
                onMouseEnter={(e) => {
                  if (!loading && passwordsMatch) e.currentTarget.style.backgroundColor = '#FF875C';
                }}
                onMouseLeave={(e) => {
                  if (!loading) e.currentTarget.style.backgroundColor = '#FF6B35';
                }}
              >
                {loading ? 'Updating...' : 'Update'}
              </button>
            </form>
          ) : (
            <div className="text-center py-4">
              <div 
                className="mx-auto h-12 w-12 rounded-full flex items-center justify-center mb-4"
                style={{ backgroundColor: 'rgba(239, 68, 68, 0.2)' }}
              >
                <AlertCircle className="h-6 w-6 text-red-500" />
              </div>
              <p className="text-sm" style={{ color: '#FCA5A5' }}>
                {error}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
