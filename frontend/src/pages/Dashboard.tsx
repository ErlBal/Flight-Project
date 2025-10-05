import React, { useEffect, useState, useCallback } from 'react'
import api, { extractErrorMessage } from '../lib/api'

type Ticket = {
  confirmation_id: string
  status: string
  flight_id: number
  email: string
  purchased_at?: string
  price_paid?: number
  flight?: {
    id: number
    airline: string
    flight_number: string
    origin: string
    destination: string
    departure: string
    arrival: string
    stops?: number
  } | null
  reminders?: {
    id: number
    hours_before: number
    type: string
    scheduled_at: string
    sent: boolean
  }[]
}

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
}

export default function Dashboard() {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [userInfo, setUserInfo] = useState<{ email: string; roles: string[] } | null>(null)
  const [filterCid, setFilterCid] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 25

  // Reminder modal state
  const [modalTicket, setModalTicket] = useState<Ticket | null>(null)
  const [remOps, setRemOps] = useState(false)
  const [customInput, setCustomInput] = useState('')

  const loadTickets = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params: any = { page, page_size: PAGE_SIZE }
      if (filterCid.trim()) params.confirmation_id = filterCid.trim()
      if (filterStatus) params.status_filter = filterStatus
      const res = await api.get('/tickets/my', { params })
      // New backend format returns { items, total, page, ... }
      const payload = res.data
      const list = Array.isArray(payload)
        ? payload
        : (Array.isArray(payload?.items) ? payload.items : [])
      setTickets(list)
    } catch (err: any) {
      setError(extractErrorMessage(err?.response?.data) || 'Failed to load tickets')
    } finally {
      setLoading(false)
    }
  }, [page, filterCid, filterStatus])

  const cancel = async (id: string) => {
    try {
      // Оптимистично помечаем локально
      setTickets(ts => ts.map(t => t.confirmation_id === id ? { ...t, status: 'refunded' } : t))
      await api.post(`/tickets/${id}/cancel`)
      // Опционально можно перезагрузить позже; сейчас не вызываем loadTickets() чтобы избежать дерганий
    } catch (err: any) {
      alert(extractErrorMessage(err?.response?.data) || 'Cancel failed')
      // Rollback при ошибке (перезагрузка списка)
      await loadTickets()
    }
  }

  useEffect(() => {
  // Decode JWT (lightweight manual approach, no external libs)
    try {
      const raw = localStorage.getItem('auth_token')
      if (raw) {
        const payload = JSON.parse(atob(raw.split('.')[1]))
        setUserInfo({ email: payload.sub, roles: payload.roles || [] })
      }
    } catch {}

    loadTickets()
  }, [loadTickets])

  // Removed search form logic; flights list can be simplified or repurposed later.

  return (
    <div>
  <h2>My Flights</h2>
      {/* User info panel removed as per request */}
  <Flights
    tickets={tickets}
    reload={loadTickets}
    setModalTicket={setModalTicket}
    page={page}
    setPage={setPage}
    pageSize={PAGE_SIZE}
    filterCid={filterCid}
    setFilterCid={setFilterCid}
    filterStatus={filterStatus}
    setFilterStatus={setFilterStatus}
    loading={loading}
  />
  <ReminderModal ticket={modalTicket} onClose={()=>{ setModalTicket(null); setCustomInput('') }} refresh={loadTickets} remOps={remOps} setRemOps={setRemOps} customInput={customInput} setCustomInput={setCustomInput} />
      {loading && <p>Loading...</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {!loading && !error && tickets.length === 0 && <p>No tickets yet.</p>}
    </div>
  )
}

interface FlightsProps {
  tickets: Ticket[]
  reload: () => Promise<void>
  setModalTicket: (t: Ticket | null) => void
  page: number
  setPage: (p: number) => void
  pageSize: number
  filterCid: string
  setFilterCid: (v: string) => void
  filterStatus: string
  setFilterStatus: (v: string) => void
  loading: boolean
}

