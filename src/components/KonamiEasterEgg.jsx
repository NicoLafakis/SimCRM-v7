import React, { useEffect, useRef, useState } from 'react'
import { useAudio } from '../audio/AudioContext'
import contraImg from '../../assets/contra-title-screen.png'
import contraMusic from '../../assets/contra-title-screen-music.mp3'

/*
 * Konami code listener: Up Up Down Down Left Right Left Right B A Enter
 * On success: show full-screen overlay with Contra title image & play music.
 * When music ends (or user presses Escape), restore previous UI/audio state.
 */
export default function KonamiEasterEgg() {
  const sequence = ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a','Enter']
  const positionRef = useRef(0)
  const [active, setActive] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const eggAudioRef = useRef(null)
  const priorBoomboxState = useRef({ wasPlaying: false, trackTime: 0 })
  const boombox = useAudio()

  // Preload image silently
  useEffect(() => {
    const img = new Image()
    img.src = contraImg
    img.onload = () => setLoaded(true)
  }, [])

  useEffect(() => {
    if (!active) return
    // Create dedicated audio element for egg
    const el = new Audio(contraMusic)
    eggAudioRef.current = el
    if (boombox?.audio) {
      // store state & pause boombox
      priorBoomboxState.current.wasPlaying = !boombox.audio.paused
      try { priorBoomboxState.current.trackTime = boombox.audio.currentTime } catch {}
      boombox.audio.pause()
      if (boombox.setIsPlaying) boombox.setIsPlaying(false)
    }
    el.play().catch(()=>{})
    const cleanup = () => {
      setActive(false)
      // restore boombox playback if it was playing
      if (boombox?.audio) {
        try { boombox.audio.currentTime = priorBoomboxState.current.trackTime || 0 } catch {}
        if (priorBoomboxState.current.wasPlaying) {
          boombox.audio.play().then(()=> {
            if (boombox.setIsPlaying) boombox.setIsPlaying(true)
          }).catch(()=>{})
        }
      }
    }
    el.addEventListener('ended', cleanup)
    return () => {
      el.removeEventListener('ended', cleanup)
      el.pause()
    }
  }, [active, boombox])

  useEffect(() => {
    const onKey = (e) => {
      if (active) {
        if (e.key === 'Escape') {
          e.preventDefault()
          // manual abort
          if (eggAudioRef.current) eggAudioRef.current.pause()
          setActive(false)
          // restore if needed
          if (boombox?.audio && priorBoomboxState.current.wasPlaying) {
            boombox.audio.play().then(()=> { if (boombox.setIsPlaying) boombox.setIsPlaying(true) }).catch(()=>{})
          }
        }
        return
      }
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key
      const expected = sequence[positionRef.current]
      if (key === expected) {
        positionRef.current += 1
        if (positionRef.current === sequence.length) {
          positionRef.current = 0
          setActive(true)
        }
      } else {
        // Reset if partially matched and user diverges (classic behavior)
        positionRef.current = 0
        // Re-check if this key is the start of sequence (covers immediate restart after mismatch)
        if (key === sequence[0]) positionRef.current = 1
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active])

  if (!active) return null
  return (
    <div className="konami-overlay" role="dialog" aria-label="Contra Title Screen" aria-modal="true">
      <img src={contraImg} alt="Contra Title" className="konami-image" draggable={false} />
      {!loaded && <div className="konami-loading">LOADING...</div>}
    </div>
  )
}
