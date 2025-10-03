import { useEffect, useState } from 'react'
import api from '../lib/api'

type Ticket = {
  confirmation_id: string
  status: string
  flight_id: number
  email: string
  purchased_at?: string
  price_paid?: number
}

export default function Dashboard() {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [flightId, setFlightId] = useState('')

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.get('/tickets/my')
      setTickets(res.data)
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to load tickets')
    } finally {
      setLoading(false)
    }
  }

  const cancel = async (id: string) => {
    try {
      await api.post(`/tickets/${id}/cancel`)
      await load()
    } catch (err: any) {
      alert(err?.response?.data?.detail || 'Cancel failed')
    }
  }

  useEffect(() => {
    load()
  }, [])

  return (
    <div>
      <h2>My Tickets</h2>
      <div style={{ marginBottom: 12 }}>
        <input
          placeholder="Flight ID"
          value={flightId}
          onChange={e => setFlightId(e.target.value)}
          style={{ marginRight: 8 }}
        />
        <button onClick={async () => {
          try {
            await api.post('/tickets', { flight_id: Number(flightId) })
            setFlightId('')
            await load()
          } catch (err: any) {
            alert(err?.response?.data?.detail || 'Purchase failed')
          }
        }}>Buy ticket</button>
      </div>
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
