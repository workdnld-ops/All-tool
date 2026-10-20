import { DIFFICULTIES, validateState, duplicates, selectTasks, statistics, backup, parseBackup, assignees, executionHistory } from './model.mjs?v=1.3.0';
import { CACHE_KEY, LOCAL_KEY, createLocalRepository, createCloudRepository } from './storage.mjs?v=1.3.0';

const $ = selector => document.querySelector(selector);
const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
const icon = name => `<svg class="icon" aria-hidden="true"><use href="icons.svg#${name}"/></svg>`;
const iconButton = (action, id, name, label, disabled = false) => `<button type="button" class="icon-button" data-action="${action}" data-id="${escape(id)}" title="${escape(label)}" aria-label="${escape(label)}" ${disabled ? 'disabled' : ''}>${icon(name)}</button>`;
const option = (value, name, selected, disabled = false) => `<option value="${escape(value)}" ${value === selected ? 'selected' : ''} ${disabled ? 'disabled' : ''}>${escape(name)}</option>`;
const personLabel = person => `${person.name}${person.deleted ? '（已刪除）' : !person.active ? '（已停用）' : ''}`;
let state = null, repository, ready = false, busy = false, toastTimer, dialogAction;
let filters = { search:'', category:'', person:'', difficulty:'', sort:'manual', unassigned:false };
const localPreview = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
const writable = () => ready && !busy;

function notify(message) {
  $('#toast').textContent = message;
  $('#toast').hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { $('#toast').hidden = true; }, 3500);
}
function warning(message) {
  $('#connection-warning').textContent = message;
  $('#connection-warning').hidden = !message;
}
function controls() {
  document.querySelectorAll('[data-write]').forEach(button => { button.disabled = !writable(); });
  document.querySelectorAll('#editor input, #editor select, #editor textarea').forEach(field => { field.disabled = busy; });
  $('#export').disabled = !state;
}
function connection(connected, label) {
  ready = connected;
  $('#sync-status').textContent = busy ? '儲存中…' : label;
  controls();
  renderLists();
}
async function commit(command) {
  if (!writable()) { notify('目前無法儲存，請等待連線恢復'); return false; }
  busy = true;
  controls();
  $('#sync-status').textContent = '儲存中…';
  renderLists();
  try {
    const saved = await repository.commit(command);
    if (!state || saved.revision >= state.revision) state = saved;
    render();
    notify('已儲存');
    return true;
  } catch (error) {
    $('#dialog-error').textContent = error.message;
    notify(error.message);
    return false;
  } finally {
    busy = false;
    $('#sync-status').textContent = ready ? (localPreview ? '本機測試資料已儲存' : '資料已同步') : '連線中斷，僅供查看';
    controls();
    renderLists();
  }
}

