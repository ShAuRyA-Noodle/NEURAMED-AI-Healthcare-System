import React from 'react'
import { useCountUp } from '../../hooks/useCountUp'

export const CountUpNumber: React.FC<{ value: number, suffix?: string, decimals?: number }> = ({
    value, suffix = '', decimals = 0
}) => {
    const current = useCountUp(value)

    return (
        <span className="font-orbitron">
            {current.toFixed(decimals)}{suffix}
        </span>
    )
}
