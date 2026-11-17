const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {spawn}=require('node:child_process');
const {randomUUID}=require('node:crypto');
const {DatabaseSync}=require('node:sqlite');
const http=require('node:http');

// Native fetch rewrites Host, so use HTTP directly to exercise host rejection.
function rawRequest(url,options){return new Promise((resolve,reject)=>{
  const request=http.request(url,{method:options.method,headers:options.headers},response=>{
    const chunks=[];response.on('data',chunk=>chunks.push(chunk));
    response.on('end',()=>{const body=Buffer.concat(chunks).toString('utf8');resolve({status:response.statusCode,text:async()=>body,json:async()=>JSON.parse(body)});});
    response.on('error',reject);
  });
  request.on('error',reject);request.end(options.body);
});}

async function startServer(filename){
  const child=spawn(process.execPath,['server.cjs'],{
    cwd:path.join(__dirname,'..'),
    env:{...process.env,PORT:'0',CUSTOMER_DB_PATH:filename,CUSTOMER_DEMO_EXPANSION:'1'},
    stdio:['ignore','pipe','pipe']
  });
  let stderr='';child.stderr.on('data',chunk=>{stderr+=chunk;});
  try{
    const port=await new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>reject(new Error('Inquiry server readiness timed out: '+stderr)),10000);
      let output='';
      child.stdout.on('data',chunk=>{
        output+=chunk;
        const match=output.match(/127\.0\.0\.1:(\d+)/);
        if(match){clearTimeout(timer);resolve(match[1]);}
      });
      child.once('error',error=>{clearTimeout(timer);reject(error);});
      child.once('exit',code=>{clearTimeout(timer);reject(new Error('Inquiry server exited '+code+': '+stderr));});
    });
    return {base:'http://127.0.0.1:'+port,async stop(){
      if(child.exitCode===null&&child.signalCode===null){
        const exited=new Promise(resolve=>child.once('exit',resolve));
        child.kill();await exited;
      }
    }};
  }catch(error){child.kill();throw error;}
}
function inquiry(overrides={}){return {
  requestId:randomUUID(),name:'Alex Example',email:'alex@example.invalid',
  organization:'Example Flight Operations',buyerType:'direct',
  useCase:'Infrastructure inspection',timeline:'Exploring',
  message:'Please discuss a demonstration for our inspection workflow.',website:'',...overrides
};}

