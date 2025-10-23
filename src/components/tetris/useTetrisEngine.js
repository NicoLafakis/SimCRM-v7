import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BOARD_HEIGHT, BOARD_WIDTH, getRandomPiece, TETROMINOES, PIECE_TYPES } from './tetrominoes'

const DROP_INTERVAL = 800 // default gravity interval (enhanced mode)
const SPAWN_POSITION = { x: 3, y: -2 }

// Gravity table placeholder (will be used when level scaling added)
const GRAVITY_TABLE_MS = [800,720,630,550,470,380,300,220,130,80,70,60,50,45,40,35,30,25,20,18,16]

const baseConfig = {
  mode: 'enhanced', // 'enhanced' | 'classic'
  hardDrop: true,
  softDrop: false,
  rotateBoth: false,
  das: { enabled: false, delay: 170, arr: 50 }, // ms
  gravity: { scaling: false, startLevel: 0 },
  preview: true,
  ghost: true,
  lineClearDelayMs: 0,
  randomizer: 'pure', // 'pure' | 'bag7' (future)
}

const classicOverrides = {
  hardDrop: false,
  softDrop: true,
  rotateBoth: true,
  das: { enabled: true, delay: 170, arr: 50 },
  gravity: { scaling: true, startLevel: 0 },
  preview: false,
  ghost: false,
  lineClearDelayMs: 250,
  randomizer: 'pure',
}

function createEmptyBoard() {
  return Array.from({ length: BOARD_HEIGHT }, () => Array(BOARD_WIDTH).fill(null))
}

function getCellsForPiece(piece, position) {
  const shape = TETROMINOES[piece.type].rotations[piece.rotation]
  // Rotation origin note:
  // We rely on the raw rotation matrices defined in TETROMINOES. No Super Rotation System (SRS) kicks
  // are applied. If a rotated matrix would collide or go out of bounds, the rotation fails silently.
  // This matches classic Game Boy-era behavior (strict rotation; no wall/floor kicks). The O piece
  // effectively has identical matrices so rotation becomes a visual no-op.
  const cells = []
  for (let y = 0; y < shape.length; y++) {
    for (let x = 0; x < shape[y].length; x++) {
      if (shape[y][x]) cells.push({ x: position.x + x, y: position.y + y })
    }
  }
  return cells
}

function isValidPosition(board, piece, position) {
  const cells = getCellsForPiece(piece, position)
  return cells.every(({ x, y }) => {
    if (x < 0 || x >= BOARD_WIDTH || y >= BOARD_HEIGHT) return false
    if (y < 0) return true
    return !board[y][x]
  })
}

function mergePiece(board, piece, position) {
  const next = board.map(row => row.slice())
  const cells = getCellsForPiece(piece, position)
  const color = TETROMINOES[piece.type].color
  cells.forEach(({ x, y }) => {
    if (y >= 0 && y < BOARD_HEIGHT && x >= 0 && x < BOARD_WIDTH) {
      next[y][x] = { type: piece.type, color }
    }
  })
  return next
}

function clearFullLines(board) {
  const remaining = board.filter(row => row.some(cell => !cell))
  const cleared = BOARD_HEIGHT - remaining.length
  const newBoard = Array.from({ length: cleared }, () => Array(BOARD_WIDTH).fill(null)).concat(remaining)
  return { cleared, board: newBoard }
}

// Randomizer strategy abstraction (currently supports 'pure' and 'bag7')
function drawPiece(randomizer, bagRef) {
  if (randomizer === 'bag7') {
    if (!bagRef.current || bagRef.current.length === 0) {
      // Refill & shuffle bag
      bagRef.current = [...PIECE_TYPES]
        .map(t => ({ t, r: Math.random() }))
        .sort((a, b) => a.r - b.r)
        .map(o => o.t)
    }
    const type = bagRef.current.pop()
    return { type, rotation: 0 }
  }
  // Fallback / 'pure'
  return getRandomPiece()
}

