// supabase_override.js v2（セッション自動更新対応）
// ============================================================

// ===== ここだけ書き換える =====
const SB_URL = 'https://mtqhcznrsnmnmltydpmq.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10cWhjem5yc25tbm1sdHlkcG1xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0MDE5ODksImV4cCI6MjA4ODk3Nzk4OX0.qQ7mscGNc0PidAxtrO8dbb5eeWUnNBU3gEOV6pB4gwQ';
// ==============================

const SB_H = { 'Content-Type': 'application/json', 'apikey': SB_KEY, 'Authorization': 'Bearer ' + SB_KEY };
const FY_NUM = 2026;
const SESSION_KEY = 'tamashii_session';

// ── セッション管理 ───────────────────────────────────────
function getSession() { try { return JSON.parse(localStorage.getItem(SESSION_KEY)); } catch { return null; } }
function saveSession(s) { localStorage.setItem(SESSION_KEY, JSON.stringify(s)); }
function clearSession() { localStorage.removeItem(SESSION_KEY); }
function authHeaders(sess) { return { 'Content-Type': 'application/json', 'apikey': SB_KEY, 'Authorization': 'Bearer ' + sess.access_token }; }

// ── セッション自動更新 ────────────────────────────────────
async function refreshSession() {
  const session = getSession();
  if (!session?.refresh_token) return null;
  try {
    const res = await fetch(SB_URL + '/auth/v1/token?grant_type=refresh_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': SB_KEY },
      body: JSON.stringify({ refresh_token: session.refresh_token }),
    });
    if (!res.ok) { clearSession(); return null; }
    const newSession = await res.json();
    saveSession(newSession);
    return newSession;
  } catch { return null; }
}

// ── API呼び出し共通ラッパー（401時に自動リフレッシュ）────
async function sbFetch(url, options, retry = true) {
  let session = getSession();
  if (!session) { showLoginScreen(); throw new Error('未ログイン'); }

  const res = await fetch(url, { ...options, headers: { ...authHeaders(session), ...(options.extraHeaders || {}) } });

  // 401: トークン期限切れ → リフレッシュして再試行
  if (res.status === 401 && retry) {
    const newSession = await refreshSession();
    if (!newSession) { clearSession(); showLoginScreen('セッションが切れました。再度ログインしてください。'); throw new Error('セッション切れ'); }
    return sbFetch(url, options, false); // 1回だけ再試行
  }
  return res;
}

// ── ログイン / ログアウト ────────────────────────────────
async function signIn(email, password) {
  const res = await fetch(SB_URL + '/auth/v1/token?grant_type=password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': SB_KEY },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.msg || 'ログイン失敗');
  return data;
}
async function signOut() {
  const session = getSession();
  if (session) await fetch(SB_URL + '/auth/v1/logout', { method: 'POST', headers: authHeaders(session) }).catch(() => { });
  clearSession(); showLoginScreen();
}
async function verifySession(session) {
  try { const r = await fetch(SB_URL + '/auth/v1/user', { headers: authHeaders(session) }); return r.ok; } catch { return false; }
}

