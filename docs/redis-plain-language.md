# Redis & Queues – Plain Language Guide

If the Redis / BullMQ pieces feel overwhelming, this guide gives you a **minimum mental model** so you can reason about the system (and safely modify it) without memorizing every key.

---
## 1. TL;DR (One Breath Version)
Redis is our fast, shared scratchpad. BullMQ (the job queue library) also uses it. We drop quick‑changing, operational data in Redis (metrics, segment status, DLQ samples, thinning events, rate limit state). The database holds the durable simulation definition & progress counters. Frontend endpoints read Redis first (for freshness) and fall back to DB if Redis is off.

---
## 2. Why Not Just the Database?
| Concern | DB (MySQL) | Redis |
|---------|-----------|-------|
| Write frequency (every job/second) | Heavy / can lock | Fast in‑memory |
| Ephemeral ops state (rate limits, buckets) | Requires schema / churn | Natural (key expires / simple) |
| Queue engine storage | Not built-in | BullMQ native |
| Aggregation latency | Higher | Very low |

We combine them: **DB = Source of truth for simulations**, **Redis = live telemetry & transient control signals**.

---
## 3. Core Metaphor
Think of a simulation as a TV show production:

* Database = The official season script (episodes, total scenes planned).
* Redis = The whiteboard & sticky notes on set (scene currently filming, backlog, issues, quick tallies).
* BullMQ Queues = The call sheet scheduling which scene (job) is shot next.
* DLQ = A bin holding problem props (failed jobs) for a stage manager (boss) to inspect or re‑try.

You wouldn’t engrave sticky notes in stone tablets—same idea: ephemeral vs. durable.

---
## 4. Lifecycle (Bird’s Eye)
1. User creates simulation → row inserted in `simulations` table.
2. Orchestrator enqueues first “segment expansion” job into primary queue (`simulation-jobs:0`).
3. Worker pulls job from Redis queue, computes timestamps / segments, enqueues secondary jobs (notes, calls, tasks...).
4. Each processed job updates Redis hashes/counters (fast) and occasionally DB counters.
5. Frontend polls `/api/...` endpoints which read those Redis hashes / lists.
6. Failures exhaust retries → worker classifies → job parked in DLQ queue + category counters incremented.
7. Boss can inspect & selectively replay DLQ jobs.

---
## 5. Key Redis Structures (Practical Subset)
| Pattern | Example | Meaning |
|---------|---------|---------|
| Metrics Hash | `sim:<id>:metrics` | Fast counters: created, scheduled, processed, secondary activity tallies. |
| Segment Index (sorted set) | `sim:<id>:segments` | Ordered list of segment IDs (hour slices). |
| Segment Meta Hash | `sim:<id>:<segmentId>` | Start/end timestamps, first/last index per segment. |
| Segment Expanded Flag | `sim:<id>:<segmentId>:expanded` | Simple key presence means segment fully expanded. |
| DLQ Category Counts Hash | `sim:<id>:dlq:counts` | Per failure category tallies. |
| DLQ Sample List | `sim:<id>:dlq:samples` | Up to N recent failed job payload snapshots (JSON strings). |
| Thinning Events List | `sim:<id>:thinning:events` | Recent adaptive thinning decisions (capped). |
| Rate Limit Buckets | `ratelimit:bucket:<type>` | Remaining tokens (contacts, notes, etc.). |
| Cooldown Timestamp | `ratelimit:hubspot:cooldown_until` | Milliseconds epoch when 429 cooldown ends. |
| Circuit Breaker | `circuit:hubspot:tripped_until` | Milliseconds epoch until breaker resets. |
| Idempotency Markers | `sim:<id>:act:<recordId>:<type>:<ordinal>` | Prevent duplicate secondary enqueue. |
| Timestamp Cache | `sim:<id>:timestamps` | Precomputed distribution array (JSON or serialized form). |

You do NOT need all details at once; usually you care about 2–3 of these when debugging a specific symptom.

