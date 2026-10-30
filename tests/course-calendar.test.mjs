import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCalendar, classify, matches, addDays, isColorAvailable, updateFilters, } from '../apps/course-finder/calendar.mjs';
const all = { sport: 'SB', stage: '初', level: '', audience: '', exact: '', store: '', day: '', time: '' };
const make = (name, extra = {}) => ({ id: name, name, date: '2026-11-02', time: '18:00', store: '瑞光店', color: '#cfe2f3', available: true, source: '', ...classify(name), ...extra });
test('broad beginner, grade-only, and exact adult filters remain distinct', () => {
    const c = ['SB初1成', 'SB初2成', 'SB初2兒', 'SB初幼', 'SK初2成', 'SB中4全'].map(n => make(n));
    assert.deepEqual(c.filter(x => matches(x, all, '2026-10-30 10:00')).map(x => x.name), ['SB初1成', 'SB初2成', 'SB初2兒', 'SB初幼']);
    assert.deepEqual(c.filter(x => matches(x, { ...all, level: '2' }, '2026-10-30 10:00')).map(x => x.name), ['SB初2成', 'SB初2兒']);
    assert.deepEqual(c.filter(x => matches(x, { ...all, level: '2', audience: '成' }, '2026-10-30 10:00')).map(x => x.name), ['SB初2成']);
});
test('gray, past, different store, weekend and time filters', () => {
    assert.equal(isColorAvailable('#D2D2D2'), false);
    assert.equal(isColorAvailable('#ffffff'), false);
    assert.equal(isColorAvailable('#ea9999'), true);
    assert.equal(matches(make('SB初2成', { available: false }), all, '2026-10-30 10:00'), false);
    assert.equal(matches(make('SB初2成'), all, '2026-11-02 18:01'), false);
    assert.equal(matches(make('SB初2成'), { ...all, store: '內湖店' }, '2026-10-30 10:00'), false);
    assert.equal(matches(make('SB初2成'), { ...all, day: 'weekend' }, '2026-10-30 10:00'), false);
    assert.equal(matches(make('SB初2成'), { ...all, time: 'afternoon' }, '2026-10-30 10:00'), false);
    assert.equal(matches(make('SB初2成'), { ...all, time: 'evening' }, '2026-10-30 10:00'), true);
});
function fixture() { const start = '2026-12-28'; const headers = Array.from({ length: 7 }, (_, i) => `<th>週${i}<br>${addDays(start, i).slice(5).replace('-', '/')}</th>`).join(''); const cells = (s) => `<td>${s}</td>` + '<td></td>'.repeat(6); return `<section id="calendar"><div class="subject">2026/12/28 ~ 2027/01/03</div><table><thead><tr><th>時間/日期</th><th>店別</th>${headers}</tr></thead><tbody><tr><th rowspan="2">11:00</th><th>內湖店</th>${cells('<div style="background-color: #D2D2D2">SB初2成</div>')}</tr><tr><th>瑞光店</th>${cells('<div style="background-color: #cfe2f3">SB初2兒&nbsp;</div><div style="background-color: ">SB進體</div>')}</tr><tr><th>12:00</th><th>內湖店</th>${'<td></td>'.repeat(6)}<td><div style="background-color: #cfe2f3">SB初2成</div></td></tr></tbody></table></section>`; }
test('parser retains rowspan time, correct branch, year rollover and individual colors', () => {
    const c = parseCalendar(fixture(), '1', '2026-12-28');
    assert.equal(c.length, 3);
    assert.equal(c[0].available, false);
    assert.equal(c[1].time, '11:00');
    assert.equal(c[1].store, '瑞光店');
    assert.equal(c[1].name, 'SB初2兒');
    assert.equal(c[2].date, '2027-01-03');
});
test('changed layout or a redirected week must fail visibly', () => {
    assert.throws(() => parseCalendar(fixture(), '1', '2027-01-04'), /尚未提供/);
    assert.throws(() => parseCalendar('<html>maintenance</html>', '1', '2026-12-28'), /格式已變更/);
});
test('quick selection clears incompatible hidden criteria', () => {
    const adult = { ...all, level: '2', audience: '成' };
    const training = updateFilters(adult, 'sport', 'training');
    assert.equal(training.stage, '');
    assert.equal(training.level, '');
    assert.equal(training.audience, '');
    assert.equal(matches(make('自主訓練'), training, '2026-10-30 10:00'), true);
    assert.equal(matches(make('付費自主'), training, '2026-10-30 10:00'), true);
    assert.equal(matches(make('SB初2成'), training, '2026-10-30 10:00'), false);
    const middle = updateFilters(adult, 'stage', '中');
    assert.equal(middle.audience, '');
    assert.equal(middle.level, '');
    assert.equal(matches(make('SB中4全'), middle, '2026-10-30 10:00'), true);
    const sk = updateFilters(middle, 'sport', 'SK');
    const toddler = updateFilters({ ...sk, level: '4' }, 'audience', '幼');
    assert.equal(toddler.level, '');
    assert.equal(matches(make('SK中幼'), toddler, '2026-10-30 10:00'), true);
    assert.equal(matches(make('SK中4全'), toddler, '2026-10-30 10:00'), false);
    const full = updateFilters(toddler, 'audience', '全');
    assert.equal(matches(make('SK中4全'), full, '2026-10-30 10:00'), true);
});
