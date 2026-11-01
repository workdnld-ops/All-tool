import test from 'node:test';
import assert from 'node:assert/strict';
import {courseTimeClass,formatLineParts,formatLine,formatText,INITIAL_FILTERS} from '../apps/course-finder/format.mjs';

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
