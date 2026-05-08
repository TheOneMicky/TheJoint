import { useState, useEffect } from 'react'
import logo from '../assets/logo.svg'

const animations = [
  'animate-slide-up',
  'animate-bounce-in',
  'animate-scale-in',
  'animate-rotate-in',
  'animate-slide-left',
  'animate-slide-right'
]

export default function LoadingScreen({ isLoading, onComplete }) {
  const [currentAnimation, setCurrentAnimation] = useState(animations[0])
  const [animationIndex, setAnimationIndex] = useState(0)
  const [minimumDisplayElapsed, setMinimumDisplayElapsed] = useState(false)
  const MINIMUM_DISPLAY_TIME = 400 // 400ms minimum display time

  useEffect(() => {
    const interval = setInterval(() => {
      setAnimationIndex((prev) => {
        const nextIndex = (prev + 1) % animations.length
        setCurrentAnimation(animations[nextIndex])
        return nextIndex
      })
    }, 150) // Change animation every 150ms

    // Enforce minimum display time
    const timeout = setTimeout(() => {
      setMinimumDisplayElapsed(true)
    }, MINIMUM_DISPLAY_TIME)

    return () => {
      clearInterval(interval)
      clearTimeout(timeout)
    }
  }, [])

  // Handle completion when loading is done AND minimum time has elapsed
  useEffect(() => {
    if (!isLoading && minimumDisplayElapsed && onComplete) {
      onComplete()
    }
  }, [isLoading, minimumDisplayElapsed, onComplete])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md">
      <div className="flex items-center gap-4">
        <img 
          src={logo} 
          alt="The Joint" 
          className={`h-24 w-24 object-contain ${currentAnimation}`} 
        />
        <span className="text-xl font-medium text-zinc-600 dark:text-zinc-400">
          Loading...
        </span>
      </div>
    </div>
  )
}
