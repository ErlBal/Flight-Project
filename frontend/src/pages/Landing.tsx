import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import BannerSlider from '../components/BannerSlider'
import QuickSearchForm from '../components/QuickSearchForm'
import HighlightedOffers from '../components/HighlightedOffers'
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

export default function Landing() {
  const loc = useLocation()
  const nav = useNavigate()
  const params = useMemo(() => new URLSearchParams(loc.search), [loc.search])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string|null>(null)
  const [flights, setFlights] = useState<Flight[]>([])
  const [overlayOpen, setOverlayOpen] = useState(false)
  const [buying, setBuying] = useState<Record<number, boolean>>({})
  const [quantities, setQuantities] = useState<Record<number, number>>({})
  const [toast, setToast] = useState<string|null>(null)

  const origin = params.get('origin') || ''
  const destination = params.get('destination') || ''
  const date = params.get('date') || params.get('departure_date') || ''
  const passengers = params.get('passengers') || ''
  const ref = params.get('ref') || ''

  const load = useCallback(async () => {
    if (!(origin || destination || date || passengers || ref)) { setFlights([]); return }
    setLoading(true); setError(null)
    try {
      const query: any = {}
      if (origin) query.origin = origin
      if (destination) query.destination = destination
      if (date) query.date = date
      if (passengers) query.passengers = passengers
      if (ref) query.flight_number = ref // fallback attempt: allow offer flight_ref by flight_number
      const r = await api.get('/flights/', { params: query })
      setFlights(r.data.items || [])
    } catch(e:any){
      setError(extractErrorMessage(e?.response?.data) || 'Search failed')
    } finally { setLoading(false) }
  }, [origin, destination, date, passengers, ref])

  useEffect(() => { load(); if (origin || destination || date || passengers || ref) setOverlayOpen(true) }, [load])

  const buy = async (flightId: number) => {
    if (buying[flightId]) return
    setBuying(b => ({ ...b, [flightId]: true }))
    try {
      const quantity = quantities[flightId] || 1
      const res = await api.post('/tickets', { flight_id: flightId, quantity })
      if (res.data.confirmation_ids) setToast(`Purchased ${res.data.quantity} ticket(s)`) 
      else setToast('Ticket purchased')
    } catch(e:any){
      alert(extractErrorMessage(e?.response?.data) || 'Purchase failed')
    } finally { setBuying(b => ({ ...b, [flightId]: false })) }
  }

  return (
    <div style={pageWrap}>
      <header style={heroHeader}>
        <div style={{ flex: 1 }}>
          <h1 style={titleStyle}>FlightProject</h1>
          <p style={subtitleStyle}>Search, compare and book flights quickly.</p>
        </div>
        <div style={{ flex: 1, minWidth: 320 }}>
          <BannerSlider />
        </div>
      </header>

      <section style={{ marginTop: 32 }}>
        <h2 style={sectionTitle}>Quick search</h2>
        <QuickSearchForm />
      </section>

      <section style={{ marginTop: 40 }}>
        <div style={sectionHeaderRow}>
          <h2 style={sectionTitle}>Highlighted offers</h2>
          <a href='/?date=' style={smallLink}>Reset search</a>
        </div>
        <HighlightedOffers limit={6} />
      </section>

      {/* Overlay panel */}
      <div style={{ position:'fixed', top:0, right:0, bottom:0, width: overlayOpen? 420:0, transition:'width .28s ease', background:'#fff', boxShadow: overlayOpen?'-4px 0 12px rgba(0,0,0,.15)':'none', overflow:'hidden', zIndex:50, borderLeft:'1px solid #e2e8f0' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 16px', borderBottom:'1px solid #e2e8f0', background:'#f8fafc' }}>
          <strong style={{ fontSize:14 }}>Search Results</strong>
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={()=>setOverlayOpen(false)} style={iconBtn}>×</button>
          </div>
        </div>
        <div style={{ padding:'12px 16px', height:'100%', overflowY:'auto' }}>
          {!(origin || destination || date || passengers || ref) && <p style={{ fontSize:13, opacity:.7 }}>Use the form on the left to search.</p>}
          {loading && <p style={{ fontSize:13 }}>Loading...</p>}
          {error && <p style={{ color:'red', fontSize:13 }}>{error}</p>}
          {!loading && !error && (origin || destination || date || passengers || ref) && flights.length===0 && <p style={{ fontSize:13 }}>No flights found.</p>}
          <ul style={{ listStyle:'none', padding:0, margin:0 }}>
            {flights.map(f => (
              <li key={f.id} style={{ border:'1px solid #e2e8f0', padding:10, borderRadius:6, marginBottom:10 }}>
                <div style={{ display:'flex', justifyContent:'space-between', gap:8 }}>
                  <span style={{ fontWeight:600, fontSize:13 }}>{f.airline} {f.flight_number}</span>
                  <span style={{ fontSize:11, background:'#eef', padding:'2px 6px', borderRadius:4 }}>Stops {f.stops}</span>
                </div>
                <div style={{ fontSize:12, marginTop:4 }}>{f.origin} → {f.destination}</div>
                <div style={{ fontSize:11, opacity:.7 }}>Dep: {new Date(f.departure).toLocaleString()}<br/>Arr: {new Date(f.arrival).toLocaleString()}</div>
                <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:6, flexWrap:'wrap' }}>
                  <span style={{ fontWeight:600, fontSize:13 }}>${f.price}</span>
                  <span style={{ fontSize:11 }}>Seats: {f.seats_available}</span>
                  <input
                    type='number'
                    min={1}
                    max={Math.min(10, f.seats_available)}
                    value={quantities[f.id] || 1}
                    onChange={e=>setQuantities(q=>({ ...q, [f.id]: Math.max(1, Math.min(10, Number(e.target.value)||1)) }))}
                    style={{ width:60, fontSize:12 }}
                    disabled={f.seats_available<=0}
                  />
                  <button
                    onClick={()=>buy(f.id)}
                    disabled={f.seats_available<=0 || buying[f.id]}
                    style={{ fontSize:12, padding:'4px 10px', background:'#1d3557', color:'#fff', border:'none', borderRadius:4, cursor:'pointer' }}
                  >{buying[f.id]?'...':'Buy'}</button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <button onClick={()=>setOverlayOpen(o=>!o)} style={{ position:'fixed', top:80, right: overlayOpen? 430: 10, zIndex:60, transition:'right .28s', background:'#1d3557', color:'#fff', border:'none', borderRadius: '20px', padding:'8px 14px', cursor:'pointer', fontSize:12 }}>
        {overlayOpen ? 'Hide results' : 'Show results'}
      </button>
      {toast && (
        <div style={{ position:'fixed', bottom:20, right:20, background:'#333', color:'#fff', padding:'8px 14px', borderRadius:4, fontSize:13 }}>
          {toast}
          <button style={{ marginLeft:10 }} onClick={()=>setToast(null)}>x</button>
        </div>
      )}
    </div>
  )
}

const pageWrap: React.CSSProperties = {
  maxWidth: 1100,
  margin: '0 auto',
  padding: '24px 24px 60px'
}

const heroHeader: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'stretch',
  gap: 24
}

const titleStyle: React.CSSProperties = {
  fontSize: 44,
  lineHeight: 1.05,
  margin: 0,
  background: 'linear-gradient(90deg,#1d3557,#457b9d)',
  WebkitBackgroundClip: 'text',
  color: 'transparent'
}

const subtitleStyle: React.CSSProperties = {
  fontSize: 16,
  margin: '14px 0 0',
  color: '#475569'
}

const primaryLink: React.CSSProperties = {
  display: 'inline-block',
  background: '#1d3557',
  color: 'white',
  textDecoration: 'none',
  padding: '10px 18px',
  borderRadius: 8,
  fontWeight: 600,
  fontSize: 14
}

const sectionTitle: React.CSSProperties = {
  margin: '0 0 12px',
  fontSize: 24,
  lineHeight: 1.2
}

const sectionHeaderRow: React.CSSProperties = {
  display: 'flex',
  alignItems: 'baseline',
  justifyContent: 'space-between',
  gap: 16,
  flexWrap: 'wrap'
}

const smallLink: React.CSSProperties = {
  fontSize: 13,
  textDecoration: 'none',
  color: '#1d3557'
}

const iconBtn: React.CSSProperties = {
  background:'transparent',
  border:'1px solid #94a3b8',
  borderRadius:4,
  cursor:'pointer',
  padding:'2px 8px',
  fontSize:14,
  lineHeight:1,
  color:'#334155'
}
