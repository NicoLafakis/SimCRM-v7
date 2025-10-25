import HubSpotSetup from './components/HubSpotSetup'
import React, { useMemo, useState, useCallback, useEffect } from 'react'
import LandingPage from './components/LandingPage'
import AuthPage from './components/AuthPage'
import SignUpPage from './components/SignUpPage'
import VerificationIntro from './components/VerificationIntro'
import TetrisVerification from './components/TetrisVerification'
import pluckUrl from '../assets/gameboy-pluck.mp3'
import CornerLogo from './components/CornerLogo'
import SaaSSelection from './components/SaaS/SaaSSelection'
import ThemeSelection from './components/Themes/ThemeSelection'
import DistributionSelection from './components/Distribution/DistributionSelection'
import ScenarioSelection from './components/Scenario/ScenarioSelection'
import SimulationProgress from './components/Simulation/SimulationProgress'
import TimingQuantities from './components/Timing/TimingQuantities'
import UserMenu from './components/UserMenu'
import BoomboxPlayer from './components/BoomboxPlayer'
import { AudioProvider } from './audio/AudioContext'
import KonamiEasterEgg from './components/KonamiEasterEgg'
import BossDashboard from './components/BossDashboard'

const VIEWS = {
  LANDING: 'landing',
  AUTH: 'auth',
  SIGNUP: 'signup',
  VERIFY_INTRO: 'verify-intro',
  VERIFY_GAME: 'verify-game',
  DASHBOARD: 'dashboard',
  SAAS_SELECT: 'saas-select',
  HUBSPOT_SETUP: 'hubspot-setup',
  THEME_SELECT: 'theme-select',
  DISTRIBUTION_SELECT: 'distribution-select',
  SCENARIO_SELECT: 'scenario-select',
  TIMING_QUANTITIES: 'timing-quantities',
  SIM_PROGRESS: 'sim-progress',
  BOSS_DASH: 'boss-dash',
}

