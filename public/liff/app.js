// public/liff/app.js
// 共用模組：LIFF init、API helpers、UI helpers、design token CSS
// 由 index.html / add.html / claim.html 三頁載入

// ──────────────────────────────────────────────
// LIFF init（cached promise，全頁只跑一次）
// ──────────────────────────────────────────────
let _liffReady = null;
let _idToken = null;

export function initLiff() {
  if (_liffReady) return _liffReady;
  _liffReady = (async () => {
    const cfg = await fetch('/api/config').then(r => r.json());
    if (!cfg.liffId) throw new Error('缺少 LIFF ID');
    await liff.init({ liffId: cfg.liffId });
    if (!liff.isLoggedIn()) {
      liff.login();
      // login 會跳走，後面不會執行
      return;
    }
    _idToken = liff.getIDToken();
    return _idToken;
  })();
  return _liffReady;
}

// ──────────────────────────────────────────────
// API helpers
// ──────────────────────────────────────────────
async function _request(path, opts = {}) {
  await initLiff();
  const headers = {
    Authorization: `Bearer ${_idToken}`,
    ...(opts.headers || {}),
  };
  if (opts.body != null && typeof opts.body !== 'string') {
    headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(opts.body);
  }
  const resp = await fetch(path, { ...opts, headers });
  const json = await resp.json().catch(() => ({ ok: false, error: 'invalid json' }));
  if (!json.ok) throw new Error(json.error || `HTTP ${resp.status}`);
  return json.data;
}

export function apiGet(path) {
  return _request(path, { method: 'GET' });
}

export function apiPost(path, body) {
  return _request(path, { method: 'POST', body: body || {} });
}

// ──────────────────────────────────────────────
// Format / 月份運算
// ──────────────────────────────────────────────
export function formatNT(n) {
  const num = Number(n) || 0;
  return `NT$ ${num.toLocaleString('en-US')}`;
}

export function formatYMD(d) {
  const date = (d instanceof Date) ? d : new Date(d);
  if (isNaN(date)) return '';
  return date.toISOString().slice(0, 10);
}

export function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function prevMonth(ym) {
  const [y, m] = ym.split('-').map(Number);
  return m > 1 ? `${y}-${String(m - 1).padStart(2, '0')}` : `${y - 1}-12`;
}

export function nextMonth(ym) {
  const [y, m] = ym.split('-').map(Number);
  return m < 12 ? `${y}-${String(m + 1).padStart(2, '0')}` : `${y + 1}-01`;
}

// ──────────────────────────────────────────────
// Toast / Modal
// ──────────────────────────────────────────────
let _activeToast = null;

export function showToast(msg, type = 'success') {
  if (_activeToast) {
    _activeToast.remove();
    _activeToast = null;
  }
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.textContent = msg;
  document.body.appendChild(t);
  _activeToast = t;
  // 觸發 transition
  requestAnimationFrame(() => t.classList.add('show'));
  const dur = type === 'error' ? 5000 : 3000;
  setTimeout(() => {
    t.classList.remove('show');
    setTimeout(() => {
      if (t.parentNode) t.remove();
      if (_activeToast === t) _activeToast = null;
    }, 200);
  }, dur);
}

export function showConfirmModal({ title, body, confirmText = '確認', cancelText = '取消', danger = false }) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal-card" role="dialog">
        <div class="modal-title">${title || '確認'}</div>
        ${body ? `<div class="modal-body">${body}</div>` : ''}
        <div class="modal-actions">
          <button class="btn btn-secondary" data-action="cancel">${cancelText}</button>
          <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-action="ok">${confirmText}</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.addEventListener('click', (e) => {
      const a = e.target.dataset?.action;
      if (a === 'ok') { overlay.remove(); resolve(true); }
      else if (a === 'cancel' || e.target === overlay) { overlay.remove(); resolve(false); }
    });
  });
}

// ──────────────────────────────────────────────
// 跳頁
// ──────────────────────────────────────────────
export function goto(path) {
  location.href = path;
}

// ──────────────────────────────────────────────
// 常數對照
// ──────────────────────────────────────────────
export const CATEGORY = [
  { key: 'BREAKFAST', label: '早餐',  emoji: '🥞' },
  { key: 'DINNER',    label: '正餐',  emoji: '🍱' },
  { key: 'DRINK',     label: '飲料',  emoji: '☕' },
  { key: 'DAILY',     label: '日用品', emoji: '🛒' },
  { key: 'OTHER',     label: '其他',  emoji: '📦' },
];

export const PAY_METHOD = [
  { key: 'LINE_PAY',    label: 'LINE Pay', emoji: '💚' },
  { key: 'CASH',        label: '現金',     emoji: '💵' },
  { key: 'CREDIT_CARD', label: '信用卡',   emoji: '💳' },
  { key: 'JKO_PAY',     label: '街口支付', emoji: '📲' },
  { key: 'OTHER',       label: '其他',     emoji: '🏷️' },
];

export const CATEGORY_MAP = Object.fromEntries(CATEGORY.map(c => [c.key, c]));
export const PAY_METHOD_MAP = Object.fromEntries(PAY_METHOD.map(p => [p.key, p]));

// 圓餅圖配色（依 CATEGORY 順序）
export const CATEGORY_COLORS = ['#F5A623', '#06C755', '#36A2EB', '#9966FF', '#777777'];

