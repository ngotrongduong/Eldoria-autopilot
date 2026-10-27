const $ = id => document.getElementById(id);
const ask = q => chrome.runtime.sendMessage({ q });
async function show() {
  const s = await ask('status');
  $('ver').textContent = 'Bản mới nhất: ' + (s.latest || '?') + ' · đang chạy: ' + ((s.tab && s.tab.v) || '—') + (s.cfg.enabled ? '' : ' · ĐANG TẮT');
  $('rep').textContent = s.tab ? s.tab.rep : 'Chưa mở tab game https://pxhero.net/scene/play.html';
  $('source').value = s.cfg.source; $('url').value = s.cfg.url || '';
}
for (const q of ['start', 'stop', 'reload']) $(q).onclick = async () => { const r = await ask(q); $('rep').textContent = r.err || String(r.r); setTimeout(show, 1500); };
$('source').onchange = () => chrome.storage.local.set({ source: $('source').value });
$('url').onchange = () => chrome.storage.local.set({ url: $('url').value.trim() });
show(); setInterval(show, 5000);
