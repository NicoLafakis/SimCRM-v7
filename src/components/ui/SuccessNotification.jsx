import React from 'react'

export default function SuccessNotification({ message, onClose }) {
  return (
    <div className="success-flyout-overlay" onClick={onClose}>
      <div className="success-flyout" onClick={(e) => e.stopPropagation()}>
        <div className="success-icon">✓</div>
        <div className="success-message">{message}</div>
        <button type="button" className="btn btn-small" onClick={onClose}>OK</button>
      </div>
    </div>
  )
}
