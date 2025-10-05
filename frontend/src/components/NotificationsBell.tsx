import React, { useEffect, useRef, useState } from 'react'
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
      <button onClick={toggleOpen} style={{ position: 'relative', padding: '4px 10px' }} title='Уведомления'>
        🔔{unreadCount > 0 && (
          <span style={{ position: 'absolute', top: -4, right: -4, background: '#d00', color: '#fff', borderRadius: 12, padding: '0 6px', fontSize: 11 }}>{unreadCount}</span>
        )}
      </button>
      {open && (
        <div style={{ position: 'absolute', right: 0, top: '110%', width: 380, maxHeight: 420, overflow: 'auto', background: '#fff', border: '1px solid #ccc', borderRadius: 6, boxShadow: '0 4px 12px rgba(0,0,0,0.15)', zIndex: 50, fontSize: 13 }}>
          <div style={{ display: 'flex', alignItems: 'center', padding: '6px 10px', borderBottom: '1px solid #eee', gap: 8 }}>
            <strong style={{ fontSize: 14 }}>Уведомления</strong>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
              <button onClick={markAll} disabled={markingAll || unreadCount === 0} style={{ fontSize: 12 }}>{markingAll ? '...' : 'Прочитать все'}</button>
              <button onClick={loadList} disabled={loading} style={{ fontSize: 12 }}>↻</button>
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
                <button onClick={() => markOne(n.id)} style={{ fontSize: 11, height: 24 }}>✓</button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
