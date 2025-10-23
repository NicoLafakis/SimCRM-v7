// Deterministic pseudo-random number generator (Mulberry32 variant)
// Seed with a 32-bit integer derived from simulationId (hash) for reproducibility.

function hashSeed(str) {
  let h = 1779033703 ^ str.length
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  return (h >>> 0)
}

function mulberry32(a) {
  return function() {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
}

function createRNG(seedInput) {
  const seed = typeof seedInput === 'number' ? (seedInput >>> 0) : hashSeed(String(seedInput || 'seed'))
  const rand = mulberry32(seed)
  return {
    seed,
    next: () => rand(),
    nextFloat: () => rand(),
    nextInt: (min, maxInclusive) => {
      const r = rand()
      return Math.floor(r * (maxInclusive - min + 1)) + min
    },
    chance: (p) => rand() < p,
    pick: (arr) => arr.length ? arr[Math.floor(rand() * arr.length)] : undefined,
  }
}

module.exports = { createRNG, hashSeed }
