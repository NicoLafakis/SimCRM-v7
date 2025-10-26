import React, { useState, useEffect } from 'react'

export default function ProfilePage({ user, onBack, playPlunk }) {
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [editing, setEditing] = useState(false)
  const [formData, setFormData] = useState({
    playerName: '',
    email: '',
    companyName: ''
  })
  const [saving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState(null)

  useEffect(() => {
    if (user?.id) {
      loadProfile()
    }
  }, [user?.id])

  const loadProfile = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/users/${user.id}`)
      if (!response.ok) throw new Error('Failed to load profile')
      const data = await response.json()
      if (data.user) {
        setProfile(data.user)
        setFormData({
          playerName: data.user.playerName || '',
          email: data.user.email || '',
          companyName: data.user.companyName || ''
        })
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleBack = () => {
    playPlunk?.()
    onBack?.()
  }

  const handleEdit = () => {
    playPlunk?.()
    setEditing(true)
    setSaveMessage(null)
  }

  const handleCancel = () => {
    playPlunk?.()
    setEditing(false)
    setFormData({
      playerName: profile.playerName || '',
      email: profile.email || '',
      companyName: profile.companyName || ''
    })
    setSaveMessage(null)
  }

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleSave = async () => {
    playPlunk?.()
    setSaving(true)
    setSaveMessage(null)
    try {
      const response = await fetch(`/api/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to save profile')
      }
      const data = await response.json()
      setProfile(data.user)
      setEditing(false)
      setSaveMessage({ type: 'success', text: 'Profile updated successfully!' })
      setTimeout(() => setSaveMessage(null), 3000)
    } catch (err) {
      setSaveMessage({ type: 'error', text: err.message })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="profile-page">
        <div className="profile-container">
          <button className="hs-back-btn" onClick={handleBack}>← Back</button>
          <div className="loading-message">Loading profile...</div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="profile-page">
        <div className="profile-container">
          <button className="hs-back-btn" onClick={handleBack}>← Back</button>
          <div className="error-message">Error: {error}</div>
          <button className="btn btn-primary" onClick={loadProfile}>Retry</button>
        </div>
      </div>
    )
  }

  return (
    <div className="profile-page">
      <div className="profile-container">
        <button className="hs-back-btn" onClick={handleBack}>← Back</button>

        <h1 className="profile-title">My Profile</h1>

        <div className="profile-content">
          <div className="profile-section">
            <h2>Account Information</h2>

            {!editing ? (
              <div className="profile-info">
                <div className="profile-field">
                  <label>Player Name</label>
                  <div className="profile-value">{profile?.playerName || '—'}</div>
                </div>

                <div className="profile-field">
                  <label>Email Address</label>
                  <div className="profile-value">{profile?.email || '—'}</div>
                </div>

                <div className="profile-field">
                  <label>Company Name</label>
                  <div className="profile-value">{profile?.companyName || '—'}</div>
                </div>

                <div className="profile-field">
                  <label>Role</label>
                  <div className="profile-value">
                    <span className={`role-badge ${profile?.role}`}>
                      {profile?.role === 'boss' ? 'Boss (Admin)' : 'Player'}
                    </span>
                  </div>
                </div>

                <div className="profile-field">
                  <label>Account Created</label>
                  <div className="profile-value">
                    {profile?.createdAt ? new Date(parseInt(profile.createdAt)).toLocaleDateString() : '—'}
                  </div>
                </div>

                <button className="btn btn-primary" onClick={handleEdit}>
                  Edit Profile
                </button>
              </div>
            ) : (
              <div className="profile-form">
                <div className="profile-field">
                  <label htmlFor="playerName">Player Name</label>
                  <input
                    id="playerName"
                    type="text"
                    className="gb-input"
                    value={formData.playerName}
                    onChange={(e) => handleChange('playerName', e.target.value)}
                    placeholder="Enter player name"
                  />
                </div>

                <div className="profile-field">
                  <label htmlFor="email">Email Address</label>
                  <input
                    id="email"
                    type="email"
                    className="gb-input"
                    value={formData.email}
                    onChange={(e) => handleChange('email', e.target.value)}
                    placeholder="Enter email address"
                  />
                </div>

                <div className="profile-field">
                  <label htmlFor="companyName">Company Name</label>
                  <input
                    id="companyName"
                    type="text"
                    className="gb-input"
                    value={formData.companyName}
                    onChange={(e) => handleChange('companyName', e.target.value)}
                    placeholder="Enter company name"
                  />
                </div>

                <div className="profile-actions">
                  <button
                    className="btn btn-primary"
                    onClick={handleSave}
                    disabled={saving}
                  >
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                  <button
                    className="btn btn-secondary"
                    onClick={handleCancel}
                    disabled={saving}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {saveMessage && (
              <div className={`save-message ${saveMessage.type}`}>
                {saveMessage.text}
              </div>
            )}
          </div>

          <div className="profile-section">
            <h2>Security</h2>
            <div className="profile-info">
              <div className="profile-field">
                <label>Password</label>
                <div className="profile-value">••••••••</div>
              </div>
              <button className="btn btn-secondary" disabled>
                Change Password (Coming Soon)
              </button>
              <p className="profile-note">
                Password reset functionality will be available in a future update.
                Contact support@simcrm.app if you need to reset your password.
              </p>
            </div>
          </div>

          <div className="profile-section">
            <h2>HubSpot Connection</h2>
            <div className="profile-info">
              <p className="profile-note">
                Manage your HubSpot connection and tokens through the Setup page.
              </p>
              <button className="btn btn-secondary" onClick={() => {
                playPlunk?.()
                // TODO: Navigate to HubSpot setup
              }}>
                Go to HubSpot Setup
              </button>
            </div>
          </div>

          <div className="profile-section danger-zone">
            <h2>Danger Zone</h2>
            <div className="profile-info">
              <button className="btn btn-danger" disabled>
                Delete Account (Coming Soon)
              </button>
              <p className="profile-note">
                Account deletion will permanently remove all your data, simulations, and settings.
                This action cannot be undone.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
