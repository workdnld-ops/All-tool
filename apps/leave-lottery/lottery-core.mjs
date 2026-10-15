export function validateRows(rows, staff) {
  if (!rows.length) return "請先新增至少一個日期。";
  const activeIds = new Set(staff.filter((member) => member.active).map((member) => member.id));
  const dates = new Set();
  for (const row of rows) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(row.date || "")) return "每個日期都需要填寫完整日期。";
    if (dates.has(row.date)) return `${row.date} 重複設定，請合併為一筆。`;
    dates.add(row.date);
    const ids = [...new Set(row.staffIds || [])];
    if (!ids.length) return `${row.date} 尚未選擇同仁。`;
    if (ids.some((id) => !activeIds.has(id))) return `${row.date} 有已停用或已刪除的同仁，請重新選擇。`;
    if (!Number.isInteger(Number(row.count)) || Number(row.count) < 1 || Number(row.count) > ids.length) {
      return `${row.date} 的抽選人數須介於 1 到 ${ids.length} 人。`;
    }
    if (!['work', 'leave'].includes(row.target)) return `${row.date} 尚未選擇抽籤類型。`;
  }
  return "";
}

export function secureRandomInt(upperBound) {
  if (!Number.isSafeInteger(upperBound) || upperBound < 1 || upperBound > 0x100000000) throw new RangeError("Invalid random range");
  const maximum = Math.floor(0x100000000 / upperBound) * upperBound;
  const buffer = new Uint32Array(1);
  do {
    crypto.getRandomValues(buffer);
  } while (buffer[0] >= maximum);
  return buffer[0] % upperBound;
}

export function drawRows(rows, staff, randomInt = secureRandomInt) {
  const error = validateRows(rows, staff);
  if (error) throw new Error(error);
  const staffById = new Map(staff.map((member) => [member.id, member]));
  return rows.map((row) => {
    const candidates = [...new Set(row.staffIds)].map((id) => ({ id, name: staffById.get(id).name }));
    const shuffled = [...candidates];
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const selected = randomInt(index + 1);
      if (!Number.isInteger(selected) || selected < 0 || selected > index) throw new RangeError("Invalid random index");
      [shuffled[index], shuffled[selected]] = [shuffled[selected], shuffled[index]];
    }
    const chosen = shuffled.slice(0, Number(row.count));
    const remaining = shuffled.slice(Number(row.count));
    return {
      date: row.date,
      target: row.target,
      count: Number(row.count),
      candidates,
      work: row.target === "work" ? chosen : remaining,
      leave: row.target === "leave" ? chosen : remaining,
    };
  });
}
