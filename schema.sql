-- =================================================================
-- Family Pay PostgreSQL Schema (P2 MVP)
-- 在 Supabase SQL Editor 直接貼上執行
-- =================================================================

-- 啟用 uuid 產生函式（pgcrypto 比 uuid-ossp 通用，Supabase 預設有）
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- -----------------------------------------------------------------
-- family_group：家庭群組
-- -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS family_group (
  group_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_name  VARCHAR(100) NOT NULL,
  settle_day  INT,                         -- NULL=月底, 25=每月 25 號
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- -----------------------------------------------------------------
-- family_user：成員（line_user_id 對應 LIFF 拿到的 LINE userId）
-- -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS family_user (
  user_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id      UUID NOT NULL REFERENCES family_group(group_id) ON DELETE CASCADE,
  line_user_id  VARCHAR(100) UNIQUE,
  user_name     VARCHAR(100),
  role_type     VARCHAR(20) NOT NULL,      -- CHILD / PARENT / ADMIN
  is_active     BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_family_user_line_user_id ON family_user(line_user_id);
CREATE INDEX IF NOT EXISTS idx_family_user_group_id    ON family_user(group_id);

-- -----------------------------------------------------------------
-- family_pay_record：代墊紀錄
-- -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS family_pay_record (
  record_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id         UUID NOT NULL REFERENCES family_group(group_id) ON DELETE CASCADE,
  paid_by_user_id  UUID NOT NULL REFERENCES family_user(user_id)   ON DELETE RESTRICT,
  amount           NUMERIC(18, 2) NOT NULL,
  category         VARCHAR(30) NOT NULL,   -- BREAKFAST/DINNER/DRINK/DAILY/OTHER
  pay_method       VARCHAR(30),            -- LINE_PAY/CASH/CREDIT_CARD/JKO_PAY/OTHER
  record_date      DATE NOT NULL,
  note             TEXT,
  status           VARCHAR(20) NOT NULL DEFAULT 'UNSETTLED',
                                           -- UNSETTLED/CLAIMED/PAID/DISPUTED/PERSONAL
  claim_id         UUID,                   -- 被請款後關聯 monthly_claim.claim_id
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_pay_record_group_id    ON family_pay_record(group_id);
CREATE INDEX IF NOT EXISTS idx_pay_record_record_date ON family_pay_record(record_date);
CREATE INDEX IF NOT EXISTS idx_pay_record_status      ON family_pay_record(status);

-- -----------------------------------------------------------------
-- monthly_claim：月度請款（claim-message 觸發後寫入）
-- -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS monthly_claim (
  claim_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id      UUID NOT NULL REFERENCES family_group(group_id) ON DELETE CASCADE,
  claim_month   CHAR(7) NOT NULL,           -- '2026-05'
  total_amount  NUMERIC(18, 2) NOT NULL,
  status        VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
                                            -- DRAFT/SENT/PAID/DISPUTED
  sent_at       TIMESTAMPTZ,
  paid_at       TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (group_id, claim_month)            -- 同家庭同月只能一張
);

CREATE INDEX IF NOT EXISTS idx_monthly_claim_group_id    ON monthly_claim(group_id);
CREATE INDEX IF NOT EXISTS idx_monthly_claim_claim_month ON monthly_claim(claim_month);

-- -----------------------------------------------------------------
-- 種子資料：吳家
-- 跑完後請複製 group_id 設成 Render env var SEED_GROUP_ID
-- -----------------------------------------------------------------
INSERT INTO family_group (group_name, settle_day)
VALUES ('吳家', NULL)
ON CONFLICT DO NOTHING;

-- 查種子家庭 ID（跑完整段 SQL 後手動執行這行看結果）
-- SELECT group_id, group_name FROM family_group WHERE group_name = '吳家';
