import { useState, useEffect, useRef } from 'react'
import type { ActivityFeedItem } from '../types'

export const useLiveWebSocket = () => {
    const [events, setEvents] = useState<ActivityFeedItem[]>([])
    const [isConnected, setIsConnected] = useState(false)
    const wsRef = useRef<WebSocket | null>(null)

    useEffect(() => {
        let timeoutId: number

        const connect = () => {
            const baseWsUrl = import.meta.env.VITE_WS_URL
                || (import.meta.env.VITE_API_BASE_URL
                    ? import.meta.env.VITE_API_BASE_URL.replace(/^http/, 'ws') + '/ws/live-feed'
                    : 'ws://localhost:8000/ws/live-feed')

            // Append token as query param for cross-origin environments.
            // Same-origin deployments send the httpOnly cookie automatically.
            const token = sessionStorage.getItem('neuramed_token')
            const wsUrl = token
                ? `${baseWsUrl}${baseWsUrl.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}`
                : baseWsUrl

            const ws = new WebSocket(wsUrl)
            wsRef.current = ws

            ws.onopen = () => setIsConnected(true)

            ws.onmessage = (event) => {
                try {
                    const item: ActivityFeedItem = JSON.parse(event.data)
                    setEvents(prev => [item, ...prev].slice(0, 15))
                } catch {
                    // Malformed message — ignore
                }
            }

            ws.onclose = (ev) => {
                setIsConnected(false)
                // 4401/4403 = auth rejected — don't reconnect
                if (ev.code !== 4401 && ev.code !== 4403) {
                    timeoutId = window.setTimeout(connect, 3000)
                }
            }

            ws.onerror = () => ws.close()
        }

        connect()

        return () => {
            clearTimeout(timeoutId)
            wsRef.current?.close()
        }
    }, [])

    return { events, isConnected }
}
