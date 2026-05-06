import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import LoginForm from '../components/LoginForm'
import SignupForm from '../components/SignupForm'
import { Check } from 'lucide-react'
import logo from '../assets/logo.svg'

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const { signIn, signUp } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    // Check for mode from landing page
    if (location.state?.mode) {
      setIsLogin(location.state.mode === 'login')
    }
    
    // Check for success message from password reset
    if (location.state?.message) {
      setSuccessMessage(location.state.message)
      // Clear the message from location state
      window.history.replaceState({}, document.title)
    }
  }, [location])

  const handleLogin = async ({ email, password }) => {
    setLoading(true)
    setError('')
    
    try {
      const { error } = await signIn(email, password)
      if (error) {
        setError(error.message)
      } else {
        navigate('/dashboard')
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleSignup = async ({ email, password }) => {
    setLoading(true)
    setError('')
    
    try {
      const { error } = await signUp(email, password)
      if (error) {
        setError(error.message)
      } else {
        setError('Please check your email to verify your account.')
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 bg-white dark:bg-zinc-950">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="text-center">
          {/* Logo */}
          <div className="mx-auto mb-5 animate-slide-up">
            <img src={logo} alt="LiftIn" className="h-16 w-16 object-contain mx-auto" />
          </div>
          <h2 className="text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50 mb-2">
            {isLogin ? 'Welcome back' : 'Create account'}
          </h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {isLogin ? "Don't have an account?" : "Already have an account?"}
            <button
              onClick={() => {
                setIsLogin(!isLogin)
                setError('')
              }}
              className="ml-1.5 font-semibold text-orange-600 dark:text-orange-500 hover:text-orange-700 dark:hover:text-orange-400 transition-colors"
            >
              {isLogin ? 'Sign up' : 'Sign in'}
            </button>
          </p>
        </div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md animate-slide-up">
        <div className="bento-card py-8 px-6 sm:px-10">
          {successMessage && (
            <div className="mb-6 flex items-center px-4 py-3 rounded-xl bg-green-100 dark:bg-green-900/30 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400">
              <Check className="w-5 h-5 mr-2 flex-shrink-0" />
              <span className="text-sm font-medium">{successMessage}</span>
            </div>
          )}
          {isLogin ? (
            <LoginForm onSubmit={handleLogin} loading={loading} error={error} />
          ) : (
            <SignupForm onSubmit={handleSignup} loading={loading} error={error} />
          )}
        </div>
      </div>
    </div>
  )
}
