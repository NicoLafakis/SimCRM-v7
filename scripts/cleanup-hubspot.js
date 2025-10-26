#!/usr/bin/env node
/**
 * HubSpot Simulation Cleanup Script
 *
 * Safely removes contacts, companies, and deals created by SimCRM simulations.
 *
 * Usage:
 *   node scripts/cleanup-hubspot.js --simulation-id=<id> [--dry-run] [--force]
 *   node scripts/cleanup-hubspot.js --all-simulations [--dry-run] [--force]
 *   node scripts/cleanup-hubspot.js --older-than=<days> [--dry-run] [--force]
 *
 * Options:
 *   --simulation-id=<id>    Clean records from specific simulation
 *   --all-simulations       Clean ALL simulation records (use with caution)
 *   --older-than=<days>     Clean simulations older than N days
 *   --dry-run               Show what would be deleted without deleting
 *   --force                 Skip confirmation prompts
 *   --user-id=<id>          Limit cleanup to specific user's simulations
 *   --help                  Show this help message
 */

require('dotenv').config()
const readline = require('readline')
const { createClient } = require('../server/hubspotClient')
const { createTools } = require('../server/toolsFactory')
const knexConfig = require('../knexfile')
const Knex = require('knex')

const knex = Knex(knexConfig.development || knexConfig)

// Parse command line arguments
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
const ALL_SIMULATIONS = args['all-simulations'] || false
const OLDER_THAN_DAYS = args['older-than'] ? parseInt(args['older-than'], 10) : null
const USER_ID = args['user-id']
const HELP = args.help || false

// Color codes for terminal output
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
  log('\n=== HubSpot Simulation Cleanup Script ===\n', 'bright')
  log('This script removes contacts, companies, and deals created by SimCRM simulations.\n')
  log('Usage:', 'cyan')
  log('  node scripts/cleanup-hubspot.js --simulation-id=<id> [options]')
  log('  node scripts/cleanup-hubspot.js --all-simulations [options]')
  log('  node scripts/cleanup-hubspot.js --older-than=<days> [options]\n')
  log('Options:', 'cyan')
  log('  --simulation-id=<id>    Clean records from specific simulation')
  log('  --all-simulations       Clean ALL simulation records (dangerous!)')
  log('  --older-than=<days>     Clean simulations older than N days')
  log('  --dry-run               Preview what would be deleted (safe)')
  log('  --force                 Skip confirmation prompts')
  log('  --user-id=<id>          Limit to specific user\'s simulations')
  log('  --help                  Show this help\n')
  log('Examples:', 'cyan')
  log('  # Preview what would be deleted for simulation abc123')
  log('  node scripts/cleanup-hubspot.js --simulation-id=abc123 --dry-run\n')
  log('  # Actually delete records for simulation abc123')
  log('  node scripts/cleanup-hubspot.js --simulation-id=abc123\n')
  log('  # Delete simulations older than 7 days')
  log('  node scripts/cleanup-hubspot.js --older-than=7\n')
  log('Safety:', 'yellow')
  log('  - Always run with --dry-run first!')
  log('  - Deletions are permanent and cannot be undone')
  log('  - Use --force carefully in production\n')
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
  } else if (OLDER_THAN_DAYS) {
    const cutoffDate = Date.now() - (OLDER_THAN_DAYS * 24 * 60 * 60 * 1000)
    query = query.where('created_at', '<', cutoffDate)
  } else if (ALL_SIMULATIONS) {
    // No filter - all simulations
  } else {
    log('Error: Must specify --simulation-id, --older-than, or --all-simulations', 'red')
    process.exit(1)
  }

  if (USER_ID) {
    query = query.where({ user_id: USER_ID })
  }

  const simulations = await query.select('*')
  return simulations
}

async function getUserHubSpotToken(userId) {
  const { getDecryptedToken } = require('../server/hubspotKeyStore')

  try {
    const userRow = await knex('users').where({ id: userId }).first()
    if (!userRow?.hubspot_active_key_id) {
      return null
    }

    const token = await getDecryptedToken({ userId, id: userRow.hubspot_active_key_id })
    return token
  } catch (e) {
    log(`Warning: Could not retrieve token for user ${userId}: ${e.message}`, 'yellow')
    return null
  }
}

