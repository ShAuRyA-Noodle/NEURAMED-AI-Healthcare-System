import React from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useToast, ToastMessage } from '../../hooks/useToast'
import { X } from 'lucide-react'

// Simple global context since we create Toast in App.tsx
export let addGlobalToast: ReturnType<typeof useToast>['addToast']

export const Toast: React.FC = () => {
    const { toasts, addToast, removeToast } = useToast()
    addGlobalToast = addToast

    const getBorderColor = (type: ToastMessage['type']) => {
        switch (type) {
            case 'success': return 'border-l-green-500'
            case 'error': return 'border-l-red-500'
            case 'warning': return 'border-l-amber-500'
            case 'info': return 'border-l-cyan-500'
        }
    }

    return (
        <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
            <AnimatePresence>
                {toasts.slice(-3).map(toast => (
                    <motion.div
                        key={toast.id}
                        initial={{ opacity: 0, x: 60 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        className={`pointer-events-auto flex items-center justify-between p-4 bg-background/95 border ${getBorderColor(toast.type)} border-l-4 rounded shadow-lg shadow-black/50 min-w-[300px] backdrop-blur font-mono text-sm`}
                    >
                        <span>{toast.message}</span>
                        <button onClick={() => removeToast(toast.id)} className="text-muted-foreground hover:text-white transition-colors">
                            <X size={16} />
                        </button>
                    </motion.div>
                ))}
            </AnimatePresence>
        </div>
    )
}
