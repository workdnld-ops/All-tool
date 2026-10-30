import {taipeiNow,matches,updateFilters,addDays} from './calendar.mjs?v=1.0.0';
import {INITIAL_FILTERS,filterTitle,formatLine,formatText,formatCSV} from './format.mjs?v=1.1.0';
import {weekOptions,weekLabel,toggleWeek,groupCoursesByWeek} from './weeks.mjs';

const $ = selector => document.querySelector(selector);
const escape = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
let filters = {...INITIAL_FILTERS};
let selectedWeeks = weekOptions(taipeiNow().slice(0,10)).slice(0,2);
let data = null, rows = [], busy = false, error = '', sequence = 0, controller, toastTimer;

function renderWeeks() {
  const options = weekOptions(taipeiNow().slice(0,10));
  selectedWeeks = selectedWeeks.filter(week=>options.includes(week));
  $('#weeks').innerHTML = options.map(week=>`<label class="week-choice"><input type="checkbox" value="${week}" ${selectedWeeks.includes(week) ? 'checked' : ''} aria-label="${week.replaceAll('-','/')} 至 ${addDays(week,6).replaceAll('-','/')}"><span>${weekLabel(week)}</span></label>`).join('');
}

function choices(key, title, options) {
  return `<fieldset><legend>${title}</legend><div class="segments">${options.map(([value,label]) => `<button data-filter="${key}" data-value="${escape(value)}" aria-pressed="${filters[key] === value}">${escape(label)}</button>`).join('')}</div></fieldset>`;
}
function renderFilters() {
  const training = filters.sport === 'training';
  const hideAudience = training || filters.stage === '高' || filters.sport === 'SB' && filters.stage === '中';
  const grades = filters.stage === '初' ? [1,2,3] : filters.stage === '中' ? [4,5,6] : filters.stage === '高' ? [7,8] : [1,2,3,4,5,6,7,8];
  const audiences = filters.sport === 'SK' && filters.stage === '中' ? [['','不限'],['全','全'],['幼','幼']] : [['','不限'],['幼','幼'],['成','成'],['兒','兒'],...(filters.stage === '' ? [['全','全']] : [])];
  $('#choices').innerHTML = choices('sport','課程類型',[['SB','SB 單板'],['SK','SK 雙板'],['training','自主訓練']]) +
    (training ? '' : choices('stage','程度',[['','不限'],['初','初'],['中','中'],['高','高']])) +
    (hideAudience ? '' : choices('audience','班別',audiences)) +
    (training || filters.audience === '幼' ? '' : choices('level','等級',[['','不限'],...grades.map(n=>[String(n),`${n}級`])])) +
    choices('store','店別',[['','兩店'],['內湖店','內湖'],['瑞光店','瑞光']]);
  const names = [...new Set([...(data?.courses.map(c=>c.name) ?? []),...(filters.exact ? [filters.exact] : [])])].sort();
  $('#exact').innerHTML = '<option value="">依條件篩選</option>' + names.map(name=>`<option value="${escape(name)}">${escape(name)}</option>`).join('');
  $('#exact').value = filters.exact;
  $('#day').value = filters.day;
  $('#time').value = filters.time;
  document.querySelectorAll('[data-preset]').forEach(button => {
    const preset = button.dataset.preset;
    const active = !filters.exact && filters.sport === 'SB' && filters.stage === '初' && filters.level === (preset === 'all' ? '' : '2') && filters.audience === (preset === 'adult' ? '成' : '');
    button.setAttribute('aria-pressed',String(active));
  });
}
function renderResults() {
  const now = taipeiNow();
  rows = data?.courses.filter(course=>matches(course,filters,now)) ?? [];
  $('#filter-name').textContent = filterTitle(filters);
  $('#result-count').textContent = busy ? '讀取中…' : error ? '讀取失敗' : `${rows.length} 個時段`;
  $('#loading').hidden = !busy;
  $('#error').hidden = !error;
  $('#error').textContent = error;
  $('#empty').hidden = busy || !!error || rows.length > 0;
  $('#empty').textContent = selectedWeeks.length ? '沒有符合條件的彩色未來時段。' : '請選擇要顯示的週次。';
  const items = [];
  for (const [week,courses] of groupCoursesByWeek(rows)) {
    if (items.length) {
      const divider = document.createElement('li');
      divider.className = 'week-divider';
      divider.setAttribute('role','separator');
      divider.setAttribute('aria-label',weekLabel(week));
      items.push(divider);
    }
    for (const course of courses) {
      const item = document.createElement('li'); item.textContent = formatLine(course); items.push(item);
    }
  }
  $('#schedule').replaceChildren(...items);
  $('#schedule').hidden = busy || !!error;
  for (const id of ['copy','download']) $(`#${id}`).disabled = busy || !!error || !rows.length;
  $('#refresh').disabled = busy || !selectedWeeks.length;
  $('#warnings').hidden = !data?.warnings.length;
  $('#warnings-title').textContent = data?.warnings.length ? `部分週次未取得（${data.loaded}/${data.total} 週），未取得不代表沒有課` : '';
  $('#warnings-list').replaceChildren(...(data?.warnings ?? []).map(message => {
    const item = document.createElement('li'); item.textContent = message; return item;
  }));
  $('#updated').textContent = data && !busy ? `更新於 ${new Intl.DateTimeFormat('zh-TW',{timeZone:'Asia/Taipei',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(data.fetchedAt))}（台灣時間）` : '';
}
async function load() {
  controller?.abort();
  const request = ++sequence;
  renderWeeks();
  data = null; error = '';
  if (!selectedWeeks.length) { busy = false; renderFilters(); renderResults(); return; }
  controller = new AbortController();
  const activeController = controller;
  busy = true; renderResults();
  const timeout = setTimeout(()=>activeController.abort(),60000);
  try {
    const response = await fetch(`../../api/course-calendar?selected=${encodeURIComponent(selectedWeeks.join(','))}`,{signal:activeController.signal,cache:'no-store'});
    if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('課表查詢服務尚未就緒，請稍後重新整理。');
    const result = await response.json();
    if (!response.ok) throw new Error([result.error,...(result.warnings ?? [])].join('\n'));
    if (!Array.isArray(result.courses) || !Array.isArray(result.warnings) || !Number.isFinite(Date.parse(result.fetchedAt))) throw new Error('課表資料格式異常');
    if (sequence === request) data = result;
  } catch (failure) {
    if (sequence === request) error = failure.name === 'AbortError' ? '讀取逾時，請重新整理課表。' : failure.message || '目前無法連線，請檢查網路後重試。';
  } finally {
    clearTimeout(timeout);
    if (sequence === request) { busy = false; renderFilters(); renderResults(); }
  }
}
function notify(message) {
  clearTimeout(toastTimer); $('#toast').textContent = message; $('#toast').hidden = false;
  toastTimer = setTimeout(()=>{ $('#toast').hidden = true; },2800);
}
$('#choices').addEventListener('click',event=>{
  const button = event.target.closest('[data-filter]');
  if (!button) return;
  const {filter:key,value} = button.dataset;
  filters = updateFilters(filters,key,value);
  renderFilters(); renderResults();
  [...document.querySelectorAll('[data-filter]')].find(item=>item.dataset.filter === key && item.dataset.value === value)?.focus({preventScroll:true});
});
for (const key of ['day','time','exact']) $(`#${key}`).addEventListener('change',event=>{
  const value = event.target.value;
  filters = key === 'exact' ? {...filters,exact:value,...(value ? {sport:'',stage:'',level:'',audience:''} : {})} : updateFilters(filters,key,value);
  renderFilters(); renderResults();
});
$('#reset').onclick = () => { filters = {...INITIAL_FILTERS,sport:'',stage:''}; renderFilters(); renderResults(); };
document.querySelector('.presets').addEventListener('click',event=>{
  const button = event.target.closest('[data-preset]'); if (!button) return;
  filters = {...filters,sport:'SB',stage:'初',level:button.dataset.preset === 'all' ? '' : '2',audience:button.dataset.preset === 'adult' ? '成' : '',exact:''};
  renderFilters(); renderResults();
});
$('#weeks').addEventListener('change',event=>{
  const week = event.target.value;
  if (!weekOptions(taipeiNow().slice(0,10)).includes(week)) return;
  selectedWeeks = toggleWeek(selectedWeeks,week); load();
  [...$('#weeks').querySelectorAll('input')].find(input=>input.value === week)?.focus({preventScroll:true});
});
$('#refresh').onclick = () => load();
$('#copy').onclick = async () => {
  try { await navigator.clipboard.writeText(formatText(rows,filters)); notify('已複製課程時段'); }
  catch { notify('瀏覽器不允許複製，請改用下載 CSV'); }
};
$('#download').onclick = () => {
  const url = URL.createObjectURL(new Blob([formatCSV(rows)],{type:'text/csv;charset=utf-8'}));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = `iski-${selectedWeeks[0]}.csv`;
  anchor.click(); setTimeout(()=>URL.revokeObjectURL(url),1000);
};
document.addEventListener('gesturestart',event=>event.preventDefault(),{passive:false});
document.addEventListener('touchmove',event=>{if (event.touches.length > 1) event.preventDefault();},{passive:false});
renderFilters(); load();
setInterval(()=>{if(!document.hidden) renderResults();},30000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden) renderResults();});
