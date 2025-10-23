import React from 'react'
import logoUrl from '../../assets/simcrm_no_background.png'

export default function LandingPage({ onContinue }) {
  return (
    <div className="landing" onClick={onContinue}>
      {/* Menu removed as requested */}

      {/* Center logo image and subtitle */}
      <div className="logo-wrap">
        <img className="logo-img" src={logoUrl} alt="SimCRM logo" />
        <p className="cta">Click anywhere to continue...</p>
      </div>

      {/* Audio player removed as requested */}

      {/* Footer */}
      <footer className="site-footer">©️2025 Black Maige. Game the simulation.</footer>
    </div>
  )
}
