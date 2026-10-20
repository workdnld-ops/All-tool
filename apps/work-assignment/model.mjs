export const SCHEMA_VERSION = 1;
export const DIFFICULTIES = ['未評估', '非常簡單', '簡單', '普通', '困難', '非常困難'];
const seeds = [
  ['財務與帳務', ['每月零用金盤點、上系統申請', '整理每月信用卡簽單', '每週現金回存', '換鈔零用金補錢', '每月發票整理', '帳務月結', '採購成本與需求控管', '每日日結與查帳']],
  ['行政、報表與系統', ['整理每月顧資', '更新店內播放清單', '課程錄影檢查', '機下課程告示板維護', '店內文宣、DM 更新', '系統新功能確認與教學', '每月營運指標回報']],
  ['人員管理與活動', ['安排打掃工作', '每季同仁 IRM', '每月 OKR 派對', '新人庶務訓練與考核']],
  ['停車管理', ['瑞光停車券管理', '內湖停車費繳費', '每月同仁停車管理']],
  ['裝備與教學器材', ['贈送護具盤點、叫貨', '租賃護具盤點、叫貨', '贈送護臀盤點、叫貨', '租賃護臀盤點、叫貨', '安全帽盤點、叫貨', '單雙板鞋盤點、叫貨', '單雙板雪板盤點、叫貨', '裝備報廢清冊', '打磨雪板鋼邊', '教學輔助器材盤點（雪杖、軟棒等）']],
  ['設備與設施維護', ['灑水器濾芯更換', '飲水機更換濾芯', '除蟲', '店內設備維修', '雪毯與滑雪機定期測試', '空調濾網定期清潔', '消防年檢', '內湖店冷氣冰水主機保養維修']],
  ['物資採購與店務', ['店內備品盤點、叫貨', '兩店飲料叫貨', '折抵券印製', '帽襯、頭巾與制服管理']],
];
export const SUPPLIES_NOTE = '酒精、洗衣精、除臭噴霧、漂白水、衛生紙、垃圾袋、文具、紙杯、A4 紙、信用卡簽單、遙控器電池、遙控器熱縮膜、護貝膠膜、神秘配方。';

export function createInitialState(now = new Date().toISOString()) {
  const categories = seeds.map(([name], order) => ({ id: `category-${order + 1}`, name, order }));
  const tasks = seeds.flatMap(([, names], categoryIndex) => names.map((name, index) => ({
    id: `work-${categoryIndex + 1}-${index + 1}`, name, categoryId: categories[categoryIndex].id,
    notes: name === '店內備品盤點、叫貨' ? SUPPLIES_NOTE : '', difficulty: null,
    assigneeId: null, collaboratorIds: [], order: 0, createdAt: now, updatedAt: now,
  }))).map((task, order) => ({ ...task, order }));
  return { schemaVersion: SCHEMA_VERSION, initializedAt: now, revision: 0, categories, staff: [], tasks };
}

const fail = message => { throw new Error(message); };
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = (value, max, label, empty = false) => {
  if (typeof value !== 'string' || value.length > max || (!empty && !value.trim())) fail(`${label}格式不正確`);
};
const date = value => typeof value === 'string' && Number.isFinite(Date.parse(value));
const idValid = id => typeof id === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(id);
export const assignees = task => [...new Set([task.assigneeId, ...task.collaboratorIds].filter(Boolean))];
export const isAssigned = task => Boolean(task.shared || assignees(task).length);

