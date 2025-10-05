import React, { useEffect, useState, useCallback } from 'react'
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

export const OffersGrid: React.FC<Props> = ({ limit = 9, onActivateOffer }) => {
  const [offers, setOffers] = useState<Offer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hovered, setHovered] = useState<number | null>(null)
  const [showAll, setShowAll] = useState(false)

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

  const visibleOffers = showAll ? offers : offers.slice(0, limit || 9)

  if (loading) {
    return (
  <div style={gridFixed3} className='offers-grid-3'>
        <style>{offerExtraStyles}</style>
        {Array.from({ length: Math.min(limit || 9, 9) }).map((_,i)=>(
          <div key={i} style={{ ...cardStyle, animationDelay:`${i*45}ms`, position:'relative', overflow:'hidden' }}>
            <div style={skeletonLine({ width:'70%', height:14, marginBottom:10 })} />
            <div style={skeletonLine({ width:'50%', height:10, marginBottom:14 })} />
            <div style={{ marginTop:'auto', display:'flex', gap:8 }}>
              <div style={skeletonLine({ width:60, height:18 })} />
              <div style={skeletonLine({ width:50, height:18 })} />
            </div>
          </div>
        ))}
      </div>
    )
  }
  if (error) return <div>{error}</div>
  if (!offers.length) return <div>Нет активных предложений</div>

  return (
	<div style={gridFixed3} className='offers-grid-3'>
      <style>{offerExtraStyles}</style>
      {visibleOffers.map((o, idx) => {
        const tagColor = o.tag ? tagColors[o.tag] : undefined
        const interactive = o.mode === 'interactive'
        const parsed = parseFlightRef(o.flight_ref)
        let dateLabel: string | undefined
        if (parsed.date) {
          const d = new Date(parsed.date)
          if (!isNaN(d.getTime())) dateLabel = d.toLocaleDateString('ru-RU')
          else dateLabel = parsed.date
        }
        return (
          <div
            key={o.id}
            style={{
              ...cardStyle,
              cursor: interactive ? 'pointer' : 'default',
              position: 'relative',
              transform: hovered === o.id ? 'translateY(-3px) scale(1.012)' : 'translateY(0) scale(1)',
              boxShadow: hovered === o.id ? '0 6px 18px -4px rgba(0,0,0,0.16)' : cardStyle.boxShadow,
              zIndex: hovered === o.id ? 5 : 1,
              animationDelay: `${idx * 55}ms`
            }}
            onClick={() => handleClick(o)}
            onMouseEnter={() => setHovered(o.id)}
            onMouseLeave={() => setHovered(h => h === o.id ? null : h)}
          >
            <div style={{ display:'flex', justifyContent:'space-between', gap:8, alignItems:'flex-start' }}>
              <div style={{ fontWeight:600, fontSize:14, lineHeight:1.2 }}>{o.title}</div>
              <div style={{ display:'flex', flexDirection:'column', gap:4, alignItems:'flex-end', minHeight:20 }}>
                {(parsed.origin || parsed.destination || dateLabel) && (
                  <div style={routeInfoTop}>
                    {parsed.origin && parsed.destination && <span>{parsed.origin} → {parsed.destination}</span>}
                    {parsed.origin && !parsed.destination && <span>{parsed.origin}</span>}
                    {parsed.destination && !parsed.origin && <span>{parsed.destination}</span>}
                    {dateLabel && (
                      <span style={{ marginLeft:6, fontSize:12, color:'#374151', fontWeight:500 }}>| {dateLabel}</span>
                    )}
                  </div>
                )}
                {o.tag && tagColor && (
                  <span style={{
                    ...badgeBase,
                    background: tagColor.bg,
                    color: tagColor.color
                  }}>{o.tag.replace('_',' ')}</span>
                )}
              </div>
            </div>
            {o.subtitle && <div style={subtitleStyle}>{o.subtitle}</div>}
            <div style={bottomRow}>
              {!interactive && o.mode === 'info' && (
                <span style={{ fontSize:11, color:'#0369a1' }}>i</span>
              )}
            </div>
            {o.price_from != null && (
              <span style={priceFixedSpan}>от <strong>${o.price_from}</strong></span>
            )}
            {interactive && o.flight_ref && <span style={searchFixedBtn}>Поиск</span>}
            {o.mode === 'info' && o.description && hovered === o.id && (
              <div style={tooltipBox}>{o.description}</div>
            )}
          </div>
        )
      })}
      {offers.length > (limit||9) && !showAll && (
        <button style={showAllButton} onClick={()=>setShowAll(true)}>Все</button>
      )}
      {offers.length > (limit||9) && showAll && (
        <button style={showAllButton} onClick={()=>setShowAll(false)}>Свернуть</button>
      )}
    </div>
  )
}

