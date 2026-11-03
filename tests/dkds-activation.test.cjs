'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
test('DKDS API 1.19 adapter activates real plugin entry and shared capability',async()=>{
  const registry=new Map(),nodes=[],captured={};
  const unit=(kind)=>({
    kind,children:[],hidden:false,open:false,value:'',textContent:'',
    appendChild(item){this.children.push(item);return item;},
    querySelector(){return null;}
  });
  let composed,capability,slice,top,activity,openedPage,transmit=0;
  const units={
    page:{create:()=>({element:unit('page')})},
    pageHeader:{create:()=>({element:unit('header')})},
    layout:{create:(parent)=>{const n=unit('layout');parent?.appendChild?.(n);return n;}},
    workspace:{create:()=>({compose:spec=>{composed=spec;},dispose:()=>{}})},
    surface:{create:(parent)=>{const n=unit('surface');parent?.appendChild?.(n);return n;}},
    field:{create:(parent,spec)=>{const n=unit('field'),control=unit('control');control.value=String(spec.value??'');
      n.appendChild(control);parent?.appendChild?.(n);return {element:n,control};}},
    action:{create:(parent,spec)=>{const button=unit('button');button.textContent=spec.label;button.invoke=spec.onInvoke;
      parent?.appendChild?.(button);nodes.push(button);return {button};}},
    note:{create:(parent,spec)=>{const n=unit('note');n.textContent=spec.text||'';
      parent?.appendChild?.(n);return n;}}
  };
  const context={atob,btoa,DKDSPlugins:{define:(m,fn)=>{captured.manifest=m;captured.activate=fn;}},window:{
    DKDSPluginModules:{define:(owner,name,api)=>{
      assert.equal(owner,'com.dkds.keithley-4200');registry.set(name,api);
    }}
  }};
  vm.createContext(context);
  for(const file of ['kxci-protocol.js','measurement-plan.js','waveform.js','identity-core.js','interop.js']){
    vm.runInContext(fs.readFileSync(path.join(root,'src/shared',file),'utf8'),context);
  }
  vm.runInContext(fs.readFileSync(path.join(root,'integrations/dkds/presentation.js'),'utf8'),context);
  vm.runInContext(fs.readFileSync(path.join(root,'integrations/dkds/plugin.js'),'utf8'),context);
  const tcp={
    open:async()=>({sessionId:'mock',remoteAddress:'169.254.111.118',remotePort:1225}),
    exchange:async payload=>{
      transmit++;
      const cmd=Buffer.from(payload.base64,'base64').toString('hex');
      assert(['2a49444e3f00','2a4f50543f00'].includes(cmd));
      return {base64:Buffer.from(cmd==='2a49444e3f00'
        ?'KEITHLEY INSTRUMENTS,KI4200A,1498377,V1.14\0'
        :'SMU1,HPSMUPA2,PMU3,CVU1\0').toString('base64')};
    },
    close:async()=>true
  };
  const ctx={
    services:{require(name){assert.equal(name,'tcp');return tcp;}},
    modules:{require(name){assert(registry.has(name),'missing '+name);return registry.get(name);}},
    status:{set(v){captured.status=v;}},
    workspace:{openPage(id){openedPage=id;}},
    ui:{
      unitTemplates:units,dom:{create:unit},
      activities:{add:row=>{activity=row;}},
      pages:{add:row=>{captured.page=row;return row;}},
      topWorkspace:{register:row=>{top=row;}}
    },
    project:{registerSlice:(id,row)=>{assert.equal(id,'keithley-4200');slice=row;},capture(){}},
    capabilities:{register:(id,row)=>{assert.equal(id,'instrument.keithley-4200');capability=row;}}
  };
  const registered=await captured.activate(ctx);
  assert.equal(captured.manifest.id,'com.dkds.keithley-4200');
  assert.equal(captured.manifest.apiVersion,'1.19.0');
  assert.equal(typeof activity.onActivate,'function');
  assert.equal(top.activity,'keithley-4200');
  assert(composed?.primary?.mainNode);
  assert(nodes.some(row=>row.textContent==='连接'));
  assert.equal(capability.methods.validatePlan().kind,'iv');
  const plan=capability.methods.exportPlan();
  assert.equal(plan.schema,'dkts.4200.interop.v1');
  assert.equal(plan.plan.executable,false);
  const oldPlan={plan:{mode:'iv',loops:2,points:5,startV:-2,stopV:2}};
  slice.restore(oldPlan);
  assert.equal(capability.methods.validatePlan().loops,2);
  assert.equal(capability.methods.importPlan(plan).totalPoints,201);
  const identified=await capability.methods.connect();
  assert.equal(identified.phase,'connected');
  assert.equal(capability.methods.status().identified.serial,'1498377');
  assert.equal(transmit,2);
  assert.equal(capability.methods.status().inventory.knownModules.length,4);
  assert.equal((await capability.methods.connect()).phase,'connected');
  assert.equal(transmit,2,'no duplicate identify or inventory');
  assert.equal((await capability.methods.disconnect()).phase,'disconnected');
  assert.equal(slice.serialize().plan.executable,false);
  registered.deactivate();
});
