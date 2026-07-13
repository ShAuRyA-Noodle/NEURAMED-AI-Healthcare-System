import React, { useEffect, useState } from 'react'

export const ConfidenceMeter: React.FC<{ value: number; size?: number }> = ({ value, size = 100 }) => {
    const [offset, setOffset] = useState(251) // approx 2 * pi * 40
    const radius = 40
    const circumference = 2 * Math.PI * radius

    const color = value > 0.8 ? 'stroke-primary' : value > 0.6 ? 'stroke-amber-500' : 'stroke-destructive'

    useEffect(() => {
        const targetOffset = circumference - (value * circumference)
        // small delay for animation
        const timeout = setTimeout(() => {
            setOffset(targetOffset)
        }, 100)
        return () => clearTimeout(timeout)
    }, [value, circumference])

    return (
        <div style={{ width: size, height: size }} className="relative flex items-center justify-center">
            <svg className="transform -rotate-90 w-full h-full" viewBox="0 0 100 100">
                <circle
                    cx="50" cy="50" r={radius}
                    className="stroke-white/10" strokeWidth="8" fill="transparent"
                />
                <circle
                    cx="50" cy="50" r={radius}
                    className={`transition-all duration-1000 ease-out ${color}`}
                    strokeWidth="8" fill="transparent"
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    strokeLinecap="round"
                />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
                <span className="font-orbitron font-bold" style={{ fontSize: size * 0.25 }}>
                    {Math.round(value * 100)}%
                </span>
            </div>
        </div>
    )
}
