# Deployment Verification Checklist

**Purpose:** Manual verification steps for ensuring the property validator system works correctly in production environments

---

## Pre-Deployment Checks

### ✅ Code Review
- [ ] propertyValidator.js reviewed (370 lines)
- [ ] propertyValueCache.js reviewed (300 lines)
- [ ] orchestrator.js integration points checked (5 methods)
- [ ] No console.log statements left in production code
- [ ] Error handling implemented for all external calls

### ✅ Environment Variables
```bash
# Required environment variables must be set BEFORE deployment
echo "Checking required variables..."
echo "TOKEN_ENC_SECRET: ${TOKEN_ENC_SECRET:?Missing - required for token encryption}"
echo "DB_HOST: ${DB_HOST:?Missing - required for simulation data}"
echo "DB_USER: ${DB_USER:?Missing - required for database access}"
echo "DB_PASS: ${DB_PASS:?Missing - required for database access}"
echo "REDIS_HOST: ${REDIS_HOST:?Missing - required for caching}"
echo "SIM_REAL_MODE: ${SIM_REAL_MODE:?Set to '1' to enable real HubSpot writes}"
```

### ✅ Test Suite Passes
```bash
cd c:\programming\SimCRM\SimCRM-v7
npm test

# Expected: All tests in propertyValidator.test.js and propertyValueCache.test.js pass
# Expected: No errors in existing test suite
```

---

## Deployment Steps

### 1. Deploy Code
```bash
git push origin main
# Wait for CI/CD pipeline to complete
# Verify deployment to staging environment
```

### 2. Run Database Migrations
```bash
npm run migrate:latest

# Verify no errors
# Check that simulations and users tables exist
```

### 3. Start Services (in order)
```powershell
# Terminal 1: Redis (or verify connection to existing Redis)
redis-cli ping
# Expected: PONG

# Terminal 2: Frontend
npm run dev

# Terminal 3: Backend API
npm run start-server
# Expected: Listening on port 3000

# Terminal 4: Worker
node server/worker.js
# Expected: Worker starting, waiting for jobs

# Optional Terminal 5: Another worker shard
$env:SIMCRM_QUEUE_SHARDS="2"; node server/worker.js
```

---

## Verification Tests (Manual)

### ✅ Test 1: Property Validation Prevents Duplicate Enum Values

**Scenario:** Create a contact with an industry enum value that might duplicate

**Steps:**

1. **Enable Real Mode**
   ```bash
   $env:SIM_REAL_MODE="1"
   # Restart API server
   ```

2. **Create Simulation via Frontend**
   - Navigate to http://localhost:5173
   - Select HubSpot account
   - Select "B2B Distribution"
   - Create simulation with 100 records

3. **Monitor Worker Logs**
   ```bash
   # In worker terminal, look for:
   # - property normalized: contacts.industry -> "Management Consulting"
   # - property cached for reuse: sim:<id>:prop-cache:companies.industry
   ```

4. **Verify HubSpot Records**
   ```bash
   # Using HubSpot API or UI:
   # - Contacts should have industry values from allowed enum
   # - No "duplicate picklist value" errors in HubSpot activity log
   # - No 400 Bad Request errors in API logs
   ```

**Expected Result:**
- ✅ All 100 contacts created successfully
- ✅ No HubSpot 400 errors for duplicate property values
- ✅ Worker logs show normalization decisions
- ✅ Simulation status shows "completed" not "failed"

---

### ✅ Test 2: Cross-Simulation Property Reuse

**Scenario:** Create two simulations and verify property cache is reused

**Steps:**

1. **Create First Simulation**
   - 50 contacts with industry "Technology"
   - Monitor cache population in Redis:
     ```bash
     redis-cli
     > KEYS "prop-index:*"
     > GET "prop-index:companies:industry"
     ```

2. **Create Second Simulation**
   - Different user, same HubSpot account
   - 50 contacts with industry "Technology"
   - Verify NO additional HubSpot field metadata calls

