import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'

interface Props {
  onSubmit?: () => void
}

export const QuickSearchForm: React.FC<Props> = ({ onSubmit }) => {
  const nav = useNavigate()
  const [origin, setOrigin] = useState('')
  const [destination, setDestination] = useState('')
  const [date, setDate] = useState('')
  const [passengers, setPassengers] = useState(1)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const params = new URLSearchParams()
    if (origin) params.set('origin', origin)
    if (destination) params.set('destination', destination)
    if (date) params.set('departure_date', date)
    params.set('passengers', String(passengers))
    nav(`/search?${params.toString()}`)
    onSubmit?.()
  }

  return (
    <form onSubmit={handleSubmit} style={formStyle}>
      <div style={fieldCol}> 
        <label style={labelStyle}>Origin</label>
        <input value={origin} onChange={e => setOrigin(e.target.value)} placeholder="ALA" style={inputStyle} />
      </div>
      <div style={fieldCol}> 
        <label style={labelStyle}>Destination</label>
        <input value={destination} onChange={e => setDestination(e.target.value)} placeholder="NQZ" style={inputStyle} />
      </div>
      <div style={fieldCol}> 
        <label style={labelStyle}>Date</label>
        <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inputStyle} />
      </div>
      <div style={fieldCol}> 
        <label style={labelStyle}>Passengers</label>
        <input type="number" min={1} value={passengers} onChange={e => setPassengers(Number(e.target.value)||1)} style={inputStyle} />
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
