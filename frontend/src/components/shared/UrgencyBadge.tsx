import React from 'react'
import type { UrgencyLevel } from '../../types'

export const UrgencyBadge: React.FC<{ urgency: UrgencyLevel }> = ({ urgency }) => {
    let styleClasses = ""
    let text = urgency.toUpperCase()

    switch (urgency) {
        case 'critical':
            styleClasses = "bg-red-500/15 border-red-500/30 text-red-500"
            break
        case 'high':
            styleClasses = "bg-amber-500/15 border-amber-500/30 text-amber-500"
            break
        case 'medium':
            styleClasses = "bg-cyan-500/15 border-cyan-500/30 text-cyan-500"
            break
        case 'low':
            styleClasses = "bg-white/5 border-white/10 text-muted-foreground"
            break
    }

    return (
        <span className={`inline-block font-mono text-[10px] tracking-[0.1em] px-[10px] py-[3px] rounded bg-opacity-15 border border-opacity-30 ${styleClasses}`}>
            {text}
        </span>
    )
}
