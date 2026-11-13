const test=require('node:test');
const assert=require('node:assert/strict');
const model=require('./model.js');
const settings={impressions:4000,ctr:2.4,lead:24,close:18,cpc:1.8};
const now=Date.now();
const payload=()=>({currency:'USD',updatedAt:new Date(now).toISOString(),intervals:model.simulate(settings,now)});

test('40 sample intervals have valid funnel counts and 15-second spacing',()=>{
  const rows=model.simulate(settings,now);
  assert.equal(rows.length,40);
  assert.equal(Date.parse(rows[1].timestamp)-Date.parse(rows[0].timestamp),15000);
  assert.equal(model.validatePayload(payload()).intervals.length,40);
  assert.equal(new Set(rows.map(row=>row.channel)).size,4);
});
test('aggregate CTR and ratios are weighted from summed counts, not mean ratios',()=>{
  const rows=[{spend:100,impressions:100,clicks:10,leads:5,conversions:2,revenue:200},{spend:200,impressions:900,clicks:9,leads:3,conversions:1,revenue:400}];
  const totals=model.summarize(rows);
  assert.equal(totals.ctr,1.9);assert.equal(totals.cac,100);assert.equal(totals.roas,2);assert.equal(totals.conversions,3);
});
test('zero denominators produce unknown ratios, not infinity',()=>{
  const row={spend:0,impressions:0,clicks:0,leads:0,conversions:0,revenue:0};
  for(const key of ['ctr','cac','roas']){assert.equal(model.metric(row,key),null);assert.equal(model.summarize([row])[key],null);}
});
test('demo controls propagate downstream and retain a valid zero-click funnel',()=>{
  const low=model.summarize(model.simulate({...settings,ctr:1},now)),high=model.summarize(model.simulate({...settings,ctr:5},now));
  assert.ok(high.clicks>low.clicks);assert.ok(high.conversions>low.conversions);assert.ok(high.spend>low.spend);
  const zero=model.simulate({...settings,ctr:0},now);assert.equal(model.summarize(zero).conversions,0);
  assert.equal(model.validatePayload({...payload(),intervals:zero}).intervals.length,40);
});
test('API response is sorted and clipped to latest 40 records',()=>{
  const earlier=model.simulate(settings,now-600000),later=model.simulate(settings,now);
  const result=model.validatePayload({...payload(),intervals:[...later,...earlier].reverse()});
  assert.deepEqual(result.intervals,later);
});
test('API rejects malformed data, mixed currency, invalid counts and duplicate events',()=>{
  assert.throws(()=>model.validatePayload(null));
  assert.throws(()=>model.validatePayload({...payload(),currency:'EUR'}),/USD/);
  assert.throws(()=>model.validatePayload({...payload(),updatedAt:'yesterday'}),/timestamp/);
  const bad=(key,value)=>{const p=payload();p.intervals[0][key]=value;return p;};
  assert.throws(()=>model.validatePayload(bad('spend',-1)),/nonnegative/);
  assert.throws(()=>model.validatePayload(bad('spend','100')),/number/);
  assert.throws(()=>model.validatePayload(bad('revenue',Infinity)),/finite/);
  assert.throws(()=>model.validatePayload(bad('clicks',999999)),/impressions/);
  assert.throws(()=>model.validatePayload(bad('conversions',1.5)),/integer/);
  assert.throws(()=>model.validatePayload(bad('channel','')),/channel/);
  const duplicate=payload();duplicate.intervals.push(duplicate.intervals[0]);assert.throws(()=>model.validatePayload(duplicate),/Duplicate/);
  assert.throws(()=>model.validatePayload(bad('timestamp',new Date(now+3600000).toISOString())),/newer/);
});
test('empty live data stays empty and stale data keeps its original timestamp',()=>{
  assert.deepEqual(model.validatePayload({...payload(),intervals:[]}).intervals,[]);
  const old=new Date(now-120000).toISOString();
  assert.equal(model.validatePayload({currency:'USD',updatedAt:old,intervals:[]}).updatedAt,old);
});
test('CSV quotes commas and escapes spreadsheet formulas',()=>{
  assert.equal(model.csv([['a,b','a"b','=SUM(A1)','normal']]),'\uFEFF"a,b","a""b","\'=SUM(A1)","normal"');
});
