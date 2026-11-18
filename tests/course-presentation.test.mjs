import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {courseTimeClass,formatLineParts,formatLine,formatText,INITIAL_FILTERS} from '../apps/course-finder/format.mjs';
import {completeQuery,createRecommendations,HISTORY_KEY} from '../apps/course-finder/recommendations.mjs';

test('recommendations use complete course names and normalize exact selections',()=>{
  for(const [sport,stage,level,audience,name] of [['SK','中','4','','SK中4'],['SB','高','7','','SB高7'],['SK','初','2','兒','SK初2兒']]) {
    const query=completeQuery({sport,stage,level,audience});
    assert.equal(query.name,name);
    assert.deepEqual(completeQuery({exact:name}),query);
  }
  assert.equal(completeQuery(INITIAL_FILTERS),null);
  assert.equal(completeQuery({sport:'SB',stage:'高',level:'2'}),null);
  assert.equal(completeQuery({sport:'SB',stage:'高',audience:'幼'}),null);
});

test('frequent queries persist, debounce edits, deduplicate and rank by count then recency',()=>{
  let saved=null,clock=0,id=0;const jobs=new Map();
  const storage={getItem:()=>saved,setItem:(key,value)=>{assert.equal(key,HISTORY_KEY);saved=value;}};
  const options={storage,now:()=>++clock,schedule:fn=>{jobs.set(++id,fn);return id;},cancel:id=>jobs.delete(id)};
  const flush=()=>{const pending=[...jobs.values()];jobs.clear();pending.forEach(fn=>fn());};
  const history=createRecommendations(options),a={sport:'SK',stage:'中',level:'4'},b={sport:'SB',stage:'高',level:'7'};
  assert.deepEqual(history.list(),[]);
  history.track(a);history.track(b);flush();
  assert.deepEqual(history.list().map(x=>x.name),['SB高7']);
  history.track(b);flush();assert.equal(history.list()[0].count,1);
  history.track(a);flush();history.track(b);flush();
  assert.deepEqual(history.list().map(x=>[x.name,x.count]),[['SB高7',2],['SK中4',1]]);
  assert.deepEqual(createRecommendations(options).list(),history.list());
  assert.equal(createRecommendations({storage:{getItem:()=>null}}).list().length,0);
  saved='not-json';assert.doesNotThrow(()=>createRecommendations(options).list());
  saved='{"bad":1}';assert.deepEqual(createRecommendations(options).list(),[]);
});

test('recommendation storage failures do not block the course tool',()=>{
  let run;const h=createRecommendations({storage:{getItem(){throw Error('denied')},setItem(){throw Error('denied')}},schedule:fn=>{run=fn;},cancel(){}});
  h.track({sport:'SK',stage:'初',level:'2',audience:'兒'});run();
  assert.equal(h.list()[0].name,'SK初2兒');
});

test('presets are history-driven and unchanged results retain native text selection',async()=>{
  const html=await readFile(new URL('../apps/course-finder/index.html',import.meta.url),'utf8');
  const app=await readFile(new URL('../apps/course-finder/app.mjs',import.meta.url),'utf8');
  assert.doesNotMatch(html,/data-preset=/);
  assert.match(app,/filters = \{\.\.\.filters,\.\.\.suggestion.filters\}/);
  assert.match(app,/if \(signature!==renderedSchedule\)/);
  assert.doesNotMatch(app.slice(app.indexOf('async function load('),app.indexOf('function notify(')),/recommendations.track/);
});

test('course results allow desktop selection and iOS long-press copy without enabling controls',async()=>{
  const css=await readFile(new URL('../apps/course-finder/styles.css',import.meta.url),'utf8');
  const app=await readFile(new URL('../apps/course-finder/app.mjs',import.meta.url),'utf8');
  assert.match(css,/#schedule,#schedule \*\{user-select:text;-webkit-user-select:text;-webkit-touch-callout:default\}/);
  assert.match(css,/body\{[^}]*user-select:none/);
  assert.doesNotMatch(app,/addEventListener\(['"](?:selectstart|contextmenu)['"]/);
});

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
