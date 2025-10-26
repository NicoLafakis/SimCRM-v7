# SimCRM Cleanup Guide

Complete guide for safely cleaning up simulation data from HubSpot and the database.

---

## 📋 Overview

SimCRM provides two cleanup scripts:

1. **`cleanup-hubspot.js`** - Deletes records from HubSpot (contacts, companies, deals)
2. **`cleanup-database.js`** - Deletes simulation records from database

**Important:** These scripts are independent - you can run one without the other.

---

## ⚠️ Safety First

### Golden Rules

1. **ALWAYS run with `--dry-run` first** to preview what will be deleted
2. **Deletions are permanent** - there is no undo
3. **HubSpot cleanup requires valid API tokens** for each user
4. **Test with a single simulation** before batch operations
5. **Backup your database** before large cleanups

### Recommended Workflow

```bash
# 1. Preview what would be deleted (safe)
node scripts/cleanup-hubspot.js --simulation-id=abc123 --dry-run

# 2. Review the output carefully

# 3. If everything looks correct, run without --dry-run
node scripts/cleanup-hubspot.js --simulation-id=abc123

# 4. Clean database records after HubSpot cleanup
node scripts/cleanup-database.js --simulation-id=abc123
```

---

## 🗑️ HubSpot Cleanup

### Script: `cleanup-hubspot.js`

Deletes contacts, companies, and deals from HubSpot that were created by simulations.

### Prerequisites

- Node.js and npm installed
- `.env` file configured with database credentials
- Valid HubSpot API tokens in database for users
- Simulations must have records in HubSpot (SIM_REAL_MODE was enabled)

### Usage Patterns

#### 1. Clean a Specific Simulation

```bash
# Preview
node scripts/cleanup-hubspot.js --simulation-id=abc123 --dry-run

# Actually delete
node scripts/cleanup-hubspot.js --simulation-id=abc123
```

#### 2. Clean All Simulations (Dangerous!)

```bash
# Preview ALL simulations
node scripts/cleanup-hubspot.js --all-simulations --dry-run

# Delete all (requires confirmation)
node scripts/cleanup-hubspot.js --all-simulations
```

#### 3. Clean Old Simulations

```bash
# Preview simulations older than 7 days
node scripts/cleanup-hubspot.js --older-than=7 --dry-run

# Delete them
node scripts/cleanup-hubspot.js --older-than=7
```

#### 4. Clean by User

```bash
# Clean all simulations for specific user
node scripts/cleanup-hubspot.js --user-id=user123 --dry-run
node scripts/cleanup-hubspot.js --user-id=user123
```

#### 5. Skip Confirmation Prompts

```bash
# Use --force to skip confirmation (be careful!)
node scripts/cleanup-hubspot.js --simulation-id=abc123 --force
```

### What Gets Deleted

For each simulation:
- ✅ **Contacts** with email like `sim_<simulation-id>_*@example.com`
- ✅ **Companies** with domain like `simcompany*.example.com`
- ✅ **Deals** in the simulation's configured pipeline

### How It Works

1. Queries database for simulations matching criteria
2. For each simulation:
   - Retrieves user's HubSpot API token
   - Searches for contacts by email pattern
   - Searches for companies by domain pattern
   - Searches for deals by pipeline ID
3. Deletes deals first, then contacts, then companies
4. Reports statistics and any errors

### Example Output

```
╔════════════════════════════════════════════════════════════════╗
║       HubSpot Simulation Cleanup Script                       ║
╚════════════════════════════════════════════════════════════════╝

🔍 DRY RUN MODE - No records will be deleted

Found 1 simulation(s) to process:
  - abc123 (b2b, 100 records, 1/15/2025)

======================================================================
Processing Simulation: abc123
Created: 2025-01-15T10:30:00.000Z
Scenario: B2B | Distribution: bell_curve
Total Records: 100 | Status: COMPLETED
======================================================================

🔍 Searching for contacts...
Found 100 contacts

🔍 Searching for companies...
Found 35 companies

🔍 Searching for deals...
Found 60 deals

📊 Summary:
  Contacts: 0/100 deleted
  Companies: 0/35 deleted
  Deals: 0/60 deleted

╔════════════════════════════════════════════════════════════════╗
║                    FINAL SUMMARY                               ║
╚════════════════════════════════════════════════════════════════╝

Simulations processed: 1
Total contacts deleted: 100
Total companies deleted: 35
Total deals deleted: 60

✅ Cleanup complete!
```