// Фиксированная сетка 3 колонки (до 9 элементов). Равномерное распределение ширины.
const gridFixed3: React.CSSProperties = {
  display:'grid',
  gridTemplateColumns:'repeat(3, 1fr)',
  gap:24,
  marginTop:8,
  alignItems:'stretch',
  justifyItems:'stretch',
  width:'100%',
  maxWidth: '100%',
  // Адаптив через inline <style> ниже
}

const cardStyle: React.CSSProperties = {
  background:'#fff',
  border:'1px solid #e2e8f0',
  padding:'10px 12px 12px',
  borderRadius:10,
  fontSize:13.5,
  boxShadow:'0 1px 2px rgba(0,0,0,0.04)',
  display:'flex',
  flexDirection:'column',
  gap:4,
  lineHeight:1.25,
  width:'100%',
  height:'auto',
  // Убираем maxWidth, чтобы карточка занимала всю долю 1fr
  transition:'transform .28s cubic-bezier(.4,.2,.2,1), box-shadow .32s ease',
  animation:'offerFade .55s ease backwards',
  position:'relative',
  paddingBottom:40
}

const subtitleStyle: React.CSSProperties = {
  fontSize:12,
  color:'#475569',
  lineHeight:1.35
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

const searchFixedBtn: React.CSSProperties = {
  position:'absolute',
  bottom:8,
  right:8,
  fontSize:12,
  background:'var(--color-accent)',
  color:'var(--color-accent-contrast)',
  padding:'6px 12px',
  borderRadius:6,
  fontWeight:600
}
const priceFixedSpan: React.CSSProperties = {
  position:'absolute',
  bottom:12,
  left:12,
  fontSize:12
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

const showAllButton: React.CSSProperties = {
  gridColumn:'1 / -1',
  marginTop:12,
  background:'var(--color-accent)',
  color:'var(--color-accent-contrast)',
  border:'1px solid var(--color-accent)',
  padding:'10px 18px',
  borderRadius:8,
  fontSize:14,
  cursor:'pointer',
  fontWeight:600,
  transition:'background var(--transition-fast)'
}

const routeInfoTop: React.CSSProperties = {
  fontSize:11,
  fontWeight:500,
  whiteSpace:'nowrap',
  display:'flex',
  alignItems:'center'
}

// Кнопка "Показать ещё" больше не требуется в фиксированной сетке

const offerExtraStyles = `@keyframes offerFade {0% {opacity:0; transform:translateY(10px) scale(.98);} 100% {opacity:1; transform:translateY(0) scale(1);} } @keyframes skeletonPulse {0%{background-position:0% 50%;}50%{background-position:100% 50%;}100%{background-position:0% 50%;}} @media (max-width:1000px){ .offers-grid-3 {grid-template-columns:repeat(2,1fr);} } @media (max-width:620px){ .offers-grid-3 {grid-template-columns:repeat(1,1fr);} }`;

// Skeleton helper
const skeletonLine = (cfg: Partial<React.CSSProperties>): React.CSSProperties => ({
  background: 'linear-gradient(90deg,#f1f5f9 0%,#e2e8f0 45%,#f1f5f9 100%)',
  backgroundSize: '200% 100%',
  animation: 'skeletonPulse 1.4s ease-in-out infinite',
  borderRadius:4,
  ...cfg
})

// (keyframes skeletonPulse добавлены в offerExtraStyles выше)


export default OffersGrid
