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
