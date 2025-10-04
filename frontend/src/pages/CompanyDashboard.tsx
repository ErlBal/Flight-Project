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
type CompanyStats = { flights:number; active:number; completed:number; passengers:number; revenue:number; seats_capacity:number; seats_sold:number; load_factor:number }

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
  const [editingId, setEditingId] = useState<number|null>(null)
  const [editForm, setEditForm] = useState<any>(null)
  const [savingEdit, setSavingEdit] = useState(false)
  const [deleting, setDeleting] = useState<Record<number, boolean>>({})
  const [stats, setStats] = useState<CompanyStats | null>(null)
  const [statsRange, setStatsRange] = useState<'all'|'today'|'week'|'month'>('all')
  const [loadingStats, setLoadingStats] = useState(false)

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

  const loadStats = async () => {
    setLoadingStats(true)
    try {
      const r = await api.get('/company/stats', { params: { range: statsRange }})
      setStats(r.data)
    } catch(e:any){
      // тихо
    } finally { setLoadingStats(false) }
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
  useEffect(() => { loadStats() }, [statsRange])

  const startEdit = (f:CompanyFlight) => {
    setEditingId(f.id)
    setEditForm({
      airline: f.airline,
      flight_number: f.flight_number,
      origin: f.origin,
      destination: f.destination,
      departure: f.departure.slice(0,16),
      arrival: f.arrival.slice(0,16),
      price: f.price,
      seats_total: f.seats_total,
    })
  }

  const cancelEdit = () => { setEditingId(null); setEditForm(null); }

  const saveEdit = async (e:React.FormEvent) => {
    e.preventDefault(); if(editingId==null) return
    setSavingEdit(true)
    try {
      await api.put(`/company/flights/${editingId}`, {
        ...editForm,
        price: Number(editForm.price),
        seats_total: Number(editForm.seats_total),
        departure: editForm.departure,
        arrival: editForm.arrival,
      })
      cancelEdit(); await load(); await loadStats();
    } catch(e:any){
      alert(extractErrorMessage(e?.response?.data) || 'Ошибка сохранения')
    } finally { setSavingEdit(false) }
  }

  const deleteFlight = async (fid:number) => {
    if(!confirm('Удалить рейс? Все билеты будут возвращены.')) return
    setDeleting(d=>({ ...d, [fid]: true }))
    try {
      await api.delete(`/company/flights/${fid}`)
      await load(); await loadStats();
    } catch(e:any){
      alert(extractErrorMessage(e?.response?.data) || 'Ошибка удаления')
    } finally { setDeleting(d=>({ ...d, [fid]: false })) }
  }

  return (
    <div style={{ padding: 12 }}>
      <h2>Company Dashboard</h2>
      <div style={{ border:'1px solid #ddd', padding:12, borderRadius:6, marginBottom:20 }}>
        <h3 style={{ marginTop:0 }}>Статистика</h3>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:10 }}>
          {(['all','today','week','month'] as const).map(r => (
            <button key={r} onClick={()=>setStatsRange(r)} style={{ padding:'4px 10px', border:'1px solid '+(statsRange===r?'#444':'#bbb'), background:statsRange===r?'#444':'#f5f5f5', color:statsRange===r?'#fff':'#222', borderRadius:4 }}>{r}</button>
          ))}
          <button onClick={loadStats} disabled={loadingStats}>Reload</button>
        </div>
        {stats && (
          <div style={{ display:'grid', gap:10, gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))', fontSize:13 }}>
            <Stat label='Flights' v={stats.flights} />
            <Stat label='Active' v={stats.active} />
            <Stat label='Completed' v={stats.completed} />
            <Stat label='Passengers' v={stats.passengers} />
            <Stat label='Revenue' v={stats.revenue.toFixed(2)} />
            <Stat label='Seats cap' v={stats.seats_capacity} />
            <Stat label='Seats sold' v={stats.seats_sold} />
            <Stat label='Load' v={(stats.load_factor*100).toFixed(1)+'%'} />
          </div>
        )}
      </div>
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
            <div style={{ display:'flex', gap:8, marginTop:6, flexWrap:'wrap' }}>
              <button onClick={() => togglePassengers(f.id)}>
                {passengers[f.id] ? 'Скрыть пассажиров' : 'Пассажиры'}
              </button>
              <button onClick={() => startEdit(f)} disabled={editingId===f.id}>Edit</button>
              <button onClick={() => deleteFlight(f.id)} disabled={deleting[f.id]}> {deleting[f.id] ? '...' : 'Delete'} </button>
            </div>
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
            {editingId===f.id && editForm && (
              <form onSubmit={saveEdit} style={{ marginTop:10, display:'grid', gap:6, gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))' }}>
                <input value={editForm.flight_number} onChange={e=>setEditForm((o:any)=>({...o, flight_number:e.target.value}))} required />
                <input value={editForm.origin} onChange={e=>setEditForm((o:any)=>({...o, origin:e.target.value}))} required />
                <input value={editForm.destination} onChange={e=>setEditForm((o:any)=>({...o, destination:e.target.value}))} required />
                <input type='datetime-local' value={editForm.departure} onChange={e=>setEditForm((o:any)=>({...o, departure:e.target.value}))} required />
                <input type='datetime-local' value={editForm.arrival} onChange={e=>setEditForm((o:any)=>({...o, arrival:e.target.value}))} required />
                <input type='number' value={editForm.price} min={0} onChange={e=>setEditForm((o:any)=>({...o, price:e.target.value}))} required />
                <input type='number' value={editForm.seats_total} min={1} onChange={e=>setEditForm((o:any)=>({...o, seats_total:e.target.value}))} required />
                <div style={{ display:'flex', gap:8 }}>
                  <button type='submit' disabled={savingEdit}>{savingEdit?'...':'Save'}</button>
                  <button type='button' onClick={cancelEdit}>Cancel</button>
                </div>
              </form>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

function Stat({ label, v }:{label:string; v:any}) {
  return (
    <div style={{ border:'1px solid #eee', background:'#fafafa', padding:8, borderRadius:4 }}>
      <div style={{ fontSize:11, opacity:.7 }}>{label}</div>
      <div style={{ fontSize:16, fontWeight:600 }}>{v}</div>
    </div>
  )
}