// ── ログイン画面 ─────────────────────────────────────────
function showLoginScreen(errorMsg = '') {
  document.getElementById('content').innerHTML = '';
  document.getElementById('tabs').style.display = 'none';
  const existing = document.getElementById('login-screen'); if (existing) existing.remove();
  const el = document.createElement('div'); el.id = 'login-screen';
  el.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:var(--bg);display:flex;align-items:center;justify-content:center;z-index:9999;';
  el.innerHTML = `
    <div style="background:var(--cd);border:1px solid var(--br);border-radius:16px;padding:36px 32px;width:340px;max-width:90vw;">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:28px;">
        <span style="font-size:22px;">🔥</span>
        <div><div style="font-size:16px;font-weight:bold;">魂スコア</div>
        <div style="font-size:10px;color:var(--mt);letter-spacing:.08em;">E⑩グループ 2026年度</div></div>
      </div>
      <div style="margin-bottom:14px;">
        <div style="font-size:10px;color:var(--mt);margin-bottom:6px;">メールアドレス</div>
        <input id="login-email" type="email" placeholder="example@email.com" style="width:100%;padding:11px 13px;border-radius:9px;border:1px solid var(--br);background:var(--sf);color:var(--tx);font-size:14px;font-family:var(--font);box-sizing:border-box;outline:none;"/>
      </div>
      <div style="margin-bottom:6px;">
        <div style="font-size:10px;color:var(--mt);margin-bottom:6px;">パスワード</div>
        <input id="login-password" type="password" placeholder="パスワード" style="width:100%;padding:11px 13px;border-radius:9px;border:1px solid var(--br);background:var(--sf);color:var(--tx);font-size:14px;font-family:var(--font);box-sizing:border-box;outline:none;"/>
      </div>
      ${errorMsg ? `<div style="font-size:11px;color:var(--rd);margin:10px 0 4px;">${errorMsg}</div>` : '<div style="height:20px;"></div>'}
      <button id="login-btn" onclick="handleLogin()" style="width:100%;padding:13px;border-radius:10px;border:none;background:var(--ac);color:#0F1923;font-size:15px;font-weight:bold;cursor:pointer;font-family:var(--font);letter-spacing:.04em;margin-top:8px;">ログイン</button>
    </div>`;
  document.body.appendChild(el);
  el.querySelectorAll('input').forEach(i => i.addEventListener('keydown', e => { if (e.key === 'Enter') handleLogin(); }));
  document.getElementById('login-email').focus();
}

async function handleLogin() {
  const btn = document.getElementById('login-btn');
  const email = document.getElementById('login-email').value.trim();
  const pass = document.getElementById('login-password').value;
  if (!email || !pass) { showLoginScreen('メールとパスワードを入力してください'); return; }
  btn.disabled = true; btn.textContent = '確認中…';
  try {
    const session = await signIn(email, pass); saveSession(session);
    document.getElementById('login-screen').remove();
    document.getElementById('tabs').style.display = '';
    await init();
  } catch (e) { showLoginScreen('メールアドレスまたはパスワードが正しくありません'); }
}

function addSignOutBtn() {
  if (document.getElementById('signout-btn')) return;
  const btn = document.createElement('button'); btn.id = 'signout-btn'; btn.textContent = '⏻'; btn.title = 'ログアウト';
  btn.style.cssText = 'padding:5px 10px;border-radius:6px;border:1px solid var(--br);background:transparent;color:var(--mt);font-size:13px;cursor:pointer;font-family:var(--font);margin-left:6px;';
  btn.onclick = () => { if (confirm('ログアウトしますか？')) signOut(); };
  document.getElementById('tabs').appendChild(btn);
}

// ── loadScore / saveScore ────────────────────────────────
async function loadScore() {
  try {
    const res = await sbFetch(SB_URL + '/rest/v1/tamashii_scores?on_conflict=fiscal_year,member_name,month?fiscal_year=eq.' + FY_NUM + '&order=member_name,month', { method: 'GET' });
    const rows = await res.json();
    if (!Array.isArray(rows)) throw new Error(JSON.stringify(rows));
    const d = blankData();
    rows.forEach(row => {
      const mo = row.fiscal_year + '-' + String(row.month).padStart(2, '0');
      if (!d[row.member_name]) return;
      d[row.member_name][mo] = { on1: row.s_1on1 ? 1 : 0, engagement: row.s_fulfillment ? 1 : 0, observation: row.s_observation || 0, strength: row.s_strength ? 1 : 0, reflection: row.s_reflection ? 1 : 0, meeting: row.s_meeting ? 1 : 0 };
    });
    return d;
  } catch (e) { console.error('loadScore:', e); return blankData(); }
}

