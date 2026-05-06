// =================================================================
// db.js — PostgreSQL Pool（Supabase）
// =================================================================
import pg from 'pg';

const { Pool } = pg;

console.log('[db] init starting');
console.log('[db] DATABASE_URL =', process.env.DATABASE_URL ? 'SET (' + process.env.DATABASE_URL.length + ' chars)' : 'NOT SET');

if (!process.env.DATABASE_URL) {
  console.error('[db] DATABASE_URL 未設定 — DB 功能無法使用');
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 5,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});

// 啟動時做一次連線測試
pool.query('SELECT NOW() AS now')
  .then((r) => console.log('[db] connected:', r.rows[0].now))
  .catch((err) => console.error('[db] connection error:', err.message, err.code || ''));

pool.on('error', (err) => {
  console.error('[db] pool error:', err.message);
});

export default pool;