3. **Check Cache Efficiency**
   ```bash
   redis-cli
   > HGET "sim:<id>:metrics" "prop_cache_hits"
   # Should be > 0 (cache was reused)
   
   > HGET "sim:<id>:metrics" "prop_cache_misses"
   # Should be < 50 (not fetching metadata every time)
   ```

**Expected Result:**
- ✅ Second simulation creates faster (cache hit)
- ✅ Fewer HubSpot API calls for field metadata
- ✅ No errors on either simulation

---

### ✅ Test 3: Email Deduplication Across Simulations

**Scenario:** Prevent duplicate emails in same account

**Steps:**

1. **Simulation 1: Create with emails**
   ```
   john@example.com
   jane@example.com
   bob@example.com
   ```

2. **Record Emails to Global Index**
   ```bash
   redis-cli
   > SCARD "global:emails:user:<user_id>"
   # Should show 3 emails recorded
   ```

3. **Simulation 2: Attempt same emails**
   - Should reuse existing emails from cache
   - Validator should recognize john@example.com as already used
   - Either reuse the contact or skip creation

4. **Verify No Duplicate Contacts**
   ```bash
   # HubSpot UI:
   # Search for john@example.com
   # Should find ONLY ONE contact (not duplicated)
   ```

**Expected Result:**
- ✅ Duplicate email prevention works
- ✅ Cache prevents re-creation
- ✅ Global email index maintained

---

### ✅ Test 4: Rate Limiting + Property Validation Integration

**Scenario:** Property validation works even under rate limiting

**Steps:**

1. **Create Large Simulation**
   - 1000 records
   - Monitor rate limiting in logs:
     ```bash
     # Worker logs should show:
     # - rate_limit_hits: X
     # - rate_limit_scheduled_delay_ms: Y
     # - BUT: property normalization still succeeds
     ```

2. **Trigger 429 Response**
   - Monitor Redis cooldown:
     ```bash
     redis-cli
     > GET "hubspot_cooldown"
     # Should show future timestamp
     ```

3. **Verify No Property Errors During Backoff**
   - Even with cooldown active, no "duplicate picklist" errors
   - Validation is applied BEFORE rate limiting check
   - So validation errors can't be masked by 429s

**Expected Result:**
- ✅ Simulation completes despite rate limiting
- ✅ No property validation errors due to rate limits
- ✅ Cooldown properly prevents cascade failures

---

### ✅ Test 5: Error Recovery

**Scenario:** System recovers gracefully from transient errors

**Steps:**

1. **Stop Redis momentarily**
   ```bash
   redis-cli shutdown
   # Wait 30 seconds
   # Start Redis again
   redis-cli ping  # PONG
   ```

2. **Create Simulation During Interruption**
   - Some validation will fail (cache unavailable)
   - System should fall back to fetching metadata from HubSpot
   - Eventually recover when Redis is back

3. **Monitor Logs for Recovery**
   ```bash
   # Logs should show:
   # - Redis connection failed
   # - Falling back to metadata fetch
   # - Cache re-warmed after Redis recovery
   ```

**Expected Result:**
- ✅ Simulation eventually completes
- ✅ Cache auto-recovered after Redis restart
- ✅ No permanent data loss

---

## Performance Benchmarks

### ✅ Cache Hit Rate

**Measure:**
```bash
redis-cli
> HGET "sim:<simId>:metrics" "prop_cache_hits"
> HGET "sim:<simId>:metrics" "prop_cache_misses"

# Calculate: hits / (hits + misses)
```

**Target:** ≥ 70% cache hit rate  
**Acceptable:** ≥ 50%  
**Concerning:** < 30% (metadata not caching effectively)

### ✅ Fuzzy Matching Performance

**Measure:** Time to normalize 100 properties

**Target:** < 50ms  
**Acceptable:** < 100ms  
**Concerning:** > 200ms (Levenshtein distance too slow)

