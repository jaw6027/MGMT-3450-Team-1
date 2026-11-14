const test = require('node:test');
const assert = require('node:assert/strict');
const data = require('./data.js');
const model = require('./model.js');

test('open pipeline excludes awarded and lost deals and weights individual probabilities',()=>{
  const result=model.metrics(model.select(data));
  assert.equal(result.pipeline,4400000);
  assert.equal(result.openCount,6);
  assert.equal(result.weighted,2244500);
  assert.equal(result.qualified,4);
  assert.equal(result.activeCampaigns,2);
});
test('sector filters constrain accounts, opportunities, leads and engagements',()=>{
  const result=model.select(data,'Navy');
  assert.equal(result.opportunities.length,2);
  assert.equal(result.leads.length,2);
  assert.equal(model.metrics(result).pipeline,2210000);
  assert.ok(result.organizations.every(o=>o.sector==='Navy'));
  assert.ok(result.engagements.every(e=>[2,6].includes(e.organizationId)));
  assert.ok(result.campaigns.every(c=>c.sectors.includes('Navy')));
});
test('search is case-insensitive and matches contacts to account opportunities',()=>{
  assert.equal(model.select(data,'all','  RILEY  ').leads.length,1);
  assert.equal(model.select(data,'all','  RILEY  ').opportunities.length,2);
  assert.equal(model.select(data,'all','fleet inspection').opportunities.length,1);
  assert.equal(model.select(data,'Navy','Riley').opportunities.length,0);
});
test('empty filters return zero metrics without invalid totals',()=>{
  assert.deepEqual(model.metrics(model.select(data,'all','no-such-account')),{pipeline:0,weighted:0,openCount:0,qualified:0,activeCampaigns:0});
});
test('every record references existing accounts and campaign contacts',()=>{
  const orgIds=new Set(data.organizations.map(o=>o.id)),leadIds=new Set(data.leads.map(l=>l.id));
  for(const item of [...data.leads,...data.opportunities,...data.engagements])assert.ok(orgIds.has(item.organizationId));
  for(const c of data.campaigns)for(const id of c.leadIds)assert.ok(leadIds.has(id));
  for(const e of data.engagements)assert.equal(data.leads.find(l=>l.id===e.leadId).organizationId,e.organizationId);
});
test('CSV quotes delimiters and neutralizes spreadsheet formula prefixes',()=>{
  const result=model.csv([['a,b','a"b','=SUM(A1)','normal']]);
  assert.equal(result,'\uFEFF"a,b","a""b","\'=SUM(A1)","normal"');
});

test('editable delivery stage is excluded from legacy pipeline forecasts',()=>{
  const custom=structuredClone(data);custom.opportunities[0].stage='Delivery';
  const result=model.metrics(model.select(custom));assert.equal(result.pipeline,3560000);assert.equal(result.openCount,5);
});

test('legacy sales views preserve unknown values and probabilities while accepting known zero',()=>{
 const copy=structuredClone(data);copy.opportunities=copy.opportunities.slice(0,1);copy.opportunities[0].value=null;copy.opportunities[0].probability=null;let result=model.metrics(model.select(copy));assert.equal(result.pipeline,null);assert.equal(result.weighted,null);
 copy.opportunities[0].value=0;copy.opportunities[0].probability=0;result=model.metrics(model.select(copy));assert.equal(result.pipeline,0);assert.equal(result.weighted,0);
});
