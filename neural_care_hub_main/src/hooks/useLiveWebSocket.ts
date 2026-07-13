import { useState, useEffect, useRef } from 'react'
import type { ActivityFeedItem } from '../types'

export const useLiveWebSocket = () => {
    const [events, setEvents] = useState<ActivityFeedItem[]>([])
    const [isConnected, setIsConnected] = useState(false)
    const wsRef = useRef<WebSocket | null>(null)

    useEffect(() => {
        let timeoutId: number

        const connect = () => {
            // H2 — the live feed carries PHI, so the WS handshake requires a JWT.
            // Browsers can't set Authorization headers on a WS, so pass it as a
            // query param. Skip connecting entirely when unauthenticated.
            const token = localStorage.getItem('neuramed_token')
            if (!token) {
                setIsConnected(false)
                return
            }
            const baseUrl = import.meta.env.VITE_WS_URL
                || (import.meta.env.VITE_API_BASE_URL
                    ? import.meta.env.VITE_API_BASE_URL.replace(/^http/, 'ws') + '/ws/live-feed'
                    : 'ws://localhost:8000/ws/live-feed')
            const wsUrl = `${baseUrl}?token=${encodeURIComponent(token)}`
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
