import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth.jsx'

export default function Login() {
  const { login, register } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setError(null); setBusy(true)
    try {
      if (mode === 'login') await login(email, password)
      else await register(email, password)
      navigate('/')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-logo">Checkout</div>
      <div className="auth-box">
        <h1>{mode === 'login' ? 'Sign in' : 'Create account'}</h1>
        <form onSubmit={submit}>
          <label>Email
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required />
          </label>
          <label>Password
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                   minLength={mode === 'register' ? 8 : undefined} required />
          </label>
          {mode === 'register' && <p className="hint">Passwords must be at least 8 characters.</p>}
          {error && <p className="error">{error}</p>}
          <button className="buy-btn wide" type="submit" disabled={busy}>
            {busy ? 'Please wait…' : (mode === 'login' ? 'Sign in' : 'Create your account')}
          </button>
        </form>
      </div>
      <div className="auth-switch">
        {mode === 'login' ? (
          <>New here? <button className="link" onClick={() => { setMode('register'); setError(null) }}>Create an account</button></>
        ) : (
          <>Already have an account? <button className="link" onClick={() => { setMode('login'); setError(null) }}>Sign in</button></>
        )}
      </div>
    </div>
  )
}
