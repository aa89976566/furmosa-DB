// Insert inside the existing fm-adopt closure before function find().
var meetpetsRecords = [], meetpetsShown = 12, meetpetsBusy = false;
function meetpetsArea(value) {
  if (/台北|臺北|新北|基隆|桃園|新竹|宜蘭/.test(value)) return '北部';
  if (/苗栗|台中|臺中|彰化|南投|雲林/.test(value)) return '中部';
  if (/嘉義|台南|臺南|高雄|屏東/.test(value)) return '南部';
  if (/花蓮|台東|臺東/.test(value)) return '東部';
  if (/澎湖|金門|馬祖|連江/.test(value)) return '離島';
  return '';
}
function renderMeetpets(reset) {
  if (reset) meetpetsShown = 12;
  var grid = el('fa-meetpets-grid'); if (!grid) return;
  var kind = el('fa-meetpets-kind').value, region = el('fa-meetpets-region').value;
  var rows = meetpetsRecords.filter(function(a) { return (!kind || a.species === kind || kind === 'other' && !['dog','cat'].includes(a.species) || kind === 'small' && !['dog','cat','rabbit'].includes(a.species)) && (!region || meetpetsArea(a.region) === region); });
  grid.textContent = '';
  rows.slice(0, meetpetsShown).forEach(function(a) {
    var card = document.createElement('article'), img = document.createElement('img');
    img.src = a.image; img.alt = a.name + '・台灣認養地圖原始照片'; img.width = 600; img.height = 450; img.loading = 'lazy';
    img.addEventListener('error', function() { card.remove(); }); card.appendChild(img);
    var copy = rabbitText('div','','fa-rabbit-copy'); copy.appendChild(rabbitText('span','刊登中・狀態請洽原刊登者','fa-rabbit-badge'));
    copy.appendChild(rabbitText('h4',a.name)); copy.appendChild(rabbitText('p',a.basic));
    if (a.behavior.length) copy.appendChild(rabbitText('p','原刊登者觀察：'+a.behavior.join(' ').slice(0,100)+(a.behavior.join(' ').length>100?'…':'')));
    var details = document.createElement('details'); details.appendChild(rabbitText('summary','個性、故事與認養條件')); details.appendChild(rabbitText('p',a.description || '原刊登者尚未補充，請至原頁了解。')); copy.appendChild(details);
    var link = rabbitText('a','查看原頁與聯絡方式','fa-rabbit-button'); link.href = a.url; link.target = '_blank'; link.rel = 'noopener'; copy.appendChild(link);
    copy.appendChild(rabbitText('p','圖文：台灣認養地圖｜原頁編號 '+a.id+'｜核對 '+new Date(a.checkedAt).toLocaleString('zh-TW',{timeZone:'Asia/Taipei',hour12:false})+'（台灣時間）','fa-rabbit-source'));
    card.appendChild(copy); grid.appendChild(card);
  });
  el('fa-meetpets-count').textContent = rows.length ? '符合 '+rows.length+' 筆・目前顯示 '+Math.min(rows.length,meetpetsShown)+' 筆' : '目前沒有符合條件的同步個案，可調整篩選；首次建檔進度請見上方。';
  el('fa-meetpets-more').hidden = meetpetsShown >= rows.length;
}
function updateMeetpetsSelection() {
  if (!el('fa-meetpets-kind')) return;
  el('fa-meetpets-kind').value = state.kind === '狗' ? 'dog' : state.kind === '貓' ? 'cat' : state.kind === '其他' ? (state.species === 'rabbit' ? 'rabbit' : state.species ? 'small' : 'other') : '';
  el('fa-meetpets-region').value = state.region || ''; renderMeetpets(true);
}
async function refreshMeetpets() {
  if (meetpetsBusy || document.hidden) return; meetpetsBusy = true;
  var note = el('fa-meetpets-sync');
  try {
    var response = await fetch('https://furmosa-hq-production.up.railway.app/api/storefront/adoption?source=meetpets',{credentials:'omit',signal:AbortSignal.timeout(15000)});
    if (!response.ok) throw new Error('unavailable'); var p = await response.json();
    if (p.source !== '台灣認養地圖' || !Array.isArray(p.records)) throw new Error('invalid');
    if (!p.ready) { note.textContent = '首次同步建檔中，個案核對完成後將自動顯示。'; return; }
    var rows = p.records.filter(function(a) { return a && /^\d+$/.test(a.id) && a.status === '已開放領養' && typeof a.name === 'string' && /^https:\/\/www\.meetpets\.org\.tw\/content\/\d+$/.test(a.url) && /^https:\/\/www\.meetpets\.org\.tw\/files_meetpets\//.test(a.image) && Array.isArray(a.behavior); });
    if (p.records.length && !rows.length) throw new Error('invalid'); meetpetsRecords = rows; renderMeetpets(false);
    note.textContent = '自動同步 '+rows.length+' 筆刊登個案｜最近成功批次：'+(p.lastSuccessfulRunAt ? new Date(p.lastSuccessfulRunAt).toLocaleString('zh-TW',{timeZone:'Asia/Taipei',hour12:false})+'（台灣時間）' : '首輪核對中')+(p.pending ? '｜另有 '+p.pending+' 筆首次核對中' : '')+(p.stale?'｜部分資料待重新核對':'')+'｜實際認養狀態以原刊登者確認為準';
  } catch(error) { note.textContent = '暫時無法取得認養地圖同步資料；保留最後載入內容，請至原頁確認。'; }
  finally { meetpetsBusy = false; }
}
['fa-meetpets-kind','fa-meetpets-region'].forEach(function(id) { el(id).addEventListener('change',function() { renderMeetpets(true); }); });
el('fa-meetpets-more').addEventListener('click',function() { meetpetsShown += 12; renderMeetpets(false); });
refreshMeetpets(); setInterval(refreshMeetpets,300000); document.addEventListener('visibilitychange',function() { if (!document.hidden) refreshMeetpets(); });
