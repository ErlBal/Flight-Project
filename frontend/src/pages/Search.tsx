import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import api, { extractErrorMessage } from '../lib/api'

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
  stops: number
}

export default function Search() {
  const nav = useNavigate()
  const loc = useLocation()
  const params = useMemo(() => new URLSearchParams(loc.search), [loc.search])

  const [origin, setOrigin] = useState(params.get('origin') || '')
  const [destination, setDestination] = useState(params.get('destination') || '')
  const [date, setDate] = useState(params.get('date') || params.get('departure_date') || '')
  const [passengers, setPassengers] = useState<number | ''>(params.get('passengers') ? Number(params.get('passengers')) || 1 : 1)
  const [minPrice, setMinPrice] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  const [stopsMax, setStopsMax] = useState('')
  const [flights, setFlights] = useState<Flight[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [buying, setBuying] = useState<Record<number, boolean>>({})
  const [quantities, setQuantities] = useState<Record<number, number>>({})
  const [toast, setToast] = useState<string|null>(null)

  const syncUrl = useCallback(() => {
    const p = new URLSearchParams()
    if (origin) p.set('origin', origin)
    if (destination) p.set('destination', destination)
    if (date) p.set('date', date)
    if (passengers) p.set('passengers', String(passengers))
    nav({ pathname: '/search', search: p.toString() }, { replace: true })
  }, [origin, destination, date, passengers, nav])

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const query: any = {}
      if (origin) query.origin = origin
      if (destination) query.destination = destination
      if (date) query.date = date
      if (passengers) query.passengers = passengers
      if (minPrice) query.min_price = Number(minPrice)
      if (maxPrice) query.max_price = Number(maxPrice)
      if (stopsMax) query.max_stops = Number(stopsMax)
  // IMPORTANT: use trailing slash to hit actual list endpoint (non-slash alias only returns info message)
  const r = await api.get('/flights/', { params: query })
      setFlights(r.data.items || [])
    } catch(e:any){
      setError(extractErrorMessage(e?.response?.data) || 'Search failed')
    } finally { setLoading(false) }
  }, [origin, destination, date, passengers, minPrice, maxPrice, stopsMax])

  useEffect(() => { // auto search when arriving with params
    if (origin || destination || date || passengers) load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const submit = async (e:React.FormEvent) => {
    e.preventDefault(); syncUrl(); await load()
  }

  const resetFilters = () => {
    setOrigin(''); setDestination(''); setDate(''); setPassengers(1); setMinPrice(''); setMaxPrice(''); setStopsMax(''); setFlights([]); nav('/search', { replace:true })
  }

  const buy = async (flightId: number) => {
    if (buying[flightId]) return
    setBuying(b => ({ ...b, [flightId]: true }))
    try {
      const quantity = quantities[flightId] || 1
      const res = await api.post('/tickets', { flight_id: flightId, quantity })
      if (res.data.confirmation_ids) {
        setToast(`Purchased ${res.data.quantity} ticket(s)`) }
      else { setToast('Ticket purchased') }
      // refresh list
      await load()
      setQuantities(q => ({ ...q, [flightId]: 1 }))
    } catch(e:any){
      alert(extractErrorMessage(e?.response?.data) || 'Purchase failed')
    } finally { setBuying(b => ({ ...b, [flightId]: false })) }
  }

  return (
    <div style={{ maxWidth:1100, margin:'0 auto', padding:'20px 20px 60px' }}>
      <h2 style={{ marginTop:0 }}>Search Flights</h2>
      <form onSubmit={submit} style={{ display:'grid', gap:12, gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))', background:'#fafafa', padding:16, borderRadius:8, marginBottom:20 }}>
        <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
          <label style={lbl}>Origin</label>
          <input value={origin} onChange={e=>setOrigin(e.target.value.toUpperCase())} placeholder='' />
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
          <label style={lbl}>Destination</label>
          <input value={destination} onChange={e=>setDestination(e.target.value.toUpperCase())} placeholder='' />
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
          <label style={lbl}>Date</label>
          <input type='date' value={date} onChange={e=>setDate(e.target.value)} />
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
          <label style={lbl}>Passengers</label>
          <input type='number' min={1} value={passengers} onChange={e=>setPassengers(e.target.value? Number(e.target.value):1)} />
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
          <label style={lbl}>Min Price</label>
          <input value={minPrice} onChange={e=>{ const v=e.target.value; if(/^[0-9]*$/.test(v)) setMinPrice(v) }} />
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
          <label style={lbl}>Max Price</label>
          <input value={maxPrice} onChange={e=>{ const v=e.target.value; if(/^[0-9]*$/.test(v)) setMaxPrice(v) }} />
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
          <label style={lbl}>Max Stops</label>
          <input value={stopsMax} onChange={e=>{ const v=e.target.value; if(/^[0-9]*$/.test(v)) setStopsMax(v) }} />
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'flex-end', flexWrap:'wrap' }}>
          <button type='submit' style={submitBtn} disabled={loading}>{loading?'Searching...':'Search'}</button>
          <button type='button' onClick={resetFilters} disabled={loading}>Reset</button>
        </div>
      </form>
      {error && <p style={{ color:'red' }}>{error}</p>}
      {loading && <p>Loading results...</p>}
      {!loading && flights.length === 0 && !error && <p>No flights found.</p>}
      <ul style={{ listStyle:'none', padding:0 }}>
        {flights.map(f => (
          <li key={f.id} style={{ border:'1px solid #ddd', borderRadius:8, padding:12, marginBottom:10 }}>
            <div style={{ display:'flex', flexWrap:'wrap', justifyContent:'space-between', gap:6 }}>
              <div style={{ fontWeight:600 }}>{f.airline} {f.flight_number}</div>
              <div style={{ fontSize:12, background:'#eef', padding:'2px 6px', borderRadius:4 }}>Stops: {f.stops}</div>
            </div>
            <div style={{ fontSize:14, marginTop:4 }}>{f.origin} → {f.destination}</div>
            <div style={{ fontSize:12, opacity:.8 }}>Dep: {new Date(f.departure).toLocaleString()} | Arr: {new Date(f.arrival).toLocaleString()}</div>
            <div style={{ marginTop:6, display:'flex', gap:12, alignItems:'center', flexWrap:'wrap' }}>
              <span style={{ fontWeight:600 }}>${f.price}</span>
              <span style={{ fontSize:12 }}>Seats: {f.seats_available}</span>
              <input
                type='number'
                min={1}
                max={Math.min(10, f.seats_available)}
                value={quantities[f.id] || 1}
                onChange={e=>setQuantities(q=>({ ...q, [f.id]: Math.max(1, Math.min(10, Number(e.target.value)||1)) }))}
                style={{ width:70 }}
                disabled={f.seats_available<=0}
              />
              <button disabled={f.seats_available<=0 || buying[f.id]} onClick={()=>buy(f.id)}>
                {buying[f.id]? '...' : 'Buy'}
              </button>
            </div>
          </li>
        ))}
      </ul>
      {toast && (
        <div style={{ position:'fixed', bottom:20, right:20, background:'#333', color:'#fff', padding:'8px 14px', borderRadius:4 }}>
          {toast}
          <button style={{ marginLeft:10 }} onClick={()=>setToast(null)}>x</button>
        </div>
      )}
    </div>
  )
}

const lbl: React.CSSProperties = { fontSize:11, textTransform:'uppercase', letterSpacing:'.5px', fontWeight:600 }
const submitBtn: React.CSSProperties = { background:'#1d3557', color:'#fff', padding:'8px 14px', border:'none', borderRadius:6, cursor:'pointer', fontWeight:600 }
