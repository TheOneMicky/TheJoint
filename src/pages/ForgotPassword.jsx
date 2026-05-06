import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Mail, ArrowLeft, Check, AlertCircle } from 'lucide-react'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess(false)

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })

      if (error) {
        setError(error.message)
      } else {
        setSuccess(true)
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col justify-center py-12 sm:px-6 lg:px-8" style={{ backgroundColor: '#1A1A1A' }}>
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 rounded-full flex items-center justify-center mb-4" style={{ backgroundColor: '#FF6B35' }}>
            <Mail className="h-7 w-7 text-white" />
          </div>
          <h2 className="text-3xl font-bold text-white">
            Reset your password
          </h2>
          <p className="mt-2 text-sm" style={{ color: '#9A9A9A' }}>
            Enter your email address and we'll send you a link to reset your password.
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
          {success ? (
            <div className="text-center">
              <div 
                className="mx-auto h-12 w-12 rounded-full flex items-center justify-center mb-4"
                style={{ backgroundColor: 'rgba(34, 197, 94, 0.2)' }}
              >
                <Check className="h-6 w-6 text-green-500" />
              </div>
              <h3 className="text-lg font-medium text-white mb-2">Check your email</h3>
              <p className="text-sm mb-6" style={{ color: '#9A9A9A' }}>
                We've sent a password reset link to <span className="text-white">{email}</span>
              </p>
              <Link
                to="/auth"
                className="inline-flex items-center text-sm font-medium"
                style={{ color: '#FF6B35' }}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to sign in
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="email" className="block text-sm font-medium mb-2" style={{ color: '#BABABA' }}>
                  Email address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5" style={{ color: '#7A7A7A' }} />
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-3 py-3 rounded-lg focus:outline-none transition-all"
                    style={{ 
                      backgroundColor: '#3A3A3A', 
                      border: '1px solid #4A4A4A',
                      color: '#FFFFFF'
                    }}
                    placeholder="Enter your email"
                    required
                  />
                </div>
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
                disabled={loading}
                className="w-full py-3 rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ 
                  backgroundColor: loading ? '#CC4A22' : '#FF6B35', 
                  color: '#FFFFFF'
                }}
                onMouseEnter={(e) => {
                  if (!loading) e.currentTarget.style.backgroundColor = '#FF875C';
                }}
                onMouseLeave={(e) => {
                  if (!loading) e.currentTarget.style.backgroundColor = '#FF6B35';
                }}
              >
                {loading ? 'Sending...' : 'Send reset link'}
              </button>

              <div className="text-center">
                <Link
                  to="/auth"
                  className="inline-flex items-center text-sm font-medium hover:underline"
                  style={{ color: '#9A9A9A' }}
                  onMouseEnter={(e) => e.currentTarget.style.color = '#BABABA'}
                  onMouseLeave={(e) => e.currentTarget.style.color = '#9A9A9A'}
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to sign in
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
