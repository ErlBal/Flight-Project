import React, { useState } from 'react'

export interface SearchCriteria {
  origin?: string
  destination?: string
  date?: string
  passengers?: number
  min_price?: number
  max_price?: number
  max_stops?: number
}

interface Props { onSearch?: (criteria: SearchCriteria) => void }

export const QuickSearchForm: React.FC<Props> = ({ onSearch }) => {
  const [origin, setOrigin] = useState('')
  const [destination, setDestination] = useState('')
  const [date, setDate] = useState('')
  const [passengers, setPassengers] = useState<number>(1)
  const [minPrice, setMinPrice] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  const [maxStops, setMaxStops] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onSearch?.({
      origin: origin.trim().toUpperCase() || undefined,
      destination: destination.trim().toUpperCase() || undefined,
      date: date || undefined,
      passengers: passengers || undefined,
      min_price: minPrice ? Number(minPrice) : undefined,
      max_price: maxPrice ? Number(maxPrice) : undefined,
      max_stops: maxStops ? Number(maxStops) : undefined,
    })
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