### Troubleshooting

| Error | Solution |
|-------|----------|
| "No HubSpot token found" | User needs to configure HubSpot API token in app |
| "Search not available" | Script falls back to alternative methods |
| "Rate limit exceeded" | Wait a few minutes and try again |
| "Permission denied" | Check HubSpot token has delete permissions |

---

## 💾 Database Cleanup

### Script: `cleanup-database.js`

Deletes simulation records from the local database.

**Note:** This does NOT delete records from HubSpot - use `cleanup-hubspot.js` for that.

### Usage Patterns

#### 1. Clean by Simulation ID

```bash
# Preview
node scripts/cleanup-database.js --simulation-id=abc123 --dry-run

# Delete
node scripts/cleanup-database.js --simulation-id=abc123
```

#### 2. Clean by Status

```bash
# Clean completed simulations
node scripts/cleanup-database.js --status=COMPLETED --dry-run
node scripts/cleanup-database.js --status=COMPLETED

# Clean failed simulations
node scripts/cleanup-database.js --status=FAILED --dry-run

# Clean aborted simulations
node scripts/cleanup-database.js --status=ABORTED --dry-run
```

#### 3. Clean Old Simulations

```bash
# Delete simulations older than 30 days
node scripts/cleanup-database.js --older-than=30 --dry-run
node scripts/cleanup-database.js --older-than=30
```

#### 4. Keep Only Recent Simulations

```bash
# Keep 10 most recent per user, delete the rest
node scripts/cleanup-database.js --keep-recent=10 --dry-run
node scripts/cleanup-database.js --keep-recent=10
```

### What Gets Deleted

- Simulation records from `simulations` table
- Associated metadata (config, status, timestamps)

**Does NOT delete:**
- User accounts
- HubSpot tokens
- HubSpot records (contacts, companies, deals)

### Example Output

```
╔════════════════════════════════════════════════════════════════╗
║          Database Simulation Cleanup Script                   ║
╚════════════════════════════════════════════════════════════════╝

🔍 DRY RUN MODE - No records will be deleted

Found 15 simulation(s) to clean:
  COMPLETED: 12
  FAILED: 2
  ABORTED: 1

Date range: 11/1/2024 to 1/15/2025
Total records across all simulations: 1,500

  Processing: abc123
    Created: 1/15/2025
    Status: COMPLETED
    Records: 100
    [DRY RUN] Would delete

╔════════════════════════════════════════════════════════════════╗
║                    FINAL SUMMARY                               ║
╚════════════════════════════════════════════════════════════════╝

Simulations processed: 15
Simulations deleted: 0

✅ Dry run complete. Run without --dry-run to actually delete records.

⚠️  Note: This only cleaned the database.
To delete records from HubSpot, run: node scripts/cleanup-hubspot.js
```

---

## 🎯 Common Cleanup Scenarios

### Scenario 1: Clean Up After Testing

You've run several test simulations and want to remove all traces.

```bash
# 1. Identify your test simulations
mysql -u simcrm_user -p simcrm -e "SELECT id, scenario, total_records, created_at FROM simulations WHERE user_id='your_user_id' ORDER BY created_at DESC LIMIT 10;"

# 2. Preview HubSpot cleanup
node scripts/cleanup-hubspot.js --user-id=your_user_id --dry-run

# 3. Delete from HubSpot
node scripts/cleanup-hubspot.js --user-id=your_user_id

# 4. Clean database
node scripts/cleanup-database.js --user-id=your_user_id
```

### Scenario 2: Regular Maintenance

