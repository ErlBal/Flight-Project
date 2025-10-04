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
    } catch (err: any) {
      alert(extractErrorMessage(err?.response?.data) || 'Cancel failed')
    }
  }

  const buy = async (flightId: number) => {
    try {
      await api.post('/tickets', { flight_id: flightId })
      await loadTickets()
    } catch (err: any) {
      alert(extractErrorMessage(err?.response?.data) || 'Purchase failed')
    }
  }

  useEffect(() => {
    loadTickets()
    loadFlights()
  }, [])

  return (
    <div>
      <h2>My Tickets</h2>
      <h3>Available Flights</h3>
      {loadingFlights && <p>Loading flights...</p>}
      {!loadingFlights && flights.length === 0 && <p>No flights found.</p>}
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {flights.map(f => (
          <li key={f.id} style={{ border: '1px solid #ddd', padding: 10, marginBottom: 6 }}>
            <div><strong>{f.airline} {f.flight_number}</strong> {f.origin} → {f.destination}</div>
            <div>Dep: {new Date(f.departure).toLocaleString()} | Arr: {new Date(f.arrival).toLocaleString()}</div>
            <div>Price: {f.price} | Seats: {f.seats_available}</div>
            <button disabled={f.seats_available <= 0} onClick={() => buy(f.id)}>Buy</button>
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
    </div>
  )
}
