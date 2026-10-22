export const DEFAULT_EXECUTOR_KEY = 'ops-work-assignment-default-executor-v1';

export function createExecutorPreference(getStorage) {
  let id = '';
  try {
    const saved = getStorage().getItem(DEFAULT_EXECUTOR_KEY);
    if (typeof saved === 'string') id = saved;
  } catch {
    // A blocked browser store must not prevent access to work records.
  }
  return {
    get id() { return id; },
    set(value) {
      id = typeof value === 'string' ? value : '';
      try {
        if (id) getStorage().setItem(DEFAULT_EXECUTOR_KEY, id);
        else getStorage().removeItem(DEFAULT_EXECUTOR_KEY);
        return true;
      } catch {
        return false;
      }
    },
    resolve(staff, override = null) {
      const selected = override ?? (id ? [id] : []);
      return [...new Set(selected)].filter(key => staff.some(person => person.id === key && person.active && !person.deleted));
    },
  };
}
