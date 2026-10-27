// Eldoria Autopilot — service worker.
// · Tab game (https://pxhero.net/scene/play.html) tải xong → nạp bundle (tools/*.js đóng gói bởi tools/build_ext.js) vào trang (world MAIN) rồi AP.start().
// · Mỗi phút: hỏi bản mới (nguồn: URL tuỳ chọn → cầu nối 127.0.0.1:8765 → file bundle.json trong thư mục extension, đọc thẳng từ đĩa)
//   → khác bản đang chạy thì NẠP NÓNG (giữ AP.k2 + log). Gửi AP.report() cho cầu nối (nếu có) để Claude theo dõi; nhận lệnh start/stop/reload.
// · version.json có "loader" khác manifest → chrome.runtime.reload() (lấy background/popup mới từ đĩa).
const PAGE = 'https://pxhero.net/scene/play.html';
const BRIDGE = 'http://127.0.0.1:8765';
// bản phát hành trên GitHub (repo công khai) — máy khác tự cập nhật từ đây; máy của Claude thường mới hơn qua thư mục/cầu nối
const GH = 'https://raw.githubusercontent.com/ngotrongduong/eldoria-autopilot/main/bundle.json';
const DEF = { enabled: true, source: 'auto', url: GH };

const cfg = async () => Object.assign({}, DEF, await chrome.storage.local.get(Object.keys(DEF)));
const bust = u => u + (u.includes('?') ? '&' : '?') + 't=' + Date.now();
async function getJSON(u, ms = 8000) {
  const ac = new AbortController(), t = setTimeout(() => ac.abort(), ms);
  try { const r = await fetch(bust(u), { cache: 'no-store', signal: ac.signal }); return r.ok ? await r.json() : null; } catch (e) { return null; } finally { clearTimeout(t); }
}
// nguồn → [{ver, bundle}] url · 'auto' = hỏi cả 3 (GitHub · cầu nối · thư mục), lấy bản có v lớn nhất (v = YYYYMMDD-HHMMSS, so chuỗi được)
async function sources() {
  const c = await cfg(), out = [];
  if (c.source !== 'local' && c.url) out.push({ ver: c.url.replace(/bundle\.json(\?.*)?$/, 'version.json'), bundle: c.url });
  if (c.source !== 'url') {
    out.push({ ver: BRIDGE + '/version.json', bundle: BRIDGE + '/bundle.json' });
    out.push({ ver: chrome.runtime.getURL('version.json'), bundle: chrome.runtime.getURL('bundle.json') });
  }
  return out;
}
async function latest() {
  const vs = await Promise.all((await sources()).map(async s => { const v = await getJSON(s.ver, 4000); return v && v.v ? { ...v, src: s } : null; }));
  return vs.filter(Boolean).sort((a, b) => (a.v < b.v ? 1 : a.v > b.v ? -1 : 0))[0] || null;
}
async function bundleOf(lt) { const b = lt && await getJSON(lt.src.bundle, 20000); return b && b.v && Array.isArray(b.files) ? b : null; }
const gameTabs = () => chrome.tabs.query({ url: PAGE + '*' });