async function findContactsBySimulation(tools, simulationId) {
  try {
    // Search for contacts with email containing simulation ID
    const searchRequest = {
      filterGroups: [{
        filters: [{
          propertyName: 'email',
          operator: 'CONTAINS_TOKEN',
          value: `sim_${simulationId}`
        }]
      }],
      properties: ['email', 'firstname', 'lastname', 'hubspot_owner_id'],
      limit: 100
    }

    const response = await tools.contacts.search(searchRequest)
    return response.results || []
  } catch (e) {
    if (e.response?.status === 404 || e.message.includes('search')) {
      log(`Note: Contact search not available, using alternative method`, 'yellow')
      return []
    }
    throw e
  }
}

async function findCompaniesBySimulation(tools, simulationId) {
  try {
    // Search for companies with domain containing simulation ID
    const searchRequest = {
      filterGroups: [{
        filters: [{
          propertyName: 'domain',
          operator: 'CONTAINS_TOKEN',
          value: `simcompany`
        }]
      }],
      properties: ['name', 'domain', 'hubspot_owner_id'],
      limit: 100
    }

    const response = await tools.companies.search(searchRequest)
    return response.results || []
  } catch (e) {
    if (e.response?.status === 404 || e.message.includes('search')) {
      log(`Note: Company search not available`, 'yellow')
      return []
    }
    throw e
  }
}

async function findDealsByPipeline(tools, pipelineId) {
  try {
    if (!pipelineId) return []

    const searchRequest = {
      filterGroups: [{
        filters: [{
          propertyName: 'pipeline',
          operator: 'EQ',
          value: pipelineId
        }]
      }],
      properties: ['dealname', 'pipeline', 'dealstage', 'hubspot_owner_id'],
      limit: 100
    }

    const response = await tools.deals.search(searchRequest)
    return response.results || []
  } catch (e) {
    if (e.response?.status === 404 || e.message.includes('search')) {
      log(`Note: Deal search not available`, 'yellow')
      return []
    }
    throw e
  }
}

async function cleanupSimulation(simulation) {
  log(`\n${'='.repeat(70)}`, 'cyan')
  log(`Processing Simulation: ${simulation.id}`, 'bright')
  log(`Created: ${new Date(simulation.created_at).toISOString()}`, 'cyan')
  log(`Scenario: ${simulation.scenario.toUpperCase()} | Distribution: ${simulation.distribution_method}`, 'cyan')
  log(`Total Records: ${simulation.total_records} | Status: ${simulation.status}`, 'cyan')
  log(`${'='.repeat(70)}`, 'cyan')

  // Get user's HubSpot token
  const token = await getUserHubSpotToken(simulation.user_id)

  if (!token) {
    log(`Skipping - No HubSpot token found for user ${simulation.user_id}`, 'yellow')
    return { skipped: true, reason: 'no_token' }
  }

  // Create HubSpot tools with user's token
  const client = createClient({})
  client.setToken(token)
  const tools = createTools(client)

  const stats = {
    contactsFound: 0,
    contactsDeleted: 0,
    companiesFound: 0,
    companiesDeleted: 0,
    dealsFound: 0,
    dealsDeleted: 0,
    errors: 0
  }

  try {
    // Find contacts
    log('\n🔍 Searching for contacts...', 'blue')
    const contacts = await findContactsBySimulation(tools, simulation.id)
    stats.contactsFound = contacts.length
    log(`Found ${contacts.length} contacts`, contacts.length > 0 ? 'green' : 'cyan')

    // Find companies
    log('\n🔍 Searching for companies...', 'blue')
    const companies = await findCompaniesBySimulation(tools, simulation.id)
    stats.companiesFound = companies.length
    log(`Found ${companies.length} companies`, companies.length > 0 ? 'green' : 'cyan')

    // Find deals
    if (simulation.hubspot_pipeline_id) {
      log('\n🔍 Searching for deals...', 'blue')
      const deals = await findDealsByPipeline(tools, simulation.hubspot_pipeline_id)
      stats.dealsFound = deals.length
      log(`Found ${deals.length} deals`, deals.length > 0 ? 'green' : 'cyan')

      // Delete deals
      if (deals.length > 0 && !DRY_RUN) {
        log('\n🗑️  Deleting deals...', 'yellow')
        for (const deal of deals) {
          try {
            await tools.deals.delete(deal.id)
            stats.dealsDeleted++
            log(`  ✓ Deleted deal: ${deal.properties.dealname} (${deal.id})`, 'green')
          } catch (e) {
            stats.errors++
            log(`  ✗ Failed to delete deal ${deal.id}: ${e.message}`, 'red')
          }
        }
      }
    }

    // Delete contacts
    if (contacts.length > 0 && !DRY_RUN) {
      log('\n🗑️  Deleting contacts...', 'yellow')
      for (const contact of contacts) {
        try {
          await tools.contacts.delete(contact.id)
          stats.contactsDeleted++
          log(`  ✓ Deleted contact: ${contact.properties.email} (${contact.id})`, 'green')
        } catch (e) {
          stats.errors++
          log(`  ✗ Failed to delete contact ${contact.id}: ${e.message}`, 'red')
        }
      }
    }

    // Delete companies
    if (companies.length > 0 && !DRY_RUN) {
      log('\n🗑️  Deleting companies...', 'yellow')
      for (const company of companies) {
        try {
          await tools.companies.delete(company.id)
          stats.companiesDeleted++
          log(`  ✓ Deleted company: ${company.properties.name} (${company.id})`, 'green')
        } catch (e) {
          stats.errors++
          log(`  ✗ Failed to delete company ${company.id}: ${e.message}`, 'red')
        }
      }
    }

  } catch (e) {
    log(`\n❌ Error processing simulation: ${e.message}`, 'red')
    stats.errors++
  }

  // Summary
  log('\n📊 Summary:', 'bright')
  log(`  Contacts: ${stats.contactsDeleted}/${stats.contactsFound} deleted`, stats.contactsDeleted > 0 ? 'green' : 'cyan')
  log(`  Companies: ${stats.companiesDeleted}/${stats.companiesFound} deleted`, stats.companiesDeleted > 0 ? 'green' : 'cyan')
  log(`  Deals: ${stats.dealsDeleted}/${stats.dealsFound} deleted`, stats.dealsDeleted > 0 ? 'green' : 'cyan')
  if (stats.errors > 0) {
    log(`  Errors: ${stats.errors}`, 'red')
  }

  return stats
}

