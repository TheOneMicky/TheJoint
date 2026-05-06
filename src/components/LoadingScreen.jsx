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

export default function LoadingScreen({ onComplete }) {
  const [currentAnimation, setCurrentAnimation] = useState(animations[0])
  const [animationIndex, setAnimationIndex] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setAnimationIndex((prev) => {
        const nextIndex = (prev + 1) % animations.length
        setCurrentAnimation(animations[nextIndex])
        return nextIndex
      })
    }, 150) // Change animation every 150ms

    // Complete after 400ms total
    const timeout = setTimeout(() => {
      clearInterval(interval)
      onComplete()
    }, 400)

    return () => {
      clearInterval(interval)
      clearTimeout(timeout)
    }
  }, [onComplete])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md">
      <img 
        src={logo} 
        alt="The Joint" 
        className={`h-24 w-24 object-contain ${currentAnimation}`} 
      />
    </div>
  )
}
