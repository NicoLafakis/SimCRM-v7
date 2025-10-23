import React, { useState } from 'react'

export default function AuthPage({ onSignup, onLogin }) {
  const [identifier, setIdentifier] = useState('')
  const [passcode, setPasscode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const submit = async (e) => {
    e?.preventDefault()
    setError(null)
    if (!identifier || !passcode) return setError('Please enter your player name or email and passcode')
    setLoading(true)
    try {
  const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, passcode })
      })
      let data = null
      try { data = await res.json() } catch (parseErr) { data = null }
      setLoading(false)
      if (!res.ok) {
        return setError(data?.error || `Login failed: ${res.status} ${res.statusText}`)
      }
      if (!data || !data.ok) return setError(data?.error || 'Login failed')
      // call parent with user
      onLogin && onLogin({ id: data.id, playerName: data.playerName, email: data.email })
    } catch (e) {
      setLoading(false)
      setError(e.message || 'Network error')
    }
  }

  return (
    <div className="landing">
      <form className="auth-wrap" role="region" aria-label="Login form" onSubmit={submit}>
        <div className="gb-shell">
          <div className="gb-screen">
            <label className="gb-label">PLAYER NAME</label>
            <input className="gb-input" value={identifier} onChange={e => setIdentifier(e.target.value)} type="text" placeholder="Enter Player Name or Email" />
            <label className="gb-label">PASSCODE</label>
            <input className="gb-input" value={passcode} onChange={e => setPasscode(e.target.value)} type="password" placeholder="Enter Passcode" />
          </div>
        </div>
        <div className="auth-under">
          <a className="auth-forgot" href="#">Forgot your password?</a>
        </div>
        {error && <div style={{ color: '#8b0000', fontSize: 12 }}>{error}</div>}
        <div className="auth-actions">
          <button className="btn btn-login" type="submit" disabled={loading}>{loading ? 'Please wait...' : 'Login'}</button>
          <div className="auth-or">OR</div>
          <button className="btn btn-signup" type="button" onClick={onSignup}>Sign Up</button>
        </div>
      </form>
      <footer className="site-footer">©️2025 Black Maige. Game the simulation.</footer>
    </div>
  )
}
