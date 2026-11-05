'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const staged=require('../tools/build-dkds-plugin.cjs').folder;
const owner='com.dkts.keithley-4200';
function prepare(){
  const registry=new Map(),captured={},listeners=new Map();
  const unit=(kind)=>({
    kind,children:[],hidden:false,open:false,style:{},attributes:{},
    textContent:'',value:'',className:'',
    setAttribute(key,value){this.attributes[key]=value;},
    appendChild(n){this.children.push(n);return n;},
    append(...nodes){this.children.push(...nodes);},
    replaceChildren(...nodes){this.children=nodes;},
    addEventListener(name,handler){this.events??={};this.events[name]=handler;},
    remove(){this.removed=true;},
    querySelector(){return null;},
    contentWindow:kind==='iframe'?{sent:[],postMessage(m){this.sent.push(m);}}:undefined
  });
  let composed,activity,top,slice,capability,transmit=0,frame,workspaceRoot,workspaceSpec,statusItem,statusSpec;const artifacts=[];
  const units={
    page:{create:()=>({element:unit('page')})},
    layout:{create(parent,spec={}){const node=unit('layout');node.className=spec.className||'';if(parent)parent.appendChild(node);return node;}},
    workspace:{create(root,spec){workspaceRoot=root;workspaceSpec=spec;return {compose(v){composed=v;},dispose(){}};}}
  };
  const sandbox={
    atob,btoa,crypto:{randomUUID:()=>('a'.repeat(32))},
    DKDSPlugins:{define:(manifest,activate)=>{captured.manifest=manifest;captured.activate=activate;}},
    window:{
      addEventListener(name,handler){listeners.set(name,handler);},
      removeEventListener(name){listeners.delete(name);},
      DKDSPluginModules:{define(id,name,api){
        assert.equal(id,owner);registry.set(name,api);
      }}
    }
  };
  vm.createContext(sandbox);
  for(const file of ['kxci-protocol.js','measurement-plan.js','waveform.js',
    'identity-core.js','interop.js','standalone-shell.js','presentation.js','plugin.js']){
    vm.runInContext(fs.readFileSync(path.join(staged,file),'utf8'),sandbox,
      {filename:file,timeout:10000});
  }
  const tcp={
    open:async()=>({sessionId:'stub',remoteAddress:'169.254.111.118',remotePort:1225}),
    exchange:async p=>{
      transmit++;
      const cmd=Buffer.from(p.base64,'base64').toString('hex');
      assert(['2a49444e3f00','2a4f50543f00'].includes(cmd));
      return {base64:Buffer.from(cmd==='2a49444e3f00'
        ?'KEITHLEY INSTRUMENTS,KI4200A,1498377,V1.14\0'
        :'SMU1,HPSMUPA2,PMU3,CVU1\0').toString('base64')};
    },
    close:async()=>true
  };
  const ctx={
    services:{require(name){assert.equal(name,'tcp');return tcp;}},
    data:{model:{createTable(spec){return {...spec,kind:'data.table'};}},artifacts:{upsert(value){artifacts.push(value);return {changed:true};}}},
    modules:{require(name){assert(registry.has(name),'Missing '+name);return registry.get(name);}},
    status:{set(v){captured.status=v;}},
    workspace:{openPage(id){captured.openedPage=id;}},
    ui:{
      dom:{
        create(kind){const n=unit(kind);if(kind==='iframe')frame=n;return n;},
        style(target,patch){Object.assign(target.style,patch);return target;}
      },
      unitTemplates:units,
      activities:{add(spec){activity=spec;}},
      pages:{add(spec){return spec;}},
      topWorkspace:{register(spec){top=spec;}},
      statusBar:{add(spec){statusSpec=spec;statusItem={value:{...spec},update(patch){Object.assign(this.value,patch);},remove(){this.removed=true;}};return statusItem;}}
    },
    project:{
      registerSlice(id,v){assert.equal(id,'dkts-keithley-4200');slice=v;},
      capture(){captured.capture=(captured.capture||0)+1;}
    },
    capabilities:{register(id,v){
      assert.equal(id,'instrument.dkts-keithley-4200');capability=v;
    }}
  };
  return {captured,registry,listeners,ctx,
    get view(){return {composed,activity,top,slice,capability,frame,transmit,workspaceRoot,workspaceSpec,statusItem,statusSpec,artifacts};}};
}
test('DKDS plugin displays the exact standalone app in a sandboxed workbench',async()=>{
  const env=prepare(),installed=await env.captured.activate(env.ctx),v=env.view;
  assert.equal(env.captured.manifest.version,'0.6.13');
  assert.equal(v.activity.openMode,'window');
  assert.equal(v.top.activity,'dkts-keithley-4200');
  assert.equal(v.statusSpec.icon,'');
  assert.equal(v.statusSpec.label,'4200A 未连接');
  assert.equal(env.captured.manifest.window.title,undefined);
  assert.equal(env.captured.manifest.workspace.icon,undefined);
  assert(v.composed.primary.mainNode);
  const incoming=(type,extra={})=>env.listeners.get('message')({
    source:v.frame.contentWindow,
    data:{channel:'dkts-standalone-workbench-v1',session:'a'.repeat(32),type,...extra}
  });
  incoming('ready');
  incoming('workspace-state',{workspace:{tabs:[{id:'w1',name:'器件 A',activeMode:'iv'}],activeTabId:'w1'}});
  const hostTabs=v.composed.primary.mainNode.children[0];
  assert.equal(hostTabs.className,'dkts-host-workspace-tabs');
  assert.equal(hostTabs.children.length,2,'One workspace tab and one add button belong to DKDS chrome');
  assert.equal(hostTabs.children[0].children[0].textContent,'器件 A');
  hostTabs.children[0].children[0].events.click();
  assert(v.frame.contentWindow.sent.some(message=>message.type==='workspace-select'&&message.workspaceId==='w1'));
  assert.equal(v.frame.attributes.sandbox,'allow-scripts allow-modals');
  assert.equal(v.workspaceRoot.kind,'layout');
  assert.equal(v.workspaceSpec.activity,'dkts-keithley-4200');
  assert.equal(v.frame.style.width,'100%');
  assert(!v.frame.attributes.sandbox.includes('allow-same-origin'));
  assert.equal(v.frame.attributes.title,'DK Test Studio 完整测试工作区');
  assert.match(v.frame.srcdoc,/DK Test Studio/);
  assert.match(v.frame.srcdoc,/id="workspace-tabs"/);
  assert.match(v.frame.srcdoc,/id="measurement-plot"/);
  assert.match(v.frame.srcdoc,/id="plan-form"/);
  assert.match(v.frame.srcdoc,/DKDSCharts/);
  assert(!v.frame.srcdoc.includes('<script src="/app.js"'));
  assert.equal(v.capability.methods.validatePlan().kind,'iv');
  assert.equal(v.capability.methods.exportPlan().schema,'dkts.4200.interop.v1');
  const published=v.capability.methods.publishMeasurement({xValues:[0,1],yValues:[1e-9,2e-9],xUnit:'V',yUnit:'A'});
  assert.equal(published.rowCount,2);
  assert.equal(v.artifacts.length,1);
  assert.equal(v.artifacts[0].metadata.rawInstrumentData,true);
  assert.equal(v.artifacts[0].semanticType,'science.transport.iv');
  assert.equal(v.artifacts[0].columns[0].key,'Vd');
  assert.equal(v.artifacts[0].columns[1].key,'Id');
  assert.equal(v.artifacts[0].columns[1].values[1],2e-9);
  installed.deactivate();
  assert(v.frame.removed);
  assert.equal(v.statusItem.removed,true);
});
test('request bridge only permits read-only KXCI and same form plan validation',async()=>{
  const env=prepare(),installed=await env.captured.activate(env.ctx),v=env.view;
  const session='a'.repeat(32),channel='dkts-standalone-workbench-v1';
  const incoming=(type,extra={})=>env.listeners.get('message')({
    source:v.frame.contentWindow,data:{channel,session,type,...extra}
  });
  incoming('ready');
  const draft={plan:{kind:'it',points:'3',loops:'2'},connection:{host:'169.254.111.118',port:'1225'}};
  incoming('draft',{...draft,source:'plan'});
  assert.equal(v.capability.methods.validatePlan().kind,'it');
  assert.equal(env.captured.capture||0,0,'Typing must not capture the DKDS project');
  incoming('commit',{...draft,source:'plan'});
  assert.equal(env.captured.capture,1,'Completed plan edits must capture the DKDS project');
  incoming('commit',{...draft,source:'connection'});
  assert.equal(env.captured.capture,1,'Connection settings must not be captured into the project');
  async function request(ticket,method,route,payload={}){
    incoming('api',{ticket,method,route,payload});
    for(let i=0;i<12;i++){
      await new Promise(resolve=>setImmediate(resolve));
      const found=v.frame.contentWindow.sent.find(m=>m.type==='api-response'&&m.ticket===ticket);
      if(found)return found;
    }
    throw Error('No DKDS bridge response for '+route);
  }
  const status=await request(1,'GET','/api/status');
  assert.equal(status.status,200);
  const plan=await request(2,'POST','/api/plan/validate',{kind:'iv',loops:1,points:5});
  assert.equal(plan.status,200);
  assert.equal(plan.data.plan.kind,'iv');
  const connect=await request(3,'POST','/api/connect',{host:'169.254.111.118'});
  assert.equal(connect.data.phase,'connected');
  const options=await request(4,'POST','/api/modules/inspect');
  assert.equal(options.data.inventory.knownModules.length,4);
  assert.equal(env.view.transmit,2);
  const forbidden=await request(5,'POST','/api/smu/source',{voltage:15});
  assert.equal(forbidden.status,404);
  assert.equal(env.view.transmit,2,'No hardware source command may be sent');
  const exportPlan=v.capability.methods.exportPlan();
  assert.equal(exportPlan.plan.executable,false);
  v.slice.restore({plan:{mode:'iv',loops:3,points:5}});
  assert.equal(v.capability.methods.validatePlan().loops,3);
  assert.equal(v.capability.methods.importPlan(exportPlan).totalPoints,6);
  await v.capability.methods.disconnect();
  installed.deactivate();
});
