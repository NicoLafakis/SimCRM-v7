#!/usr/bin/env node
/**
 * Database Simulation Cleanup Script
 *
 * Safely removes simulation records and related data from the database.
 * Does NOT touch HubSpot - use cleanup-hubspot.js for that.
 *
 * Usage:
 *   node scripts/cleanup-database.js --simulation-id=<id> [--dry-run] [--force]
 *   node scripts/cleanup-database.js --status=<status> [--dry-run] [--force]
 *   node scripts/cleanup-database.js --older-than=<days> [--dry-run] [--force]
 *
 * Options:
 *   --simulation-id=<id>    Clean specific simulation
 *   --status=<status>       Clean simulations by status (COMPLETED, FAILED, ABORTED)
 *   --older-than=<days>     Clean simulations older than N days
 *   --keep-recent=<N>       Keep N most recent simulations per user
 *   --dry-run               Show what would be deleted
 *   --force                 Skip confirmation prompts
 *   --user-id=<id>          Limit to specific user's simulations
 *   --help                  Show this help
 */

require('dotenv').config()
const readline = require('readline')
const knexConfig = require('../knexfile')
const Knex = require('knex')

const knex = Knex(knexConfig.development || knexConfig)

// Parse arguments
const args = process.argv.slice(2).reduce((acc, arg) => {
  if (arg.startsWith('--')) {
    const [key, value] = arg.slice(2).split('=')
    acc[key] = value === undefined ? true : value
  }
  return acc
}, {})

const DRY_RUN = args['dry-run'] || false
const FORCE = args.force || false
const SIMULATION_ID = args['simulation-id']
const STATUS = args.status
const OLDER_THAN_DAYS = args['older-than'] ? parseInt(args['older-than'], 10) : null
const KEEP_RECENT = args['keep-recent'] ? parseInt(args['keep-recent'], 10) : null
const USER_ID = args['user-id']
const HELP = args.help || false