// ──────────────────────────────────────────────
// 共用 CSS（design token + 共用元件）
// 直接注入 <head>，三頁不用重複寫
// ──────────────────────────────────────────────
const CSS = `
:root{
  --color-primary:#06C755;
  --color-primary-hover:#05A444;
  --color-primary-light:#E5F7EC;
  --color-bg:#FFFFFF;
  --color-bg-muted:#F7F7F7;
  --color-text:#333333;
  --color-text-muted:#777777;
  --color-border:#DDDDDD;
  --color-danger:#FF5555;
  --color-success:#06C755;
  --color-warning:#F5A623;
}
*{box-sizing:border-box}
html,body{margin:0;padding:0;background:var(--color-bg);color:var(--color-text);
  font-family:-apple-system,BlinkMacSystemFont,"Helvetica Neue","PingFang TC","Microsoft JhengHei",Arial,sans-serif;
  font-size:16px;line-height:1.4}
button{font-family:inherit;cursor:pointer;border:none;background:none}
input,textarea,select{font-family:inherit;font-size:16px}
a{color:inherit;text-decoration:none}

/* 共用按鈕 */
.btn{display:inline-flex;align-items:center;justify-content:center;height:48px;
  padding:12px 24px;border-radius:24px;font-size:16px;font-weight:600;
  transition:background-color .15s,opacity .15s;width:100%}
.btn-primary{background:var(--color-primary);color:#fff}
.btn-primary:active{background:var(--color-primary-hover)}
.btn-secondary{background:#fff;color:var(--color-text);border:1px solid var(--color-border)}
.btn-danger{background:var(--color-danger);color:#fff}
.btn:disabled{opacity:.4;cursor:not-allowed}

/* 卡片 */
.card{background:#fff;border:1px solid var(--color-border);border-radius:8px;
  padding:14px 16px;margin-bottom:8px}
.card-row{display:flex;justify-content:space-between;align-items:center}
.card-meta{font-size:13px;color:var(--color-text-muted);margin-top:4px}

/* 輸入框 */
.input{width:100%;padding:12px 14px;border:1px solid var(--color-border);
  border-radius:4px;font-size:16px;background:#fff;color:var(--color-text)}
.input:focus{outline:none;border-color:var(--color-primary)}
.input-amount{font-size:36px;height:64px;text-align:center;font-weight:700}
textarea.input{min-height:72px;resize:vertical}

/* picker (5 選 1 卡片) */
.picker-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.picker-card{padding:10px 4px;border-radius:8px;
  border:2px solid transparent;background:var(--color-bg-muted);
  text-align:center;cursor:pointer;font-size:14px;color:var(--color-text);
  transition:border-color .15s,background-color .15s;user-select:none}
.picker-card .emoji{display:block;font-size:24px;line-height:1;margin-bottom:4px}
.picker-card.selected{border-color:var(--color-primary);background:var(--color-primary-light)}

/* FAB */
.fab{position:fixed;right:20px;bottom:20px;width:56px;height:56px;
  background:var(--color-primary);color:#fff;border-radius:50%;
  font-size:32px;line-height:56px;text-align:center;
  box-shadow:0 4px 12px rgba(0,0,0,.18);z-index:100;cursor:pointer}
.fab:active{background:var(--color-primary-hover)}

/* Toast */
.toast{position:fixed;bottom:80px;left:50%;transform:translate(-50%,20px);
  padding:12px 16px;background:var(--color-success);color:#fff;
  border-radius:8px;max-width:320px;font-size:14px;z-index:200;
  opacity:0;transition:opacity .2s,transform .2s;pointer-events:none;text-align:center}
.toast.show{opacity:1;transform:translate(-50%,0)}
.toast-error{background:var(--color-danger)}
.toast-success{background:var(--color-success)}

/* Modal */
.modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.5);
  display:flex;align-items:center;justify-content:center;z-index:300;
  padding:16px}
.modal-card{background:#fff;border-radius:12px;padding:20px;max-width:300px;
  width:100%;box-shadow:0 8px 24px rgba(0,0,0,.2)}
.modal-title{font-size:18px;font-weight:700;margin-bottom:8px;text-align:center}
.modal-body{font-size:14px;color:var(--color-text-muted);margin-bottom:16px;text-align:center}
.modal-actions{display:flex;gap:8px}
.modal-actions .btn{height:42px;padding:8px 12px;font-size:15px}

/* 通用 layout helpers */
.page{max-width:480px;margin:0 auto;padding:16px;padding-bottom:96px}
.page-header{display:flex;align-items:center;justify-content:space-between;
  padding:8px 0 16px;border-bottom:1px solid var(--color-border);margin-bottom:16px}
.page-header h1{font-size:18px;font-weight:600;margin:0}
.icon-btn{width:40px;height:40px;border-radius:50%;display:inline-flex;
  align-items:center;justify-content:center;font-size:20px;color:var(--color-text)}
.icon-btn:active{background:var(--color-bg-muted)}
.empty-state{text-align:center;padding:40px 16px;color:var(--color-text-muted)}
.empty-state .emoji{font-size:48px;display:block;margin-bottom:8px}
.section-title{font-size:14px;color:var(--color-text-muted);margin:16px 0 8px}
`;

const _styleEl = document.createElement('style');
_styleEl.id = 'family-pay-tokens';
_styleEl.textContent = CSS;
document.head.appendChild(_styleEl);