**If Too Slow:**
- Batch properties for parallel normalization
- Cache more aggressively
- Consider approximate matching for large datasets

### ✅ Property Validation Accuracy

**Measure:** False positive/negative rate

**False Positive:** Validator says "duplicate" but isn't → causes skipped creations  
**False Negative:** Validator says "OK" but is duplicate → causes HubSpot 400 error

**Target:**
- False Positives: 0
- False Negatives: < 1%

**How to Measure:**
1. Create simulation with 500 varied properties
2. Count HubSpot 400 errors (false negatives)
3. Count skipped creations (false positives)

---

## Monitoring & Alerting

### 🔴 Critical Alerts (Page On Call)

```javascript
// Alert if duplicate property errors occur
if (error.message.includes('duplicate') && error.status === 400) {
  alert("CRITICAL: Property validation failed - duplicate enum in HubSpot")
  // This means validator didn't catch it
}

// Alert if validator crashes
if (!propertyValidator) {
  alert("CRITICAL: Property validator not initialized")
}
```

### 🟡 Warning Alerts (Log Only)

```javascript
// Warn if cache is cold
if (cache_hit_rate < 0.3) {
  warn("Property cache hit rate low - consider increasing TTL")
}

// Warn if metadata stale
if (metadata_age > 24 * 60 * 60 * 1000) {
  warn("Property metadata hasn't been refreshed in 24 hours")
}
```

---

## Rollback Plan

**If Property Validator Causes Issues:**

1. **Immediately Disable Validator**
   ```bash
   # Set environment variable
   SIM_REAL_MODE=0
   # Restart API server
   # This reverts to simulated-only mode
   ```

2. **Investigate Error**
   - Check logs for error classification
   - Determine if validator logic is wrong or external service failed

3. **Revert Code**
   ```bash
   git revert <commit>
   npm run migrate:rollback  # If needed
   ```

4. **Restart Services**
   ```bash
   npm run start-server
   node server/worker.js
   ```

**Rollback Time Goal:** < 5 minutes

---

## Post-Deployment

### ✅ Day 1
- [ ] Monitor error logs for "duplicate picklist" errors
- [ ] Check Redis memory usage (cache shouldn't explode)
- [ ] Verify worker processes complete simulations
- [ ] Confirm no cascade failures

### ✅ Week 1
- [ ] Review cache hit rates
- [ ] Check for any validation accuracy issues
- [ ] Verify email/domain deduplication working
- [ ] Monitor performance metrics

### ✅ Month 1
- [ ] Review monthly trends
- [ ] Identify optimization opportunities
- [ ] Plan next improvements

---

## Success Criteria

**System is working correctly if:**

✅ No "duplicate picklist value" errors in HubSpot for 30+ days  
✅ Property cache hit rate ≥ 50%  
✅ All simulations complete without property validation errors  
✅ Worker can process 1000+ records per simulation  
✅ Email deduplication prevents duplicates  
✅ Rate limiting doesn't bypass property validation  

**System needs investigation if:**

🔴 Any HubSpot 400 error with "duplicate" message  
🔴 Cache hit rate < 20%  
🔴 Simulation failures with property validation errors  
🔴 Worker crashes during large simulations  
🔴 Email duplicates created across simulations  

---

## Questions?

If deployment verification fails, check:

1. **Property validation not working?**
   - Is SIM_REAL_MODE=1 set?
   - Is Redis connected?
   - Check orchestrator.js line ~60: propertyValidator initialization

2. **Cache not working?**
   - Is Redis accessible? `redis-cli ping`
   - Is REDIS_HOST correct?
   - Check Redis memory: `redis-cli INFO memory`

3. **Still getting duplicate errors?**
   - Check propertyValidator.test.js passes
   - Review fuzzy matching logic (Levenshtein distance)
   - Increase threshold if too strict

---

**Deployment Verified By:** ___________________  
**Date:** ___________________  
**Environment:** ___________________  
**Issues Found:** (or "None")
