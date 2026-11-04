'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const app=fs.readFileSync(path.join(__dirname,'../web/app.js'),'utf8');
const start=app.indexOf('const measurementPlot=(()=>{');
const end=app.indexOf('window.DKTSMeasurementPlot=measurementPlot;',start);
test('interactive plot double click changes each axis without modifying actual data',()=>{
  assert(start>0&&end>start);
  class Node {
    constructor(id){this.id=id;this.children=[];this.listeners={};this.attrs={};this.dataset={};this.hidden=false;this.parentElement=this;this.textContent='';this.style={};}
    setAttribute(key,value){this.attrs[key]=value;}
    replaceChildren(){this.children=[];}
    appendChild(node){this.children.push(node);}
    addEventListener(event,callback){this.listeners[event]=callback;}
    getBoundingClientRect(){return {left:0,top:0,width:640,height:290};}
    setPointerCapture(){}
    releasePointerCapture(){}
    fire(event,values){this.listeners[event]?.({button:0,clientX:100,clientY:120,pointerId:1,preventDefault(){},...values});}
  }
  const ids=['measurement-plot','measurement-grid','measurement-traces','measurement-ticks',
   'measurement-cursor-lines','measurement-cursor-tooltip','measurement-x-label','measurement-y-label',
   'measurement-empty','measurement-zoom-in','measurement-zoom-out','measurement-home'];
  const nodes=Object.fromEntries(ids.map(id=>[id,new Node(id)]));
  const context={document:{createElementNS(_ns,tag){return new Node(tag);}},window:{},Date,Math,Number,Array,Object,Set,Map};
  context.$=id=>{assert(nodes[id],id);return nodes[id];};
  vm.createContext(context);
  vm.runInContext(app.slice(start,end)+'window.DKTSMeasurementPlot=measurementPlot;',context,{filename:'measurement-plot-excerpt.js'});
  const plot=context.window.DKTSMeasurementPlot,svg=nodes['measurement-plot'];
  assert.equal(svg.dataset.xScale,'linear');
  assert.equal(svg.dataset.yScale,'linear');
  plot.setMeasurements([{voltageV:-1,currentA:-0.000001},{voltageV:1,currentA:0.000001},{voltageV:10,currentA:0.00001}]);
  assert.equal(nodes['measurement-empty'].hidden,true);
  assert.equal(nodes['measurement-traces'].children.length,1);
  const original=nodes['measurement-traces'].children[0].attrs.d;
  svg.fire('dblclick',{clientX:20,clientY:120}); // y-axis region
  assert.equal(svg.dataset.yScale,'log');
  assert.match(nodes['measurement-y-label'].textContent,/log10/);
  assert.notEqual(nodes['measurement-traces'].children[0].attrs.d,original);
  svg.fire('dblclick',{clientX:200,clientY:276}); // x-axis region
  assert.equal(svg.dataset.xScale,'log');
  svg.fire('dblclick',{clientX:200,clientY:276});
  assert.equal(svg.dataset.xScale,'linear');
  svg.fire('dblclick',{clientX:20,clientY:120});
  assert.equal(svg.dataset.yScale,'linear');
  plot.setMeasurements([]);
  assert.equal(nodes['measurement-empty'].hidden,false);
  assert.equal(nodes['measurement-traces'].children.length,0);
  svg.fire('wheel',{deltaY:-1,clientX:250,clientY:100});
  nodes['measurement-home'].fire('click',{});
});
