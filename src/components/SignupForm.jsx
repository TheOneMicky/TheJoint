import { useState } from 'react'
import { Eye, EyeOff, Loader2, Check } from 'lucide-react'

export default function SignupForm({ onSubmit, loading, error }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const handleSubmit = (e) => {
    e.preventDefault()
    if (password !== confirmPassword) {
      return
    }
    onSubmit({ email, password })
  }

  const passwordsMatch = password === confirmPassword && password !== ''
  const hasMinLength = password.length >= 6

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Email Input */}
      <div>
        <label htmlFor="signup-email" className="block text-sm font-medium mb-2 text-zinc-600 dark:text-zinc-400">
          Email address
        </label>
        <input
          id="signup-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="input-field"
          placeholder="Enter your email"
          required
        />
      </div>

      {/* Password Input */}
      <div>
        <label htmlFor="signup-password" className="block text-sm font-medium mb-2 text-zinc-600 dark:text-zinc-400">
          Password
        </label>
        <div className="relative">
          <input
            id="signup-password"
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input-field pr-12"
            placeholder="Create a password"
            required
            minLength="6"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-400 transition-colors"
          >
            {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          </button>
        </div>
        {password && !hasMinLength && (
          <p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">Must be at least 6 characters</p>
        )}
      </div>

      {/* Confirm Password Input */}
      <div>
        <label htmlFor="confirmPassword" className="block text-sm font-medium mb-2 text-zinc-600 dark:text-zinc-400">
          Confirm Password
        </label>
        <div className="relative">
          <input
            id="confirmPassword"
            type={showConfirmPassword ? 'text' : 'password'}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className={`input-field pr-12 ${confirmPassword && !passwordsMatch ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`}
            placeholder="Confirm your password"
            required
            minLength="6"
          />
          <button
            type="button"
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-400 transition-colors"
          >
            {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          </button>
          {confirmPassword && passwordsMatch && (
            <Check className="absolute right-10 top-1/2 transform -translate-y-1/2 w-4 h-4 text-green-600 dark:text-green-500" />
          )}
        </div>
        {confirmPassword && !passwordsMatch && (
          <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">Passwords do not match</p>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="px-4 py-3 rounded-xl bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Submit Button */}
      <button
        type="submit"
        disabled={loading || !passwordsMatch || !hasMinLength}
        className="btn-primary w-full"
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Creating account...
          </>
        ) : (
          'Create account'
        )}
      </button>
    </form>
  )
}
