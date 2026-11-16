const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {spawn}=require('node:child_process');
const {openProspectStore}=require('./prospect-store.cjs');
const catalog=require('../dashboard/prospect-catalog.js');
const M=require('../dashboard/prospect-model.js');
const input=revision=>({revision,outreachStatus:'Researching',owner:'Team 1',lastContact:'',nextActionDate:'2026-12-01',notes:'Confirm an engineering contact.',dataIssue:false});
test('California records have dated evidence and public contacts; other states remain pending',()=>{
  const ca=catalog.filter(p=>p.state==='CA');assert.equal(ca.length,19);assert.equal(new Set(catalog.map(p=>p.key)).size,catalog.length);
  for(const p of ca){
    for(const k of ['activityEvidenceUrl','marketEvidenceUrl','locationSourceUrl','contactUrl'])assert.ok(new URL(p[k]).protocol.startsWith('http'));
    assert.equal(p.reviewedAt,'2026-11-15');assert.equal(p.contactCheckedAt,p.reviewedAt);assert.equal(p.buyingIntent,'Unknown');
    assert.equal((Date.parse(p.reviewDue)-Date.parse(p.reviewedAt))/86400000,90);
    assert.ok(p.locationNote&&p.marketNote&&p.fitHypothesis&&p.contactType);
  }
  assert.equal(catalog.filter(p=>!p.reviewedAt).length,15);
  assert.equal(ca.find(p=>p.key==='vantage-robotics').marketUse,'Both');
  assert.equal(ca.find(p=>p.key==='inspired-flight-technologies').marketUse,'Both');
});
test('verification expiry and issue flags do not turn unknowns into verified companies',()=>{
  const p=catalog[0];assert.equal(M.quality(p,'2026-11-15'),'Sources checked');
  assert.equal(M.quality(p,'2027-02-13'),'Recheck due');assert.equal(M.quality({...p,dataIssue:true},'2026-11-15'),'Needs recheck');
  assert.equal(M.quality(catalog.at(-1),'2026-11-15'),'Not rechecked');
  assert.ok(M.matches(p,'Public contact listed'));assert.equal(M.matches(catalog.at(-1),'Sources checked'),false);
  assert.match(M.csvCell(' =HYPERLINK("x")'),/^"'/);
});
test('research updates preserve outreach through restarts and conflict with stale forms',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'flightpath-prospects-')),file=path.join(dir,'prospects.sqlite');let store;
  try{
    store=openProspectStore(file,[catalog[0]]);const before=store.read().prospects[0];assert.equal(before.outreachStatus,'Not contacted');
    const saved=store.save(before.key,input(before.revision)).prospects[0];assert.equal(saved.revision,1);store.close();
    store=openProspectStore(file,[catalog[0]]);assert.deepEqual(store.read().prospects[0],saved);store.close();
    store=openProspectStore(file,[{...catalog[0],focus:'Updated sourced research'}]);const updated=store.read().prospects[0];
    assert.equal(updated.focus,'Updated sourced research');assert.equal(updated.notes,saved.notes);assert.equal(updated.revision,2);
    assert.throws(()=>store.save(updated.key,input(saved.revision)),e=>e.status===409);assert.deepEqual(store.read().prospects[0],updated);
  }finally{store?.close();fs.rmSync(dir,{recursive:true,force:true});}
});
test('invalid outreach and fabricated research fields cannot overwrite sourced records',()=>{
  const store=openProspectStore(':memory:',[catalog[0]]);try{
    const before=store.read(),key=catalog[0].key;
    const changes=[{outreachStatus:'Interested buyer'},{reviewedAt:'2026-11-15'},{contactEmail:'invented@example.com'},{lastContact:'2026-02-30'},{lastContact:'2099-01-01'},{outreachStatus:'Contacted'},{dataIssue:true},{owner:'x'.repeat(101)},{notes:'x'.repeat(2001)}];
    for(const change of changes){assert.throws(()=>store.save(key,{...input(0),...(change.dataIssue?{notes:''}:{}),...change}));assert.deepEqual(store.read(),before);}
    assert.throws(()=>store.save('unknown',input(0)),e=>e.status===404);
    const saved=store.save(key,{...input(0),dataIssue:true});assert.equal(M.quality(saved.prospects[0]),'Needs recheck');
    assert.equal(store.save(key,{...input(1),outreachStatus:'Do not contact'}).prospects[0].outreachStatus,'Do not contact');
  }finally{store.close();}
});
test('prospect API persists tracking, rejects cross-origin writes and preserves fictional CRM',async t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'flightpath-prospect-api-'));
  const child=spawn(process.execPath,['server.cjs'],{cwd:path.join(__dirname,'..'),env:{...process.env,PORT:'0',CUSTOMER_DB_PATH:path.join(dir,'crm.sqlite')},stdio:['ignore','pipe','pipe']});
  t.after(async()=>{if(child.exitCode===null){child.kill();await new Promise(r=>child.once('exit',r));}fs.rmSync(dir,{recursive:true,force:true});});
  const port=await new Promise((resolve,reject)=>{let out='';const timer=setTimeout(()=>reject(Error('Server readiness timeout')),10000);child.stdout.on('data',s=>{out+=s;const m=out.match(/127\.0\.0\.1:(\d+)/);if(m){clearTimeout(timer);resolve(m[1]);}});child.once('error',reject);child.once('exit',code=>{clearTimeout(timer);reject(Error('Server exited '+code));});});
  const base='http://127.0.0.1:'+port,read=async route=>(await fetch(base+route)).json();
  const crm=await read('/api/customers'),data=await read('/api/prospects'),p=data.prospects[0];assert.equal(data.prospects.length,34);
  const write=(body,headers={})=>fetch(base+'/api/prospects/'+p.key,{method:'PUT',headers:{'Content-Type':'application/json','X-Customer-Write':'1',...headers},body:JSON.stringify(body)});
  assert.equal((await write(input(p.revision),{Origin:'https://untrusted.example'})).status,403);
  assert.equal((await write(input(p.revision),{'Content-Type':'text/plain'})).status,415);
  assert.equal((await fetch(base+'/api/prospects/'+p.key,{method:'PUT'})).status,403);
  assert.equal((await fetch(base+'/api/prospects',{method:'POST'})).status,405);
  assert.equal((await write(input(p.revision))).status,200);assert.equal((await write(input(p.revision))).status,409);
  assert.equal((await read('/api/prospects')).prospects.find(x=>x.key===p.key).owner,'Team 1');assert.deepEqual(await read('/api/customers'),crm);
  for(const url of ['/dashboard/prospect-model.js','/dashboard/prospects.js'])assert.equal((await fetch(base+url)).status,200);
  assert.equal((await fetch(base+'/database/prospect-store.cjs')).status,404);
  assert.equal((await fetch(base+'/.local/customers.sqlite.prospects.sqlite')).status,404);
});
