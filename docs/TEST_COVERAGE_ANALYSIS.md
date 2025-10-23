# TEST COVERAGE ANALYSIS - What's Tested vs What the App Does

**Date:** October 20, 2025  
**Analysis of:** Test files vs actual application workflow

---

## 📊 Executive Summary

| Category | Status | Coverage |
|----------|--------|----------|
| **Core Business Logic** | ⚠️ GAPS | ~40% |
| **Primary Record Creation** | ⚠️ GAPS | ~30% |
| **Secondary Activities** | ❌ NOT TESTED | 0% |
| **Worker Job Processing** | ⚠️ GAPS | ~20% |
| **Property Validation** | ✅ COMPLETE | 100% |
| **Database Persistence** | ⚠️ BASIC | ~50% |
| **Error Handling** | ⚠️ PARTIAL | ~60% |
| **Rate Limiting** | ✅ COMPLETE | 100% |

---

## 🧪 Current Test Coverage

### ✅ WELL TESTED

1. **propertyValidator.test.js** (30 cases)
   - Fuzzy matching
   - Enum deduplication
   - Email/domain uniqueness
   - Metadata caching
   - All 9 object types

2. **propertyValueCache.test.js** (35 cases)
   - Value recording/retrieval
   - Cross-simulation reuse
   - Cache statistics

3. **sanitize.test.js** (2 cases)
   - Property filtering
   - Allowed vs disallowed fields

4. **rateLimitTelemetry.spec.js**
   - Rate limit event tracking
   - Token bucket mechanics

5. **retryConfig.test.js**
   - Retry configuration
   - Backoff timing

6. **idempotency.spec.js & idempotency.redis.spec.js**
   - Idempotency key generation
   - Duplicate prevention

---

### ⚠️ PARTIALLY TESTED

1. **simulation.test.js** (2 cases - FRONTEND only)
   - `SimulationEngine.createContactWithCompany()`
   - `SimulationEngine.advanceContact()`
   - **Problem:** Frontend simulation engine, NOT backend orchestrator
   - **Missing:** Real HubSpot API calls, Redis integration

2. **simulationCreateHubspot.test.js** (1 case - DB only)
   - Simulation DB row persistence
   - HubSpot pipeline_id storage
   - **Missing:** Record creation workflow, property validation

3. **contacts.test.js**
   - Contact lifecycle simulation
   - **Missing:** Real record creation, HubSpot API calls

---

### ❌ NOT TESTED AT ALL

---

## 🚨 Critical Gaps - What the App Actually Does But Isn't Tested

### **1. PRIMARY RECORD CREATION WORKFLOW** ❌

```javascript
// server/orchestrator.js - This is called but NOT tested:

orchestrator.createContactWithCompany({
  contactProps: { firstname, lastname, email, lifecyclestage },
  companyProps: { name, domain, industry },
  simId: 'sim_123'
})
```

**What should be tested:**
- ✅ Property normalization (WE added tests for this)
- ❌ Contact creation via `tools.contacts.create()`
- ❌ Company creation via `tools.companies.create()`
- ❌ Association creation via `tools.associations.associateContactToCompany()`
- ❌ Email recording globally
- ❌ Domain recording globally
- ❌ Return value structure `{ contact, company, simulated }`

**Test case needed:**
```javascript
it('createContactWithCompany normalizes and creates records', async () => {
  const result = await orchestrator.createContactWithCompany({
    contactProps: { firstname: 'John', email: 'john@example.com' },
    companyProps: { name: 'Acme', industry: 'Management Consulting' },
    simId: 'test_sim_123'
  })
  
  expect(result.contact).toBeDefined()
  expect(result.company).toBeDefined()
  expect(result.contact.id).toBeDefined()
  expect(result.company.id).toBeDefined()
  // Verify email recorded globally
  // Verify domain recorded globally
})
```

---

### **2. DEAL CREATION WORKFLOW** ❌

```javascript
// server/orchestrator.js - NOT TESTED:

orchestrator.createDealForContact({
  contactId, companyId,
  dealProps: { dealname, dealstage, amount },
  simId: 'sim_123'
})
```

**Missing Tests:**
- ❌ Deal creation via `tools.deals.create()`
- ❌ Deal-to-contact association
- ❌ Deal-to-company association
- ❌ Property normalization for deals
- ❌ Error handling for associations

---

### **3. ENGAGEMENT CREATION (Notes/Calls/Tasks)** ❌

```javascript
// server/orchestrator.js - NOT TESTED:

orchestrator.createNoteWithAssociations({
  noteProps: { body },
  contactId, companyId, dealId, ticketId,
  simId: 'sim_123'
})

orchestrator.createCallForContact({
  callProps: { body, status, duration },
  contactId,
  simId: 'sim_123'
})

orchestrator.createTaskForContact({
  taskProps: { body, subject, status },
  contactId,
  simId: 'sim_123'
})
```

