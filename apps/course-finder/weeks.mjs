import {addDays,monday} from './calendar.mjs';

export function weekOptions(today) {
  const current = monday(today);
  return Array.from({length:9},(_,index)=>addDays(current,index*7));
}
export function weekLabel(week) {
  const end = addDays(week,6);
  const short = date => date.slice(5).replace('-','/');
  return week.slice(0,4) === end.slice(0,4) ? `${short(week)} – ${short(end)}` : `${week.replaceAll('-','/')} – ${end.replaceAll('-','/')}`;
}
export function toggleWeek(selected, week) {
  return selected.includes(week) ? selected.filter(value=>value !== week) : [...selected,week].sort();
}
export function parseSelectedWeeks(value, today) {
  const selected = value.split(',');
  const allowed = new Set(weekOptions(today));
  if (!selected.length || selected.length > 9 || new Set(selected).size !== selected.length || selected.some(week=>!allowed.has(week))) {
    throw new Error('請選擇本週至未來八週內的有效週次，且不可重複');
  }
  return selected.sort();
}
export function groupCoursesByWeek(courses) {
  const groups = new Map();
  for (const course of courses) {
    const week = monday(course.date);
    if (!groups.has(week)) groups.set(week,[]);
    groups.get(week).push(course);
  }
  return [...groups].sort(([a],[b])=>a.localeCompare(b));
}
