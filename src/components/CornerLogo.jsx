import React from 'react'
import logoUrl from '../../assets/simcrm_no_background.png'

export default function CornerLogo({ onClick }) {
  return (
    <button className="corner-logo" onClick={onClick} aria-label="Go to landing">
      <img src={logoUrl} alt="SimCRM" />
    </button>
  )
}