function categoriesOptions(selected, excluded = '') {
  return [...state.categories].sort((a,b) => a.order - b.order).filter(c => c.id !== excluded).map(c => option(c.id, c.name, selected)).join('');
}
function peopleOptions(selected, excluded = '') {
  return option('', '未分配', selected ?? '') + state.staff.filter(p => p.id !== excluded && ((p.active && !p.deleted) || p.id === selected)).map(p => option(p.id, personLabel(p), selected, !p.active || p.deleted)).join('');
}
function render() {
  if (!state) return;
  const stats = statistics(state);
  for (const key of ['total','assigned','unassigned','people']) $(`#${key}`).textContent = stats[key];
  $('#filter-person').innerHTML = option('', '全部同仁', filters.person) + option('unassigned', '未分配', filters.person) + option('shared', '共通分擔', filters.person) + state.staff.filter(p => !p.deleted || state.tasks.some(t => assignees(t).includes(p.id))).map(p => option(p.id, personLabel(p), filters.person)).join('');
  if (!state.categories.some(c => c.id === filters.category)) filters.category = '';
  if (filters.person && !['unassigned','shared'].includes(filters.person) && !state.staff.some(p => p.id === filters.person)) filters.person = '';
  $('#workloads').innerHTML = stats.workloads.length ? stats.workloads.map(p => `<tr><td>${escape(personLabel(p))}</td><td>${p.count}</td><td>${p.rated}</td><td>${p.stars}</td><td>${p.unrated}</td></tr>`).join('') : '<tr><td colspan="5" class="empty">尚無同仁</td></tr>';
  $('#backup-status').textContent = `資料版本 ${state.schemaVersion}・修訂 ${state.revision}・${state.tasks.length} 項工作`;
  controls();
  renderLists();
}
function renderLists() {
  if (!state) return;
  const categoriesSorted = [...state.categories].sort((a,b) => a.order - b.order);
  $('#category-navigation').innerHTML = [{id:'',name:'全部工作'}, ...categoriesSorted].map(category => `<button type="button" data-category="${escape(category.id)}" aria-pressed="${filters.category === category.id}"><span>${escape(category.name)}</span><small>${category.id ? state.tasks.filter(task => task.categoryId === category.id).length : state.tasks.length}</small></button>`).join('');
  const filterCount = [filters.person, filters.difficulty, filters.unassigned, filters.sort !== 'manual'].filter(Boolean).length;
  $('#filter-count').textContent = filterCount ? String(filterCount) : '';
  const disabled = !writable();
  const tasks = selectTasks(state, filters);
  $('#result-count').textContent = `${tasks.length} / ${state.tasks.length}`;
  const canMove = filters.sort === 'manual' && !filters.search && !filters.category && !filters.person && !filters.difficulty && !filters.unassigned;
  $('#tasks').innerHTML = tasks.length ? tasks.map((task, index) => `<article class="task" data-task-id="${escape(task.id)}">
    <div class="task-title"><button class="task-name" data-action="edit-task" data-id="${escape(task.id)}" ${disabled ? 'disabled' : ''}>${escape(task.name)}</button>${task.notes ? `<p class="task-notes">${escape(task.notes)}</p>` : ''}</div>
    <button class="category-badge" data-action="edit-task" data-id="${escape(task.id)}" title="修改工作分類" ${disabled ? 'disabled' : ''}>${escape(state.categories.find(category => category.id === task.categoryId)?.name)}</button>
    <div class="rating"><div class="stars" role="group" aria-label="${escape(task.name)}的難易度">${[1,2,3,4,5].map(value => `<button type="button" class="star ${task.difficulty >= value ? 'filled' : ''}" data-action="rate" data-id="${escape(task.id)}" data-value="${value}" aria-label="${value} 星：${DIFFICULTIES[value]}" aria-pressed="${task.difficulty === value}" title="${DIFFICULTIES[value]}" ${disabled ? 'disabled' : ''}>${icon('star')}</button>`).join('')}</div><div class="rating-caption">${DIFFICULTIES[task.difficulty ?? 0]}${task.difficulty !== null ? `<button type="button" class="clear-rating" data-action="clear-rating" data-id="${escape(task.id)}" ${disabled ? 'disabled' : ''}>清除評估</button>` : ''}</div></div>
    <div class="task-owner"><button class="owner-button" data-action="assign-task" data-id="${escape(task.id)}" aria-label="${escape(task.name)}的負責人" ${disabled ? 'disabled' : ''}>${task.shared ? '共通分擔' : escape(assignees(task).map(id => personLabel(state.staff.find(p => p.id === id))).join('、') || '未分配')}</button><button class="log-button" data-action="task-log" data-id="${escape(task.id)}">${icon('clipboard-list')}紀錄 ${task.logs?.length ?? 0}</button></div>
    <details class="task-menu"><summary aria-label="${escape(task.name)}的操作" title="工作操作">${icon('ellipsis')}</summary><div class="menu">
      <button data-action="edit-task" data-id="${escape(task.id)}" ${disabled ? 'disabled' : ''}>${icon('pencil')}編輯與備註</button>
      <button data-action="move-task-up" data-id="${escape(task.id)}" title="完整清單的手動排序模式可使用" ${disabled || !canMove || index === 0 ? 'disabled' : ''}>${icon('arrow-up')}上移</button>
      <button data-action="move-task-down" data-id="${escape(task.id)}" title="完整清單的手動排序模式可使用" ${disabled || !canMove || index === tasks.length - 1 ? 'disabled' : ''}>${icon('arrow-down')}下移</button>
      <button class="danger" data-action="delete-task" data-id="${escape(task.id)}" ${disabled ? 'disabled' : ''}>${icon('trash-2')}刪除工作</button>
    </div></details>
  </article>`).join('') : '<p class="empty">沒有符合條件的工作</p>';
  const people = state.staff.filter(p => !p.deleted || state.tasks.some(task => assignees(task).includes(p.id)) || executionHistory(state,p.id).length);
  const workLinks = tasks => tasks.length ? `<ul class="person-work">${tasks.map(task => `<li><button data-action="task-log" data-id="${escape(task.id)}">${escape(task.name)}<small>${task.logs?.length ?? 0} 次紀錄</small></button></li>`).join('')}</ul>` : '<p class="muted">尚無負責工作</p>';
  $('#staff-list').innerHTML = (people.length ? people.map(person => {
    const tasks = state.tasks.filter(task => assignees(task).includes(person.id));
    const history = executionHistory(state, person.id);
    const count = history.reduce((sum,group) => sum + group.logs.length,0);
    const historyHtml = history.length ? history.map(group => `<details class="person-history-group"><summary>${escape(group.name)}<small>${group.logs.length} 次 · 最近 ${escape(new Date(group.logs[0].at).toLocaleDateString('zh-TW'))}</small></summary><div class="execution-history">${group.logs.map(log => `<article><time>${escape(new Date(log.at).toLocaleString('zh-TW',{hour12:false}))}</time><p>${escape(log.text)}</p></article>`).join('')}</div></details>`).join('') : '<p class="muted">尚無指定此同仁的執行紀錄</p>';
    return `<div class="person-section"><div class="management-row"><div class="label"><strong>${escape(personLabel(person))}</strong><small>負責 ${tasks.length} 項 · 執行 ${history.length} 種工作／${count} 次</small></div><div class="management-actions">${iconButton('rename-person',person.id,'pencil','修改同仁姓名',disabled)}${!person.deleted ? `<button data-action="person-status" data-id="${escape(person.id)}" ${disabled ? 'disabled' : ''}>${person.active ? '停用' : '啟用'}</button>${iconButton('delete-person',person.id,'trash-2','刪除同仁',disabled)}` : ''}</div></div><h4>目前負責</h4>${workLinks(tasks)}<h4>實際執行紀錄</h4>${historyHtml}</div>`;
  }).join('') : '<p class="empty">尚無同仁，請新增同仁姓名</p>') + `<div class="person-section"><h3>共通分擔</h3>${workLinks(state.tasks.filter(task => task.shared))}</div>`;
  const categories = [...state.categories].sort((a,b) => a.order - b.order);
  $('#categories-list').innerHTML = categories.map((category,index) => `<div class="management-row"><div class="label"><strong>${escape(category.name)}</strong><small>${state.tasks.filter(t => t.categoryId === category.id).length} 項工作</small></div><div class="management-actions">${iconButton('move-category-up',category.id,'arrow-up','分類上移',disabled || index===0)}${iconButton('move-category-down',category.id,'arrow-down','分類下移',disabled || index===categories.length-1)}${iconButton('rename-category',category.id,'pencil','修改分類',disabled)}${iconButton('delete-category',category.id,'trash-2','刪除分類',disabled || categories.length===1)}</div></div>`).join('');
}

