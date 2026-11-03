'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'web/index.html'),'utf8');
const app=fs.readFileSync(path.join(root,'web/app.js'),'utf8');
const styles=fs.readFileSync(path.join(root,'web/styles.css'),'utf8');
test('test library is a distinct first-level screen, hidden when workbench is active',()=>{
  assert.match(html,/<section id="test-library" class="card types-card"/);
  assert.match(html,/<section id="test-detail" class="card test-detail" aria-hidden="true" hidden inert/);
  assert.match(html,/id="close-test-detail" class="detail-back" aria-label="返回测试方式选择"/);
  assert.doesNotMatch(html,/<section class="intro">/);
  assert.match(app,/\$\('test-library'\)\.hidden=active/);
  assert.match(app,/detail\.hidden=!active/);
  assert.match(app,/classList\.toggle\('workspace-active',active\)/);
  assert.match(app,/function returnToTestLibrary\(\)/);
  assert.match(styles,/#test-library\[hidden\],#test-detail\[hidden\]\{display:none!important\}/);
});
test('each card navigates to a dedicated workspace instead of expanding below the library',()=>{
  assert.equal((html.match(/class="test-type-card"/g)||[]).length,8);
  assert.equal((html.match(/data-test-kind="/g)||[]).length,8);
  assert.match(app,/expandedKind=kind;\s*renderTestSelection\(\)/);
  assert.doesNotMatch(app,/expandedKind=expandedKind===kind\?null:kind/);
  assert.doesNotMatch(html,/<select[^>]*name="kind"/);
  assert.match(html,/id="plan-form"/);
  assert.match(html,/id="waveform-editor" hidden/);
  assert.match(html,/id="pending-parameters" class="pending-parameters" hidden/);
  assert.match(styles,/\.detail-columns\{grid-template-columns:minmax\(250px,clamp\(270px,25vw,330px\)\) minmax\(0,1fr\)/);
  assert.match(styles,/@media\(max-width:850px\)\{/);
  assert.match(styles,/grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
});
test('workbench reserves real data surfaces without fabricated measurements',()=>{
  for(const name of ['measurement-plot','measurement-rows','readout-current','readout-voltage'])
    assert(html.includes('id="'+name+'"'));
  assert.match(html,/class="measure-button" disabled/);
  assert.match(html,/等待仪器返回原始数据/);
  assert.match(app,/The measured plot stays empty until the actual instrument acquisition layer/);
  assert.doesNotMatch(app,/post\('\/api\/output'/);
});

test('space-first workbench keeps a bottom status strip and allows hiding parameters',()=>{
  assert.doesNotMatch(html,/<header class="topbar">/);
  assert.doesNotMatch(html,/class="workspace-actions"/);
  assert.match(html,/id="app-statusbar" class="app-statusbar"/);
  assert.match(html,/id="toggle-parameters"/);
  assert.match(html,/id="detail-columns"/);
  assert.match(app,/classList\.toggle\('parameters-collapsed'\)/);
  assert.match(app,/\$\('parameters-panel'\)\.hidden=hidden/);
  assert.match(styles,/\.detail-columns\.parameters-collapsed\{grid-template-columns:minmax\(0,1fr\)\}/);
  assert.match(styles,/\.workspace,.workspace\.workspace-active\{position:relative;width:100%;max-width:none/);
  assert.match(styles,/\.data-panel\{display:flex;flex-direction:column/);
});