---
## 6. Minimal Mental Model (Memorize This)
1. A queue name = a stream of jobs processed by workers. (Primary = creation flow, Secondary = follow‑up activities, DLQ = failures.)
2. Every simulation has a Redis metrics hash for fast numbers.
3. Segments = chunked time windows; expanded lazily to avoid huge upfront enqueue bursts.
4. DLQ artifacts = category tallies + sample list for triage.
5. Thinning events = evidence the system intentionally skipped some optional secondary work (capacity safety valve).

If that’s all you hold in your head, you can still operate the system.

---
## 7. Typical Debug Scenarios
| Symptom | Quick Checks |
|---------|--------------|
| “Metrics frozen” | Is worker running? Does `sim:<id>:metrics` change? Fallback DB counters still move? |
| “DLQ spike” | Inspect `sim:<id>:dlq:counts` – which category? rate_limit vs auth vs validation. |
| “No secondary notes” | Look for thinning events list & rate limit buckets near zero. |
| “Replay doing nothing” | Ensure selected DLQ jobs match simulationId & category filters; confirm not dry-run. |
| “Breaker stuck” | Check `circuit:hubspot:tripped_until`; if far future maybe logic needs review. |

---
## 8. Observing Live State (Optional / Operator Mode)
If you have Redis CLI access:
```
KEYS sim:<id>:*
HGETALL sim:<id>:metrics
LRANGE sim:<id>:dlq:samples 0 5
HGETALL sim:<id>:dlq:counts
LRANGE sim:<id>:thinning:events 0 10
ZCARD sim:<id>:segments
```
Avoid running KEYS in production at scale—here it’s acceptable for local development. In larger installs use SCAN.

---
## 9. Safety Boundaries
| Mechanism | Purpose |
|-----------|---------|
| Thinning | Prevent runaway secondary backlog. |
| Retry Attempts | Avoid hammering external APIs indefinitely. |
| Circuit Breaker | Stop repeated immediate failures (e.g., auth misconfig). |
| DLQ | Preserve failed payloads for targeted recovery (not silent loss). |

---
## 10. Glossary (Plain Words)
| Term | Simple Meaning |
|------|----------------|
| Queue | To‑do list processed in order. |
| Job | One unit of work (create a contact, add a note). |
| DLQ (Dead Letter Queue) | Holding pen for jobs that gave up retrying. |
| Segment | A batch/time slice of future jobs. |
| Thinning | Intentionally skipping some optional jobs under pressure. |
| Bucket (rate limit) | Token counter representing remaining API “budget.” |

---
## 11. When to Ignore Redis
If you are purely modifying frontend UI, onboarding flow, or documentation about scenarios—**you can treat Redis as an internal black box** and just rely on the existing endpoints. You only need this guide when something feels “stuck” or you’re extending job orchestration.

---
## 12. Extending Safely
When adding a new ephemeral concern (e.g., tracking a new secondary activity):
1. Pick a clear key prefix: `sim:<id>:<yourThing>:...`
2. Decide data shape: hash for grouped numeric fields, list for recent events, sorted set for ordered scheduling.
3. Update an API endpoint (or add a new one) to expose it; do not let the frontend guess raw keys.
4. Add a short doc note here if the concept is operator‑relevant.

That’s it—keep it boring and consistent.

---
## 13. FAQ
**Q: What happens if Redis is off?**
Metrics endpoints fall back to DB counters; DLQ & thinning panels will show an empty state with source=`redis-disabled`.

**Q: Can DLQ entries vanish?**
Only if manually purged or queue retention settings change. We also keep counters & samples separately from queue entries.

**Q: Is data loss acceptable here?**
For transient metrics: yes (they regenerate). For DLQ items: no; that’s why they’re persisted as queue jobs until replayed or cleared.

---
## 14. Quick Mental Reboot
When feeling lost: say out loud → “DB holds plan. Redis holds live pulse. Queues are just lists in Redis. DLQ = problem bucket. Thinning = graceful skipping.”

You’re back.