function openDialog(title, fields, submit, label = '儲存', allowRead = false) {
  if (!writable() && !allowRead) return;
  $('#dialog-title').textContent = title;
  $('#dialog-fields').innerHTML = fields;
  $('#dialog-fields').onchange = null;
  $('#dialog-error').textContent = '';
  $('#save-dialog').textContent = label;
  dialogAction = submit;
  $('#editor').showModal();
  const first = $('#dialog-fields input, #dialog-fields select, #dialog-fields textarea');
  first?.focus();
}
function editAssignees(id) {
  const task = state.tasks.find(task => task.id === id);
  const selected = assignees(task);
  openDialog('設定負責人', `<p>${escape(task.name)}</p><label class="check"><input type="checkbox" name="shared" ${task.shared ? 'checked' : ''}>共通分擔</label><div class="assignee-options">${state.staff.filter(person => (!person.deleted && person.active) || selected.includes(person.id)).map(person => `<label class="check"><input type="checkbox" name="owners" value="${escape(person.id)}" ${selected.includes(person.id) ? 'checked' : ''}>${escape(personLabel(person))}</label>`).join('')}</div><p class="muted">未勾選任何人即為未分配。</p>`, form => commit({type:'assignTask', id, shared:form.has('shared'), ids:form.getAll('owners')}));
  $('#dialog-fields').onchange = event => {
    if (event.target.name === 'shared' && event.target.checked) document.querySelectorAll('[name="owners"]').forEach(input => { input.checked = false; });
    if (event.target.name === 'owners' && event.target.checked) $('#dialog-fields [name="shared"]').checked = false;
  };
}
function showLogs(id) {
  const task = state.tasks.find(task => task.id === id);
  const now = new Date();
  const localTime = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0,16);
  const logs = [...(task.logs ?? [])].sort((a,b) => Date.parse(b.at) - Date.parse(a.at));
  openDialog('工作執行紀錄', `<p>${escape(task.name)} · ${logs.length} 次</p><label>執行時間<input name="at" type="datetime-local" required value="${localTime}"></label><fieldset class="executor-field"><legend>實際執行同仁（可多選）</legend><div class="assignee-options">${state.staff.filter(person => !person.deleted).map(person => `<label class="check"><input name="executors" type="checkbox" value="${escape(person.id)}">${escape(personLabel(person))}</label>`).join('')}</div><p class="muted">未勾選為未指定，不計入個人執行次數。</p></fieldset><label>執行內容<textarea name="text" maxlength="5000" required placeholder="記錄這次做了甚麼"></textarea></label><div class="execution-history">${logs.length ? logs.map(log => `<article><time>${escape(new Date(log.at).toLocaleString('zh-TW', {hour12:false}))}</time><div class="log-executors">${escape((log.executorIds ?? []).map(id => personLabel(state.staff.find(person => person.id === id))).join('、') || '未指定執行同仁')}</div><p>${escape(log.text)}</p></article>`).join('') : '<p class="muted">尚無執行紀錄</p>'}</div>`, form => {
    const at = new Date(form.get('at'));
    if (!Number.isFinite(at.getTime())) { $('#dialog-error').textContent = '請填寫有效的日期時間'; return false; }
    return commit({type:'addLog', id, log:{id:crypto.randomUUID(), at:at.toISOString(), text:form.get('text').trim(), executorIds:form.getAll('executors')}});
  }, '新增紀錄', true);
  controls();
}
function editTask(id) {
  const task = state.tasks.find(t => t.id === id);
  openDialog(task ? '編輯工作' : '新增工作', `
    <label>工作名稱<input name="name" maxlength="160" required value="${escape(task?.name || '')}" autocomplete="off"></label>
    <label>工作分類<select name="categoryId" aria-label="工作分類">${categoriesOptions(task?.categoryId || filters.category || state.categories[0].id)}</select></label>
    <label>備註<textarea name="notes" maxlength="5000">${escape(task?.notes || '')}</textarea></label>
    <div id="duplicate-warning" class="warning" hidden></div>`, async form => {
      const name = form.get('name').trim();
      if (!name) { $('#dialog-error').textContent = '請填寫工作名稱'; return false; }
      const matches = duplicates(state.tasks, name, task?.id);
      const allowed = $('#confirm-duplicate')?.checked === true;
      if (matches.length && !allowed) {
        $('#duplicate-warning').hidden = false;
        $('#duplicate-warning').innerHTML = `<p>發現相同或相似工作：${matches.map(t => escape(t.name)).join('、')}</p><label class="check"><input type="checkbox" id="confirm-duplicate">確認仍要保留此工作</label>`;
        return false;
      }
      const values = { name, notes:form.get('notes').trim(), categoryId:form.get('categoryId') };
      return commit(task ? { type:'editTask', id:task.id, changes:values, allowDuplicate:allowed } : { type:'addTask', task:{ id:crypto.randomUUID(), ...values }, allowDuplicate:allowed });
    });
  $('#editor-form [name="name"]').addEventListener('input', () => { $('#duplicate-warning').hidden = true; $('#duplicate-warning').innerHTML = ''; });
}
function editName(kind, id) {
  const collection = kind === 'Person' ? 'staff' : 'categories';
  const record = state[collection].find(entry => entry.id === id);
  const label = kind === 'Person' ? '同仁姓名' : '分類名稱';
  openDialog(`${record ? '修改' : '新增'}${label}`, `<label>${label}<input name="name" value="${escape(record?.name || '')}" required maxlength="160" autocomplete="off"></label>`, form => commit({ type:`${record ? 'rename' : 'add'}${kind}`, id:record?.id || crypto.randomUUID(), name:form.get('name').trim() }));
}
function personStatus(id, deleted) {
  const person = state.staff.find(p => p.id === id);
  if (!person.active && !deleted) { commit({ type:'personStatus', id, active:true, deleted:false }); return; }
  const count = state.tasks.filter(t => assignees(t).includes(id)).length;
  openDialog(`${deleted ? '刪除' : '停用'} ${person.name}`, `<p>${count ? `此同仁目前負責 ${count} 項工作，請選擇如何處理。` : '此同仁目前沒有負責的工作。'}同仁 ID 與既有關聯會保留，不刪除工作。</p>${count ? `<label>重新分配<select name="reassign"><option value="keep">保留原負責人（標記為${deleted ? '已刪除' : '已停用'}）</option><option value="">改為未分配</option>${state.staff.filter(p => p.id !== id && p.active && !p.deleted).map(p => option(p.id,p.name,'keep')).join('')}</select></label>` : ''}`, form => {
    const target = form.get('reassign');
    return commit({ type:'personStatus', id, active:false, deleted, ...(target !== null && target !== 'keep' ? { reassignTo:target || null } : {}) });
  }, deleted ? '確認刪除' : '確認停用');
}

