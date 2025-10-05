import React, { useEffect, useState } from 'react'
import api, { extractErrorMessage } from '../lib/api'

type Ticket = {
  confirmation_id: string
  status: string
  flight_id: number
  email: string
  purchased_at?: string
  price_paid?: number
  flight?: {
    id: number
    airline: string
    flight_number: string
    origin: string
    destination: string
    departure: string
    arrival: string
  } | null
}

type Flight = {
  id: number
  airline: string
  flight_number: string
  origin: string
  destination: string
  departure: string
  arrival: string
  price: number
  seats_available: number
}

export default function Dashboard() {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [userInfo, setUserInfo] = useState<{ email: string; roles: string[] } | null>(null)

  const loadTickets = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.get('/tickets/my')
      // New backend format returns { items, total, page, ... }
      const payload = res.data
      const list = Array.isArray(payload)
        ? payload
        : (Array.isArray(payload?.items) ? payload.items : [])
      setTickets(list)
    } catch (err: any) {
      setError(extractErrorMessage(err?.response?.data) || 'Failed to load tickets')
    } finally {
      setLoading(false)
    }
  }

  const cancel = async (id: string) => {
    try {
      // Оптимистично помечаем локально
      setTickets(ts => ts.map(t => t.confirmation_id === id ? { ...t, status: 'refunded' } : t))
      await api.post(`/tickets/${id}/cancel`)
      // Опционально можно перезагрузить позже; сейчас не вызываем loadTickets() чтобы избежать дерганий
    } catch (err: any) {
      alert(extractErrorMessage(err?.response?.data) || 'Cancel failed')
      // Rollback при ошибке (перезагрузка списка)
      await loadTickets()
    }
  }

  useEffect(() => {
  // Decode JWT (lightweight manual approach, no external libs)
    try {
      const raw = localStorage.getItem('auth_token')
      if (raw) {
        const payload = JSON.parse(atob(raw.split('.')[1]))
        setUserInfo({ email: payload.sub, roles: payload.roles || [] })
      }
    } catch {}

    loadTickets()
  }, [])

  // Removed search form logic; flights list can be simplified or repurposed later.

  return (
    <div>
  <h2>My Flights</h2>
      {/* User info panel removed as per request */}
  <Flights tickets={tickets} reload={loadTickets} />
      {loading && <p>Loading...</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {!loading && !error && tickets.length === 0 && <p>No tickets yet.</p>}
    </div>
  )
}

interface FlightsProps { tickets: Ticket[]; reload: () => Promise<void> }
function Flights({ tickets, reload }: FlightsProps) {
  const now = Date.now()
  const future = tickets.filter(t => (t.status === 'paid' || t.status === 'refunded') && t.flight?.departure)
    .map(t => ({ t, depTs: Date.parse(t.flight!.departure) }))
    .filter(x => x.depTs > now)
    .sort((a,b)=> a.depTs - b.depTs)
  const PAGE_SIZE = 25
  const [page, setPage] = React.useState(1)
  const totalPages = Math.max(1, Math.ceil(future.length / PAGE_SIZE))
  const start = (page - 1) * PAGE_SIZE
  const slice = future.slice(start, start + PAGE_SIZE)
  const subsetGroups: Record<string, typeof slice> = {}
  slice.forEach(f => { const d = new Date(f.depTs).toISOString().slice(0,10); (subsetGroups[d] = subsetGroups[d] || []).push(f) })
  const subsetOrder = Object.keys(subsetGroups).sort()
  const [open, setOpen] = React.useState<Record<string, boolean>>({})
  if (future.length === 0) return <div style={{ margin:'12px 0' }}><h3>Flights</h3><p style={{ fontSize:14, opacity:.8 }}>No upcoming flights.</p></div>
  return (
    <div style={{ margin:'12px 0' }}>
      <h3>Flights</h3>
      <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
        {subsetOrder.map(day => (
          <div key={day} style={{ border:'1px solid #ddd', borderRadius:6, padding:10 }}>
            <div style={{ fontSize:13, fontWeight:600, marginBottom:6 }}>{day}</div>
            <ul style={{ listStyle:'none', padding:0, margin:0, display:'flex', flexDirection:'column', gap:8 }}>
              {subsetGroups[day].map(({ t, depTs }) => {
                const nowMs = Date.now(); const msLeft = depTs - nowMs
                const canCancel = t.status === 'paid' && msLeft > 24 * 3600 * 1000
                const within24h = t.status === 'paid' && msLeft <= 24 * 3600 * 1000 && msLeft > 0
                const isOpen = open[t.confirmation_id]
                return (
                  <li key={t.confirmation_id} style={{ display:'flex', flexDirection:'column', gap:4, paddingBottom:4, borderBottom:'1px dashed #eee' }}>
                    <button onClick={() => setOpen(o=>({...o, [t.confirmation_id]: !isOpen}))} style={{ all:'unset', cursor:'pointer', fontSize:14, display:'flex', flexWrap:'wrap', justifyContent:'space-between', gap:8 }}>
                      <span><strong>{t.flight?.airline} {t.flight?.flight_number}</strong> {t.flight?.origin} → {t.flight?.destination}</span>
                      <span style={{ fontSize:11, opacity:.7 }}>{isOpen ? '▲' : '▼'}</span>
                    </button>
                    <div style={{ fontSize:12, opacity:.75 }}>Dep: {new Date(depTs).toLocaleString()} | Status: {t.status} | Ticket: {t.confirmation_id}</div>
                    {isOpen && (
                      <div style={{ marginTop:6, fontSize:12, background:'#f8fafc', padding:8, border:'1px solid #e2e8f0', borderRadius:6 }}>
                        <div style={{ display:'flex', flexWrap:'wrap', gap:8, alignItems:'center' }}>
                          {canCancel && (
                            <button style={{ fontSize:11, padding:'3px 8px', cursor:'pointer' }} onClick={async () => { try { await api.post(`/tickets/${t.confirmation_id}/cancel`); await reload() } catch(e:any){ alert(extractErrorMessage(e?.response?.data) || 'Cancel failed') } }}>Cancel</button>
                          )}
                          {within24h && (<span style={{ fontSize:11, background:'#fee2e2', color:'#991b1b', padding:'2px 6px', borderRadius:4 }}>Cannot cancel &lt;24h</span>)}
                          {t.status === 'refunded' && <span style={{ fontSize:11, background:'#dcfce7', color:'#166534', padding:'2px 6px', borderRadius:4 }}>Refunded</span>}
                          {t.status === 'canceled' && <span style={{ fontSize:11, background:'#f1f5f9', color:'#475569', padding:'2px 6px', borderRadius:4 }}>Canceled</span>}
                        </div>
                        {t.flight && (<div style={{ marginTop:6 }}><div>Arrival: {new Date(t.flight.arrival).toLocaleString()}</div></div>)}
                        <div style={{ marginTop:6, fontSize:11, opacity:.6 }}>Для расширенного управления (custom reminder) открой страницу My Tickets.</div>
                      </div>
                    )}
                  </li>
                )})}
            </ul>
          </div>
        ))}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:12 }}>
          <button disabled={page<=1} onClick={()=>setPage(p=>Math.max(1,p-1))} style={{ padding:'4px 10px' }}>Prev</button>
          <span style={{ fontSize:12 }}>Page {page} / {totalPages} • {future.length} flights</span>
          <button disabled={page>=totalPages} onClick={()=>setPage(p=>Math.min(totalPages,p+1))} style={{ padding:'4px 10px' }}>Next</button>
        </div>
      </div>
    </div>
  )
}
