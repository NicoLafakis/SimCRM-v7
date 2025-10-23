# Changelog

All notable changes to this project are documented here. Dates use UTC (YYYY-MM-DD).

## [Unreleased]
### Added (Phase 5 - Reliability & Ops)
- DLQ replay endpoint with dry-run, selection strategies (oldest/newest/random), category & jobId filters, fair-share caps.
- Audit trail table (`dlq_replay_audit`) storing replay attempts (filters, counts, dry-run flag).
- Configurable retry attempts/backoff per job type via environment overrides (primary + secondary activities).
- Prometheus metrics exporter (queue depths, DLQ counts, thinning events, job latency histograms) and existing JSON fallback remains.
- Player/Boss role system (users.role) with middleware gating boss-only endpoints.
- Boss Operations Console (frontend) with DLQ summary panel and adaptive thinning events feed.
- DLQ aggregate summary endpoint (boss-only) scanning all simulations.
- Thinning events persistence (Redis capped list) + retrieval endpoint.
 - Dual naming support for retry env vars (CONTACT_ATTEMPTS/CONTACT_BACKOFF_MS etc.) with precedence over legacy ATTEMPTS_CONTACT/BACKOFF_CONTACT.
 - Boss console DLQ replay controls UI (dry-run, strategy, per-category cap, full retry toggle).
 - DLQ replay endpoint enhancement: `useFullRetry` flag applies full configured attempts/backoff.
 - Structured replay log event (msg: dlq replay) including selection distribution & retry mode.
 - DLQ summary endpoint now supports basic pagination & filtering (cursor, limit, simIdContains, category).
 - Prometheus metrics panel in boss console (auto-refresh, first 8KB preview).
 - DLQ replay endpoint rate limiter (5 calls / 30s per user/IP) returning 429 with retryAfterMs for operational safety.

### Planned
- Runtime retry configuration service & UI: read-only GET `/api/boss/retry-config` (now implemented) followed by future PUT endpoint with validation, versioning, and audit logging for live adjustments to attempts/backoff.

### Changed
- Worker now logs and persists adaptive thinning events; secondary activity enqueue integrates retry config builder.

### Security
- Restricted DLQ inspection, replay, thinning events, and aggregate summary endpoints to boss role.

### Added
- Phase 4 Reliability & Observability features:
	- Structured JSON logging (`server/logging.js`) with latency metrics for primary & secondary jobs.
	- Error classification module (`server/errorClassification.js`) producing category + retryable hints.
	- Dead Letter Queue (BullMQ queue `simulation-dlq`) with Redis counters & bounded sample list per simulation.
	- DLQ reconciliation endpoint `GET /api/simulations/:id/dlq` returning category counts & recent samples.
	- Enhanced metrics fallback endpoint (`/api/simulations/:id/metrics2`) providing Redis-first, DB-fallback metrics + source provenance.
	- Adaptive activity thinning in worker based on queue depth & circuit breaker state (logged when applied).

### Changed
- Worker event handlers now emit structured logs instead of plain console output.

### Internal
- Added DLQ routing logic that only routes terminal failures (non-retryable or attempts exhausted) to reduce noise.
- Classification categories: rate_limit, network, auth, validation, timeout, unknown.

- Placeholder for upcoming enhancements (DLQ, Prometheus metrics, shard hashing, per-segment progress metrics).

## [2025-09-28]
### Added
- Hour-based segment lazy expansion (first segment only initially enqueued).
- Timestamp cache (`sim:<id>:timestamps`) with worker fallback recompute.
- Shard-ready primary queues (`simulation-jobs:<shard>`) and multi-shard worker spawning via `SIMCRM_QUEUE_SHARDS`.
- Secondary activity scheduling (notes, calls, tasks, tickets) with deterministic RNG, global budgets, per-record caps, delayed enqueue, and idempotency markers.
- Segment status endpoint: `GET /api/simulations/:id/segments`.
- Rate limiting primitives: token buckets (scenario capacity aware), 429 cooldown, circuit breaker.
- Expanded health endpoint exposing rate limiter and breaker state.
- Redis key taxonomy documented in `docs/job-queue-architecture.md`.

### Changed
- `orchestrator.js` now only enqueues first segment; subsequent segments expanded by worker.
- `worker.js` now handles segment expansion, timestamp cache usage, multi-shard worker spawning.
- Documentation overhaul: architecture and rate limiting docs updated; README appended with condensed changelog.

### Fixed
- Prevented duplicate secondary job enqueue using per-(record,type,ordinal) Redis markers.
- Avoided re-computation of distribution on every segment expansion (cache first strategy).

### Security / Reliability
- Circuit breaker prevents burst-failure thrash.
- Cooldown defers outbound API attempts after 429s to reduce cascading failures.

### Observability
- Metrics hash includes scheduled + created counts for secondary activities.
- Redis memory sampled periodically to log high utilization warnings (>80%).

## [Earlier]
For earlier prototype phases (pre-changelog) see commit history. Prior milestones included: encrypted per-user HubSpot token storage, initial BullMQ integration, basic distribution-based enqueue, and early simulation UI onboarding flow.
