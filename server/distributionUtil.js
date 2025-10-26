// Expand a distribution method into an ordered array of timestamps between start and end.
// startTime / endTime are ms epoch. total is number of records.
// method string should correspond to keys used in distributionOptions (frontend) but logic here
// implements a few core patterns; unrecognized methods fall back to linear.

function expandDistribution(method, total, startTime, endTime) {
  if (total <= 0) return []
  const span = Math.max(1, endTime - startTime)
  const points = []
  // Normalized positions 0..1 then map to time.
  if (method === 'bell_curve') {
    // Use Gaussian-ish density via inverse transform sampling over fixed buckets.
    // We'll approximate by sampling CDF of normal(0.5,0.15) at evenly spaced quantiles.
    for (let i = 0; i < total; i++) {
      const q = (i + 0.5) / total
      // Approximate inverse error function for normal quantile (simple polynomial for our narrow sigma requirement)
      // We'll just shape with a smoothstep emphasis around center.
      const centerWeighted = 0.5 + 0.5 * Math.sin((q - 0.5) * Math.PI)
      const ts = Math.round(startTime + centerWeighted * span)
      points.push(ts)
    }
  } else if (method === 'front_loaded') {
    for (let i = 0; i < total; i++) {
      const q = (i + 0.5) / total
      const eased = Math.pow(q, 0.6) // heavier early density
      points.push(Math.round(startTime + eased * span))
    }
  } else if (method === 'back_loaded') {
    for (let i = 0; i < total; i++) {
      const q = (i + 0.5) / total
      const eased = 1 - Math.pow(1 - q, 0.6)
      points.push(Math.round(startTime + eased * span))
    }
  } else if (method === 'surge_mid') {
    for (let i = 0; i < total; i++) {
      const q = (i + 0.5) / total
      const peak = Math.sin(Math.PI * q) // 0..1..0
      const combined = (q * 0.4) + peak * 0.6
      points.push(Math.round(startTime + combined * span))
    }
  } else if (method === 'trickle') {
    // Slow, consistent inflow with slight variance to simulate organic trickle
    // Uses square root easing for gentle deceleration
    for (let i = 0; i < total; i++) {
      const q = (i + 0.5) / total
      const eased = Math.sqrt(q) // gentle acceleration
      const variance = (Math.sin(i * 7.3) * 0.02) // tiny variance ±2%
      points.push(Math.round(startTime + (eased + variance) * span))
    }
  } else if (method === 'random_bursts') {
    // Create 3-7 random burst centers with records clustered around them
    const numBursts = 3 + Math.floor(Math.random() * 5) // 3-7 bursts
    const burstCenters = []
    for (let b = 0; b < numBursts; b++) {
      burstCenters.push(Math.random())
    }
    burstCenters.sort((a, b) => a - b)

    // Assign each record to nearest burst center with some spread
    for (let i = 0; i < total; i++) {
      const burstIdx = Math.floor(Math.random() * numBursts)
      const center = burstCenters[burstIdx]
      const spread = (Math.random() - 0.5) * 0.15 // ±7.5% spread around center
      const position = Math.max(0, Math.min(1, center + spread))
      points.push(Math.round(startTime + position * span))
    }
  } else if (method === 'daily_spike') {
    // Repeating daily peak pattern - sine wave that cycles every 24 hours
    const MS_PER_DAY = 1000 * 60 * 60 * 24
    const numDays = span / MS_PER_DAY

    for (let i = 0; i < total; i++) {
      const q = (i + 0.5) / total
      // Add daily sine wave on top of linear progression
      const dayPhase = (q * numDays) % 1 // position within current day
      const dailyPeak = Math.sin(dayPhase * Math.PI * 2 - Math.PI / 2) * 0.5 + 0.5 // 0..1..0 cycle
      const combined = q + (dailyPeak * 0.2 - 0.1) // adjust position by ±10%
      points.push(Math.round(startTime + Math.max(0, Math.min(1, combined)) * span))
    }
  } else if (method === 'weekend_surge') {
    // Weight records toward weekends (simulated day of week)
    const MS_PER_DAY = 1000 * 60 * 60 * 24

    for (let i = 0; i < total; i++) {
      const q = (i + 0.5) / total
      const baseTs = startTime + q * span
      const daysSinceStart = (baseTs - startTime) / MS_PER_DAY
      const dayOfWeek = (Math.floor(daysSinceStart) + (new Date(startTime).getDay())) % 7

      // If weekend (Sat=6, Sun=0), bias toward these times
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
      const weekendBias = isWeekend ? 0.3 : -0.1 // 30% more likely on weekends

      // Apply bias by adjusting position
      const adjusted = q + (Math.random() - 0.5) * 0.1 + weekendBias * 0.05
      points.push(Math.round(startTime + Math.max(0, Math.min(1, adjusted)) * span))
    }
  } else if (method === 'custom') {
    // Custom distribution - for now, falls back to linear
    // TODO: Implement custom distribution upload/configuration in future version
    for (let i = 0; i < total; i++) {
      const q = (i + 0.5) / total
      points.push(Math.round(startTime + q * span))
    }
  } else {
    // linear default
    for (let i = 0; i < total; i++) {
      const q = (i + 0.5) / total
      points.push(Math.round(startTime + q * span))
    }
  }
  return points.sort((a,b) => a - b)
}

module.exports = { expandDistribution }