function Flights({ tickets, reload, setModalTicket, page, setPage, pageSize, filterCid, setFilterCid, filterStatus, setFilterStatus, loading }: FlightsProps) {
  // Include both future & past (sorted by departure desc for history)
  const enriched = tickets.filter(t => t.flight?.departure).map(t => ({ t, depTs: Date.parse(t.flight!.departure) }))
  enriched.sort((a,b)=> b.depTs - a.depTs)
  const start = (page - 1) * pageSize
  const slice = enriched.slice(start, start + pageSize)
  const totalPages = Math.max(1, Math.ceil(enriched.length / pageSize))

  return (
    <div style={{ margin:'12px 0' }}>
      <h3 style={{ marginTop:0 }}>Flights</h3>
      <div style={{ display:'flex', flexWrap:'wrap', gap:12, marginBottom:12 }}>
        <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
          <label style={lbl}>Confirmation</label>
          <input value={filterCid} onChange={e=>{ setFilterCid(e.target.value.toUpperCase()); setPage(1) }} placeholder='Start of ID' style={{ padding:4 }} />
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
          <label style={lbl}>Status</label>
          <select value={filterStatus} onChange={e=>{ setFilterStatus(e.target.value); setPage(1) }} style={{ padding:4 }}>
            <option value=''>All</option>
            <option value='paid'>paid</option>
            <option value='refunded'>refunded</option>
            <option value='canceled'>canceled</option>
          </select>
        </div>
        <div style={{ display:'flex', alignItems:'flex-end', gap:8 }}>
          <button disabled={loading} onClick={()=>reload()}>Apply</button>
          <button disabled={loading} onClick={()=>{ setFilterCid(''); setFilterStatus(''); setPage(1); reload() }}>Reset</button>
        </div>
        <div style={{ marginLeft:'auto', display:'flex', alignItems:'flex-end', gap:8 }}>
          <button disabled={page<=1} onClick={()=>setPage(Math.max(1, page-1))}>Prev</button>
          <span style={{ fontSize:12, opacity:.7 }}>Page {page} / {totalPages}</span>
          <button disabled={page>=totalPages} onClick={()=>setPage(Math.min(totalPages, page+1))}>Next</button>
        </div>
      </div>
      <ul style={{ listStyle:'none', padding:0, margin:0, display:'flex', flexDirection:'column', gap:10 }}>
        {slice.map(({ t, depTs }) => {
          const msLeft = depTs - Date.now()
          const past = msLeft <= 0
          return (
            <li key={t.confirmation_id} style={{ border:'1px solid #ddd', borderRadius:8, padding:10, background: past ? '#f8f9fa' : '#ffffff' }}>
              <div style={{ display:'flex', flexWrap:'wrap', justifyContent:'space-between', gap:8 }}>
                <div style={{ fontSize:14 }}>
                  <strong>{t.flight?.airline} {t.flight?.flight_number}</strong> {t.flight?.origin} → {t.flight?.destination}
                </div>
                <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                  <span style={{ fontSize:11, background:'#f1f5f9', padding:'2px 6px', borderRadius:4 }}>{t.status}</span>
                  {!past && t.status === 'paid' && (
                    <button style={{ fontSize:11, padding:'3px 8px' }} onClick={()=> setModalTicket(t)}>Reminders</button>
                  )}
                  {past && <button style={{ fontSize:11, padding:'3px 8px' }} onClick={()=>{ if(confirm('Удалить запись о рейсе из списка? (Не влияет на сервер)')) {/* local remove only */} }}>Past</button>}
                </div>
              </div>
              <div style={{ fontSize:12, opacity:.75, marginTop:4 }}>
                Dep: {t.flight ? new Date(depTs).toLocaleString() : '—'} | In: {formatRemain(msLeft)} | Ticket: {t.confirmation_id}
              </div>
            </li>
          )
        })}
        {slice.length === 0 && !loading && <li style={{ fontSize:13, opacity:.7 }}>No tickets.</li>}
      </ul>
    </div>
  )
}

