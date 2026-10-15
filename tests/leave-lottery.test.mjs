import assert from "node:assert/strict";
import test from "node:test";
import { drawRows, validateRows } from "../apps/leave-lottery/lottery-core.mjs";

const staff = [
  { id: "a", name: "A", active: true },
  { id: "b", name: "B", active: true },
  { id: "c", name: "C", active: true },
];

test("draws every date with its own work or leave count", () => {
  const rows = [
    { date: "2026-11-01", target: "leave", count: 1, staffIds: ["a", "b", "c"] },
    { date: "2026-11-08", target: "work", count: 2, staffIds: ["a", "b", "c"] },
  ];
  const results = drawRows(rows, staff, () => 0);
  assert.equal(results.length, 2);
  assert.equal(results[0].leave.length, 1);
  assert.equal(results[0].work.length, 2);
  assert.equal(results[1].work.length, 2);
  assert.equal(results[1].leave.length, 1);
  for (const result of results) {
    assert.deepEqual(new Set([...result.work, ...result.leave].map((person) => person.id)), new Set(["a", "b", "c"]));
    assert.equal(result.candidates[0].name, "A");
  }
});

test("rejects duplicate dates and impossible draws", () => {
  const row = { date: "2026-11-01", target: "leave", count: 1, staffIds: ["a", "b"] };
  assert.match(validateRows([row, { ...row }], staff), /重複/);
  assert.match(validateRows([{ ...row, count: 3 }], staff), /1 到 2/);
  assert.match(validateRows([{ ...row, staffIds: ["missing"] }], staff), /已停用或已刪除/);
});
