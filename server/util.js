const config = require('./config');

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

// Business-local calendar date (YYYY-MM-DD). One timezone everywhere = consistent report boundaries.
function localDate(d = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: config.timezone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(d);
}

const slugify = (s) => String(s).toLowerCase().normalize('NFKD')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

async function audit(db, userId, action, entity, entityId, detail) {
  return await db.prepare('INSERT INTO audit_logs(at,user_id,action,entity,entity_id,detail) VALUES (?,?,?,?,?,?)')
    .run(new Date().toISOString(), userId ?? null, action, entity, String(entityId ?? ''),
      detail ? JSON.stringify(detail) : null);
}

function monthRange(m) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(m || '')) throw new HttpError(400, 'month must be YYYY-MM');
  const [y, mo] = m.split('-').map(Number);
  const last = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  return { from: `${m}-01`, to: `${m}-${String(last).padStart(2, '0')}` };
}

function checkDate(s, name = 'date') {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s || '') || Number.isNaN(Date.parse(s))) {
    throw new HttpError(400, `${name} must be YYYY-MM-DD`);
  }
  return s;
}

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

module.exports = { HttpError, localDate, slugify, audit, monthRange, checkDate, round2 };
