import React, { useState, useEffect } from 'react'

export default function HistoryPage({ user, onBack, playPlunk }) {
  const [simulations, setSimulations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filter, setFilter] = useState('all') // all, running, completed, failed

  useEffect(() => {
    if (user?.id) {
      loadHistory()
    }
  }, [user?.id])

  const loadHistory = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/simulations?user_id=${user.id}`)
      if (!response.ok) throw new Error('Failed to load simulation history')
      const data = await response.json()
      setSimulations(data.simulations || [])
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

  const handleFilterChange = (newFilter) => {
    playPlunk?.()
    setFilter(newFilter)
  }

  const filteredSimulations = simulations.filter(sim => {
    if (filter === 'all') return true
    if (filter === 'running') return sim.status === 'RUNNING' || sim.status === 'PENDING'
    if (filter === 'completed') return sim.status === 'COMPLETED'
    if (filter === 'failed') return sim.status === 'FAILED'
    return true
  })

  const getStatusClass = (status) => {
    switch (status) {
      case 'COMPLETED': return 'status-completed'
      case 'RUNNING': return 'status-running'
      case 'PENDING': return 'status-pending'
      case 'FAILED': return 'status-failed'
      default: return ''
    }
  }

  const formatDate = (timestamp) => {
    if (!timestamp) return '—'
    const date = new Date(parseInt(timestamp))
    return date.toLocaleString()
  }

  const formatDuration = (startTime, endTime) => {
    if (!startTime || !endTime) return '—'
    const start = parseInt(startTime)
    const end = parseInt(endTime)
    const durationMs = end - start
    const hours = Math.floor(durationMs / (1000 * 60 * 60))
    const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60))

    if (hours > 0) {
      return `${hours}h ${minutes}m`
    }
    return `${minutes}m`
  }

  if (loading) {
    return (
      <div className="history-page">
        <div className="history-container">
          <button className="hs-back-btn" onClick={handleBack}>← Back</button>
          <div className="loading-message">Loading simulation history...</div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="history-page">
        <div className="history-container">
          <button className="hs-back-btn" onClick={handleBack}>← Back</button>
          <div className="error-message">Error: {error}</div>
          <button className="btn btn-primary" onClick={loadHistory}>Retry</button>
        </div>
      </div>
    )
  }

  return (
    <div className="history-page">
      <div className="history-container">
        <button className="hs-back-btn" onClick={handleBack}>← Back</button>

        <h1 className="history-title">Simulation History</h1>
        <p className="history-subtitle">
          Showing {filteredSimulations.length} of {simulations.length} simulations
        </p>

        <div className="history-filters">
          <button
            className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
            onClick={() => handleFilterChange('all')}
          >
            All
          </button>
          <button
            className={`filter-btn ${filter === 'running' ? 'active' : ''}`}
            onClick={() => handleFilterChange('running')}
          >
            Running
          </button>
          <button
            className={`filter-btn ${filter === 'completed' ? 'active' : ''}`}
            onClick={() => handleFilterChange('completed')}
          >
            Completed
          </button>
          <button
            className={`filter-btn ${filter === 'failed' ? 'active' : ''}`}
            onClick={() => handleFilterChange('failed')}
          >
            Failed
          </button>
        </div>

        <div className="history-content">
          {filteredSimulations.length === 0 ? (
            <div className="history-empty">
              <p>No simulations found.</p>
              {filter !== 'all' && (
                <button className="btn btn-secondary" onClick={() => handleFilterChange('all')}>
                  Show All Simulations
                </button>
              )}
            </div>
          ) : (
            <div className="history-list">
              {filteredSimulations.map((sim) => (
                <div key={sim.id} className="history-item">
                  <div className="history-item-header">
                    <div className="history-item-id">
                      <code>{sim.id.slice(0, 8)}</code>
                      <span className={`history-status ${getStatusClass(sim.status)}`}>
                        {sim.status}
                      </span>
                    </div>
                    <div className="history-item-date">
                      {formatDate(sim.created_at)}
                    </div>
                  </div>

                  <div className="history-item-details">
                    <div className="history-detail">
                      <label>Scenario:</label>
                      <span>{sim.scenario || '—'}</span>
                    </div>
                    <div className="history-detail">
                      <label>Distribution:</label>
                      <span>{sim.distribution_method || '—'}</span>
                    </div>
                    <div className="history-detail">
                      <label>Records:</label>
                      <span>{sim.total_records || 0}</span>
                    </div>
                    <div className="history-detail">
                      <label>Duration:</label>
                      <span>{formatDuration(sim.start_time, sim.end_time)}</span>
                    </div>
                  </div>

                  {sim.hubspot_pipeline_id && (
                    <div className="history-item-hubspot">
                      <div className="history-detail">
                        <label>Pipeline:</label>
                        <span>{sim.hubspot_pipeline_id}</span>
                      </div>
                      {sim.hubspot_owner_ids && (
                        <div className="history-detail">
                          <label>Owners:</label>
                          <span>{JSON.parse(sim.hubspot_owner_ids).length} selected</span>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="history-item-actions">
                    <button
                      className="btn btn-small btn-secondary"
                      onClick={() => {
                        playPlunk?.()
                        // TODO: View simulation details
                        console.log('View details:', sim.id)
                      }}
                    >
                      View Details
                    </button>
                    {sim.status === 'COMPLETED' && (
                      <button
                        className="btn btn-small btn-secondary"
                        onClick={() => {
                          playPlunk?.()
                          // TODO: Cleanup simulation
                          console.log('Cleanup:', sim.id)
                        }}
                      >
                        Cleanup
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="history-footer">
          <button className="btn btn-primary" onClick={loadHistory}>
            Refresh
          </button>
        </div>
      </div>
    </div>
  )
}
