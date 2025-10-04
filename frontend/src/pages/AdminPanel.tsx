import React, { useEffect, useState } from 'react'
import api, { extractErrorMessage } from '../lib/api'

type AdminUser = { id: number; email: string; full_name: string; role: string; is_active: boolean }

type Tab = 'users' | 'managers' | 'stats' | 'banners'

type Company = { id: number; name: string; is_active: boolean }

export default function AdminPanel() {
  const [tab, setTab] = useState<Tab>('users')
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      <h2>Admin Panel</h2>
      <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
        {(['users','managers','stats','banners'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding:'6px 12px',
            border: '1px solid ' + (tab===t?'#444':'#bbb'),
            background: tab===t? '#444':'#f8f8f8',
            color: tab===t? '#fff':'#222',
            borderRadius:4,
            cursor:'pointer'
          }}>{t === 'managers' ? 'managers' : t}</button>
        ))}
      </div>
      {tab === 'users' && <UsersSection />}
      {tab === 'managers' && <CompaniesSection />}
      {tab === 'stats' && <StatsSection />}
      {tab === 'banners' && (
        <div style={{ opacity:.7, fontSize:14 }}>Раздел "{tab}" ещё не реализован — следующий шаг.</div>
      )}
    </div>
  )
}

function UsersSection() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actioning, setActioning] = useState<Record<number, boolean>>({})
  const [refreshTick, setRefreshTick] = useState(0)

  useEffect(() => { load() }, [refreshTick])

  const load = async () => {
    setLoading(true); setError(null)
    try {
      const r = await api.get('/admin/users')
      setUsers(r.data || [])
    } catch(e:any){
      setError(extractErrorMessage(e?.response?.data) || 'Failed to load users')
    } finally { setLoading(false) }
  }

  const toggleActive = async (u: AdminUser) => {
    setActioning((a: Record<number, boolean>) => ({ ...a, [u.id]: true }))
    try {
      if (u.is_active) {
        await api.post(`/admin/users/${u.id}/block`)
      } else {
        await api.post(`/admin/users/${u.id}/unblock`)
      }
  setRefreshTick((x:number) => x+1)
    } catch(e:any) {
      alert(extractErrorMessage(e?.response?.data) || 'Action failed')
    } finally {
  setActioning((a: Record<number, boolean>) => ({ ...a, [u.id]: false }))
    }
  }

  return (
    <div style={{ border:'1px solid #ddd', borderRadius:6, padding:12 }}>
      <h3 style={{ marginTop:0 }}>Users</h3>
      {loading && <p>Loading...</p>}
      {error && <p style={{ color:'red' }}>{error}</p>}
      {!loading && !error && users.length === 0 && <p>No users yet.</p>}
      {!loading && !error && users.length > 0 && (
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:14 }}>
            <thead>
              <tr style={{ textAlign:'left', background:'#fafafa' }}>
                <th style={th}>Email</th>
                <th style={th}>Name</th>
                <th style={th}>Role</th>
                <th style={th}>Active</th>
                <th style={th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} style={{ borderTop:'1px solid #eee' }}>
                  <td style={td}>{u.email}</td>
                  <td style={td}>{u.full_name}</td>
                  <td style={td}>{u.role}</td>
                  <td style={td}>{u.is_active ? 'Yes' : 'No'}</td>
                  <td style={{ ...td }}>
                    <button
                      disabled={actioning[u.id]}
                      onClick={() => toggleActive(u)}
                      style={{ padding:'4px 10px', fontSize:12 }}
                    >{actioning[u.id] ? '...' : (u.is_active ? 'Block' : 'Unblock')}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div style={{ marginTop:10, display:'flex', gap:8 }}>
        <button onClick={load} disabled={loading}>Reload</button>
      </div>
    </div>
  )
}

const th: React.CSSProperties = { padding:'6px 8px', fontWeight:600, borderBottom:'1px solid #ddd' }
const td: React.CSSProperties = { padding:'6px 8px', verticalAlign:'top' }

