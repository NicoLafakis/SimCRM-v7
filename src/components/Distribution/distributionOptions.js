// Distribution method catalog (3x3 grid layout; CUSTOM in center)
// Order: first row (3) | second row (left, custom center, right) | third row (3)
export const DistributionMethods = [
  { id: 'linear', name: 'LINEAR', group: 'time', description: 'Constant rate across duration.' },
  { id: 'front_loaded', name: 'FRONT-LOADED', group: 'time', description: 'Heavy start, tapering later.' },
  { id: 'back_loaded', name: 'BACK-LOADED', group: 'time', description: 'Light start, heavier finish.' },
  { id: 'bell_curve', name: 'BELL CURVE', group: 'time', description: 'Peak in the middle.' },
  { id: 'custom', name: 'CUSTOM', group: 'custom', description: 'Define your own distribution.' },
  { id: 'random_bursts', name: 'RANDOM BURSTS', group: 'behavior', description: 'Irregular bursts of activity.' },
  { id: 'trickle', name: 'TRICKLE', group: 'time', description: 'Slow, consistent inflow.' },
  { id: 'daily_spike', name: 'DAILY SPIKE', group: 'behavior', description: 'Repeating daily peak.' },
  { id: 'weekend_surge', name: 'WEEKEND SURGE', group: 'behavior', description: 'Heavier on simulated weekends.' },
]

// Helper for potential future grouping or filtering
export function getDistributionById(id) {
  return DistributionMethods.find(m => m.id === id)
}
