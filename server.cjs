// Local static preview only. Uses Node.js built-ins and binds to loopback.
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const root=__dirname;
const port=Number(process.env.PORT||8765);
const allowed=new Set(['index.html','sales.html','marketing/styles.css','marketing/model.js','marketing/app.js','dashboard/styles.css','dashboard/data.js','dashboard/model.js','dashboard/app.js']);
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8'};
http.createServer((request,response)=>{
  if(!['GET','HEAD'].includes(request.method)){response.writeHead(405,{'Allow':'GET, HEAD'});response.end();return;}
  let pathname;try{pathname=decodeURIComponent(new URL(request.url,'http://localhost').pathname);}catch{response.writeHead(400);response.end('Invalid URL');return;}
  const file=pathname==='/'?'index.html':pathname.slice(1);
  if(!allowed.has(file)){response.writeHead(404);response.end('Not found');return;}
  fs.readFile(path.join(root,file),(error,content)=>{
    if(error){response.writeHead(404);response.end('Not found');return;}
    response.writeHead(200,{'Content-Type':types[path.extname(file)],'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
    response.end(request.method==='HEAD'?undefined:content);
  });
}).listen(port,'127.0.0.1',()=>console.log(`Flightpath preview: http://127.0.0.1:${port}`));
