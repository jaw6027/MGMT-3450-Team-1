const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {spawn}=require('node:child_process');
const {openStore}=require('./customer-store.cjs');
const pipeline=require('../dashboard/pipeline-model.js');
const customers=require('../dashboard/customer-model.js');
const dashboard=require('../dashboard/model.js');

test('pipeline stage and opportunity follow-up persist through HTTP reads and database restart; counts update',async t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'flightpath-pipeline-')),filename=path.join(dir,'customers.sqlite');
  const child=spawn(process.execPath,['server.cjs'],{cwd:path.join(__dirname,'..'),env:{...process.env,PORT:'0',CUSTOMER_DB_PATH:filename},stdio:['ignore','pipe','pipe']});
  t.after(async()=>{if(child.exitCode===null&&child.signalCode===null){child.kill();await new Promise(resolve=>child.once('exit',resolve));}fs.rmSync(dir,{recursive:true,force:true});});
  const port=await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(new Error('Readiness timeout')),10000);let text='';
    child.stdout.on('data',chunk=>{text+=chunk;const match=text.match(/127\.0\.0\.1:(\d+)/);if(match){clearTimeout(timer);resolve(match[1]);}});
    child.once('error',reject);child.once('exit',code=>{clearTimeout(timer);reject(new Error('Server exited '+code));});
  });
  const base=`http://127.0.0.1:${port}`;
  const read=async()=>await (await fetch(base+'/api/customers')).json();
  const before=await read(),deal=before.opportunities.find(p=>pipeline.open(p));
  const organization=before.organizations.find(o=>o.id===deal.organizationId);
  const body={revision:before.meta.revision,company:organization,opportunities:[{...deal,stage:'Closed Won',outcomeReason:'Pilot accepted by the customer',owner:'Janice',nextAction:'Arrange handover',followupDate:'2020-01-01'}]};
  const write=(payload,extra={})=>fetch(base+'/api/customers/'+organization.id,{method:'PUT',headers:{'Content-Type':'application/json','X-Customer-Write':'1',...extra},body:JSON.stringify(payload)});
  assert.equal((await write(body,{Origin:'https://untrusted.example'})).status,403);
  assert.equal((await write({...body,opportunities:[{...body.opportunities[0],followupDate:'2026-02-30'}]})).status,400);
  assert.equal((await write({...body,opportunities:[{...body.opportunities[0],outcomeReason:''}]})).status,400);
  const response=await write(body);assert.equal(response.status,200);
  const saved=await response.json(),refreshed=await read();assert.deepEqual(refreshed,saved);
  const updated=refreshed.opportunities.find(p=>p.id===deal.id);
  assert.equal(updated.stage,'Closed Won');assert.equal(updated.owner,'Janice');assert.equal(updated.nextAction,'Arrange handover');assert.equal(updated.followupDate,'2020-01-01');
  assert.equal(pipeline.overdue(updated,'2026-11-18'),false);
  assert.equal(customers.summary(refreshed).active,customers.summary(before).active-1);
  assert.equal(dashboard.metrics(dashboard.select(refreshed)).openCount,dashboard.metrics(dashboard.select(before)).openCount-1);
  assert.equal(pipeline.counts(refreshed.opportunities).find(s=>s.stage==='Closed Won').count,pipeline.counts(before.opportunities).find(s=>s.stage==='Closed Won').count+1);
  assert.deepEqual(refreshed.opportunities.filter(p=>p.id!==deal.id),before.opportunities.filter(p=>p.id!==deal.id));
  for(const key of ['organizations','leads','followups','notes','engagements'])assert.deepEqual(refreshed[key],before[key]);
  assert.equal((await write(body)).status,409);
  child.kill();await new Promise(resolve=>child.once('exit',resolve));
  const reopened=openStore(filename);assert.deepEqual(reopened.read(),refreshed);reopened.close();
});

test('seven stages, UTC overdue boundary, closed exclusions and searchable opportunity context',()=>{
  assert.equal(pipeline.stages.length,7);
  for(const stage of pipeline.stages){
    const deal={stage,followupDate:'2026-11-17'};
    assert.equal(pipeline.overdue(deal,'2026-11-18'),!stage.startsWith('Closed'));
    assert.equal(customers.open(deal),pipeline.open(deal));assert.equal(dashboard.open(deal),pipeline.open(deal));
  }
  for(const followupDate of [null,'','2026-11-18','2026-11-19'])assert.equal(pipeline.overdue({stage:'New Lead',followupDate},'2026-11-18'),false);
  assert.equal(pipeline.stage({stage:'Evaluation'}),'Pilot Evaluation');
  assert.equal(pipeline.open({stage:'Cancelled'}),false);
  const data={organizations:[{id:1,name:'Sample',sector:'Civilian Commercial',segments:['Agriculture']}],opportunities:[{id:1,organizationId:1,name:'Pilot',stage:'Contacted',owner:'Janice',nextAction:'Discuss fleet',followupDate:'2026-11-19'}]};
  assert.equal(pipeline.select(data,{query:'agriculture Janice fleet'}).length,1);
  assert.equal(pipeline.select(data,{sector:'Navy'}).length,0);
});
