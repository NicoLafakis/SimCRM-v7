/**
 * user_simulation_profiles: Stores last chosen simulation UI selections per user.
 */

exports.up = async function(knex) {
  const has = await knex.schema.hasTable('user_simulation_profiles')
  if (!has) {
    await knex.schema.createTable('user_simulation_profiles', table => {
      table.string('user_id',64).primary()
      table.string('scenario_id',32)
      table.string('distribution_id',64)
      table.string('theme_id',64)
      table.string('hubspot_key_id',64)
      table.string('overrides_hash',64)
      table.integer('override_version').unsigned().defaultTo(0)
      table.text('last_config_json')
      table.bigInteger('updated_at').notNullable()
    })
  }
}

exports.down = async function() { /* retain table */ }
