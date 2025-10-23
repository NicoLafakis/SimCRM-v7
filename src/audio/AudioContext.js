import React, { createContext, useContext, useRef, useState, useCallback, useEffect } from 'react'

// Lightweight audio context to be extended later with playlist logic.
const AudioCtx = createContext(null)

export function AudioProvider({ children, userLoggedIn = false }) {
  const audioRef = useRef(new Audio())
  const [expanded, setExpanded] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  // Dynamic playlist discovery using Vite import.meta.glob for all SimCRM-*.mp3 in assets
  // This builds a module map: { './path/to/file.mp3': () => import(...) }
  const discovered = import.meta.glob('/assets/SimCRM-*.mp3', { eager: true, import: 'default' })
  const tracks = Object.entries(discovered).map(([fullPath, src]) => {
    const file = fullPath.split('/').pop() || ''
    const base = file.replace(/\.mp3$/i, '')
    return { id: base.toLowerCase(), title: base, src }
  })
  // Ensure Adventure first if present
  tracks.sort((a,b) => {
    if (a.title === 'SimCRM-Adventure') return -1
    if (b.title === 'SimCRM-Adventure') return 1
    return a.title.localeCompare(b.title)
  })
  const playlist = useRef(tracks)
  const [index, setIndex] = useState(0)
  const [track, setTrack] = useState(null) // { src, title }
  // Default volume lowered per requirement (15%) unless restored from persisted state
  const [volume, setVolume] = useState(0.15)
  const autoplayAttempted = useRef(false)
  const [muted, setMuted] = useState(false)
  const [pinned, setPinned] = useState(false)
  const [time, setTime] = useState(0)
  const [duration, setDuration] = useState(0)

  const toggleExpanded = useCallback(() => setExpanded(e => !e), [])
  const toggleMute = useCallback(() => {
    setMuted(m => {
      const next = !m
      if (audioRef.current) audioRef.current.muted = next
      try {
        const existingRaw = localStorage.getItem('simcrm_audio_state')
        const existing = existingRaw ? JSON.parse(existingRaw) : {}
        existing.muted = next
        localStorage.setItem('simcrm_audio_state', JSON.stringify(existing))
      } catch {}
      return next
    })
  }, [])
  const togglePinned = useCallback(() => {
    setPinned(p => {
      const next = !p
      if (next) setExpanded(true)
      try {
        const existingRaw = localStorage.getItem('simcrm_audio_state')
        const existing = existingRaw ? JSON.parse(existingRaw) : {}
        existing.pinned = next
        localStorage.setItem('simcrm_audio_state', JSON.stringify(existing))
      } catch {}
      return next
    })
  }, [])

  const setAndPlay = useCallback((t) => {
    setTrack(t)
    const el = audioRef.current
    if (!el) return
    el.src = t.src
    el.volume = volume
    el.currentTime = 0
    el.play().then(() => setIsPlaying(true)).catch(() => {})
  }, [volume])

  const togglePlay = useCallback(() => {
    const el = audioRef.current
    if (!el) return
    if (el.paused) {
      el.play().then(() => setIsPlaying(true)).catch(()=>{})
    } else {
      el.pause(); setIsPlaying(false)
    }
  }, [])

  const changeVolume = useCallback((v) => {
    const clamped = Math.min(1, Math.max(0, v))
    setVolume(clamped)
    if (audioRef.current) audioRef.current.volume = clamped
    // Immediate persistence so state is saved even if not currently playing yet
    try {
      const el = audioRef.current
      localStorage.setItem('simcrm_audio_state', JSON.stringify({
        index,
        time: el ? el.currentTime : 0,
        volume: clamped,
        expanded,
      }))
    } catch {}
  }, [index, expanded])

  // Navigation helpers
  const next = useCallback(() => {
    setIndex(i => {
      const ni = (i + 1) % playlist.current.length
      setAndPlay(playlist.current[ni])
      return ni
    })
  }, [setAndPlay])

  const prev = useCallback(() => {
    setIndex(i => {
      const ni = (i - 1 + playlist.current.length) % playlist.current.length
      setAndPlay(playlist.current[ni])
      return ni
    })
  }, [setAndPlay])

  // Auto-load first track on mount
  // Restore persisted state on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem('simcrm_audio_state')
      if (raw) {
        const parsed = JSON.parse(raw)
        if (userLoggedIn && typeof parsed.volume === 'number') {
          setVolume(parsed.volume)
          if (audioRef.current) audioRef.current.volume = parsed.volume
        }
        if (userLoggedIn && typeof parsed.index === 'number' && playlist.current[parsed.index]) {
          setIndex(parsed.index)
          setTrack(playlist.current[parsed.index])
          if (audioRef.current) {
            audioRef.current.src = playlist.current[parsed.index].src
            if (typeof parsed.time === 'number') {
              audioRef.current.currentTime = parsed.time
            }
          }
        }
        if (userLoggedIn && typeof parsed.expanded === 'boolean') setExpanded(parsed.expanded)
        if (userLoggedIn && typeof parsed.muted === 'boolean') {
          setMuted(parsed.muted)
          if (audioRef.current) audioRef.current.muted = parsed.muted
        }
        if (userLoggedIn && typeof parsed.pinned === 'boolean') {
          setPinned(parsed.pinned)
          if (parsed.pinned) setExpanded(true)
        }
        // If not logged in, ignore persisted track/time; always load Adventure first
        if (!userLoggedIn && playlist.current.length) {
          const first = playlist.current[0]
          setTrack(first)
          const el = audioRef.current
          el.src = first.src
          el.volume = volume
          attemptAutoplay(el)
        }
      } else if (!track && playlist.current.length) {
        // Default initialization: load first track (SimCRM-Adventure sorted first if present)
        const first = playlist.current[0]
        setTrack(first)
        const el = audioRef.current
        el.src = first.src
        el.volume = volume
        attemptAutoplay(el)
      }
    } catch {
      // ignore corrupt state
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function attemptAutoplay(el){
    if (autoplayAttempted.current) return
    autoplayAttempted.current = true
    el.play().then(() => setIsPlaying(true)).catch(() => {
      const resume = () => {
        el.play().then(() => setIsPlaying(true)).catch(()=>{})
        window.removeEventListener('pointerdown', resume)
        window.removeEventListener('keydown', resume)
      }
      window.addEventListener('pointerdown', resume, { once: true })
      window.addEventListener('keydown', resume, { once: true })
    })
  }

  // Persist state on changes (throttle via requestAnimationFrame for time updates)
  useEffect(() => {
    let frame
    const el = audioRef.current
    const persist = () => {
      try {
        const payload = {
          index,
            // store time only if playing for continuity
          time: el && !el.paused ? el.currentTime : (el ? el.currentTime : 0),
          volume,
          expanded,
          muted,
          pinned,
        }
        localStorage.setItem('simcrm_audio_state', JSON.stringify(payload))
      } catch {}
      if (el && !el.paused) frame = requestAnimationFrame(persist)
    }
    // kick off if playing
    if (el && !el.paused) frame = requestAnimationFrame(persist)
    return () => { if (frame) cancelAnimationFrame(frame) }
  }, [index, volume, expanded, isPlaying])

  // Auto-advance when a track ends
  useEffect(() => {
    const el = audioRef.current
    if (!el) return
    const onTime = () => {
      setTime(el.currentTime || 0)
      if (!isNaN(el.duration)) setDuration(el.duration)
    }
    const onMeta = () => { if (!isNaN(el.duration)) setDuration(el.duration) }
    const onEnd = () => next()
    el.addEventListener('ended', onEnd)
    el.addEventListener('timeupdate', onTime)
    el.addEventListener('loadedmetadata', onMeta)
    return () => {
      el.removeEventListener('ended', onEnd)
      el.removeEventListener('timeupdate', onTime)
      el.removeEventListener('loadedmetadata', onMeta)
    }
  }, [next])

  const value = {
    audio: audioRef.current,
    track,
    isPlaying,
    volume,
    expanded,
    toggleExpanded,
    togglePlay,
    setAndPlay,
    changeVolume,
    playlist: playlist.current,
    index,
    next,
    prev,
    setTrack,
    setIsPlaying,
    muted,
    toggleMute,
    pinned,
    togglePinned,
    time,
    duration,
  }

  // Global 'm' keyboard shortcut to toggle mute (case-insensitive)
  useEffect(() => {
    const onKey = (e) => {
      // ignore if typing in an editable field
      const target = e.target
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return
      if (e.key && e.key.toLowerCase() === 'm') {
        e.preventDefault()
        toggleMute()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [toggleMute])

  // Avoid JSX so this file can stay .js without requiring JSX transform in build.
  return React.createElement(AudioCtx.Provider, { value }, children)
}

export function useAudio() {
  return useContext(AudioCtx)
}