Clean up completed simulations older than 30 days.

```bash
# 1. Preview what will be removed
node scripts/cleanup-database.js --status=COMPLETED --older-than=30 --dry-run

# 2. If HubSpot cleanup is also needed
node scripts/cleanup-hubspot.js --older-than=30 --dry-run

# 3. Execute cleanup
node scripts/cleanup-hubspot.js --older-than=30
node scripts/cleanup-database.js --status=COMPLETED --older-than=30
```

### Scenario 3: Remove a Single Failed Simulation

A simulation failed and you want to clean it up completely.

```bash
# Get the simulation ID from the UI or database
SIMULATION_ID="abc123"

# Preview
node scripts/cleanup-hubspot.js --simulation-id=$SIMULATION_ID --dry-run
node scripts/cleanup-database.js --simulation-id=$SIMULATION_ID --dry-run

# Execute
node scripts/cleanup-hubspot.js --simulation-id=$SIMULATION_ID
node scripts/cleanup-database.js --simulation-id=$SIMULATION_ID
```

### Scenario 4: Bulk Cleanup with Size Limit

You want to clean HubSpot but only process simulations with fewer records.

```bash
# 1. Query database for small simulations
mysql -u simcrm_user -p simcrm -e "SELECT id FROM simulations WHERE total_records < 50 AND status='COMPLETED';" > sim_ids.txt

# 2. Clean each one
while read sim_id; do
  echo "Cleaning $sim_id..."
  node scripts/cleanup-hubspot.js --simulation-id=$sim_id --force
  node scripts/cleanup-database.js --simulation-id=$sim_id --force
done < sim_ids.txt
```

---

## 🔐 Security Considerations

### Token Access

- Scripts require user's encrypted HubSpot tokens from database
- Tokens are decrypted using `TOKEN_ENC_SECRET` from `.env`
- If token is missing/invalid, that simulation is skipped

### Permissions Required

HubSpot API token needs:
- `crm.objects.contacts.write` (includes delete)
- `crm.objects.companies.write`
- `crm.objects.deals.write`

### Rate Limiting

- HubSpot has API rate limits (typically 100 req/10 sec)
- Scripts don't have built-in rate limiting
- For large cleanups, consider adding delays between operations

---

## 📊 Monitoring Cleanup

### Before Cleanup

```bash
# Count simulations by status
mysql -u simcrm_user -p simcrm -e "SELECT status, COUNT(*) FROM simulations GROUP BY status;"

# Total records across all simulations
mysql -u simcrm_user -p simcrm -e "SELECT SUM(total_records) FROM simulations;"

# Oldest simulation
mysql -u simcrm_user -p simcrm -e "SELECT id, created_at FROM simulations ORDER BY created_at ASC LIMIT 1;"
```

### After Cleanup

```bash
# Verify deletion
mysql -u simcrm_user -p simcrm -e "SELECT COUNT(*) FROM simulations WHERE id='abc123';"
# Should return 0

# Check HubSpot (via API or portal)
# Search for contacts with email: sim_abc123_*
```

---

## ⚙️ Automation

### Cron Job for Regular Cleanup

```bash
# Add to crontab for weekly cleanup of old completed simulations
0 2 * * 0 cd /home/user/SimCRM-v7 && node scripts/cleanup-database.js --status=COMPLETED --older-than=30 --force >> /var/log/simcrm-cleanup.log 2>&1
```

### Systemd Timer (Alternative)

Create `/etc/systemd/system/simcrm-cleanup.timer`:

```ini
[Unit]
Description=SimCRM Weekly Cleanup Timer

[Timer]
OnCalendar=Sun *-*-* 02:00:00
Persistent=true

[Install]
WantedBy=timers.target
```

Create `/etc/systemd/system/simcrm-cleanup.service`:

```ini
[Unit]
Description=SimCRM Cleanup Service

[Service]
Type=oneshot
User=simcrm
WorkingDirectory=/home/user/SimCRM-v7
ExecStart=/usr/bin/node scripts/cleanup-database.js --status=COMPLETED --older-than=30 --force
```

