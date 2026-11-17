const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const allowed = new Set(['index.html','styles.css','app.js','drone.svg']);
const types = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml'};
http.createServer((req,res) => {
  if (!['GET','HEAD'].includes(req.method)) {res.writeHead(405);res.end();return;}
  let pathname; try {pathname=new URL(req.url,'http://localhost').pathname;} catch {res.writeHead(400);res.end();return;}
  const file=pathname==='/'?'index.html':pathname.slice(1);
  if(!allowed.has(file)){res.writeHead(404);res.end('Not found');return;}
  fs.readFile(path.join(__dirname,file),(error,body)=>{
    if(error){res.writeHead(500);res.end('File unavailable');return;}
    res.writeHead(200,{'Content-Type':types[path.extname(file)],'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(req.method==='HEAD'?undefined:body);
  });
}).listen(Number(process.env.PORT||8768),'127.0.0.1',()=>console.log('Customer introduction: http://127.0.0.1:'+(process.env.PORT||8768)));
