# SimCRM - HubSpot Simulation

Lightweight React + Vite app that simulates HubSpot CRM activity by creating contacts, companies, associations, notes, deals and progressing them through marketing and sales stages.

## Onboarding Configuration Flow (Current UI)

After authentication the user is guided through a linear configuration pipeline:

1. SaaS Selection (HubSpot path enables token setup)
2. HubSpot Token Setup & Validation (only when HubSpot chosen)
3. Theme Selection (12-tile grid)
4. Distribution Method Selection (9-tile grid; CUSTOM center)
5. Scenario Selection (B2B vs B2C)

Each step includes back navigation and an 8‑bit pluck sound for interactions. Selections are ephemeral (not persisted yet). Upcoming work: persist these choices and surface a summary before launching simulations.

Scenario & distribution metadata live in:
* `src/components/Distribution/distributionOptions.js`
* `src/components/Scenario/scenarioOptions.js`

Planned semantics (scenarios) include: lead volume multiplier, sales cycle duration, funnel attrition, deal size distribution, contact:company ratio. These will feed the job queue scheduling + record creation layer (see `docs/job-queue-architecture.md`).

Getting started

1. Install dependencies:

```powershell
npm install
```

2. Run the dev server:

```powershell
npm run dev
```

3. Run tests:

```powershell
npm test
```

Notes

- This is a local simulation only and does not call HubSpot APIs. It is structured so real API calls could be swapped into the SimulationEngine.
 - Per-user HubSpot Private App tokens are now supported & encrypted at rest. See `docs/integrations-hubspot-tokens.md`.
 - Upcoming: `docs/scenarios.md` (in progress) will describe B2B/B2C parameterization once persistence + job queue integration lands.
 - Job Queue groundwork added: `simulations` table migration, BullMQ queue (`simulation-jobs`), `server/worker.js` consumer, and simulation API endpoints (`/api/simulations`).
 - Advanced queue features: segmented lazy expansion (hour slices), timestamp cache (`sim:<id>:timestamps`), shard-ready primary queues (`simulation-jobs:<shard>`), secondary activity queue (`simulation-secondary`), segment status endpoint, and rate limiting (token buckets + cooldown + circuit breaker). See `docs/job-queue-architecture.md` and `docs/ratelimits.md`.
 - Phase 5 reliability/ops: structured JSON logging, DLQ with replay & audit trail, adaptive thinning (persisted), Prometheus exporter, configurable attempts/backoff, boss role + operations console (DLQ & thinning panels).

