import React, { useState, useRef, useEffect } from 'react'

// Floating user menu appearing after verification/login.
// Simple internal toggle; future profile/settings hooks can extend.
export default function UserMenu({ user, onSignOut, onNav, playPlunk }) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    const onClickDoc = (e) => {
      if (!wrapRef.current) return
      if (!wrapRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onClickDoc)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onClickDoc)
    }
  }, [])

  const toggle = () => { playPlunk?.(); setOpen(o => !o) }
  const handleSignOut = () => { playPlunk?.(); onSignOut?.() }
  const nav = (target) => { playPlunk?.(); onNav?.(target); setOpen(false) }

  if (!user) return null
  return (
    <div ref={wrapRef} className={`user-menu${open ? ' is-open' : ''}`}>
      <button
        type="button"
        className="user-menu-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={toggle}
      >
        <span className="user-menu-initial" aria-hidden="true">{(user.playerName || user.email || '?').slice(0,1).toUpperCase()}</span>
        <span className="user-menu-label">{user.playerName || 'Player'}</span>
      </button>
      <div className="user-menu-pop" role="menu" aria-hidden={!open}>
        <div className="user-menu-head">Signed in as<br/><strong>{user.playerName || user.email}</strong></div>
        <div className="user-menu-items">
          <button role="menuitem" className="user-menu-item" onClick={() => nav('setup')}>Setup</button>
          <button role="menuitem" className="user-menu-item" onClick={() => nav('simulations')}>Simulations</button>
          <button role="menuitem" className="user-menu-item" onClick={() => nav('history')}>History</button>
          <button role="menuitem" className="user-menu-item" onClick={() => nav('profile')}>Profile</button>
          {user.role === 'boss' && (
            <button role="menuitem" className="user-menu-item" onClick={() => nav('boss')}>Boss</button>
          )}
        </div>
        <button role="menuitem" className="user-menu-item signout" onClick={handleSignOut}>Sign out</button>
      </div>
    </div>
  )
}