export default function App() {
  const [view, setView] = useState(VIEWS.LANDING)
  const [user, setUser] = useState(null)
  // Fetch user role after login (placeholder: assume API endpoint future /api/me )
  useEffect(() => {
    if (!user?.id) return
    // Could refetch to ensure role fresh
    ;(async () => {
      try {
        const resp = await fetch(`/api/users/${user.id}`)
        if (resp.ok) {
          const data = await resp.json()
          if (data?.user?.role && data.user.role !== user.role) {
            setUser(u => ({ ...u, role: data.user.role }))
          }
        }
      } catch {}
    })()
  }, [user?.id])
  const [pendingUser, setPendingUser] = useState(null)
  const audio = useMemo(() => {
    const a = new Audio(pluckUrl)
    a.volume = 0.25 // default plunk volume 25%
    return a
  }, [])
  const [scrolled, setScrolled] = useState(false)
  const [pendingSelections, setPendingSelections] = useState({ theme:null, distribution:null, scenario:null })
  const [activeSimulationId, setActiveSimulationId] = useState(null)
  const PLUNK_VOL_KEY = 'simcrm_plunk_volume'
  const [plunkVolume, setPlunkVolume] = useState(() => {
    const stored = localStorage.getItem(PLUNK_VOL_KEY)
    const v = stored ? parseFloat(stored) : 0.25
    if (!isNaN(v) && v >= 0 && v <= 1) return v
    return 0.25
  })
  const lastPlunkRef = React.useRef(0)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 120)
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const scrollToTop = useCallback(() => {
    try {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch {
      window.scrollTo(0, 0)
    }
  }, [])

  const playPlunk = useCallback(() => {
    const now = performance.now()
    if (now - lastPlunkRef.current < 150) return // debounce window
    lastPlunkRef.current = now
    try {
      audio.volume = plunkVolume
      audio.currentTime = 0
      audio.play().catch(() => {})
    } catch {}
  }, [audio, plunkVolume])

  // Persist plunk volume when changed
  useEffect(() => {
    try {
      localStorage.setItem(PLUNK_VOL_KEY, String(plunkVolume))
    } catch {}
  }, [plunkVolume])

  // Ensure audio element reflects stored volume on mount
  useEffect(() => {
    try { audio.volume = plunkVolume } catch {}
  }, [audio, plunkVolume])

  // Centralized logo click handler (returns to landing + sound)
  const handleLogoHome = useCallback(() => {
    playPlunk()
    setView(VIEWS.LANDING)
  }, [playPlunk])

  const handleLandingContinue = useCallback(() => {
    playPlunk()
    setView(VIEWS.AUTH)
  }, [playPlunk])

  const handleSignupSuccess = useCallback((newUser) => {
    playPlunk()
    setPendingUser(newUser)
    setView(VIEWS.VERIFY_INTRO)
  }, [playPlunk])

  const handleVerificationSuccess = useCallback(() => {
    if (!pendingUser) return
    setUser(pendingUser)
    setPendingUser(null)
    setView(VIEWS.SAAS_SELECT)
  }, [pendingUser])

  const handleSignOut = useCallback(() => {
    playPlunk()
    setUser(null)
    setPendingUser(null)
    setView(VIEWS.LANDING)
  }, [playPlunk])

  const renderBackToTop = scrolled ? (
    <button className="back-to-top" onClick={scrollToTop} aria-label="Back to top">↑</button>
  ) : null

  const renderView = () => {
    if (user && view === VIEWS.DASHBOARD) {
      return (
        <div className="landing dashboard-view">
          <CornerLogo onClick={handleLogoHome} />
          {renderBackToTop}
          <div className="dashboard-card">
            <h2>Welcome, {user.playerName}!</h2>
            <p>You are verified and ready to run the SimCRM console.</p>
            <button className="btn btn-primary" onClick={handleSignOut}>Sign out</button>
          </div>
          <footer className="site-footer">©️2025 Black Maige. Game the simulation.</footer>
        </div>
      )
    }

    switch (view) {
    case VIEWS.AUTH:
      return (
        <>
          <CornerLogo onClick={handleLogoHome} />
          {renderBackToTop}
          <AuthPage
            onSignup={() => {
              playPlunk()
              setView(VIEWS.SIGNUP)
            }}
            onLogin={(u) => {
              playPlunk()
              setUser(u)
              // Redirect directly to SaaS selection after login
              setView(VIEWS.SAAS_SELECT)
            }}
          />
        </>
      )
    case VIEWS.SIGNUP:
      return (
        <>
          <CornerLogo onClick={handleLogoHome} />
          {renderBackToTop}
          <SignUpPage onBack={() => setView(VIEWS.AUTH)} onSuccess={handleSignupSuccess} />
        </>
      )
    case VIEWS.VERIFY_INTRO:
      return (
        <>
          <CornerLogo onClick={handleLogoHome} />
          {renderBackToTop}
          <VerificationIntro
            onStart={() => {
              playPlunk()
              setView(VIEWS.VERIFY_GAME)
            }}
            onBack={() => setView(VIEWS.AUTH)}
          />
        </>
      )
    case VIEWS.VERIFY_GAME:
      return (
        <>
          <CornerLogo onClick={handleLogoHome} />
          {renderBackToTop}
          <TetrisVerification
            onSuccess={handleVerificationSuccess}
            onExit={() => {
              playPlunk()
              setView(VIEWS.VERIFY_INTRO)
            }}
          />
        </>
      )
    case VIEWS.SAAS_SELECT:
      return (
        <>
          <KonamiEasterEgg />
          <CornerLogo onClick={() => { playPlunk(); setView(VIEWS.LANDING) }} />
          {renderBackToTop}
          <UserMenu
            user={user}
            onSignOut={handleSignOut}
            playPlunk={playPlunk}
            onNav={(target) => {
              if (target === 'setup') return;
              if (target === 'boss') { setView(VIEWS.BOSS_DASH); return }
              console.log('Navigate to section:', target)
            }}
          />
          <SaaSSelection
            playPlunk={playPlunk}
            onSelect={(app) => {
              console.log('Selected app', app)
              playPlunk()
              if (app.id === 'hubspot') {
                setView(VIEWS.HUBSPOT_SETUP)
              } else {
                setView(VIEWS.THEME_SELECT)
              }
            }}
          />
        </>
      )
    case VIEWS.HUBSPOT_SETUP:
      return (
        <>
          <CornerLogo onClick={() => { playPlunk(); setView(VIEWS.LANDING) }} />
          {renderBackToTop}
          <UserMenu
            user={user}
            onSignOut={handleSignOut}
            playPlunk={playPlunk}
            onNav={(target) => {
              if (target === 'setup') return;
              if (target === 'boss') { setView(VIEWS.BOSS_DASH); return }
              console.log('Navigate to section:', target)
            }}
          />
          <HubSpotSetup
            user={user}
            playPlunk={playPlunk}
            onBack={() => setView(VIEWS.SAAS_SELECT)}
            onSkip={() => setView(VIEWS.THEME_SELECT)}
            onValidated={() => setView(VIEWS.THEME_SELECT)}
            onUserUpdate={(updates) => setUser(u => ({ ...u, ...updates }))}
          />
        </>
      )
    case VIEWS.THEME_SELECT:
      return (
        <>
          <CornerLogo onClick={handleLogoHome} />
          {renderBackToTop}
          <UserMenu
            user={user}
            onSignOut={handleSignOut}
            playPlunk={playPlunk}
            onNav={(target) => {
              if (target === 'setup') return;
              if (target === 'boss') { setView(VIEWS.BOSS_DASH); return }
              console.log('Navigate to section:', target)
            }}
          />
          <ThemeSelection
            playPlunk={playPlunk}
            onSelect={(theme) => {
              console.log('Selected theme', theme)
              playPlunk()
              setPendingSelections(s => ({ ...s, theme }))
              setView(VIEWS.SCENARIO_SELECT)
            }}
            onBack={() => setView(VIEWS.SAAS_SELECT)}
          />
        </>
      )
    case VIEWS.SCENARIO_SELECT:
      return (
        <>
          <CornerLogo onClick={handleLogoHome} />
          {renderBackToTop}
          <UserMenu
            user={user}
            onSignOut={handleSignOut}
            playPlunk={playPlunk}
            onNav={(target) => {
              if (target === 'setup') return;
              if (target === 'boss') { setView(VIEWS.BOSS_DASH); return }
              console.log('Navigate to section:', target)
            }}
          />
          <ScenarioSelection
            playPlunk={playPlunk}
            onBack={() => setView(VIEWS.THEME_SELECT)}
            onSelect={(scenario) => {
              playPlunk()
              console.log('Selected scenario', scenario)
              setPendingSelections(s => ({ ...s, scenario: scenario.id }))
              setView(VIEWS.DISTRIBUTION_SELECT)
            }}
          />
        </>
      )
    case VIEWS.DISTRIBUTION_SELECT:
      return (
        <>
          <CornerLogo onClick={handleLogoHome} />
          {renderBackToTop}
          <UserMenu
            user={user}
            onSignOut={handleSignOut}
            playPlunk={playPlunk}
            onNav={(target) => {
              if (target === 'setup') return;
              if (target === 'boss') { setView(VIEWS.BOSS_DASH); return }
              console.log('Navigate to section:', target)
            }}
          />
          <DistributionSelection
            playPlunk={playPlunk}
            onBack={() => setView(VIEWS.SCENARIO_SELECT)}
            onSelect={async (method) => {
              playPlunk()
              console.log('Selected distribution method', method)
              setPendingSelections(s => ({ ...s, distribution: method.id }))
              // Navigate to timing & quantities step (final confirmation before creating simulation)
              setView(VIEWS.TIMING_QUANTITIES)
            }}
          />
        </>
      )
    case VIEWS.TIMING_QUANTITIES:
      return (
        <>
          <CornerLogo onClick={handleLogoHome} />
          {renderBackToTop}
          <UserMenu
            user={user}
            onSignOut={handleSignOut}
            playPlunk={playPlunk}
            onNav={(target) => {
              if (target === 'setup') return;
              if (target === 'boss') { setView(VIEWS.BOSS_DASH); return }
              console.log('Navigate to section:', target)
            }}
          />
          <TimingQuantities
            playPlunk={playPlunk}
            initial={{ totalRecords: 200, scenarioId: pendingSelections.scenario, distributionMethod: pendingSelections.distribution }}
            userId={user?.id}
            hubspotKeyId={user?.hubspot_active_key_id}
            onBack={() => { playPlunk(); setView(VIEWS.DISTRIBUTION_SELECT) }}
            onConfirm={async ({ totalRecords, durationMinutes, batchSize, startDelaySec, jitterPct, maxConcurrency, pipelineId, ownerIds }) => {
              playPlunk()
              try {
                // Calculate startTime and endTime from duration settings
                const now = Date.now()
                const startTime = now + (startDelaySec || 0) * 1000  // Apply start delay
                const endTime = startTime + durationMinutes * 60 * 1000  // Convert minutes to ms

                const createResp = await fetch('/api/simulations', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    userId: user?.id,
                    scenario: pendingSelections.scenario,
                    distributionMethod: pendingSelections.distribution || 'linear',
                    totalRecords,
                    startTime,
                    endTime,
                    // Additional timing params for metadata storage
                    timing: { durationMinutes, batchSize, startDelaySec, jitterPct, maxConcurrency },
                    hubspot: { pipelineId, ownerIds }
                  })
                }).then(r => r.json())
                if (!createResp.ok) throw new Error(createResp.error || 'create failed')
                const simId = createResp.simulation.id
                setActiveSimulationId(simId)
                const startResp = await fetch(`/api/simulations/${simId}/start`, { method:'POST' }).then(r => r.json())
                if (!startResp.ok) throw new Error(startResp.error || 'start failed')
                setView(VIEWS.SIM_PROGRESS)
              } catch (e) {
                console.warn('Simulation start error:', e.message)
              }
            }}
          />
        </>
      )
    case VIEWS.SIM_PROGRESS:
      return (
        <>
          <CornerLogo onClick={handleLogoHome} />
          {renderBackToTop}
          <UserMenu
            user={user}
            onSignOut={handleSignOut}
            playPlunk={playPlunk}
            onNav={(target) => {
              if (target === 'setup') return;
              console.log('Navigate to section:', target)
            }}
          />
          <SimulationProgress
            playPlunk={playPlunk}
            simulationId={activeSimulationId}
            onBack={() => { playPlunk(); setView(VIEWS.DISTRIBUTION_SELECT) }}
          />
        </>
      )
    case VIEWS.BOSS_DASH:
      return (
        <>
          <CornerLogo onClick={handleLogoHome} />
          {renderBackToTop}
          <UserMenu
            user={user}
            onSignOut={handleSignOut}
            playPlunk={playPlunk}
            onNav={(target) => {
              if (target === 'setup') return;
              console.log('Navigate to section:', target)
            }}
          />
          <BossDashboard user={user} onExit={() => setView(VIEWS.LANDING)} />
        </>
      )
    default:
      return <LandingPage onContinue={handleLandingContinue} />
    }
  }

  return (
    <AudioProvider userLoggedIn={!!user}>
      {renderView()}
      {/* Global player always present */}
      <BoomboxPlayer />
    </AudioProvider>
  )
}
