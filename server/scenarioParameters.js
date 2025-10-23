// Scenario parameter bundles consumed by orchestrator / worker.
// Values are indicative; calibrate later.

const scenarios = {
  b2b: {
    id: 'b2b',
    leadVolumeMultiplier: 0.8,
    avgSalesCycleDays: 60,
    dealWinRateBase: 0.6,
    dealAmount: { distribution: 'lognormal', mu: 10.5, sigma: 0.9 },
    contactToCompanyRatio: { min: 3, max: 6 },
    touchpointDensity: { notesPerLead: [1,3], tasksPerLead: [0,2], callsPerLead: [0,1] },
    interactions: {
      probabilities: {
        initialNote: 1.0,
        firstCallOnMQL: 0.65,
        followUpTaskIfNoCall: 0.5,
        nurtureNoteOnRegression: 0.35,
        postWinNote: 0.55,
        lostDealTicket: 0.15,
      },
      perRecordCaps: { notes: 5, calls: 3, tasks: 6, tickets: 1 },
      globalBudgets: { notes: 5000, calls: 2500, tasks: 4000, tickets: 500 },
      delays: {
        firstCallOnMQL: { meanMin: 15, jitter: 10 },
        followUpTaskIfNoCall: { rangeMin: 30, rangeMax: 180 },
        nurtureNoteOnRegression: { rangeMin: 5, rangeMax: 25 },
        postWinNote: { rangeMin: 2, rangeMax: 10 },
        lostDealTicket: { rangeMin: 3, rangeMax: 20 },
      }
    },
    bucketCapacities: { contact: 60, note: 50, call: 30, task: 40, ticket: 15 },
  },
  b2c: {
    id: 'b2c',
    leadVolumeMultiplier: 1.8,
    avgSalesCycleDays: 7,
    dealWinRateBase: 0.42,
    dealAmount: { distribution: 'lognormal', mu: 7.8, sigma: 0.5 },
    contactToCompanyRatio: { min: 1, max: 2 },
    touchpointDensity: { notesPerLead: [0,1], tasksPerLead: [0,1], callsPerLead: [0,0] },
    interactions: {
      probabilities: {
        initialNote: 0.9,
        firstCallOnMQL: 0.3,
        followUpTaskIfNoCall: 0.25,
        nurtureNoteOnRegression: 0.25,
        postWinNote: 0.4,
        lostDealTicket: 0.05,
      },
      perRecordCaps: { notes: 3, calls: 1, tasks: 3, tickets: 1 },
      globalBudgets: { notes: 8000, calls: 1200, tasks: 5000, tickets: 300 },
      delays: {
        firstCallOnMQL: { meanMin: 8, jitter: 6 },
        followUpTaskIfNoCall: { rangeMin: 15, rangeMax: 90 },
        nurtureNoteOnRegression: { rangeMin: 3, rangeMax: 15 },
        postWinNote: { rangeMin: 1, rangeMax: 6 },
        lostDealTicket: { rangeMin: 2, rangeMax: 12 },
      }
    },
    bucketCapacities: { contact: 120, note: 80, call: 15, task: 50, ticket: 10 },
  }
}

function getScenarioParameters(id) {
  return scenarios[id] || null
}

module.exports = { getScenarioParameters }
