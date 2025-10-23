import React, { useEffect, useState, useCallback } from 'react'

// Required scopes (read + write) for core CRM objects & engagements.
// These strings mirror HubSpot's public scope naming conventions.
// Custom object write sometimes implicit; include schema read for dynamic metadata.
const REQUIRED_SCOPES = [
  // Contacts
  'crm.objects.contacts.read',
  'crm.objects.contacts.write',
  // Companies
  'crm.objects.companies.read',
  'crm.objects.companies.write',
  // Deals
  'crm.objects.deals.read',
  'crm.objects.deals.write',
  // Tickets
  'crm.objects.tickets.read',
  'crm.objects.tickets.write',
  // Notes
  'crm.objects.notes.read',
  'crm.objects.notes.write',
  // Calls
  'crm.objects.calls.read',
  'crm.objects.calls.write',
  // Tasks
  'crm.objects.tasks.read',
  'crm.objects.tasks.write',
  // Custom Objects (generic label; read/write)
  'crm.objects.custom.read',
  'crm.objects.custom.write',
  // Custom object schema access (read schema for properties/models)
  'crm.schemas.custom.read'
]

export default function HubSpotSetup({ onBack, onSkip, onValidated, playPlunk, user, onUserUpdate }) {
  if (!user?.id) {
    return <div className="hubspot-setup"><p className="hs-error">User context missing. Please log in again.</p></div>
  }
  const userId = user.id

  const [keys, setKeys] = useState([]) // [{id,label,createdAt,...}]
  const [selectedId, setSelectedId] = useState('')
  const [adding, setAdding] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const [newValue, setNewValue] = useState('')
  const [scopesOpen, setScopesOpen] = useState(false)
  const [validating, setValidating] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  const fetchKeys = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/hubspot/keys?userId=${encodeURIComponent(userId)}`)
      const data = await res.json()
      if (!data.ok) throw new Error(data.error || 'Failed to load keys')
      setKeys(data.keys)
      if (data.keys.length && !selectedId) setSelectedId(data.keys[0].id)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [selectedId, userId])

  useEffect(() => { fetchKeys() }, [fetchKeys])

  const startAdd = () => { setAdding(true); setNewLabel(''); setNewValue(''); setError(''); playPlunk?.() }
  const cancelAdd = () => { setAdding(false); setNewLabel(''); setNewValue(''); }

  const saveNew = async () => {
    if (!newLabel.trim() || !newValue.trim()) { setError('Label and value required'); return }
    setError('')
    try {
      const res = await fetch('/api/hubspot/keys', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, label: newLabel.trim(), token: newValue.trim() })
      })
      const data = await res.json()
      if (!data.ok) throw new Error(data.error || 'Failed to save key')
      playPlunk?.()
      setAdding(false)
      setNewLabel('')
      setNewValue('')
      // refetch list to include new key and select it
      await fetchKeys()
      if (data.key?.id) setSelectedId(data.key.id)
    } catch (e) {
      setError(e.message)
    }
  }

  const deleteCurrent = async () => {
    if (!selectedId) return
    if (!window.confirm('Delete selected key?')) return
    try {
      const res = await fetch(`/api/hubspot/keys/${encodeURIComponent(selectedId)}?userId=${encodeURIComponent(userId)}`, { method: 'DELETE' })
      const data = await res.json()
      if (!data.ok) throw new Error(data.error || 'Failed to delete key')
      playPlunk?.()
      await fetchKeys()
      setSelectedId('')
    } catch (e) { setError(e.message) }
  }

  const validate = useCallback(async () => {
    if (!selectedId) return
    setValidating(true); setError(''); setSuccess(false)
    playPlunk?.()
    try {
      const res = await fetch('/api/hubspot/validate', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ userId, keyId: selectedId }) })
      const data = await res.json()
      if (!data.ok) throw new Error(data.error || 'Validation failed')
      setSuccess(true)
      // Update user object with the validated key ID
      onUserUpdate?.({ hubspot_active_key_id: selectedId })
      setTimeout(() => { onValidated?.() }, 800)
    } catch (e) {
      setError(e.message)
    } finally {
      setValidating(false)
    }
  }, [selectedId, onValidated, onUserUpdate, playPlunk, userId])

  return (
    <div className="hubspot-setup" role="main" aria-labelledby="hs-setup-title">
      <h1 id="hs-setup-title" className="hs-setup-title">HUBSPOT SETUP</h1>
      <p className="hs-setup-sub">Connect your HubSpot account to start simulating</p>
      <p className="hs-setup-player">Player: Admin | Tier: | Credits:</p>

      <h2 className="hs-config-head" aria-level={2}>API CONFIGURATION</h2>

      <section className="hs-key-section" aria-labelledby="hs-api-keys">
        <h3 id="hs-api-keys" className="hs-section-label">HUBSPOT API KEYS</h3>
        {!adding && (
          <div className="hs-key-row">
            <select
              className="hs-key-select"
              value={selectedId || ''}
              onChange={(e) => setSelectedId(e.target.value)}
              aria-label="Select stored HubSpot key"
            >
              <option value="" disabled>{loading ? 'Loading...' : (keys.length ? 'Select a key' : 'No keys stored')}</option>
              {keys.map(k => <option key={k.id} value={k.id}>{k.label}</option>)}
            </select>
            <button type="button" className="hs-add-key" onClick={startAdd}>+ Add New Key</button>
            {!!selectedId && <button type="button" className="hs-add-key" onClick={deleteCurrent} aria-label="Delete selected key">✕ Delete</button>}
          </div>
        )}
        {adding && (
          <div className="hs-add-form">
            <input
              className="hs-new-label"
              placeholder="Label (e.g. Dax's Key)"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
            />
            <textarea
              className="hs-new-value"
              placeholder="Paste private app access token"
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              rows={3}
            />
            <div className="hs-add-actions">
              <button type="button" className="btn btn-secondary" onClick={cancelAdd}>Cancel</button>
              <button type="button" className="btn btn-primary" onClick={saveNew}>Save Key</button>
            </div>
          </div>
        )}
      </section>

      <section className="hs-instructions" aria-labelledby="hs-quick-setup">
        <h3 id="hs-quick-setup" className="hs-section-label">Quick Setup Instructions:</h3>
        <ol className="hs-steps">
          <li>Go to HubSpot → Settings → Integrations → Private Apps</li>
          <li>Create a new private app with the required scopes below</li>
          <li>Copy the access token and paste it above</li>
          <li>Click "Connect" to enable simulation features</li>
        </ol>
      </section>

      <section className="hs-scopes" aria-labelledby="hs-required-scopes">
        <button type="button" id="hs-required-scopes" className="hs-scopes-toggle" aria-expanded={scopesOpen} onClick={() => setScopesOpen(o=>!o)}>
          <span>Required HubSpot API Scopes:</span>
          <span className="hs-arrow" aria-hidden="true">{scopesOpen ? '▾' : '▸'}</span>
        </button>
        {scopesOpen && (
          <ul className="hs-scope-list">
            {REQUIRED_SCOPES.map(s => <li key={s}>{s}</li>)}
          </ul>
        )}
      </section>

      {error && <p className="hs-error" role="alert">{error}</p>}
      {success && <p className="hs-success" role="status">Connected! Redirecting…</p>}

      <div className="hs-actions">
        <button
          type="button"
          className="btn btn-primary hs-connect"
          disabled={!selectedId || validating}
          onClick={validate}
        >{validating ? 'VALIDATING…' : 'CONNECT & VALIDATE'}</button>
        <button
          type="button"
          className="btn btn-secondary hs-skip"
          onClick={() => { playPlunk?.(); onSkip?.() }}
        >SKIP FOR NOW</button>
      </div>
      <p className="hs-back-link"><button type="button" className="hs-back-btn" onClick={() => { playPlunk?.(); onBack?.() }}>← Back to SaaS Selection</button></p>
    </div>
  )
}
