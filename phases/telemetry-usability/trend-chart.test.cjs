const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
function draw(values) {
  const calls = [];
  const ctx = new Proxy({}, {get:(_,name)=>(...args)=>calls.push([name,...args]),set:()=>true});
  const canvas = {getBoundingClientRect:()=>({width:500}),getContext:()=>ctx};
  const sandbox = {window:{devicePixelRatio:1}};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'trend-chart.js'),'utf8'),sandbox);
  sandbox.window.SHMchart(canvas,values.map(value=>({strain_arm_1:value})),'strain_arm_1');
  return calls;
}
test('missing samples stay gaps at their original horizontal positions',()=>{
  const calls = draw([10,null,30]);
  const points = calls.filter(call=>call[0]==='arc');
  assert.equal(points.length,2);
  assert.equal(points[0][1],62);
  assert.equal(points[1][1],484);
  // Five grid segments only; no line joins the two isolated sensor samples.
  assert.equal(calls.filter(call=>call[0]==='lineTo').length,5);
});
test('explicit zero is a valid measurement',()=>{
  const calls = draw([0,10]);
  assert.equal(calls.filter(call=>call[0]==='arc').length,2);
  assert.equal(calls.filter(call=>call[0]==='lineTo').length,6);
});
test('entirely missing or invalid samples show the empty state',()=>{
  const calls = draw([null,undefined,'',NaN,Infinity,false]);
  assert.equal(calls.filter(call=>call[0]==='arc').length,0);
  assert.ok(calls.some(call=>call[0]==='fillText' && call[1].includes('No telemetry available')));
});