export function validateState(input) {
  if (!object(input) || input.schemaVersion !== SCHEMA_VERSION) fail('不支援的資料版本');
  if (!date(input.initializedAt) || !Number.isSafeInteger(input.revision) || input.revision < 0) fail('初始化資訊不完整');
  const allIds = new Set();
  for (const key of ['categories', 'staff', 'tasks']) {
    if (!Array.isArray(input[key]) || input[key].length > 10000) fail(`${key}清單格式不正確`);
    for (const entry of input[key]) {
      if (!object(entry) || !idValid(entry.id) || allIds.has(entry.id)) fail('ID 無效或重複');
      allIds.add(entry.id);
      text(entry.name, 160, '名稱');
    }
  }
  if (!input.categories.length) fail('至少保留一個分類');
  const categories = new Set(input.categories.map(c => c.id));
  const staff = new Set(input.staff.map(p => p.id));
  for (const entry of [...input.categories, ...input.tasks]) {
    if (!Number.isSafeInteger(entry.order) || entry.order < 0) fail('排序資料不正確');
  }
  for (const person of input.staff) {
    if (typeof person.active !== 'boolean' || typeof person.deleted !== 'boolean' || (person.deleted && person.active)) fail('同仁狀態不正確');
  }
  for (const task of input.tasks) {
    if (!categories.has(task.categoryId)) fail('工作指向不存在的分類');
    if (task.assigneeId !== null && !staff.has(task.assigneeId)) fail('工作指向不存在的同仁');
    if (task.difficulty !== null && (!Number.isInteger(task.difficulty) || task.difficulty < 1 || task.difficulty > 5)) fail('難易度須為未評估或 1～5 星');
    text(task.notes, 5000, '備註', true);
    if (!date(task.createdAt) || !date(task.updatedAt)) fail('工作日期不正確');
    if (!Array.isArray(task.collaboratorIds) || new Set(task.collaboratorIds).size !== task.collaboratorIds.length || task.collaboratorIds.some(id => !staff.has(id))) fail('協作人員資料不正確');
    if (task.shared !== undefined && typeof task.shared !== 'boolean') fail('共通分擔設定不正確');
    if (task.shared && assignees(task).length) fail('共通分擔不可同時指定個人');
    if (task.logs !== undefined) {
      if (!Array.isArray(task.logs) || task.logs.length > 10000) fail('工作紀錄格式不正確');
      for (const log of task.logs) {
        if (!object(log) || !idValid(log.id) || allIds.has(log.id)) fail('紀錄 ID 無效或重複');
        allIds.add(log.id);
        if (!date(log.at) || !date(log.createdAt)) fail('紀錄日期不正確');
        text(log.text, 5000, '執行內容');
      }
    }
  }
  // Return a detached copy: filtering or commands must never mutate a saved snapshot.
  return structuredClone(input);
}

export function fromFirebase(raw) {
  if (!raw || typeof raw !== 'object') fail('雲端資料不存在，請使用備份還原');
  return validateState({ ...raw, staff: raw.staff ?? [], tasks: (raw.tasks ?? []).map(task => ({
    ...task, difficulty: task.difficulty ?? null, assigneeId: task.assigneeId ?? null, collaboratorIds: task.collaboratorIds ?? [],
  })) });
}

export function initializeIfMissing(current, now) {
  return current === null ? createInitialState(now) : fromFirebase(current);
}

export function backup(state) {
  return JSON.stringify({ format: 'all-tool/work-assignment', exportedAt: new Date().toISOString(), data: validateState(state) }, null, 2);
}
export function parseBackup(json) {
  if (json.length > 5_000_000) fail('備份檔不得超過 5 MB');
  let parsed;
  try { parsed = JSON.parse(json); } catch { fail('不是有效的 JSON 檔案'); }
  if (!object(parsed) || parsed.format !== 'all-tool/work-assignment') fail('不是工作分配備份檔');
  return validateState(parsed.data);
}

const normalizedName = name => name.normalize('NFKC').toLocaleLowerCase().replace(/[\p{P}\p{S}\s]/gu, '');
export function duplicates(tasks, name, excludeId) {
  const key = normalizedName(name);
  const bigrams = value => new Set(Array.from(value).slice(1).map((c, i) => value[i] + c));
  return tasks.filter(task => {
    if (task.id === excludeId) return false;
    const other = normalizedName(task.name);
    if (key === other) return true;
    if (Math.min(key.length, other.length) >= 4 && (key.includes(other) || other.includes(key))) return true;
    const a = bigrams(key), b = bigrams(other);
    const overlap = [...a].filter(pair => b.has(pair)).length;
    return a.size && b.size && 2 * overlap / (a.size + b.size) >= 0.72;
  });
}

