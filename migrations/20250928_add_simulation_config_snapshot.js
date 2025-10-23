/**
 * Adds configuration snapshot + override/version columns to simulations.
 * Non-destructive; only adds if missing.
 */

exports.up = async function(knex) {
  const has = await knex.schema.hasTable('simulations')
  if (!has) return
  const addIf = async (col, cb) => {
    const exists = await knex.schema.hasColumn('simulations', col)
    if (!exists) await knex.schema.alterTable('simulations', t => cb(t))
  }
  await addIf('config_json', t => t.text('config_json'))
  await addIf('overrides_hash', t => t.string('overrides_hash', 64).index())
  await addIf('override_version', t => t.integer('override_version').unsigned().defaultTo(0))
  await addIf('finished_at', t => t.bigInteger('finished_at'))
}

exports.down = async function() { /* keep columns */ }
