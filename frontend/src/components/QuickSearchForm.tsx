import React, { useState, useEffect } from 'react'

export interface SearchCriteria {
  origin?: string
  destination?: string
  date?: string
  passengers?: number
  min_price?: number
  max_price?: number
}

interface Props { onSearch?: (criteria: SearchCriteria) => void }

export const QuickSearchForm: React.FC<Props> = ({ onSearch }) => {
  const [origin, setOrigin] = useState('')
  const [destination, setDestination] = useState('')
  const [date, setDate] = useState('')
  const [passengers, setPassengers] = useState<number>(1)
  const [minPrice, setMinPrice] = useState('')
  const [maxPrice, setMaxPrice] = useState('')

  // Слушатель для автозаполнения (OffersGrid activation)
  useEffect(() => {
    const handler = (e: any) => {
      const d = e.detail || {}
      if (d.origin !== undefined) setOrigin(d.origin || '')
      if (d.destination !== undefined) setDestination(d.destination || '')
      if (d.date !== undefined) setDate(d.date || '')
      // Можно сразу запускать поиск
      if (d.autoSubmit) {
        onSearch?.({
          origin: (d.origin||'').trim().toUpperCase() || undefined,
          destination: (d.destination||'').trim().toUpperCase() || undefined,
          date: d.date || undefined,
        })
      }
    }
    window.addEventListener('offer_prefill', handler as any)
    return () => window.removeEventListener('offer_prefill', handler as any)
  }, [onSearch])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onSearch?.({
      origin: origin.trim().toUpperCase() || undefined,
      destination: destination.trim().toUpperCase() || undefined,
      date: date || undefined,
      passengers: passengers || undefined,
      min_price: minPrice ? Number(minPrice) : undefined,
      max_price: maxPrice ? Number(maxPrice) : undefined,
    })
  }

  return (
  <form onSubmit={handleSubmit} style={formStyle}>
      <div style={fieldCol}> 
        <label style={labelStyle}>Origin</label>
  <input value={origin} onChange={e => setOrigin(e.target.value)} placeholder="" className="input" style={inputOverride} />
      </div>
      <div style={fieldCol}> 
        <label style={labelStyle}>Destination</label>
  <input value={destination} onChange={e => setDestination(e.target.value)} placeholder="" className="input" style={inputOverride} />
      </div>
      <div style={fieldCol}> 
        <label style={labelStyle}>Date</label>
  <input type="date" value={date} onChange={e => setDate(e.target.value)} className="input" style={inputOverride} />
      </div>
      <div style={fieldCol}> 
        <label style={labelStyle}>Passengers</label>
  <input type="number" min={1} value={passengers} onChange={e => setPassengers(Number(e.target.value)||1)} className="input" style={inputOverride} />
      </div>
      <div style={fieldCol}>
        <label style={labelStyle}>Min Price</label>
  <input value={minPrice} onChange={e=>{const v=e.target.value; if(/^[0-9]*$/.test(v)) setMinPrice(v)}} className="input" style={inputOverride} />
      </div>
      <div style={fieldCol}>
        <label style={labelStyle}>Max Price</label>
  <input value={maxPrice} onChange={e=>{const v=e.target.value; if(/^[0-9]*$/.test(v)) setMaxPrice(v)}} className="input" style={inputOverride} />
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end' }}>
  <button type="submit" className="btn" style={submitBtnOverride}>Search</button>
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
  border: '1px solid var(--color-border)',
  boxShadow: '0 2px 4px rgba(0,0,0,0.03)'
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

const inputOverride: React.CSSProperties = {
  fontSize:14
}

const submitBtnOverride: React.CSSProperties = {
  fontSize:14,
  alignSelf:'flex-end'
}

export default QuickSearchForm
