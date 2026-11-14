import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {courseTimeClass,formatLineParts,formatLine,formatText,INITIAL_FILTERS} from '../apps/course-finder/format.mjs';

test('grade choices precede audience choices and both use full mobile rows',async()=>{
  const app=await readFile(new URL('../apps/course-finder/app.mjs',import.meta.url),'utf8');
  const css=await readFile(new URL('../apps/course-finder/styles.css',import.meta.url),'utf8');
  assert.ok(app.indexOf("choices('level','等級'")<app.indexOf("choices('audience','班別'"));
  assert.match(css,/#choices fieldset:has\(\[data-filter="level"\]\)\{grid-column:1\/-1\}/);
  assert.match(css,/#choices fieldset:has\(\[data-filter="audience"\]\)\{grid-column:1\/-1\}/);
});

test('emphasis is applied to the entire course row, not only its time',async()=>{
  const app = await readFile(new URL('../apps/course-finder/app.mjs',import.meta.url),'utf8');
  assert.match(app,/item\.className = courseTimeClass\(course\)/);
  assert.match(app,/item\.textContent = formatLine\(course\)/);
  assert.doesNotMatch(app,/timeElement/);
});

test('weekend times stay red, including evenings; weekday emphasis starts at 18:00',()=>{
  for (const date of ['2026-11-07','2026-11-08']) {
    for (const time of ['09:00','17:59','18:00','21:30']) {
      assert.equal(courseTimeClass({date,time}),'course-time--weekend');
    }
  }
  for (const date of ['2026-11-02','2026-11-03','2026-11-04','2026-11-05','2026-11-06']) {
    for (const time of ['09:00','17:59']) assert.equal(courseTimeClass({date,time}),'');
    for (const time of ['18:00','18:30','21:30']) assert.equal(courseTimeClass({date,time}),'course-time--evening');
  }
});

test('time styling preserves exact plain-text export and leaves other fields separate',()=>{
  const course = {date:'2026-11-07',time:'18:00',store:'內湖店',name:'SB初2兒'};
  assert.deepEqual(formatLineParts(course),['11/07 (六) 內湖 ','18:00',' SB初2兒']);
  assert.equal(formatLine(course),'11/07 (六) 內湖 18:00 SB初2兒');
  assert.equal(formatText([course],INITIAL_FILTERS),'SB初\n11/07 (六) 內湖 18:00 SB初2兒');
});
