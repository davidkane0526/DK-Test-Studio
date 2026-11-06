'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const text=p=>fs.readFileSync(path.join(root,p),'utf8');
function isolated(){
  const code=text('src/github-rate-limit.cjs');
  const module={exports:{}};
  vm.runInNewContext(code,{module,Date,Number,String,Math,Error,console}, {filename:'src/github-rate-limit.cjs'});
  return module.exports;
}
test('403 with exhausted GitHub quota backs off until x-ratelimit-reset',()=>{
  const api=isolated(),now=Date.UTC(2026,10,5,0);
  const headers={'x-ratelimit-remaining':'0','x-ratelimit-reset':String((now+45*60*1000)/1000)};
  const message=api.onHttpError(403,headers,now);
  assert.match(message,/请求限额/);
  assert.equal(api.state().blockedUntil,now+45*60*1000);
  assert.throws(()=>api.assertAllowed(now+10*60*1000),/暂停请求/);
  assert.doesNotThrow(()=>api.assertAllowed(now+46*60*1000));
});
test('429 Retry-After is respected, network 403 is diagnosed separately',()=>{
  const api=isolated(),now=Date.UTC(2026,10,5,0);
  assert.match(api.onHttpError(403,{},now),/权限或网络访问受限/);
  assert.equal(api.state().blockedUntil,now+5*60*1000);
  assert.match(api.onHttpError(429,{'retry-after':'900'},now),/请求限额/);
  assert.equal(api.state().blockedUntil,now+900*1000);
  assert.equal(api.onHttpError(404,{},now),'GitHub HTTP 404');
});
test('Windows and Android checks share per-platform rate gates and auto interval is hourly',()=>{
  const ui=text('src/ui-update.cjs');
  const windows=text('desktop/native-update.cjs');
  const androidUi=text('android/app/src/main/java/studio/dk/test/UiUpdateManager.java');
  const androidNative=text('android/app/src/main/java/studio/dk/test/NativeAppUpdateManager.java');
  const androidRate=text('android/app/src/main/java/studio/dk/test/GitHubRateLimit.java');
  assert.match(ui,/function start\(intervalMs=3600000\)/);
  assert.match(ui,/githubLimit\.assertAllowed\(\)/);
  assert.match(ui,/githubLimit\.onHttpError\(res\.status,res\.headers\)/);
  assert.match(windows,/githubLimit\.assertAllowed\(\)/);
  assert.match(windows,/githubLimit\.onHttpError\(response\.statusCode,response\.headers\)/);
  assert.match(androidUi,/main\.postDelayed\(this, 3600000L\)/);
  assert.match(androidUi,/GitHubRateLimit\.assertAllowed\(\)/);
  assert.match(androidUi,/GitHubRateLimit\.onHttpError\(c,code\)/);
  assert.match(androidNative,/GitHubRateLimit\.assertAllowed\(\)/);
  assert.match(androidNative,/GitHubRateLimit\.onHttpError\(c,status\)/);
  assert.match(androidRate,/X-RateLimit-Remaining/);
  assert.match(androidRate,/X-RateLimit-Reset/);
  assert.match(androidRate,/Retry-After/);
});
