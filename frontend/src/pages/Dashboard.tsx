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
  const [flights, setFlights] = useState<Flight[]>([])
  const [loadingFlights, setLoadingFlights] = useState(true)
  const [toast, setToast] = useState<string | null>(null)
  const [userInfo, setUserInfo] = useState<{ email: string; roles: string[] } | null>(null)
  const [quantities, setQuantities] = useState<Record<number, number>>({})
  const [searchDate, setSearchDate] = useState<string>("")
  const [searchPassengers, setSearchPassengers] = useState<number | ''>('')
  const [searchLoading, setSearchLoading] = useState(false)
  const [buying, setBuying] = useState<Record<number, boolean>>({})

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

  const loadFlights = async (params?: { date?: string; passengers?: number | '' }) => {
    setLoadingFlights(true)
    try {
      const query: any = {}
      const d = params?.date ?? searchDate
      const p = params?.passengers ?? searchPassengers
      if (d) query.date = d
      if (p) query.passengers = p
      const res = await api.get('/flights', { params: query })
      setFlights(res.data.items || [])
    } catch (err: any) {
      // flights ошибки показываем отдельно, но не ломаем страницу
    } finally {
      setLoadingFlights(false)
    }
  }

  const cancel = async (id: string) => {
    try {
      await api.post(`/tickets/${id}/cancel`)
      await loadTickets()
      await loadFlights()
    } catch (err: any) {
      alert(extractErrorMessage(err?.response?.data) || 'Cancel failed')
    }
  }

  const buy = async (flightId: number) => {
    if (buying[flightId]) return
    setBuying((b: Record<number, boolean>) => ({ ...b, [flightId]: true }))
    try {
      const quantity = quantities[flightId] || 1
      const res = await api.post('/tickets', { flight_id: flightId, quantity })
      await loadTickets()
      await loadFlights()
      if (res.data.confirmation_ids) {
        setToast(`Purchased ${res.data.quantity} ticket(s)`)
      } else {
        setToast('Ticket purchased')
      }
      // reset quantity back to 1
  setQuantities((q: Record<number, number>) => ({ ...q, [flightId]: 1 }))
    } catch (err: any) {
      alert(extractErrorMessage(err?.response?.data) || 'Purchase failed')
    }
    finally {
  setBuying((b: Record<number, boolean>) => ({ ...b, [flightId]: false }))
    }
  }

  useEffect(() => {
    // decode JWT (без внешних либ)
    try {
      const raw = localStorage.getItem('auth_token')
      if (raw) {
        const payload = JSON.parse(atob(raw.split('.')[1]))
        setUserInfo({ email: payload.sub, roles: payload.roles || [] })
      }
    } catch {}

    loadTickets()
    loadFlights()
  }, [])

  const submitSearch = async (e?: React.FormEvent<HTMLFormElement>) => {
    if (e) e.preventDefault()
    setSearchLoading(true)
    await loadFlights({ date: searchDate, passengers: searchPassengers })
    setSearchLoading(false)
  }

  return (
    <div>
      <h2>My Tickets</h2>
      {userInfo && (
        <div style={{ background:'#f6f6f6', padding:8, marginBottom:12, fontSize:14 }}>
          {(() => {
            const isPriv = userInfo.roles.includes('admin') || userInfo.roles.includes('company_manager')
            const email = userInfo.email
            const masked = (() => {
              if (!isPriv) return email
              const [local, domain] = email.split('@')
              if (!domain) return email
              const show = local.slice(0, 2)
              return `${show}${'*'.repeat(Math.max(1, local.length - 2))}@${domain}`
            })()
            const rolesLabel = isPriv ? 'privileged' : (userInfo.roles.join(', ') || '—')
            return <>User: <strong>{masked}</strong> | Roles: {rolesLabel}</>
          })()}
          <button style={{ marginLeft:12 }} onClick={() => { localStorage.removeItem('auth_token'); location.href = '/login' }}>Logout</button>
        </div>
      )}
      <h3>Available Flights</h3>
      <form onSubmit={submitSearch} style={{ display:'flex', flexWrap:'wrap', gap:8, marginBottom:12, alignItems:'flex-end' }}>
        <div style={{ display:'flex', flexDirection:'column' }}>
          <label style={{ fontSize:12 }}>Дата (UTC)</label>
          <input type="date" value={searchDate} onChange={e => setSearchDate(e.target.value)} />
        </div>
        <div style={{ display:'flex', flexDirection:'column' }}>
          <label style={{ fontSize:12 }}>Пассажиры ≥</label>
          <input type="number" min={1} value={searchPassengers} onChange={e => setSearchPassengers(e.target.value ? Number(e.target.value) : '')} />
        </div>
        <button type="submit" disabled={searchLoading}>{searchLoading ? 'Поиск...' : 'Поиск'}</button>
        {(searchDate || searchPassengers) && (
          <button type="button" onClick={() => { setSearchDate(''); setSearchPassengers(''); loadFlights({ date:'', passengers:'' }); }}>Сброс</button>
        )}
      </form>
      {loadingFlights && <p>Loading flights...</p>}
      {!loadingFlights && flights.length === 0 && <p>No flights found.</p>}
      <ul style={{ listStyle: 'none', padding: 0 }}>
  {flights.map((f: Flight) => (
          <li key={f.id} style={{ border: '1px solid #ddd', padding: 10, marginBottom: 6 }}>
            <div><strong>{f.airline} {f.flight_number}</strong> {f.origin} → {f.destination}</div>
            <div>Dep: {new Date(f.departure).toLocaleString()} | Arr: {new Date(f.arrival).toLocaleString()}</div>
            <div>Price: {f.price} | Seats: {f.seats_available}</div>
            <div style={{ display:'flex', gap:8, alignItems:'center', marginTop:4 }}>
              <input
                type="number"
                min={1}
                max={Math.min(10, f.seats_available)}
                value={quantities[f.id] || 1}
                onChange={e => setQuantities(q => ({ ...q, [f.id]: Math.max(1, Math.min(10, Number(e.target.value) || 1)) }))}
                style={{ width:60 }}
                disabled={f.seats_available <= 0}
              />
              <button disabled={f.seats_available <= 0 || buying[f.id]} onClick={() => buy(f.id)}>
                {buying[f.id] ? '...' : 'Buy'}
              </button>
            </div>
          </li>
        ))}
      </ul>
      <hr />
  {/* Upcoming Flights section */}
  <UpcomingFlights tickets={tickets} />
  <hr />
      {loading && <p>Loading...</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {!loading && !error && tickets.length === 0 && <p>No tickets yet.</p>}
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {tickets.map(t => (
          <li key={t.confirmation_id} style={{ border: '1px solid #eee', padding: 12, marginBottom: 8 }}>
            <div><strong>{t.confirmation_id}</strong> — {t.status}</div>
            <div>Flight: {t.flight_id} | Price: {t.price_paid ?? '-'} | Purchased: {t.purchased_at ?? '-'}</div>
            {t.status === 'paid' && (
              <button onClick={() => cancel(t.confirmation_id)}>Cancel</button>
            )}
          </li>
        ))}
      </ul>
      {toast && (
        <div style={{ position:'fixed', bottom:20, right:20, background:'#333', color:'#fff', padding:'8px 14px', borderRadius:4 }}>
          {toast}
          <button style={{ marginLeft:10 }} onClick={() => setToast(null)}>x</button>
        </div>
      )}
    </div>
  )
}

