# Operations Runbook

Practical guide for running, scaling, inspecting, and extending the SimCRM simulation system.

## 1. Processes Overview
| Process | Command | Purpose |
|---------|---------|---------|
| Web/API Server | `npm run start-server` | Serves REST API/endpoints, onboarding UI build if served statically, orchestration triggers. |
| Dev Frontend | `npm run dev` | Vite dev server for React simulation UI. |
| Worker(s) | `node server/worker.js` | Consumes primary + secondary queues, expands segments, applies rate limiting, schedules secondary actions. |

## 2. Environment Variables
| Variable | Purpose | Default |
|----------|---------|---------|
| `REDIS_URL` / (`REDIS_HOST`, `REDIS_PORT`) | Redis connection for BullMQ + metadata | localhost:6379 |
| `REDIS_DB` | Redis logical DB index | unset (0) |
| `REDIS_PASSWORD` | Auth for managed Redis | unset |
| `SIMCRM_QUEUE_SHARDS` | Number of primary shard workers to spawn in a single worker process | 1 |
| `REDIS_PROGRESS` | Enable Redis metrics/budgets counters + segment expansion ("1" to enable) | 1 (recommended) |
| `HUBSPOT_API_TOKEN` | (Legacy) Global token (deprecated; per-user encrypted tokens preferred) | unset |
| `TOKEN_ENC_SECRET` | 32-byte secret for token encryption | required when storing tokens |
| DB vars (`DB_HOST`, `DB_USER`, `DB_PASS`, `DB_NAME`, `DB_PORT`) | MySQL connectivity | varies |
### Environment Configuration Matrix (Phase 5 Additions)
| Variable | Purpose | Format / Example | Default |
|----------|---------|------------------|---------|
| REDIS_PROGRESS | Enables Redis-backed progress + metrics features | '1' to enable | unset (disabled) |
| ATTEMPTS_CONTACT / CONTACT_ATTEMPTS | Override attempts for primary contact jobs (new name takes precedence) | integer 1-10 | 3 |
| BACKOFF_CONTACT / CONTACT_BACKOFF_MS | Millisecond delays per attempt (comma list) (new name takes precedence) | "0,2000,8000" | internal defaults |
| ATTEMPTS_SECONDARY | Attempts for secondary activity jobs | integer | 2 |
| BACKOFF_SECONDARY | Backoff series for secondary jobs | "0,3000" | internal defaults |
| ATTEMPTS_NOTE/CALL/TASK/TICKET or NOTE/CALL/TASK/TICKET_ATTEMPTS | Overrides per secondary type (new name wins) | integer | inherits secondary |
| BACKOFF_NOTE/CALL/TASK/TICKET or NOTE/CALL/TASK/TICKET_BACKOFF_MS | Backoff arrays per type (new name wins) | comma list | inherits secondary |
| METRICS_PROM_ENABLED | Enable Prometheus exporter | '1' | unset |
| PROM_DEFAULT_BUCKETS | Histogram buckets (ms) | "50,100,250,500,1000,2000" | library default |
| DLQ_REPLAY_LIMIT_CAP | Hard upper limit for non-dry-run replays | integer 1-100 | 50 |
| DLQ_SAMPLE_MAX | Stored DLQ sample size per simulation | integer | 25 |
| THINNING_EVENTS_MAX | Retained thinning events per simulation | integer | 200 |

Notes:
- Dual naming: For each type we first read NEW_NAMING (e.g. CONTACT_ATTEMPTS, CONTACT_BACKOFF_MS). If unset, we fall back to legacy (ATTEMPTS_CONTACT, BACKOFF_CONTACT). If both are set, NEW wins.
- Backoff arrays are independent of attempts: if shorter than attempts-1 we repeat the last value to pad.
- Replay endpoint still enforces request-level limit parameter; environment cap is final guard.
- Adjust histogram buckets carefully; removing smaller buckets can hide latency spikes.

#### Replay Endpoint Enhancements
Body now supports `useFullRetry` (boolean, default false). When `true` (and `dryRun:false`) replayed jobs receive their full configured retry profile instead of a single attempt.

Safety sequence:
1. Dry-run first WITHOUT `useFullRetry` to inspect selection.
2. If categories and volume look safe, re-run with `dryRun:false` and optionally `useFullRetry:true` to leverage full backoff schedule.
3. Avoid enabling full retry on large batches of deterministic validation failures—will only delay DLQ reappearance.

### Boss Role Endpoints
Boss-only endpoints (require users.role = 'boss'):
- GET /api/simulations/:id/dlq
- POST /api/simulations/:id/dlq/replay
- GET /api/dlq/summary
- GET /api/simulations/:id/thinning-events

### Replay Safety Practices
1. Always execute a dry-run first (dryRun:true) to view selection distribution.
2. Limit categories when investigating systemic failures (e.g., auth vs rate_limit).
3. Avoid repeated replay loops on validation errors—fix root cause then replay.
### Rate Limiting
* Replay endpoint is protected by a lightweight per-user (or IP fallback) rate limiter (5 calls / 30s window). Excess attempts return HTTP 429 with `retryAfterMs`. This includes dry runs to discourage scripted hammering; widen window via config in future if necessary.

