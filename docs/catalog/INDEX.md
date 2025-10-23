# Documentation Catalog

This catalog enumerates all documentation assets in the `docs/` directory, explains what each covers, why it exists (necessity rationale), and how it connects to adjacent files / runtime components. Use this as the authoritative map when onboarding or extending SimCRM.

> Conventions: Scope tags in brackets indicate the dominant area.
> - [ARCH] Architecture / system design
> - [RUNTIME] Operational runtime behavior
> - [API] External surface or integration contract
> - [DATA] Data modeling or persistence semantics
> - [OPS] Operational excellence (observability, resiliency)
> - [FLOW] User / system flow sequence
> - [GUIDE] Plain-language or onboarding guidance
>
> Rationale taxonomy: (Decision, Constraint, Risk Mitigation, Onboarding, Operational Clarity)

---
## Core Architecture & Execution

### job-queue-architecture.md  
**Tags:** [ARCH][RUNTIME][OPS]  
**Purpose:** Deep dive into the BullMQ + Redis segmented scheduling model, sharding readiness, secondary fan‑out, rate control layers.  
**Necessity:** (Decision / Operational Clarity) Documents why segmentation & timestamp caching trade memory for deterministic timing and fast starts; provides blueprint for scaling & recovering.  
**Key Links:** References `worker.js`, `orchestrator.js`, `ratelimits.md`, Redis key taxonomy.

### record-creation-rules.md  
**Tags:** [DATA][ARCH]  
**Purpose:** Defines deterministic rules for contact/company/deal generation and progression logic.  
**Necessity:** (Decision) Ensures consistent synthetic data semantics across simulation runs and enables reproducibility when rehydrating or debugging.

### scenarios.md  
**Tags:** [ARCH][DATA]  
**Purpose:** Documents scenario parameterization (B2B vs B2C) and prospective levers (volume multipliers, sales cycle, attrition).  
**Necessity:** (Decision / Onboarding) Centralizes scenario shaping inputs feeding future orchestration modifiers.

## Integrations & External Surfaces

### integrations-hubspot-tokens.md  
**Tags:** [API][OPS]  
**Purpose:** Explains HubSpot token handling, validation, storage, and rotation considerations.  
**Necessity:** (Risk Mitigation) Clarifies secure handling patterns and failure modes for external API auth.

### verification-flow.md  
**Tags:** [FLOW][API]  
**Purpose:** Outlines verification / confirmation steps (likely for credential or key activation).  
**Necessity:** (Operational Clarity) Establishes explicit sequence & checkpoints to reduce inconsistent activation state.

## Reliability, Performance & Limits

### ratelimits.md  
**Tags:** [OPS][RUNTIME]  
**Purpose:** Describes rate limiting strategy (token buckets, cooldown, breaker), key naming, and decision logic.  
**Necessity:** (Risk Mitigation) Guards against vendor throttling & ensures graceful degradation.

### observability.md  
**Tags:** [OPS][RUNTIME]  
**Purpose:** Telemetry, structured logging, metrics endpoints, event taxonomy.  
**Necessity:** (Operational Clarity) Provides the contract for instrumentation enabling troubleshooting & capacity planning.

### redis-plain-language.md  
**Tags:** [GUIDE][OPS]  
**Purpose:** Plain-language explanation of Redis usage patterns for non-specialists.  
**Necessity:** (Onboarding) Lowers barrier for contributors new to distributed coordination.

## Cross-Cutting Flow Artifacts

### verification-flow.md  
(See above; also cross-referenced here for flow categorization.)

## Catalog Maintenance

Add new docs with a short entry:
```
### <filename>
**Tags:** [TAG][TAG]
**Purpose:** One sentence clear value statement.
**Necessity:** (Rationale) Pick from: Decision / Constraint / Risk Mitigation / Onboarding / Operational Clarity.
**Key Links:** (optional) related files, modules or endpoints.
```

Run a periodic sweep:
- Verify every referenced module still exists.
- Trim deprecated sections (mark with Deprecated: and removal reason before deleting in a subsequent release).
- Keep Redis key lists synchronized with new feature flags or queue additions.

## Relationship Map (Quick View)
- Scenarios feed Orchestrator → influences Timestamp Cache (job-queue-architecture) → consumed by Workers → instrumented via Observability & limited via RateLimits.
- Integrations (HubSpot tokens) prerequisite for orchestrated external object creation flows; failures surface in Observability & RateLimits metrics.
- Redis Plain Language guides interpretation of Keys listed in Job Queue Architecture & Rate Limits.

## Gaps / TODO Candidates
- Add doc for: Simulation progress endpoints contract.
- Add doc for: Secondary activity probability tuning & overrides.
- Add doc for: Frontend simulation vs backend orchestration parity matrix.

---
_Last regenerated: 2025-09-30_