test('website inquiries are validated, private to the local inbox, idempotent and persistent',async t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'flightpath-inquiries-'));
  const filename=path.join(dir,'customers.sqlite');let server;
  t.after(async()=>{if(server)await server.stop();fs.rmSync(dir,{recursive:true,force:true});});
  server=await startServer(filename);
  const request=(payload,headers={})=>(headers.Host?rawRequest:fetch)(server.base+'/api/inquiries',{
    method:'POST',headers:{'Content-Type':'application/json','X-Website-Inquiry':'1',...headers},body:JSON.stringify(payload)
  });
  const readInbox=async()=>{
    const response=await fetch(server.base+'/api/inquiries');assert.equal(response.status,200);
    assert.match(response.headers.get('content-type'),/application\/json/);
    assert.equal(response.headers.get('access-control-allow-origin'),null);
    return response.json();
  };
  const crmBefore=await (await fetch(server.base+'/api/customers')).json();
  assert.deepEqual(await readInbox(),{inquiries:[]});
  const direct=inquiry();
  const military=inquiry({name:'Morgan Example',email:'morgan@example.invalid',organization:'Example Government Evaluation Office',buyerType:'military',useCase:'Government evaluation',timeline:'3–6 months',message:'Requesting a general procurement evaluation; no service branch classification supplied.'});
  let firstAck,militaryAck,savedInbox;

  await t.test('saves direct and generic military requests without disclosing or altering CRM records',async()=>{
    const response=await request(direct);assert.equal(response.status,201);
    firstAck=await response.json();assert.deepEqual(Object.keys(firstAck).sort(),['ok','reference']);
    assert.equal(firstAck.ok,true);assert.match(firstAck.reference,/^FP-[A-F0-9]{12}$/);
    const next=await request(military);assert.equal(next.status,201);militaryAck=await next.json();
    assert.notEqual(militaryAck.reference,firstAck.reference);
    savedInbox=await readInbox();assert.equal(savedInbox.inquiries.length,2);
    assert.deepEqual(savedInbox.inquiries.map(row=>row.reference),[militaryAck.reference,firstAck.reference]);
    for(const [index,submitted] of [military,direct].entries()){
      const record=savedInbox.inquiries[index];
      assert.deepEqual(Object.keys(record).sort(),['id','reference','createdAt','name','email','organization','buyerType','useCase','timeline','message'].sort());
      assert.ok(Number.isInteger(record.id));assert.equal(new Date(record.createdAt).toISOString(),record.createdAt);
      for(const key of ['name','email','organization','buyerType','useCase','timeline','message'])assert.equal(record[key],submitted[key]);
    }
    assert.deepEqual(await (await fetch(server.base+'/api/customers')).json(),crmBefore);
    const db=new DatabaseSync(filename);try{
      assert.equal(db.prepare('SELECT count(*) AS count FROM website_inquiries').get().count,2);
      assert.equal(db.prepare('SELECT count(*) AS count FROM organizations').get().count,crmBefore.organizations.length);
    }finally{db.close();}
  });

  await t.test('retries return the same reference and changed requests cannot reuse a token',async()=>{
    const retry=await request({...direct,name:'  '+direct.name+'  '});assert.equal(retry.status,201);assert.deepEqual(await retry.json(),firstAck);
    const conflict=await request({...direct,message:'A different request'});assert.equal(conflict.status,409);
    assert.match((await conflict.json()).error,/request ID/i);
    assert.deepEqual(await readInbox(),savedInbox);
  });

  await t.test('rejects malformed, missing, oversized, unsupported and cross-origin input',async()=>{
    const invalid=[null,[],false,'inquiry',
      ...['requestId','name','email','organization','buyerType','useCase','timeline'].map(key=>{const payload=inquiry();delete payload[key];return payload;}),
      inquiry({requestId:'not-a-uuid'}),inquiry({name:' '}),inquiry({name:'a'.repeat(101)}),
      inquiry({email:'invalid'}),inquiry({email:'a b@example.invalid'}),inquiry({email:'a'.repeat(255)}),
      inquiry({organization:'a'.repeat(161)}),inquiry({buyerType:'Civilian'}),
      inquiry({useCase:'Unknown'}),inquiry({timeline:'Tomorrow'}),inquiry({message:'a'.repeat(2001)}),
      inquiry({message:{text:'not a string'}}),inquiry({website:'https://spam.example.invalid'}),inquiry({website:[]}),
      inquiry({id:1}),inquiry({revision:0}),inquiry({status:'Qualified'}),inquiry({unexpected:'value'})
    ];
    for(const payload of invalid){const response=await request(payload);assert.equal(response.status,400,JSON.stringify(payload)?.slice(0,120));assert.deepEqual(Object.keys(await response.json()),['error']);}
    for(const headers of [
      {'X-Website-Inquiry':''},{Origin:'https://outside.example.invalid'},
      {'Sec-Fetch-Site':'cross-site'},{Host:'outside.example.invalid'}
    ])assert.equal((await request(inquiry(),headers)).status,403,JSON.stringify(headers));
    assert.equal((await request(inquiry(),{'Content-Type':'text/plain'})).status,415);
    const malformed=await fetch(server.base+'/api/inquiries',{method:'POST',headers:{'Content-Type':'application/json','X-Website-Inquiry':'1'},body:'{broken'});assert.equal(malformed.status,400);
    const oversized=await request(inquiry({message:'a'.repeat(270000)}));assert.equal(oversized.status,413);
    for(const method of ['GET','HEAD']){
      for(const headers of [{Origin:'http://outside.example.invalid'},{'Sec-Fetch-Site':'cross-site'},{Host:'outside.example.invalid'}]){
        const response=await (headers.Host?rawRequest:fetch)(server.base+'/api/inquiries',{method,headers});assert.equal(response.status,403,JSON.stringify(headers));
        if(method==='HEAD')assert.equal(await response.text(),'');
      }
    }
    for(const method of ['PUT','PATCH','DELETE','OPTIONS']){
      const response=await fetch(server.base+'/api/inquiries',{method});assert.equal(response.status,405);assert.equal(response.headers.get('allow'),'GET, HEAD, POST');
    }
    const head=await fetch(server.base+'/api/inquiries',{method:'HEAD'});assert.equal(head.status,200);assert.equal(await head.text(),'');
    const sameOrigin=await request(inquiry({message:undefined}),{Origin:server.base});assert.equal(sameOrigin.status,201);
    savedInbox=await readInbox();assert.equal(savedInbox.inquiries.length,3);assert.equal(savedInbox.inquiries[0].message,'');
    assert.deepEqual(await (await fetch(server.base+'/api/customers')).json(),crmBefore);
  });

  await t.test('persists requests and idempotency across server restarts',async()=>{
    await server.stop();server=await startServer(filename);
    assert.deepEqual(await readInbox(),savedInbox);
    const retry=await request(military);assert.equal(retry.status,201);assert.deepEqual(await retry.json(),militaryAck);
    assert.deepEqual(await readInbox(),savedInbox);
    assert.deepEqual(await (await fetch(server.base+'/api/customers')).json(),crmBefore);
  });

  await t.test('serves new website and preserved dashboard assets without exposing database files',async()=>{
    for(const asset of ['/','/index.html','/telemetry.html','/sales.html','/website/styles.css','/website/app.js','/dashboard/inquiries.js','/dashboard/discovery.js','/dashboard/customers.js','/dashboard/customer-editor.js','/marketing/app.js']){
      const response=await fetch(server.base+asset);assert.equal(response.status,200,asset);assert.ok((await response.text()).length>0,asset);
    }
    const svg=await fetch(server.base+'/website/drone.svg');assert.equal(svg.status,200);assert.equal(svg.headers.get('content-type'),'image/svg+xml');assert.match(await svg.text(),/<svg[\s>]/);
    for(const asset of ['/.local/customers.sqlite','/database/inquiry-store.cjs','/database/inquiry-api.test.cjs','/.git/config'])assert.equal((await fetch(server.base+asset)).status,404,asset);
  });
});
