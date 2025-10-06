import React, { useState, useEffect } from 'react'
import { toCountryCode } from '../lib/countryCodes'
import CountryInput from './CountryInput'

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
    const originCode = toCountryCode(origin) || (origin.trim().toUpperCase() || undefined)
    const destinationCode = toCountryCode(destination) || (destination.trim().toUpperCase() || undefined)
    onSearch?.({
      origin: originCode,
      destination: destinationCode,
      date: date || undefined,
      passengers: passengers || undefined,
      min_price: minPrice ? Number(minPrice) : undefined,
      max_price: maxPrice ? Number(maxPrice) : undefined,
    })
    // Отразим нормализованные значения в UI
    if (originCode) setOrigin(originCode)
    if (destinationCode) setDestination(destinationCode)
  }

  return (
    <form onSubmit={handleSubmit} style={formStyle} className="qs-search-grid">
      <style>{quickSearchResponsiveCss}</style>
  <div className='qs-cell qs-cell-country'><CountryInput label='Origin' value={origin} onChange={setOrigin} /></div>
  <div className='qs-cell qs-cell-country'><CountryInput label='Destination' value={destination} onChange={setDestination} /></div>
      <div style={{ ...fieldCol }} className='qs-cell'> 
        <label style={labelStyle}>Date</label>
  <input type="date" value={date} onChange={e => setDate(e.target.value)} className="input" style={inputOverride} />
      </div>
      <div style={{ ...fieldCol }} className='qs-cell'> 
        <label style={labelStyle}>Passengers</label>
  <input type="number" min={1} value={passengers} onChange={e => setPassengers(Number(e.target.value)||1)} className="input" style={inputOverride} />
      </div>
      <div style={{ ...fieldCol }} className='qs-cell'>
        <label style={labelStyle}>Min Price</label>
  <input value={minPrice} onChange={e=>{const v=e.target.value; if(/^[0-9]*$/.test(v)) setMinPrice(v)}} className="input" style={inputOverride} />
      </div>
      <div style={{ ...fieldCol }} className='qs-cell'>
        <label style={labelStyle}>Max Price</label>
  <input value={maxPrice} onChange={e=>{const v=e.target.value; if(/^[0-9]*$/.test(v)) setMaxPrice(v)}} className="input" style={inputOverride} />
      </div>
      <div className='qs-cell qs-cell-submit'>
        <button type="submit" className="btn qs-search-btn" style={{ width:'100%' }}>Search</button>
      </div>
    </form>
  )
}

const formStyle: React.CSSProperties = {
  display: 'grid',
  gap: 14,
  gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
  alignItems: 'end',
  background: 'white',
  padding: '22px 24px 28px',
  borderRadius: 12,
  border: '1px solid var(--color-border)',
  boxShadow: '0 4px 18px -4px rgba(0,0,0,0.12)',
  maxWidth: 1080,
  margin: '0 auto'
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

const submitBtnOverride: React.CSSProperties = { fontSize:14 }

// CSS для адаптива: при ширине < 780px разрешаем перенос.
const quickSearchResponsiveCss = `
.qs-search-grid .qs-cell-country { min-height:118px; display:flex; flex-direction:column; justify-content:flex-start; }
.qs-search-grid .qs-cell-submit { display:flex; flex-direction:column; justify-content:flex-end; }
.qs-search-grid .qs-search-btn { padding:10px 26px; font-size:15px; font-weight:600; border-radius:24px; height:48px; }
.qs-search-grid .qs-cell input { width:100%; }
@media (max-width:900px){ .qs-search-grid { grid-template-columns: repeat(auto-fit,minmax(130px,1fr)); } }
@media (max-width:640px){ .qs-search-grid { grid-template-columns: repeat(auto-fit,minmax(120px,1fr)); padding:18px 18px 24px; } }
`

export default QuickSearchForm
