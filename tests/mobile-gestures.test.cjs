'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const js=fs.readFileSync(path.join(root,'web/app.js'),'utf8');
const css=fs.readFileSync(path.join(root,'web/styles.css'),'utf8');
const start=js.indexOf('function computeMobilePinchRelayout(start,current){');
const end=js.indexOf('\nconst measurementPlot=(()=>{',start);
assert(start>=0&&end>start,'The pure mobile pinch zoom helper must exist');
const compute=vm.runInThisContext('('+js.slice(start,end).trim()+')');
const initial=(x=[0,100],y=[0,100])=>({
  span:100,center:{x:210,y:120},size:{l:60,t:20,w:300,h:200},
  range:{x,y}
});
function approx(actual,expected,eps=1e-9){
  assert(Math.abs(actual-expected)<eps,actual+' should approximately equal '+expected);
}

test('mobile two-finger zoom keeps the data value at its focal point',()=>{
  const patch=compute(initial(),{span:200,center:{x:210,y:120}});
  assert.deepEqual(patch['xaxis.range'],[25,75]);
  assert.deepEqual(patch['yaxis.range'],[25,75]);
  assert.equal(patch['xaxis.autorange'],false);
  assert.equal(patch['yaxis.autorange'],false);
});

test('mobile pinch translation follows the fingers and does not force midpoint zoom',()=>{
  const patch=compute(initial(),{span:200,center:{x:250,y:70}});
  approx(patch['xaxis.range'][0],50-(50*190/300));
  approx(patch['xaxis.range'][1],100-(50*190/300));
  approx(patch['yaxis.range'][0],50-50*(1-(70-20)/200));
  approx(patch['yaxis.range'][1],100-50*(1-(70-20)/200));
});

test('pinch preserves descending axes and rejects invalid viewports',()=>{
  const patch=compute(initial([100,0],[40,-40]),{span:50,center:{x:210,y:120}});
  assert.deepEqual(patch['xaxis.range'],[150,-50]);
  assert.deepEqual(patch['yaxis.range'],[80,-80]);
  assert.equal(compute({...initial(),span:0},{span:10,center:{x:210,y:120}}),null);
  assert.equal(compute({...initial(),size:{l:0,t:0,w:0,h:250}},
    {span:50,center:{x:210,y:120}}),null);
  assert.equal(compute(initial(),{span:0,center:{x:210,y:120}}),null);
});

test('chart touch events only capture two-finger gestures, never one-finger page scroll',()=>{
  assert.match(js,/if\(event\.touches\.length!==2\|\|!pinch\)return;/);
  assert.match(js,/if\(event\.cancelable\)event\.preventDefault\(\)/);
  assert.match(js,/event\.target\?\.closest\?\.\('\.dkds-scientific-nav-tools'\)/);
  assert.match(js,/host\.addEventListener\('touchcancel',stopPinch/);
  assert.match(js,/if\(pinch===started\)void library\.relayout\(host,patch\)/);
  assert.match(css,/body\.dkts-android-shell :where\([\s\S]*?\.test-type-card,[\s\S]*?touch-action:pan-y/);
  assert.match(css,/\.data-table td/);
  assert.match(css,/\.archive-workspace-row/);
  assert.match(css,/\.dkds-scientific-nav-tools \.dkds-scientific-nav-drag\{[\s\S]*?touch-action:none!important/);
});

test('selecting a clipped workspace reveals that tab within the horizontal strip only',()=>{
  const from=js.indexOf('let lastRevealedWorkspaceId=null;');
  const to=js.indexOf('function renderWorkspaceTabs(){',from);
  assert(from>=0&&to>from);
  const context={
    requestAnimationFrame:fn=>fn(),
    document:{body:{classList:{contains:()=>true}}}
  };
  const reveal=vm.runInNewContext(js.slice(from,to)+'\nrevealActiveWorkspace',context);
  const active={
    dataset:{workspaceId:'t2'},
    getBoundingClientRect:()=>({left:215,right:285})
  };
  const nav={
    isConnected:true,scrollWidth:450,clientWidth:200,scrollLeft:20,
    querySelectorAll:()=>[active],
    getBoundingClientRect:()=>({left:0,right:200}),
    scrollTo(params){this.lastScroll=params;this.scrollLeft=params.left;}
  };
  reveal(nav,'t2');
  assert.equal(nav.lastScroll.left,111);
  assert.equal(nav.lastScroll.behavior,'smooth');
  delete nav.lastScroll;
  reveal(nav,'t2');
  assert.equal(nav.lastScroll,undefined,'no unsolicited movement for unchanged active tab');
  active.getBoundingClientRect=()=>({left:-20,right:40});
  active.dataset.workspaceId='t3';
  reveal(nav,'t3');
  assert.equal(nav.lastScroll.left,85);
});
