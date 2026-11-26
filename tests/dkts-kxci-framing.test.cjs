'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),net=require('node:net'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {patchDesktopKxci,patchAndroidKxci}=require('../tools/dkts-kxci-framing.cjs');
const pinned=process.env.DKTS_DKDS_SOURCE;
test('derived Desktop TCP completes a split NUL frame without idle wait and rejects malformed replies',{skip:!pinned},async()=>{
 const src=fs.readFileSync(path.join(pinned,'desktop/main-modules/tcp-runtime.js'),'utf8');
 const module={exports:{}};
 vm.runInNewContext(patchDesktopKxci(src),{require,module,exports:module.exports,Buffer,setTimeout,clearTimeout});
 const tcp=module.exports.createTcpRuntime();
 const peers=new Set();
 const server=net.createServer(socket=>{peers.add(socket);socket.on('close',()=>peers.delete(socket));socket.on('error',()=>{});socket.on('data',data=>{
 const cmd=data.toString('ascii');
 if(cmd==='split\0'){socket.write('AC');setTimeout(()=>socket.write('K\0'),40);}
 else if(cmd==='extra\0')socket.write('ACK\0ACK\0');
 else if(cmd==='partial\0')socket.write('ACK');
 else if(cmd==='plain')socket.write('ordinary');
 });});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const open=()=>tcp.open({host:'127.0.0.1',port:server.address().port});
 const exchange=(s,c,framed=true)=>tcp.exchange({sessionId:s.sessionId,base64:Buffer.from(c).toString('base64'),readTimeoutMs:250,idleTimeoutMs:20,...(framed?{responseTerminator:'nul'}:{})});
 try{
  let s=await open(),start=Date.now();
  const r=await exchange(s,'split\0');
  assert.equal(Buffer.from(r.base64,'base64').toString(),'ACK\0');assert.ok(Date.now()-start<180); // split arrives after the configured generic idle gap
  await assert.rejects(exchange(s,'extra\0'),/extra bytes/);
  s=await open();await assert.rejects(exchange(s,'partial\0'),/timeout/i);
  s=await open();const plain=await exchange(s,'plain',false);assert.equal(Buffer.from(plain.base64,'base64').toString(),'ordinary');
 }finally{tcp.closeAll();for(const socket of peers)socket.destroy();await new Promise(resolve=>server.close(resolve));}
});
test('Android template includes deadline and complete-frame handling',{skip:!pinned},()=>{
 const src=fs.readFileSync(path.join(pinned,'mobile/plugins/DkdsLanTcp.template'),'utf8');
 const result=patchAndroidKxci(src);
 assert.match(result,/frameComplete=true/);assert.match(result,/System.nanoTime\(\)/);assert.match(result,/if\(framed && !frameComplete\)/);
});