Enable:
```bash
sudo systemctl daemon-reload
sudo systemctl enable simcrm-cleanup.timer
sudo systemctl start simcrm-cleanup.timer
```

---

## 🐛 Troubleshooting

### "Cannot find module" Error

```bash
# Make sure you're in the project directory
cd /home/user/SimCRM-v7

# Install dependencies
npm install
```

### "Database connection failed"

```bash
# Check .env file
cat .env | grep DB_

# Test MySQL connection
mysql -h $DB_HOST -u $DB_USER -p$DB_PASS $DB_NAME -e "SELECT 1;"
```

### "No simulations found"

```bash
# Check if simulations exist
mysql -u simcrm_user -p simcrm -e "SELECT COUNT(*) FROM simulations;"

# Check your filter criteria
node scripts/cleanup-database.js --older-than=1 --dry-run
```

### HubSpot API Errors

```bash
# Check token is valid
# Login to HubSpot → Settings → Integrations → Private Apps → Check token

# Test API access
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://api.hubapi.com/crm/v3/objects/contacts?limit=1
```

---

## 📝 Best Practices

1. **Always dry-run first** - Never skip the `--dry-run` step
2. **Clean HubSpot before database** - Keeps records accessible if needed
3. **Backup before bulk operations** - Take a database snapshot
4. **Document what you delete** - Save dry-run output for records
5. **Start small** - Test with a single simulation first
6. **Monitor rate limits** - Don't clean hundreds of simulations at once
7. **Schedule regular cleanups** - Don't let old data accumulate
8. **Keep audit logs** - Save cleanup scripts output

---

## 🚨 Emergency: Undo Cleanup

Unfortunately, once records are deleted, they **cannot be recovered**.

### Prevention

```bash
# Before cleanup, export simulation data
mysql -u simcrm_user -p simcrm -e "SELECT * FROM simulations WHERE id='abc123' INTO OUTFILE '/tmp/sim_abc123_backup.csv';"
```

### HubSpot Contact Recovery

If you have HubSpot Professional or Enterprise:
- Check HubSpot Recycle Bin (contacts/companies deleted in last 30 days)
- Settings → Data Management → Deleted Records

### Database Recovery

If you have database backups:
```bash
# Restore from backup
mysql -u simcrm_user -p simcrm < backup_2025_01_15.sql
```

---

## 🎓 Advanced Usage

### Custom Cleanup Logic

You can modify the scripts for custom cleanup logic:

```javascript
// Example: Clean simulations with specific scenario
const simulations = await knex('simulations')
  .where({ scenario: 'b2b' })
  .where('total_records', '<', 50)
  .select('*')
```

### Parallel Cleanup

For very large cleanups:

```bash
# Get simulation IDs
mysql -u simcrm_user -p simcrm -e "SELECT id FROM simulations WHERE status='COMPLETED' LIMIT 100;" -N > sims.txt

# Clean in parallel (4 at a time)
cat sims.txt | xargs -P 4 -I {} node scripts/cleanup-hubspot.js --simulation-id={} --force
```

---

## ✅ Summary

| Task | Command |
|------|---------|
| Preview HubSpot cleanup | `node scripts/cleanup-hubspot.js --simulation-id=<id> --dry-run` |
| Delete from HubSpot | `node scripts/cleanup-hubspot.js --simulation-id=<id>` |
| Preview database cleanup | `node scripts/cleanup-database.js --simulation-id=<id> --dry-run` |
| Delete from database | `node scripts/cleanup-database.js --simulation-id=<id>` |
| Help | `node scripts/<script>.js --help` |

**Remember:**
- Always use `--dry-run` first
- HubSpot cleanup requires valid API tokens
- Database cleanup is separate from HubSpot
- Deletions are permanent - backup first!

---

For questions or issues, see:
- `docs/OPERATIONS.md` - Operational procedures
- `docs/PRODUCTION_SETUP.md` - Setup guide
- GitHub Issues - Report problems