// Modal for reminders
function ReminderModal({ ticket, onClose, refresh, remOps, setRemOps, customInput, setCustomInput }: {
  ticket: Ticket | null
  onClose: () => void
  refresh: () => Promise<void>
  remOps: boolean
  setRemOps: (v: boolean) => void
  customInput: string
  setCustomInput: (v: string) => void
}) {
  if (!ticket) return null
  const standardRems = (ticket.reminders||[]).filter(r=>r.type==='standard').sort((a,b)=>a.hours_before-b.hours_before)
  const custom = (ticket.reminders||[]).find(r=>r.type==='custom')
  const setReminder = async () => {
    const hours = Number(customInput)
    if (!hours || hours < 1 || hours > 240) { alert('Hours 1-240'); return }
    setRemOps(true)
    try {
      await api.post(`/tickets/${ticket.confirmation_id}/reminder`, { hours_before: hours })
      await refresh()
    } catch(e:any){ alert(extractErrorMessage(e?.response?.data) || 'Failed') } finally { setRemOps(false) }
  }
  const updateExisting = async () => { await setReminder() }
  const deleteCustom = async () => {
    if (!custom) return
    if (!confirm('Delete custom reminder?')) return
    setRemOps(true)
    try { await api.delete(`/tickets/${ticket.confirmation_id}/reminder/${custom.id}`); await refresh() } catch(e:any){ alert(extractErrorMessage(e?.response?.data) || 'Failed') } finally { setRemOps(false) }
  }
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.35)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:200 }}>
      <div style={{ background:'#fff', padding:20, borderRadius:8, width:'min(480px, 92%)', maxHeight:'80vh', overflow:'auto', boxShadow:'0 8px 28px rgba(0,0,0,.25)', display:'flex', flexDirection:'column', gap:14 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <h3 style={{ margin:0, fontSize:18 }}>Reminders</h3>
          <button onClick={onClose} style={{ fontSize:13 }}>×</button>
        </div>
        <div style={{ fontSize:13 }}>
          <strong>{ticket.flight?.airline} {ticket.flight?.flight_number}</strong> {ticket.flight?.origin} → {ticket.flight?.destination}<br />
          Departure: {ticket.flight ? new Date(ticket.flight.departure).toLocaleString() : '—'}
        </div>
        <div style={{ fontSize:12 }}>
          Standard:&nbsp;
          {standardRems.length ? standardRems.map(r=> (
            <span key={r.id} style={{ display:'inline-block', background:r.sent?'#d1fae5':'#e0f2fe', border:'1px solid #94a3b8', padding:'2px 6px', borderRadius:12, marginRight:6, marginBottom:4 }} title={r.sent? 'Sent':'Scheduled'}>{r.hours_before}h{r.sent?' ✓':''}</span>
          )) : <span style={{ opacity:.6 }}>auto scheduling...</span>}
        </div>
        <div style={{ fontSize:12 }}>
          Custom:&nbsp;
          {custom ? (
            <span style={{ display:'inline-flex', gap:6, alignItems:'center', flexWrap:'wrap' }}>
              <span style={{ background:custom.sent?'#d1fae5':'#fef9c3', border:'1px solid #facc15', padding:'2px 6px', borderRadius:12, fontSize:12 }} title={custom.sent? 'Sent':'Scheduled'}>{custom.hours_before}h{custom.sent?' ✓':''}</span>
              {!custom.sent && (
                <>
                  <input type='number' min={1} max={240} value={customInput || String(custom.hours_before)} disabled={remOps} onChange={e=>setCustomInput(e.target.value)} style={{ width:70, fontSize:12 }} />
                  <button disabled={remOps} onClick={updateExisting}>Update</button>
                </>
              )}
              <button disabled={remOps} onClick={deleteCustom}>Delete</button>
            </span>
          ) : (
            <span style={{ display:'inline-flex', gap:6, alignItems:'center' }}>
              <input type='number' min={1} max={240} value={customInput} disabled={remOps} onChange={e=>setCustomInput(e.target.value)} style={{ width:70, fontSize:12 }} />
              <button disabled={remOps} onClick={setReminder}>Add</button>
            </span>
          )}
        </div>
        <div style={{ fontSize:11, opacity:.6 }}>Standard reminders (24h & 2h) создаются автоматически. Custom — один на билет.</div>
      </div>
    </div>
  )
}

const lbl: React.CSSProperties = { fontSize:11, textTransform:'uppercase', letterSpacing:'.5px', fontWeight:600 }

function formatRemain(ms: number): string {
  if (ms <= 0) return 'departed'
  const totalMin = Math.floor(ms/60000)
  const d = Math.floor(totalMin / (60*24))
  const h = Math.floor((totalMin % (60*24))/60)
  const m = totalMin % 60
  const parts: string[] = []
  if (d) parts.push(d+'d')
  if (h) parts.push(h+'h')
  if (m && d === 0) parts.push(m+'m') // если есть дни — минуты часто излишни
  return parts.length? 'in '+parts.join(' ') : '<1m'
}
