// =================================================================
// db.js — PostgreSQL Pool（Supabase）
// =================================================================
import pg from 'pg';

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  console.error('[db] DATABASE_URL 未設定');
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // Supabase 需 SSL
  max: 5,                              // Free tier 連線數有限，留少一點
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});

// 啟動時做一次連線測試
pool.query('SELECT NOW() AS now')
  .then((r) => console.log('[db] connected:', r.rows[0].now))
  .catch((err) => console.error('[db] connection error:', err.message));

pool.on('error', (err) => {
  console.error('[db] pool error:', err.message);
});

export default pool;
