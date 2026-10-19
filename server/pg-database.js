const { pool } = require('./pg');

/**
 * Run one PostgreSQL query.
 * Use $1, $2, etc. for parameter placeholders.
 */
async function query(sql, params = []) {
  return pool.query(sql, params);
}

/**
 * Run related queries on one PostgreSQL connection.
 * All operations in the callback commit together or roll back together.
 */
async function withTransaction(callback) {
  const client = await pool.connect();
  let transactionStarted = false;

  try {
    await client.query('BEGIN');
    transactionStarted = true;

    const result = await callback(client);

    await client.query('COMMIT');
    transactionStarted = false;

    return result;
  } catch (error) {
    if (transactionStarted) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        console.error('PostgreSQL rollback failed:', rollbackError.message);
      }
    }

    throw error;
  } finally {
    client.release();
  }
}

/**
 * Write an audit entry using the supplied queryable connection.
 * Pass the transaction client when the audit must be atomic with a change.
 */
async function audit(queryable, userId, action, entity, entityId, detail) {
  await queryable.query(
    `INSERT INTO audit_logs
      (at, user_id, action, entity, entity_id, detail)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      new Date().toISOString(),
      userId ?? null,
      action,
      entity,
      String(entityId ?? ''),
      detail == null ? null : JSON.stringify(detail),
    ]
  );
}

/**
 * Reuse an existing transaction client when provided.
 * Otherwise, create and manage a new transaction.
 */
async function inTransaction(callback, existingClient = null) {
  if (existingClient) {
    return callback(existingClient);
  }

  return withTransaction(callback);
}

module.exports = {
  pool,
  query,
  withTransaction,
  inTransaction,
  audit,
};