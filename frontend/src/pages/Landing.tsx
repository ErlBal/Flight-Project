import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import BannerSlider from '../components/BannerSlider'
import QuickSearchForm, { SearchCriteria } from '../components/QuickSearchForm'
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
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string|null>(null)
  const [flights, setFlights] = useState<Flight[]>([])
  const [buying, setBuying] = useState<Record<number, boolean>>({})
  const [quantities, setQuantities] = useState<Record<number, number>>({})
  const [toast, setToast] = useState<string|null>(null)
  const [authed, setAuthed] = useState(false)

  useEffect(() => {
    // simple auth presence check
    setAuthed(!!localStorage.getItem('auth_token'))
    const listener = () => setAuthed(!!localStorage.getItem('auth_token'))
    window.addEventListener('storage', listener)
    return () => window.removeEventListener('storage', listener)
  }, [])

  async function runSearch(criteria: SearchCriteria){
    if (!criteria.origin && !criteria.destination && !criteria.date) { setFlights([]); return }
    setLoading(true); setError(null)
    try {
      const r = await api.get('/flights/', { params: criteria })
      setFlights(r.data.items || [])
    } catch(e:any){
      setError(extractErrorMessage(e?.response?.data) || 'Search failed')
    } finally { setLoading(false) }
  }

  const buy = async (flightId: number) => {
    if (!authed) return // guard; button disabled anyway
    if (buying[flightId]) return
    setBuying(b => ({ ...b, [flightId]: true }))
    try {
      const quantity = quantities[flightId] || 1
      const res = await api.post('/tickets', { flight_id: flightId, quantity })
      if (res.data.confirmation_ids) setToast(`Purchased ${res.data.quantity} ticket(s)`) 
      else setToast('Ticket purchased')
    } catch(e:any){
      const msg = extractErrorMessage(e?.response?.data) || 'Purchase failed'
      if (/unauth/i.test(msg) || /auth/i.test(msg)) setAuthed(false)
      alert(msg)
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
        <QuickSearchForm onSearch={runSearch} />
        <div style={resultsWrapper}>
          <div style={resultsHeaderRow}>
            <span style={{ fontSize:13, fontWeight:600 }}>Results</span>
            {loading && <span style={{ fontSize:11 }}>Loading…</span>}
            {!loading && flights.length>0 && <span style={{ fontSize:11, opacity:.7 }}>{flights.length} found</span>}
          </div>
          {error && <div style={errorBox}>{error}</div>}
          {!error && !loading && flights.length===0 && <div style={emptyBox}>No flights</div>}
          <ul style={resultsList}>
            {flights.slice(0,50).map(f => (
              <li key={f.id} style={resultItem}>
                <div style={resultTopRow}>
                  <strong style={{ fontSize:13 }}>{f.airline} {f.flight_number}</strong>
                  <span style={stopsBadge}>{f.stops} stops</span>
                </div>
                <div style={routeLine}>{f.origin} → {f.destination}</div>
                <div style={timeLine}>Dep {new Date(f.departure).toLocaleString()} | Arr {new Date(f.arrival).toLocaleString()}</div>
                <div style={actionRow}>
                  <span style={priceTag}>${f.price}</span>
                  <span style={seatsTag}>Seats: {f.seats_available}</span>
                  <input
                    type='number'
                    min={1}
                    max={Math.min(10, f.seats_available)}
                    value={quantities[f.id] || 1}
                    onChange={e=>setQuantities(q=>({ ...q, [f.id]: Math.max(1, Math.min(10, Number(e.target.value)||1)) }))}
                    style={qtyInput}
                    disabled={f.seats_available<=0}
                  />
                  <button
                    onClick={()=>buy(f.id)}
                    disabled={!authed || f.seats_available<=0 || buying[f.id]}
                    style={{ ...buyBtn, background: !authed ? '#64748b' : buyBtn.background, cursor: !authed ? 'not-allowed' : 'pointer', opacity: (!authed || buying[f.id]) ? 0.8 : 1 }}
                    title={!authed ? 'Login to purchase tickets' : undefined}
                  >{!authed ? 'Login to buy' : (buying[f.id]?'...':'Buy')}</button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

  <section style={{ marginTop: 40 }}>
        <div style={sectionHeaderRow}>
          <h2 style={sectionTitle}>Highlighted offers</h2>
          <a href='/?date=' style={smallLink}>Reset search</a>
        </div>
        <HighlightedOffers limit={6} />
      </section>

      {/* Inline results now replace overlay */}
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

// Results styles
const resultsWrapper: React.CSSProperties = {
  marginTop:16,
  background:'#fff',
  border:'1px solid #e2e8f0',
  borderRadius:8,
  padding:12,
  boxShadow:'0 1px 2px rgba(0,0,0,0.05)',
  maxHeight:260,
  display:'flex',
  flexDirection:'column'
}
const resultsHeaderRow: React.CSSProperties = { display:'flex', gap:10, alignItems:'baseline' }
const errorBox: React.CSSProperties = { color:'#b91c1c', fontSize:12, padding:'4px 6px', background:'#fef2f2', border:'1px solid #fecaca', borderRadius:4 }
const emptyBox: React.CSSProperties = { fontSize:12, opacity:.6, padding:'2px 4px' }
const resultsList: React.CSSProperties = { listStyle:'none', padding:0, margin:'8px 0 0', overflowY:'auto', display:'flex', flexDirection:'column', gap:8 }
const resultItem: React.CSSProperties = { border:'1px solid #e2e8f0', borderRadius:6, padding:8, background:'#f8fafc' }
const resultTopRow: React.CSSProperties = { display:'flex', justifyContent:'space-between', alignItems:'center', gap:8 }
const stopsBadge: React.CSSProperties = { fontSize:10, background:'#e0f2fe', color:'#0369a1', padding:'2px 6px', borderRadius:4, textTransform:'uppercase', letterSpacing:'.5px', fontWeight:600 }
const routeLine: React.CSSProperties = { fontSize:12, marginTop:2 }
const timeLine: React.CSSProperties = { fontSize:10, opacity:.7, marginTop:2 }
const actionRow: React.CSSProperties = { display:'flex', gap:6, alignItems:'center', marginTop:6, flexWrap:'wrap' }
const priceTag: React.CSSProperties = { fontWeight:600, fontSize:13 }
const seatsTag: React.CSSProperties = { fontSize:11 }
const qtyInput: React.CSSProperties = { width:54, fontSize:12, padding:'3px 4px', border:'1px solid #cbd5e1', borderRadius:4 }
const buyBtn: React.CSSProperties = { fontSize:12, background:'#1d3557', color:'#fff', border:'none', borderRadius:4, padding:'5px 10px', cursor:'pointer' }