// Colors
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
}

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`)
}

function showHelp() {
  log('\n=== Database Simulation Cleanup Script ===\n', 'bright')
  log('This script removes simulation records from the database.', 'cyan')
  log('It does NOT delete records from HubSpot - use cleanup-hubspot.js for that.\n')
  log('Usage:', 'cyan')
  log('  node scripts/cleanup-database.js --simulation-id=<id> [options]')
  log('  node scripts/cleanup-database.js --status=COMPLETED [options]')
  log('  node scripts/cleanup-database.js --older-than=<days> [options]\n')
  log('Options:', 'cyan')
  log('  --simulation-id=<id>    Clean specific simulation')
  log('  --status=<status>       Clean by status (COMPLETED, FAILED, ABORTED)')
  log('  --older-than=<days>     Clean simulations older than N days')
  log('  --keep-recent=<N>       Keep N most recent per user')
  log('  --dry-run               Preview what would be deleted')
  log('  --force                 Skip confirmation')
  log('  --user-id=<id>          Limit to specific user')
  log('  --help                  Show this help\n')
  log('Examples:', 'cyan')
  log('  # Preview cleanup of completed simulations older than 30 days')
  log('  node scripts/cleanup-database.js --status=COMPLETED --older-than=30 --dry-run\n')
  log('  # Delete specific simulation')
  log('  node scripts/cleanup-database.js --simulation-id=abc123\n')
  log('  # Keep only 10 most recent simulations per user, delete the rest')
  log('  node scripts/cleanup-database.js --keep-recent=10\n')
  log('Safety:', 'yellow')
  log('  - Always run with --dry-run first!')
  log('  - This only cleans database, not HubSpot records')
  log('  - Deletions are permanent\n')
}

async function askConfirmation(question) {
  if (FORCE) return true

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  })

  return new Promise((resolve) => {
    rl.question(`${colors.yellow}${question} (yes/no): ${colors.reset}`, (answer) => {
      rl.close()
      resolve(answer.toLowerCase() === 'yes')
    })
  })
}

async function getSimulationsToClean() {
  let query = knex('simulations')

  if (SIMULATION_ID) {
    query = query.where({ id: SIMULATION_ID })
  } else if (STATUS) {
    query = query.where({ status: STATUS.toUpperCase() })
  } else if (OLDER_THAN_DAYS) {
    const cutoffDate = Date.now() - (OLDER_THAN_DAYS * 24 * 60 * 60 * 1000)
    query = query.where('created_at', '<', cutoffDate)
  } else if (KEEP_RECENT) {
    // Get all simulations grouped by user
    const allSims = await knex('simulations')
      .select('*')
      .orderBy('created_at', 'desc')

    // Group by user and keep only old ones
    const userGroups = {}
    allSims.forEach(sim => {
      if (!userGroups[sim.user_id]) {
        userGroups[sim.user_id] = []
      }
      userGroups[sim.user_id].push(sim)
    })

    // Get simulations to delete (beyond KEEP_RECENT threshold)
    const toDelete = []
    Object.values(userGroups).forEach(sims => {
      if (sims.length > KEEP_RECENT) {
        toDelete.push(...sims.slice(KEEP_RECENT))
      }
    })

    return toDelete
  } else {
    log('Error: Must specify --simulation-id, --status, --older-than, or --keep-recent', 'red')
    process.exit(1)
  }

  if (USER_ID) {
    query = query.where({ user_id: USER_ID })
  }

  const simulations = await query.select('*')
  return simulations
}

async function cleanupSimulation(simulation) {
  log(`\n  Processing: ${simulation.id}`, 'cyan')
  log(`    Created: ${new Date(simulation.created_at).toLocaleDateString()}`, 'cyan')
  log(`    Status: ${simulation.status}`, 'cyan')
  log(`    Records: ${simulation.total_records}`, 'cyan')

  if (!DRY_RUN) {
    try {
      // Delete the simulation record
      await knex('simulations').where({ id: simulation.id }).del()
      log(`    ✓ Deleted`, 'green')
      return { deleted: true }
    } catch (e) {
      log(`    ✗ Error: ${e.message}`, 'red')
      return { deleted: false, error: e.message }
    }
  } else {
    log(`    [DRY RUN] Would delete`, 'yellow')
    return { deleted: false, dryRun: true }
  }
}

async function main() {
  if (HELP) {
    showHelp()
    process.exit(0)
  }

  log('\n╔════════════════════════════════════════════════════════════════╗', 'bright')
  log('║          Database Simulation Cleanup Script                   ║', 'bright')
  log('╚════════════════════════════════════════════════════════════════╝', 'bright')

  if (DRY_RUN) {
    log('\n🔍 DRY RUN MODE - No records will be deleted', 'yellow')
  } else {
    log('\n⚠️  LIVE MODE - Records will be permanently deleted!', 'red')
  }

  // Get simulations to clean
  const simulations = await getSimulationsToClean()

  if (simulations.length === 0) {
    log('\nNo simulations found matching criteria.', 'yellow')
    await knex.destroy()
    process.exit(0)
  }

  log(`\nFound ${simulations.length} simulation(s) to clean:`, 'cyan')

  // Show summary by status
  const statusCounts = simulations.reduce((acc, sim) => {
    acc[sim.status] = (acc[sim.status] || 0) + 1
    return acc
  }, {})

  Object.entries(statusCounts).forEach(([status, count]) => {
    log(`  ${status}: ${count}`)
  })

  // Show date range
  const oldest = new Date(Math.min(...simulations.map(s => s.created_at)))
  const newest = new Date(Math.max(...simulations.map(s => s.created_at)))
  log(`\nDate range: ${oldest.toLocaleDateString()} to ${newest.toLocaleDateString()}`, 'cyan')

  // Show total records that were processed
  const totalRecords = simulations.reduce((sum, sim) => sum + (sim.total_records || 0), 0)
  log(`Total records across all simulations: ${totalRecords.toLocaleString()}`, 'cyan')

  // Confirmation
  if (!DRY_RUN) {
    const confirmed = await askConfirmation(
      `\n⚠️  This will PERMANENTLY DELETE ${simulations.length} simulation(s) from the database. Continue?`
    )

    if (!confirmed) {
      log('\nCleanup cancelled.', 'yellow')
      await knex.destroy()
      process.exit(0)
    }
  }

  // Process each simulation
  const stats = {
    processed: 0,
    deleted: 0,
    errors: 0
  }

  for (const simulation of simulations) {
    const result = await cleanupSimulation(simulation)
    stats.processed++
    if (result.deleted) stats.deleted++
    if (result.error) stats.errors++
  }

  // Final summary
  log('\n╔════════════════════════════════════════════════════════════════╗', 'bright')
  log('║                    FINAL SUMMARY                               ║', 'bright')
  log('╚════════════════════════════════════════════════════════════════╝', 'bright')
  log(`\nSimulations processed: ${stats.processed}`, 'cyan')
  log(`Simulations deleted: ${stats.deleted}`, stats.deleted > 0 ? 'green' : 'cyan')
  if (stats.errors > 0) {
    log(`Errors: ${stats.errors}`, 'red')
  }

  if (DRY_RUN) {
    log('\n✅ Dry run complete. Run without --dry-run to actually delete records.', 'green')
  } else {
    log('\n✅ Database cleanup complete!', 'green')
    log('\n⚠️  Note: This only cleaned the database.', 'yellow')
    log('To delete records from HubSpot, run: node scripts/cleanup-hubspot.js', 'yellow')
  }

  await knex.destroy()
  process.exit(0)
}

// Error handling
process.on('unhandledRejection', async (error) => {
  log(`\n❌ Unhandled error: ${error.message}`, 'red')
  console.error(error)
  await knex.destroy()
  process.exit(1)
})

// Run
main().catch(async (error) => {
  log(`\n❌ Fatal error: ${error.message}`, 'red')
  console.error(error)
  await knex.destroy()
  process.exit(1)
})
