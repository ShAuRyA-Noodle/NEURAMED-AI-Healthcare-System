import React from 'react'
import type { UrgencyLevel } from '../../types'

export const UrgencyBadge: React.FC<{ urgency: UrgencyLevel }> = ({ urgency }) => {
    let styleClasses = ""
    let text = urgency.toUpperCase()

    switch (urgency) {
        case 'critical':
            styleClasses = "bg-destructive/15 border-destructive/30 text-destructive"
            break
        case 'high':
            styleClasses = "bg-amber-500/15 border-amber-500/30 text-amber-500"
            break
        case 'medium':
            styleClasses = "bg-primary/15 border-primary/30 text-primary"
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
