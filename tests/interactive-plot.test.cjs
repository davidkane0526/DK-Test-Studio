'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),html=fs.readFileSync(path.join(root,'web/index.html'),'utf8'),js=fs.readFileSync(path.join(root,'web/app.js'),'utf8'),css=fs.readFileSync(path.join(root,'web/styles.css'),'utf8');
test('full DKDS scientific chart renderer is loaded before independent workbench',()=>{
  const scripts=['d3.min.js','dkds/theme-bridge.js','dkds/style-gate.js','dkds/native-touch-drag.js','dkds/chart-export.js','dkds/display.js','dkds/heatmap-canvas.js','dkds/heatmap-selection.js','dkds/presentation.js','dkds/d3-renderer.js','dkds/chart-runtime.js'];
  let previous=-1;
  for(const s of scripts){const marker='/vendor/'+s;const idx=html.indexOf(marker);assert(idx>previous,marker);previous=idx;}
  assert(html.indexOf('/app.js')>previous);
  assert.match(html,/id="measurement-plot" class="dkds-scientific-chart-host dkts-scientific-plot"/);
  assert.match(js,/window\.DKDSCharts/);
  assert.match(js,/library\.react\(host,trace\(\),layout\(\),config\)/);
  assert.match(js,/window\.DKDSD3Renderer\?\.react/);
  assert.match(js,/__dkdsNavigationTools:true/);
});
test('mobile gesture uses native grip drag while preserving vertical page scroll',()=>{
  assert.match(js,/document\.documentElement\.classList\.add\('react-native-client'\)/);
  assert.match(js,/addEventListener\('touchmove'/);
  assert.match(js,/event\.touches\.length!==2/);
  assert.match(js,/library\.relayout\(host,patch\)/);
  assert.match(css,/\.dkts-scientific-plot svg\{[\s\S]*?touch-action:pan-y!important/);
  assert.match(css,/\.dkds-scientific-nav-drag\{[\s\S]*?cursor:grab/);
  assert.match(js,/navIcon\.grip/);
});
test('native title tooltip is removed and only portable is preferred for desktop delivery',()=>{
  assert.doesNotMatch(html,/id="native-version-badge"[^>]*title=/);
  assert.doesNotMatch(html,/class="titlebar-brand" title=/);
  assert.match(js,/window\.DKTSMeasurementPlot=measurementPlot/);
});
