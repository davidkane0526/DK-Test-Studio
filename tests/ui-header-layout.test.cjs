'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'web/index.html'),'utf8');
const app=fs.readFileSync(path.join(root,'web/app.js'),'utf8');
const css=fs.readFileSync(path.join(root,'web/styles.css'),'utf8');
test('both version badges are keyboard accessible and long press reveals full identities',()=>{
  for(const id of ['native-version-badge','ui-version-badge']){
    assert.match(html,new RegExp('id="'+id+'"[^>]*role="button" tabindex="0"'));
  }
  assert.match(app,/function makeVersionBadgeControl\(id\)/);
  assert.match(app,/badge\.addEventListener\('pointerdown'/);
  assert.match(app,/pointerup','pointercancel','pointerleave'/);
  assert.match(app,/event\.key==='Enter'\|\|event\.key===' '/);
  assert.match(app,/raw\.slice\(0,4\)/);
  assert.match(app,/raw\.slice\(0,8\)/);
  assert.match(css,/content:attr\(data-version-detail\)/);
});
test('controls are in top workbench heading and the expand control stays right in data header',()=>{
  const heading=html.slice(html.indexOf('<div class="detail-heading">'),html.indexOf('<div id="detail-columns"'));
  const dataHeader=html.slice(html.indexOf('<section class="detail-panel data-panel"'),html.indexOf('<div class="readout-grid"'));
  for(const id of ['start-measurement','pause-measurement','stop-measurement'])
    assert.match(heading,new RegExp('id="'+id+'"[^>]*disabled'));
  assert.match(heading,/id="acquisition-state"/);
  assert.doesNotMatch(dataHeader,/id="acquisition-state"/);
  assert.doesNotMatch(dataHeader,/id="start-measurement"/);
  assert.match(dataHeader,/class="data-panel-actions"[\s\S]*id="restore-parameters"/);
  assert(dataHeader.indexOf('id="restore-parameters"')>dataHeader.indexOf('id="data-title"'));
  assert.equal((html.match(/id="restore-parameters"/g)||[]).length,1);
  assert.match(app,/restore\.hidden=!collapsed/);
  assert.match(css,/\.detail-heading\{\s*padding-right:0/);
});
test('Android titlebar gets its own inset; no desktop titlebar left change',()=>{
  assert.match(css,/body\.dkts-android-shell \.app-titlebar\{\s*padding-left:calc\(clamp\(8px,1vw,18px\) \+ 19px \+ var\(--dkts-safe-left\)\)/);
  assert.match(css,/padding-left:calc\(18px \+ var\(--dkts-safe-left\)\)/);
  assert.match(css,/\.app-titlebar\{\s*position:fixed;top:0;left:0;right:0/);
});
test('native versions progress without changing fixed signing identity',()=>{
  const gradle=fs.readFileSync(path.join(root,'android/app/build.gradle'),'utf8');
  assert.match(gradle,/versionCode 6/);
  assert.match(gradle,/versionName '0\.2\.5'/);
  assert.equal(require('../package.json').version,'0.2.5');
  assert.match(html,/v0\.2\.5/);
});
