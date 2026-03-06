import React from 'react'
import type { AgentType } from '../../types'

export const AgentBadge: React.FC<{ agent: AgentType }> = ({ agent }) => {
    let styleClasses = ""
    let text = agent.toUpperCase()

    switch (agent) {
        case 'voice':
            styleClasses = "bg-cyan-500/15 border-cyan-500/30 text-cyan-500"
            break
        case 'imaging':
            styleClasses = "bg-green-500/15 border-green-500/30 text-green-500"
            break
        case 'ocr':
            styleClasses = "bg-amber-500/15 border-amber-500/30 text-amber-500"
            break
    }

    return (
        <span className={`inline-block font-mono text-[10px] tracking-[0.1em] px-[10px] py-[3px] rounded bg-opacity-15 border border-opacity-30 ${styleClasses}`}>
            {text}
        </span>
    )
}
