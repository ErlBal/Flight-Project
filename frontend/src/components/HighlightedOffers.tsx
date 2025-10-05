import React, { useEffect, useState } from 'react'
import api from '../lib/api'

export interface OfferItem {
  id: number
  title: string
  subtitle?: string | null
  price_from?: number | null
  flight_ref?: string | null
  position: number
}

interface Props {
  limit?: number
}

export const HighlightedOffers: React.FC<Props> = ({ limit = 6 }) => {
  const [offers, setOffers] = useState<OfferItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    setLoading(true)
    api.get('/content/offers')
      .then(r => {
        if (!mounted) return
        const items: OfferItem[] = r.data || []
        setOffers(limit ? items.slice(0, limit) : items)
        setLoading(false)
      })
      .catch(() => {
        if (!mounted) return
        setError('Failed to load offers')
        setLoading(false)
      })
    return () => { mounted = false }
  }, [limit])

  if (loading) return <div>Loading offers…</div>
  if (error) return <div>{error}</div>
  if (!offers.length) return <div>No offers</div>

  return (
    <div style={gridStyle}>
      {offers.map(o => (
        <div key={o.id} style={cardStyle}>
          <div style={{ fontWeight: 600 }}>{o.title}</div>
          {o.subtitle && <div style={{ fontSize: 12, color: '#475569', marginTop: 4 }}>{o.subtitle}</div>}
          <div style={{ marginTop: 8, fontSize: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            {o.price_from != null && <span>from <strong>${o.price_from}</strong></span>}
            {o.flight_ref && <a href={`/search?ref=${encodeURIComponent(o.flight_ref)}`} style={linkBtn}>View</a>}
          </div>
        </div>
      ))}
    </div>
  )
}

const gridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
  gap: 12,
  marginTop: 12
}

const cardStyle: React.CSSProperties = {
  background: 'white',
  border: '1px solid #e2e8f0',
  padding: '10px 12px',
  borderRadius: 8,
  fontSize: 14,
  boxShadow: '0 1px 2px rgba(0,0,0,0.06)'
}

const linkBtn: React.CSSProperties = {
  fontSize: 12,
  textDecoration: 'none',
  background: '#1d3557',
  color: 'white',
  padding: '4px 10px',
  borderRadius: 6
}

export default HighlightedOffers
