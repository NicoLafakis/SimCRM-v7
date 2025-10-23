/**
 * DLQ Replay Audit Table
 * Records administrative replay (or dry-run preview) actions for dead-letter jobs.
 */

exports.up = async function(knex) {
  const has = await knex.schema.hasTable('dlq_replay_audit')
  if (!has) {
    await knex.schema.createTable('dlq_replay_audit', table => {
      table.string('id', 64).primary() // caller supplies uuid
      table.string('user_id', 64).index()
      table.string('simulation_id', 64).index()
      table.boolean('dry_run').notNullable().defaultTo(true)
      table.integer('total_candidates').notNullable().defaultTo(0)
      table.integer('selected_count').notNullable().defaultTo(0)
      table.integer('replayed_count').notNullable().defaultTo(0)
      table.text('filters_json') // original payload (sanitized)
      table.bigInteger('created_at').notNullable()
    })
  }
}

exports.down = async function(knex) {
  // Non-destructive by default; comment-in to drop if needed.
  // await knex.schema.dropTableIfExists('dlq_replay_audit')
}
