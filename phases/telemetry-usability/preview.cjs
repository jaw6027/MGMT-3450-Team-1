// Separate local preview server; does not alter the existing application server.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const files = new Map([
  ['/', 'preview/index.html'], ['/usability.css', 'usability.css'], ['/usability.js', 'usability.js'], ['/trend-chart.js', 'trend-chart.js'],
  ['/preview-api.js', 'preview/preview-api.js'],
  ...['css/style.css', 'js/api.js', 'js/charts.js', 'js/drone-visual.js', 'js/dashboard.js'].map(file => ['/assets/'+file, 'preview/assets/'+file])
]);
const types = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8'};
const server = http.createServer((req,res) => {
  if (!['GET','HEAD'].includes(req.method)) { res.writeHead(405); res.end(); return; }
  let pathname; try { pathname = new URL(req.url,'http://127.0.0.1').pathname; } catch { res.writeHead(400);res.end();return; }
  const file = files.get(pathname);
  if (!file) {res.writeHead(404);res.end('Not found');return;}
  fs.readFile(path.join(__dirname,file), (error,body) => {
    if(error) {res.writeHead(500);res.end('Preview file unavailable');return;}
    res.writeHead(200,{'Content-Type':types[path.extname(file)],'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(req.method === 'HEAD' ? undefined : body);
  });
}).listen(Number(process.env.PORT || 8767),'127.0.0.1',()=>console.log('Usability phase: http://127.0.0.1:'+server.address().port));
