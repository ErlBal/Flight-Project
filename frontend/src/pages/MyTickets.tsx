import React, { useCallback, useEffect, useState } from 'react'
import api, { extractErrorMessage } from '../lib/api'

interface TicketFlightInfo {
  id: number
  airline: string
  flight_number: string
  origin: string
  destination: string
  departure: string
  arrival: string
  stops: number
}
interface TicketItem {
  confirmation_id: string
  status: string
  flight_id: number
  email: string
  purchased_at: string | null
  price_paid: number | null
  flight?: TicketFlightInfo | null
  reminders?: {
    id: number
    hours_before: number
    type: string
    scheduled_at: string
    sent: boolean
  }[]
}

export default function MyTickets() {
  const [tickets, setTickets] = useState<TicketItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string|null>(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [pages, setPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [searchCid, setSearchCid] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [canceling, setCanceling] = useState<Record<string, boolean>>({})
  const [toast, setToast] = useState<string|null>(null)
  const [remOps, setRemOps] = useState<Record<string, boolean>>({})
  const [customHoursInput, setCustomHoursInput] = useState<Record<string,string>>({})

  const load = useCallback(async ()=>{
    setLoading(true); setError(null)
    try {
      const params:any = { page, page_size: pageSize }
      if (searchCid.trim()) params.confirmation_id = searchCid.trim()
      if (statusFilter) params.status_filter = statusFilter
      const r = await api.get('/tickets/my', { params })
      setTickets(r.data.items || [])
      setTotal(r.data.total || 0)
      setPages(r.data.pages || 1)
    } catch(e:any){
      setError(extractErrorMessage(e?.response?.data) || 'Failed to load tickets')
    } finally { setLoading(false) }
  }, [page, pageSize, searchCid, statusFilter])

  useEffect(()=>{ load() }, [load])

  const cancelTicket = async (cid: string) => {
    if (!confirm('Cancel this ticket? (Refund if >24h)')) return
    setCanceling(c => ({ ...c, [cid]: true }))
    try {
      const r = await api.post(`/tickets/${cid}/cancel`)
      const st = r.data.status
      setToast(`Ticket ${cid} -> ${st}`)
      // refresh after cancel (status changed + seats update via ws)
      await load()
    } catch(e:any){
      alert(extractErrorMessage(e?.response?.data) || 'Cancel failed')
    } finally {
      setCanceling(c => ({ ...c, [cid]: false }))
    }
  }

  const saveCustomReminder = async (cid: string) => {
    const hoursStr = customHoursInput[cid]
    const hours = Number(hoursStr)
    if (!hoursStr || Number.isNaN(hours) || hours < 1 || hours > 240) { alert('Hours 1-240'); return }
    setRemOps(o=>({...o, [cid]: true}))
    try {
      await api.post(`/tickets/${cid}/reminder`, { hours_before: hours })
      setToast(`Reminder set ${hours}h before`)
      await load()
    } catch(e:any){
      alert(extractErrorMessage(e?.response?.data) || 'Failed to set reminder')
    } finally { setRemOps(o=>({...o, [cid]: false})) }
  }

  const deleteCustomReminder = async (cid: string, reminderId: number) => {
    if(!confirm('Delete custom reminder?')) return
    setRemOps(o=>({...o, [cid]: true}))
    try {
      await api.delete(`/tickets/${cid}/reminder/${reminderId}`)
      setToast('Reminder deleted')
      await load()
    } catch(e:any){
      alert(extractErrorMessage(e?.response?.data) || 'Failed to delete reminder')
    } finally { setRemOps(o=>({...o, [cid]: false})) }
  }

  const findCustom = (t:TicketItem) => t.reminders?.find(r=>r.type==='custom')
  const standardRems = (t:TicketItem) => (t.reminders||[]).filter(r=>r.type==='standard').sort((a,b)=>a.hours_before-b.hours_before)

  return (
    <div style={{ maxWidth:1100, margin:'0 auto', padding:'20px 20px 60px' }}>
      <h2 style={{ marginTop:0 }}>My Tickets</h2>
      <div style={{ display:'flex', gap:12, flexWrap:'wrap', marginBottom:16 }}>
        <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
          <label style={lbl}>Confirmation</label>
          <input value={searchCid} onChange={e=>setSearchCid(e.target.value.toUpperCase())} placeholder='Start of ID' />
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
          <label style={lbl}>Status</label>
          <select value={statusFilter} onChange={e=>{ setStatusFilter(e.target.value); setPage(1) }}>
            <option value=''>All</option>
            <option value='paid'>paid</option>
            <option value='refunded'>refunded</option>
            <option value='canceled'>canceled</option>
          </select>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
          <label style={lbl}>Page size</label>
          <select value={pageSize} onChange={e=>{ setPageSize(Number(e.target.value)); setPage(1) }}>
            {[10,25,50,100].map(s=> <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div style={{ display:'flex', alignItems:'flex-end', gap:8 }}>
          <button onClick={()=>{ setPage(1); load() }} disabled={loading}>Apply</button>
          <button onClick={()=>{ setSearchCid(''); setStatusFilter(''); setPage(1); load() }} disabled={loading}>Reset</button>
        </div>
      </div>
      <div style={{ display:'flex', gap:12, alignItems:'center', flexWrap:'wrap', marginBottom:12 }}>
        <button disabled={loading || page<=1} onClick={()=>setPage(p=>Math.max(1,p-1))}>Prev</button>
        <span style={{ fontSize:13 }}>Page {page} / {pages}</span>
        <button disabled={loading || page>=pages} onClick={()=>setPage(p=>Math.min(pages,p+1))}>Next</button>
        <span style={{ fontSize:12, opacity:.7 }}>Total: {total}</span>
        <button onClick={load} disabled={loading}>Reload</button>
      </div>
      {loading && <p>Loading...</p>}
      {error && <p style={{ color:'red' }}>{error}</p>}
      {!loading && !error && tickets.length===0 && <p>No tickets.</p>}
      <ul style={{ listStyle:'none', padding:0 }}>
        {tickets.map(t => (
          <li key={t.confirmation_id} style={{ border:'1px solid #ddd', padding:12, borderRadius:8, marginBottom:10 }}>
            <div style={{ display:'flex', justifyContent:'space-between', flexWrap:'wrap', gap:8 }}>
              <strong>{t.confirmation_id}</strong>
              <span style={{ fontSize:12, background:'#f1f5f9', padding:'2px 6px', borderRadius:4 }}>{t.status}</span>
            </div>
            {t.flight && (
              <div style={{ marginTop:6, fontSize:14 }}>
                {t.flight.airline} {t.flight.flight_number} — {t.flight.origin} → {t.flight.destination}
                <div style={{ fontSize:12, opacity:.75 }}>
                  Dep: {new Date(t.flight.departure).toLocaleString()} | In: {formatRemain(Date.parse(t.flight.departure) - Date.now())} | Arr: {new Date(t.flight.arrival).toLocaleString()} | Stops: {t.flight.stops}
                </div>
              </div>
            )}
            <div style={{ marginTop:6, fontSize:12, opacity:.7 }}>Purchased: {t.purchased_at? new Date(t.purchased_at).toLocaleString(): '—'} | Paid: {t.price_paid!=null? `$${t.price_paid}`:'—'}</div>
            {t.status === 'paid' && (
              <div style={{ marginTop:8 }}>
                <button disabled={canceling[t.confirmation_id]} onClick={()=>cancelTicket(t.confirmation_id)}>{canceling[t.confirmation_id]? '...':'Cancel'}</button>
              </div>
            )}
            {/* Reminders UI */}
            {t.status === 'paid' && (
              <div style={{ marginTop:12, background:'#f8fafc', padding:10, border:'1px solid #e2e8f0', borderRadius:6 }}>
                <div style={{ fontSize:12, fontWeight:600, marginBottom:6 }}>Reminders</div>
                <div style={{ fontSize:12, marginBottom:4 }}>
                  Standard: {standardRems(t).length ? standardRems(t).map(r=> (
                    <span key={r.id} style={{ display:'inline-block', background:r.sent?'#d1fae5':'#e0f2fe', border:'1px solid #94a3b8', padding:'2px 6px', borderRadius:12, marginRight:6, marginBottom:4 }} title={r.sent? 'Sent':'Scheduled'}>
                      {r.hours_before}h{r.sent?' ✓':''}
                    </span>
                  )) : <span style={{ opacity:.6 }}>auto scheduling...</span>}
                </div>
                <div style={{ fontSize:12, marginTop:4 }}>
                  Custom:
                  {(() => {
                    const c = findCustom(t)
                    if (c) {
                      return (
                        <span style={{ marginLeft:8, display:'inline-flex', alignItems:'center', gap:6 }}>
                          <span style={{ background:c.sent?'#d1fae5':'#fef9c3', border:'1px solid #facc15', padding:'2px 6px', borderRadius:12, fontSize:12 }} title={c.sent? 'Sent':'Scheduled'}>{c.hours_before}h{c.sent?' ✓':''}</span>
                          {!c.sent && <>
                            <input
                              type='number'
                              min={1}
                              max={240}
                              value={customHoursInput[t.confirmation_id] ?? String(c.hours_before)}
                              onChange={e=>setCustomHoursInput(o=>({...o, [t.confirmation_id]: e.target.value}))}
                              style={{ width:70, fontSize:12 }}
                              disabled={remOps[t.confirmation_id]}
                            />
                            <button onClick={()=>saveCustomReminder(t.confirmation_id)} disabled={remOps[t.confirmation_id]}>Update</button>
                          </>}
                          <button onClick={()=>deleteCustomReminder(t.confirmation_id, c.id)} disabled={remOps[t.confirmation_id]}>Delete</button>
                        </span>
                      )
                    }
                    return (
                      <span style={{ marginLeft:8, display:'inline-flex', alignItems:'center', gap:6 }}>
                        <input
                          type='number'
                          min={1}
                          max={240}
                          value={customHoursInput[t.confirmation_id]||''}
                          placeholder='Hours'
                          onChange={e=>setCustomHoursInput(o=>({...o, [t.confirmation_id]: e.target.value}))}
                          style={{ width:70, fontSize:12 }}
                          disabled={remOps[t.confirmation_id]}
                        />
                        <button onClick={()=>saveCustomReminder(t.confirmation_id)} disabled={remOps[t.confirmation_id]}>Add</button>
                      </span>
                    )
                  })()}
                </div>
                <div style={{ marginTop:6, fontSize:11, opacity:.6 }}>Standard reminders (24h & 2h) создаются автоматически. Custom — один на билет, можно обновить или удалить.</div>
              </div>
            )}
          </li>
        ))}
      </ul>
      {toast && (
        <div style={{ position:'fixed', bottom:20, right:20, background:'#333', color:'#fff', padding:'8px 14px', borderRadius:4 }}>
          {toast}
          <button style={{ marginLeft:10 }} onClick={()=>setToast(null)}>x</button>
        </div>
      )}
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
  if (m && d === 0) parts.push(m+'m')
  return parts.length? 'in '+parts.join(' ') : '<1m'
}
