import React, { useState, useEffect, useRef } from 'react'
import { searchCountries, toCountryCode, codeToDisplay, CountryOption } from '../lib/countryCodes'

interface Props {
  label?: string
  value: string
  placeholder?: string
  onChange: (v: string) => void
  onBlur?: () => void
  autoFocus?: boolean
}

const dropdownStyle: React.CSSProperties = {
  position: 'absolute',
  top: '100%',
  left: 0,
  right: 0,
  background: '#fff',
  border: '1px solid var(--color-border)',
  borderTop: 'none',
  borderRadius: '0 0 8px 8px',
  boxShadow: '0 6px 18px -4px rgba(0,0,0,.12)',
  zIndex: 400,
  maxHeight: 220,
  overflowY: 'auto'
}

const itemStyle: React.CSSProperties = {
  padding: '6px 10px',
  fontSize: 13,
  display: 'flex',
  justifyContent: 'space-between',
  gap: 12,
  cursor: 'pointer'
}

export default function CountryInput({ label, value, onChange, onBlur, placeholder, autoFocus }: Props){
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState(value)
  const [results, setResults] = useState<CountryOption[]>([])
  const wrapRef = useRef<HTMLDivElement|null>(null)

  useEffect(() => { setQuery(value) }, [value])

  useEffect(() => {
    if (!open) return
    setResults(searchCountries(query))
  }, [query, open])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!wrapRef.current) return
      if (!wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('mousedown', handler)
    return () => window.removeEventListener('mousedown', handler)
  }, [])

  function commit(val: string){
    const code = toCountryCode(val) || val.toUpperCase()
    onChange(code)
    setQuery(code)
    setOpen(false)
  }

  // Caption (полное название страны) будет позиционироваться абсолютно, поэтому резервируем место paddingBottom.
  const captionVisible = !!(value && value.length <= 4)
  return (
    <div style={{ position:'relative', display:'flex', flexDirection:'column', paddingBottom: captionVisible ? 20 : 20 /* фикс одинаковый */ }} ref={wrapRef}>
      {label && <label style={{ fontSize:12, fontWeight:600, textTransform:'uppercase', letterSpacing:'.5px', marginBottom:4 }}>{label}</label>}
      <input
        autoFocus={autoFocus}
        className='input'
        value={query}
        placeholder={placeholder || 'Country or code'}
        onChange={e => { setQuery(e.target.value); setOpen(true) }}
        onFocus={() => { setOpen(true) }}
        onBlur={() => { if(onBlur) setTimeout(onBlur, 0); }}
        onKeyDown={e => {
          if (e.key === 'Enter') { e.preventDefault(); commit(query) }
          if (e.key === 'Escape') { setOpen(false) }
        }}
        style={{ fontSize:14 }}
      />
      {open && results.length > 0 && (
        <div style={dropdownStyle}>
          {results.map(r => (
            <div key={r.code} style={itemStyle} onMouseDown={() => commit(r.code)}>
              <span>{r.name}</span>
              <span style={{ opacity:.6, fontSize:11 }}>{r.code}</span>
            </div>
          ))}
        </div>
      )}
      <div
        style={{
          position:'absolute',
          left:0,
          right:0,
          bottom:2,
          fontSize:11,
          lineHeight:'16px',
          opacity: captionVisible ? .7 : 0,
          visibility: captionVisible ? 'visible' : 'hidden',
          transition:'opacity .15s'
        }}
      >{captionVisible ? codeToDisplay(value) : ''}</div>
    </div>
  )
}
