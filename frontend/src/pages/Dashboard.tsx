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
      setTickets(res.data)
    } catch (err: any) {
      setError(extractErrorMessage(err?.response?.data) || 'Failed to load tickets')
    } finally {
      setLoading(false)
    }
  }

  const cancel = async (id: string) => {
    try {
      await api.post(`/tickets/${id}/cancel`)
      await loadTickets()
    } catch (err: any) {
      alert(extractErrorMessage(err?.response?.data) || 'Cancel failed')
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
  <Flights tickets={tickets} />
      {loading && <p>Loading...</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {!loading && !error && tickets.length === 0 && <p>No tickets yet.</p>}
    </div>
  )
}

function Flights({ tickets }: { tickets: Ticket[] }) {
  // Filter future flights with status paid/refunded (refunded might not actually fly but kept for history; could restrict to only paid if desired)
  const now = Date.now()
  const future = tickets.filter(t => (t.status === 'paid' || t.status === 'refunded') && t.flight?.departure)
    .map(t => ({ t, depTs: Date.parse(t.flight!.departure) }))
    .filter(x => x.depTs > now)
    .sort((a,b)=> a.depTs - b.depTs)

  if (future.length === 0) return <div style={{ margin:'12px 0' }}><h3>Flights</h3><p style={{ fontSize:14, opacity:.8 }}>No upcoming flights.</p></div>

  // Group by date (YYYY-MM-DD)
  const groups: Record<string, typeof future> = {}
  future.forEach(f => {
    const d = new Date(f.depTs).toISOString().slice(0,10)
    ;(groups[d] = groups[d] || []).push(f)
  })
  const order = Object.keys(groups).sort()

  return (
    <div style={{ margin:'12px 0' }}>
  <h3>Flights</h3>
      <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
        {order.map(day => (
          <div key={day} style={{ border:'1px solid #ddd', borderRadius:6, padding:10 }}>
            <div style={{ fontSize:13, fontWeight:600, marginBottom:6 }}>{day}</div>
            <ul style={{ listStyle:'none', padding:0, margin:0, display:'flex', flexDirection:'column', gap:8 }}>
              {groups[day].map(({ t, depTs }) => {
                const nowMs = Date.now()
                const msLeft = depTs - nowMs
                const canCancel = t.status === 'paid' && msLeft > 24 * 3600 * 1000
                const within24h = t.status === 'paid' && msLeft <= 24 * 3600 * 1000 && msLeft > 0
                return (
                  <li key={t.confirmation_id} style={{ display:'flex', flexDirection:'column', gap:4, paddingBottom:4, borderBottom:'1px dashed #eee' }}>
                    <div style={{ fontSize:14, display:'flex', flexWrap:'wrap', justifyContent:'space-between', gap:8 }}>
                      <span><strong>{t.flight?.airline} {t.flight?.flight_number}</strong> {t.flight?.origin} → {t.flight?.destination}</span>
                      {canCancel && (
                        <button
                          style={{ fontSize:11, padding:'3px 8px', cursor:'pointer' }}
                          onClick={async () => {
                            try {
                              await api.post(`/tickets/${t.confirmation_id}/cancel`)
                              // naive reload
                              location.reload()
                            } catch(e:any){
                              alert(extractErrorMessage(e?.response?.data) || 'Cancel failed')
                            }
                          }}
                        >Cancel</button>
                      )}
                      {within24h && (
                        <span style={{ fontSize:11, background:'#fee2e2', color:'#991b1b', padding:'2px 6px', borderRadius:4 }}>Cannot cancel &lt;24h</span>
                      )}
                      {t.status === 'refunded' && <span style={{ fontSize:11, background:'#dcfce7', color:'#166534', padding:'2px 6px', borderRadius:4 }}>Refunded</span>}
                      {t.status === 'canceled' && <span style={{ fontSize:11, background:'#f1f5f9', color:'#475569', padding:'2px 6px', borderRadius:4 }}>Canceled</span>}
                    </div>
                    <div style={{ fontSize:12, opacity:.75 }}>
                      Dep: {new Date(depTs).toLocaleString()} | Status: {t.status} | Ticket: {t.confirmation_id}
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}
