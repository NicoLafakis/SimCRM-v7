# SimCRM v7 - Production Setup Guide

## 🚀 Quick Start

This application is **NOW CONFIGURED FOR PRODUCTION MODE**.

### What This Means

- ✅ **`SIM_REAL_MODE=1`** is enabled
- ✅ **Actual HubSpot records** will be created
- ✅ **Real API calls** will be made to HubSpot
- ⚠️ **Rate limits** apply
- ⚠️ **Actual data** will be created in HubSpot

---

## 📋 Prerequisites

Before starting the application, ensure you have:

### 1. **Database (MySQL/MariaDB)**
```bash
# Verify MySQL is running
mysql -u root -p -e "SELECT VERSION();"

# Create database and user
mysql -u root -p <<EOF
CREATE DATABASE IF NOT EXISTS simcrm;
CREATE USER IF NOT EXISTS 'simcrm_user'@'localhost' IDENTIFIED BY 'your_secure_password';
GRANT ALL PRIVILEGES ON simcrm.* TO 'simcrm_user'@'localhost';
FLUSH PRIVILEGES;
EOF
```

### 2. **Redis**
```bash
# Verify Redis is running
redis-cli ping
# Expected: PONG

# If not installed:
# Ubuntu/Debian: sudo apt-get install redis-server
# macOS: brew install redis
# Windows: Use WSL or Docker
```

### 3. **Node.js & npm**
```bash
# Verify installation
node --version  # Should be v16+
npm --version   # Should be v8+
```

---

## 🔧 Configuration

### Step 1: Configure Environment Variables

Edit the `.env` file in the project root:

```bash
# Open for editing
nano .env
```

**Required Configuration:**

```bash
# PRODUCTION MODE - ENABLED
SIM_REAL_MODE=1

# DATABASE - Update these with your actual credentials
DB_HOST=localhost
DB_USER=simcrm_user
DB_PASS=your_actual_secure_password
DB_NAME=simcrm
DB_PORT=3306

# REDIS - Update if not using defaults
REDIS_HOST=localhost
REDIS_PORT=6379

# SECURITY - Generate a secure random string
TOKEN_ENC_SECRET=$(openssl rand -base64 32)
```

**Generate Secure Token:**
```bash
# Generate a secure 32-byte encryption key
openssl rand -base64 32

# Copy the output and paste it as TOKEN_ENC_SECRET value
```

### Step 2: Run Database Migrations

```bash
# Install dependencies if not already done
npm install

# Run migrations to create database tables
npm run migrate:latest

# Verify migrations
npm run migrate:list
```

**Expected output:**
```
Batch 1 - Run: 9 migrations
✓ 20250926_initial_users.js
✓ 20250926_add_required_user_columns.js
✓ 20250926_add_hubspot_columns.js
✓ 20250927_create_simulations.js
✓ 20250927_add_simulation_hubspot_metadata.js
✓ 20250928_add_dlq_replay_audit.js
✓ 20250928_add_simulation_config_snapshot.js
✓ 20250928_add_user_role.js
✓ 20250928_create_user_simulation_profiles.js
```

---

## 🚦 Starting the Application

### Option 1: Start All Services Individually (Recommended)

Open **4 separate terminal windows**:

**Terminal 1 - Backend API:**
```bash
cd /home/user/SimCRM-v7
npm run start-server
```
Expected: `Listening on port 4000`

**Terminal 2 - Worker (Job Processor):**
```bash
cd /home/user/SimCRM-v7
node server/worker.js
```
Expected: `Worker started, consuming from simulation-jobs-0`

**Terminal 3 - Frontend:**
```bash
cd /home/user/SimCRM-v7
npm run dev
```
Expected: `Local: http://localhost:5173/`

**Terminal 4 - Monitor (Optional):**
```bash
# Watch Redis activity
redis-cli monitor

# Or watch job queue
redis-cli LLEN bull:simulation-jobs-0:wait
```

### Option 2: Start Backend + Frontend Together

```bash
# Start both in parallel
npm run dev:all
```

Then in a **separate terminal**, start the worker:
```bash
node server/worker.js
```

---

## ✅ Verification Checklist

### 1. Services Running
```bash
# Check backend
curl http://localhost:4000/api/health
# Expected: {"ok":true, ...}

# Check Redis
redis-cli ping
# Expected: PONG

# Check database
mysql -u simcrm_user -p simcrm -e "SHOW TABLES;"
# Expected: List of tables including 'simulations', 'users'
```

### 2. Environment Configuration
```bash
# Verify production mode is enabled
grep SIM_REAL_MODE .env
# Expected: SIM_REAL_MODE=1
```

### 3. Test Simulation Creation

1. **Open browser:** http://localhost:5173
2. **Sign up** with a test account
3. **Complete Tetris verification**
4. **Select HubSpot** as SaaS platform
5. **Enter your HubSpot Private App Token**
   - Get from: HubSpot Settings → Integrations → Private Apps
   - Needs scopes: `crm.objects.contacts.write`, `crm.objects.companies.write`, etc.
6. **Configure simulation:**
   - Select theme
   - Select scenario (B2B or B2C)
   - Select distribution method
   - **Set timing:**
     - Total Records: Start with **10** (for testing)
     - Duration: **0 days, 1 hour**
   - **Select Pipeline** from dropdown
   - **Select Owners** (check 1-3 owners)
7. **View Summary** and **START SIMULATION**

### 4. Monitor Execution

