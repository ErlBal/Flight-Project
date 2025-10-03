import { Outlet, Link } from 'react-router-dom'

export default function App() {
  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', lineHeight: 1.4 }}>
      <nav style={{ display: 'flex', gap: 12, padding: 12, borderBottom: '1px solid #eee' }}>
        <Link to="/">Home</Link>
        <Link to="/search">Search</Link>
        <Link to="/dashboard">My Tickets</Link>
        <Link to="/company">Company</Link>
        <Link to="/admin">Admin</Link>
        <span style={{ marginLeft: 'auto' }}>
          <Link to="/login">Login</Link>
          {' '}
          <Link to="/register">Sign up</Link>
        </span>
      </nav>
      <div style={{ padding: 16 }}>
        <Outlet />
      </div>
    </div>
  )
}
