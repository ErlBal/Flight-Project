import { useEffect, useState } from 'react'
import api, { extractErrorMessage } from '../lib/api'

type Ticket = {
  confirmation_id: string
  status: string
  flight_id: number
  email: string
  purchased_at?: string
  price_paid?: number
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

  const loadFlights = async () => {
    setLoadingFlights(true)
    try {
      const res = await api.get('/flights')
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
    } catch (err: any) {
      alert(extractErrorMessage(err?.response?.data) || 'Purchase failed')
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

  return (
    <div>
      <h2>My Tickets</h2>
      {userInfo && (
        <div style={{ background:'#f6f6f6', padding:8, marginBottom:12, fontSize:14 }}>
          User: <strong>{userInfo.email}</strong> | Roles: {userInfo.roles.join(', ') || '—'}
          <button style={{ marginLeft:12 }} onClick={() => { localStorage.removeItem('auth_token'); location.href = '/login' }}>Logout</button>
        </div>
      )}
      <h3>Available Flights</h3>
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
              <button disabled={f.seats_available <= 0} onClick={() => buy(f.id)}>Buy</button>
            </div>
          </li>
        ))}
      </ul>
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
