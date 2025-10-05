import React, { useEffect, useState, useRef } from 'react'
import { decodeToken } from '../lib/authClaims'
import api, { extractErrorMessage } from '../lib/api'

// Domain types
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
  // Added by backend for admin context
  company_name?: string
  revenue_est?: number
}

type Passenger = { confirmation_id: string; user_email: string; status: string }
type CompanyStats = { flights:number; active:number; completed:number; passengers:number; revenue:number; seats_capacity:number; seats_sold:number; load_factor:number }

type FlightCreateForm = {
  airline: string
  flight_number: string
  origin: string
  destination: string
  departure: string
  arrival: string
  price: number | string
  seats_total: number | string
  seats_available: number | string
}

type FlightEditForm = {
  airline: string
  flight_number: string
  origin: string
  destination: string
  departure: string // local datetime (YYYY-MM-DDTHH:mm)
  arrival: string   // local datetime
  price: number | string
  seats_total: number | string
  seats_available: number | string
}

export default function CompanyDashboard() {
  const [flights, setFlights] = useState<CompanyFlight[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState<FlightCreateForm>({
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
  const [editForm, setEditForm] = useState<FlightEditForm | null>(null)
  const [savingEdit, setSavingEdit] = useState(false)
  const [deleting, setDeleting] = useState<Record<number, boolean>>({})
  const [stats, setStats] = useState<CompanyStats | null>(null)
  const [statsRange, setStatsRange] = useState<'all'|'today'|'week'|'month'>('all')
  const [loadingStats, setLoadingStats] = useState(false)
  const [companyNames, setCompanyNames] = useState<string[]>([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [isManager, setIsManager] = useState(false)
  const [flightFilter, setFlightFilter] = useState<'all'|'active'|'completed'>('all')
  const [adjustingSeats, setAdjustingSeats] = useState<Record<number, boolean>>({})
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [sort, setSort] = useState('departure_asc')
  const [total, setTotal] = useState(0)
  const [pages, setPages] = useState(1)
  const [gotoPage, setGotoPage] = useState('')
  // Кэш первой страницы: ключ -> { ts, data }
  const firstPageCache = useRef<Record<string, { ts:number; data:any }>>({})

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const params = { page, page_size: pageSize, sort, status: flightFilter }
      // Ключ кэша только для page=1
      if(page === 1){
        const cacheKey = JSON.stringify(params)
        const cached = firstPageCache.current[cacheKey]
        const now = Date.now()
        if(cached && (now - cached.ts) < 30_000){
          const data = cached.data || {}
          setFlights(data.items || [])
          setTotal(data.total || 0)
            setPages(data.pages || 1)
          setLoading(false)
          return
        }
      }
      const r = await api.get('/company/flights', { params })
      const data = r.data || {}
      setFlights(data.items || [])
      setTotal(data.total || 0)
      setPages(data.pages || 1)
      if(page === 1){
        const cacheKey = JSON.stringify(params)
        firstPageCache.current[cacheKey] = { ts: Date.now(), data }
      }
    } catch (e: any) {
  setError(extractErrorMessage(e?.response?.data) || 'Failed to load flights')
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
      // silent fail for stats refresh
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
  alert(extractErrorMessage(e?.response?.data) || 'Create failed')
    } finally {
      setCreating(false)
    }
  }

  const togglePassengers = async (fid: number) => {
    if (passengers[fid]) {
      setPassengers((prev: Record<number, Passenger[]>) => { const copy = { ...prev }; delete copy[fid]; return copy })
      return
    }
    setLoadingPassengers((prev: Record<number, boolean>) => ({ ...prev, [fid]: true }))
    try {
      const r = await api.get(`/company/flights/${fid}/passengers`)
      setPassengers((prev: Record<number, Passenger[]>) => ({ ...prev, [fid]: r.data || [] }))
    } catch (e: any) {
  alert(extractErrorMessage(e?.response?.data) || 'Passengers load failed')
    } finally {
      setLoadingPassengers((prev: Record<number, boolean>) => ({ ...prev, [fid]: false }))
    }
  }

  useEffect(() => { load() }, [page, pageSize, sort, flightFilter])
  useEffect(() => { loadStats() }, [statsRange])
  useEffect(() => { loadCompanyInfo() }, [])
  useEffect(() => {
    const raw = localStorage.getItem('auth_token')
    const decoded = decodeToken(raw)
    const roles: string[] = decoded?.roles || []
    setIsAdmin(roles.includes('admin'))
    setIsManager(roles.includes('company_manager'))
  }, [])
  // realtime seats
  useEffect(() => {
    const handler = (e: any) => {
      const d = e.detail
      if (!d || typeof d.flight_id !== 'number') return
      setFlights(fs => fs.map(f => f.id === d.flight_id ? { ...f, seats_available: d.seats_available } : f))
    }
    window.addEventListener('flight_seats_update', handler as any)
    return () => window.removeEventListener('flight_seats_update', handler as any)
  }, [])

  const loadCompanyInfo = async () => {
    try {
      const r = await api.get('/company/info')
      const names = (r.data?.companies || []).map((c:any)=>c.name).filter(Boolean)
      setCompanyNames(names)
    } catch { /* silent */ }
  }

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
      seats_available: f.seats_available,
    })
  }

  const cancelEdit = () => { setEditingId(null); setEditForm(null); }

  const saveEdit = async (e:React.FormEvent) => {
    e.preventDefault(); if(editingId==null || !editForm) return
    setSavingEdit(true)
    try {
      const payload:any = {
        airline: editForm.airline,
        flight_number: editForm.flight_number,
        origin: editForm.origin,
        destination: editForm.destination,
        departure: editForm.departure,
        arrival: editForm.arrival,
        price: Number(editForm.price),
        seats_total: Number(editForm.seats_total),
      }
      // seats_available валидируем: не больше seats_total
      const sa = Number(editForm.seats_available)
      if (!Number.isNaN(sa)) payload.seats_available = Math.min(sa, Number(editForm.seats_total))
      await api.put(`/company/flights/${editingId}`, payload)
      cancelEdit(); await load(); await loadStats();
    } catch(e:any){
  alert(extractErrorMessage(e?.response?.data) || 'Save failed')
    } finally { setSavingEdit(false) }
  }
  const deleteFlight = async (fid:number) => {
  if(!confirm('Delete flight? All tickets will be refunded.')) return
  setDeleting((prev: Record<number, boolean>)=>({ ...prev, [fid]: true }))
    try {
      await api.delete(`/company/flights/${fid}`)
      await load(); await loadStats();
    } catch(e:any){
      alert(extractErrorMessage(e?.response?.data) || 'Delete failed')
  } finally { setDeleting((prev: Record<number, boolean>)=>({ ...prev, [fid]: false })) }
  }

  const adjustSeats = async (fid:number, delta:number) => {
    // Optimistic update with boundary checks
    setAdjustingSeats(p => ({ ...p, [fid]: true }))
    setFlights(fs => fs.map(f => {
      if (f.id !== fid) return f
      const newAvail = Math.min(f.seats_total, Math.max(0, f.seats_available + delta))
      return { ...f, seats_available: newAvail }
    }))
    try {
      await api.post(`/company/flights/${fid}/seats-adjust`, null, { params: { delta } })
      // Stats may change (revenue, sold seats)
      await loadStats()
    } catch(e:any){
      alert(extractErrorMessage(e?.response?.data) || 'Adjust failed')
      // Re-sync from backend if failed
      await load(); await loadStats();
    } finally {
      setAdjustingSeats(p => ({ ...p, [fid]: false }))
    }
  }

  // Сервер уже фильтрует, просто отображаем
  const filteredFlights = flights

  return (
    <div style={{ padding: 12 }}>
      <h2>Company Dashboard</h2>
      <div style={{ border:'1px solid #ddd', padding:12, borderRadius:6, marginBottom:20 }}>
  <h3 style={{ marginTop:0 }}>Statistics</h3>
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
      {!isAdmin && (
        <>
          <h3>Add flight</h3>
          <form onSubmit={submit} style={{ display:'grid', gap:8, maxWidth:600, gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))' }}>
            {(['flight_number','origin','destination'] as const).map(field => (
              <input
                key={field}
                placeholder={field}
                value={form[field]}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm((o: FlightCreateForm) => ({ ...o, [field]: e.target.value }))}
                required
              />
            ))}
            <input type='datetime-local' value={form.departure} onChange={(e:React.ChangeEvent<HTMLInputElement>) => setForm((o: FlightCreateForm) => ({ ...o, departure: e.target.value }))} required />
            <input type='datetime-local' value={form.arrival} onChange={(e:React.ChangeEvent<HTMLInputElement>) => setForm((o: FlightCreateForm) => ({ ...o, arrival: e.target.value }))} required />
            <input type='number' placeholder='price' value={form.price} onChange={(e:React.ChangeEvent<HTMLInputElement>) => setForm((o: FlightCreateForm) => ({ ...o, price: e.target.value }))} min={0} required />
            <input type='number' placeholder='seats_total' value={form.seats_total} onChange={(e:React.ChangeEvent<HTMLInputElement>) => setForm((o: FlightCreateForm) => ({ ...o, seats_total: e.target.value, seats_available: e.target.value }))} min={1} required />
            <button type='submit' disabled={creating}>{creating ? '...' : 'Create'}</button>
          </form>
        </>
      )}
  <h3 style={{ marginTop:24 }}>{companyNames.length === 1 ? `${companyNames[0]} flights` : (companyNames.length>1 ? 'Company flights' : 'My flights')}</h3>
  <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:10, alignItems:'center' }}>
    {(['all','active','completed'] as const).map(filt => (
      <button key={filt} onClick={()=>{ setFlightFilter(filt); setPage(1) }} style={{ padding:'4px 10px', border:'1px solid '+(flightFilter===filt?'#1d3557':'#cbd5e1'), background:flightFilter===filt?'#1d3557':'#f1f5f9', color:flightFilter===filt?'#fff':'#1e293b', borderRadius:20, fontSize:12 }}>{filt}</button>
    ))}
    <span style={{ fontSize:12, opacity:.7 }}>Showing {filteredFlights.length} / {total}</span>
    <label style={{ fontSize:12, display:'flex', alignItems:'center', gap:4 }}>
      Sort:
      <select value={sort} onChange={e=>{ setSort(e.target.value); setPage(1) }} style={{ fontSize:12 }}>
        <option value='departure_asc'>Departure ↑</option>
        <option value='departure_desc'>Departure ↓</option>
        <option value='arrival_asc'>Arrival ↑</option>
        <option value='arrival_desc'>Arrival ↓</option>
        <option value='price_asc'>Price ↑</option>
        <option value='price_desc'>Price ↓</option>
        <option value='seats_available_desc'>Seats avail ↓</option>
        <option value='seats_available_asc'>Seats avail ↑</option>
        <option value='created_desc'>Created ↓</option>
        <option value='revenue_est_desc'>Revenue est ↓</option>
        <option value='revenue_est_asc'>Revenue est ↑</option>
      </select>
    </label>
    <label style={{ fontSize:12, display:'flex', alignItems:'center', gap:4 }}>
      Page size:
      <select value={pageSize} onChange={e=>{ setPageSize(Number(e.target.value)); setPage(1) }} style={{ fontSize:12 }}>
        {[10,25,50,100].map(s=> <option key={s} value={s}>{s}</option>)}
      </select>
    </label>
    <div style={{ display:'flex', gap:4, alignItems:'center' }}>
      <button type='button' disabled={loading || page<=1} onClick={()=>setPage(p=>Math.max(1,p-1))}>Prev</button>
      <span style={{ fontSize:12 }}>Page {page}/{pages}</span>
      <button type='button' disabled={loading || page>=pages} onClick={()=>setPage(p=>Math.min(pages,p+1))}>Next</button>
    </div>
    <div style={{ display:'flex', gap:4, alignItems:'center' }}>
      <span style={{ fontSize:12 }}>Go to:</span>
      <input value={gotoPage} placeholder='№' style={{ width:54, padding:'2px 4px', fontSize:12 }}
        onChange={e=>{ const v=e.target.value; if(/^[0-9]*$/.test(v)) setGotoPage(v) }}
        onKeyDown={e=>{ if(e.key==='Enter'){ const n = Number(gotoPage); if(n>=1 && n<=pages){ setPage(n) } }} }
      />
      <button type='button' disabled={!gotoPage || Number(gotoPage)<1 || Number(gotoPage)>pages} onClick={()=>{ const n=Number(gotoPage); if(n>=1 && n<=pages) setPage(n) }}>Go</button>
    </div>
    <button type='button' onClick={load} disabled={loading} style={{ fontSize:12 }}>Reload</button>
  </div>
  {loading && <p>Loading...</p>}
  {error && <p style={{ color:'red' }}>{error}</p>}
      <ul style={{ listStyle:'none', padding:0 }}>
        {filteredFlights.map((f: CompanyFlight) => (
          <li key={f.id} style={{ border:'1px solid #ddd', padding:10, marginBottom:8 }}>
            <div style={{ display:'flex', flexWrap:'wrap', gap:6, alignItems:'center' }}>
              <strong>{f.flight_number}</strong>
              {isAdmin && f.company_name && (
                <span style={{ background:'#eef', border:'1px solid #99c', padding:'2px 6px', borderRadius:12, fontSize:11 }}>{f.company_name}</span>
              )}
              <span>{f.origin} → {f.destination}</span>
            </div>
            <div>Dep: {new Date(f.departure).toLocaleString()} | Arr: {new Date(f.arrival).toLocaleString()}</div>
            <div>
              Price: {f.price} | Seats: {f.seats_available}/{f.seats_total}
              <span style={{ marginLeft:12, fontSize:12, background:'#f1f5f9', padding:'2px 6px', borderRadius:6 }}>Revenue est: <strong>{f.revenue_est ?? (Math.max(0, f.seats_total - f.seats_available) * f.price)}</strong></span>
            </div>
            <div style={{ display:'flex', gap:8, marginTop:6, flexWrap:'wrap' }}>
              <button onClick={() => togglePassengers(f.id)}>
                {passengers[f.id] ? 'Hide passengers' : 'Passengers'}
              </button>
              <div style={{ display:'flex', gap:2 }}>
                <button type='button' title='-1 seat' onClick={()=>adjustSeats(f.id,-1)} disabled={adjustingSeats[f.id] || f.seats_available<=0}>-1</button>
                <button type='button' title='+1 seat' onClick={()=>adjustSeats(f.id,1)} disabled={adjustingSeats[f.id] || f.seats_available>=f.seats_total}>+1</button>
                <button type='button' title='+5 seats' onClick={()=>adjustSeats(f.id,5)} disabled={adjustingSeats[f.id] || f.seats_available+5>f.seats_total}>+5</button>
              </div>
              <div style={{ display:'flex', gap:4 }}>
                <button type='button' onClick={async ()=>{
                  try {
                    const r = await api.get(`/company/flights/${f.id}/passengers/export`, { params:{ fmt:'csv' }, responseType:'blob' })
                    const blob = new Blob([r.data], { type: 'text/csv' })
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement('a')
                    a.href = url; a.download = `passengers_f${f.id}.csv`; a.click()
                    URL.revokeObjectURL(url)
                  } catch {}
                }}>CSV</button>
                <button type='button' onClick={async ()=>{
                  try {
                    const r = await api.get(`/company/flights/${f.id}/passengers/export`, { params:{ fmt:'xlsx' }, responseType:'blob' })
                    const blob = new Blob([r.data], { type: 'application/vnd.ms-excel' })
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement('a')
                    a.href = url; a.download = `passengers_f${f.id}.xml`; a.click()
                    URL.revokeObjectURL(url)
                  } catch {}
                }}>Excel</button>
              </div>
              <button onClick={() => startEdit(f)} disabled={editingId===f.id}>Edit</button>
              <button onClick={() => deleteFlight(f.id)} disabled={deleting[f.id]}> {deleting[f.id] ? '...' : 'Delete'} </button>
            </div>
            {loadingPassengers[f.id] && <div>Loading list...</div>}
            {passengers[f.id] && !loadingPassengers[f.id] && (
              <ul style={{ marginTop:6 }}>
                {passengers[f.id].length === 0 && <li>No tickets</li>}
                {passengers[f.id].map(p => (
                  <li key={p.confirmation_id}>{p.user_email} — {p.status}</li>
                ))}
              </ul>
            )}
            {editingId===f.id && editForm && (
              <form onSubmit={saveEdit} style={{ marginTop:10, display:'grid', gap:6, gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))' }}>
                <input value={editForm.airline} placeholder='airline' onChange={(e:React.ChangeEvent<HTMLInputElement>)=>setEditForm((o: FlightEditForm | null)=>o && ({...o, airline:e.target.value}))} required />
                <input value={editForm.flight_number} placeholder='flight_number' onChange={(e:React.ChangeEvent<HTMLInputElement>)=>setEditForm((o: FlightEditForm | null)=>o && ({...o, flight_number:e.target.value}))} required />
                <input value={editForm.origin} onChange={(e:React.ChangeEvent<HTMLInputElement>)=>setEditForm((o: FlightEditForm | null)=>o && ({...o, origin:e.target.value}))} required />
                <input value={editForm.destination} onChange={(e:React.ChangeEvent<HTMLInputElement>)=>setEditForm((o: FlightEditForm | null)=>o && ({...o, destination:e.target.value}))} required />
                <input type='datetime-local' value={editForm.departure} onChange={(e:React.ChangeEvent<HTMLInputElement>)=>setEditForm((o: FlightEditForm | null)=>o && ({...o, departure:e.target.value}))} required />
                <input type='datetime-local' value={editForm.arrival} onChange={(e:React.ChangeEvent<HTMLInputElement>)=>setEditForm((o: FlightEditForm | null)=>o && ({...o, arrival:e.target.value}))} required />
                <input type='number' value={editForm.price} min={0} onChange={(e:React.ChangeEvent<HTMLInputElement>)=>setEditForm((o: FlightEditForm | null)=>o && ({...o, price:e.target.value}))} required />
                <input type='number' value={editForm.seats_total} min={1} onChange={(e:React.ChangeEvent<HTMLInputElement>)=>setEditForm((o: FlightEditForm | null)=>o && ({...o, seats_total:e.target.value}))} required />
                <input type='number' value={editForm.seats_available} min={0} onChange={(e:React.ChangeEvent<HTMLInputElement>)=>setEditForm((o: FlightEditForm | null)=>o && ({...o, seats_available:e.target.value}))} required />
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
