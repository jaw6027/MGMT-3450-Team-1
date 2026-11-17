// Local sample CRM and static preview. Node.js 22.13+; loopback only.
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const {openStore}=require('./database/customer-store.cjs');
const {openInquiryStore}=require('./database/inquiry-store.cjs');
const {fail}=require('./database/customer-input.cjs');
const databasePath=process.env.CUSTOMER_DB_PATH||path.join(__dirname,'.local','customers.sqlite');
const store=openStore(databasePath,{expandDemo:process.env.CUSTOMER_DEMO_EXPANSION!=='0'});
const inquiries=openInquiryStore(databasePath);
const {openEvaluationStore}=require('./database/segment-evaluation-store.cjs');
const strategy=require('./dashboard/segment-strategy-model.js');
const catalog=require('./dashboard/prospect-catalog.js');
const evaluations=openEvaluationStore(process.env.EVALUATION_DB_PATH||((process.env.CUSTOMER_DB_PATH||path.join(__dirname,'.local','customers.sqlite'))+'.evaluations.sqlite'));
const {openProspectStore}=require('./database/prospect-store.cjs');
const prospects=openProspectStore(process.env.PROSPECT_DB_PATH||((process.env.CUSTOMER_DB_PATH||path.join(__dirname,'.local','customers.sqlite'))+'.prospects.sqlite'),catalog);
const root=__dirname;
const port=Number(process.env.PORT||8765);
const allowed=new Set(['index.html','telemetry.html','website/styles.css','website/app.js','website/drone.svg','dashboard/inquiries.js','sales.html','segment-evaluation.html','dashboard/prospect-model.js','dashboard/prospects.js','dashboard/prospect-catalog.js','dashboard/segment-strategy-model.js','dashboard/segment-strategy.js','marketing/styles.css','marketing/model.js','marketing/app.js','dashboard/styles.css','dashboard/data.js','dashboard/model.js','dashboard/app.js','dashboard/discovery.js','dashboard/customer-model.js','dashboard/customers.js','dashboard/customer-editor.js']);
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml'};
function json(response,status,body,head=false){response.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});response.end(head?undefined:JSON.stringify(body));}
async function readBody(request){
  if(request.headers['content-type']?.split(';')[0].trim()!=='application/json')fail('Send JSON data.',415);
  if(Number(request.headers['content-length'])>256*1024)fail('Customer form is too large.',413);
  const chunks=[];let size=0;
  for await(const chunk of request){size+=chunk.length;if(size>256*1024)fail('Customer form is too large.',413);chunks.push(chunk);}
  try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{fail('Invalid JSON request.');}
}
const server=http.createServer(async(request,response)=>{
  let pathname;try{pathname=decodeURIComponent(new URL(request.url,'http://localhost').pathname);}catch{response.writeHead(400);response.end('Invalid URL');return;}
  const prospectRoute=pathname==='/api/prospects',prospectRecord=pathname.match(/^\/api\/prospects\/([a-z0-9-]+)$/);
  const evaluationRoute=pathname==='/api/segment-reviews';
  if(pathname==='/api/inquiries'){
    const methods=['GET','HEAD','POST'];
    if(!methods.includes(request.method)){response.setHeader('Allow',methods.join(', '));json(response,405,{error:'Method not allowed'});return;}
    try{
      const host=request.headers.host;
      if(!host||!new Set([`127.0.0.1:${server.address().port}`,`localhost:${server.address().port}`]).has(host))fail('Invalid local host.',403);
      if(request.headers.origin&&request.headers.origin!==`http://${host}`)fail('Cross-origin requests are not allowed.',403);
      if(request.headers['sec-fetch-site']==='cross-site')fail('Cross-site requests are not allowed.',403);
      if(request.method==='POST'){
        if(request.headers['x-website-inquiry']!=='1')fail('Use the website inquiry form to submit a request.',403);
        const result=inquiries.save(await readBody(request));
        json(response,201,result);
      }else json(response,200,{inquiries:inquiries.read()},request.method==='HEAD');
    }catch(error){
      if(!error.status)console.error('Website inquiry operation failed:',error.message);
      json(response,error.status||500,{error:error.status?error.message:'The inquiry could not be saved. Try again later.'},request.method==='HEAD');
    }
    return;
  }
  const customerRoute=pathname==='/api/customers',recordRoute=pathname.match(/^\/api\/customers\/([1-9]\d*)$/);
  if(customerRoute||recordRoute||evaluationRoute||prospectRoute||prospectRecord){
    const methods=prospectRoute?['GET','HEAD']:prospectRecord?['PUT']:evaluationRoute?['GET','HEAD','PUT']:customerRoute?['GET','HEAD','POST']:['PUT','DELETE'];
    if(!methods.includes(request.method)){response.setHeader('Allow',methods.join(', '));json(response,405,{error:'Method not allowed'});return;}
    try{
      if(['GET','HEAD'].includes(request.method)){json(response,200,(prospectRoute?prospects.read():evaluationRoute?evaluations.read():store.read()),request.method==='HEAD');return;}
      // Writes are same-origin JSON requests from the local dashboard. No CORS grants.
      const host=request.headers.host;
      if(!host||!new Set([`127.0.0.1:${server.address().port}`,`localhost:${server.address().port}`]).has(host))fail('Invalid local host.',403);
      if(request.headers.origin&&request.headers.origin!==`http://${host}`)fail('Cross-origin changes are not allowed.',403);
      if(request.headers['sec-fetch-site']==='cross-site'||request.headers['x-customer-write']!=='1')fail('Use the customer dashboard to make changes.',403);
      const payload=await readBody(request),id=recordRoute?Number(recordRoute[1]):null;
      if(!payload||typeof payload!=='object'||Array.isArray(payload))fail('Send a valid customer object.');
      if(recordRoute&&!Number.isSafeInteger(id))fail('Invalid customer ID.');
      if(prospectRecord){json(response,200,prospects.save(prospectRecord[1],payload));return;}
      if(evaluationRoute){
        const result=evaluations.save(payload,key=>strategy.candidates(prospects.read().prospects,store.read()).find(p=>p.key===key));
        json(response,200,result);return;
      }
      if(request.method==='DELETE')store.remove(id,payload.revision);
      else store.save(id,payload);
      json(response,request.method==='POST'?201:200,store.read());
    }catch(error){
      if(!error.status)console.error('Customer database operation failed:',error.message);
      json(response,error.status||500,{error:error.status?error.message:'Customer database unavailable. Your change could not be saved.'});
    }
    return;
  }
  if(!['GET','HEAD'].includes(request.method)){response.writeHead(405,{'Allow':'GET, HEAD'});response.end();return;}
  const file=pathname==='/'?'index.html':pathname.slice(1);
  if(!allowed.has(file)){response.writeHead(404);response.end('Not found');return;}
  fs.readFile(path.join(root,file),(error,content)=>{
    if(error){response.writeHead(404);response.end('Not found');return;}
    response.writeHead(200,{'Content-Type':types[path.extname(file)],'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
    response.end(request.method==='HEAD'?undefined:content);
  });
}).listen(port,'127.0.0.1',()=>console.log(`Flightpath preview: http://127.0.0.1:${server.address().port}`));
