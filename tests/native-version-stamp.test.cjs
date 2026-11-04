'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const source=path.resolve(__dirname,'..');
function fixture(){
  const folder=fs.mkdtempSync(path.join(os.tmpdir(),'dkts-native-version-'));
  for(const name of ['tools/stamp-native-version.cjs','package.json','android/app/build.gradle','web/index.html']){
    const file=path.join(folder,name);
    fs.mkdirSync(path.dirname(file),{recursive:true});
    fs.copyFileSync(path.join(source,name),file);
  }
  return folder;
}
function stamp(folder,platform,run){
  execFileSync(process.execPath,[path.join(folder,'tools/stamp-native-version.cjs'),platform],{
    env:{...process.env,GITHUB_RUN_NUMBER:String(run)},stdio:'pipe'
  });
}
test('both native platforms get identical run versions and Android monotonically increasing codes',()=>{
  const a=fixture(),b=fixture();
  try{
    stamp(a,'windows',123);
    stamp(b,'android',123);
    const win=JSON.parse(fs.readFileSync(path.join(a,'package.json'),'utf8'));
    const gradle=fs.readFileSync(path.join(b,'android/app/build.gradle'),'utf8');
    const match=gradle.match(/versionName '([^']+)'/);
    assert.equal(win.version,match[1]);
    assert.match(gradle,/versionCode 100123\b/);
    assert.match(fs.readFileSync(path.join(a,'web/index.html'),'utf8'),/v0\.3\.1123<\/button>/);
    assert.match(fs.readFileSync(path.join(b,'web/index.html'),'utf8'),/v0\.3\.1123<\/button>/);
  }finally{
    fs.rmSync(a,{recursive:true,force:true});
    fs.rmSync(b,{recursive:true,force:true});
  }
});
test('native version stamper rejects invalid or missing workflow run numbers',()=>{
  const f=fixture();
  try{
    assert.throws(()=>stamp(f,'windows',0));
    assert.throws(()=>stamp(f,'android','not-a-number'));
  }finally{fs.rmSync(f,{recursive:true,force:true});}
});
