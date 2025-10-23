# Observability (Phase 5)

## Overview
Phase 5 adds structured logging event IDs, rate limit & retry telemetry, aggregated metrics APIs, an Observability dashboard UI, and enriched SSE streaming with recent rate limit events.

## Structured Logging
All logs now include stable JSON fields ordered for ingestion.

Primary fields (ordered):
- ts (epoch ms)
- level (info|error)
- eventId
- msg
- simulationId (when applicable)
- jobId (BullMQ job id when applicable)
- recordIndex (1-based index of record contact job)
- overrideVersion (scenario override version)

### Event ID Catalog
| Event ID | Description |
|----------|-------------|
| SIM_JOB_COMPLETED | Primary or secondary job completed successfully |
| SIM_JOB_FAILED | Job failed due to missing simulation or other fatal condition (pre-DLQ classification) |
| SIM_IDEMPOTENCY_SKIP | Duplicate job skipped by idempotency guard |
| SIM_ACTIVITY_THINNING_APPLIED | Adaptive thinning reduced secondary activities |
| SIM_ACTIVITY_THINNING_ERROR | Error during thinning evaluation |
| HS_OP_FAILED | HubSpot operation failed (before retry exhaustion classification) |
| QUEUE_WORKER_COMPLETED | Bull worker emitted completed event |
| QUEUE_WORKER_FAILED | Bull worker emitted failed event |
| DLQ_ENQUEUE_FAILED | Failed to enqueue into DLQ |
| DLQ_REPLAY | DLQ replay invocation audited |
| DLQ_REPLAY_RATE_LIMIT | (Reserved) rate limit exceeded for replay endpoint |
| SIM_ABORT_SOFT | Simulation soft abort (no purge) |
| SIM_ABORT_FORCE | Simulation force abort with queue purge |
| HS_RATE_LIMIT_HIT | (Reserved) centralized emission when raw 429 encountered (in-worker metrics capture currently) |
| HS_RETRY_SCHEDULED | (Reserved) a retry has been scheduled (backoff) |
| HS_CIRCUIT_TRIP | (Reserved) circuit breaker tripped (future) |
| HS_CIRCUIT_RECOVER | (Reserved) circuit breaker recovered (future) |

## Rate Limit & Retry Telemetry
Stored per simulation in Redis hash `sim:<id>:metrics`.

New Fields:
- rate_limit_hits: Count of raw 429 detections.
- rate_limit_total_delay_ms: Sum of explicit Retry-After delays consumed.
- rate_limit_scheduled_delay_ms: Sum of internally scheduled backoff delays (429 only) prior to retry.
- rate_limit_last_hit_at: Epoch ms timestamp of most recent 429.
- retries_total: Total retry attempts (any status triggering retry logic).
- idempotency_skipped: Already existing; surfaced here for convenience.

Recent rate limit events (last 200) kept in list key `sim:<id>:ratelimit:events` with JSON objects: `{ ts, recordIndex, attempt, retryAfter }`.

## APIs
- GET `/api/simulations/:id/metrics` – now reports default zeros for new telemetry fields.
- GET `/api/metrics/summary` (boss-only) – aggregated recent simulations with metrics.
- GET `/api/simulations/:id/stream` – SSE now includes `rateLimitRecent` array.

## Frontend Dashboard
Component: `ObservabilityDashboard.jsx`
Features:
- Simulation list with quick glance stats (RL hits, retries, failures, progress %).
- Detail pane with progress bar, key counters, optional bar visualization.
- SSE integration for real-time updates once a simulation is selected (falls back to polling every 5s).

## Usage Notes
- Telemetry only active when `REDIS_PROGRESS=1` (Redis backing enabled).
- Rate limit metrics remain zero if no external HubSpot real-mode calls are executed (e.g., missing user token).
- RL event list trimmed to 200 entries to bound memory.

## Extensibility
Future additions can append new event IDs in `server/logEvents.js` and populate new metrics fields; document them here keeping backwards compatibility.

