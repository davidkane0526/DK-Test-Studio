'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const packageVersion=require('../package.json').version;
const html=fs.readFileSync(path.join(root,'web/index.html'),'utf8');
const app=fs.readFileSync(path.join(root,'web/app.js'),'utf8');
const css=fs.readFileSync(path.join(root,'web/styles.css'),'utf8');
test('the version button shows V package version and hides the a-number UI version until opened',()=>{
  assert(html.includes('id="native-version-badge"'));
  assert(html.includes('id="ui-version-badge"')&&html.includes('hidden'));
  assert(html.includes('>V'+packageVersion+'</button>'));
  assert(!html.includes('native-app-update-state')&&!html.includes('native-app-update-action'));
  assert(app.includes("nativeBadge.textContent='V'+nativePackageVersion;"));
  assert(app.includes("hasHotfix?hotfix:'a0'"));
  assert(app.includes("if(opening)void checkUiUpdateNow();"));
  assert(!app.includes('checkNativeAppUpdate')&&!app.includes('可选完整升级'));
  assert(app.includes("fetch('/api/ui/check'"));
  assert(app.includes('window.DKTSClient.checkUiUpdate()'));
  assert(css.includes('#ui-version-badge[hidden]{display:none!important}'));
  assert(css.includes('-webkit-tap-highlight-color:transparent'));
  assert(!html.includes('version-hold-toggle'));
});
test('only one collapsible parameter control lives at the right of the data heading',()=>{
  assert.doesNotMatch(html,/id="toggle-parameters"/);
  assert.doesNotMatch(html,/id="acquisition-state"/);
  const dataHead=html.slice(html.indexOf('<section class="detail-panel data-panel"'),html.indexOf('<div class="readout-grid"'));
  assert.match(dataHead,/id="data-title"[\s\S]*id="restore-parameters" class="panel-expand-control"/);
  assert.match(app,/restore\.textContent=collapsed\?'收起':'展开'/);
  assert.match(app,/classList\.toggle\('parameters-collapsed',collapsed\)/);
  assert.equal((html.match(/id="restore-parameters"/g)||[]).length,1);
});
test('Android topbar remains aligned without overriding desktop left padding',()=>{
  assert.match(css,/body\.dkts-android-shell \.app-titlebar\{\s*padding-left:calc\(clamp\(8px,1vw,18px\) \+ 19px \+ var\(--dkts-safe-left\)\)/);
  assert.match(css,/padding-left:calc\(18px \+ var\(--dkts-safe-left\)\)/);
  assert.match(css,/\.app-titlebar\{\s*position:fixed;top:0;left:0;right:0/);
});
test('version identity and signing upgrade remain synchronized',()=>{
  const gradle=fs.readFileSync(path.join(root,'android/app/build.gradle'),'utf8');
  assert.match(gradle,/versionCode 21/);
  assert.match(gradle,/versionName '0\.3\.10'/);
  assert.equal(require('../package.json').version,'0.3.10');
  assert.match(html,/v0\.3\.10/);
});
test('plot uses the full scientific DKDS runtime and an integrated movable toolbar',()=>{
  assert.match(html,/id="measurement-plot" class="dkds-scientific-chart-host dkts-scientific-plot"/);
  assert.match(app,/window\.DKDSCharts/);
  assert.match(app,/library\.react\(host,trace\(\),layout\(\),config\)/);
  assert.match(app,/navIcon\.grip/);
  assert.match(app,/window\.DKTSMeasurementPlot=Object\.freeze/);
  assert.match(css,/height:49px;min-height:49px/);
  assert.match(css,/touch-action:pan-y!important/);
  assert.doesNotMatch(app,/post\('\/api\/output'/);
});