**Watch Worker Logs:**
```bash
# In Terminal 2 (worker), you should see:
# [INFO] Job completed (contact creation)
# [INFO] Secondary activity scheduled
# [INFO] Segment expansion triggered
```

**Check Redis Metrics:**
```bash
# Get simulation ID from UI or database
redis-cli HGETALL sim:<simulation-id>:metrics

# Expected keys:
# contacts_created: 10
# contacts_created_real: 10
# notes_scheduled: ~15
# deals_created: ~6
```

**Check HubSpot:**
- Navigate to your HubSpot portal
- Go to Contacts → All contacts
- Search for: `sim_<simulation-id>`
- Should see 10 new contacts with:
  - Proper owner assignment
  - Associated companies
  - Deals in selected pipeline

---

## 🎯 Production Checklist

Before running simulations at scale:

- [ ] Database has adequate storage (simulations generate metrics)
- [ ] Redis has adequate memory (timestamps cached per simulation)
- [ ] HubSpot API token has all required scopes
- [ ] Rate limiting is configured (default: 100 req/min per endpoint)
- [ ] Monitoring is in place (check `/api/health` endpoint)
- [ ] Backup strategy for database (simulations table tracks all runs)
- [ ] `.env` file is **NOT** committed to git (check `.gitignore`)
- [ ] `TOKEN_ENC_SECRET` is secure and backed up
- [ ] Worker process has auto-restart (use PM2 or systemd)

---

## 📊 Monitoring

### Health Endpoint
```bash
curl http://localhost:4000/api/health
```

Returns:
```json
{
  "ok": true,
  "timestamp": 1698765432000,
  "uptime": 3600,
  "rateLimiter": {
    "buckets": { "contact": 50, "note": 40, "call": 25 },
    "cooldown": false,
    "circuitTripped": false
  }
}
```

### Metrics Endpoint
```bash
# Get metrics for a specific simulation
curl http://localhost:4000/api/simulations/<sim-id>/metrics
```

### Prometheus Endpoint (Optional)
```bash
curl http://localhost:4000/metrics
```

Exposes metrics in Prometheus format for Grafana dashboards.

---

## 🔒 Security Best Practices

1. **Never commit `.env`** - Already in `.gitignore`
2. **Rotate `TOKEN_ENC_SECRET`** periodically
3. **Use strong database passwords**
4. **Restrict Redis access** (bind to localhost in production)
5. **Use HTTPS** in production (configure reverse proxy)
6. **Limit HubSpot token scopes** to minimum required
7. **Monitor for suspicious activity** (check logs regularly)
8. **Backup database** regularly (includes simulation history)

---

## 🐛 Troubleshooting

### Problem: "Simulation not found"
**Solution:** Check database connection in `.env`
```bash
mysql -u simcrm_user -p simcrm -e "SELECT * FROM simulations LIMIT 1;"
```

### Problem: "Redis connection failed"
**Solution:** Verify Redis is running
```bash
redis-cli ping
sudo systemctl status redis  # Linux
brew services list | grep redis  # macOS
```

### Problem: "Worker not processing jobs"
**Solution:** Check worker logs for errors
```bash
# Restart worker with verbose logging
NODE_ENV=development node server/worker.js
```

### Problem: "No records in HubSpot"
**Solution:** Verify `SIM_REAL_MODE=1`
```bash
grep SIM_REAL_MODE .env
# Must be exactly: SIM_REAL_MODE=1

# Restart services after changing
```

### Problem: "Rate limit errors"
**Solution:** Check HubSpot API limits
- HubSpot has rate limits per token
- Circuit breaker will pause requests if limits hit
- Check `/api/health` for cooldown status

---

## 📈 Scaling

### Horizontal Worker Scaling

Run multiple workers for higher throughput:

```bash
# Terminal 1: Worker 0
SIMCRM_QUEUE_SHARDS=1 node server/worker.js

# Terminal 2: Worker 1 (future)
# SIMCRM_SHARD_INDEX=1 node server/worker.js
```

### Database Optimization

```sql
-- Add indexes for common queries
CREATE INDEX idx_user_id ON simulations(user_id);
CREATE INDEX idx_status ON simulations(status);
CREATE INDEX idx_created_at ON simulations(created_at);
```

### Redis Memory Management

```bash
# Check memory usage
redis-cli INFO memory

# Set max memory (example: 2GB)
redis-cli CONFIG SET maxmemory 2gb
redis-cli CONFIG SET maxmemory-policy allkeys-lru
```

---

## 📞 Support

### Logs

**Backend Logs:**
```bash
# Backend logs to stdout
npm run start-server 2>&1 | tee logs/backend.log
```

**Worker Logs:**
```bash
# Worker logs to stdout
node server/worker.js 2>&1 | tee logs/worker.log
```

### Documentation

- **Job Queue Architecture:** `docs/job-queue-architecture.md`
- **Rate Limiting:** `docs/ratelimits.md`
- **HubSpot Integration:** `docs/integrations-hubspot-tokens.md`
- **Operations Guide:** `docs/OPERATIONS.md`

---

## 🎉 You're Ready!

The application is now configured for **PRODUCTION MODE** with:
- ✅ Real HubSpot record creation
- ✅ Proper pipeline and owner assignment
- ✅ Multi-day simulation support
- ✅ Rate limiting and circuit breakers
- ✅ Full observability

Start with small simulations (10-100 records) to verify everything works, then scale up as needed!
