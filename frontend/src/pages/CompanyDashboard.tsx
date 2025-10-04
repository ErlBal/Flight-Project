import React, { useEffect, useState } from 'react'
import api, { extractErrorMessage } from '../lib/api'

type CompanyFlight = {
  id: number
  airline: string
  flight_number: string
  origin: string
  destination: string
  departure: string
  arrival: string
  price: number
  seats_total: number
  seats_available: number
}

type Passenger = { confirmation_id: string; user_email: string; status: string }

export default function CompanyDashboard() {
  const [flights, setFlights] = useState<CompanyFlight[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState<any>({
    airline: 'DemoAir',
    flight_number: '',
    origin: '',
    destination: '',
    departure: '',
    arrival: '',
    price: 0,
    seats_total: 0,
    seats_available: 0,
  })
  const [passengers, setPassengers] = useState<Record<number, Passenger[]>>({})
  const [loadingPassengers, setLoadingPassengers] = useState<Record<number, boolean>>({})

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const r = await api.get('/company/flights')
      setFlights(r.data || [])
    } catch (e: any) {
      setError(extractErrorMessage(e?.response?.data) || 'Ошибка загрузки рейсов')
    } finally {
      setLoading(false)
    }
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreating(true)
    try {
      await api.post('/company/flights', {
        ...form,
        price: Number(form.price),
        seats_total: Number(form.seats_total),
        seats_available: Number(form.seats_available),
      })
      setForm({ airline: 'DemoAir', flight_number: '', origin: '', destination: '', departure: '', arrival: '', price: 0, seats_total: 0, seats_available: 0 })
      await load()
    } catch (e: any) {
      alert(extractErrorMessage(e?.response?.data) || 'Ошибка создания')
    } finally {
      setCreating(false)
    }
  }

  const togglePassengers = async (fid: number) => {
    if (passengers[fid]) {
      setPassengers(p => { const copy = { ...p }; delete copy[fid]; return copy })
      return
    }
    setLoadingPassengers(lp => ({ ...lp, [fid]: true }))
    try {
      const r = await api.get(`/company/flights/${fid}/passengers`)
      setPassengers(p => ({ ...p, [fid]: r.data || [] }))
    } catch (e: any) {
      alert(extractErrorMessage(e?.response?.data) || 'Ошибка пассажиров')
    } finally {
      setLoadingPassengers(lp => ({ ...lp, [fid]: false }))
    }
  }

  useEffect(() => { load() }, [])

  return (
    <div style={{ padding: 12 }}>
      <h2>Company Dashboard</h2>
      <h3>Добавить рейс</h3>
      <form onSubmit={submit} style={{ display:'grid', gap:8, maxWidth:600, gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))' }}>
        {['flight_number','origin','destination'].map(f => (
          <input key={f} placeholder={f} value={form[f]} onChange={e => setForm((o:any) => ({ ...o, [f]: e.target.value }))} required />
        ))}
        <input type='datetime-local' value={form.departure} onChange={e => setForm((o:any) => ({ ...o, departure: e.target.value }))} required />
        <input type='datetime-local' value={form.arrival} onChange={e => setForm((o:any) => ({ ...o, arrival: e.target.value }))} required />
        <input type='number' placeholder='price' value={form.price} onChange={e => setForm((o:any) => ({ ...o, price: e.target.value }))} min={0} required />
        <input type='number' placeholder='seats_total' value={form.seats_total} onChange={e => setForm((o:any) => ({ ...o, seats_total: e.target.value, seats_available: e.target.value }))} min={1} required />
        <button type='submit' disabled={creating}>{creating ? '...' : 'Создать'}</button>
      </form>
      <h3 style={{ marginTop:24 }}>Мои рейсы</h3>
      {loading && <p>Загрузка...</p>}
      {error && <p style={{ color:'red' }}>{error}</p>}
      <ul style={{ listStyle:'none', padding:0 }}>
        {flights.map(f => (
          <li key={f.id} style={{ border:'1px solid #ddd', padding:10, marginBottom:8 }}>
            <div><strong>{f.flight_number}</strong> {f.origin} → {f.destination}</div>
            <div>Dep: {new Date(f.departure).toLocaleString()} | Arr: {new Date(f.arrival).toLocaleString()}</div>
            <div>Price: {f.price} | Seats: {f.seats_available}/{f.seats_total}</div>
            <button onClick={() => togglePassengers(f.id)} style={{ marginTop:6 }}>
              {passengers[f.id] ? 'Скрыть пассажиров' : 'Пассажиры'}
            </button>
            {loadingPassengers[f.id] && <div>Загрузка списка...</div>}
            {passengers[f.id] && !loadingPassengers[f.id] && (
              <ul style={{ marginTop:6 }}>
                {passengers[f.id].length === 0 && <li>Нет билетов</li>}
                {passengers[f.id].map(p => (
                  <li key={p.confirmation_id}>{p.user_email} — {p.status}</li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
