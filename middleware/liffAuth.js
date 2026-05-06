// =================================================================
// middleware/liffAuth.js
// 驗證 LIFF ID Token → 拿到 line userId → 查/註冊 family_user
// 用 Node 18+ 內建 fetch（不裝 node-fetch）
// =================================================================
import { pool } from '../db.js';

const LINE_VERIFY_URL = 'https://api.line.me/oauth2/v2.1/verify';

export async function liffAuth(req, res, next) {
  try {
    const auth = req.headers.authorization || '';
    const m = auth.match(/^Bearer\s+(.+)$/i);
    if (!m) {
      return res.status(401).json({ ok: false, error: 'missing bearer token' });
    }
    const idToken = m[1].trim();

    // 1. LINE 驗證
    const params = new URLSearchParams({
      id_token: idToken,
      client_id: process.env.LIFF_CHANNEL_ID || '',
    });
    const verifyRes = await fetch(LINE_VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    if (!verifyRes.ok) {
      const text = await verifyRes.text();
      console.error('[liffAuth] LINE verify failed:', verifyRes.status, text);
      return res.status(401).json({ ok: false, error: 'invalid id token' });
    }

    const profile = await verifyRes.json();
    const sub = profile.sub;        // LINE userId
    const name = profile.name || null;
    if (!sub) {
      return res.status(401).json({ ok: false, error: 'no sub in token' });
    }

    // 2. 查/註冊 family_user
    const existing = await pool.query(
      'SELECT user_id, group_id, role_type, line_user_id, user_name FROM family_user WHERE line_user_id = $1',
      [sub]
    );

    let user;
    if (existing.rows.length === 0) {
      // 第一次進入 → 自動註冊到種子家庭
      const seedGroupId = process.env.SEED_GROUP_ID;
      if (!seedGroupId) {
        console.error('[liffAuth] SEED_GROUP_ID 未設定');
        return res.status(500).json({ ok: false, error: 'server not configured' });
      }
      const inserted = await pool.query(
        `INSERT INTO family_user (group_id, line_user_id, user_name, role_type)
         VALUES ($1, $2, $3, 'CHILD')
         RETURNING user_id, group_id, role_type, line_user_id, user_name`,
        [seedGroupId, sub, name]
      );
      user = inserted.rows[0];
      console.log('[liffAuth] auto-registered:', sub, name);
    } else {
      user = existing.rows[0];
    }

    req.user = user;
    next();
  } catch (err) {
    console.error('[liffAuth] error:', err);
    res.status(500).json({ ok: false, error: 'auth middleware error' });
  }
}

export default liffAuth;
