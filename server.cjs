// Local read-only sample CRM and static preview. Node.js 22.13+; loopback only.
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const {openStore}=require('./database/customer-store.cjs');
const store=openStore(process.env.CUSTOMER_DB_PATH||path.join(__dirname,'.local','customers.sqlite'));
const customerJson=()=>JSON.stringify(store.read());
const root=__dirname;
const port=Number(process.env.PORT||8765);
const allowed=new Set(['index.html','sales.html','marketing/styles.css','marketing/model.js','marketing/app.js','dashboard/styles.css','dashboard/data.js','dashboard/model.js','dashboard/app.js','dashboard/customer-model.js','dashboard/customers.js']);
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8'};
const server=http.createServer((request,response)=>{
  if(!['GET','HEAD'].includes(request.method)){response.writeHead(405,{'Allow':'GET, HEAD'});response.end();return;}
  let pathname;try{pathname=decodeURIComponent(new URL(request.url,'http://localhost').pathname);}catch{response.writeHead(400);response.end('Invalid URL');return;}
  if(pathname==='/api/customers'){
    try{const body=customerJson();response.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});response.end(request.method==='HEAD'?undefined:body);}
    catch(error){console.error('Customer database read failed:',error.message);response.writeHead(500,{'Content-Type':'application/json','Cache-Control':'no-store'});response.end(request.method==='HEAD'?undefined:JSON.stringify({error:'Customer database unavailable'}));}
    return;
  }
  const file=pathname==='/'?'index.html':pathname.slice(1);
  if(!allowed.has(file)){response.writeHead(404);response.end('Not found');return;}
  fs.readFile(path.join(root,file),(error,content)=>{
    if(error){response.writeHead(404);response.end('Not found');return;}
    response.writeHead(200,{'Content-Type':types[path.extname(file)],'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
    response.end(request.method==='HEAD'?undefined:content);
  });
}).listen(port,'127.0.0.1',()=>console.log(`Flightpath preview: http://127.0.0.1:${server.address().port}`));