async function main() {
  if (HELP) {
    showHelp()
    process.exit(0)
  }

  log('\n╔════════════════════════════════════════════════════════════════╗', 'bright')
  log('║       HubSpot Simulation Cleanup Script                       ║', 'bright')
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

  log(`\nFound ${simulations.length} simulation(s) to process:`, 'cyan')
  simulations.forEach(sim => {
    log(`  - ${sim.id} (${sim.scenario}, ${sim.total_records} records, ${new Date(sim.created_at).toLocaleDateString()})`)
  })

  // Confirmation
  if (!DRY_RUN) {
    const confirmed = await askConfirmation(
      `\n⚠️  This will PERMANENTLY DELETE records from HubSpot. Continue?`
    )

    if (!confirmed) {
      log('\nCleanup cancelled.', 'yellow')
      await knex.destroy()
      process.exit(0)
    }
  }

  // Process each simulation
  const aggregateStats = {
    processed: 0,
    skipped: 0,
    contactsDeleted: 0,
    companiesDeleted: 0,
    dealsDeleted: 0,
    totalErrors: 0
  }

  for (const simulation of simulations) {
    const result = await cleanupSimulation(simulation)

    if (result.skipped) {
      aggregateStats.skipped++
    } else {
      aggregateStats.processed++
      aggregateStats.contactsDeleted += result.contactsDeleted || 0
      aggregateStats.companiesDeleted += result.companiesDeleted || 0
      aggregateStats.dealsDeleted += result.dealsDeleted || 0
      aggregateStats.totalErrors += result.errors || 0
    }
  }

  // Final summary
  log('\n╔════════════════════════════════════════════════════════════════╗', 'bright')
  log('║                    FINAL SUMMARY                               ║', 'bright')
  log('╚════════════════════════════════════════════════════════════════╝', 'bright')
  log(`\nSimulations processed: ${aggregateStats.processed}`, 'cyan')
  log(`Simulations skipped: ${aggregateStats.skipped}`, 'cyan')
  log(`Total contacts deleted: ${aggregateStats.contactsDeleted}`, 'green')
  log(`Total companies deleted: ${aggregateStats.companiesDeleted}`, 'green')
  log(`Total deals deleted: ${aggregateStats.dealsDeleted}`, 'green')
  if (aggregateStats.totalErrors > 0) {
    log(`Total errors: ${aggregateStats.totalErrors}`, 'red')
  }

  if (DRY_RUN) {
    log('\n✅ Dry run complete. Run without --dry-run to actually delete records.', 'green')
  } else {
    log('\n✅ Cleanup complete!', 'green')
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
