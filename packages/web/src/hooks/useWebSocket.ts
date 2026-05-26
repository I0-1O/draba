/**
 * WebSocket client hook for real-time event updates.
 *
 * Protocol (from CONVENTIONS.md):
 *   - Connect: GET /ws?token=<jwt>
 *   - Subscribe: send { type: "subscribe", teamId: "..." }
 *   - Receive: { type: "event.updated" | "event.created" | "event.deleted", payload: {...} }
 *   - Heartbeat: server sends { type: "ping" } every 30s; client replies { type: "pong" }
 *
 * Reconnect: exponential back-off on unexpected close (not called on intentional cleanup).
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { API_BASE } from '@/lib/api'

type WsStatus = 'connecting' | 'connected' | 'disconnected'

export interface WsMessage {
  type: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- wire format is open-ended
  payload?: any
  teamId?: string
}

interface Options {
  /** JWT access token. Pass null/undefined to stay disconnected. */
  token: string | null | undefined
  /** Team IDs to subscribe to once the connection opens. */
  teamIds?: string[]
  /** Called for every incoming message (excluding server pings). */
  onMessage?: (msg: WsMessage) => void
}

// Priority:
// 1. VITE_API_URL is set → use it (explicit override, e.g. cross-origin prod).
// 2. VITE_API_TARGET is set → connect directly to the dev target, bypassing
//    the Vite proxy. Vite v6's ws: true proxy is unreliable and connecting
//    directly avoids the upgrade-handshake issues on the dev server.
// 3. Fallback → derive from the current page origin (production embedded mode,
//    or local dev where the Vite proxy handles the /ws path).
const WS_BASE = API_BASE
  ? API_BASE.replace(/^http/, 'ws')
  : (import.meta.env.VITE_API_TARGET as string | undefined)
    ? (import.meta.env.VITE_API_TARGET as string).replace(/^http/, 'ws')
    : `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}`
const MAX_BACKOFF_MS = 30_000

export function useWebSocket({ token, teamIds = [], onMessage }: Options) {
  const [status, setStatus] = useState<WsStatus>('disconnected')
  const wsRef = useRef<WebSocket | null>(null)
  const backoffRef = useRef(1_000)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const intentionalRef = useRef(false)
  const onMessageRef = useRef(onMessage)
  onMessageRef.current = onMessage
  const teamIdsRef = useRef(teamIds)
  teamIdsRef.current = teamIds

  const connect = useCallback(() => {
    if (!token) return

    intentionalRef.current = false
    setStatus('connecting')

    const ws = new WebSocket(`${WS_BASE}/ws?token=${encodeURIComponent(token)}`)
    wsRef.current = ws

    ws.onopen = () => {
      setStatus('connected')
      backoffRef.current = 1_000
      // Subscribe to all requested teams.
      for (const teamId of teamIdsRef.current) {
        ws.send(JSON.stringify({ type: 'subscribe', teamId }))
      }
    }

    ws.onmessage = ev => {
      let msg: WsMessage
      try {
        msg = JSON.parse(ev.data as string) as WsMessage
      } catch {
        return
      }
      if (msg.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong' }))
        return
      }
      onMessageRef.current?.(msg)
    }

    ws.onclose = () => {
      setStatus('disconnected')
      wsRef.current = null
      if (!intentionalRef.current && token) {
        // Reconnect with back-off.
        reconnectTimerRef.current = setTimeout(() => {
          backoffRef.current = Math.min(backoffRef.current * 2, MAX_BACKOFF_MS)
          connect()
        }, backoffRef.current)
      }
    }

    ws.onerror = () => {
      ws.close()
    }
  }, [token])

  // Connect when token becomes available; disconnect on cleanup or token removal.
  useEffect(() => {
    if (!token) {
      intentionalRef.current = true
      wsRef.current?.close()
      return
    }
    connect()
    return () => {
      intentionalRef.current = true
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current)
      wsRef.current?.close()
    }
  }, [token, connect])

  /** Subscribe to an additional team at runtime. */
  const subscribe = useCallback((teamId: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'subscribe', teamId }))
    }
  }, [])

  return { status, subscribe } as const
}