export function selectTasks(state, filters = {}) {
  const names = new Map(state.staff.map(person => [person.id, person.name]));
  const ownerName = task => task.shared ? '共通分擔' : assignees(task).map(id => names.get(id)).sort().join('、');
  const categoryOrder = new Map(state.categories.map(c => [c.id, c.order]));
  const tasks = state.tasks.filter(task =>
    (!filters.search || task.name.toLocaleLowerCase().includes(filters.search.trim().toLocaleLowerCase())) &&
    (!filters.category || task.categoryId === filters.category) &&
    (!filters.person || (filters.person === 'unassigned' ? !isAssigned(task) : filters.person === 'shared' ? task.shared : assignees(task).includes(filters.person))) &&
    (!filters.unassigned || !isAssigned(task)) &&
    (!filters.difficulty || (filters.difficulty === 'unrated' ? task.difficulty === null : task.difficulty === Number(filters.difficulty)))
  );
  return tasks.sort((a, b) => {
    let comparison = 0;
    if (['difficulty-desc', 'difficulty-asc'].includes(filters.sort)) {
      if (a.difficulty === null || b.difficulty === null) comparison = Number(a.difficulty === null) - Number(b.difficulty === null);
      else comparison = (a.difficulty - b.difficulty) * (filters.sort === 'difficulty-desc' ? -1 : 1);
    } else if (filters.sort === 'category') comparison = categoryOrder.get(a.categoryId) - categoryOrder.get(b.categoryId);
    else if (filters.sort === 'person') comparison = Number(!isAssigned(a)) - Number(!isAssigned(b)) || ownerName(a).localeCompare(ownerName(b), 'zh-Hant');
    return comparison || a.order - b.order || a.id.localeCompare(b.id);
  });
}

export function statistics(state) {
  return {
    total: state.tasks.length,
    assigned: state.tasks.filter(isAssigned).length,
    unassigned: state.tasks.filter(task => !isAssigned(task)).length,
    people: state.staff.filter(p => !p.deleted).length,
    workloads: state.staff.map(person => {
      const tasks = state.tasks.filter(task => assignees(task).includes(person.id));
      const rated = tasks.filter(task => task.difficulty !== null);
      const stars = rated.reduce((sum, task) => sum + task.difficulty, 0);
      return { ...person, count: tasks.length, rated: rated.length, stars, average: rated.length ? stars / rated.length : null, unrated: tasks.length - rated.length };
    }).filter(p => !p.deleted || p.count > 0),
  };
}

