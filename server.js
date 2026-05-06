import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

import webhookRouter from './routes/webhook.js';
import liffRouter from './routes/liff.js';
import configRouter from './routes/config.js';
import familyPayRouter from './routes/familyPay.js';
import { pool } from './db.js';

const app = express();
const PORT = process.env.PORT || 3000;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('[server] starting, NODE_ENV =', process.env.NODE_ENV || 'development');

/**
 * 重要：
 * LINE webhook 的簽章驗證需要 raw body。
 * 所以 webhook router 必須在 express.json() 之前掛上。
 */
app.use('/webhook', webhookRouter);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/config', configRouter);
app.use('/api/family-pay', familyPayRouter);
app.use('/liff', liffRouter);
app.use(express.static(path.join(__dirname, 'public')));

// Health check（不需 auth）— 強制打一次 DB 看連線狀況
app.get('/api/health', async (req, res) => {
  try {
    const r = await pool.query('SELECT NOW() AS now, current_database() AS db');
    res.json({ ok: true, db: r.rows[0].db, now: r.rows[0].now });
  } catch (err) {
    console.error('[health] db query failed:', err.message, err.code || '');
    res.status(500).json({ ok: false, error: err.message, code: err.code || null });
  }
});

app.get('/', (req, res) => {
  res.send(`
    <h1>Family Pay PoC</h1>
    <p>Server is running.</p>
    <ul>
      <li><a href="/liff/hello">LIFF Hello Page</a></li>
      <li><a href="/api/config">API Config</a></li>
      <li><a href="/api/health">API Health (DB)</a></li>
    </ul>
  `);
});

app.listen(PORT, () => {
  console.log(`Family Pay PoC server is running on port ${PORT}`);
});