function CompaniesSection() {
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [managerEmail, setManagerEmail] = useState('')
  const [assigning, setAssigning] = useState<Record<number, boolean>>({})
  const [deactivating, setDeactivating] = useState<Record<number, boolean>>({})
  const [refreshTick, setRefreshTick] = useState(0)

  useEffect(() => { load() }, [refreshTick])

  const load = async () => {
    setLoading(true); setError(null)
    try {
      const r = await api.get('/admin/companies')
      setCompanies(r.data || [])
    } catch(e:any){
      setError(extractErrorMessage(e?.response?.data) || 'Failed to load companies')
    } finally { setLoading(false) }
  }

  const createCompany = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newName.trim()) return
    setCreating(true)
    try {
      await api.post('/admin/companies', { name: newName.trim() })
      setNewName('')
      setRefreshTick(x => x+1)
    } catch(e:any){
      alert(extractErrorMessage(e?.response?.data) || 'Create failed')
    } finally { setCreating(false) }
  }

  const assignManager = async (companyId: number) => {
    if (!managerEmail.trim()) return
    setAssigning(a => ({ ...a, [companyId]: true }))
    try {
      await api.post(`/admin/companies/${companyId}/assign-manager`, { email: managerEmail.trim().toLowerCase() })
      setManagerEmail('')
    } catch(e:any){
      alert(extractErrorMessage(e?.response?.data) || 'Assign failed')
    } finally { setAssigning(a => ({ ...a, [companyId]: false })) }
  }

  const deactivate = async (companyId: number) => {
    if (!confirm('Deactivate this company?')) return
    setDeactivating(d => ({ ...d, [companyId]: true }))
    try {
      await api.post(`/admin/companies/${companyId}/deactivate`)
      setRefreshTick(x => x+1)
    } catch(e:any){
      alert(extractErrorMessage(e?.response?.data) || 'Deactivate failed')
    } finally { setDeactivating(d => ({ ...d, [companyId]: false })) }
  }

  return (
    <div style={{ border:'1px solid #ddd', borderRadius:6, padding:12 }}>
  <h3 style={{ marginTop:0 }}>Managers (Companies)</h3>
      <form onSubmit={createCompany} style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:12 }}>
        <input placeholder='New company name' value={newName} onChange={e => setNewName(e.target.value)} required />
        <button type='submit' disabled={creating}>{creating ? '...' : 'Create'}</button>
      </form>
      <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:12 }}>
        <input style={{ minWidth:260 }} placeholder='Assign manager email' value={managerEmail} onChange={e => setManagerEmail(e.target.value)} />
        <span style={{ fontSize:12, opacity:.7 }}>Введи email и нажми Assign у нужной компании</span>
      </div>
      {loading && <p>Loading...</p>}
      {error && <p style={{ color:'red' }}>{error}</p>}
      {!loading && !error && companies.length === 0 && <p>No companies.</p>}
      {!loading && !error && companies.length > 0 && (
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:14 }}>
            <thead>
              <tr style={{ textAlign:'left', background:'#fafafa' }}>
                <th style={th}>Name</th>
                <th style={th}>Active</th>
                <th style={th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {companies.map(c => (
                <tr key={c.id} style={{ borderTop:'1px solid #eee' }}>
                  <td style={td}>{c.name}</td>
                  <td style={td}>{c.is_active ? 'Yes' : 'No'}</td>
                  <td style={{ ...td, display:'flex', gap:8, flexWrap:'wrap' }}>
                    <button
                      type='button'
                      disabled={!managerEmail.trim() || assigning[c.id]}
                      onClick={() => assignManager(c.id)}
                      style={{ padding:'4px 8px', fontSize:12 }}
                    >{assigning[c.id] ? '...' : 'Assign manager'}</button>
                    {c.is_active && (
                      <button
                        type='button'
                        disabled={deactivating[c.id]}
                        onClick={() => deactivate(c.id)}
                        style={{ padding:'4px 8px', fontSize:12 }}
                      >{deactivating[c.id] ? '...' : 'Deactivate'}</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div style={{ marginTop:10, display:'flex', gap:8 }}>
        <button onClick={load} disabled={loading}>Reload</button>
      </div>
    </div>
  )
}

function StatsSection() {
  const [range, setRange] = useState<'all'|'today'|'week'|'month'>('all')
  const [data, setData] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshTick, setRefreshTick] = useState(0)

  useEffect(() => { load() }, [range, refreshTick])

  const load = async () => {
    setLoading(true); setError(null)
    try {
      const r = await api.get('/admin/stats', { params: { range } })
      setData(r.data)
    } catch(e:any){
      setError(extractErrorMessage(e?.response?.data) || 'Failed to load stats')
    } finally { setLoading(false) }
  }

  const metrics: Array<{key:string; label:string; format?:(v:any)=>string}> = [
    { key:'users', label:'Users' },
    { key:'companies', label:'Companies' },
    { key:'flights', label:'Flights' },
    { key:'active_flights', label:'Active Flights' },
    { key:'completed_flights', label:'Completed Flights' },
    { key:'passengers', label:'Passengers (paid tickets)' },
    { key:'seats_capacity', label:'Seats Capacity' },
    { key:'seats_sold', label:'Seats Sold' },
    { key:'load_factor', label:'Load Factor', format: v => (v*100).toFixed(1)+'%' },
    { key:'revenue', label:'Revenue', format: v => '$'+Number(v).toFixed(2) },
  ]

  return (
    <div style={{ border:'1px solid #ddd', borderRadius:6, padding:12 }}>
      <h3 style={{ marginTop:0 }}>Service Statistics</h3>
      <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:12 }}>
        {(['all','today','week','month'] as const).map(r => (
          <button key={r} onClick={() => setRange(r)} style={{
            padding:'4px 10px',
            border:'1px solid '+(range===r?'#444':'#bbb'),
            background: range===r?'#444':'#f7f7f7', color: range===r?'#fff':'#222', borderRadius:4
          }}>{r}</button>
        ))}
        <button onClick={() => setRefreshTick(x=>x+1)} disabled={loading}>Reload</button>
      </div>
      {loading && <p>Loading...</p>}
      {error && <p style={{ color:'red' }}>{error}</p>}
      {!loading && !error && data && (
        <div style={{ display:'grid', gap:12, gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))' }}>
          {metrics.map(m => (
            <div key={m.key} style={{ border:'1px solid #eee', padding:10, borderRadius:4, background:'#fafafa' }}>
              <div style={{ fontSize:12, opacity:.7 }}>{m.label}</div>
              <div style={{ fontSize:20, fontWeight:600 }}>{m.format? m.format(data[m.key]) : (data[m.key] ?? '—')}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
