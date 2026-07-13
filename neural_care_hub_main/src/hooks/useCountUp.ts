import { useState, useEffect } from 'react'
import { usePrefersReducedMotion } from './usePrefersReducedMotion'

const easeOutQuart = (t: number) => 1 - Math.pow(1 - t, 4)

export const useCountUp = (target: number, duration: number = 1400, startOnMount: boolean = true) => {
    const reducedMotion = usePrefersReducedMotion()
    const [count, setCount] = useState(reducedMotion ? target : 0)

    useEffect(() => {
        // Reduced motion: jump straight to the final value, no rAF tween.
        if (reducedMotion) {
            setCount(target)
            return
        }

        if (target === 0 && !startOnMount) return

        let startTime: number | null = null
        let animationFrame: number

        const step = (timestamp: number) => {
            if (!startTime) startTime = timestamp
            const progress = timestamp - startTime
            const progressRatio = Math.min(progress / duration, 1)

            const easedProgress = easeOutQuart(progressRatio)
            setCount(target * easedProgress)

            if (progress < duration) {
                animationFrame = requestAnimationFrame(step)
            } else {
                setCount(target)
            }
        }

        animationFrame = requestAnimationFrame(step)

        return () => cancelAnimationFrame(animationFrame)
    }, [target, duration, startOnMount, reducedMotion])

    return count
}
