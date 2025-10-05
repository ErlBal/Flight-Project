import { useState } from 'react'
import api, { extractErrorMessage } from '../../lib/api'
import { saveToken } from '../../lib/auth'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (loading) return
    setError(null); setLoading(true)
    try {
      const res = await api.post('/auth/login-json', { email, password })
      saveToken(res.data.access_token)
      location.href = '/dashboard'
    } catch (err: any) {
      setError(extractErrorMessage(err?.response?.data) || 'Login failed')
    } finally { setLoading(false) }
  }

  return (
    <div className="center-page">
      <div className="card" style={{ width:420, maxWidth:'100%' }}>
        <h1 className="card-header" style={{ fontSize:28 }}>Sign in</h1>
        <p className="card-sub" style={{ marginTop:-10 }}>Access your account to manage flights and tickets.</p>
        <form onSubmit={onSubmit} className="stack" style={{ gap:16 }}>
          <div className="form-field">
            <label style={{ fontSize:12, fontWeight:600, letterSpacing:.5 }}>Email</label>
            <input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required autoComplete="username" />
          </div>
          <div className="form-field">
            <label style={{ fontSize:12, fontWeight:600, letterSpacing:.5 }}>Password</label>
            <input className="input" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="" required autoComplete="current-password" />
          </div>
          {error && <div className="text-danger" role="alert">{error}</div>}
          <button type="submit" className="btn" disabled={loading || !email || !password}>{loading ? 'Signing in…' : 'Sign in'}</button>
          <div className="helper" style={{ marginTop:4 }}>No account? <a href="/register" className="link-accent2">Create one</a></div>
        </form>
      </div>
    </div>
  )
}
