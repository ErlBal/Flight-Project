import { Outlet, Link, useLocation } from 'react-router-dom'
import React, { useMemo } from 'react'

function useAuthInfo() {
  return useMemo(() => {
    try {
      const raw = localStorage.getItem('auth_token')
      if (!raw) return { roles: [], email: null as string | null }
      const payload = JSON.parse(atob(raw.split('.')[1]))
      return { roles: payload.roles || [], email: payload.sub || null }
    } catch {
      return { roles: [], email: null as string | null }
    }
  }, [typeof window !== 'undefined' && localStorage.getItem('auth_token')])
}

export default function App() {
  const { roles, email } = useAuthInfo()
  const isManager = roles.includes('company_manager')
  const isAdmin = roles.includes('admin')
  const canSeeCompany = isManager || isAdmin
  const loc = useLocation()

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', lineHeight: 1.4 }}>
      <nav style={{ display: 'flex', gap: 12, padding: 12, borderBottom: '1px solid #eee', alignItems:'center' }}>
        <Link to="/">Home</Link>
        <Link to="/search">Search</Link>
        <Link to="/dashboard">My Tickets</Link>
  {canSeeCompany && <Link to="/company">Company</Link>}
        {isAdmin && <Link to="/admin">Admin</Link>}
        <span style={{ marginLeft: 'auto', display:'flex', gap:12, alignItems:'center' }}>
          {!email && <><Link to="/login">Login</Link><Link to="/register">Sign up</Link></>}
          {email && <>
            <span style={{ fontSize:12, opacity:.8 }}>{email}</span>
            <button onClick={()=>{ localStorage.removeItem('auth_token'); location.href='/login' }} style={{ padding:'4px 10px' }}>Logout</button>
          </>}
        </span>
      </nav>
      <div style={{ padding: 16 }}>
        <Outlet key={loc.pathname} />
      </div>
    </div>
  )
}
