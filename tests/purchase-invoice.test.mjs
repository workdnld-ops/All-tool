import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {readFile} from 'node:fs/promises';

const require = createRequire(new URL('../apps/purchase-accounting/package.json',import.meta.url));
const {build} = require('esbuild');
const React = require('react');
const {renderToStaticMarkup} = require('react-dom/server');
const sourceUrl = new URL('../apps/purchase-accounting/src/components/ExpenseCard.tsx',import.meta.url);
const source = await readFile(sourceUrl,'utf8');
const result = await build({
  absWorkingDir:fileURLToPath(new URL('../apps/purchase-accounting',import.meta.url)),
  tsconfig:'tsconfig.app.json',
  stdin:{contents:source+'\nexport {invoiceTypeOrder};',loader:'tsx',resolveDir:fileURLToPath(new URL('.',sourceUrl))},
  bundle:true,write:false,platform:'node',format:'cjs',packages:'external',
  jsx:'automatic',alias:{'@':fileURLToPath(new URL('../apps/purchase-accounting/src',import.meta.url))},
});
const module = {exports:{}};
new Function('require','module','exports',result.outputFiles[0].text)(require,module,module.exports);
const {ExpenseCard,invoiceTypeOrder} = module.exports;

test('invoice cycle preserves existing choices and adds cloud before returning to none',()=>{
  assert.deepEqual(invoiceTypeOrder,['none','electronic','paper','cloud']);
  assert.match(source,/\(currentIndex \+ 1\) % invoiceTypeOrder.length/);
  assert.match(source,/onUpdate\(card.id, \{ invoiceType: invoiceTypeOrder\[nextIndex\] \}\)/);
});

test('saved invoice values render their icons and accessible labels, including cloud',()=>{
  const base = {id:'test',status:'none',date:'11/03',tagId:null,content:'測試',amount:100,order:0};
  for (const [invoiceType,label,icon] of [
    ['none','無','minus'],['electronic','電子','zap'],['paper','紙本','file'],['cloud','雲端發票','cloud'],
  ]) {
    const card = JSON.parse(JSON.stringify({...base,invoiceType}));
    const html = renderToStaticMarkup(React.createElement(ExpenseCard,{card,tags:[],onUpdate:()=>{}}));
    assert.ok(html.includes(`aria-label="發票類型：${label}"`));
    assert.ok(html.includes(`title="發票類型：${label}"`));
    assert.ok(html.includes(`lucide-${icon}`));
    assert.ok(html.includes('$100'));
  }
});
