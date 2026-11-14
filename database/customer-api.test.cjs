const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');const os=require('node:os');const path=require('node:path');
const {spawn}=require('node:child_process');
test('local server serves database records and dashboard assets while protecting database files',async t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'flightpath-api-'));
  const child=spawn(process.execPath,['server.cjs'],{cwd:path.join(__dirname,'..'),env:{...process.env,PORT:'0',CUSTOMER_DB_PATH:path.join(dir,'test.sqlite')},stdio:['ignore','pipe','pipe']});
  t.after(async()=>{if(child.exitCode===null){child.kill();await new Promise(resolve=>child.once('exit',resolve));}fs.rmSync(dir,{recursive:true,force:true});});
  const port=await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(new Error('Server readiness timed out')),10000);let output='';
    child.stdout.on('data',chunk=>{output+=chunk;const match=output.match(/127\.0\.0\.1:(\d+)/);if(match){clearTimeout(timer);resolve(match[1]);}});
    child.once('error',e=>{clearTimeout(timer);reject(e);});child.once('exit',code=>{clearTimeout(timer);reject(new Error('Server exited '+code));});
  });
  const base='http://127.0.0.1:'+port;
  const response=await fetch(base+'/api/customers');assert.equal(response.status,200);assert.match(response.headers.get('content-type'),/application\/json/);
  const body=await response.json();assert.equal(body.meta.sampleData,true);assert.equal(body.organizations.length,9);assert.equal(body.followups.length,6);
  for(const asset of ['/','/sales.html','/dashboard/customers.js','/dashboard/customer-model.js','/marketing/app.js'])assert.equal((await fetch(base+asset)).status,200,asset);
  for(const file of ['/.local/customers.sqlite','/database/schema.sql','/database/customer-store.cjs','/.git/config'])assert.equal((await fetch(base+file)).status,404,file);
  assert.equal((await fetch(base+'/api/customers',{method:'POST'})).status,405);
  const head=await fetch(base+'/api/customers',{method:'HEAD'});assert.equal(head.status,200);assert.equal(await head.text(),'');
});
