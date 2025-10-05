import React, { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

interface Props { onSubmit?: () => void }

export const QuickSearchForm: React.FC<Props> = ({ onSubmit }) => {
  const nav = useNavigate()
  const loc = useLocation()
  const sp = new URLSearchParams(loc.search)
  const [origin, setOrigin] = useState(sp.get('origin') || '')
  const [destination, setDestination] = useState(sp.get('destination') || '')
  const [date, setDate] = useState(sp.get('date') || sp.get('departure_date') || '')
  const [passengers, setPassengers] = useState<number>(Number(sp.get('passengers')||'')||1)
  const [minPrice, setMinPrice] = useState(sp.get('min_price') || '')
  const [maxPrice, setMaxPrice] = useState(sp.get('max_price') || '')
  const [maxStops, setMaxStops] = useState(sp.get('max_stops') || '')

  // keep URL params reflected in fields on location change (e.g. back/forward nav)
  useEffect(()=>{
    const p = new URLSearchParams(loc.search)
    setOrigin(p.get('origin') || '')
    setDestination(p.get('destination') || '')
    setDate(p.get('date') || p.get('departure_date') || '')
    setPassengers(Number(p.get('passengers')||'')||1)
    setMinPrice(p.get('min_price') || '')
    setMaxPrice(p.get('max_price') || '')
    setMaxStops(p.get('max_stops') || '')
  }, [loc.search])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const params = new URLSearchParams()
    if (origin) params.set('origin', origin.trim().toUpperCase())
    if (destination) params.set('destination', destination.trim().toUpperCase())
    if (date) params.set('date', date)
    if (passengers) params.set('passengers', String(passengers))
    if (minPrice) params.set('min_price', minPrice)
    if (maxPrice) params.set('max_price', maxPrice)
    if (maxStops) params.set('max_stops', maxStops)
    nav(`/?${params.toString()}`)
    onSubmit?.()
  }

  return (
  <form onSubmit={handleSubmit} style={formStyle}>
      <div style={fieldCol}> 
        <label style={labelStyle}>Origin</label>
        <input value={origin} onChange={e => setOrigin(e.target.value)} placeholder="" style={inputStyle} />
      </div>
      <div style={fieldCol}> 
        <label style={labelStyle}>Destination</label>
        <input value={destination} onChange={e => setDestination(e.target.value)} placeholder="" style={inputStyle} />
      </div>
      <div style={fieldCol}> 
        <label style={labelStyle}>Date</label>
        <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inputStyle} />
      </div>
      <div style={fieldCol}> 
        <label style={labelStyle}>Passengers</label>
        <input type="number" min={1} value={passengers} onChange={e => setPassengers(Number(e.target.value)||1)} style={inputStyle} />
      </div>
      <div style={fieldCol}>
        <label style={labelStyle}>Min Price</label>
        <input value={minPrice} onChange={e=>{const v=e.target.value; if(/^[0-9]*$/.test(v)) setMinPrice(v)}} style={inputStyle} />
      </div>
      <div style={fieldCol}>
        <label style={labelStyle}>Max Price</label>
        <input value={maxPrice} onChange={e=>{const v=e.target.value; if(/^[0-9]*$/.test(v)) setMaxPrice(v)}} style={inputStyle} />
      </div>
      <div style={fieldCol}>
        <label style={labelStyle}>Max Stops</label>
        <input value={maxStops} onChange={e=>{const v=e.target.value; if(/^[0-9]*$/.test(v)) setMaxStops(v)}} style={inputStyle} />
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end' }}>
        <button type="submit" style={submitBtn}>Search</button>
      </div>
    </form>
  )
}

const formStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
  gap: 12,
  background: 'white',
  padding: 16,
  borderRadius: 8,
  boxShadow: '0 2px 4px rgba(0,0,0,0.08)'
}

const fieldCol: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column'
}

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  textTransform: 'uppercase',
  fontWeight: 600,
  letterSpacing: '.5px',
  marginBottom: 4
}

const inputStyle: React.CSSProperties = {
  border: '1px solid #cbd5e1',
  borderRadius: 6,
  padding: '8px 10px',
  fontSize: 14,
  outline: 'none'
}

const submitBtn: React.CSSProperties = {
  background: '#1d3557',
  color: 'white',
  border: 'none',
  borderRadius: 6,
  padding: '10px 18px',
  fontSize: 14,
  cursor: 'pointer',
  fontWeight: 600,
  alignSelf: 'flex-end'
}

export default QuickSearchForm