function UpcomingFlights({ tickets }: { tickets: Ticket[] }) {
  // Filter future flights with status paid/refunded (refunded может не лететь, но оставим для истории; можем ограничить только paid)
  const now = Date.now()
  const future = tickets.filter(t => (t.status === 'paid' || t.status === 'refunded') && t.flight?.departure)
    .map(t => ({ t, depTs: Date.parse(t.flight!.departure) }))
    .filter(x => x.depTs > now)
    .sort((a,b)=> a.depTs - b.depTs)

  if (future.length === 0) return <div style={{ margin:'12px 0' }}><h3>Upcoming Flights</h3><p style={{ fontSize:14, opacity:.8 }}>No upcoming flights.</p></div>

  // Group by date (YYYY-MM-DD)
  const groups: Record<string, typeof future> = {}
  future.forEach(f => {
    const d = new Date(f.depTs).toISOString().slice(0,10)
    ;(groups[d] = groups[d] || []).push(f)
  })
  const order = Object.keys(groups).sort()

  return (
    <div style={{ margin:'12px 0' }}>
      <h3>Upcoming Flights</h3>
      <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
        {order.map(day => (
          <div key={day} style={{ border:'1px solid #ddd', borderRadius:6, padding:10 }}>
            <div style={{ fontSize:13, fontWeight:600, marginBottom:6 }}>{day}</div>
            <ul style={{ listStyle:'none', padding:0, margin:0, display:'flex', flexDirection:'column', gap:8 }}>
              {groups[day].map(({ t, depTs }) => (
                <li key={t.confirmation_id} style={{ display:'flex', flexDirection:'column', gap:2 }}>
                  <div style={{ fontSize:14 }}>
                    <strong>{t.flight?.airline} {t.flight?.flight_number}</strong> {t.flight?.origin} → {t.flight?.destination}
                  </div>
                  <div style={{ fontSize:12, opacity:.75 }}>
                    Dep: {new Date(depTs).toLocaleString()} | Status: {t.status} | Ticket: {t.confirmation_id}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}
