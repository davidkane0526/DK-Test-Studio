'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'web/index.html'),'utf8');
const app=fs.readFileSync(path.join(root,'web/app.js'),'utf8');
const styles=fs.readFileSync(path.join(root,'web/styles.css'),'utf8');

test('test library remains a distinct first-level screen with workspace navigation',()=>{
  assert.match(html,/<section id="test-library" class="card types-card"/);
  assert.doesNotMatch(html,/DK TEST STUDIO · 4200A/);
  assert.doesNotMatch(html,/点击卡片进入测试工作区/);
  assert.match(html,/id="workspace-tabs" class="workspace-tabs" role="tablist" aria-label="已打开的工作区"/);
  assert.match(html,/id="tab-home" class="workspace-tab-add" aria-label="新建工作区"/);
  assert.match(html,/class="titlebar-version-divider"/);
  assert.match(html,/id="workspace-context-label"/);
  assert.match(app,/function renderWorkspaceTabs\(\)/);
  assert.match(app,/function createWorkspaceTab\(\)/);
  assert.match(html,/<section id="test-detail" class="card test-detail" aria-hidden="true" hidden inert/);
  assert.match(html,/id="close-test-detail" class="detail-back detail-icon-action" aria-label="切换测试方式"/);
  assert.match(app,/\$\('test-library'\)\.hidden=active/);
  assert.match(app,/detail\.hidden=!active/);
  assert.match(app,/classList\.toggle\('workspace-active',active\)/);
  assert.match(app,/function returnToTestLibrary\(\)/);
});

test('workspace identity is independent of test mode and duplicate modes are allowed',()=>{
  assert.match(app,/function createWorkspaceStore\(options = \{\}\)/);
  assert.match(app,/const workspaceStore=createWorkspaceStore\(\{onChange:scheduleWorkspaceSave\}\)/);
  assert.match(app,/workspaceStore\.createTab\(\)/);
  assert.match(app,/workspaceStore\.setMode\(tab\.id,kind\)/);
  assert.match(app,/function activateWorkspaceTab\(tabId\)/);
  assert.match(app,/function selectTestKind\(kind\)/);
  assert.doesNotMatch(app,/openedTabs|tabDrafts|expandedKind/);
  assert.match(app,/function beginTabRename/);
  assert.match(app,/addEventListener\('dblclick'/);
  assert.match(app,/addEventListener\('pointerdown'/);
});

test('each workspace owns per-mode history and raw measurement data',()=>{
  assert.match(html,/id="test-history-list" class="test-history-list"/);
  assert.match(html,/id="test-history-count"/);
  assert.match(app,/historyByMode/);
  assert.match(app,/dataByMode/);
  assert.match(app,/workspaceStore\.recordRun/);
  assert.match(app,/workspaceStore\.getHistory/);
  assert.match(app,/workspaceStore\.getData/);
  assert.match(app,/workspaceStore\.selectRun/);
  assert.match(app,/window\.DKTSMeasurementPlot=Object\.freeze/);
  assert.match(app,/beginRun:beginMeasurementRun/);
  assert.match(app,/appendMeasurements:appendMeasurementRun/);
});

test('test cards still provide all eight measurement modes',()=>{
  assert.equal((html.match(/class="test-type-card"/g)||[]).length,8);
  assert.equal((html.match(/data-test-kind="/g)||[]).length,8);
  assert.match(app,/measurementPlot\.selectTest\(activeMode,rows\)/);
  assert.doesNotMatch(html,/<select[^>]*name="kind"/);
  assert.match(html,/id="plan-form"/);
  assert.match(html,/id="waveform-editor" hidden/);
  assert.match(html,/id="pending-parameters" class="pending-parameters" hidden/);
  assert.match(styles,/\.detail-columns\{grid-template-columns:minmax\(250px,clamp\(270px,25vw,330px\)\) minmax\(0,1fr\)/);
  assert.match(styles,/@media\(max-width:850px\)\{/);
  assert.match(styles,/grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
});

test('workbench keeps real-data-only plot and raw-data surfaces',()=>{
  for(const name of ['measurement-plot','measurement-rows','readout-current','readout-voltage'])
    assert(html.includes('id="'+name+'"'));
  assert.match(html,/class="measure-button" disabled/);
  assert.match(html,/等待仪器返回原始数据/);
  assert.match(app,/Only actual hardware rows are plotted/);
  assert.doesNotMatch(app,/post\('\/api\/output'/);
});

test('Android scroll gestures follow DKDS vertical handoff and horizontal strip ownership',()=>{
  assert.match(styles,/body\.dkts-android-shell :where\([\s\S]*?touch-action:pan-y/);
  assert.match(styles,/body\.dkts-android-shell \.workspace-tabs\{[\s\S]*?touch-action:pan-x/);
  assert.match(styles,/body\.dkts-android-shell \.test-history-list\{[\s\S]*?touch-action:pan-x/);
  assert.match(styles,/overscroll-behavior-y:auto/);
  assert.match(styles,/\.workspace-tab-rename\{[\s\S]*?user-select:text/);
});

test('add-workspace button remains after the scrollable tabs and follows them',()=>{
  const index=html.indexOf('id="workspace-tabs"');
  const plus=html.indexOf('id="tab-home"');
  const drag=html.indexOf('class="titlebar-drag-region"');
  assert(index>=0&&plus>index&&drag>plus);
  assert.match(styles,/\.workspace-tabs\{\s*flex:0 1 auto;\s*width:max-content/);
  assert.match(styles,/\.workspace-tab-add\{\s*order:0;\s*flex:0 0 30px/);
});

test('workbench reserves narrow title/status strips and parameter collapse',()=>{
  assert.doesNotMatch(html,/<header class="topbar">/);
  assert.doesNotMatch(html,/class="workspace-actions"/);
  assert.match(html,/id="app-titlebar" class="app-titlebar"/);
  assert.match(html,/id="app-statusbar" class="app-statusbar"/);
  assert.doesNotMatch(html,/id="toggle-parameters"/);
  assert.match(html,/id="detail-columns"/);
  assert.match(app,/classList\.toggle\('parameters-collapsed',collapsed\)/);
  assert.match(app,/\$\('parameters-panel'\)\.hidden=collapsed/);
  assert.match(html,/id="restore-parameters" class="panel-expand-control"/);
  assert.match(app,/restore\.textContent=collapsed\?'收起':'展开'/);
  assert.match(styles,/\.detail-columns\.parameters-collapsed\{grid-template-columns:minmax\(0,1fr\)\}/);
  assert.match(styles,/\.workspace,.workspace\.workspace-active\{position:relative;width:100%;max-width:none/);
  assert.match(styles,/\.data-panel\{display:flex;flex-direction:column/);
});


test('tab activation keeps DOM identity so desktop double-click rename works on inactive tabs',()=>{
  const start=app.indexOf('function renderWorkspaceTabs(){');
  const end=app.indexOf('function createWorkspaceTab(){',start);
  assert(start>=0&&end>start);
  const renderer=app.slice(start,end);
  assert.match(renderer,/const existing=new Map\(\)/);
  assert.match(renderer,/if\(item&&select\)\{/);
  assert.match(renderer,/select\.setAttribute\('aria-selected'/);
  assert.match(renderer,/nav\.addEventListener\('dblclick'/);
  assert.doesNotMatch(renderer,/querySelectorAll\('\.workspace-tab-item'\)\.forEach\(node=>node\.remove\(\)\)/);
});
