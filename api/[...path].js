
const { createApp } = require('../server/app');
const { pool, testConnection } = require('../server/pg');

const app = createApp(pool);

let connectionCheck;

async function handler(req, res) {
  try {
    if (!connectionCheck) {
      connectionCheck = testConnection().catch((error) => {
        connectionCheck = null;
        throw error;
      });
    }

    await connectionCheck;
    return app(req, res);
  } catch (error) {
    console.error('API startup/database error:', error.message);
    return res.status(503).json({
      error: 'Service temporarily unavailable',
    });
  }
}

module.exports = handler;
