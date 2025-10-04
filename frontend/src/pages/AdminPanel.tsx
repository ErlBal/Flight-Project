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
      {tab === 'banners' && <BannersSection />}
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

type Banner = { id:number; title:string; image_url?:string|null; link_url?:string|null; is_active:boolean; display_order?:number|null }

function BannersSection() {
  const [banners, setBanners] = useState<Banner[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string|null>(null)
  const [refreshTick, setRefreshTick] = useState(0)
  const [creating, setCreating] = useState(false)
  const [editingId, setEditingId] = useState<number|null>(null)
  const [form, setForm] = useState({ title:'', image_url:'', link_url:'', is_active:true, display_order:'' })
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<Record<number, boolean>>({})

  useEffect(()=>{ load() }, [refreshTick])

  const load = async () => {
    setLoading(true); setError(null)
    try {
      const r = await api.get('/content/banners/admin')
      setBanners(r.data || [])
    } catch(e:any){
      setError(extractErrorMessage(e?.response?.data) || 'Не удалось загрузить баннеры')
    } finally { setLoading(false) }
  }

  const startCreate = () => { setEditingId(null); setForm({ title:'', image_url:'', link_url:'', is_active:true, display_order:'' }); setCreating(true) }
  const startEdit = (b:Banner) => {
    setEditingId(b.id); setForm({ title:b.title||'', image_url:b.image_url||'', link_url:b.link_url||'', is_active: b.is_active, display_order: b.display_order?.toString()||'' }); setCreating(true)
  }
  const reset = () => { setCreating(false); setEditingId(null); setForm({ title:'', image_url:'', link_url:'', is_active:true, display_order:'' }) }

  const submit = async (e:React.FormEvent) => {
    e.preventDefault(); if(!form.title.trim()) return
    setSaving(true)
    try {
      const payload:any = { title: form.title.trim(), is_active: form.is_active }
      if (form.image_url.trim()) payload.image_url = form.image_url.trim()
      if (form.link_url.trim()) payload.link_url = form.link_url.trim()
      if (form.display_order.trim()) payload.display_order = Number(form.display_order)
      if (editingId) {
        await api.put(`/content/banners/${editingId}`, payload)
      } else {
        await api.post('/content/banners', payload)
      }
      reset(); setRefreshTick(x=>x+1)
    } catch(e:any){
      alert(extractErrorMessage(e?.response?.data) || 'Сохранение не удалось')
    } finally { setSaving(false) }
  }

  const toggleActive = async (b:Banner) => {
    try {
      await api.put(`/content/banners/${b.id}`, { is_active: !b.is_active })
      setRefreshTick(x=>x+1)
    } catch(e:any){
      alert(extractErrorMessage(e?.response?.data) || 'Ошибка переключения')
    }
  }

  const remove = async (b:Banner) => {
    if(!confirm('Удалить баннер?')) return
    setDeleting(d=>({ ...d, [b.id]: true }))
    try {
      await api.delete(`/content/banners/${b.id}`)
      setRefreshTick(x=>x+1)
    } catch(e:any){
      alert(extractErrorMessage(e?.response?.data) || 'Удаление не удалось')
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
          <input placeholder='Display order (число)' value={form.display_order} onChange={e=>{ const v=e.target.value; if(/^[0-9]*$/.test(v)) setForm(f=>({ ...f, display_order:v })) }} />
          <label style={{ display:'flex', gap:6, fontSize:14 }}>
            <input type='checkbox' checked={form.is_active} onChange={e=>setForm(f=>({ ...f, is_active:e.target.checked }))} /> Active
          </label>
          <div style={{ display:'flex', gap:8 }}>
            <button type='submit' disabled={saving}>{saving? '...' : (editingId? 'Update' : 'Create')}</button>
          </div>
        </form>
      )}
      {loading && <p>Загрузка...</p>}
      {error && <p style={{ color:'red' }}>{error}</p>}
      {!loading && !error && banners.length===0 && <p>Нет баннеров.</p>}
      {!loading && !error && banners.length>0 && (
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:14 }}>
            <thead>
              <tr style={{ textAlign:'left', background:'#fafafa' }}>
                <th style={th}>ID</th>
                <th style={th}>Title</th>
                <th style={th}>Active</th>
                <th style={th}>Order</th>
                <th style={th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {banners.sort((a,b)=> (a.display_order??0) - (b.display_order??0)).map(b => (
                <tr key={b.id} style={{ borderTop:'1px solid #eee' }}>
                  <td style={td}>{b.id}</td>
                  <td style={{ ...td, maxWidth:260 }}>
                    <div style={{ fontWeight:600 }}>{b.title}</div>
                    {b.image_url && <div style={{ fontSize:11, opacity:.7, wordBreak:'break-all' }}>{b.image_url}</div>}
                    {b.link_url && <div style={{ fontSize:11, opacity:.7, wordBreak:'break-all' }}>{b.link_url}</div>}
                  </td>
                  <td style={td}>{b.is_active? 'Yes':'No'}</td>
                  <td style={td}>{b.display_order ?? ''}</td>
                  <td style={{ ...td, display:'flex', gap:6, flexWrap:'wrap' }}>
                    <button type='button' onClick={()=>startEdit(b)} style={{ padding:'4px 8px', fontSize:12 }}>Edit</button>
                    <button type='button' onClick={()=>toggleActive(b)} style={{ padding:'4px 8px', fontSize:12 }}>{b.is_active? 'Deactivate':'Activate'}</button>
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
