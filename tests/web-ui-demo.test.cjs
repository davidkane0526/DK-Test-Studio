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
   'Terminal Settings','Target','Strategy','Limits','Page Var','Associate Spec','Data / Graph'])
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