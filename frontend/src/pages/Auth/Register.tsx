import { useState } from 'react'
import api, { extractErrorMessage } from '../../lib/api'

export default function Register() {
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState(false)
  const [loading, setLoading] = useState(false)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (loading) return
    setError(null); setOk(false); setLoading(true)
    try {
      await api.post('/auth/register', { email, full_name: fullName, password })
      setOk(true)
      setTimeout(() => { location.href = '/login' }, 900)
    } catch (err: any) {
      setError(extractErrorMessage(err?.response?.data) || 'Registration failed')
    } finally { setLoading(false) }
  }

  return (
    <div className="center-page">
      <div className="card" style={{ width:460, maxWidth:'100%' }}>
        <h1 className="card-header" style={{ fontSize:28 }}>Create account</h1>
        <p className="card-sub" style={{ marginTop:-10 }}>Start booking and managing your flights.</p>
        <form onSubmit={onSubmit} className="stack" style={{ gap:16 }}>
          <div className="form-field">
            <label style={{ fontSize:12, fontWeight:600, letterSpacing:.5 }}>Email</label>
            <input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required autoComplete="email" />
          </div>
          <div className="form-field">
            <label style={{ fontSize:12, fontWeight:600, letterSpacing:.5 }}>Full name</label>
            <input className="input" type="text" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Your name" required autoComplete="name" />
          </div>
          <div className="form-field">
            <label style={{ fontSize:12, fontWeight:600, letterSpacing:.5 }}>Password</label>
            <input className="input" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="" required autoComplete="new-password" />
          </div>
          {error && <div className="text-danger" role="alert">{error}</div>}
          {ok && <div className="text-success">Registered! Redirecting…</div>}
          <button type="submit" className="btn" disabled={loading || !email || !fullName || !password}>{loading ? 'Creating…' : 'Create account'}</button>
          <div className="helper" style={{ marginTop:4 }}>Already have an account? <a href="/login" className="link-accent2">Sign in</a></div>
        </form>
      </div>
    </div>
  )
}
