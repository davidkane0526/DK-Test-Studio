'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const {buildWebDemo}=require('../tools/build-web-demo.cjs');
const planner=require('../web/fspro-workbench/plan.js');
function sample(){
 return {loops:2,terminals:{source:'GNDU',drain:'SMU1',gate:'SMU2'},
  xSweep:{terminal:'drain',repeats:1,segments:[{startV:0,stopV:2,stepV:.1}]},
  pSweep:{enabled:true,terminal:'gate',repeats:1,segments:[{startV:0,stopV:1,stepV:1}]}};
}
test('Pages publishes FS-Pro Edit Page hierarchy, never rejected legacy cards',()=>{
 const out=buildWebDemo(path.join(root,'dist','web-ui-demo-test'));
 const html=fs.readFileSync(path.join(out.out,'index.html'),'utf8');
 for(const expected of ['Project Explorer','EDIT PAGE','Routine','Xsweep','Psweep',
   'Terminal Settings','Target','Strategy','Limits','Page Var','Associate Spec','绘图区','frame-grid'])
  assert.ok(html.includes(expected),expected);
 assert.doesNotMatch(html,/test-type-card|demo-adapter\.js|src="\/app\.js"/);
 assert.match(html,/src="\.\/plan\.js"/);
 assert.match(html,/src="\.\/app\.js"/);
 for(const file of ['app.js','plan.js','styles.css','vendor/dkds/chart-runtime.js','vendor/d3.min.js'])
   assert.ok(fs.existsSync(path.join(out.out,file)),file);
});
test('X inner and P outer loops return planned points and never hardware permission',()=>{
 const result=planner.calculate(sample());
 assert.equal(result.xPoints,21);assert.equal(result.pPoints,2);
 assert.equal(result.totalPoints,84);
 assert.equal(result.provenance,'planned-only');
 assert.equal(result.executable,false);assert.equal(result.hardwareVerified,false);
 assert.deepEqual(Object.keys(result.sample[0]).sort(),['index','pV','xV']);
});
test('invalid voltage, conflicting ports and scan direction fail closed',()=>{
 const tooHigh=sample();tooHigh.xSweep.segments[0].stopV=1000;
 assert.throws(()=>planner.calculate(tooHigh),/210/);
 const reused=sample();reused.terminals.gate='SMU1';
 assert.throws(()=>planner.calculate(reused),/重复分配/);
 const reversed=sample();reversed.xSweep.segments[0].stepV=-.1;
 assert.throws(()=>planner.calculate(reversed),/步长不一致/);
 const same=sample();same.pSweep.terminal='drain';
 assert.throws(()=>planner.calculate(same),/另一条/);
});
test('the web UI contains no instrument transport or writable backend',()=>{
 const app=fs.readFileSync(path.join(root,'web/fspro-workbench/app.js'),'utf8');
 assert.doesNotMatch(app,/\/api\/measurement\/start|\/api\/connect|KXCI\s+US|net\.connect|WebSocket|fetch\(/);
 assert.match(app,/instrumentOutput:false/);
 assert.match(app,/syntheticRawData:false/);
});
test('single HTML bundles the FS-Pro preview and DKDS scientific renderer',()=>{
 const {buildSingleHtml}=require('../tools/build-web-demo-single-file.cjs');
 const result=buildSingleHtml(path.join(root,'dist','web-ui-demo-test'),
  path.join(root,'dist','web-ui-demo-test-single.html'));
 const html=fs.readFileSync(result.output,'utf8');
 assert.ok(result.bytes>500000);
 assert.match(html,/data-src="vendor\/d3\.min\.js"/);
 assert.match(html,/data-src="plan\.js"/);
 assert.match(html,/data-src="app\.js"/);
 assert.ok(html.indexOf('data-src="plan.js"')<html.indexOf('data-src="app.js"'));
 assert.doesNotMatch(html,/(?:src|href)="\.\/(?:app\.js|styles\.css|vendor\/)/);
 assert.doesNotMatch(html,/data-src="demo-adapter\.js"/);
});

test('web planner and DKDS native plugin agree on exact segment endpoints and nested totals',()=>{
  const vm=require('node:vm');
  const registry=new Map(),ctx={
    window:{DKDSPluginModules:{define:(id,name,model)=>registry.set(name,model)}}
  };
  vm.runInNewContext(fs.readFileSync(path.join(root,'integrations/dkds-native/model.js'),'utf8'),ctx);
  const native=registry.get('model');
  assert.ok(native);
  let project=native.initial();
  project=native.edit(project,'D',{resource:'SMU1'});
  project=native.edit(project,'G',{resource:'SMU2',role:'P'});
  project=native.editSweep(project,{pEnabled:true,loops:'2',xRepeats:'2',pRepeats:'1'});
  const summary=native.summary(project.pages[0]);
  const page={loops:2,terminals:{source:'GNDU',drain:'SMU1',gate:'SMU2'},
    xSweep:{terminal:'drain',repeats:2,segments:[{startV:0,stopV:2,stepV:0.1}]},
    pSweep:{enabled:true,terminal:'gate',repeats:1,segments:[{startV:0,stopV:1,stepV:0.1}]}};
  const web=require('../web/fspro-workbench/plan.js').calculate(page);
  assert.equal(web.xPoints,summary.xPoints*summary.xRepeats);
  assert.equal(web.pPoints,summary.pPoints*summary.pRepeats);
  assert.equal(web.totalPoints,summary.total);
  assert.equal(web.executable,false);
});
test('web planner does not silently truncate sweep endpoints or relax KXCI segment bounds',()=>{
  const planner=require('../web/fspro-workbench/plan.js');
  const page={loops:1,terminals:{source:'GNDU',drain:'SMU1',gate:'SMU2'},
    xSweep:{terminal:'drain',repeats:1,segments:[{startV:0,stopV:2,stepV:0.3}]},
    pSweep:{enabled:false,terminal:'gate',repeats:1,segments:[{startV:0,stopV:1,stepV:0.1}]}};
  assert.throws(()=>planner.calculate(page),/精确到达/);
  page.xSweep.segments=[{startV:0,stopV:210,stepV:0.05}];
  assert.throws(()=>planner.calculate(page),/4096/);
  page.xSweep.segments=[{startV:0.75,stopV:0.75,stepV:0}];
  const single=planner.calculate(page);
  assert.equal(single.xPoints,1);
  assert.equal(single.sample[0].xV,0.75);
  page.xSweep.segments[0].stepV=1;
  assert.throws(()=>planner.calculate(page),/单点段必须使用 0 步长/);
});

test('FS-Pro Device owns Routines/Specs and exports device associations',()=>{
 const app=fs.readFileSync(path.join(root,'web/fspro-workbench/app.js'),'utf8');
 const html=fs.readFileSync(path.join(root,'web/fspro-workbench/index.html'),'utf8');
 for(const marker of ['id="new-device"','id="device-picker"'])assert.ok(html.includes(marker));
 for(const marker of ['function addDevice(','r.deviceId===state.activeDeviceId','s.deviceId===state.activeDeviceId','devices:state.devices,routines:state.routines'])assert.ok(app.includes(marker),marker);
 assert.ok(!app.includes("'Research Project / MOSFET / '"));
});

test('results graph is a project-level sibling, test parameters are opt-in',()=>{
 const html=fs.readFileSync(path.join(root,'web/fspro-workbench/index.html'),'utf8');
 const css=fs.readFileSync(path.join(root,'web/fspro-workbench/styles.css'),'utf8');
 const app=fs.readFileSync(path.join(root,'web/fspro-workbench/app.js'),'utf8');
 assert.match(html,/<main class="main-pane" id="main-pane"/);
 assert.match(html,/<section class="editor-pane" id="editor-pane"/);
 assert.match(html,/<aside class="data-pane" id="data-pane"/);
 assert.ok(html.indexOf('id="editor-pane"')<html.indexOf('id="data-pane"'));
 assert.doesNotMatch(html,/class="work-split"/);
 assert.match(html,/id="project-overview"/);
 assert.match(css,/\.main-pane:not\(\.editor-open\)>\.editor-pane\{display:none!important\}/);
 assert.match(css,/\.main-pane\.editor-open>\.data-pane\{display:none!important\}/);
 assert.match(html,/id="back-to-graphs"/);
 assert.match(app,/\$\('back-to-graphs'\)\.addEventListener/);
 assert.match(app,/state\.editorOpen=false;/);
 assert.match(app,/state\.editorOpen=true;/);
 assert.match(app,/\$\('main-pane'\)\.classList\.toggle\('editor-open'/);
});

test('four graph subwindows are independent project children and no synthetic samples are injected',()=>{
 const html=fs.readFileSync(path.join(root,'web/fspro-workbench/index.html'),'utf8');
 const app=fs.readFileSync(path.join(root,'web/fspro-workbench/app.js'),'utf8');
 const css=fs.readFileSync(path.join(root,'web/fspro-workbench/styles.css'),'utf8');
 assert.equal((html.match(/class="frame-card"/g)||[]).length,4);
 assert.match(html,/id="frame-layout"/);
 assert.match(html,/data-frame-kind="2"/);
 assert.match(html,/data-frame-kind="3"/);
 assert.match(html,/data-frame-kind="4"/);
 assert.ok(html.indexOf('id="frame-grid"')>html.indexOf('id="editor-pane"'));
 assert.match(css,/\.frame-grid\[data-layout="1"\]/);
 assert.match(css,/\.frame-grid\[data-layout="2"\]/);
 assert.match(app,/function updateFrameWindows/);
 assert.match(app,/syntheticRawData:false/);
});
