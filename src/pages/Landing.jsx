import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
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
      <main className="flex flex-col items-center justify-center min-h-screen px-4">
        <div className="text-center max-w-2xl animate-slide-up">
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
      </main>
    </div>
  )
}
