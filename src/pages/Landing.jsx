import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Users, LayoutTemplate, Activity, Dumbbell, BarChart3, Zap } from 'lucide-react'
import logo from '../assets/logo.svg'

const animations = [
  'animate-slide-up',
  'animate-bounce-in',
  'animate-scale-in',
  'animate-rotate-in',
  'animate-slide-left',
  'animate-slide-right'
]

export default function Landing() {
  const navigate = useNavigate()
  const [logoAnimation, setLogoAnimation] = useState('animate-slide-up')
  
  useEffect(() => {
    // Randomly select an animation on mount
    const randomAnimation = animations[Math.floor(Math.random() * animations.length)]
    setLogoAnimation(randomAnimation)
  }, [])
  
  const handleGetStarted = () => {
    navigate('/auth', { state: { mode: 'signup' } })
  }
  
  const handleJogIn = () => {
    navigate('/auth', { state: { mode: 'login' } })
  }

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950">
      {/* Hero Section */}
      <main className="flex flex-col items-center justify-center min-h-screen px-4 py-16">
        <div className="text-center max-w-2xl animate-slide-up mb-16">
          {/* Logo and Title */}
          <div className="flex items-center justify-center mb-6">
            <img src={logo} alt="The Joint" className={`h-20 w-20 object-contain mr-4 ${logoAnimation}`} />
            <h1 className="text-5xl font-bold tracking-tight text-zinc-950 dark:text-zinc-50">
              The Joint
            </h1>
          </div>
          
          {/* Tagline */}
          <p className="text-xl text-zinc-600 dark:text-zinc-400 mb-8">
            Sync your training. Find your partners. Lift together.
          </p>
          
          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={handleGetStarted}
              className="btn-primary px-8 py-3 text-lg inline-flex items-center justify-center"
            >
              Get Started
              <ArrowRight className="w-5 h-5 ml-2" />
            </button>
            <button
              onClick={handleJogIn}
              className="btn-secondary px-8 py-3 text-lg"
            >
              Jog in
            </button>
          </div>
        </div>

        {/* How It Works Section */}
        <div className="max-w-6xl w-full mb-16">
          <h2 className="text-3xl font-bold text-center text-zinc-950 dark:text-zinc-50 mb-12">
            How It Works
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Step 1 */}
            <div className="bento-card p-8 text-center hover:border-orange-500/50 transition-all">
              <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 bg-orange-100 dark:bg-orange-900/30">
                <Users className="w-8 h-8 text-orange-600 dark:text-orange-500" />
              </div>
              <div className="text-sm font-semibold text-orange-600 dark:text-orange-500 mb-2">Step 1</div>
              <h3 className="text-xl font-semibold text-zinc-950 dark:text-zinc-50 mb-2">Connect</h3>
              <p className="text-zinc-600 dark:text-zinc-400">Find a partner in the lobby</p>
            </div>
            
            {/* Step 2 */}
            <div className="bento-card p-8 text-center hover:border-orange-500/50 transition-all">
              <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 bg-orange-100 dark:bg-orange-900/30">
                <LayoutTemplate className="w-8 h-8 text-orange-600 dark:text-orange-500" />
              </div>
              <div className="text-sm font-semibold text-orange-600 dark:text-orange-500 mb-2">Step 2</div>
              <h3 className="text-xl font-semibold text-zinc-950 dark:text-zinc-50 mb-2">Create</h3>
              <p className="text-zinc-600 dark:text-zinc-400">Make a workout template that fits your goals</p>
            </div>
            
            {/* Step 3 */}
            <div className="bento-card p-8 text-center hover:border-orange-500/50 transition-all">
              <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 bg-orange-100 dark:bg-orange-900/30">
                <Activity className="w-8 h-8 text-orange-600 dark:text-orange-500" />
              </div>
              <div className="text-sm font-semibold text-orange-600 dark:text-orange-500 mb-2">Step 3</div>
              <h3 className="text-xl font-semibold text-zinc-950 dark:text-zinc-50 mb-2">Sync</h3>
              <p className="text-zinc-600 dark:text-zinc-400">Start the session. Every set you log is instantly visible to your partner</p>
            </div>
          </div>
        </div>

        {/* Features Section */}
        <div className="max-w-6xl w-full">
          <h2 className="text-3xl font-bold text-center text-zinc-950 dark:text-zinc-50 mb-12">
            Why The Joint?
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Feature 1 */}
            <div className="bento-card p-8 hover:border-orange-500/50 transition-all">
              <div className="w-12 h-12 rounded-lg flex items-center justify-center mb-4 bg-zinc-100 dark:bg-zinc-800">
                <Dumbbell className="w-6 h-6 text-zinc-600 dark:text-zinc-400" />
              </div>
              <h3 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50 mb-2">873 Exercises</h3>
              <p className="text-zinc-600 dark:text-zinc-400">Access a comprehensive library of exercises to build your perfect workout</p>
            </div>
            
            {/* Feature 2 */}
            <div className="bento-card p-8 hover:border-orange-500/50 transition-all">
              <div className="w-12 h-12 rounded-lg flex items-center justify-center mb-4 bg-zinc-100 dark:bg-zinc-800">
                <BarChart3 className="w-6 h-6 text-zinc-600 dark:text-zinc-400" />
              </div>
              <h3 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50 mb-2">Progress Tracking</h3>
              <p className="text-zinc-600 dark:text-zinc-400">Track your reps, minutes, and workouts completed to see your growth</p>
            </div>
            
            {/* Feature 3 */}
            <div className="bento-card p-8 hover:border-orange-500/50 transition-all">
              <div className="w-12 h-12 rounded-lg flex items-center justify-center mb-4 bg-zinc-100 dark:bg-zinc-800">
                <Zap className="w-6 h-6 text-zinc-600 dark:text-zinc-400" />
              </div>
              <h3 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50 mb-2">Real-Time Sync</h3>
              <p className="text-zinc-600 dark:text-zinc-400">Every exercise you log is instantly synchronized with your partner</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
