import React, { useEffect, useState, useCallback } from 'react'
import styles from '../styles/dashboard.module.css'
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
    <div className={styles.dashboardRoot + ' page-pad'}>
      <h2>My Flights</h2>
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
        setTickets={setTickets}
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
  setTickets: React.Dispatch<React.SetStateAction<Ticket[]>>
}

function Flights({ tickets, reload, setModalTicket, page, setPage, pageSize, filterCid, setFilterCid, filterStatus, setFilterStatus, loading, setTickets }: FlightsProps) {
  // Include both future & past (sorted by departure desc for history)
  const enriched = tickets.filter(t => t.flight?.departure).map(t => ({ t, depTs: Date.parse(t.flight!.departure) }))
  enriched.sort((a,b)=> b.depTs - a.depTs)
  const start = (page - 1) * pageSize
  const slice = enriched.slice(start, start + pageSize)
  const totalPages = Math.max(1, Math.ceil(enriched.length / pageSize))

  // Interval tick for live remaining-time refresh every 60s
  const [, setNowTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setNowTick(v => v + 1), 60000) // 1 minute
    return () => clearInterval(id)
  }, [])

  const removePast = (cid: string) => {
    setTickets(prev => prev.filter(t => t.confirmation_id !== cid))
  }

  return (
    <div style={{ margin:'12px 0' }}>
      <h3 style={{ marginTop:0 }}>Flights</h3>
      <div className={styles.filtersRow}>
        <div className={styles.filterGroup}>
          <label className={styles.label}>Confirmation</label>
          <input className="input" value={filterCid} onChange={e=>{ setFilterCid(e.target.value.toUpperCase()); setPage(1) }} placeholder='Start of ID' style={{ padding:'6px 8px', fontSize:13, width:160 }} />
        </div>
        <div className={styles.filterGroup}>
          <label className={styles.label}>Status</label>
          <select className="input" value={filterStatus} onChange={e=>{ setFilterStatus(e.target.value); setPage(1) }} style={{ padding:'6px 8px', fontSize:13, width:120 }}>
            <option value=''>All</option>
            <option value='paid'>paid</option>
            <option value='refunded'>refunded</option>
            <option value='canceled'>canceled</option>
          </select>
        </div>
        <div style={{ display:'flex', alignItems:'flex-end', gap:8 }}>
          <button className="btn btn-outline btn-sm" disabled={loading} onClick={()=>reload()}>Apply</button>
          <button className="btn btn-outline btn-sm" disabled={loading} onClick={()=>{ setFilterCid(''); setFilterStatus(''); setPage(1); reload() }}>Reset</button>
        </div>
        <div className={styles.pagingControls}>
          <button className="btn btn-outline btn-xs" disabled={page<=1} onClick={()=>setPage(Math.max(1, page-1))}>Prev</button>
          <span className={styles.pageInfo}>Page {page} / {totalPages}</span>
          <button className="btn btn-outline btn-xs" disabled={page>=totalPages} onClick={()=>setPage(Math.min(totalPages, page+1))}>Next</button>
        </div>
      </div>
      <ul className={styles.flightsList}>
        {slice.map(({ t, depTs }) => {
          const msLeft = depTs - Date.now()
          const past = msLeft <= 0
          const hoursLeft = msLeft / 3600000
          const urgencyHigh = !past && hoursLeft <= 2
          const urgencyMed = !past && !urgencyHigh && hoursLeft <= 24
          const itemClass = [styles.flightItem, past ? styles.flightPast : '', urgencyHigh ? styles.urgencyHigh : '', urgencyMed ? styles.urgencyMedium : ''].filter(Boolean).join(' ')
          const remainText = formatRemain(msLeft)
          const canOpen = !past && t.status === 'paid'
          return (
            <li
              key={t.confirmation_id}
              className={itemClass}
              style={canOpen ? { cursor: 'pointer' } : undefined}
              onClick={() => { if (canOpen) setModalTicket(t) }}
              title={canOpen ? 'Click to manage reminders' : undefined}
            >
              <div className={styles.flightHeader}>
                <div style={{ fontSize:14 }}>
                  <strong>{t.flight?.airline} {t.flight?.flight_number}</strong> {t.flight?.origin} → {t.flight?.destination}
                </div>
                <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                  <span className={styles.statusBadge}>{t.status}</span>
                  {past && (
                    <button
                      className="btn btn-outline btn-xs"
                      onClick={(e) => { e.stopPropagation(); if (confirm('Удалить запись о рейсе из списка? (Не влияет на сервер)')) removePast(t.confirmation_id) }}
                    >Remove</button>
                  )}
                </div>
              </div>
              <div className={styles.flightMeta}>
                Dep: {t.flight ? new Date(depTs).toLocaleString() : '—'} | <span className={(urgencyHigh? styles.urgencyTextHigh : urgencyMed? styles.urgencyTextMedium : '')}>In: {remainText}</span> | Ticket: {t.confirmation_id}
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
    <div className={styles.modalBackdrop}>
      <div className={styles.modalPanel}>
        <div className={styles.modalHeader}>
          <h3 style={{ margin:0, fontSize:18 }}>Reminders</h3>
          <button onClick={onClose} className="btn btn-outline btn-xs" style={{ padding:'4px 8px', fontSize:13, lineHeight:1 }}>×</button>
        </div>
        <div style={{ fontSize:13 }}>
          <strong>{ticket.flight?.airline} {ticket.flight?.flight_number}</strong> {ticket.flight?.origin} → {ticket.flight?.destination}<br />
          Departure: {ticket.flight ? new Date(ticket.flight.departure).toLocaleString() : '—'}
        </div>
        <div style={{ fontSize:12 }}>
          Standard:&nbsp;
          {standardRems.length ? standardRems.map(r=> (
            <span key={r.id} className={r.sent ? `${styles.stdRemBadge} ${styles.stdRemBadgeSent}` : styles.stdRemBadge} title={r.sent? 'Sent':'Scheduled'}>{r.hours_before}h{r.sent?' ✓':''}</span>
          )) : <span style={{ opacity:.6 }}>auto scheduling...</span>}
        </div>
        <div style={{ fontSize:12 }}>
          Custom:&nbsp;
          {custom ? (
            <span className={styles.customInline}>
              <span title={custom.sent? 'Sent':'Scheduled'} style={{ fontWeight:500, padding:'0 2px' }}>{custom.hours_before}h{custom.sent?' ✓':''}</span>
              {!custom.sent && (
                <>
                  <input type='number' min={1} max={240} value={customInput || String(custom.hours_before)} disabled={remOps} onChange={e=>setCustomInput(e.target.value)} className={styles.numberInputSmall + ' input'} style={{ padding:'4px 6px' }} />
                  <button disabled={remOps} onClick={updateExisting} className="btn btn-outline btn-sm">Update</button>
                </>
              )}
              <button disabled={remOps} onClick={deleteCustom} className="btn btn-outline btn-sm">Delete</button>
            </span>
          ) : (
            <span className={styles.customInline}>
              <input type='number' min={1} max={240} value={customInput} disabled={remOps} onChange={e=>setCustomInput(e.target.value)} className={styles.numberInputSmall + ' input'} style={{ padding:'4px 6px' }} />
              <button disabled={remOps} onClick={setReminder} className="btn btn-outline btn-sm">Add</button>
            </span>
          )}
        </div>
        <div className={styles.infoNote}>Standard reminders (24h & 2h) создаются автоматически. Custom — один на билет.</div>
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