export function applyCommand(original, command, now = new Date().toISOString()) {
  const state = validateState(original);
  const find = (key, id) => state[key].find(entry => entry.id === id) ?? fail('項目已被其他裝置刪除，請重新確認');
  const editable = (changes, keys) => {
    if (!object(changes) || Object.keys(changes).some(key => !keys.includes(key))) fail('不允許的修改欄位');
  };
  switch (command.type) {
    case 'addTask':
      if (!command.allowDuplicate && duplicates(state.tasks, command.task.name).length) fail('發現相似工作，請確認是否保留');
      state.tasks.push({ ...command.task, difficulty: null, assigneeId: null, collaboratorIds: [], order: Math.max(-1, ...state.tasks.map(t => t.order)) + 1, createdAt: now, updatedAt: now });
      break;
    case 'editTask': {
      const task = find('tasks', command.id);
      editable(command.changes, ['name', 'notes', 'difficulty', 'categoryId', 'assigneeId']);
      if (command.changes.name && command.changes.name !== task.name && !command.allowDuplicate && duplicates(state.tasks, command.changes.name, task.id).length) fail('發現相似工作，請確認是否保留');
      if (command.changes.assigneeId && command.changes.assigneeId !== task.assigneeId) {
        const person = find('staff', command.changes.assigneeId);
        if (!person.active || person.deleted) fail('不能指派給停用或已刪除的同仁');
      }
      Object.assign(task, command.changes, { updatedAt: now });
      break;
    }
    case 'deleteTask':
      find('tasks', command.id);
      state.tasks = state.tasks.filter(task => task.id !== command.id);
      break;
    case 'assignTask': {
      const task = find('tasks', command.id);
      if (!Array.isArray(command.ids) || new Set(command.ids).size !== command.ids.length || typeof command.shared !== 'boolean') fail('負責人設定不正確');
      if (command.shared && command.ids.length) fail('共通分擔不可同時指定個人');
      for (const id of command.ids) {
        const person = find('staff', id);
        if ((!person.active || person.deleted) && !assignees(task).includes(id)) fail('不能指派給停用或已刪除的同仁');
      }
      task.assigneeId = command.ids[0] ?? null;
      task.collaboratorIds = command.ids.slice(1);
      task.shared = command.shared;
      task.updatedAt = now;
      break;
    }
    case 'addLog': {
      const task = find('tasks', command.id);
      task.logs = [...(task.logs ?? []), {id:command.log.id, at:command.log.at, text:command.log.text, createdAt:now}];
      task.updatedAt = now;
      break;
    }
    case 'addPerson':
      state.staff.push({ id: command.id, name: command.name, active: true, deleted: false });
      break;
    case 'renamePerson':
      find('staff', command.id).name = command.name;
      break;
    case 'personStatus': {
      const person = find('staff', command.id);
      person.active = command.active;
      person.deleted = command.deleted;
      if (command.reassignTo !== undefined) {
        if (command.reassignTo === person.id) fail('不能重新指派給相同同仁');
        if (command.reassignTo !== null) {
          const target = find('staff', command.reassignTo);
          if (!target.active || target.deleted) fail('請選擇在職同仁');
        }
        state.tasks.filter(t => assignees(t).includes(person.id)).forEach(t => {
          const ids = [...new Set(assignees(t).map(id => id === person.id ? command.reassignTo : id).filter(Boolean))];
          t.assigneeId = ids[0] ?? null;
          t.collaboratorIds = ids.slice(1);
          t.updatedAt = now;
        });
      }
      break;
    }
    case 'addCategory':
      state.categories.push({ id: command.id, name: command.name, order: Math.max(-1, ...state.categories.map(c => c.order)) + 1 });
      break;
    case 'renameCategory':
      find('categories', command.id).name = command.name;
      break;
    case 'deleteCategory': {
      find('categories', command.id);
      if (state.categories.length === 1) fail('至少保留一個分類');
      const tasks = state.tasks.filter(t => t.categoryId === command.id);
      if (tasks.length) {
        if (!command.targetId || command.targetId === command.id) fail('請先選擇轉移分類');
        find('categories', command.targetId);
        tasks.forEach(task => { task.categoryId = command.targetId; task.updatedAt = now; });
      }
      state.categories = state.categories.filter(c => c.id !== command.id);
      break;
    }
    case 'move': {
      if (!['tasks', 'categories'].includes(command.collection) || ![-1, 1].includes(command.direction)) fail('排序指令不正確');
      const ordered = [...state[command.collection]].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
      const index = ordered.findIndex(entry => entry.id === command.id);
      if (index < 0) fail('排序項目不存在');
      const target = index + command.direction;
      if (target >= 0 && target < ordered.length) [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
      ordered.forEach((entry, order) => { entry.order = order; });
      break;
    }
    case 'import': {
      if (command.expectedRevision !== state.revision) fail('資料已被其他裝置修改，請重新匯入確認');
      const imported = validateState(command.data);
      return { ...imported, initializedAt: state.initializedAt, revision: state.revision + 1 };
    }
    default: fail('未知操作');
  }
  state.revision++;
  return validateState(state);
}
