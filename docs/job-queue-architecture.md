## Job Queue Architecture (Current State)

This document explains how SimCRM schedules and executes high-volume, time‑distributed simulation workloads using BullMQ (Redis) plus worker processes. It includes the evolutionary history and current advanced features: segmentation, sharding scaffolding, secondary activity fan‑out, rate awareness, and timestamp caching.

---
### Objectives
1. Deterministic timing of record creation using precomputed probability distributions.
2. Low-latency simulation start (avoid enqueuing the full job set up front).
3. Bounded Redis memory usage with hour-based lazy segment expansion.
4. Horizontal scale via queue sharding (`simulation-jobs:<shard>`).
5. Controlled secondary activity generation (notes, calls, tasks, tickets) with budgets + per-record caps.
6. Outbound rate safeguarding (token buckets, cooldown, circuit breaker) without embedding delays inside orchestration.
7. Operational visibility: segment status, health, metrics, Redis key taxonomy, Prometheus exporter.
8. Safe recovery & tuning: DLQ replay tooling, runtime adjustable scenario parameters (config surface), light rate limiting on sensitive ops.

---
### Kitchen Analogy (Still Valid)
Head Chef = `orchestrator.js`; Line Cooks = `worker.js` instances; Ticket Rail = BullMQ; Recipe Book = MySQL (`simulations` table). The analogy now adds: staged ingredient delivery (segments) and a pantry inventory system (budgets + rate buckets).

---
### Core Components
| Component | Role | Highlights |
|----------|------|------------|
| `orchestrator.js` | Simulation initialization | Expands distribution once, defines segments, enqueues only first segment, caches timestamps. |
| Primary Queue `simulation-jobs:<shard>` | Delayed primary jobs | Shard suffix enables horizontal partitioning. |
| `worker.js` | Job execution | Consumes primary + secondary queues, expands next segment, manages rate + budgets. |
| Secondary Queue `simulation-secondary` | Deferred secondary actions | Created lazily from primary job logic. |
| Redis | Volatile state + coordination | Segments, timestamps, budgets, rate buckets, idempotency, metrics. |
| MySQL (`simulations`) | Durable status & progress | `records_processed` flushed periodically from Redis counters. |

---
### Distribution & Timestamp Cache
At simulation start the orchestrator computes full per-record timestamps (respecting distribution curve + scenario scaling) and stores them:
`sim:<id>:timestamps` (JSON array, 6h TTL). Workers reuse this instead of re-expanding the distribution on every segment boundary. On cache miss the worker recomputes and re-caches with a shorter TTL (3h) to limit repeated recomputation.

---
### Segmentation Strategy
Segments are fixed 1‑hour slices across `[start_time, end_time)`. For each segment we record:
* `start`, `end` (epoch ms)
* `firstIdx`, `lastIdx` (0‑based indices into the timestamp array)

Only the first segment's jobs are enqueued initially. When the last job belonging to segment N finishes processing, the worker uses an `NX` marker to claim expansion of segment N+1 and enqueue its jobs with their original delay offsets relative to current wall clock.

Benefits:
* Faster initial response (first hour enqueued only).
* Controlled queue length → lower Redis memory amplification.
* Natural backpressure boundary (segment must complete before next expands).

---
### Queue Sharding
Primary queue name pattern: `simulation-jobs:<shard>`.
Current `deriveShard()` returns `0` (single shard); environment variable `SIMCRM_QUEUE_SHARDS` spawns one in‑process worker per shard queue, preparing for future hash distribution. A later enhancement will map `simulationId` to `hash(simId) % shardCount` for stable placement.

---
### Secondary Activities (Fan-Out)
Triggered only once per primary record creation phase:
1. Pull global budgets (`sim:<id>:budget`) & per-record counts (`sim:<id>:rec:<index>`).
2. Use deterministic RNG seed (`simulationId:index`) ensuring repeatability.
3. Evaluate probabilities, per-record caps, global budgets.
4. Reserve counts & decrement budgets.
5. Enqueue secondary jobs with delays (notes, calls, tasks, tickets) into `simulation-secondary`.
6. Guard against duplicate scheduling with idempotency key: `sim:<id>:sec:<record>:<type>:<ordinal>`.

