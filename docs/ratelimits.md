# Rate Limiting & Resilience (Phase 2)

This document outlines how SimCRM manages outbound HubSpot API usage under load.

## Components

1. Token Buckets (Redis)
   - Keys: `ratelimit:bucket:<type>` for action types: `contact`, `note`, `call`, `task`, `ticket`.
   - Refilled every 60s (configurable constant) by the worker on-demand (lazy refill when a job runs and interval elapsed).
   - Scenario-specific capacities via `bucketCapacities` in `server/scenarioParameters.js` merged over `DEFAULT_BUCKET_SIZES` in `worker.js`.
   - Buckets are GLOBAL across all shards/workers (single shared Redis keys). Multiple shard workers reading the same keys coordinate implicitly; the first job after refill interval performs the refill.

2. Adaptive 429 Cooldown
   - On HTTP 429, sets `ratelimit:hubspot:cooldown_until` (epoch ms).
   - External calls are skipped while `Date.now() < cooldown_until`.

3. Circuit Breaker
   - Failures tracked in a sorted set `circuit:hubspot:fail_window` (score=value=timestamp).
   - If failures in rolling 60s window exceed threshold (8), trip: set `circuit:hubspot:tripped_until` for 30s.
   - Health endpoint reports breaker status.

4. Health & Monitoring
   - `GET /api/health` includes:
     ```json
     {
       "rate": {
         "hubspotCooldownActive": false,
         "hubspotCircuitTripped": false,
         "buckets": { "contact": 42, "note": 17, "call": 10, "task": 25, "ticket": 7 }
       }
     }
     ```
   - Metrics hash (`sim:<id>:metrics`) remains separate (creation & scheduling counts).

## Scenario Bucket Capacities

Defined in `scenarioParameters.js`:

| Scenario | contact | note | call | task | ticket |
|----------|---------|------|------|------|--------|
| b2b      | 60      | 50   | 30   | 40   | 15     |
| b2c      | 120     | 80   | 15   | 50   | 10     |

Rationale:
- B2C: higher lead volume → larger contact & note buckets; fewer calls.
- B2B: more balanced with higher call allowance per minute.

Concurrency Note:
When `SIMCRM_QUEUE_SHARDS > 1`, all shard workers decrement the same bucket keys. This intentionally throttles aggregate outbound rate (not per-shard). If future isolation is needed, prefix buckets with shard index or token id (e.g., `ratelimit:bucket:<token>:<type>`). For now global buckets keep logic simple and prevent multiplicative rate bursts when scaling workers horizontally.

## Fallback & Validation
- If scenario capacities missing or invalid, defaults apply.
- Non-numeric / negative values replaced by defaults.
- Buckets absent (key missing) act permissively until first refill (ensures no hard failure on cold start).

## Extension Ideas
- Dynamic resizing based on observed 429 frequency (feedback loop).
- Per-user or per-token bucket isolation when multi-tenant.
- Endpoint-specific buckets (e.g., associations vs objects) if needed.
- Partitioned bucket namespaces per shard or per user token.
- Prometheus exporter for bucket gauges and circuit state.

## Development Notes
- Bucket refill is lazy: first job after interval triggers refill; avoids extra timers.
- To reset quickly in dev: `DEL ratelimit:bucket:last_refill` and bucket keys.
- Calibration script: `node scripts/hubspotRateProbe.js --token <TOKEN>` to observe raw limits.

