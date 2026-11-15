const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const discovery=require('./discovery.js');
const {demoData}=require('../database/demo.cjs');
const {openStore}=require('../database/customer-store.cjs');

test('all seven target markets link only their member organizations, including multi-segment accounts once per market',()=>{
  const data=demoData();
  data.organizations[0].segments=['U.S. Air Force','Defense contractors'];
  const rows=discovery.select(data);
  assert.equal(rows.length,7);
  assert.deepEqual(rows.find(m=>m.id==='air-force').accounts.map(o=>o.id),[1]);
  assert.deepEqual(rows.find(m=>m.id==='defense').accounts.map(o=>o.id),[1,4]);
  assert.equal(rows.find(m=>m.id==='defense').customerType,'Civilian');
  assert.deepEqual(discovery.select(data,{sector:'Air Force'}).map(m=>m.id),['air-force','defense']);
  assert.deepEqual(discovery.select(data,{sector:'Civilian Commercial'}).find(m=>m.id==='defense').accounts.map(o=>o.id),[]);
});

test('search finds guidance, secondary contact details, company names and no-match states',()=>{
  const data=demoData();
  assert.deepEqual(discovery.select(data,{query:'  agriculture  '}).map(m=>m.id),['agriculture']);
  assert.deepEqual(discovery.select(data,{query:'sam.rivera@example.com'}).flatMap(m=>m.accounts.map(o=>o.id)),[1]);
  assert.deepEqual(discovery.select(data,{query:'Atlas Drone'}).map(m=>m.id),['manufacturers']);
  assert.deepEqual(discovery.select(data,{query:'no-such-customer'}),[]);
  assert.equal(discovery.select(null).length,7);
  assert.match(discovery.render(null,{},false),/Customer records unavailable/);
  assert.equal((discovery.render(null,{},false).match(/data-discovery-add="[^"]+" disabled/g)||[]).length,7);
});

test('market drafts save through the existing database and persist without invented customer facts',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'flightpath-discovery-'));
  const file=path.join(dir,'test.sqlite');let store;
  try{
    store=openStore(file);
    for(const market of discovery.markets){
      const draft=discovery.draft(market.id);
      assert.equal(draft.name,undefined);assert.equal(draft.budgetStatus,undefined);assert.equal(draft.needs,undefined);
      draft.interests.push('test');assert.ok(!discovery.draft(market.id).interests.includes('test'));
      const data=store.read();
      store.save(null,{revision:data.meta.revision,company:{...discovery.draft(market.id),name:'Sample '+market.id,segments:[market.segment]},contacts:[],opportunities:[],followups:[]});
    }
    store.close();store=openStore(file);
    const data=store.read(),added=data.organizations.filter(o=>o.name.startsWith('Sample '));
    assert.equal(added.length,7);
    for(const o of added){assert.equal(o.relationship,'Prospect');assert.equal(o.qualificationStatus,'New Lead');assert.ok(!o.budgetStatus);assert.ok(!o.needs);assert.equal(data.leads.filter(l=>l.organizationId===o.id).length,0);}
    assert.equal(discovery.draft('unknown'),null);
    assert.equal(discovery.draft('defense','Navy').sector,'Navy');
    assert.equal(discovery.draft('defense','Navy').customerType,'Civilian');
    assert.equal(discovery.draft('agriculture','Navy').sector,'Civilian Commercial');
  }finally{store?.close();fs.rmSync(dir,{recursive:true,force:true});}
});

test('customer-supplied HTML is escaped in discovery profiles',()=>{
  const data=demoData();data.organizations[0].name='<img src=x onerror=alert(1)>';
  const html=discovery.render(data,{},true);
  assert.ok(!html.includes('<img'));assert.ok(html.includes('&lt;img'));
});
