import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
// import BannerSlider from '../components/BannerSlider'
import QuickSearchForm, { SearchCriteria } from '../components/QuickSearchForm'
import OffersGrid from '../components/OffersGrid'
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
  duration_minutes?: number
}

export default function Landing() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string|null>(null)
  const [flights, setFlights] = useState<Flight[]>([])
  const [buying, setBuying] = useState<Record<number, boolean>>({})
  const [quantities, setQuantities] = useState<Record<number, number>>({})
  const [toast, setToast] = useState<string|null>(null)
  const [authed, setAuthed] = useState(false)
  const [prefill, setPrefill] = useState<{origin?: string; destination?: string; date?: string}>({})

  useEffect(() => {
    // simple auth presence check
    setAuthed(!!localStorage.getItem('auth_token'))
    const listener = () => setAuthed(!!localStorage.getItem('auth_token'))
    window.addEventListener('storage', listener)
    return () => window.removeEventListener('storage', listener)
  }, [])

  async function runSearch(criteria: SearchCriteria){
    if (!criteria.origin && !criteria.destination && !criteria.date) { setFlights([]); return }
    setLoading(true); setError(null)
    try {
      const r = await api.get('/flights/', { params: criteria })
      setFlights(r.data.items || [])
    } catch(e:any){
      setError(extractErrorMessage(e?.response?.data) || 'Search failed')
    } finally { setLoading(false) }
  }

  const buy = async (flightId: number) => {
    if (!authed) return // guard; button disabled anyway
    if (buying[flightId]) return
    setBuying(b => ({ ...b, [flightId]: true }))
    try {
      const quantity = quantities[flightId] || 1
      const res = await api.post('/tickets', { flight_id: flightId, quantity })
      if (res.data.confirmation_ids) setToast(`Purchased ${res.data.quantity} ticket(s)`) 
      else setToast('Ticket purchased')
    } catch(e:any){
      const msg = extractErrorMessage(e?.response?.data) || 'Purchase failed'
      if (/unauth/i.test(msg) || /auth/i.test(msg)) setAuthed(false)
      alert(msg)
    } finally { setBuying(b => ({ ...b, [flightId]: false })) }
  }

  // Реалтайм слушатель seats
  useEffect(() => {
    const handler = (e: any) => {
      const d = e.detail
      if (!d || typeof d.flight_id !== 'number') return
      setFlights(fs => fs.map(f => f.id === d.flight_id ? { ...f, seats_available: d.seats_available } : f))
    }
    window.addEventListener('flight_seats_update', handler as any)
    return () => window.removeEventListener('flight_seats_update', handler as any)
  }, [])

  const [sideBanners, setSideBanners] = useState<any[]>([])
  const [leftActive, setLeftActive] = useState(0)
  const [rightActive, setRightActive] = useState(0)

  useEffect(() => {
    api.get('/content/banners').then(r => {
      const arr = Array.isArray(r.data) ? r.data : []
      setSideBanners(arr)
    }).catch(()=>{})
  }, [])

  // Разбивка списков для левой/правой колонок
  const leftSet: any[] = []
  const rightSet: any[] = []
  if (sideBanners.length <= 1) {
    leftSet.push(...sideBanners)
  } else if (sideBanners.length === 2) {
    leftSet.push(sideBanners[0]); rightSet.push(sideBanners[1])
  } else {
    // >=3 -> делим по чётности индекса для разнообразия
    sideBanners.forEach((b, i) => { (i % 2 === 0 ? leftSet : rightSet).push(b) })
    // если одна колонка получилась пустой (теоретически при length==3 даёт 2/1 - норм)
    if (!rightSet.length) { rightSet.push(...leftSet.splice(Math.ceil(leftSet.length/2))) }
  }

  useEffect(() => {
    if (!leftSet.length && !rightSet.length) return
    const iv = setInterval(() => {
      if (leftSet.length) setLeftActive(i => (i + 1) % leftSet.length)
      if (rightSet.length) setRightActive(i => (i + 1) % rightSet.length)
    }, 15000)
    return () => clearInterval(iv)
  }, [sideBanners])

  return (
    <div style={{ width:'100%', minHeight:'100vh', background:'#fcfdff' }}>
      <style>{responsiveStyles}</style>
      <div style={outerShell}>
        <div className='lp-left-rail' style={leftRail}>
          {leftSet.map((b:any, idx:number) => {
            const active = idx === leftActive
            return (
              <a key={b.id+':L'} href={b.link_url || '#'} className='rail-banner' style={{ ...railBanner, ...(active? railBannerActive:{} ) }} title={b.title}>
                {b.image_url ? <img loading="lazy" src={b.image_url} alt={b.title} style={bannerImg} /> : b.title}
              </a>
            )
          })}
        </div>

        <main className='lp-center-main' style={centerMain}>
          <header style={heroHeader}>
            <div style={{ flex: 1 }}>
              <h1 style={titleStyle}>FlightProject</h1>
              <p style={subtitleStyle}>Search, compare and book flights quickly.</p>
            </div>
          </header>

          <section>
            <h2 style={sectionTitle}>Quick search</h2>
            <QuickSearchForm onSearch={runSearch} />
            <div style={resultsWrapper}>
              <div style={resultsHeaderRow}>
                <span style={{ fontSize:13, fontWeight:600 }}>Results</span>
                {loading && <span style={{ fontSize:11 }}>Loading…</span>}
                {!loading && flights.length>0 && <span style={{ fontSize:11, opacity:.7 }}>{flights.length} found</span>}
              </div>
              {error && <div style={errorBox}>{error}</div>}
              {!error && !loading && flights.length===0 && <div style={emptyBox}>No flights</div>}
              <ul style={resultsList}>
                {flights.slice(0,50).map(f => (
                  <li key={f.id} style={resultItem}>
                    <div style={resultTopRow}>
                      <strong style={{ fontSize:13 }}>{f.airline} {f.flight_number}</strong>
                    </div>
                    <div style={routeLine}>{f.origin} → {f.destination}</div>
                      <div style={timeLine}>Dep {new Date(f.departure).toLocaleString()} | Arr {new Date(f.arrival).toLocaleString()}</div>
                      <div style={metaLine}>{(() => {
                        const stopsLabel = f.stops === 0 ? 'Direct' : `${f.stops} stop${f.stops>1?'s':''}`
                        const mins = typeof f.duration_minutes === 'number' ? f.duration_minutes : Math.max(0, Math.round((new Date(f.arrival).getTime() - new Date(f.departure).getTime())/60000))
                        const h = Math.floor(mins/60); const m = mins%60
                        const durStr = h>0 ? `${h}h ${m}m` : `${m}m`
                        return `${stopsLabel} • ${durStr}`
                      })()}</div>
                    <div style={actionRow}>
                      <span style={priceTag}>${f.price}</span>
                      <span style={seatsTag}>Seats: {f.seats_available}</span>
                      <input
                        type='number'
                        min={1}
                        max={Math.min(10, f.seats_available)}
                        value={quantities[f.id] || 1}
                        onChange={e=>setQuantities(q=>({ ...q, [f.id]: Math.max(1, Math.min(10, Number(e.target.value)||1)) }))}
                        style={qtyInput}
                        disabled={f.seats_available<=0}
                      />
                      <button
                        onClick={()=>buy(f.id)}
                        disabled={!authed || f.seats_available<=0 || buying[f.id]}
                        style={{ ...buyBtn, background: !authed ? '#64748b' : buyBtn.background, cursor: !authed ? 'not-allowed' : 'pointer', opacity: (!authed || buying[f.id]) ? 0.8 : 1 }}
                        title={!authed ? 'Login to purchase tickets' : undefined}
                      >{!authed ? 'Login to buy' : (buying[f.id]?'...':'Buy')}</button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <section style={{ marginTop: 56 }}>
            <div style={sectionHeaderRow}>
              <h2 style={sectionTitle}>Предложения</h2>
              <a href='/?date=' style={smallLink}>Сбросить поиск</a>
            </div>
            <OffersGrid
              limit={6}
              onActivateOffer={(c)=>{
                const evt = new CustomEvent('offer_prefill', { detail: { ...c, autoSubmit: true } })
                window.dispatchEvent(evt)
              }}
            />
          </section>
        </main>

        <div className='lp-right-rail' style={rightRail}>
          {rightSet.map((b:any, idx:number) => {
            const active = idx === rightActive
            return (
              <a key={b.id+':R'} href={b.link_url || '#'} className='rail-banner' style={{ ...railBanner, ...(active? railBannerActive:{} ) }} title={b.title}>
                {b.image_url ? <img loading="lazy" src={b.image_url} alt={b.title} style={bannerImg} /> : b.title}
              </a>
            )
          })}
        </div>
      </div>

      {toast && (
        <div style={{ position:'fixed', bottom:20, right:20, background:'#333', color:'#fff', padding:'8px 14px', borderRadius:4, fontSize:13 }}>
          {toast}
          <button style={{ marginLeft:10 }} onClick={()=>setToast(null)}>x</button>
        </div>
      )}
    </div>
  )
}

// Новый каркас
const outerShell: React.CSSProperties = { display:'grid', gridTemplateColumns:'minmax(0,1fr) minmax(auto,1320px) minmax(0,1fr)', gap:0, width:'100%', margin:'0 auto', padding:'0 16px' }
const centerMain: React.CSSProperties = { padding:'32px 40px 80px', position:'relative' }
const leftRail: React.CSSProperties = { display:'flex', flexDirection:'column', gap:32, alignItems:'flex-start', paddingTop:48 }
const rightRail: React.CSSProperties = { display:'flex', flexDirection:'column', gap:32, alignItems:'flex-end', paddingTop:48 }
const railBanner: React.CSSProperties = { width:200, height:260, background:'#f1f5f9', border:'1px solid #e2e8f0', borderRadius:12, overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center', position:'relative', transition:'all .6s ease', opacity:.7 }
const railBannerActive: React.CSSProperties = { opacity:1, transform:'translateY(-4px)', boxShadow:'0 6px 28px -4px rgba(0,0,0,0.18)', background:'#fff' }
const bannerImg: React.CSSProperties = { width:'100%', height:'100%', objectFit:'cover' }

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

// Results styles
const resultsWrapper: React.CSSProperties = {
  marginTop:16,
  background:'#fff',
  border:'1px solid #e2e8f0',
  borderRadius:8,
  padding:12,
  boxShadow:'0 1px 2px rgba(0,0,0,0.05)',
  maxHeight:260,
  display:'flex',
  flexDirection:'column'
}
const resultsHeaderRow: React.CSSProperties = { display:'flex', gap:10, alignItems:'baseline' }
const errorBox: React.CSSProperties = { color:'#b91c1c', fontSize:12, padding:'4px 6px', background:'#fef2f2', border:'1px solid #fecaca', borderRadius:4 }
const emptyBox: React.CSSProperties = { fontSize:12, opacity:.6, padding:'2px 4px' }
const resultsList: React.CSSProperties = { listStyle:'none', padding:0, margin:'8px 0 0', overflowY:'auto', display:'flex', flexDirection:'column', gap:8 }
const resultItem: React.CSSProperties = { border:'1px solid #e2e8f0', borderRadius:6, padding:8, background:'#f8fafc' }
const resultTopRow: React.CSSProperties = { display:'flex', justifyContent:'space-between', alignItems:'center', gap:8 }
const routeLine: React.CSSProperties = { fontSize:12, marginTop:2 }
const timeLine: React.CSSProperties = { fontSize:10, opacity:.7, marginTop:2 }
const metaLine: React.CSSProperties = { fontSize:10, opacity:.75, marginTop:2 }
const actionRow: React.CSSProperties = { display:'flex', gap:6, alignItems:'center', marginTop:6, flexWrap:'wrap' }
const priceTag: React.CSSProperties = { fontWeight:600, fontSize:13 }
const seatsTag: React.CSSProperties = { fontSize:11 }
const qtyInput: React.CSSProperties = { width:54, fontSize:12, padding:'3px 4px', border:'1px solid #cbd5e1', borderRadius:4 }
const buyBtn: React.CSSProperties = { fontSize:12, background:'#1d3557', color:'#fff', border:'none', borderRadius:4, padding:'5px 10px', cursor:'pointer' }

// Инлайновый <style> для адаптива
const responsiveStyles = `@media (max-width:1400px){ .lp-left-rail, .lp-right-rail{display:none;} .lp-center-main{padding:32px 24px 72px;} } @media (max-width:900px){ .lp-center-main h1{font-size:38px;} }
@keyframes railFadeIn{0%{opacity:0;transform:translateY(12px);}100%{opacity:1;transform:translateY(0);} }
.rail-banner{animation:railFadeIn .6s ease;}
`;