### Adaptive Thinning Interpretation
Event fields: before, after, factor, totalWaiting.
- factor derived from backlog pressure + circuit breaker status.
- Use backlog trend to size infrastructure or adjust generation pacing.


## 3. Starting the System
Minimal local setup:
```powershell
npm install
npm run start-server  # in one terminal
node server/worker.js # in another
```
Multi-shard (preparing for future hashing):
```powershell
$env:SIMCRM_QUEUE_SHARDS="3"; node server/worker.js
```

## 4. Creating & Starting a Simulation (API Flow)
1. POST `/api/simulations` with body including: `start_time`, `end_time`, `scenario`, `distribution_method`, `total_records`.
2. POST `/api/simulations/:id/start` to enqueue first segment.
3. Poll `/api/simulations/:id/metrics` for progress; optionally GET `/api/simulations/:id/segments` for segment expansion status.

## 5. Monitoring
| Endpoint | Use |
|----------|-----|
| `GET /api/health` | Rate limiter state (buckets, cooldown, circuit breaker) + basic service health. |
| `GET /api/simulations/:id/metrics` | High-level counts (primary created + secondary scheduled/created). |
| `GET /api/simulations/:id/segments` | Segment range indices & expansion flags. |

Redis key inspection (examples):
```powershell
# List segment keys
redis-cli KEYS sim:<id>:seg:* 

# Show metrics
redis-cli HGETALL sim:<id>:metrics

# Buckets
redis-cli MGET ratelimit:bucket:contact ratelimit:bucket:note ratelimit:bucket:call
```

## 6. Segment Expansion Internals
- Segments are 1h slices; only segment 0 is enqueued initially.
- When last job of segment N finishes, worker sets `sim:<id>:seg:<N+1>:expanded` (NX) and enqueues its jobs using cached timestamps.
- Cached timestamps: `sim:<id>:timestamps` (JSON). TTL 6h; worker repopulates (3h TTL) if missing.

## 7. Secondary Activities
- Deterministic RNG key: `${simulationId}:${recordIndex}`.
- Budgets hash: `sim:<id>:budget` (remaining counts per type).
- Per-record counts: `sim:<id>:rec:<index>`.
- Idempotency marker: `sim:<id>:sec:<record>:<type>:<ordinal>` ensures one enqueue.
- Add a new secondary type: update `scenarioParameters.js` (probabilities, caps, budgets), extend `SECONDARY_TYPES` set in `worker.js`, adjust metrics naming (follow existing pluralization pattern), and provide handling in HubSpot tool path if needed.

## 8. Rate Limiting & Resilience
- Token buckets lazy-refilled every 60s; global across shards.
- 429 response → sets `ratelimit:hubspot:cooldown_until` for ~15s.
- Circuit breaker triggers on >8 failures in rolling 60s (`circuit:hubspot:fail_window` + `circuit:hubspot:tripped_until`).

Reset in dev:
```powershell
redis-cli DEL ratelimit:bucket:last_refill ratelimit:hubspot:cooldown_until circuit:hubspot:tripped_until
redis-cli DEL circuit:hubspot:fail_window
```

## 9. Safe Shutdown
Send SIGINT/SIGTERM to worker process. It will:
1. Close all shard workers.
2. Flush `sim:*:processed` counters to DB.
3. Quit Redis connections.

## 10. Migrations
Run:
```powershell
npm run migrate:latest
```
Generate (if script exists) or manually create new migration in `migrations/` for schema evolution (e.g., simulation profile persistence).

## 11. Troubleshooting
| Symptom | Possible Cause | Action |
|---------|----------------|--------|
| No jobs executing | Worker not running or wrong Redis connection | Check worker logs; verify Redis env vars |
| Segments never expand | Last job in segment not processed / marker collision | Inspect `sim:<id>:segments` and expansion markers; check worker errors |
| High Redis memory | Excessive concurrent simulations | Reduce segment size or add eviction; consider compression of timestamps |
| Secondary counts zero | Probabilities too low or budgets exhausted | Inspect `sim:<id>:budget` and RNG seed logic |
| Buckets always full | No HubSpot calls executed (token absent) | Ensure per-user token stored & resolved |

## 12. Extending Sharding
Future hashing plan:
```js
function deriveShard(simId, shardCount) {
  // simple FNV-1a or CRC32, then mod shardCount
}
```
When implemented, orchestrator will enqueue to computed shard queue; existing simulations remain unaffected until restart.

## 13. Observability Wishlist
- Prometheus exporter for bucket & circuit gauges.
- Per-segment processed counts materialized in Redis.
- DLQ / retry metrics surface.

## 14. Reference Documents
- `docs/job-queue-architecture.md` – deep dive architecture.
- `docs/ratelimits.md` – rate limiting internals.
- `CHANGELOG.md` – release history.
- `scenarioParameters.js` – scenario knobs (probabilities, buckets, caps).

---
_Last updated: 2025-09-28_
