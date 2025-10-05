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

  useEffect(() => { load() }, [load])

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

      <section style={{ marginTop: 40 }}>
        <h2 style={sectionTitle}>Search results</h2>
        {!(origin || destination || date || passengers || ref) && <p style={{ fontSize:14, opacity:.7 }}>Use the quick search above to find flights.</p>}
        {loading && <p>Loading...</p>}
        {error && <p style={{ color:'red' }}>{error}</p>}
        {!loading && !error && (origin || destination || date || passengers || ref) && flights.length===0 && <p>No flights found.</p>}
        <ul style={{ listStyle:'none', padding:0 }}>
          {flights.map(f => (
            <li key={f.id} style={{ border:'1px solid #e2e8f0', borderRadius:8, padding:12, marginBottom:10 }}>
              <div style={{ display:'flex', justifyContent:'space-between', gap:8, flexWrap:'wrap' }}>
                <strong>{f.airline} {f.flight_number}</strong>
                <span style={{ fontSize:12, background:'#eef', padding:'2px 6px', borderRadius:4 }}>Stops: {f.stops}</span>
              </div>
              <div style={{ fontSize:14, marginTop:4 }}>{f.origin} → {f.destination}</div>
              <div style={{ fontSize:12, opacity:.75 }}>Dep: {new Date(f.departure).toLocaleString()} | Arr: {new Date(f.arrival).toLocaleString()}</div>
              <div style={{ marginTop:6, display:'flex', gap:12, alignItems:'center', flexWrap:'wrap' }}>
                <span style={{ fontWeight:600 }}>${f.price}</span>
                <span style={{ fontSize:12 }}>Seats: {f.seats_available}</span>
              </div>
            </li>
          ))}
        </ul>
      </section>
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
