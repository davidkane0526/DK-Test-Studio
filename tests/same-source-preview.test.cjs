'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {createServer,resolveStaticFile}=require('../tools/preview-server.cjs');
const root=path.resolve(__dirname,'..');

test('same-source preview is pinned to the genuine DKDS Core and current DKTS plugin',()=>{
 const build=fs.readFileSync(path.join(root,'tools/build-same-source-preview.cjs'),'utf8');
 const manifest=JSON.parse(fs.readFileSync(path.join(root,'integrations/dkds-native/plugin.json'),'utf8'));
 assert.match(build,/20f056851a61d2144e9524c3ed568628d4b8557c/);
 assert.match(build,/dk-data-studio/);
 assert.match(build,/dkts-4200a/);
 assert.match(build,/d3Version:'7\.9\.0',d3Bundled:true,npmInstallRequired:false/);
 assert.match(build,/d3Source/);
 assert.match(build,/Node\.js 20 or newer/);
 assert.doesNotMatch(build,/npm install --omit=dev/,'the preview must not require first-launch npm installation');
 assert.match(build,/hp\.dependencies=\{\};hp\.devDependencies=\{\}/);
 assert.match(build,/package-lock\.json/);
 assert.doesNotMatch(build,/dktsDesktopPreview/);
 assert.equal(manifest.version,'0.8.35');
 assert.doesNotMatch(build,/electron-builder|assembleRelease|gradlew/,
  'preview packaging must not compile native EXE/APK packages');
});


test('same-source manifest digest excludes generated Android assets but includes tracked source',()=>{
 const {treeDigest}=require('../tools/build-same-source-preview.cjs');
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'dkts-source-digest-'));
 try{
  fs.writeFileSync(path.join(tmp,'README.md'),'source-a');
  const generated=path.join(tmp,'android/app/src/main/assets');
  fs.mkdirSync(generated,{recursive:true});
  fs.writeFileSync(path.join(generated,'index.html'),'generated-a');
  const mipmap=path.join(tmp,'android/app/src/main/res/mipmap-hdpi');
  fs.mkdirSync(mipmap,{recursive:true});
  fs.writeFileSync(path.join(mipmap,'ic_launcher.png'),'generated-icon-a');
  fs.writeFileSync(path.join(tmp,'ignored.log'),'log-a');
  const first=treeDigest(tmp);
  fs.writeFileSync(path.join(generated,'index.html'),'generated-b');
  fs.writeFileSync(path.join(mipmap,'ic_launcher.png'),'generated-icon-b');
  fs.writeFileSync(path.join(tmp,'ignored.log'),'log-b');
  assert.equal(treeDigest(tmp),first,'ignored generated WebView assets and logs do not alter source identity');
  fs.writeFileSync(path.join(tmp,'README.md'),'source-b');
  assert.notEqual(treeDigest(tmp),first,'tracked source changes alter source identity');
 }finally{fs.rmSync(tmp,{recursive:true,force:true});}
});

test('preview server binds to a caller-owned host root and blocks traversal',t=>{
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'dkts-preview-'));
 fs.mkdirSync(path.join(tmp,'src'),{recursive:true});
 fs.writeFileSync(path.join(tmp,'src','index.html'),'<h1>same source</h1>');
 fs.writeFileSync(path.join(tmp,'secret.txt'),'not served');
 assert.equal(path.basename(resolveStaticFile(tmp,'/src/index.html')),'index.html');
 assert.equal(resolveStaticFile(tmp,'/%2e%2e/secret.txt'),null);
 assert.equal(resolveStaticFile(tmp,'/..%2fsecret.txt'),null);
 const server=createServer(tmp,{dktsVersion:'0.3.32',buildId:'a212',dkdsCommit:'20f0568'});
 t.after(()=>{server.close();fs.rmSync(tmp,{recursive:true,force:true});});
 return new Promise((resolve,reject)=>{
  server.once('error',reject);
  server.listen(0,'127.0.0.1',async()=>{
   try{
    const base=`http://127.0.0.1:${server.address().port}`;
    const rootResponse=await fetch(base+'/',{redirect:'manual'});
    assert.equal(rootResponse.status,302);
    assert.equal(rootResponse.headers.get('location'),'/src/index.html');
    const page=await fetch(base+'/src/index.html');
    assert.equal(page.status,200);assert.match(await page.text(),/same source/);
    const health=await fetch(base+'/__preview_health');
    assert.deepEqual(await health.json(),{ok:true,mode:'same-source-core-browser-preview',
     dktsVersion:'0.3.32',buildId:'a212',dkdsCommit:'20f0568',hardwareOutput:false});
    const missing=await fetch(base+'/missing.txt');
    assert.equal(missing.status,404);
    resolve();
   }catch(error){reject(error);}
  });
 });
});
