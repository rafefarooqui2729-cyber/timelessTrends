
const { createApp } = require('../server/app');
const { pool, testConnection } = require('../server/pg');

const app = createApp(pool);
let connectionCheck;

module.exports = async function handler(req, res) {
  try {
    const route = req.query?.route;

    if (typeof route !== 'string' || !route) {
      return res.status(400).json({ error: 'Missing API route' });
    }

    if (!connectionCheck) {
      connectionCheck = testConnection().catch((error) => {
        connectionCheck = null;
        throw error;
      });
    }

    await connectionCheck;

    const url = new URL(req.url, 'http://localhost');
    url.searchParams.delete('route');
    req.url = `/api/${route}${url.search}`;

    return app(req, res);
  } catch (error) {
    console.error('API request failed:', error.message);
    return res.status(503).json({
      error: 'Service temporarily unavailable',
    });
  }
};
