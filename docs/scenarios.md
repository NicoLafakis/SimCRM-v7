# Scenarios (B2B vs B2C)

This document defines the intent and future parameterization of the Scenario selection step (final step in the current onboarding configuration flow).

## Purpose
Scenarios let the user express broad go-to-market archetypes that will *shape the generation, pacing, and composition* of simulated CRM records (contacts, companies, deals, timelines) once the job queue + worker system is active.

## Current State (UI-Only)
- Two selectable tiles: B2B, B2C (`src/components/Scenario/scenarioOptions.js`).
- Selection plays standard pluck SFX, supports back navigation.
- No persistence yet (in-memory only) and no effect on the existing `SimulationEngine` or backend orchestrator.

## Planned Parameter Bundle
Each scenario will provide a structured object consumed by the orchestrator when expanding a simulation request into delayed jobs:

| Parameter | B2B (Indicative) | B2C (Indicative) | Notes |
|-----------|------------------|------------------|-------|
| leadVolumeMultiplier | 0.6–0.9 | 1.4–2.2 | B2C higher inbound volume |
| avgSalesCycleDays | 35–90 | 3–14 | Drives deal creation scheduling & stage dwell times |
| funnelAttrition (subscriber→SQL) | Higher attrition mid-funnel | Lower attrition early | Stored as stage→probabilities |
| dealWinRateBase | 0.55–0.65 | 0.35–0.5 | Adjusted further by distribution seasonality (future) |
| dealAmountDistribution | lognormal (μ higher σ higher) | lognormal (μ lower σ lower) | Deterministic seeded RNG for reproducibility |
| contactToCompanyRatio | 3–7 : 1 | 1–2 : 1 | Influences whether new contact attaches to existing company |
| touchpointDensity | Lower but richer | Higher but lighter | Affects tasks/notes/calls volume per contact |

(All ranges indicative; final numbers set during calibration.)

## Integration Points
1. `simulations` table (future) will store `scenario` string plus derived normalized parameters snapshot for audit.
2. Orchestrator expands user request → generates timestamps using distribution curve → attaches scenario modifiers when enqueuing each job.
3. Worker uses modifiers to:
   - Pace lifecycle transitions.
   - Decide probability of lead qualification / nurture diversion.
   - Shape deal creation timing & value.
   - Generate associated activities volume.

## Data Model Sketch
```ts
interface ScenarioParameters {
  id: 'b2b' | 'b2c'
  leadVolumeMultiplier: number
  avgSalesCycleDays: number
  funnelAttrition: { stage: string; dropProbability: number }[]
  dealWinRateBase: number
  dealAmount: { distribution: 'lognormal'; mu: number; sigma: number; min?: number; max?: number }
  contactToCompanyRatio: { min: number; max: number }
  touchpointDensity: { notesPerLead: [number, number]; tasksPerLead: [number, number]; callsPerLead: [number, number] }
}
```

## Scheduling Interaction (with Distribution Methods)
1. Distribution method generates N timestamps across `[start_time, end_time]`.
2. Scenario adjusts N (via `leadVolumeMultiplier`) and may stretch/compress intervals (e.g., B2B smoothing vs B2C spikes tolerated).
3. Resulting timestamp array becomes the set of delayed jobs inserted into BullMQ.

## Persistence Options
Option A: Add `simulation_profile` JSON column to `users` for latest selections.
Option B: Create `user_simulation_profiles` table capturing multiple saved presets (future multi-sim UI).

Initial implementation will likely use Option A for simplicity; migration will rename/migrate if multi-profile support is later required.

## Roadmap Alignment
- Mapped to Roadmap Steps 3–5 (distribution expansion, scenario parameter injection, persistence & summary panel).
- Provides groundwork for exposing an advanced “Tuning” panel (phase 2) where user can override default scenario parameters within bounded guardrails.

## Open Questions
- Do we surface scenario parameter preview before starting simulation? (Likely yes: read-only table.)
- Should scenario influence music / theme styling? (Deferred, aesthetic layer.)
- Need deterministic seeding strategy so repeated runs with same inputs produce identical sequences (improves testability).

## Next Actions
1. Approve parameter ranges.
2. Implement persistence (profile snapshot) at scenario selection confirmation.
3. Add distribution expansion function and apply scenario multiplier to record count.
4. Extend orchestrator to create delayed jobs with scenario modifiers embedded.
5. Instrument progress endpoints to expose scenario-derived counts (planned vs processed).

---
*Document version: initial (pending calibration pass).*