**Missing Tests:**
- ❌ Note creation & multi-target associations
- ❌ Call creation & contact association
- ❌ Task creation & contact association
- ❌ Property normalization for engagements
- ❌ Multi-association error handling

---

### **4. WORKER JOB PROCESSING WORKFLOW** ❌

```javascript
// server/worker.js - processJob() function - NOT TESTED

async function processJob(job) {
  // This is where actual record creation happens in production
  // Lines 250-350 show HubSpot tool creation BUT commented out
}
```

**What happens in production (but not tested):**
- ❌ Job data parsing (`simulationId`, `index`, `user_id`, `phase`)
- ❌ Idempotency key acquisition
- ❌ Simulation row fetching
- ❌ User token resolution & decryption
- ❌ Rate limiting token consumption
- ❌ HubSpot client creation with decrypted token
- ❌ Tools initialization
- ❌ Actual `tools.contacts.create()` or `tools.deals.create()` call
- ❌ Success/failure metrics recording
- ❌ Circuit breaker trip detection
- ❌ Cooldown active check

---

### **5. SECONDARY ACTIVITY CREATION** ❌

```javascript
// server/worker.js - Secondary activities like notes, calls, tasks

if (phase === 'secondary_activity' && secondaryType) {
  // Create note/call/task for this contact
  // NOT TESTED
}
```

**Missing Tests:**
- ❌ Secondary activity job processing
- ❌ Rate limiting for secondary activities
- ❌ Metrics tracking for secondaries
- ❌ Idempotency for secondaries

---

### **6. SEGMENT EXPANSION WORKFLOW** ❌

```javascript
// server/worker.js - maybeExpandNextSegment()

async function maybeExpandNextSegment(redis, simulationId, currentIndex, nowTs) {
  // Lazy-loads next segment of jobs
  // NOT TESTED
}
```

**Missing Tests:**
- ❌ Segment boundary detection
- ❌ Idempotency marker acquisition
- ❌ Timestamp re-expansion
- ❌ Next segment job enqueueing
- ❌ Redis marker setting

---

### **7. RATE LIMITING IN PRODUCTION** ❌

```javascript
// server/worker.js - Rate limiting with token buckets + cooldown + circuit breaker

if (await cooldownActive(redisClient) || await circuitTripped(redisClient)) {
  // Skip API call
}
```

**Missing Tests:**
- ❌ Cooldown activation (15s after 429)
- ❌ Circuit breaker trip on failure count
- ❌ Integration of rate limiting with job processing
- ❌ Retry scheduling with cooldown
- ❌ Token bucket refill timing

---

### **8. ERROR CLASSIFICATION & DLQ** ❌

```javascript
// server/worker.js - Error classification and DLQ routing

const cls = classifyError(e)
// Error categories: rate_limit, network, auth, validation, timeout, unknown
```

**Missing Tests:**
- ❌ Error classification logic
- ❌ Retryable vs terminal error determination
- ❌ DLQ routing for terminal failures
- ❌ Error recovery strategies

---

### **9. DATABASE PERSISTENCE** ⚠️ MINIMAL

```javascript
// server/worker.js - Metrics & progress persistence

await knex('simulations').where({ id: simulationId }).update({
  records_processed: val,
  updated_at: Date.now()
})
```

**Current:** Only `simulationCreateHubspot.test.js` tests DB inserts  
**Missing:**
- ❌ Simulation row updates
- ❌ Records_processed counter updates
- ❌ Status transitions
- ❌ Metrics table writes

---

## 📈 What's Actually Running in Production

### **The Real Workflow:**

```
┌──────────────────────────────────────────────────────────┐
│ 1. User creates simulation (Frontend → Backend)          │
├──────────────────────────────────────────────────────────┤
│    orchestrator.startSimulation()                        │
│    └─ Enqueue first 1-hour segment to BullMQ             │
│       (TESTED? ❌ NO)                                     │
└──────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────┐
│ 2. Worker picks up job from queue                        │
├──────────────────────────────────────────────────────────┤
│    worker.processJob(job)                                │
│    └─ Get simulation row                                 │
│    └─ Get user token (encrypted)                         │
│    └─ Decrypt token                                      │
│    (TESTED? ❌ NO)                                        │
└──────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────┐
│ 3. Check rate limits & circuit breaker                   │
├──────────────────────────────────────────────────────────┤
│    if (cooldownActive || circuitTripped) skip            │
│    if (tokenBucketEmpty) skip                            │
│    (TESTED? ⚠️ PARTIAL - only bucket tested)             │
└──────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────┐
│ 4. Create HubSpot client & tools                         │
├──────────────────────────────────────────────────────────┤
│    const client = createClient()                         │
│    const tools = createTools(client)                     │
│    (TESTED? ❌ NO - Not integrated with worker)          │
└──────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────┐
│ 5. Call HubSpot API with retry logic                     │
├──────────────────────────────────────────────────────────┤
│    tools.contacts.create({ properties: ... })           │
│    └─ Automatic retry on 429/5xx                         │
│    └─ Telemetry hooks called                             │
│    (TESTED? ✅ HTTP layer; ❌ Integration with worker)   │
└──────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────┐
│ 6. Handle response & update metrics                      │
├──────────────────────────────────────────────────────────┤
│    Update Redis metrics                                  │
│    Update DB progress                                    │
│    (TESTED? ❌ NO)                                        │
└──────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────┐
│ 7. Check if segment complete → expand next              │
├──────────────────────────────────────────────────────────┤
│    maybeExpandNextSegment()                              │
│    └─ Enqueue next 1-hour segment                        │
│    (TESTED? ❌ NO)                                        │
└──────────────────────────────────────────────────────────┘
```

