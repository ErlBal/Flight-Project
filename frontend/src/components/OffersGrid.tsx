import React, { useEffect, useState, useCallback, useRef } from 'react'
import api from '../lib/api'

export interface Offer {
  id: number
  title: string
  subtitle?: string | null
  price_from?: number | null
  flight_ref?: string | null
  position: number
  tag?: string | null
  mode: 'interactive' | 'info'
  description?: string | null
  click_count?: number
}

interface ActivatePayload {
  origin?: string
  destination?: string
  date?: string
}

interface Props {
  limit?: number
  onActivateOffer?: (criteria: ActivatePayload) => void
}

const tagColors: Record<string, { bg: string; color: string }> = {
  sale: { bg: '#fee2e2', color: '#b91c1c' },
  new: { bg: '#dcfce7', color: '#15803d' },
  last_minute: { bg: '#fef3c7', color: '#b45309' },
  info: { bg: '#e0f2fe', color: '#0369a1' },
}

const parseFlightRef = (ref?: string | null): ActivatePayload => {
  if (!ref) return {}
  // Форматы: AAA | AAA-BBB | AAA-BBB@YYYY-MM-DD
  const m = ref.match(/^([A-Z]{3})(?:-([A-Z]{3})(?:@(\d{4}-\d{2}-\d{2}))?)?$/)
  if (!m) return {}
  const [, origin, destination, date] = m
  return { origin, destination, date }
}

export const OffersGrid: React.FC<Props> = ({ limit = 6, onActivateOffer }) => {
  const [offers, setOffers] = useState<Offer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hovered, setHovered] = useState<number | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [columns, setColumns] = useState(0)
  const [expanded, setExpanded] = useState(false)
  const ROWS_INITIAL = 2

  const load = useCallback(() => {
    setLoading(true); setError(null)
    api.get('/content/offers')
      .then(r => {
        const items: Offer[] = r.data || []
        setOffers(limit ? items.slice(0, limit) : items)
      })
      .catch(() => setError('Не удалось загрузить предложения'))
      .finally(() => setLoading(false))
  }, [limit])

  useEffect(() => { load() }, [load])

  const handleClick = (o: Offer) => {
    // Инкремент клика (fire & forget)
    api.post(`/content/offers/${o.id}/click`).catch(()=>{})
    if (o.mode === 'interactive') {
      const parsed = parseFlightRef(o.flight_ref)
      onActivateOffer?.(parsed)
    } else {
      // info режим: просто показываем tooltip по hover; клик тоже фиксируем.
    }
  }

  // Подсчёт примерного количества колонок для ограничения числа карточек при свернутом состоянии
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const compute = () => {
      const w = el.clientWidth
      // 170 (min) + 12 (gap) => условная ширина блока
      const cols = Math.max(1, Math.floor((w + 12) / 182))
      setColumns(cols)
    }
    compute()
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(compute) : undefined
    ro?.observe(el)
    window.addEventListener('resize', compute)
    return () => {
      window.removeEventListener('resize', compute)
      ro?.disconnect()
    }
  }, [offers.length])

  const visibleCount = expanded
    ? offers.length
    : (columns > 0 ? Math.min(offers.length, columns * ROWS_INITIAL) : Math.min(offers.length, limit || offers.length))
  const visibleOffers = offers.slice(0, visibleCount)
  const hasMore = offers.length > visibleOffers.length

  if (loading) return <div>Загрузка предложений…</div>
  if (error) return <div>{error}</div>
  if (!offers.length) return <div>Нет активных предложений</div>

  return (
    <div ref={containerRef} style={gridStyle}>
      <style>{offerExtraStyles}</style>
      {visibleOffers.map((o, idx) => {
        const tagColor = o.tag ? tagColors[o.tag] : undefined
        const interactive = o.mode === 'interactive'
        return (
          <div
            key={o.id}
            style={{
              ...cardStyle,
              cursor: interactive ? 'pointer' : 'default',
              position: 'relative',
              transform: hovered === o.id ? 'translateY(-2px) scale(1.025)' : 'translateY(0) scale(1)',
              boxShadow: hovered === o.id ? '0 6px 20px -6px rgba(0,0,0,0.18)' : cardStyle.boxShadow,
              animationDelay: `${idx * 55}ms`
            }}
            onClick={() => handleClick(o)}
            onMouseEnter={() => setHovered(o.id)}
            onMouseLeave={() => setHovered(h => h === o.id ? null : h)}
          >
            <div style={{ display:'flex', justifyContent:'space-between', gap:8 }}>
              <div style={{ fontWeight:600, fontSize:14, lineHeight:1.2 }}>{o.title}</div>
              {o.tag && tagColor && (
                <span style={{
                  ...badgeBase,
                  background: tagColor.bg,
                  color: tagColor.color
                }}>{o.tag.replace('_',' ')}</span>
              )}
            </div>
            {o.subtitle && <div style={subtitleStyle}>{o.subtitle}</div>}
            <div style={bottomRow}>
              {o.price_from != null && <span style={{ fontSize:11 }}>от <strong>${o.price_from}</strong></span>}
              {interactive && o.flight_ref && <span style={viewLink}>Поиск</span>}
              {!interactive && o.mode === 'info' && (
                <span style={{ fontSize:11, color:'#0369a1' }}>i</span>
              )}
            </div>
            {o.mode === 'info' && o.description && hovered === o.id && (
              <div style={tooltipBox}>{o.description}</div>
            )}
          </div>
        )
      })}
      {hasMore && (
        <button onClick={() => setExpanded(v => !v)} style={showMoreButton}>
          {expanded ? 'Скрыть' : 'Показать ещё'}
        </button>
      )}
    </div>
  )
}

