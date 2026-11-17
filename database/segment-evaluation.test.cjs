const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');const os=require('node:os');const path=require('node:path');
const {spawn}=require('node:child_process');
const M=require('../dashboard/segment-strategy-model.js');
const catalog=require('../dashboard/prospect-catalog.js');
const {openEvaluationStore}=require('./segment-evaluation-store.cjs');
const prospect=M.candidates(catalog,null)[0];
const resolve=key=>key===prospect.key?prospect:null;
function input(revision=0,reviewer='Brandon'){
  return {revision,key:prospect.key,reviewer,compatibility:'Compatible',compatibilityNote:'Sample engineering review for test only.',nominated:true,reason:'Test nomination reason',nextStep:'Josh to confirm the pilot requirements.',criteria:Object.fromEntries(M.criteria.map((c,i)=>[c.key,{rating:[5,4,3,2,1][i],kind:'Public source',evidence:'Illustrative test evidence; not a real claim.',url:'https://example.com/test-evidence'}]))};
}
test('scores preserve unknowns, apply weights and show evidence completeness independently',()=>{
  const r=input();assert.equal(M.score(r).value,3.5);assert.equal(M.score(r).coverage,5);assert.equal(M.score(r).confirmed,0);
  r.criteria.fit.rating=null;assert.equal(M.score(r).value,null);assert.equal(M.score(r).coverage,4);
  r.criteria.fit.rating=5;r.criteria.fit.evidence='';assert.equal(M.score(r).coverage,4);
  r.compatibility='Incompatible';assert.equal(M.score(r).blocked,true);assert.equal(M.score(r).value,null);
  assert.equal(M.score(input(),[0,0,0,0,0]).value,null);assert.equal(M.score(input(),[0,0,0,0,1]).value,1);
});
test('segment metrics use distinct prospects per segment and keep catalog separate from CRM',()=>{
  const crm={organizations:[{id:1,name:'Demo',segment:'U.S. Navy',segments:['U.S. Navy','Defense contractors']}],leads:[]};
  const all=M.candidates(catalog,crm);assert.equal(all.length,catalog.length+1);assert.equal(all.at(-1).source,'CRM workspace (sample database)');
  const r=input(),j=input(0,'Josh');const m=M.metrics(all,[{...r,prospect},{...j,prospect}],'Defense contractors','Brandon');assert.equal(m.nominated,1);assert.equal(m.count,12);assert.equal(m.confirmedPain,0);
  const linked={organizations:[{...crm.organizations[0],publicProspect:{key:catalog[0].key}}],leads:[]};assert.equal(M.candidates(catalog,linked).length,catalog.length);
  assert.equal(M.candidates(catalog,crm).filter(p=>p.segments.includes('U.S. Navy')).length,1);
  assert.match(M.csvCell(' =HYPERLINK("x")'),/^"'/);assert.equal(M.csvCell('a,"b"'),'"a,""b"""');
});
test('workspace reviews persist and separate reviewers without touching CRM tables',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'flightpath-evaluation-'));let store;
  try{const file=path.join(dir,'reviews.sqlite');store=openEvaluationStore(file);let data=store.save(input(),resolve);assert.equal(data.revision,1);data=store.save(input(1,'Josh'),resolve);assert.equal(data.reviews.length,2);assert.ok(data.reviews.every(r=>r.updatedAt));store.close();store=openEvaluationStore(file);assert.deepEqual(store.read(),data);store.close();store=null;}finally{if(store)store.close();fs.rmSync(dir,{recursive:true,force:true});}
});
test('stale, unsupported and unsafe reviews roll back without losing nominations',()=>{
  const store=openEvaluationStore(':memory:');try{
    const before=store.save(input(),resolve);
    assert.throws(()=>store.save(input(),resolve),e=>e.status===409);
    const variants=[x=>x.reviewer='Someone',x=>x.criteria.fit.rating=6,x=>x.criteria.fit.evidence='',x=>x.criteria.fit.kind='Unverified',x=>x.criteria.fit.url='javascript:alert(1)',x=>x.criteria.fit.url='https://user:pass@example.com',x=>x.reason='',x=>x.nextStep='',x=>x.compatibility='Incompatible',x=>x.compatibilityNote=''];
    for(const change of variants){const bad=input(1);change(bad);assert.throws(()=>store.save(bad,resolve));assert.deepEqual(store.read(),before);}
    assert.throws(()=>store.save({...input(1),key:'missing'},resolve),e=>e.status===404);
    const blank=input(1);blank.nominated=false;blank.compatibility='Unknown';blank.compatibilityNote='';for(const c of Object.values(blank.criteria)){c.rating=null;c.evidence='';c.kind='Unverified';c.url='';}assert.equal(store.save(blank,resolve).reviews[0].nominated,false);
  }finally{store.close();}
});
test('classroom records cannot become confirmed conversations; public ratings require links',()=>{
  const store=openEvaluationStore(':memory:');try{
    const p={...prospect,source:'CRM workspace (sample database)'};const r=input();r.criteria.pain.kind='Customer conversation';assert.throws(()=>store.save(r,()=>p),/Classroom/);r.criteria.pain.kind='Classroom scenario';assert.equal(store.save(r,()=>p).revision,1);
    const bad=input(1);bad.criteria.fit.url='';assert.throws(()=>store.save(bad,resolve),/source link/);
  }finally{store.close();}
});
test('HTTP reviews share nominations and enforce revision, origin, headers and CRM preservation',async t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'flightpath-eval-api-'));const child=spawn(process.execPath,['server.cjs'],{cwd:path.join(__dirname,'..'),env:{...process.env,PORT:'0',CUSTOMER_DB_PATH:path.join(dir,'crm.sqlite'),EVALUATION_DB_PATH:path.join(dir,'reviews.sqlite')},stdio:['ignore','pipe','pipe']});
  t.after(async()=>{if(child.exitCode===null){child.kill();await new Promise(resolve=>child.once('exit',resolve));}fs.rmSync(dir,{recursive:true,force:true});});
  const port=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Readiness timeout')),10000);let output='';child.stdout.on('data',x=>{output+=x;const m=output.match(/127\.0\.0\.1:(\d+)/);if(m){clearTimeout(timer);resolve(m[1]);}});child.once('error',reject);child.once('exit',code=>{clearTimeout(timer);reject(Error('Server exited '+code));});});
  const base='http://127.0.0.1:'+port;const before=await(await fetch(base+'/api/customers')).json();
  for(const file of ['/segment-evaluation.html','/dashboard/segment-strategy.js','/dashboard/segment-strategy-model.js','/dashboard/prospect-catalog.js'])assert.equal((await fetch(base+file)).status,200);
  const write=(data,headers={})=>fetch(base+'/api/segment-reviews',{method:'PUT',headers:{'Content-Type':'application/json','X-Customer-Write':'1',...headers},body:JSON.stringify(data)});
  assert.equal((await fetch(base+'/api/segment-reviews',{method:'PUT'})).status,403);
  assert.equal((await write(input(),{Origin:'https://untrusted.example'})).status,403);
  assert.equal((await write(input(),{'Sec-Fetch-Site':'cross-site'})).status,403);
  assert.equal((await write(input(),{'Content-Type':'text/plain'})).status,415);
  const saved=await write(input());assert.equal(saved.status,200);assert.equal((await saved.json()).reviews.length,1);
  assert.equal((await write(input())).status,409);assert.equal((await write(input(1,'Josh'))).status,200);
  assert.equal((await(await fetch(base+'/api/segment-reviews')).json()).reviews.length,2);
  assert.equal((await fetch(base+'/api/segment-reviews',{method:'DELETE'})).status,405);
  assert.deepEqual(await(await fetch(base+'/api/customers')).json(),before);
  for(const file of ['/.local/customers.sqlite.evaluations.sqlite','/database/segment-evaluation-store.cjs'])assert.equal((await fetch(base+file)).status,404);
});

