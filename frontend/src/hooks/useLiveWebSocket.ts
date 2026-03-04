import { useState, useEffect, useRef } from 'react'
import type { ActivityFeedItem } from '../types'

export const useLiveWebSocket = () => {
    const [events, setEvents] = useState<ActivityFeedItem[]>([])
    const [isConnected, setIsConnected] = useState(false)
    const wsRef = useRef<WebSocket | null>(null)

    useEffect(() => {
        let timeoutId: number

        const connect = () => {
            const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:8000/ws/live-feed'
            const ws = new WebSocket(wsUrl)
            wsRef.current = ws

            ws.onopen = () => {
                setIsConnected(true)
            }

            ws.onmessage = (event) => {
                try {
                    const item: ActivityFeedItem = JSON.parse(event.data)
                    setEvents(prev => {
                        const newEvents = [item, ...prev]
                        return newEvents.slice(0, 15) // trimmed to 15
                    })
                } catch (err) {
                    console.error('Failed to parse WS message', err)
                }
            }

            ws.onclose = () => {
                setIsConnected(false)
                timeoutId = window.setTimeout(connect, 3000)
            }

            ws.onerror = () => {
                ws.close()
            }
        }

        connect()

        return () => {
            clearTimeout(timeoutId)
            if (wsRef.current) {
                wsRef.current.close()
            }
        }
    }, [])

    return { events, isConnected }
}
