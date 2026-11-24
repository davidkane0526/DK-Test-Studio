#!/usr/bin/env node
'use strict';
// Local-only static server for the genuine DKTS-derived DKDS Core renderer.
// It never proxies instrument commands or exposes a LAN listening socket.
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const {exec}=require('node:child_process');
const MIME=Object.freeze({
 '.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8',
 '.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8',
 '.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg',
 '.webp':'image/webp','.ico':'image/x-icon','.woff':'font/woff','.woff2':'font/woff2',
 '.ttf':'font/ttf','.otf':'font/otf','.wasm':'application/wasm','.zip':'application/zip',
 '.txt':'text/plain; charset=utf-8','.map':'application/json; charset=utf-8'
});
function resolveStaticFile(root,pathname){
 let decoded;
 try{decoded=decodeURIComponent(pathname);}catch{return null;}
 if(decoded.includes('\0')||decoded.includes('\\'))return null;
 const relative=decoded.replace(/^\/+/, '');
 const target=path.resolve(root,relative||'src/index.html');
 if(target!==root&&!target.startsWith(root+path.sep))return null;
 let resolved=target;
 try{
  const stat=fs.statSync(resolved);
  if(stat.isDirectory())resolved=path.join(resolved,'index.html');
  if(!fs.statSync(resolved).isFile())return null;
  const real=fs.realpathSync(resolved);
  if(real!==root&&!real.startsWith(root+path.sep))return null;
  return real;
 }catch{return null;}
}
function createServer(hostRoot,metadata={}){
 const root=fs.realpathSync(path.resolve(hostRoot));
 return http.createServer((req,res)=>{
  const url=new URL(req.url||'/', 'http://127.0.0.1');
  if(req.method!=='GET'&&req.method!=='HEAD'){
   res.writeHead(405,{'Content-Type':'text/plain; charset=utf-8','Allow':'GET, HEAD'});res.end('Method not allowed');return;
  }
  if(url.pathname==='/__preview_health'){
   const body=Buffer.from(JSON.stringify({ok:true,mode:'same-source-core-browser-preview',
    dktsVersion:metadata.dktsVersion||'',buildId:metadata.buildId||'',
    dkdsCommit:metadata.dkdsCommit||'',hardwareOutput:false}));
   res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',
    'Content-Length':body.length,'X-Content-Type-Options':'nosniff'});
   res.end(req.method==='HEAD'?undefined:body);return;
  }
  if(url.pathname==='/'){
   res.writeHead(302,{Location:'/src/index.html','Cache-Control':'no-store'});res.end();return;
  }
  const file=resolveStaticFile(root,url.pathname);
  if(!file){res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'});res.end('Not found');return;}
  let stat;try{stat=fs.statSync(file);}catch{res.writeHead(404);res.end();return;}
  res.writeHead(200,{'Content-Type':MIME[path.extname(file).toLowerCase()]||'application/octet-stream',
   'Content-Length':stat.size,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',
   'Referrer-Policy':'no-referrer'});
  if(req.method==='HEAD'){res.end();return;}
  const stream=fs.createReadStream(file);stream.on('error',()=>{if(!res.headersSent)res.writeHead(500);res.end();});stream.pipe(res);
 });
}
function start(){
 const hostRoot=path.resolve(process.argv[2]||path.join(__dirname,'host'));
 const port=Number(process.argv[3]||4173);
 if(!Number.isInteger(port)||port<1024||port>65535)throw Error('Port must be 1024–65535');
 const manifestPath=path.join(__dirname,'PREVIEW-MANIFEST.json');
 const manifest=fs.existsSync(manifestPath)?JSON.parse(fs.readFileSync(manifestPath,'utf8')):{};
 const metadata={...manifest,dktsVersion:manifest.dkts?.version||manifest.dktsVersion||'',
  buildId:manifest.dkts?.buildId||manifest.buildId||'',dkdsCommit:manifest.dkds?.commit||manifest.dkdsCommit||''};
 const server=createServer(hostRoot,metadata);
 server.on('error',error=>{console.error('Preview server error:',error.message);process.exitCode=1;});
 server.listen(port,'127.0.0.1',()=>{
  const url=`http://127.0.0.1:${port}/src/index.html`;
  console.log('DKTS Core same-source preview:',url);
  console.log('Host source:',hostRoot);
  console.log('DKTS:',metadata.dktsVersion||'unknown',metadata.buildId||'');
  console.log('DKDS pinned source:',metadata.dkdsCommit||'unknown');
  console.log('Instrument output: disabled. Browser fallback only.');
  if(process.platform==='win32')exec(`start "" "${url}"`);
  else if(process.platform==='darwin')exec(`open "${url}"`);
  else if(process.env.DISPLAY)exec(`xdg-open "${url}"`);
 });
 const stop=()=>server.close(()=>process.exit(0));
 process.once('SIGINT',stop);process.once('SIGTERM',stop);
}
if(require.main===module){try{start();}catch(error){console.error(error.stack||error.message);process.exitCode=1;}}
module.exports={createServer,resolveStaticFile};