document.addEventListener('click', async event => {
  const trigger = event.target.closest('[data-action]');
  if (!trigger || (!writable() && trigger.dataset.action !== 'task-log')) return;
  const { action, id, value } = trigger.dataset;
  if (action === 'edit-task') editTask(id);
  else if (action === 'assign-task') editAssignees(id);
  else if (action === 'task-log') showLogs(id);
  else if (action === 'rate' || action === 'clear-rating') {
    await commit({ type:'editTask', id, changes:{difficulty: action === 'rate' ? Number(value) : null} });
    const row = Array.from(document.querySelectorAll('[data-task-id]')).find(row => row.dataset.taskId === id);
    row?.querySelector(`.star[data-value="${value || 1}"]`)?.focus({preventScroll:true});
  }
  else if (action === 'delete-task') {
    const task = state.tasks.find(t => t.id === id);
    openDialog('刪除工作', `<p>確定刪除「${escape(task.name)}」？此操作無法復原。</p>`, () => commit({type:'deleteTask',id}), '確認刪除');
  }
  else if (action === 'rename-person') editName('Person',id);
  else if (action === 'rename-category') editName('Category',id);
  else if (action === 'person-status') personStatus(id,false);
  else if (action === 'delete-person') personStatus(id,true);
  else if (action === 'delete-category') {
    const category = state.categories.find(c => c.id === id);
    const count = state.tasks.filter(t => t.categoryId === id).length;
    openDialog('刪除分類', `<p>刪除「${escape(category.name)}」${count ? `並轉移其中 ${count} 項工作` : ''}？</p>${count ? `<label>轉移至<select name="targetId" required><option value="">選擇轉移分類</option>${categoriesOptions('',id)}</select></label>` : ''}`, form => commit({type:'deleteCategory',id,targetId:form.get('targetId')}), '確認刪除');
  }
  else if (action.startsWith('move-')) await commit({type:'move',collection:action.includes('category') ? 'categories' : 'tasks',id,direction:action.endsWith('up') ? -1 : 1});
});
$('#tasks').addEventListener('change', async event => {
  if (!event.target.matches('select[data-field]')) return;
  const {field,id} = event.target.dataset;
  await commit({type:'editTask',id,changes:{[field]:event.target.value || null}});
  const row = Array.from(document.querySelectorAll('[data-task-id]')).find(row => row.dataset.taskId === id);
  row?.querySelector(`[data-field="${field}"]`)?.focus({preventScroll:true});
});
$('#editor-form').addEventListener('submit', async event => {
  event.preventDefault();
  if (!writable()) return;
  $('#dialog-error').textContent = '';
  try { if (await dialogAction(new FormData(event.currentTarget))) $('#editor').close(); }
  catch(error) { $('#dialog-error').textContent = error.message; }
});
for (const selector of ['#close-dialog','#cancel-dialog']) $(selector).onclick = () => { if (!busy) $('#editor').close(); };
$('#editor').addEventListener('cancel', event => { if (busy) event.preventDefault(); });
$('#add-task').onclick = () => editTask();
$('#add-person').onclick = () => editName('Person');
$('#add-category').onclick = () => editName('Category');
document.querySelectorAll('[data-tab]').forEach(button => button.addEventListener('click', () => {
  document.querySelectorAll('[data-tab]').forEach(tab => { const selected = tab === button; tab.setAttribute('aria-pressed', String(selected)); $(`#view-${tab.dataset.tab}`).hidden = !selected; });
}));
$('#category-navigation').addEventListener('click', event => {
  const button = event.target.closest('[data-category]');
  if (!button) return;
  filters.category = button.dataset.category;
  renderLists();
  Array.from($('#category-navigation').querySelectorAll('button')).find(item => item.dataset.category === filters.category)?.focus({preventScroll:true});
});
$('#toggle-filters').onclick = () => {
  const expanded = $('#toggle-filters').getAttribute('aria-expanded') !== 'true';
  $('#toggle-filters').setAttribute('aria-expanded', String(expanded));
  $('#advanced-filters').hidden = !expanded;
};
for (const [id,key] of [['search','search'],['filter-person','person'],['filter-difficulty','difficulty'],['sort','sort'],['only-unassigned','unassigned']]) {
  $(`#${id}`).addEventListener(id === 'search' ? 'input' : 'change', event => { filters[key] = id === 'only-unassigned' ? event.target.checked : event.target.value; renderLists(); });
}
$('#reset-filters').onclick = () => {
  filters = {search:'',category:'',person:'',difficulty:'',sort:'manual',unassigned:false};
  for (const id of ['search','filter-person','filter-difficulty']) $(`#${id}`).value = '';
  $('#sort').value = 'manual'; $('#only-unassigned').checked = false; renderLists();
};
document.addEventListener('click', event => document.querySelectorAll('.task-menu[open]').forEach(menu => { if (!menu.contains(event.target)) menu.open = false; }));
function download(state, suffix = '') {
  const url = URL.createObjectURL(new Blob([backup(state)], {type:'application/json'}));
  const link = document.createElement('a'); link.href = url; link.download = `庶務工作${suffix}_${new Date().toISOString().slice(0,10)}.json`; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
$('#export').onclick = () => { download(state); notify('備份已匯出'); };
$('#import').onclick = () => $('#import-file').click();
$('#import-file').addEventListener('change', async event => {
  const file = event.target.files[0]; event.target.value = '';
  if (!file) return;
  try {
    if (file.size > 5_000_000) throw new Error('備份檔不得超過 5 MB');
    const data = parseBackup(await file.text());
    const expectedRevision = state.revision;
    openDialog('確認還原備份', `<p>目前 ${state.tasks.length} 項工作將被取代為備份中的 ${data.tasks.length} 項工作、${data.categories.length} 個分類、${data.staff.length} 位同仁（含停用與保留紀錄）。</p><p class="warning">確認後會先下載目前資料備份，再還原。其他工具不受影響。</p>`, async () => {
      download(state, '_還原前');
      return commit({type:'import',data,expectedRevision});
    }, '確認還原');
  } catch(error) { notify(error.message); }
});

try {
  if (!localPreview) {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) { state = validateState(JSON.parse(cached)); render(); $('#sync-status').textContent = '本機快照，正在連線…'; }
    } catch { warning('無法讀取本機快照，正在確認雲端資料；不會清除原有快照。'); }
  }
  repository = localPreview ? createLocalRepository(localStorage) : await createCloudRepository(warning);
  await repository.start(incoming => { state = incoming; render(); }, connection, error => warning(error.message));
  if (localPreview) window.addEventListener('storage', event => {
    if (event.key === LOCAL_KEY && event.newValue && !busy) {
      try { state = validateState(JSON.parse(event.newValue)); render(); } catch(error) { warning(error.message); }
    }
  });
} catch(error) {
  ready = false; controls(); renderLists();
  $('#sync-status').textContent = '連線或資料載入失敗';
  warning(`${error.message}。可重新整理重試；不會用預設資料覆蓋既有紀錄。`);
}