async function saveScore(memberName, moStr) {
  const entry = DATA[memberName]?.[moStr] || {};
  const monthNum = parseInt(moStr.split('-')[1]);
  const total = MX.reduce((s, m) => s + Math.min(entry[m.key] || 0, m.max), 0);
  const row = { fiscal_year: FY_NUM, member_name: memberName, month: monthNum, s_1on1: (entry.on1 || 0) > 0, s_fulfillment: (entry.engagement || 0) > 0, s_observation: entry.observation || 0, s_strength: (entry.strength || 0) > 0, s_reflection: (entry.reflection || 0) > 0, s_meeting: (entry.meeting || 0) > 0, total_score: total };
  try {
    const res = await sbFetch(SB_URL + '/rest/v1/tamashii_scores', { method: 'POST', body: JSON.stringify(row), extraHeaders: { 'Prefer': 'resolution=merge-duplicates' } });
    if (!res.ok) { const t = await res.text(); throw new Error(t); }
    showSaved();
  } catch (e) { console.error('saveScore:', e); alert('保存失敗（' + e.message + '）'); }
}

// ── loadFY / saveFY ──────────────────────────────────────
async function loadFY() {
  try {
    const res = await sbFetch(SB_URL + '/rest/v1/fy_checklist?on_conflict=fiscal_year,item_text?fiscal_year=eq.' + FY_NUM, { method: 'GET' });
    const rows = await res.json();
    if (!Array.isArray(rows)) throw new Error(JSON.stringify(rows));
    const checks = {};
    rows.forEach(r => { if (r.completed && r.item_text) checks[r.item_text] = true; });
    const saved = localStorage.getItem('tamashii_openCats');
    return { checks, openCats: saved ? JSON.parse(saved) : {} };
  } catch (e) { return { checks: {}, openCats: {} }; }
}

async function saveFY(itemId, checked) {
  try {
    localStorage.setItem('tamashii_openCats', JSON.stringify(FY.openCats));
    if (itemId === null) return;
    const allItems = FYCATS.flatMap(c => c.items.map(i => ({ ...i, catId: c.id })));
    const item = allItems.find(i => i.id === itemId); if (!item) return;
    const orderIdx = allItems.filter(i => i.catId === item.catId).findIndex(i => i.id === itemId);
    const row = { fiscal_year: FY_NUM, category: item.catId, item_order: orderIdx, item_text: itemId, completed: checked, completed_at: checked ? new Date().toISOString() : null };
    await sbFetch(SB_URL + '/rest/v1/fy_checklist', { method: 'POST', body: JSON.stringify(row), extraHeaders: { 'Prefer': 'resolution=merge-duplicates' } });
  } catch (e) { console.error('saveFY:', e); }
}

// ── commitSave / fyToggleItem / fyToggleCat / fyResetChecks ─
async function commitSave() {
  const btn = document.getElementById('save-btn'); btn.disabled = true; btn.textContent = '保存中…';
  DATA[curMbr][curMon] = { ...curEntry };
  await saveScore(curMbr, curMon);
  btn.textContent = '✓ 保存しました'; setTimeout(() => { btn.disabled = false; btn.textContent = '保存する'; }, 1500);
}
async function fyToggleItem(itemId) { const checked = !FY.checks[itemId]; if (checked) { FY.checks[itemId] = true; } else { delete FY.checks[itemId]; } render(); await saveFY(itemId, checked); }
function fyToggleCat(catId) { FY.openCats[catId] = !FY.openCats[catId]; saveFY(null, null); render(); }
async function fyResetChecks() {
  if (!confirm('チェックをすべてリセットしますか？')) return;
  FY.checks = {}; FY.openCats = {}; render();
  try { await sbFetch(SB_URL + '/rest/v1/fy_checklist?fiscal_year=eq.' + FY_NUM, { method: 'DELETE' }); localStorage.removeItem('tamashii_openCats'); } catch (e) { console.error('reset:', e); }
}

// ── init ─────────────────────────────────────────────────
async function init() {
  const el = document.getElementById('header-status');
  el.style.display = 'inline'; el.style.color = 'var(--tl)'; el.textContent = '⏳ 読込中…';
  DATA = await loadScore(); FY = await loadFY();
  el.style.display = 'none'; addSignOutBtn(); render();
}

// ── エントリーポイント ────────────────────────────────────
window.addEventListener('load', async () => {
  const session = getSession();
  if (session && await verifySession(session)) {
    document.getElementById('tabs').style.display = '';
    await init();
  } else {
    clearSession();
    document.getElementById('tabs').style.display = 'none';
    showLoginScreen();
  }
});
