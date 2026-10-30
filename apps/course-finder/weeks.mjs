import {addDays,monday} from './calendar.mjs';

export function weekOptions(localTime) {
  const today = localTime.slice(0,10);
  const current = monday(today);
  const beforeRelease = today === current && (localTime.slice(11,16) || '00:00') < '14:00';
  const first = beforeRelease ? addDays(current,-7) : current;
  return Array.from({length:5},(_,index)=>addDays(first,index*7));
}
export function reconcileWeeks(selected, previous, next) {
  if (!selected.length) return [];
  if (previous.every(week=>selected.includes(week))) return [...next];
  const retained = selected.filter(week=>next.includes(week));
  return retained.length ? retained : [next[0]];
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
  if (!selected.length || selected.length > 5 || new Set(selected).size !== selected.length || selected.some(week=>!allowed.has(week))) {
    throw new Error('請選擇目前已開放的五週內的有效週次，且不可重複');
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
