// supabase_override.js
// ============================================================
// tamashii_dashboard_v2.html の </body> 直前に
//   <script src="supabase_override.js"></script>
// を1行追加するだけで動作します。パッチ不要。
// ============================================================

// ===== ここだけ書き換える =====
const SB_URL  = 'https://YOUR_PROJECT_ID.supabahttps://mtqhcznrsnmnmltydpmq.supabase.co';
const SB_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10cWhjem5yc25tbm1sdHlkcG1xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0MDE5ODksImV4cCI6MjA4ODk3Nzk4OX0.qQ7mscGNc0PidAxtrO8dbb5eeWUnNBU3gEOV6pB4gwQ;
// ==============================

const SB_H   = {
  'Content-Type': 'application/json',
  'apikey': SB_KEY,
  'Authorization': 'Bearer ' + SB_KEY,
};
const FY_NUM = 2026;

// ── loadScore: Supabase から全スコアを取得 ──────────────
async function loadScore() {
  try {
    const res = await fetch(
      SB_URL + '/rest/v1/tamashii_scores?fiscal_year=eq.' + FY_NUM +
      '&order=member_name,month',
      { headers: SB_H }
    );
    const rows = await res.json();
    if (!Array.isArray(rows)) throw new Error(JSON.stringify(rows));
    const d = blankData();
    rows.forEach(row => {
      const mo = row.fiscal_year + '-' + String(row.month).padStart(2, '0')
      if (!d[row.member_name]) return;
      d[row.member_name][mo] = {
        on1:         row.s_1on1        ? 1 : 0,
        engagement:  row.s_fulfillment ? 1 : 0,
        observation: row.s_observation || 0,
        strength:    row.s_strength    ? 1 : 0,
        reflection:  row.s_reflection  ? 1 : 0,
        meeting:     row.s_meeting     ? 1 : 0,
      };
    });
    return d;
  } catch(e) {
    console.error('loadScore:', e);
    return blankData();
  }
}

// ── saveScore: 1メンバー×1ヶ月をUpsert ─────────────────
async function saveScore(memberName, moStr) {
  const entry = DATA[memberName]?.[moStr] || {};
  const monthNum = parseInt(moStr.split('-')[1]);
  const total = MX.reduce((s, m) => s + Math.min(entry[m.key] || 0, m.max), 0);
  const row = {
    fiscal_year:   FY_NUM,
    member_name:   memberName,
    month:         monthNum,
    s_1on1:        (entry.on1        || 0) > 0,
    s_fulfillment: (entry.engagement || 0) > 0,
    s_observation:  entry.observation || 0,
    s_strength:    (entry.strength   || 0) > 0,
    s_reflection:  (entry.reflection || 0) > 0,
    s_meeting:     (entry.meeting    || 0) > 0,
    total_score:   total,
  };
  try {
    const res = await fetch(SB_URL + '/rest/v1/tamashii_scores', {
      method: 'POST',
      headers: { ...SB_H, 'Prefer': 'resolution=merge-duplicates' },
      body: JSON.stringify(row),
    });
    if (!res.ok) throw new Error(await res.text());
    showSaved();
  } catch(e) {
    console.error('saveScore:', e);
    alert('保存失敗。ネットワークを確認してください。');
  }
}

// ── loadFY: チェックリストをSupabaseから取得 ────────────
async function loadFY() {
  try {
    const res = await fetch(
      SB_URL + '/rest/v1/fy_checklist?fiscal_year=eq.' + FY_NUM,
      { headers: SB_H }
    );
    const rows = await res.json();
    if (!Array.isArray(rows)) throw new Error(JSON.stringify(rows));
    const checks = {};
    rows.forEach(r => { if (r.completed && r.item_text) checks[r.item_text] = true; });
    const saved = localStorage.getItem('tamashii_openCats');
    const openCats = saved ? JSON.parse(saved) : {};
    return { checks, openCats };
  } catch(e) {
    console.error('loadFY:', e);
    return { checks: {}, openCats: {} };
  }
}

// ── saveFY: チェック1件をUpsert / openCatsはlocalStorage ─
async function saveFY(itemId, checked) {
  try {
    localStorage.setItem('tamashii_openCats', JSON.stringify(FY.openCats));
    if (itemId === null) return;
    const allItems = FYCATS.flatMap(c => c.items.map(i => ({ ...i, catId: c.id })));
    const item = allItems.find(i => i.id === itemId);
    if (!item) return;
    const orderIdx = allItems.filter(i => i.catId === item.catId)
                             .findIndex(i => i.id === itemId);
    const row = {
      fiscal_year:  FY_NUM,
      category:     item.catId,
      item_order:   orderIdx,
      item_text:    itemId,
      completed:    checked,
      completed_at: checked ? new Date().toISOString() : null,
    };
    const res = await fetch(SB_URL + '/rest/v1/fy_checklist', {
      method: 'POST',
      headers: { ...SB_H, 'Prefer': 'resolution=merge-duplicates' },
      body: JSON.stringify(row),
    });
    if (!res.ok) throw new Error(await res.text());
  } catch(e) {
    console.error('saveFY:', e);
  }
}

// ── commitSave: スコア保存ボタン処理（async版）─────────
async function commitSave() {
  const btn = document.getElementById('save-btn');
  btn.disabled = true;
  btn.textContent = '保存中…';
  DATA[curMbr][curMon] = { ...curEntry };
  await saveScore(curMbr, curMon);
  btn.textContent = '✓ 保存しました';
  setTimeout(() => { btn.disabled = false; btn.textContent = '保存する'; }, 1500);
}

// ── fyToggleItem: チェック切替（async版）───────────────
async function fyToggleItem(itemId) {
  const checked = !FY.checks[itemId];
  if (checked) { FY.checks[itemId] = true; } else { delete FY.checks[itemId]; }
  render();
  await saveFY(itemId, checked);
}

// ── fyToggleCat: アコーディオン開閉 ────────────────────
function fyToggleCat(catId) {
  FY.openCats[catId] = !FY.openCats[catId];
  saveFY(null, null);
  render();
}

// ── fyResetChecks: 全チェックリセット（async版）─────────
async function fyResetChecks() {
  if (!confirm('チェックをすべてリセットしますか？')) return;
  FY.checks = {};
  FY.openCats = {};
  render();
  try {
    await fetch(
      SB_URL + '/rest/v1/fy_checklist?fiscal_year=eq.' + FY_NUM,
      { method: 'DELETE', headers: SB_H }
    );
    localStorage.removeItem('tamashii_openCats');
  } catch(e) { console.error('reset:', e); }
}

// ── init: 非同期初期化（ページロード時に呼ばれる）──────
async function init() {
  const el = document.getElementById('header-status');
  el.style.display = 'inline';
  el.style.color = 'var(--tl)';
  el.textContent = '⏳ 読込中…';
  DATA = await loadScore();
  FY   = await loadFY();
  el.style.display = 'none';
  render();
}

// ── 既存の同期render()を上書きしてから init() 起動 ─────
window.addEventListener('load', () => {
  // DOMロード完了後にinit実行（既存のrender()より後）
  init();
});
