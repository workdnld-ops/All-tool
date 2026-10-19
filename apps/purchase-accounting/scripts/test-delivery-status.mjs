import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { transform } from 'esbuild';

const source = await readFile(new URL('../src/lib/delivery-status.ts', import.meta.url), 'utf8');
const { code } = await transform(source, { loader: 'ts', format: 'esm' });
const { STATUS_GRID, statusParts, statusRank, statusLabel } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
assert.equal(new Set(STATUS_GRID.flat()).size, 9);
for (let goods = 0; goods < 3; goods++) {
  for (let receipt = 0; receipt < 3; receipt++) {
    const status = STATUS_GRID[goods][receipt];
    assert.deepEqual(statusParts(status), { goods, receipt });
    assert.equal(statusRank(status), goods * 3 + receipt);
    assert.equal(statusParts(JSON.parse(JSON.stringify({ status })).status).receipt, receipt);
  }
}
assert.equal(statusLabel('none'), '未到貨、無發票');
assert.equal(statusLabel('check'), '已驗收、已報帳');
assert.equal(statusLabel('excluded'), '不計算');
assert.equal(statusRank('excluded'), 9);
assert.deepEqual(statusParts('package'), { goods: 0, receipt: 0 });
assert.deepEqual(statusParts('invoice'), { goods: 0, receipt: 1 });
assert.deepEqual(statusParts('complete'), { goods: 1, receipt: 0 });
console.log('PASS: nine combinations, labels, legacy values, JSON round-trip and sorting');
