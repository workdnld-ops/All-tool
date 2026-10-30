import {groupCoursesByWeek} from './weeks.mjs';

export const WEEKDAYS = ['日','一','二','三','四','五','六'];
export const INITIAL_FILTERS = {sport:'SB',stage:'初',level:'',audience:'',exact:'',store:'',day:'',time:''};
export function filterTitle(filters) {
  if (filters.exact) return filters.exact;
  if (filters.sport === 'training') return '自主訓練';
  return [filters.sport,filters.stage,filters.level ? (filters.stage ? filters.level : ` ${filters.level}級`) : '',filters.audience].join('') || '全部課程';
}
export function formatLine(course) {
  return `${course.date.slice(5).replace('-','/')} (${WEEKDAYS[new Date(course.date+'T12:00:00Z').getUTCDay()]}) ${course.store.replace(/店$/,'')} ${course.time} ${course.name}`;
}
export function formatText(courses, filters) {
  const sections = groupCoursesByWeek(courses).map(([,rows])=>rows.map(formatLine).join('\n'));
  return [filterTitle(filters),sections.join('\n\n──────────\n\n')].filter(Boolean).join('\n');
}
export function formatCSV(courses) {
  const quote = value => {
    const text = String(value);
    return '"'+(/^[=+@\-\t\r]/.test(text) ? "'"+text : text).replaceAll('"','""')+'"';
  };
  return '\ufeff'+[['日期','星期','時間','店別','課程','原站顏色','原課表'],...courses.map(c=>[c.date,WEEKDAYS[new Date(c.date+'T12:00:00Z').getUTCDay()],c.time,c.store,c.name,c.color,c.source])].map(row=>row.map(quote).join(',')).join('\r\n');
}