Metrics track both scheduled and executed counts for each secondary type.

---
### Rate Limiting & Resilience (Summary)
Implemented in `worker.js` (see `ratelimits.md`):
* Token buckets per action type (`contact`, `note`, `call`, `task`, `ticket`) refilled lazily every 60s (scenario-capacity aware).
* 429 Cooldown: suspends outbound attempts until timestamp expires.
* Circuit Breaker: rolling failure window triggers temporary trip.
* Buckets are global across shards for simplicity (shared Redis keys).

---
### Metrics & Observability
API Endpoints:
* `GET /api/simulations/:id/metrics` – aggregated simulation metrics (DB + Redis flush influence).
* `GET /api/simulations/:id/segments` – ordered segments with expansion status.
* `GET /api/health` – includes rate limiter bucket states, cooldown and circuit breaker status (Phase 4+) and will be enriched with queue depth snapshots & DLQ summaries.
* `GET /api/simulations/:id/dlq` – dead letter queue reconciliation (Phase 4).
* `GET /api/simulations/:id/metrics2` – enhanced metrics with explicit source provenance & DB fallback (Phase 4).
* `GET /api/dlq/summary` – aggregate DLQ counts across simulations (Phase 5).
* `GET /metrics` (Prometheus text endpoint – internal) – queue depth, latency histograms, DLQ counters (Phase 5).

Redis Keys (See table below) expose all ephemeral coordination state; safe to inspect via CLI for debugging.

---
### Redis Key Reference
| Key Pattern | Type | Purpose |
|-------------|------|---------|
| `sim:<id>:timestamps` | String(JSON) | Full precomputed distribution timestamps |
| `sim:<id>:segments` | ZSET | Segment ordering (score = start ms) |
| `sim:<id>:seg:<n>` | Hash | Segment meta (start,end,firstIdx,lastIdx) |
| `sim:<id>:seg:<n>:expanded` | String | Marker for single expansion action |
| `sim:<id>:processed` | String(int) | Processed primary jobs counter (flushes to MySQL) |
| `sim:<id>:metrics` | Hash | Metrics counters (records_created, notes_scheduled, etc.) |
| `sim:<id>:budget` | Hash | Remaining global budgets per secondary type |
| `sim:<id>:rec:<i>` | Hash | Per-record secondary usage counts |
| `sim:<id>:sec:<i>:<type>:<ord>` | String | Secondary job idempotency marker |
| `ratelimit:bucket:<type>` | String(int) | Remaining action tokens |
| `ratelimit:bucket:last_refill` | String(ms) | Last refill timestamp |
| `ratelimit:hubspot:cooldown_until` | String(ms) | Cooldown after 429 |
| `circuit:hubspot:fail_window` | ZSET | Rolling failure timestamps |
| `circuit:hubspot:tripped_until` | String(ms) | Circuit breaker active-until |
| `sim:<id>:dlq:counts` | Hash | Dead-letter counts per error category (Phase 4) |
| `sim:<id>:dlq:samples` | List(JSON) | Recent sample of dead-lettered jobs (Phase 4) |
| `rl:replay:user:<id>` / `rl:replay:ip:<addr>` | String(int) | DLQ replay endpoint rate limiter counters (Phase 5) |

---
### Failure & Idempotency Semantics
* Secondary scheduling protected by per-(record,type,ordinal) marker.
* Segment expansion protected by `NX` marker to avoid double enqueue.
* Primary object creation idempotency (against external APIs) slated for future (e.g., idempotency keys hashed from simulation + index).

---
### Horizontal Scale Playbook
1. Set `SIMCRM_QUEUE_SHARDS=<N>` and restart worker process.
2. (Future) Implement non-trivial `deriveShard()` hashing for new simulations.
3. Optionally deploy multiple worker containers each handling a single shard index (future env var: `SIMCRM_SHARD_INDEX`).
4. Monitor Redis memory via periodic logs; adjust segment slice size if needed (currently 1h fixed window).

