const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const model=require('./prospect-directory.js');
const catalog=require('../database/us-prospects.json');
const {openStore}=require('../database/customer-store.cjs');

test('California defaults, all-US coverage, military-market filters, and no-match research states',()=>{
  const rows=catalog.entries;
  assert.equal(model.select(rows).length,19);
  assert.equal(model.select(rows,{state:'all'}).length,rows.length);
  assert.ok(model.select(rows,{state:'all'}).slice(0,19).every(p=>p.state==='CA'));
  assert.ok(model.select(rows,{marketUse:'Military/defense'}).every(p=>p.state==='CA'&&p.marketUse==='Military/defense'));
  assert.equal(model.select(rows,{state:'CA',marketUse:'Both',query:'Skydio'})[0].name,'Skydio');
  assert.equal(model.select(rows,{state:'all',query:'Montana'}).length,2);
  assert.equal(model.select(rows,{state:'AK'}).length,0);
  const coverage=model.coverage(rows);assert.equal(coverage.length,50);assert.equal(coverage.filter(c=>c.count).length,9);
  assert.equal(coverage.reduce((n,c)=>n+c.count,0),rows.length);
});

test('every catalog row has primary evidence links, an explicit label, a unique key and a valid U.S. state',()=>{
  assert.equal(new Set(catalog.entries.map(p=>p.key)).size,catalog.entries.length);
  for(const p of catalog.entries){
    assert.ok(model.states[p.state]);assert.equal(p.country,'United States');assert.ok(model.uses.includes(p.marketUse));
    for(const url of [p.sourceUrl,p.locationSourceUrl])assert.equal(new URL(url).protocol,'https:');
    assert.match(p.researchDate,/^\d{4}-\d{2}-\d{2}$/);assert.ok(p.focus);assert.match(p.verification,/not verified/);
  }
  const html=model.render({prospectDirectory:[{...catalog.entries[0],name:'<img src=x onerror=alert(1)>',sourceUrl:'javascript:alert(1)'}]});
  assert.ok(!html.includes('<img'));assert.ok(!html.includes('href="javascript:'));assert.ok(html.includes('&lt;img'));
  assert.match(html,/not exhaustive/);assert.match(html,/not proof of zero military sales/);
});

test('customer dashboard renders public directory and tracked military labels alongside existing CRM panels',()=>{
  const store=openStore(':memory:');
  try{
    store.trackProspect('skydio',0);const data=store.read();
    const context={console,URL,AbortSignal,setTimeout,clearTimeout,fetch:async()=>({ok:true,json:async()=>data}),document:{getElementById:()=>({addEventListener(){}})},CustomerEditor:{init(){}}};
    vm.createContext(context);
    for(const name of ['customer-model.js','prospect-directory.js','customers.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,name),'utf8'),context);
    // Initialization loads data asynchronously. Return its refresh signal as a promise.
    return new Promise((resolve,reject)=>{
      context.loaded=()=>{try{
        if(!vm.runInContext('CustomerDashboard.isReady()',context))return;
        const html=vm.runInContext("CustomerDashboard.render({sector:'all',query:''})",context);
        assert.match(html,/Real companies to research/);assert.match(html,/19 in California/);assert.match(html,/Military or non-military/);
        assert.match(html,/View CRM profile/);assert.match(html,/data-customer-filter="militaryUse"/);assert.match(html,/Customer directory/);
        resolve();
      }catch(error){reject(error);}finally{if(vm.runInContext('CustomerDashboard.isReady()',context))store.close();}};
      vm.runInContext('CustomerDashboard.init(loaded)',context);
    });
  }catch(error){store.close();throw error;}
});