### Simulation API (Relevant Endpoints)
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/simulations/:id/metrics` | Returns simulation metrics (records + secondary scheduling counts) |
| GET | `/api/simulations/:id/segments` | Lists segment metadata & expansion flags |
| POST | `/api/simulations` | Create a simulation (queued) |
| POST | `/api/simulations/:id/start` | Start (enqueue first segment) |

### HubSpot Owner & Pipeline Selection
When a user has an active HubSpot key, the Timing & Quantities step auto-fetches:

* Deal Pipelines: `GET /api/hubspot/deal-pipelines`
* Users (HubSpot Users API – surfaced as potential owners): `GET /api/hubspot/users`

Selected values are persisted on simulation creation under `hubspot` in the request body. Corresponding DB columns (`hubspot_pipeline_id`, `hubspot_owner_ids` JSON text) were added by migration `20250927_add_simulation_hubspot_metadata.js`.

Validation rules (server + client): if HubSpot context is active you must select a pipeline and ≥1 owner before launching. Multiple owners cause random owner assignment per created record (uniform distribution for now). The summary modal lists pipeline + owner count for final confirmation.


### Running Workers (Single or Multi-Shard)
Primary queue naming now uses a shard suffix: `simulation-jobs:0`, `simulation-jobs:1`, ...

Single shard (default):
```powershell
node server/worker.js
```

Multiple shards in one process (spawns workers 0..N-1):
```powershell
$env:SIMCRM_QUEUE_SHARDS="3"; node server/worker.js
```

Future enhancement will hash simulation IDs across shards; currently all simulations map to shard 0 but additional workers can still process secondary queue concurrently and prepare for future distribution.

## Tetris Verification Mini-Game Modes

The verification mini-game supports two mechanics profiles selectable via the `mode` prop on `TetrisVerification` (current default = classic for authenticity):

| Mode | Preview | Ghost | Hard Drop | Soft Drop | DAS/ARR | Gravity Scaling | Line Clear Delay | Randomizer |
|------|---------|-------|-----------|-----------|---------|-----------------|------------------|------------|
| enhanced | ✅ | ✅ | ✅ | Hold Down (accelerated) | Disabled by default | Optional off (fixed) | 0 ms | Pure RNG |
| classic (default) | ❌ | ❌ | ❌ | Per-frame descent while held | Enabled (170ms DAS / 50ms ARR) | Enabled (Game Boy style table) | 250 ms | Pure RNG |

Configuration flags are merged from a base config plus classic overrides. Internals are in `src/components/tetris/useTetrisEngine.js`.

Key implementation notes:

- Rotation has no wall/floor kicks; O piece rotation is a no-op – preserves classic behavior.
- Unified requestAnimationFrame loop handles gravity progression and DAS/ARR lateral auto-shift.
- Soft drop behavior: classic performs a downward attempt every frame while Down is held (independent of gravity timer). Enhanced uses gravity only unless hard drop or future accelerations added.
- Line clear delay (classic) freezes gravity and spawns the next piece after 250ms to emulate original pacing.
- Randomizer abstraction supports future 7‑bag (`bag7`) but defaults to `pure` for both modes (1989 GB used pure RNG).
- Ghost and next preview are conditionally stripped from engine output when disabled to avoid rendering conditionals leaking state.

Example usage forcing classic mode:

```jsx
<TetrisVerification mode="classic" onSuccess={...} onExit={...} />
```

Enhanced mode is opt-in: pass `mode="enhanced"`.

Bug fixes / authenticity adjustments:
- Hard drop now locks synchronously (no frame delay) and is disabled entirely in classic mode.
- Soft drop implementation no longer piggybacks on gravity tick; it is frame-based for classic accuracy.

## Authentication & Password Storage

The current auth layer provides development-oriented signup/login with the following characteristics:

- Table: `users` (auto-migrated from legacy `dev_users` if present via runtime logic or Knex migration).
- Password format: `password_hash` column using `scrypt:<salt>:<hash>` (Node.js crypto.scryptSync 64-byte derivation, hex encoded).
- Legacy columns (`cred_salt`, `cred_hash`) are read only if they still exist; new inserts avoid them unless present.
- Runtime guard `ensureUsersTable()` performs minimal, idempotent adjustments; formal schema is managed through Knex migrations.

### Migration / Schema Management

Knex is included for explicit schema management.

Scripts:
```powershell
npm run migrate:latest   # Apply pending migrations
npm run migrate:list     # Show migration status
```

Initial migration: `20250926_initial_users.js` will rename `dev_users` → `users` if needed, create a clean table otherwise, and backfill `password_hash` from legacy columns where appropriate.

### Security Notes & Next Steps

- Replace synchronous scrypt with async scrypt or Argon2id (recommended) before production exposure.
- Add UNIQUE(emailId) and UNIQUE(playerNameId) constraints via a future migration (currently only indexed).
- Add rate limiting & account lockout for brute-force mitigation.
- Implement session or JWT issuance (none yet—responses are stateless success objects only).
- Introduce versioned hash format (e.g., `algo:v1:salt:hash`) to enable future rotations.
- Remove legacy columns after confirming all rows hold non-null `password_hash`.

### Environment Variables (DB Auth)
```powershell
DB_HOST=localhost
DB_USER=your_user
DB_PASS=your_pass
DB_NAME=simcrm
DB_PORT=3306
TOKEN_ENC_SECRET=32-byte-random-secret-value
# HUBSPOT_API_TOKEN (optional legacy global token; not required)
```

Optional override for JSON dev fallback location:
```powershell
DEV_AUTH_DATA_FILE=absolute\path\to\dev-auth.json
```

## Production Data Policy (No Dummy / Placeholder Data)

All new code MUST avoid the use of fake, dummy, sample, example, or placeholder values in any execution path that impacts:
- Authentication / user identity
- HubSpot credential storage or validation
- Database persistence
- External API calls

Rules:
1. Do not auto-fallback to synthetic user IDs (e.g. `demo-user`). A real authenticated `user.id` is required; otherwise the request fails fast (400).
2. No length-based token heuristics; validation must rely on a real HubSpot API response.
3. Test helpers must be clearly isolated (unit tests only) and never leak mock tokens or stubbed identifiers into runtime modules.
4. Encrypted secrets remain encrypted at rest; never log decrypted tokens.
5. Any temporary instrumentation must be removed before commit (no `console.log` of secrets, no sandbox keys).
6. If a required runtime value (env var, user id, token) is absent, abort with an explicit error; do not silently substitute.

Contribution Gate:
Before merging, review changes for: (a) accidental reintroduction of placeholders, (b) broad try/catch swallowing production errors, (c) mock-only flows.

Violation Handling:
A found violation triggers immediate PR block until remediated. Repeat issues require adding automated lint/AST rule.

## Changelog (Condensed)
See `CHANGELOG.md` for full details. Recent highlights:
| Date | Area | Summary |
|------|------|---------|
| 2025-09-28 | Queue Architecture | Added hour-based segment lazy expansion, timestamp cache, shard-ready primary queues |
| 2025-09-28 | Secondary Activities | Deterministic RNG scheduling with budgets, idempotency markers |
| 2025-09-28 | Rate Limiting | Token buckets + 429 cooldown + circuit breaker integrated into worker |
| 2025-09-28 | Observability | Segment status endpoint, expanded health output, metrics hash fields |
| 2025-09-28 | Docs | Comprehensive architecture rewrite & rate limit clarifications |

Full history: `CHANGELOG.md`.

## Documentation Map
| Topic | File |
|-------|------|
| Architecture (queues, segments, sharding) | `docs/job-queue-architecture.md` |
| Rate limiting & resilience | `docs/ratelimits.md` |
| Operations runbook (commands, run, debug) | `OPERATIONS.md` |
| Change history | `CHANGELOG.md` |
| HubSpot token storage | `docs/integrations-hubspot-tokens.md` |
| Scenarios design | `docs/scenarios.md` |

These docs are intentionally structured for automated agents: each file is a self-contained domain slice; cross-links minimize redundant scanning.

## Docs — Quick Table of Contents
Short, actionable guide to the `docs/` folder: when to read each file and how to use it while working on the app.

- `docs/job-queue-architecture.md` — Full architecture for simulation orchestration (segments, timestamp cache, shards, primary vs secondary queues). Read this when modifying worker logic, segment expansion, or any job scheduling behaviour.
- `docs/job-queue-architecture.md` — Full architecture for simulation orchestration (segments, timestamp cache, shards, primary vs secondary queues). Read this when modifying worker logic, segment expansion, or any job scheduling behaviour. Related code: `server/worker.js`, `server/orchestrator.js` [backend]
- `docs/ratelimits.md` — Details token-bucket, 429 cooldown and circuit-breaker behavior. Consult before changing outbound API pacing, retry/backoff, or adding sleeps inside worker flows.
- `docs/ratelimits.md` — Details token-bucket, 429 cooldown and circuit-breaker behavior. Consult before changing outbound API pacing, retry/backoff, or adding sleeps inside worker flows. Related code: `server/rng.js`, `server/logging.js`, `server/worker.js` [backend/ops]
- `docs/integrations-hubspot-tokens.md` — How tokens are encrypted, validated, and stored (`hubspot_api_keys`). Use when touching HubSpot auth, key management, or validation endpoints.
- `docs/integrations-hubspot-tokens.md` — How tokens are encrypted, validated, and stored (`hubspot_api_keys`). Use when touching HubSpot auth, key management, or validation endpoints. Related code: `server/cryptoUtil.js`, `server/hubspotKeyStore.js`, `server/hubspotClient.js` [backend]
- `docs/record-creation-rules.md` — Writable vs read-only HubSpot fields per object (contacts, companies, deals, engagements). Reference before adding or changing properties sent to HubSpot to avoid invalid fields.
- `docs/record-creation-rules.md` — Writable vs read-only HubSpot fields per object (contacts, companies, deals, engagements). Reference before adding or changing properties sent to HubSpot to avoid invalid fields. Related code: `server/tools/hubspot/*.js`, `server/toolsFactory.js` [backend]
- `docs/redis-plain-language.md` — Human-friendly explanations of the Redis keyspace used by simulations. Useful when debugging coordination state or inspecting keys in the Redis CLI.
- `docs/redis-plain-language.md` — Human-friendly explanations of the Redis keyspace used by simulations. Useful when debugging coordination state or inspecting keys in the Redis CLI. Related code: `server/orchestrator.js`, `server/worker.js` [ops]
- `docs/observability.md` — Logging, metrics, and Prometheus exporter notes. Read when adding metrics, changing log format, or instrumenting worker events.
- `docs/observability.md` — Logging, metrics, and Prometheus exporter notes. Read when adding metrics, changing log format, or instrumenting worker events. Related code: `server/logging.js`, `src/components/ObservabilityDashboard.jsx` [ops/frontend]
- `docs/ui-rules.md` — UI style guardrails (fonts, colors, component styling). Use for any frontend UI/UX changes to keep visuals consistent.
- `docs/ui-rules.md` — UI style guardrails (fonts, colors, component styling). Use for any frontend UI/UX changes to keep visuals consistent. Related code: `src/components/*`, `src/components/Themes/*` [frontend]
- `docs/scenarios.md` — Scenario parameter definitions (B2B/B2C multipliers, sales cycle knobs). Consult when adding new scenarios or changing distribution semantics.
- `docs/scenarios.md` — Scenario parameter definitions (B2B/B2C multipliers, sales cycle knobs). Consult when adding new scenarios or changing distribution semantics. Related code: `src/components/Scenario/scenarioOptions.js`, `server/scenarioParameters.js` [frontend/backend]
- `docs/verification-flow.md` — Tetris verification mini‑game behavior and modes. Read when adjusting verification logic or test flows that depend on success/failure conditions.
- `docs/verification-flow.md` — Tetris verification mini‑game behavior and modes. Read when adjusting verification logic or test flows that depend on success/failure conditions. Related code: `src/components/TetrisVerification.jsx`, `src/components/tetris/useTetrisEngine.js` [frontend]
- `docs/hubspot-api-registry.md` — Registry of HubSpot endpoints and mappings used by the app. Useful when adding new object types or checking supported HubSpot API paths.
- `docs/hubspot-api-registry.md` — Registry of HubSpot endpoints and mappings used by the app. Useful when adding new object types or checking supported HubSpot API paths. Related code: `server/tools/hubspot/apiRegistry.js`, `server/tools/hubspot/*.js` [backend]
- `docs/catalog/INDEX.md` — Index of reference snippets and example payloads. Use for quick copyable examples when creating tests or sample fixtures (non-runtime only).
- `docs/catalog/INDEX.md` — Index of reference snippets and example payloads. Use for quick copyable examples when creating tests or sample fixtures (non-runtime only). Related code: `test/`, `docs/` [tests/docs]

How to use this TOC: pick the doc that matches your change domain first (e.g., worker -> `job-queue-architecture.md`, HubSpot fields -> `record-creation-rules.md`), then scan linked docs for cross-cutting rules (security, observability, UI). If a behavior isn't documented, open an `agent-spec` issue so we can augment these docs.