export function useTetrisEngine({ onWin, linesTarget = 1, onFail, mode = 'enhanced', configOverrides }) {
  // Merge configuration (no visual/aesthetic changes here)
  const config = useMemo(() => {
    const base = { ...baseConfig, mode }
    const modeApplied = mode === 'classic' ? { ...base, ...classicOverrides } : base
    return { ...modeApplied, ...configOverrides }
  }, [mode, configOverrides])
  const [board, setBoard] = useState(() => createEmptyBoard())
  const bagRef = useRef([])
  const [current, setCurrent] = useState(() => ({ piece: drawPiece(baseConfig.randomizer, { current: [] }), position: SPAWN_POSITION }))
  const [nextPiece, setNextPiece] = useState(() => drawPiece(baseConfig.randomizer, { current: [] }))
  const [linesCleared, setLinesCleared] = useState(0)
  // Level derived from lines cleared when gravity scaling is enabled
  const level = useMemo(() => {
    if (!config.gravity.scaling) return config.gravity.startLevel || 0
    const base = config.gravity.startLevel || 0
    return base + Math.floor(linesCleared / 10)
  }, [linesCleared, config.gravity])
  const gravityMs = useMemo(() => {
    if (!config.gravity.scaling) return DROP_INTERVAL
    const idx = Math.min(level, GRAVITY_TABLE_MS.length - 1)
    return GRAVITY_TABLE_MS[idx]
  }, [config.gravity.scaling, level])
  const [isRunning, setIsRunning] = useState(true)
  // Legacy interval removed; unified frame loop handles gravity & DAS
  const dropTimer = useRef(null) // kept for backwards compatibility (unused)
  const [gameOver, setGameOver] = useState(false)
  const softDropRef = useRef(false)
  const heldDirRef = useRef(null) // 'left' | 'right' | null
  const dasStartTsRef = useRef(0)
  const lastArrMoveRef = useRef(0)
  const rafRef = useRef(null)
  const clearingRef = useRef(false)

  const reset = useCallback(() => {
    setBoard(createEmptyBoard())
    bagRef.current = []
    setCurrent({ piece: drawPiece(config.randomizer, bagRef), position: { ...SPAWN_POSITION } })
    setNextPiece(drawPiece(config.randomizer, bagRef))
    setLinesCleared(0)
    setIsRunning(true)
    setGameOver(false)
  }, [config.randomizer])

  const lockPiece = useCallback((piece = current.piece, position = current.position, boardState = board) => {
    const merged = mergePiece(boardState, piece, position)
    const { cleared, board: clearedBoard } = clearFullLines(merged)

    if (cleared > 0) {
      const projected = linesCleared + cleared
      setLinesCleared(projected)
      if (projected >= linesTarget) {
        setBoard(clearedBoard)
        setIsRunning(false)
        onWin?.()
        return
      }
      if (config.lineClearDelayMs > 0) {
        // Enter clearing phase: board updated, but delay spawning next piece
        clearingRef.current = true
        setBoard(clearedBoard)
        setTimeout(() => {
          clearingRef.current = false
          // proceed to spawn next piece after delay (repeat logic below minus clear path)
          const incomingAfterDelay = nextPiece
          const upcomingAfterDelay = { piece: incomingAfterDelay, position: { ...SPAWN_POSITION } }
          const nextQueueAfterDelay = drawPiece(config.randomizer, bagRef)
          if (!isValidPosition(clearedBoard, upcomingAfterDelay.piece, upcomingAfterDelay.position)) {
            setIsRunning(false)
            setGameOver(true)
            onFail?.()
            return
          }
          setCurrent(upcomingAfterDelay)
          setNextPiece(nextQueueAfterDelay)
        }, config.lineClearDelayMs)
        return
      }
    }

  const incoming = nextPiece
  const upcoming = { piece: incoming, position: { ...SPAWN_POSITION } }
    const nextQueue = drawPiece(config.randomizer, bagRef)

    if (!isValidPosition(clearedBoard, upcoming.piece, upcoming.position)) {
      setBoard(clearedBoard)
      setIsRunning(false)
      setGameOver(true)
      onFail?.()
      return
    }

    setBoard(clearedBoard)
  setCurrent(upcoming)
    setNextPiece(nextQueue)
  }, [board, current, linesCleared, linesTarget, nextPiece, onFail, onWin, config.randomizer])

  const tryMove = useCallback((dx, dy, rotate = 0) => {
    if (!isRunning) return
    setCurrent(prev => {
      const nextRotationCount = TETROMINOES[prev.piece.type].rotations.length
      const nextPiece = {
        ...prev.piece,
        rotation:
          rotate === 0
            ? prev.piece.rotation
            : (prev.piece.rotation + rotate + nextRotationCount) % nextRotationCount,
      }
      const nextPos = { x: prev.position.x + dx, y: prev.position.y + dy }
      // No wall/floor kicks are attempted here. If invalid, rotation/move fails and piece stays.
      if (isValidPosition(board, nextPiece, nextPos)) {
        return { piece: nextPiece, position: nextPos }
      }
      if (dy === 1 && rotate === 0) {
        // We attempted to move down one; since the new position is invalid we lock at the last valid spot (prev.position)
        lockPiece(prev.piece, { x: prev.position.x, y: prev.position.y }, board)
      }
      return prev
    })
  }, [board, isRunning, lockPiece])

  // --- Unified frame loop (gravity + DAS) ---
  useEffect(() => {
    if (!isRunning) return
    let lastTs = performance.now()
    let gravityAccum = 0

    const frame = (ts) => {
      rafRef.current = requestAnimationFrame(frame)
      const dt = ts - lastTs
      lastTs = ts
      if (clearingRef.current) return

      // Soft drop: while key held, attempt a downward move every frame (no lock if blocked until gravity tick)
      if (softDropRef.current && config.softDrop) {
        tryMove(0, 1)
      }

      // Gravity accumulation (independent of soft drop; classic GB gravity unaffected by holding Down except faster descent visually)
      gravityAccum += dt
      const effectiveGravity = gravityMs
      while (gravityAccum >= effectiveGravity) {
        gravityAccum -= effectiveGravity
        tryMove(0, 1)
        if (!isRunning) return
      }
    }
    rafRef.current = requestAnimationFrame(frame)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [isRunning, gravityMs, config.softDrop, tryMove])

  const hardDrop = useCallback(() => {
    if (!isRunning || !config.hardDrop) return
    setCurrent(prev => {
      let testY = prev.position.y
      while (isValidPosition(board, prev.piece, { x: prev.position.x, y: testY + 1 })) {
        testY += 1
      }
      // Immediately lock using parametric lockPiece to avoid stale state
      lockPiece(prev.piece, { x: prev.position.x, y: testY }, board)
      return { piece: prev.piece, position: { x: prev.position.x, y: testY } }
    })
  }, [board, isRunning, lockPiece, config.hardDrop])

  const rotateCCW = useCallback(() => {
    if (!config.rotateBoth) return
    tryMove(0, 0, -1)
  }, [config.rotateBoth, tryMove])

  const softDropStart = useCallback(() => {
    if (config.softDrop) softDropRef.current = true
  }, [config.softDrop])
  const softDropEnd = useCallback(() => {
    softDropRef.current = false
  }, [])

  const controls = useMemo(() => ({
    moveLeft: () => tryMove(-1, 0),
    moveRight: () => tryMove(1, 0),
    rotate: () => tryMove(0, 0, 1), // clockwise
    rotateCCW, // counter-clockwise (classic)
    hardDrop: config.hardDrop ? hardDrop : undefined,
    softDropStart: config.softDrop ? softDropStart : undefined,
    softDropEnd: config.softDrop ? softDropEnd : undefined,
    reset,
    config,
  }), [config, hardDrop, reset, rotateCCW, softDropEnd, softDropStart, tryMove])

  // --- DAS / ARR hooks (key listeners only; movement handled in unified frame) ---
  useEffect(() => {
    if (!isRunning || !config.das.enabled) return

    const onKeyDown = (e) => {
      if (!isRunning) return
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        const dir = e.key === 'ArrowLeft' ? 'left' : 'right'
        if (heldDirRef.current !== dir) {
          heldDirRef.current = dir
          dasStartTsRef.current = performance.now()
          // initial move immediately
          if (dir === 'left') tryMove(-1, 0)
          else tryMove(1, 0)
          lastArrMoveRef.current = performance.now()
        }
      }
    }
    const onKeyUp = (e) => {
      if (e.key === 'ArrowLeft' && heldDirRef.current === 'left') heldDirRef.current = null
      if (e.key === 'ArrowRight' && heldDirRef.current === 'right') heldDirRef.current = null
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [config.das.enabled, isRunning, tryMove])

  // Integrate DAS timing into unified frame
  useEffect(() => {
    if (!isRunning || !config.das.enabled) return
    let rafId
    const step = () => {
      rafId = requestAnimationFrame(step)
      if (!heldDirRef.current) return
      const now = performance.now()
      const elapsedFromStart = now - dasStartTsRef.current
      if (elapsedFromStart < config.das.delay) return
      if (now - lastArrMoveRef.current >= config.das.arr) {
        if (heldDirRef.current === 'left') tryMove(-1, 0)
        else if (heldDirRef.current === 'right') tryMove(1, 0)
        lastArrMoveRef.current = now
      }
    }
    rafId = requestAnimationFrame(step)
    return () => rafId && cancelAnimationFrame(rafId)
  }, [config.das.delay, config.das.arr, config.das.enabled, isRunning, tryMove])

  const activeCells = useMemo(() => getCellsForPiece(current.piece, current.position), [current])

  return {
    board,
    activeCells,
    currentPiece: current.piece,
  nextPiece: config.preview ? nextPiece : null,
    linesCleared,
    level,
    controls,
    isRunning,
    reset,
    gameOver,
    config,
  }
}