// ---- chạy TRONG TRANG (world MAIN) — hàm tự chứa, không dùng biến ngoài ----
function bootInPage(b, o) {
  if (window.__ZY_VER === b.v && !o.force) return 'same';
  if (window.__ZY_BOOTING && Date.now() - window.__ZY_BOOTING < 150e3) return 'booting';
  window.__ZY_BOOTING = Date.now();
  const t0 = Date.now(), hm = () => new Date().toTimeString().slice(0, 5);
  const ready = () => { try { const W = frames[0]; return !!(W && W.ZY_AGENT && W.eval("typeof hero!=='undefined'&&!!hero&&typeof QUEST_B!=='undefined'")); } catch (e) { return false; } };
  (function wait() {
    if (!ready()) { if (Date.now() - t0 < 120e3) setTimeout(wait, 1000); else window.__ZY_BOOTING = 0; return; }
    const A = window.AP, was = A ? A.on : undefined, k2 = A && A.k2, log = A && A.log;
    try { if (A && A.stop) A.stop(); } catch (e) {}
    const errs = [];
    for (const f of b.files) { try { (0, eval)(f.src); } catch (e) { errs.push(f.n + ': ' + e.message); } }
    let saved = null; try { saved = JSON.parse(localStorage.getItem('zy_k2') || 'null'); } catch (e) {}
    if (window.AP) {
      AP.k2 = Object.assign(AP.k2 || {}, saved || {}, k2 || {});
      if (log) AP.log = log.concat(AP.log || []);
      (AP.log = AP.log || []).push(hm() + ' extension: nạp bản ' + b.v + (errs.length ? ' · LỖI ' + errs.join('; ') : ''));
      if (o.enabled && was !== false) AP.start();
    }
    if (!window.__zyK2T) window.__zyK2T = setInterval(() => { try { if (window.AP && AP.k2) localStorage.setItem('zy_k2', JSON.stringify(AP.k2)); } catch (e) {} }, 60e3);
    try { // giữ tương thích cách nạp tay (CLAUDE.md): zy_tools = helper+gear+jobs, zy_ap = lõi, zy_ap2 = mở rộng
      localStorage.setItem('zy_tools', b.files.slice(0, 3).map(f => f.src).join('\n;\n'));
      localStorage.setItem('zy_ap', b.files[3].src); localStorage.setItem('zy_ap2', b.files[4].src);
    } catch (e) {}
    window.__ZY_VER = b.v; window.__ZY_BOOTING = 0;
  })();
  return 'boot';
}
function peekInPage() { return { v: window.__ZY_VER || null, on: !!(window.AP && AP.on), rep: window.AP && AP.report ? AP.report(12) : 'chưa có AP', at: Date.now() }; }
function cmdInPage(c) { if (!window.AP) return 'chưa có AP'; if (c === 'start') return AP.start(); if (c === 'stop') return AP.stop(); return '?'; }

async function run(tabId, func, args = []) { try { const [r] = await chrome.scripting.executeScript({ target: { tabId, frameIds: [0] }, world: 'MAIN', func, args }); return r && r.result; } catch (e) { return null; } }
async function inject(tabId, force = false) {
  const c = await cfg(), lt = await latest(), b = await bundleOf(lt); if (!b) return 'không lấy được bundle';
  return run(tabId, bootInPage, [b, { enabled: c.enabled, force }]);
}

chrome.tabs.onUpdated.addListener((tabId, info, tab) => { if (info.status === 'complete' && (tab.url || '').startsWith(PAGE)) inject(tabId); });
chrome.runtime.onInstalled.addListener(() => chrome.alarms.create('tick', { periodInMinutes: 1 }));
chrome.runtime.onStartup.addListener(() => chrome.alarms.create('tick', { periodInMinutes: 1 }));
chrome.alarms.onAlarm.addListener(a => { if (a.name === 'tick') tick(); });

async function tick() {
  const lt = await latest();
  if (lt && lt.loader && lt.loader !== chrome.runtime.getManifest().version) { // chống lặp: quên tăng manifest → chỉ thử 1 lần / 30′ cho mỗi số loader
    const { rl } = await chrome.storage.local.get('rl');
    if (!rl || rl.v !== lt.loader || Date.now() - rl.t > 30 * 60e3) { await chrome.storage.local.set({ rl: { v: lt.loader, t: Date.now() } }); chrome.runtime.reload(); return; }
  }
  for (const t of await gameTabs()) {
    const st = await run(t.id, peekInPage); if (!st) continue;
    if (lt && st.v && st.v !== lt.v) await inject(t.id);        // bản mới → nạp nóng
    else if (!st.v) await inject(t.id);                          // trang mở trước khi cài extension
    try { // cầu nối (tuỳ chọn): báo trạng thái + nhận lệnh
      await fetch(BRIDGE + '/status', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tab: t.id, ...st, latest: lt && lt.v }) });
      const c = await getJSON(BRIDGE + '/cmd', 3000);
      if (c && c.cmd === 'reload') await inject(t.id, true); else if (c && c.cmd) await run(t.id, cmdInPage, [c.cmd]);
    } catch (e) {}
  }
}

// popup
chrome.runtime.onMessage.addListener((m, _s, reply) => {
  (async () => {
    const tabs = await gameTabs(), t = tabs[0];
    if (m.q === 'status') { const lt = await latest(); reply({ cfg: await cfg(), latest: lt && lt.v, src: lt && lt.src.bundle, tab: t ? await run(t.id, peekInPage) : null }); return; }
    if (!t) { reply({ err: 'Chưa mở tab game (' + PAGE + ')' }); return; }
    if (m.q === 'reload') reply({ r: await inject(t.id, true) });
    else if (m.q === 'start' || m.q === 'stop') { await chrome.storage.local.set({ enabled: m.q === 'start' }); reply({ r: await run(t.id, cmdInPage, [m.q]) }); }
    else reply({ err: '?' });
  })();
  return true;
});