---
### Phase Progression
| Phase | Theme | Highlights |
|-------|-------|-----------|
| 1 | Foundations | Basic queue, full upfront enqueue, simple metrics. |
| 2 | Segmentation & Caching | Hour slices + timestamp cache reduce initial enqueue cost. |
| 3 | Secondary Fan-Out | Deterministic RNG, budgets, per-record caps, idempotency markers. |
| 4 | Reliability & Observability | DLQ, classification, adaptive thinning, structured logs, enhanced metrics fallback. |
| 5 | Operational Control & Tuning | Replay endpoint + strategies + rate limiter, Prometheus exporter, runtime config surface (scenario overrides), aggregate DLQ summary. |

### Phase 5 Additions
#### DLQ Replay Tooling
`POST /api/simulations/:id/dlq/replay` with dry-run mode, selection strategies (oldest/newest/random), fair-share category caps, and optional `useFullRetry` to honor full backoff/attempt config. Audit entries persisted and structured logs emitted for each replay action.

#### Replay Rate Limiter
Lightweight guard (5 calls / 30s per user or IP fallback) prevents abusive or accidental rapid-fire replays; responds with HTTP 429 and `retryAfterMs` for UX pacing.

#### Runtime Config Surface
Boss-only endpoints expose adjustable scenario knobs (deal win rate, interaction probabilities, per-record caps, global budgets). Overrides are in-memory (ephemeral) and merged into job scheduling payloads in `orchestrator.js` enabling instant tuning without redeploy.

#### Prometheus Exporter
Text format metric scraping endpoint (internal) surfaces queue depths, job latency histograms, DLQ counters, and thinning events enabling external dashboards / alerting.

### Updated Open / Planned Enhancements
| Area | Improvement |
|------|-------------|
| Sharding | Hash-based shard assignment, per-shard scaling knobs |
| Metrics | Per-segment progress counters & budget depletion gauges |
| Reliability | External object idempotency + selective replay presets |
| Memory | Delta compression of timestamps array |
| Config | Persisted overrides table + audit trail, UI editor in boss console |
| Visibility | Health enrichment with live queue depth & DLQ aggregate snapshot |
| Observability | Log ingestion + query tooling (OpenSearch / Loki) |

---
### Phase 4 Additions (Reliability & Observability)

#### Dead Letter Queue
Non-retryable or exhausted-attempt jobs are routed to `simulation-dlq` with classification metadata. Redis maintains category counters and a capped sample list for quick inspection.

#### Error Classification
`errorClassification.js` maps failures to categories (`rate_limit`, `network`, `auth`, `validation`, `timeout`, `unknown`) and determines retryability used by DLQ routing.

#### Structured Logging
`logging.js` emits JSON lines with consistent schema enabling downstream log aggregation. Worker emits `job completed`, `hubspot op failed`, `activity thinning applied`, and queue event logs.

#### Adaptive Activity Thinning
When backlog or circuit pressure increases, secondary activity candidates are probabilistically thinned (reducing load while preserving statistical shape). Logged with before/after counts and factor.

#### Enhanced Metrics Fallback
### Interplay: Config Surface & Scheduling
Merged scenario parameters (base + overrides) are injected into each primary job payload as `scenario_params` enabling workers to adapt probability-driven secondary activity generation immediately after an override is posted (no restart required). If overrides are cleared the scheduler resumes base defaults for subsequent segments / simulations.

`/api/simulations/:id/metrics2` surfaces Redis metrics when available; otherwise falls back to DB counters with `source` field indicating provenance (`redis`, `redis-error+db-fallback`, `redis-disabled+db-fallback`, `db-only`).

---
### Legacy (Original Draft)
The following original instructional draft is retained for historical context. The live implementation now supersedes it with segmentation, caching and sharding.

#### Original Conceptual Overview
"Single chef vs professional kitchen" analogy describing transition from monolithic loop to queue-based asynchronous processing.

#### Original Steps Summary
1. Create `simulations` table (source of truth).
2. Add BullMQ queue for all jobs.
3. Precompute distribution + enqueue every job with delay.
4. Workers consume jobs, create records, update counters, mark completion.

#### What Changed Since
* Full upfront enqueue replaced by segment-lazy model.
* Single queue replaced by shard namespace pattern + secondary queue.
* Pure DB progress counters augmented with Redis ephemeral metrics & budgets.
* Added rate limiting primitives to decouple throughput from external API constraints.

---
End of current architecture document.