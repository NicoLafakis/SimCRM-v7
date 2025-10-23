/**
 * Create simulations table to drive queued job orchestration.
 * ID style follows existing users table (string primary key; caller supplies UUID / ksuid / snowflake externally).
 */

exports.up = async function(knex) {
  const has = await knex.schema.hasTable('simulations')
  if (!has) {
    await knex.schema.createTable('simulations', table => {
      table.string('id', 64).primary()
      table.string('user_id', 64).index()
      table.string('status', 32).notNullable().defaultTo('QUEUED')
      table.bigInteger('start_time').notNullable()
      table.bigInteger('end_time').notNullable()
      table.string('scenario', 16).notNullable()
      table.string('distribution_method', 64).notNullable()
      table.integer('total_records').unsigned().notNullable()
      table.integer('records_processed').unsigned().notNullable().defaultTo(0)
      table.bigInteger('created_at').notNullable()
      table.bigInteger('updated_at').notNullable()
    })
  } else {
    // Idempotent ensure columns (future-proofing if partially created earlier)
    const cols = [
      ['status','string'],['start_time','bigInteger'],['end_time','bigInteger'],
      ['scenario','string'],['distribution_method','string'],['total_records','integer'],
      ['records_processed','integer'],['created_at','bigInteger'],['updated_at','bigInteger']
    ]
    for (const [col, type] of cols) {
      const exists = await knex.schema.hasColumn('simulations', col)
      if (!exists) {
        await knex.schema.alterTable('simulations', t => {
          if (type === 'string') t.string(col)
          else if (type === 'bigInteger') t.bigInteger(col)
          else if (type === 'integer') t.integer(col)
        })
      }
    }
  }
}

exports.down = async function(knex) {
  // Non-destructive by default; drop only if explicitly desired.
  // await knex.schema.dropTableIfExists('simulations')
}
