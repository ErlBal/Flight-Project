import { Outlet, Link, useLocation } from 'react-router-dom'
import React, { useMemo, useEffect } from 'react'
import NotificationsBell from './components/NotificationsBell'

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

  const isLanding = loc.pathname === '/'
  const isAuth = loc.pathname === '/login' || loc.pathname === '/register'
  const isDashboard = loc.pathname.startsWith('/dashboard')
  const isCompany = loc.pathname.startsWith('/company')
  const isAdminPage = loc.pathname.startsWith('/admin')
  // Управляем классом body для фонового изображения (кроме страниц логина)
  useEffect(() => {
    if (typeof document !== 'undefined') {
      if (!isAuth) document.body.classList.add('body-bg'); else document.body.classList.remove('body-bg')
    }
    return () => { if (typeof document !== 'undefined') document.body.classList.remove('body-bg') }
  }, [isAuth])

  return (
  <div className={isLanding || isAuth || isDashboard || isCompany || isAdminPage ? undefined : 'app-shell'} style={{ lineHeight: 1.4 }}>
      <nav className="nav-root">
        <div className="nav-left">
          <Link to="/" className={loc.pathname==='/'? 'nav-link active':'nav-link'}>Home</Link>
          {email && <Link to="/dashboard" className={loc.pathname.startsWith('/dashboard')? 'nav-link active':'nav-link'}>My Flights</Link>}
          {canSeeCompany && <Link to="/company" className={loc.pathname.startsWith('/company')? 'nav-link active':'nav-link'}>Company</Link>}
          {isAdmin && <Link to="/admin" className={loc.pathname.startsWith('/admin')? 'nav-link active':'nav-link'}>Admin</Link>}
        </div>
        <div className="nav-right">
          {!email && <>
            <Link to="/login" className={loc.pathname.startsWith('/login')? 'nav-link active':'nav-link'}>Login</Link>
            <Link to="/register" className={loc.pathname.startsWith('/register')? 'nav-link active':'nav-link'}>Sign up</Link>
          </>}
          {email && <>
            <span style={{ fontSize:13, color:'var(--color-text-faint)' }}>{email}</span>
            <NotificationsBell />
            <button className="btn btn-outline btn-compact" onClick={()=>{ localStorage.removeItem('auth_token'); location.href='/login' }}>Logout</button>
          </>}
        </div>
      </nav>
      <div style={{ padding: (isLanding || isAuth || isDashboard || isCompany || isAdminPage) ? '0' : '16px 0' }}>
        <Outlet key={loc.pathname} />
      </div>
    </div>
  )
}
