import React, { useEffect, useRef, useState } from 'react'
import { getToken } from '../lib/auth'
import api, { extractErrorMessage } from '../lib/api'

interface NotificationItem {
  id: number
  type: string
  message: string
  created_at: string
  read: boolean
}

interface Props {
  onAnyAction?: () => void
}

// Небольшой компонент колокольчика уведомлений
export default function NotificationsBell({ onAnyAction }: Props) {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<NotificationItem[]>([])
  const [loading, setLoading] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const pollingRef = useRef<number | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [markingAll, setMarkingAll] = useState(false)

  const loadList = async () => {
    setLoading(true)
    setError(null)
    try {
      const r = await api.get('/notifications/')
      setItems(r.data || [])
      const unread = (r.data || []).filter((x: NotificationItem) => !x.read).length
      setUnreadCount(unread)
    } catch (e: any) {
      setError(extractErrorMessage(e?.response?.data) || 'Ошибка загрузки')
    } finally { setLoading(false) }
  }

  const loadCount = async () => {
    try {
      const r = await api.get('/notifications/unread-count')
      setUnreadCount(r.data?.unread || 0)
    } catch { /* тихо */ }
  }

  // --- WebSocket real-time ---
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimer = useRef<number | null>(null)
  const reconnectAttempts = useRef(0)

  const setupWebSocket = () => {
    const token = getToken()
    if (!token) return
    // Avoid duplicate
    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) return
  // Берём base API из axios инстанса, чтобы не ошибиться портом
  const apiBase = (api.defaults.baseURL || window.location.origin).replace(/\/$/, '')
  const wsBase = apiBase.replace(/^http/, 'ws')
  // Наш websocket endpoint смонтирован по тому же префиксу что и REST (без дополнительного /api если его нет в baseURL)
  const url = `${wsBase}/notifications/ws/notifications?token=${encodeURIComponent(token)}`
    const ws = new WebSocket(url)
    wsRef.current = ws
    ws.onopen = () => {
      reconnectAttempts.current = 0
    }
    ws.onmessage = (ev) => {
      try {
        const payload = JSON.parse(ev.data)
        if (payload?.type === 'notification' && payload.data) {
          setItems(prev => {
            // Защита от дублей по id
            if (prev.find(p => p.id === payload.data.id)) return prev
            return [payload.data, ...prev].slice(0, 200)
          })
          if (!payload.data.read) setUnreadCount(c => c + 1)
        } else if (payload?.type === 'flight_seats' && payload.data) {
          // Глобальное событие для других компонентов
            window.dispatchEvent(new CustomEvent('flight_seats_update', { detail: payload.data }))
        } else if (payload?.type === 'notification_read' && payload.data) {
            setItems(prev => prev.map(i => i.id === payload.data.id ? { ...i, read: true } : i))
            setUnreadCount(c => Math.max(0, c - 1))
        } else if (payload?.type === 'notification_mark_all') {
            setItems(prev => prev.map(i => ({ ...i, read: true })))
            setUnreadCount(0)
        }
      } catch { /* ignore */ }
    }
    ws.onclose = () => {
      scheduleReconnect()
    }
    ws.onerror = () => {
      try { ws.close() } catch {/*ignore*/}
    }
  }

  const scheduleReconnect = () => {
    if (reconnectTimer.current) window.clearTimeout(reconnectTimer.current)
    if (reconnectAttempts.current > 6) return // ~ограничение
    const delay = Math.min(10000, 1000 * Math.pow(2, reconnectAttempts.current))
    reconnectAttempts.current += 1
    reconnectTimer.current = window.setTimeout(setupWebSocket, delay)
  }

  useEffect(() => {
    setupWebSocket()
    return () => {
      if (reconnectTimer.current) window.clearTimeout(reconnectTimer.current)
      if (wsRef.current) wsRef.current.close()
    }
  }, [])

  const markOne = async (id: number) => {
    try {
      await api.post(`/notifications/${id}/read`)
      setItems(prev => prev.map(i => i.id === id ? { ...i, read: true } : i))
      setUnreadCount(c => Math.max(0, c - 1))
      onAnyAction?.()
    } catch {/* ignore */}
  }

  const markAll = async () => {
    setMarkingAll(true)
    try {
      await api.post('/notifications/mark-all-read')
      setItems(prev => prev.map(i => ({ ...i, read: true })))
      setUnreadCount(0)
      onAnyAction?.()
    } catch {/* ignore */} finally { setMarkingAll(false) }
  }

  // Поллинг только счётчика
  useEffect(() => {
    loadCount()
    pollingRef.current = window.setInterval(loadCount, 30000) // 30s
    return () => { if (pollingRef.current) window.clearInterval(pollingRef.current) }
  }, [])

  // Клик вне — закрыть
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (open && containerRef.current && !containerRef.current.contains(e.target as any)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const toggleOpen = () => {
    if (!open) {
      loadList()
    }
    setOpen(o => !o)
  }

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <button onClick={toggleOpen} className="icon-btn" aria-label='Уведомления' title='Уведомления' style={{ width:38 }}>
        <span style={{ fontSize:14, fontFamily:'inherit', lineHeight:1 }}>✉</span>
        {unreadCount > 0 && (
          <span className='icon-btn-badge'>{unreadCount}</span>
        )}
      </button>
      {open && (
  <div style={{ position: 'absolute', right: 0, top: '110%', width: 380, maxHeight: 420, overflow: 'auto', background: '#fff', border: '1px solid var(--color-border)', borderRadius: 8, boxShadow: 'var(--shadow-md)', zIndex: 50, fontSize: 13 }}>
          <div style={{ display: 'flex', alignItems: 'center', padding: '6px 10px', borderBottom: '1px solid #eee', gap: 8 }}>
            <strong style={{ fontSize: 14 }}>Уведомления</strong>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
              <button onClick={markAll} disabled={markingAll || unreadCount === 0} className='btn btn-outline' style={{ fontSize: 12, padding:'4px 10px' }}>{markingAll ? '...' : 'Прочитать все'}</button>
              <button onClick={loadList} disabled={loading} className='btn btn-outline' style={{ fontSize: 12, padding:'4px 10px' }}>↻</button>
            </div>
          </div>
          {error && <div style={{ color: 'red', padding: '6px 10px' }}>{error}</div>}
          {loading && <div style={{ padding: '6px 10px' }}>Загрузка...</div>}
          {!loading && items.length === 0 && <div style={{ padding: '10px' }}>Нет уведомлений</div>}
          {!loading && items.map(n => (
            <div key={n.id} style={{ padding: '8px 10px', borderBottom: '1px solid #f0f0f0', background: n.read ? '#fafafa' : '#eef6ff', display: 'flex', gap: 8 }}>
              <div style={{ flex: 1 }}>
                <div style={{ whiteSpace: 'pre-wrap' }}>{n.message}</div>
                <div style={{ fontSize: 11, opacity: 0.6, marginTop: 2 }}>{new Date(n.created_at).toLocaleString()}</div>
              </div>
              {!n.read && (
                <button onClick={() => markOne(n.id)} className='btn btn-outline' style={{ fontSize: 11, height: 26, padding:'2px 8px' }}>✓</button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
