// Insert inside the existing fm-adopt closure, after renderRabbitRecords is defined.
// No credentials; reads only the server's explicit public animal response.
var adoptionLiveEndpoint = 'https://furmosa-hq-production.up.railway.app/api/storefront/adoption';
var adoptionRefreshRunning = false;
async function refreshAdoptionSource() {
  if (adoptionRefreshRunning || document.hidden) return;
  adoptionRefreshRunning = true;
  var note = document.getElementById('fa-rabbit-sync');
  try {
    var response = await fetch(adoptionLiveEndpoint, { signal: AbortSignal.timeout(15000), credentials: 'omit' });
    if (!response.ok) throw new Error('read-failed');
    var payload = await response.json();
    if (!payload || !Array.isArray(payload.records)) throw new Error('invalid-data');
    if (!payload.ready) {
      if (note) note.textContent = '自動核對正在首次建檔中，目前保留先前整理資料，認養狀態請至協會原頁確認。';
      return;
    }
    var rows = payload.records.filter(function (a) {
      return a && /^\d+$/.test(a.id) && typeof a.name === 'string' && ['已開放領養', '限定資格領養'].includes(a.status) && /^https:\/\/www\.loverabbit\.org\/products_detail\/\d+$/.test(a.url) && /^https:\/\/www\.loverabbit\.org\/upload\//.test(a.image);
    });
    // Reject a malformed nonempty response instead of erasing the list.
    if (payload.records.length && !rows.length) throw new Error('invalid-records');
    rabbitRecords = rows;
    renderRabbitRecords(false);
    if (note) {
      var stamp = payload.lastSuccessfulRunAt ? new Date(payload.lastSuccessfulRunAt).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', hour12: false }) : '等待首輪完整成功';
      note.textContent = '自動同步資料：' + rows.length + ' 筆可認養個案｜最近成功批次：' + stamp + '（台灣時間）' + (payload.pending ? '｜另有 ' + payload.pending + ' 筆首次核對中' : '') + (payload.stale ? '｜部分資料待重新核對，請至協會原頁確認' : '｜最新認養狀態仍以協會確認為準');
    }
  } catch (error) {
    if (note) note.textContent = '暫時無法取得同步資料，目前保留最後載入內容；最新狀態請至協會原頁確認。';
  } finally {
    adoptionRefreshRunning = false;
  }
}
refreshAdoptionSource();
// This refreshes an already-open page; source collection runs independently on Railway.
setInterval(refreshAdoptionSource, 300000);
document.addEventListener('visibilitychange', function () { if (!document.hidden) refreshAdoptionSource(); });
