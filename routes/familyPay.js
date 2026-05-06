// =================================================================
// routes/familyPay.js — Family Pay 6 個 API
// 所有 endpoint 經過 liffAuth → req.user = { user_id, group_id, ... }
// 所有 query 都用 group_id 過濾，避免跨家庭操作
// =================================================================
import express from 'express';
import { pool } from '../db.js';
import { liffAuth } from '../middleware/liffAuth.js';

const router = express.Router();

// 全域 middleware
router.use(liffAuth);

const CATEGORY_LABELS = {
  BREAKFAST: '早餐',
  DINNER: '正餐',
  DRINK: '飲料',
  DAILY: '日用品',
  OTHER: '其他',
};

const PAY_METHOD_LABELS = {
  LINE_PAY: 'LINE Pay',
  CASH: '現金',
  CREDIT_CARD: '信用卡',
  JKO_PAY: '街口',
  OTHER: '其他',
};

const MONTH_REGEX = /^\d{4}-\d{2}$/;

// -----------------------------------------------------------------
// 1. POST /records — 新增代墊
// body: { amount, category, pay_method, note, record_date }
// -----------------------------------------------------------------
router.post('/records', async (req, res) => {
  try {
    const { amount, category, pay_method, note, record_date } = req.body || {};
    const { user_id, group_id } = req.user;

    if (amount == null || !category) {
      return res.status(400).json({ ok: false, error: 'amount/category 必填' });
    }

    // record_date 沒傳 → 預設今天（YYYY-MM-DD）
    const finalDate = record_date || new Date().toISOString().slice(0, 10);

    const result = await pool.query(
      `INSERT INTO family_pay_record
         (group_id, paid_by_user_id, amount, category, pay_method, record_date, note, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'UNSETTLED')
       RETURNING *`,
      [group_id, user_id, amount, category, pay_method || null, finalDate, note || null]
    );

    res.json({ ok: true, data: result.rows[0] });
  } catch (err) {
    console.error('[POST /records] error:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// -----------------------------------------------------------------
// 2. GET /records?month=YYYY-MM — 查當月明細
// -----------------------------------------------------------------
router.get('/records', async (req, res) => {
  try {
    const { month } = req.query;
    const { group_id } = req.user;

    if (!month || !MONTH_REGEX.test(month)) {
      return res.status(400).json({ ok: false, error: 'month 格式需為 YYYY-MM' });
    }

    const result = await pool.query(
      `SELECT r.*, u.user_name AS paid_by_name
         FROM family_pay_record r
         JOIN family_user u ON u.user_id = r.paid_by_user_id
        WHERE r.group_id = $1
          AND to_char(r.record_date, 'YYYY-MM') = $2
        ORDER BY r.record_date DESC, r.created_at DESC`,
      [group_id, month]
    );

    res.json({ ok: true, data: result.rows });
  } catch (err) {
    console.error('[GET /records] error:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// -----------------------------------------------------------------
// 3. GET /monthly-summary?month=YYYY-MM — 本月總額 + raw data
// -----------------------------------------------------------------
router.get('/monthly-summary', async (req, res) => {
  try {
    const { month } = req.query;
    const { group_id } = req.user;

    if (!month || !MONTH_REGEX.test(month)) {
      return res.status(400).json({ ok: false, error: 'month 格式需為 YYYY-MM' });
    }

    const totalQ = pool.query(
      `SELECT COALESCE(SUM(amount), 0) AS total
         FROM family_pay_record
        WHERE group_id = $1
          AND to_char(record_date, 'YYYY-MM') = $2
          AND status <> 'PERSONAL'`,
      [group_id, month]
    );

    const byCategoryQ = pool.query(
      `SELECT category, COALESCE(SUM(amount), 0) AS amount, COUNT(*) AS count
         FROM family_pay_record
        WHERE group_id = $1
          AND to_char(record_date, 'YYYY-MM') = $2
          AND status <> 'PERSONAL'
        GROUP BY category
        ORDER BY amount DESC`,
      [group_id, month]
    );

    const byMethodQ = pool.query(
      `SELECT COALESCE(pay_method, 'OTHER') AS pay_method,
              COALESCE(SUM(amount), 0) AS amount,
              COUNT(*) AS count
         FROM family_pay_record
        WHERE group_id = $1
          AND to_char(record_date, 'YYYY-MM') = $2
          AND status <> 'PERSONAL'
        GROUP BY pay_method
        ORDER BY amount DESC`,
      [group_id, month]
    );

    const [total, byCategory, byMethod] = await Promise.all([totalQ, byCategoryQ, byMethodQ]);

    res.json({
      ok: true,
      data: {
        month,
        total_amount: Number(total.rows[0].total),
        by_category: byCategory.rows.map((r) => ({
          category: r.category,
          label: CATEGORY_LABELS[r.category] || r.category,
          amount: Number(r.amount),
          count: Number(r.count),
        })),
        by_method: byMethod.rows.map((r) => ({
          pay_method: r.pay_method,
          label: PAY_METHOD_LABELS[r.pay_method] || r.pay_method,
          amount: Number(r.amount),
          count: Number(r.count),
        })),
      },
    });
  } catch (err) {
    console.error('[GET /monthly-summary] error:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// -----------------------------------------------------------------
// 4. POST /claim-message — 產生請款訊息文字 + 寫入 monthly_claim
// body: { month: 'YYYY-MM' }
// -----------------------------------------------------------------
router.post('/claim-message', async (req, res) => {
  const client = await pool.connect();
  try {
    const { month } = req.body || {};
    const { group_id } = req.user;

    if (!month || !MONTH_REGEX.test(month)) {
      return res.status(400).json({ ok: false, error: 'month 格式需為 YYYY-MM' });
    }

    await client.query('BEGIN');

    // 抓本月所有「未結算」的紀錄（不含 PERSONAL）
    const recordsRes = await client.query(
      `SELECT record_id, amount, category, pay_method, record_date, note
         FROM family_pay_record
        WHERE group_id = $1
          AND to_char(record_date, 'YYYY-MM') = $2
          AND status = 'UNSETTLED'
        ORDER BY record_date ASC`,
      [group_id, month]
    );

    const records = recordsRes.rows;
    if (records.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ ok: false, error: '本月尚無未結算紀錄' });
    }

    const total = records.reduce((s, r) => s + Number(r.amount), 0);

    // 按分類彙總
    const byCat = {};
    for (const r of records) {
      const key = r.category;
      if (!byCat[key]) byCat[key] = 0;
      byCat[key] += Number(r.amount);
    }

    // 建立 monthly_claim（同月已存在則 reuse）
    const claimRes = await client.query(
      `INSERT INTO monthly_claim (group_id, claim_month, total_amount, status, sent_at)
       VALUES ($1, $2, $3, 'SENT', NOW())
       ON CONFLICT (group_id, claim_month)
       DO UPDATE SET total_amount = EXCLUDED.total_amount,
                     status       = 'SENT',
                     sent_at      = NOW()
       RETURNING *`,
      [group_id, month, total]
    );
    const claim = claimRes.rows[0];

    // 把 records 標為 CLAIMED + 關聯 claim_id
    await client.query(
      `UPDATE family_pay_record
          SET status = 'CLAIMED',
              claim_id = $1,
              updated_at = NOW()
        WHERE group_id = $2
          AND to_char(record_date, 'YYYY-MM') = $3
          AND status = 'UNSETTLED'`,
      [claim.claim_id, group_id, month]
    );

    await client.query('COMMIT');

    // 組訊息
    const lines = [
      `📊 ${month} 家庭代墊請款`,
      `總計：NT$ ${total.toLocaleString()}`,
      '',
      '— 分類明細 —',
    ];
    Object.entries(byCat)
      .sort((a, b) => b[1] - a[1])
      .forEach(([cat, amt]) => {
        const label = CATEGORY_LABELS[cat] || cat;
        lines.push(`${label}：NT$ ${amt.toLocaleString()}`);
      });
    lines.push('', `共 ${records.length} 筆，請查收 🙏`);

    res.json({
      ok: true,
      data: {
        claim_id: claim.claim_id,
        month,
        total_amount: total,
        record_count: records.length,
        message: lines.join('\n'),
      },
    });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[POST /claim-message] error:', err);
    res.status(500).json({ ok: false, error: err.message });
  } finally {
    client.release();
  }
});

// -----------------------------------------------------------------
// 5. POST /monthly-claim/:claimId/paid — 標記已付款
// 注意：必須 group_id 過濾，避免跨家庭操作
// -----------------------------------------------------------------
router.post('/monthly-claim/:claimId/paid', async (req, res) => {
  const client = await pool.connect();
  try {
    const { claimId } = req.params;
    const { group_id } = req.user;

    await client.query('BEGIN');

    const upd = await client.query(
      `UPDATE monthly_claim
          SET status = 'PAID', paid_at = NOW()
        WHERE claim_id = $1 AND group_id = $2
        RETURNING *`,
      [claimId, group_id]
    );

    if (upd.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ ok: false, error: '找不到此 claim 或不屬於本家庭' });
    }

    // 對應的 records 也標 PAID
    await client.query(
      `UPDATE family_pay_record
          SET status = 'PAID', updated_at = NOW()
        WHERE claim_id = $1 AND group_id = $2`,
      [claimId, group_id]
    );

    await client.query('COMMIT');
    res.json({ ok: true, data: upd.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[POST /monthly-claim/:claimId/paid] error:', err);
    res.status(500).json({ ok: false, error: err.message });
  } finally {
    client.release();
  }
});

// -----------------------------------------------------------------
// 6. GET /me — 當前使用者資料 + 所屬家庭
// -----------------------------------------------------------------
router.get('/me', async (req, res) => {
  try {
    const { group_id } = req.user;
    const groupRes = await pool.query(
      'SELECT group_id, group_name, settle_day FROM family_group WHERE group_id = $1',
      [group_id]
    );
    res.json({
      ok: true,
      data: {
        user: req.user,
        group: groupRes.rows[0] || null,
      },
    });
  } catch (err) {
    console.error('[GET /me] error:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;
