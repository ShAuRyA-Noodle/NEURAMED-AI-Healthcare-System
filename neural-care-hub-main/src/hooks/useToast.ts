import { useSyncExternalStore } from 'react'

export type ToastType = 'success' | 'error' | 'info' | 'warning'

export interface ToastMessage {
    id: string
    type: ToastType
    message: string
    duration?: number
}

// Global store for toasts so all useToast() calls share the same state
let globalToasts: ToastMessage[] = []
let listeners: Set<() => void> = new Set()

function emitChange() {
    listeners.forEach(l => l())
}

function subscribe(listener: () => void) {
    listeners.add(listener)
    return () => { listeners.delete(listener) }
}

function getSnapshot() {
    return globalToasts
}

function addToastGlobal(type: ToastType, message: string, duration = 3000): string {
    const id = Math.random().toString(36).substr(2, 9)
    globalToasts = [...globalToasts, { id, type, message, duration }]
    emitChange()

    if (duration > 0) {
        setTimeout(() => {
            globalToasts = globalToasts.filter(t => t.id !== id)
            emitChange()
        }, duration)
    }

    return id
}

function removeToastGlobal(id: string) {
    globalToasts = globalToasts.filter(t => t.id !== id)
    emitChange()
}

export const useToast = () => {
    const toasts = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

    return {
        toasts,
        addToast: addToastGlobal,
        removeToast: removeToastGlobal
    }
}
