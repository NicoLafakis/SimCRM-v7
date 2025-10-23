import React, { useMemo, useState } from 'react'
import pluckUrl from '../../assets/gameboy-pluck.mp3'

export default function SignUpPage({ onBack, onSuccess }) {
  const plunk = useMemo(() => new Audio(pluckUrl), [])
  const [playerName, setPlayerName] = useState('')
  const [passcode, setPasscode] = useState('')
  const [verify, setVerify] = useState('')
  const [email, setEmail] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // live validation
  const minLength = passcode.length >= 8
  const hasUpper = /[A-Z]/.test(passcode)
  const hasLower = /[a-z]/.test(passcode)
  const hasNumberOrSpecial = /[0-9]|[^A-Za-z0-9]/.test(passcode)
  const passAll = minLength && hasUpper && hasLower && hasNumberOrSpecial

  const submit = async (e) => {
    e?.preventDefault()
    try {
      plunk.currentTime = 0
      plunk.play().catch(() => {})
    } catch {}
    setError(null)
    if (!playerName || !passcode) {
      setError('Player name and passcode are required')
      return
    }
    if (passcode !== verify) {
      setError('Passcodes do not match')
      return
    }
    // Ensure passcode meets requirements
    const minLength = passcode.length >= 8
    const hasUpper = /[A-Z]/.test(passcode)
    const hasLower = /[a-z]/.test(passcode)
    const hasNumberOrSpecial = /[0-9]|[^A-Za-z0-9]/.test(passcode)
    if (!(minLength && hasUpper && hasLower && hasNumberOrSpecial)) {
      setError('Passcode does not meet the required complexity')
      return
    }
    setLoading(true)
    try {
  const res = await fetch('/api/auth/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ playerName, passcode, email, companyName })
        })
        let data = null
        try { data = await res.json() } catch (parseErr) { data = null }
        if (!res.ok) {
          const msg = data?.error || `Signup failed: ${res.status} ${res.statusText}`
          setError(msg)
          setLoading(false)
          return
        }
        if (!data || !data.ok) {
          setError(data?.error || 'Signup failed')
          setLoading(false)
          return
        }
      // success - notify parent
      setLoading(false)
      if (onSuccess) onSuccess(data.user)
      else onBack && onBack()
    } catch (e) {
      setError(e.message || 'Network error')
      setLoading(false)
    }
  }

  return (
    <div className="landing">
      <form className="auth-wrap" role="region" aria-label="Sign up form" onSubmit={submit}>
        <div className="gb-shell">
          <div className="gb-screen gb-screen--tall">
            <label className="gb-label">PLAYER NAME</label>
            <input className="gb-input" value={playerName} onChange={e => setPlayerName(e.target.value)} type="text" placeholder="Enter Player Name" />
            <label className="gb-label">PASSCODE</label>
            <input className="gb-input" value={passcode} onChange={e => setPasscode(e.target.value)} type="password" placeholder="Enter Passcode" />
            <label className="gb-label">VERIFY PASSCODE</label>
            <input className="gb-input" value={verify} onChange={e => setVerify(e.target.value)} type="password" placeholder="Verify Passcode" />
            <label className="gb-label">EMAIL ADDRESS</label>
            <input className="gb-input" value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder="Enter Email" />
            <label className="gb-label">COMPANY NAME</label>
            <input className="gb-input" value={companyName} onChange={e => setCompanyName(e.target.value)} type="text" placeholder="Enter Company Name" />
          </div>
        </div>
        {error && <div style={{ color: '#8b0000', fontSize: 12 }}>{error}</div>}
        <div className="auth-actions">
          <button className="btn btn-signup" type="submit" disabled={loading || !passAll}>{loading ? 'Please wait...' : 'Continue'}</button>
        </div>
        <div className="pass-reqs" aria-live="polite">
          <ul>
            <li className={minLength ? 'req met' : 'req unmet'}>At least 8 characters</li>
            <li className={hasUpper ? 'req met' : 'req unmet'}>One uppercase letter</li>
            <li className={hasLower ? 'req met' : 'req unmet'}>One lowercase letter</li>
            <li className={hasNumberOrSpecial ? 'req met' : 'req unmet'}>One number or special character</li>
          </ul>
        </div>
      </form>
      <footer className="site-footer">©️2025 Black Maige. Game the simulation.</footer>
    </div>
  )
}