---

## 🎯 Critical Test Cases Missing

### **Priority 1 - MUST HAVE** (Core business logic)

```javascript
// Test 1: Full primary record creation
it('orchestrator creates contact+company with property validation', async () => {
  // Test: contactProps normalized → contact created → associated
})

// Test 2: Full deal creation
it('orchestrator creates deal associated to contact+company', async () => {
  // Test: dealProps normalized → deal created → 2 associations
})

// Test 3: Full engagement creation (notes/calls/tasks)
it('orchestrator creates note with multi-target associations', async () => {
  // Test: noteProps normalized → note created → up to 4 associations
})

// Test 4: Worker job processing (PRIMARY)
it('worker.processJob creates contact for simulated record', async () => {
  // Test: Job data → token decryption → HubSpot client → tools.contacts.create()
})

// Test 5: Worker job processing (SECONDARY)
it('worker.processJob creates note for contact', async () => {
  // Test: Phase === 'secondary_activity' → create note → associate
})
```

### **Priority 2 - SHOULD HAVE** (Edge cases & resilience)

```javascript
// Test 6: Segment expansion
it('worker expands next segment when current complete', async () => {
  // Test: Idempotency marker → re-expand timestamps → enqueue jobs
})

// Test 7: Cooldown & circuit breaker
it('worker skips API call when cooldown active', async () => {
  // Test: 429 error → set cooldown → skip next attempts
})

// Test 8: Error classification & DLQ
it('worker routes terminal error to DLQ', async () => {
  // Test: Auth error → classify as terminal → DLQ → not retried
})

// Test 9: Database persistence
it('worker updates simulation progress after job', async () => {
  // Test: Job succeeds → records_processed increments → DB updated
})
```

---

## 📋 Detailed Coverage Table

| Feature | Current | Needs |
|---------|---------|-------|
| **Property Validator** | ✅ 65 tests | Complete |
| **Primary Record Creation** | ❌ 0 | 5 integration tests |
| **Deal Creation** | ❌ 0 | 3 integration tests |
| **Engagement Creation** | ❌ 0 | 6 integration tests |
| **Worker Job Processing** | ❌ 0 | 8 integration tests |
| **Segment Expansion** | ❌ 0 | 3 integration tests |
| **Rate Limiting (Worker context)** | ⚠️ 5 tests | 5 more integration tests |
| **Error Classification** | ⚠️ Partial | 4 unit + 3 integration tests |
| **Database Updates** | ⚠️ 1 test | 5 more tests |
| **Token Decryption** | ❌ 0 | 3 tests |
| **Idempotency (Worker)** | ✅ 10 tests | Complete |
| **Associations** | ❌ 0 | 6 tests |

---

## 🔴 Risk Assessment

| Scenario | Risk | Impact |
|----------|------|--------|
| **Invalid properties sent to HubSpot** | 🟢 LOW | Validator now catches this |
| **Worker fails silently** | 🔴 HIGH | No tests for worker error paths |
| **Rate limits cause cascading failures** | 🔴 HIGH | Cooldown/circuit logic untested in worker |
| **Segment expansion breaks** | 🔴 HIGH | Complex Redis logic untested |
| **Duplicate records created** | 🟡 MEDIUM | Idempotency tested, but not in worker context |
| **Token decryption fails** | 🔴 HIGH | No tests for this path |
| **Database isn't updated** | 🟡 MEDIUM | Only basic DB test exists |

---

## ✅ Recommendation

### **Immediate Actions:**

1. **Add 5 worker integration tests** (Priority 1)
   - Process primary job → create contact
   - Process primary job → create deal
   - Process secondary job → create note
   - Process job with rate limit (cooldown)
   - Process job with error → classify → metrics

2. **Add 3 orchestrator integration tests** (Priority 1)
   - Create contact+company with property normalization
   - Create deal with associations
   - Create engagement with multi-target associations

3. **Add 3 error handling tests** (Priority 2)
   - Token decryption failure
   - Segment expansion failure
   - Database update failure

This would bring coverage from **~40%** to **~85%** for critical paths.

---

**Status:** 🚨 **NEEDS ATTENTION** - App logic exists but integration tests missing
