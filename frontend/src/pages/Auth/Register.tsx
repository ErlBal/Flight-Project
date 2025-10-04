import { useState } from 'react'
import api, { extractErrorMessage } from '../../lib/api'

export default function Register() {
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState(false)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setOk(false)
    try {
      await api.post('/auth/register', { email, full_name: fullName, password })
      setOk(true)
      setTimeout(() => { location.href = '/login' }, 800)
    } catch (err: any) {
      setError(extractErrorMessage(err?.response?.data) || 'Registration failed')
    }
  }

  return (
    <form style={{ maxWidth: 360 }} onSubmit={onSubmit}>
      <h3>Sign up</h3>
      <div>
        <label>Email</label>
        <input type="email" value={email} onChange={e => setEmail(e.target.value)} required />
      </div>
      <div>
        <label>Full name</label>
        <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} required />
      </div>
      <div>
        <label>Password</label>
        <input type="password" value={password} onChange={e => setPassword(e.target.value)} required />
      </div>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {ok && <p style={{ color: 'green' }}>Registered! Redirecting to login…</p>}
      <button type="submit">Create account</button>
    </form>
  )
}