// Сетка с ограничением максимальной ширины трека, чтобы карточки не растягивались чрезмерно при малом количестве.
const gridStyle: React.CSSProperties = {
  display:'grid',
  gridTemplateColumns:'repeat(auto-fit, minmax(170px, 230px))',
  gap:12,
  marginTop:8,
  alignItems:'start',
  justifyContent:'start'
}

const cardStyle: React.CSSProperties = {
  background:'#fff',
  border:'1px solid #e2e8f0',
  padding:'6px 8px 8px',
  borderRadius:10,
  fontSize:12.5,
  boxShadow:'0 1px 2px rgba(0,0,0,0.04)',
  display:'flex',
  flexDirection:'column',
  gap:4,
  lineHeight:1.25,
  width:'100%',
  height:'auto',
  maxWidth:230,
  transition:'transform .28s cubic-bezier(.4,.2,.2,1), box-shadow .32s ease',
  animation:'offerFade .55s ease backwards'
}

const subtitleStyle: React.CSSProperties = {
  fontSize:10.5,
  color:'#475569',
  lineHeight:1.25
}

const bottomRow: React.CSSProperties = {
  marginTop:'auto',
  display:'flex',
  alignItems:'center',
  justifyContent:'space-between',
  fontSize:10.5,
  gap:6
}

const badgeBase: React.CSSProperties = {
  fontSize:10,
  padding:'2px 6px',
  borderRadius:12,
  fontWeight:600,
  textTransform:'uppercase',
  letterSpacing:'.5px'
}

const viewLink: React.CSSProperties = {
  fontSize:11,
  background:'#1d3557',
  color:'#fff',
  padding:'3px 8px',
  borderRadius:6
}

const tooltipBox: React.CSSProperties = {
  position:'absolute',
  top:4,
  right:4,
  zIndex:20,
  background:'#0f172a',
  color:'#f1f5f9',
  padding:'8px 10px',
  fontSize:11,
  maxWidth:220,
  borderRadius:6,
  boxShadow:'0 4px 12px rgba(0,0,0,0.25)'
}

const showMoreButton: React.CSSProperties = {
  gridColumn:'1 / -1',
  marginTop:4,
  background:'#1d3557',
  color:'#fff',
  border:'none',
  borderRadius:8,
  padding:'8px 14px',
  fontSize:13,
  cursor:'pointer',
  fontWeight:600
}

const offerExtraStyles = `@keyframes offerFade {0% {opacity:0; transform:translateY(10px) scale(.98);} 100% {opacity:1; transform:translateY(0) scale(1);} }`;

export default OffersGrid
