require('dotenv').config();
const path = require('path');
const root = path.join(__dirname, '..');
module.exports = {
  port: Number(process.env.PORT) || 4000,
  dbFile: process.env.DB_FILE || path.join(root, 'data', 'timeless.db'),
  uploadDir: process.env.UPLOAD_DIR || path.join(root, 'uploads'),
  timezone: process.env.BUSINESS_TZ || 'Asia/Kolkata',
  whatsappNumber: (process.env.WHATSAPP_NUMBER || '').replace(/\D/g, ''),
  publicUrl: (process.env.PUBLIC_URL || '').replace(/\/$/, ''),
  isProd: process.env.NODE_ENV === 'production',
  sessionDays: 7,
  root,
};
