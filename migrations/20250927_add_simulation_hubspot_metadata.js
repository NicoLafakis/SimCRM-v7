/**
 * Adds HubSpot metadata columns to simulations for pipeline and owners selection.
 * Using TEXT columns to keep compatibility (JSON parse string client-side / worker-side).
 */

exports.up = async function(knex) {
  const has = await knex.schema.hasTable('simulations')
  if (!has) return
  const addIf = async (col, cb) => {
    const exists = await knex.schema.hasColumn('simulations', col)
    if (!exists) await knex.schema.alterTable('simulations', table => cb(table))
  }
  await addIf('hubspot_pipeline_id', t => t.string('hubspot_pipeline_id', 128).index())
  await addIf('hubspot_owner_ids', t => t.text('hubspot_owner_ids')) // JSON string array
}

exports.down = async function(knex) {
  // Non destructive (keep history) – no drop
}
