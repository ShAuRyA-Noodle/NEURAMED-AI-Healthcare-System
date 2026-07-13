import React from 'react'
import { LucideIcon } from 'lucide-react'

interface EmptyStateProps {
    icon: LucideIcon
    title: string
    subtitle: string
    action?: { label: string; onClick: () => void }
}

export const EmptyState: React.FC<EmptyStateProps> = ({ icon: Icon, title, subtitle, action }) => {
    return (
        <div className="flex flex-col items-center justify-center p-8 text-center h-full min-h-[200px]">
            <div className="bg-white/5 rounded-full p-4 mb-4">
                <Icon size={48} className="text-muted-foreground/50" />
            </div>
            <h3 className="font-syne text-xl font-bold mb-2 text-foreground/80">{title}</h3>
            <p className="font-mono text-sm text-muted-foreground mb-4 max-w-sm">{subtitle}</p>
            {action && (
                <button
                    onClick={action.onClick}
                    className="px-4 py-2 bg-primary/10 hover:bg-primary/20 text-primary text-sm font-mono uppercase tracking-wider rounded transition-colors"
                >
                    {action.label}
                </button>
            )}
        </div>
    )
}
