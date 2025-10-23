/**
 * Add HubSpot integration columns to users table.
 * - hubspot_active_key_id: references hubspot_api_keys.id (logical FK, not enforced)
 * - hubspot_connected_at: timestamp (ms) when validation succeeded
 */

exports.up = async function(knex) {
  const hasUsers = await knex.schema.hasTable('users')
  if (!hasUsers) return

  const hasActiveKey = await knex.schema.hasColumn('users', 'hubspot_active_key_id')
  const hasConnectedAt = await knex.schema.hasColumn('users', 'hubspot_connected_at')

  if (!hasActiveKey || !hasConnectedAt) {
    await knex.schema.alterTable('users', table => {
      if (!hasActiveKey) table.string('hubspot_active_key_id', 64).index()
      if (!hasConnectedAt) table.bigInteger('hubspot_connected_at')
    })
  }
}

exports.down = async function(knex) {
  // Non-destructive by default; if rollback needed we can drop columns.
  // Uncomment to make destructive.
  // const hasUsers = await knex.schema.hasTable('users')
  // if (!hasUsers) return
  // const hasActiveKey = await knex.schema.hasColumn('users', 'hubspot_active_key_id')
  // const hasConnectedAt = await knex.schema.hasColumn('users', 'hubspot_connected_at')
  // if (hasActiveKey || hasConnectedAt) {
  //   await knex.schema.alterTable('users', table => {
  //     if (hasActiveKey) table.dropColumn('hubspot_active_key_id')
  //     if (hasConnectedAt) table.dropColumn('hubspot_connected_at')
  //   })
  // }
}
