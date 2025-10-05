import React, { useEffect, useState } from 'react'
import api, { extractErrorMessage } from '../lib/api'

type AdminUser = { id: number; email: string; full_name: string; role: string; is_active: boolean; companies?: number[]; company_names?: string[] }

type Tab = 'users' | 'companies' | 'stats' | 'banners' | 'offers'

type Company = { id: number; name: string; is_active: boolean }

export default function AdminPanel() {
  const [tab, setTab] = useState<Tab>('users')
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      <h2>Admin Panel</h2>
      <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
  {(['users','companies','stats','banners','offers'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding:'6px 12px',
            border: '1px solid ' + (tab===t?'#444':'#bbb'),
            background: tab===t? '#444':'#f8f8f8',
            color: tab===t? '#fff':'#222',
            borderRadius:4,
            cursor:'pointer'
          }}>{t}</button>
        ))}
      </div>
      {tab === 'users' && <UsersSection />}
  {tab === 'companies' && <CompaniesSection />}
      {tab === 'stats' && <StatsSection />}
  {tab === 'banners' && <BannersSection />}
  {tab === 'offers' && <OffersSection />}
    </div>
  )
}

function UsersSection() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actioning, setActioning] = useState<Record<number, boolean>>({})
  const [refreshTick, setRefreshTick] = useState(0)
  const [companies, setCompanies] = useState<Company[]>([])
  const [companiesLoading, setCompaniesLoading] = useState(false)
  const [selectedCompany, setSelectedCompany] = useState<string>('')
  const [unassigning, setUnassigning] = useState<Record<string, boolean>>({})
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [total, setTotal] = useState(0)
  const pages = Math.max(1, Math.ceil(total / pageSize))
  const [search, setSearch] = useState('')
  const [pendingSearch, setPendingSearch] = useState('')
  const [gotoPage, setGotoPage] = useState('')

  useEffect(() => { loadCompanies() }, [])
  useEffect(() => { loadUsers() }, [refreshTick, selectedCompany, page, pageSize, search])

  const loadCompanies = async () => {
    setCompaniesLoading(true)
    try {
      const r = await api.get('/admin/companies')
      setCompanies(r.data || [])
    } catch(e:any) {
      // silent; optional list
    } finally { setCompaniesLoading(false) }
  }

  const loadUsers = async () => {
    setLoading(true); setError(null)
    try {
  const params: any = { page, page_size: pageSize }
  if (selectedCompany) params.company_id = selectedCompany
  if (search.trim()) params.search = search.trim()
      const r = await api.get('/admin/users', { params })
      const data = r.data || {}
      setUsers(data.items || [])
      setTotal(data.total || 0)
      // Если текущая страница вышла за границы после изменений - откат
      const newPages = Math.max(1, Math.ceil((data.total || 0) / pageSize))
      if (page > newPages) {
        setPage(newPages)
      }
    } catch(e:any){
      setError(extractErrorMessage(e?.response?.data) || 'Failed to load users')
    } finally { setLoading(false) }
  }

  const toggleActive = async (u: AdminUser) => {
    setActioning(a => ({ ...a, [u.id]: true }))
    try {
      if (u.is_active) await api.post(`/admin/users/${u.id}/block`)
      else await api.post(`/admin/users/${u.id}/unblock`)
      setRefreshTick(x=>x+1)
    } catch(e:any) {
      alert(extractErrorMessage(e?.response?.data) || 'Action failed')
    } finally {
      setActioning(a => ({ ...a, [u.id]: false }))
    }
  }

  const unassign = async (companyId: number, email: string) => {
    const key = companyId+':'+email
    if (!confirm('Unassign this manager from the company?')) return
    setUnassigning(u => ({ ...u, [key]: true }))
    try {
      await api.post(`/admin/companies/${companyId}/unassign-manager`, { email })
      setRefreshTick(x=>x+1)
    } catch(e:any) {
      alert(extractErrorMessage(e?.response?.data) || 'Unassign failed')
    } finally {
      setUnassigning(u => ({ ...u, [key]: false }))
    }
  }

  const renderCompaniesCell = (u: AdminUser) => {
    if (u.role !== 'company_manager') return '—'
    const names = u.company_names || []
    if (!names.length) return '—'
    const shown = names.slice(0,2)
    const extra = names.length - shown.length
    const label = shown.join(', ') + (extra>0 ? ` +${extra}` : '')
    const title = names.join(', ')
    return (
      <div title={title} style={{ display:'flex', flexDirection:'column', gap:4 }}>
        <span>{label}</span>
        {/* Unassign buttons for each company */}
        <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
          {(u.companies||[]).map((cid, idx) => (
            <button
              key={cid}
              type='button'
              title={`Unassign ${names[idx]||'company'} from manager`}
              onClick={() => unassign(cid, u.email)}
              disabled={unassigning[cid+':'+u.email]}
              style={{ padding:'2px 6px', fontSize:11, background:'#fee', border:'1px solid #f99', borderRadius:3, cursor:'pointer' }}
            >{unassigning[cid+':'+u.email] ? '...' : 'Unassign'}</button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div style={{ border:'1px solid #ddd', borderRadius:6, padding:12 }}>
      <h3 style={{ marginTop:0 }}>Users</h3>
      <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:12 }}>
        <label style={{ fontSize:13, display:'flex', alignItems:'center', gap:6 }}>
          <span>Company filter:</span>
          <select value={selectedCompany} onChange={e=>setSelectedCompany(e.target.value)} disabled={companiesLoading}>
            <option value=''>All</option>
            {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <button onClick={()=>setRefreshTick(x=>x+1)} disabled={loading}>Reload</button>
        <label style={{ fontSize:13, display:'flex', alignItems:'center', gap:4 }}>
          <span>Page size:</span>
          <select value={pageSize} onChange={e=>{ setPageSize(Number(e.target.value)); setPage(1) }} disabled={loading}>
            {[10,25,50,100].map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <div style={{ display:'flex', gap:4, alignItems:'center' }}>
          <input
            style={{ padding:'4px 6px' }}
            placeholder='Search email or name'
            value={pendingSearch}
            onChange={e=>setPendingSearch(e.target.value)}
            onKeyDown={e=>{ if(e.key==='Enter'){ setSearch(pendingSearch); setPage(1) } }}
          />
          <button type='button' disabled={loading && search!==pendingSearch} onClick={()=>{ setSearch(pendingSearch); setPage(1) }}>Search</button>
          {search && <button type='button' onClick={()=>{ setPendingSearch(''); setSearch(''); setPage(1) }} style={{ padding:'4px 6px' }}>×</button>}
        </div>
      </div>
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
                <th style={th}>Companies</th>
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
                  <td style={td}>{renderCompaniesCell(u)}</td>
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
      <div style={{ marginTop:12, display:'flex', gap:12, alignItems:'center', flexWrap:'wrap' }}>
        <button disabled={loading || page<=1} onClick={()=> setPage(p=> Math.max(1,p-1))}>Prev</button>
        <span style={{ fontSize:13 }}>Page {page} / {pages}</span>
        <button disabled={loading || page>=pages} onClick={()=> setPage(p=> Math.min(pages,p+1))}>Next</button>
        <span style={{ fontSize:12, opacity:.7 }}>Total: {total}</span>
        <div style={{ display:'flex', gap:4, alignItems:'center' }}>
          <span style={{ fontSize:12 }}>Go to:</span>
          <input
            value={gotoPage}
            onChange={e=>{ const v=e.target.value; if(/^[0-9]*$/.test(v)) setGotoPage(v) }}
            onKeyDown={e=>{ if(e.key==='Enter'){ const n = Number(gotoPage); if(n>=1 && n<=pages){ setPage(n); } }}}
            style={{ width:60, padding:'4px 6px' }}
            placeholder='№'
          />
          <button type='button' onClick={()=>{ const n = Number(gotoPage); if(n>=1 && n<=pages){ setPage(n); } }} disabled={!gotoPage || Number(gotoPage)<1 || Number(gotoPage)>pages}>Go</button>
        </div>
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
  <h3 style={{ marginTop:0 }}>Companies</h3>
      <form onSubmit={createCompany} style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:12 }}>
        <input placeholder='New company name' value={newName} onChange={e => setNewName(e.target.value)} required />
        <button type='submit' disabled={creating}>{creating ? '...' : 'Create'}</button>
      </form>
      <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:12 }}>
        <input style={{ minWidth:260 }} placeholder='Assign manager email' value={managerEmail} onChange={e => setManagerEmail(e.target.value)} />
  <span style={{ fontSize:12, opacity:.7 }}>Enter email then press Assign on a company</span>
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

type Banner = { id:number; title:string; image_url?:string|null; link_url?:string|null; is_active:boolean; position?:number|null }

function BannersSection() {
  const [banners, setBanners] = useState<Banner[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string|null>(null)
  const [refreshTick, setRefreshTick] = useState(0)
  const [creating, setCreating] = useState(false)
  const [editingId, setEditingId] = useState<number|null>(null)
  const [form, setForm] = useState({ title:'', image_url:'', link_url:'', is_active:true, position:'' })
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<Record<number, boolean>>({})

  useEffect(()=>{ load() }, [refreshTick])

  const load = async () => {
    setLoading(true); setError(null)
    try {
      const r = await api.get('/content/admin/banners')
      setBanners(r.data || [])
    } catch(e:any){
  setError(extractErrorMessage(e?.response?.data) || 'Failed to load banners')
    } finally { setLoading(false) }
  }

  const startCreate = () => { setEditingId(null); setForm({ title:'', image_url:'', link_url:'', is_active:true, position:'' }); setCreating(true) }
  const startEdit = (b:Banner) => {
  setEditingId(b.id); setForm({ title:b.title||'', image_url:b.image_url||'', link_url:b.link_url||'', is_active: b.is_active, position: b.position?.toString()||'' }); setCreating(true)
  }
  const reset = () => { setCreating(false); setEditingId(null); setForm({ title:'', image_url:'', link_url:'', is_active:true, position:'' }) }

  const submit = async (e:React.FormEvent) => {
    e.preventDefault(); if(!form.title.trim()) return
    setSaving(true)
    try {
      const payload:any = { title: form.title.trim(), is_active: form.is_active }
      if (form.image_url.trim()) payload.image_url = form.image_url.trim()
      if (form.link_url.trim()) payload.link_url = form.link_url.trim()
      if (form.position.trim()) payload.position = Number(form.position)
      if (editingId) {
        await api.put(`/content/admin/banners/${editingId}`, payload)
      } else {
        await api.post('/content/admin/banners', payload)
      }
      reset(); setRefreshTick(x=>x+1)
    } catch(e:any){
  alert(extractErrorMessage(e?.response?.data) || 'Save failed')
    } finally { setSaving(false) }
  }

  const toggleActive = async (b:Banner) => {
    try {
  await api.put(`/content/admin/banners/${b.id}`, { is_active: !b.is_active })
      setRefreshTick(x=>x+1)
    } catch(e:any){
  alert(extractErrorMessage(e?.response?.data) || 'Toggle failed')
    }
  }

  const remove = async (b:Banner) => {
  if(!confirm('Delete banner?')) return
    setDeleting(d=>({ ...d, [b.id]: true }))
    try {
  await api.delete(`/content/admin/banners/${b.id}`)
      setRefreshTick(x=>x+1)
    } catch(e:any){
  alert(extractErrorMessage(e?.response?.data) || 'Delete failed')
    } finally { setDeleting(d=>({ ...d, [b.id]: false })) }
  }

  return (
    <div style={{ border:'1px solid #ddd', borderRadius:6, padding:12 }}>
      <h3 style={{ marginTop:0 }}>Banners</h3>
      <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:12 }}>
        <button onClick={()=>setRefreshTick(x=>x+1)} disabled={loading}>Reload</button>
        {!creating && <button onClick={startCreate}>New banner</button>}
        {creating && <button onClick={reset} type='button'>Cancel</button>}
      </div>
      {creating && (
        <form onSubmit={submit} style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:20, maxWidth:520 }}>
          <input placeholder='Title *' value={form.title} onChange={e=>setForm(f=>({ ...f, title:e.target.value }))} required />
          <input placeholder='Image URL' value={form.image_url} onChange={e=>setForm(f=>({ ...f, image_url:e.target.value }))} />
          <input placeholder='Link URL' value={form.link_url} onChange={e=>setForm(f=>({ ...f, link_url:e.target.value }))} />
          <input placeholder='Position (number)' value={form.position} onChange={e=>{ const v=e.target.value; if(/^[0-9]*$/.test(v)) setForm(f=>({ ...f, position:v })) }} />
          <label style={{ display:'flex', gap:6, fontSize:14 }}>
            <input type='checkbox' checked={form.is_active} onChange={e=>setForm(f=>({ ...f, is_active:e.target.checked }))} /> Active
          </label>
          <div style={{ display:'flex', gap:8 }}>
            <button type='submit' disabled={saving}>{saving? '...' : (editingId? 'Update' : 'Create')}</button>
          </div>
        </form>
      )}
  {loading && <p>Loading...</p>}
      {error && <p style={{ color:'red' }}>{error}</p>}
  {!loading && !error && banners.length===0 && <p>No banners.</p>}
      {!loading && !error && banners.length>0 && (
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:14 }}>
            <thead>
              <tr style={{ textAlign:'left', background:'#fafafa' }}>
                <th style={th}>ID</th>
                <th style={th}>Title</th>
                <th style={th}>Active</th>
                <th style={th}>Pos</th>
                <th style={th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {banners.sort((a,b)=> (a.position??0) - (b.position??0)).map(b => (
                <tr key={b.id} style={{ borderTop:'1px solid #eee' }}>
                  <td style={td}>{b.id}</td>
                  <td style={{ ...td, maxWidth:260 }}>
                    <div style={{ fontWeight:600 }}>{b.title}</div>
                    {b.image_url && <div style={{ fontSize:11, opacity:.7, wordBreak:'break-all' }}>{b.image_url}</div>}
                    {b.link_url && <div style={{ fontSize:11, opacity:.7, wordBreak:'break-all' }}>{b.link_url}</div>}
                  </td>
                  <td style={td}>{b.is_active? 'Yes':'No'}</td>
                  <td style={td}>{b.position ?? ''}</td>
                  <td style={{ ...td, display:'flex', gap:6, flexWrap:'wrap' }}>
                    <button type='button' onClick={()=>startEdit(b)} style={{ padding:'4px 8px', fontSize:12 }}>Edit</button>
                    <button type='button' onClick={()=>toggleActive(b)} style={{ padding:'4px 8px', fontSize:12 }}>{b.is_active? 'Deactivate' :'Activate'}</button>
                    <button type='button' disabled={deleting[b.id]} onClick={()=>remove(b)} style={{ padding:'4px 8px', fontSize:12 }}>{deleting[b.id]? '...':'Delete'}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

type Offer = { id:number; title:string; subtitle?:string|null; price_from?:number|null; flight_ref?:string|null; is_active:boolean; position?:number|null; tag?:string|null; mode?:'interactive'|'info'; description?:string|null; click_count?:number }

// Regex для client-side проверки flight_ref
const FLIGHT_REF_RE = /^([A-Z]{3})(?:-([A-Z]{3})(?:@(\d{4}-\d{2}-\d{2}))?)?$/
const TAG_OPTIONS = ['', 'sale','new','last_minute','info']

function OffersSection() {
  const [offers, setOffers] = useState<Offer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string|null>(null)
  const [refreshTick, setRefreshTick] = useState(0)

  // Modal state
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<number|null>(null)
  const emptyForm = { title:'', subtitle:'', price_from:'', flight_ref:'', is_active:true, position:'', tag:'', mode:'interactive', description:'' }
  const [form, setForm] = useState<any>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<Record<number, boolean>>({})
  const [normalizing, setNormalizing] = useState(false)
  const [positionUpdating, setPositionUpdating] = useState<Record<number, boolean>>({})

  useEffect(()=>{ load() }, [refreshTick])

  const load = async () => {
    setLoading(true); setError(null)
    try {
      const r = await api.get('/content/admin/offers')
      setOffers(r.data || [])
    } catch(e:any){
      setError(extractErrorMessage(e?.response?.data) || 'Failed to load offers')
    } finally { setLoading(false) }
  }

  const openCreate = () => { setEditingId(null); setForm(emptyForm); setModalOpen(true) }
  const openEdit = (o:Offer) => {
    setEditingId(o.id)
    setForm({
      title: o.title||'',
      subtitle: o.subtitle||'',
      price_from: o.price_from?.toString()||'',
      flight_ref: o.flight_ref||'',
      is_active: o.is_active,
      position: o.position?.toString()||'',
      tag: o.tag||'',
      mode: o.mode || 'interactive',
      description: o.description||''
    })
    setModalOpen(true)
  }
  const closeModal = () => { if (saving) return; setModalOpen(false); setEditingId(null); setForm(emptyForm) }

  const validate = (): string | null => {
    if (!form.title.trim()) return 'Title required'
    if (form.flight_ref && !FLIGHT_REF_RE.test(form.flight_ref.trim().toUpperCase())) return 'Invalid flight_ref format'
    if (form.mode === 'info' && form.description.length > 1000) return 'Description too long'
    if (form.tag && !TAG_OPTIONS.includes(form.tag)) return 'Invalid tag'
    return null
  }

  const submit = async (e:React.FormEvent) => {
    e.preventDefault()
    const err = validate(); if (err) { alert(err); return }
    setSaving(true)
    try {
      const payload:any = { title: form.title.trim(), is_active: form.is_active }
      if(form.subtitle.trim()) payload.subtitle = form.subtitle.trim()
      if(form.price_from.trim()) payload.price_from = Number(form.price_from)
      if(form.mode) payload.mode = form.mode
      if(form.mode === 'info' && form.description.trim()) payload.description = form.description.trim()
      if(form.mode === 'interactive') {
        const o=form._origin?.length===3?form._origin:''
        const d=form._destination?.length===3?form._destination:''
        const dt=form._date || ''
        let composed = ''
        if(o && d && dt) composed = `${o}-${d}@${dt}`
        else if(o && d) composed = `${o}-${d}`
        else if(o) composed = o
        if(composed) payload.flight_ref = composed
      } else if(form.flight_ref.trim()) {
        payload.flight_ref = form.flight_ref.trim().toUpperCase()
      }
      if(editingId) await api.put(`/content/admin/offers/${editingId}`, payload)
      else await api.post('/content/admin/offers', payload)
      closeModal(); setRefreshTick(x=>x+1)
    } catch(e:any){
      alert(extractErrorMessage(e?.response?.data) || 'Save failed')
    } finally { setSaving(false) }
  }

  const toggleActive = async (o:Offer) => {
    try { await api.put(`/content/admin/offers/${o.id}`, { is_active: !o.is_active }); setRefreshTick(x=>x+1) } catch(e:any){ alert(extractErrorMessage(e?.response?.data)||'Toggle failed') }
  }

  const remove = async (o:Offer) => { if(!confirm('Delete offer?')) return; setDeleting(d=>({ ...d, [o.id]: true })); try { await api.delete(`/content/admin/offers/${o.id}`); setRefreshTick(x=>x+1) } catch(e:any){ alert(extractErrorMessage(e?.response?.data)||'Delete failed') } finally { setDeleting(d=>({ ...d, [o.id]: false })) } }

  const updatePosition = async (o:Offer, delta:number) => {
    const newPos = Math.max(0, (o.position||0) + delta)
    setPositionUpdating(p=>({ ...p, [o.id]: true }))
    try { await api.put(`/content/admin/offers/${o.id}`, { position: newPos }); setRefreshTick(x=>x+1) } catch(e:any){ alert('Position update failed') } finally { setPositionUpdating(p=>({ ...p, [o.id]: false })) }
  }

  const normalizePositions = async () => {
    setNormalizing(true)
    try {
      const sorted = [...offers].sort((a,b)=> (a.position??0)-(b.position??0))
      let changed = false
      for (let i=0;i<sorted.length;i++) {
        const o = sorted[i]
        if ((o.position??0) !== i) {
          changed = true
          await api.put(`/content/admin/offers/${o.id}`, { position: i })
        }
      }
      if (changed) setRefreshTick(x=>x+1)
    } catch { alert('Normalize failed') } finally { setNormalizing(false) }
  }

  const sortedOffers = [...offers].sort((a,b)=> (a.position??0) - (b.position??0))

  return (
    <div style={{ border:'1px solid #ddd', borderRadius:6, padding:12 }}>
      <h3 style={{ marginTop:0 }}>Offers</h3>
      <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:12 }}>
        <button onClick={()=>setRefreshTick(x=>x+1)} disabled={loading}>Refresh</button>
        <button onClick={openCreate}>New offer</button>
        <button onClick={normalizePositions} disabled={normalizing || loading}>{normalizing? '...' : 'Normalize order'}</button>
      </div>
      {loading && <p>Loading...</p>}
      {error && <p style={{ color:'red' }}>{error}</p>}
      {!loading && !error && sortedOffers.length===0 && <p>No offers.</p>}
      {!loading && !error && sortedOffers.length>0 && (
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
            <thead>
              <tr style={{ background:'#fafafa', textAlign:'left' }}>
                <th style={th}>ID</th>
                <th style={th}>Title / Meta</th>
                <th style={th}>Tag</th>
                <th style={th}>Mode</th>
                <th style={th}>Clicks</th>
                <th style={th}>Active</th>
                <th style={th}>Pos</th>
                <th style={th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedOffers.map(o => (
                <tr key={o.id} style={{ borderTop:'1px solid #eee' }}>
                  <td style={td}>{o.id}</td>
                  <td style={{ ...td, maxWidth:260 }}>
                    <div style={{ fontWeight:600 }}>{o.title}</div>
                    {o.subtitle && <div style={{ fontSize:11, opacity:.7 }}>{o.subtitle}</div>}
                    {o.flight_ref && <div style={{ fontSize:11, opacity:.6 }}>ref: {o.flight_ref}</div>}
                    {o.price_from!=null && <div style={{ fontSize:11, opacity:.6 }}>from ${o.price_from}</div>}
                    {o.mode==='info' && o.description && <div style={{ fontSize:10, opacity:.55, marginTop:2, maxHeight:36, overflow:'hidden', textOverflow:'ellipsis' }}>{o.description}</div>}
                  </td>
                  <td style={td}>{o.tag || '—'}</td>
                  <td style={td}>{o.mode || 'interactive'}</td>
                  <td style={td}>{o.click_count ?? 0}</td>
                  <td style={td}>{o.is_active? 'Yes':'No'}</td>
                  <td style={{ ...td, whiteSpace:'nowrap', fontSize:12 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                      <button title='Move up' disabled={positionUpdating[o.id]} onClick={()=>updatePosition(o,-1)} style={{ padding:'2px 6px' }}>▲</button>
                      <button title='Move down' disabled={positionUpdating[o.id]} onClick={()=>updatePosition(o,1)} style={{ padding:'2px 6px' }}>▼</button>
                      <span style={{ opacity:.7 }}>#{o.position ?? 0}</span>
                    </div>
                  </td>
                  <td style={{ ...td, display:'flex', gap:6, flexWrap:'wrap' }}>
                    <button type='button' onClick={()=>openEdit(o)} style={{ padding:'4px 8px', fontSize:12 }}>Edit</button>
                    <button type='button' onClick={()=>toggleActive(o)} style={{ padding:'4px 8px', fontSize:12 }}>{o.is_active? 'Deactivate':'Activate'}</button>
                    <button type='button' disabled={deleting[o.id]} onClick={()=>remove(o)} style={{ padding:'4px 8px', fontSize:12 }}>{deleting[o.id]? '...':'Delete'}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalOpen && (
        <div style={modalOverlay}>
          <div style={modalBox}>
            <h4 style={{ margin:'0 0 12px' }}>{editingId? 'Edit offer':'New offer'}</h4>
            <form onSubmit={submit} style={{ display:'flex', flexDirection:'column', gap:8 }}>
              <input placeholder='Title *' value={form.title} onChange={e=>setForm((f:any)=>({ ...f, title:e.target.value }))} required />
              <input placeholder='Subtitle' value={form.subtitle} onChange={e=>setForm((f:any)=>({ ...f, subtitle:e.target.value }))} />
              <input placeholder='Price from' value={form.price_from} onChange={e=>{ const v=e.target.value; if(/^[0-9]*\.?[0-9]*$/.test(v)) setForm((f:any)=>({ ...f, price_from:v })) }} />
              {/* Flight ref builder */}
              {form.mode === 'interactive' && (
                <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                  <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                    <input
                      placeholder='Origin (AAA)'
                      value={form._origin || ''}
                      onChange={e=>{ const v=e.target.value.toUpperCase(); setForm((f:any)=>({ ...f, _origin:v.replace(/[^A-Z]/g,'').slice(0,3) })); }}
                      style={{ width:100 }}
                    />
                    <input
                      placeholder='Destination (BBB)'
                      value={form._destination || ''}
                      onChange={e=>{ const v=e.target.value.toUpperCase(); setForm((f:any)=>({ ...f, _destination:v.replace(/[^A-Z]/g,'').slice(0,3) })); }}
                      style={{ width:120 }}
                    />
                    <input
                      type='date'
                      value={form._date || ''}
                      onChange={e=> setForm((f:any)=>({ ...f, _date:e.target.value })) }
                    />
                  </div>
                  <div style={{ fontSize:11, opacity:.7 }}>
                    Итоговая строка: {(() => {
                      const o=form._origin?.length===3?form._origin:''
                      const d=form._destination?.length===3?form._destination:''
                      if(!o && !d) return '(пусто)'
                      if(o && !d) return o
                      if(o && d && form._date) return `${o}-${d}@${form._date}`
                      if(o && d) return `${o}-${d}`
                      return '(невалидно)'
                    })()}
                  </div>
                </div>
              )}
              {form.mode !== 'interactive' && (
                <input placeholder='Flight ref (AAA / AAA-BBB / AAA-BBB@YYYY-MM-DD)' value={form.flight_ref} onChange={e=>setForm((f:any)=>({ ...f, flight_ref:e.target.value.toUpperCase() }))} />
              )}
              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                <label style={{ fontSize:12 }}>Tag:
                  <select value={form.tag} onChange={e=>setForm((f:any)=>({ ...f, tag:e.target.value }))} style={{ marginLeft:6 }}>
                    {TAG_OPTIONS.map(t => <option key={t} value={t}>{t||'(none)'}</option>)}
                  </select>
                </label>
                <label style={{ fontSize:12 }}>Mode:
                  <select value={form.mode} onChange={e=>setForm((f:any)=>({ ...f, mode:e.target.value }))} style={{ marginLeft:6 }}>
                    <option value='interactive'>interactive</option>
                    <option value='info'>info</option>
                  </select>
                </label>
                <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:12 }}>
                  <input type='checkbox' checked={form.is_active} onChange={e=>setForm((f:any)=>({ ...f, is_active:e.target.checked }))} /> Active
                </label>
              </div>
              {form.mode === 'info' && (
                <textarea placeholder='Description (tooltip)' value={form.description} onChange={e=>setForm((f:any)=>({ ...f, description:e.target.value }))} style={{ minHeight:80 }} />
              )}
              <input placeholder='Position' value={form.position} onChange={e=>{ const v=e.target.value; if(/^[0-9]*$/.test(v)) setForm((f:any)=>({ ...f, position:v })) }} />
              {editingId && (
                <div style={{ fontSize:12, opacity:.7 }}>Clicks: {offers.find(o=>o.id===editingId)?.click_count ?? 0}</div>
              )}
              <div style={{ display:'flex', gap:8, marginTop:4 }}>
                <button type='submit' disabled={saving}>{saving? '...' : (editingId? 'Update':'Create')}</button>
                <button type='button' onClick={closeModal} disabled={saving}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

const modalOverlay: React.CSSProperties = { position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', display:'flex', alignItems:'flex-start', justifyContent:'center', paddingTop:80, zIndex:2000 }
const modalBox: React.CSSProperties = { background:'#fff', borderRadius:8, padding:'18px 20px 22px', width:'100%', maxWidth:520, boxShadow:'0 8px 28px -6px rgba(0,0,0,0.4)', animation:'fadeIn .25s ease' }
