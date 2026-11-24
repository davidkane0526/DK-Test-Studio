'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {createInteractiveTcp}=require('../tools/dkds-tcp-interactive.cjs');
const dir=path.resolve(__dirname,'../integrations/dkds-native');
const OWNER='com.dkts.keithley-4200';
function loadModules(protocolVerified=false){
 const modules=new Map(),window={DKTSHardwareCapabilities:null};
 window.DKDSPluginModules={
  define:(id,name,value)=>{assert.equal(id,OWNER);modules.set(name,value);},
  require:name=>{if(!modules.has(name))throw Error('missing module '+name);return modules.get(name);}
 };
 const sandbox={window,atob,btoa,console,setTimeout,clearTimeout,Date,Math,Promise,Object,Array,Number,String,RegExp,Error,RangeError,Map,Set,Symbol};
 for(const file of ['hardware-capabilities.js','kxci-protocol.js','identity-core.js',
  'measurement-plan.js','kxci-measurement.js','model.js','measurement-data.js','measurement-runtime.js'])
  vm.runInNewContext(fs.readFileSync(path.join(dir,file),'utf8'),sandbox,{filename:file});
 if(protocolVerified){
  const original=modules.get('dkts-capabilities'),database=JSON.parse(JSON.stringify(original.DATABASE));
  database.safetyPolicies.kxci.latestOfficialContentVerified=true;
  database.safetyPolicies.kxci.allowInstrumentOutput=true;
  database.safetyPolicies.pulse.latestKxciRevisionContentVerified=true;
  modules.set('dkts-capabilities',{...original,DATABASE:database});
 }
 return {modules,window};
}
function configuredPage(model){
 let state=model.initial();
 state=model.edit(state,'D',{resource:'SMU1'});
 const page=state.pages[0];
 page.sweep.xSegments=[{start:'0',stop:'0.1',step:'0.1',delayMs:'5',range:'auto'}];
 return page;
}
function makeInstrumentContext(modules,options={}){
 const commands=[],published=[],status=[];let closed=false;
 let lastQuery='',measurementStarted=false,syntaxPending=false,firstOutput=true,systemRun=false;
 const instrumentInfo=[
  'slotno:1,name:SMU1,model:KISMU4200,serialno:SMU001,hwver:1.0,fwver:1.0,caldate:Jan 01, 2025,caldue:Jan 01, 2026',
  'slotno:2,name:SMU2,model:KISMU4200,serialno:SMU002,hwver:1.0,fwver:1.0,caldate:Jan 01, 2025,caldue:Jan 01, 2026'
 ].join(',');
 const remoteInfo='';
 const reply=value=>({base64:Buffer.from(value,'ascii').toString('base64')});
 const timerState={scheduled:0,cancelled:0,fired:0};
 const ctx={
  ui:{dom:{timeout(fn,ms){timerState.scheduled++;const id=setTimeout(()=>{timerState.fired++;fn();},ms);return()=>{timerState.cancelled++;clearTimeout(id);};}}},
  modules:{require:name=>modules.get(name)},
  capabilities:{
   get:id=>id==='network.tcp'?{id,kind:'network.transport',methods:['open','exchange','close']}:null,
   async invoke(id,method,payload={}){
    assert.equal(id,'network.tcp');
    if(method==='open')return {sessionId:'mock-4200-session',localAddress:'169.254.111.115',
     remoteAddress:'169.254.111.118',remotePort:1225,interfaceName:'USB Ethernet',routeStrategy:'local-address-bound'};
    if(method==='close'){closed=true;return true;}
    assert.equal(method,'exchange');
    const command=Buffer.from(payload.base64||'','base64').toString('ascii');
    commands.push({command,noReply:payload.noReply===true});
    if(command==='*IDN?\0')return reply('KI4200A,1498377,V1.14\0');
    if(command==='*OPT?\0')return reply('SMU1,SMU2\0');
    if(command==='US\0')measurementStarted=true;
    if(command==='ME1\0'){systemRun=true;measurementStarted=true;return reply('ACK\0');}
    if(command==='ME4\0'){systemRun=false;return reply('ACK\0');}
    if(/^(?:CH[1-9](?:,.*)?|SS|SM|MD|DM2|RS 7|VC[1-9],.*|ST .+|EC 1|WT .+|IN .+|NR .+|LI .+|VR1,.+|VL[1-9],.+|DT .+|HT .+|VP .+)\0$/.test(command))return reply('ACK\0');
    if(command==="DO 'V1'\0")return reply('N0.1,N0.1\0');
    if(command==="DO 'I1'\0")return reply('N1E-9,N2E-9\0');
    if(command==="DO 'V2'\0"||command==="DO 'I2'\0")return reply('N0,N0\0');
    if(command==="DO 'V1T'\0")return reply('0,0.12\0');
    if(measurementStarted&&options.syntaxOnFirstDv&&firstOutput&&/^DV[1-8],/.test(command)){firstOutput=false;syntaxPending=true;}
    if(options.failDvAck&&/^DV[1-8]/.test(command))return reply('');
    if(command==='UL\0'||command==='DE\0'||command==='US\0'||
       command===':ERROR:LAST:CLEAR\0'||command==='EM 1,0\0'||command==='BC\0'||/^IT[123]\0$/.test(command)||/^DV[1-8](?:,0,[^,]+,[^,]+)?\0$/.test(command)||
       /^RI [1-8],[^,]+,[^,]+\0$/.test(command)||/^RG [1-8],[^,]+\0$/.test(command))
      return reply('ACK\0');
    if(command==='EX SystemUtil instrumentinfo(,4096,)\0'){lastQuery='instrument';return reply('OK\0');}
    if(command==='EX SystemUtil remotemoduleinfo(,4096,)\0'){lastQuery='remote';return reply('OK\0');}
    if(command==='EX SystemUtil systeminfo(,2048,)\0'){lastQuery='system';return reply('OK\0');}
    if(command==='GN result\0')return reply(lastQuery==='instrument'?instrumentInfo+'\0':lastQuery==='system'?'serialno:1498377,swver:4200A-852-1.0,platformver:4200A-300-1,clariusver:V1.14\0':remoteInfo+'\0');
    if(command==='TI1\0')return reply('NAI+1.0000E-09\0');
    if(command==='TI2\0')return reply('NBI+0.0000E+00\0');
    if(command==='SP\0'){
      if(systemRun){systemRun=false;return reply('1\0');}
      if(options.busyAtStart&&!measurementStarted)return reply('16\0');
      if(syntaxPending){syntaxPending=false;return reply('2\0');}
      return reply('0\0');
    }
    if(command===':ERROR:LAST:GET\0')return reply(options.syntaxOnFirstDv?'KXCI command error. (-992)\0':'No error (0)\0');
    if(payload.noReply===true)throw Error('KXCI Ethernet command must drain its ACK');
    throw Error('Unexpected mock KXCI command: '+JSON.stringify(command));
   }
  },
  status:{set:value=>status.push(String(value))},
  project:{capture:()=>{}},
  data:{
   model:{createTable:spec=>({kind:'data.table',rowCount:spec.columns[0]?.values?.length||0,...spec})},
   artifacts:{publish:artifact=>{published.push(artifact);return {changed:true};}}
  }
 };
 return {ctx,commands,published,status,timerState,get closed(){return closed;}};
}

test('native Page maps to the same guarded Xsweep/Psweep KXCI domain contract',()=>{
 const {modules}=loadModules(),model=modules.get('model');
 let state=model.initial();
 state=model.edit(state,'D',{resource:'SMU1'});
 state=model.edit(state,'G',{resource:'SMU2',role:'P'});
 state=model.editSweep(state,{pEnabled:true,xRepeats:'2',pRepeats:'3',loops:'4'});
 const mapped=modules.get('measurementRuntime').pageToSweepProgram(state.pages[0]);
 assert.equal(mapped.kind,'iv');
 assert.deepEqual({...mapped.sweepProgram.terminals},{source:'GNDU',drain:'SMU1',gate:'SMU2'});
 assert.equal(mapped.sweepProgram.xSweep.terminal,'drain');
 assert.equal(mapped.sweepProgram.pSweep.terminal,'gate');
 assert.equal(mapped.sweepProgram.xSweep.repeats,2);
 assert.equal(mapped.sweepProgram.pSweep.repeats,3);
 assert.equal(mapped.sweepProgram.loops,4);
 assert.equal(mapped.sweepProgram.portSettings.drain.complianceMode,'follow-range');
 const bad=JSON.parse(JSON.stringify(state.pages[0]));
 bad.terminals.find(x=>x.logical==='B').resource='SMU3';
 assert.throws(()=>modules.get('measurementRuntime').pageToSweepProgram(bad),/衬底 B 端输出/);
 const current=JSON.parse(JSON.stringify(state.pages[0]));
 current.terminals.find(x=>x.logical==='D').sourceMode='current';
 assert.throws(()=>modules.get('measurementRuntime').pageToSweepProgram(current),/只支持电压源输出/);
 const wrongTarget=JSON.parse(JSON.stringify(state.pages[0]));
 wrongTarget.target={logical:'G',quantity:'Voltage'};
 assert.throws(()=>modules.get('measurementRuntime').pageToSweepProgram(wrongTarget),/漏极 SMU 电流/);
});

test('native runtime blocks legacy User Mode when its scoped execution permission is not enabled',async()=>{
 const {modules}=loadModules(false),{ctx,commands}=makeInstrumentContext(modules);
 const runtime=modules.get('measurementRuntime').createRuntime(ctx);
 try{
  const connected=await runtime.connectAndInspect({host:'169.254.111.118',port:1225,expectedSerial:'1498377'});
  assert.equal(connected.inventory.physicalModelsVerified,true);
  assert.equal(runtime.status().protocolVerified,false);
  const prepared=runtime.prepare(configuredPage(modules.get('model')));
  assert.equal(prepared.canExecute,false);
  assert.match(prepared.reason,/当前执行模式尚未取得输出许可/);
  assert.throws(()=>runtime.start(configuredPage(modules.get('model')),true),/当前执行模式尚未取得输出许可/);
  assert.equal(commands.some(row=>/^DV/.test(row.command)),false);
 }finally{await runtime.dispose();}
});

test('native runtime claims the communication console socket and automatically verifies identity and hardware',async()=>{
 const {modules}=loadModules(),fake=makeInstrumentContext(modules);
 const {capabilities}=fake.ctx;
 const nativeInvoke=capabilities.invoke,events=[];
 let opens=0,loseConnection=false;
 const consoleTcp=createInteractiveTcp({
  open:params=>{opens++;return nativeInvoke('network.tcp','open',params);},
  close:params=>nativeInvoke('network.tcp','close',params),
  exchange:params=>loseConnection?Promise.reject(Error('TCP session is unavailable or closed')):
   nativeInvoke('network.tcp','exchange',params)
 },event=>events.push(event));
 const methods={
  current:()=>consoleTcp.current(),claim:value=>consoleTcp.claim(value),
  open:({settings,owner})=>consoleTcp.open(settings,owner),
  exchange:value=>consoleTcp.exchange(value),close:value=>consoleTcp.close(value),release:value=>consoleTcp.release(value)
 };
 capabilities.get=id=>id==='network.tcp.interactive'?{id}:null;
 capabilities.invoke=(id,method,params)=>{
  assert.equal(id,'network.tcp.interactive');
  return methods[method](params);
 };
 const runtime=modules.get('measurementRuntime').createRuntime(fake.ctx,{onChange:value=>events.push(value.event)});
 const settings={host:'192.0.2.10',port:1225};
 try{
  const opened=await consoleTcp.open(settings);
  assert.equal(runtime.currentTcp().sessionId,opened.sessionId);
  await assert.rejects(runtime.connectAndInspect({...settings,expectedSerial:'different'},opened.sessionId),/序列号不匹配/);
  assert.equal(consoleTcp.current().owner,'','identity mismatch returns an existing raw session to the console');
  assert.equal(runtime.status().connection.identity,null);

  const verified=await runtime.connectAndInspect(settings,opened.sessionId);
  assert.equal(opens,1,'no second TCP socket is opened');
  assert.equal(verified.identity.serial,'1498377');
  assert.equal(verified.inventory.physicalModelsVerified,true);
  assert.equal(consoleTcp.current().owner,OWNER);
  await assert.rejects(consoleTcp.exchange({sessionId:opened.sessionId,base64:''}),/无法传输/);
  await assert.rejects(consoleTcp.close({sessionId:opened.sessionId}),/由设备工作区管理/);
  assert.equal(runtime.prepare(configuredPage(modules.get('model'))).canExecute,false);
  assert.ok(!fake.commands.some(row=>/^DV/.test(row.command)));

  loseConnection=true;
  await runtime.checkConnection();
  assert.equal(runtime.status().connection.phase,'error');
  assert.equal(runtime.status().connection.inventory,null);
  assert.equal(consoleTcp.current(),null);
  assert.ok(events.includes('connection-lost'));
 }finally{await runtime.dispose();}
});

test('an interactive TCP claim waits until the generic console exchange ends',async()=>{
 let finish;
 const consoleTcp=createInteractiveTcp({
  open:async()=>({sessionId:'1'}),
  close:async()=>true,
  exchange:()=>new Promise(resolve=>{finish=resolve;})
 },()=>{});
 const settings={host:'192.0.2.10',port:5000};
 await consoleTcp.open(settings);
 const pending=consoleTcp.exchange({sessionId:'1',base64:'AA=='});
 assert.throws(()=>consoleTcp.claim({sessionId:'1',owner:OWNER}),/正在传输/);
 await assert.rejects(consoleTcp.open(settings,OWNER),/已有 TCP 会话/);
 finish({base64:'AA=='});
 await pending;
 assert.equal(consoleTcp.claim({sessionId:'1',owner:OWNER}).owner,OWNER);
 await consoleTcp.close({sessionId:'1',owner:OWNER});
});

test('native runtime blocks timed execution when the DKDS lifecycle timer is unavailable',async()=>{
 const {modules}=loadModules(true),{ctx,commands}=makeInstrumentContext(modules);
 delete ctx.ui.dom;
 const runtime=modules.get('measurementRuntime').createRuntime(ctx);
 try{
  await runtime.connectAndInspect({host:'169.254.111.118',port:1225,expectedSerial:'1498377'});
  const prepared=runtime.prepare(configuredPage(modules.get('model')));
  assert.equal(prepared.protocolVerified,true);
  assert.equal(prepared.executionAdapterAvailable,false);
  assert.equal(prepared.canExecute,false);
  assert.match(prepared.reason,/生命周期管理的 DOM 定时服务/);
  assert.throws(()=>runtime.start(configuredPage(modules.get('model')),true),/生命周期管理/);
  assert.equal(commands.some(row=>/^DV/.test(row.command)),false);
 }finally{await runtime.dispose();}
});


test('native stop cancels the DKDS-owned point timer before shutting down SMUs',async()=>{
 const {modules}=loadModules(true),fake=makeInstrumentContext(modules);
 const runtime=modules.get('measurementRuntime').createRuntime(fake.ctx);
 try{
  await runtime.connectAndInspect({host:'169.254.111.118',port:1225,expectedSerial:'1498377'});
  const page=configuredPage(modules.get('model'));
  runtime.start(page,true);
  for(let i=0;i<30&&fake.timerState.scheduled===0;i++)
   await new Promise(resolve=>setTimeout(resolve,1));
  assert.equal(fake.timerState.scheduled,1,'the first point delay is owned by DKDS DOM runtime');
  runtime.stop();
  const final=await runtime.waitForCompletion();
  assert.equal(final.run.state,'stopped');
  assert.equal(final.run.shutdown,'commands-sent');
  assert.equal(fake.timerState.cancelled,1,'stop cancels the outstanding lifecycle timer');
  assert.equal(fake.timerState.fired,0,'a cancelled settling timer must not fire after stop');
  assert.equal(fake.commands.some(row=>row.command==='TI1\0'),false,'stop during settling does not trigger a measurement');
  assert.equal(fake.commands.filter(row=>/^DV[1-9]\0$/.test(row.command)).at(-1).command,'DV1\0','all active SMUs are commanded off before the run ends');
 }finally{await runtime.dispose();}
});

test('native runtime refuses disconnect when a final SMU-off ACK is unconfirmed',async()=>{
 const {modules}=loadModules(true),fake=makeInstrumentContext(modules,{failDvAck:true});
 const runtime=modules.get('measurementRuntime').createRuntime(fake.ctx,{wait:async()=>{}});
 try{
  await runtime.connectAndInspect({host:'169.254.111.118',port:1225,expectedSerial:'1498377'});
  const page=configuredPage(modules.get('model'));
  assert.equal(runtime.prepare(page).canExecute,true);
  runtime.start(page,true);
  const final=await runtime.waitForCompletion();
  assert.equal(final.run.state,'failed');
  assert.equal(final.run.shutdown,'unconfirmed');
  await assert.rejects(()=>runtime.disconnect(),/SMU 输出关闭未获确认/);
  assert.equal(runtime.status().connection.phase,'connected');
  assert.equal(fake.closed,false,'the controller must not close a session after an unconfirmed SMU-off ACK');
  assert.equal(runtime.prepare(page).canExecute,false);
 }finally{await runtime.dispose();}
});

test('native runtime verifies compact KI4200A identity, physical modules, gates output and publishes real TI rows',async()=>{
 const {modules}=loadModules(true),{ctx,commands,published,timerState}=makeInstrumentContext(modules);
 const runtime=modules.get('measurementRuntime').createRuntime(ctx);
 try{
  const connected=await runtime.connectAndInspect({host:'169.254.111.118',port:1225,
   expectedSerial:'1498377',networkMode:'ethernet'});
  assert.equal(connected.phase,'connected');
  assert.equal(connected.identity.model,'KI4200A');
  assert.equal(connected.identity.format,'compact');
  assert.equal(connected.inventory.physicalModelsVerified,true);
  assert.equal(connected.inventory.hardwareLimitsVerified,true);
  assert.equal(runtime.status().protocolVerified,true);
  assert.ok(commands.filter(row=>['UL\0','DE\0'].includes(row.command)).every(row=>row.noReply===false),
   'module-mode transitions must consume their Ethernet ACK responses');
  const page=configuredPage(modules.get('model'));
  const prepared=runtime.prepare(page);
  assert.equal(prepared.canExecute,true);
  assert.equal(prepared.pointCount,2);
  assert.throws(()=>runtime.start(page,false),/必须经过用户确认/);
  assert.equal(commands.some(row=>/^DV/.test(row.command)),false,
   'no source-output command is sent before the explicit confirmation argument');
  const initial=runtime.start(page,true);
  assert.equal(initial.running,true);
  const final=await runtime.waitForCompletion();
  assert.equal(final.run.state,'completed');
  assert.equal(final.run.shutdown,'commands-sent');
  assert.equal(final.rows,2);
  assert.equal(timerState.scheduled,2,'the supported DKDS DOM timer schedules each configured point delay');
  assert.equal(timerState.fired,2,'completed point timers fire through the DKDS DOM runtime');
  assert.equal(timerState.cancelled,0,'naturally completed timers are not redundantly cancelled');
  assert.equal(final.published.canonical,true);
  assert.equal(published.length,1);
  const artifact=published[0];
  assert.equal(artifact.id,'dkts:kxci:'+initial.runId);
  assert.equal(artifact.metadata.instrumentSerial,'1498377');
  const column=key=>artifact.columns.find(row=>row.key===key);
  assert.deepEqual(Array.from(column('drainVoltageV').values),[0,.1]);
  assert.deepEqual(Array.from(column('drainCurrentA').values),[1e-9,1e-9]);
  assert.deepEqual(Array.from(column('xVoltageV').values),[0,.1]);
  assert.deepEqual(Array.from(column('rawKxciResponse').values),['NAI+1.0000E-09','NAI+1.0000E-09']);
  assert.equal(commands.filter(row=>/^DV[1-9]\0$/.test(row.command)).at(-1).command,'DV1\0');
  assert.equal(commands.at(-1).command,'SP\0','confirm last off command status');
  assert.ok(commands.filter(row=>/^DV/.test(row.command)||row.command==='US\0'||
   row.command===':ERROR:LAST:CLEAR\0').every(row=>row.noReply===false),
   'every write-only KXCI command must consume and validate ACK before the next query');
  await runtime.disconnect();
  assert.equal(runtime.status().connection.phase,'disconnected');
 }finally{await runtime.dispose();}
});


test('busy instrument preflight does not clear buffers or drive or disable other tests',async()=>{
 const {modules}=loadModules(true),fake=makeInstrumentContext(modules,{busyAtStart:true});
 const runtime=modules.get('measurementRuntime').createRuntime(fake.ctx,{wait:async()=>{}});
 try{
  await runtime.connectAndInspect({host:'169.254.111.118',port:1225,expectedSerial:'1498377'});
  runtime.start(configuredPage(modules.get('model')),true);
  const final=await runtime.waitForCompletion();
  assert.equal(final.run.state,'failed');
  assert.equal(final.run.shutdown,'not-started');
  assert.match(final.run.error,/已有测量/);
  assert.ok(!fake.commands.some(row=>/^DV/.test(row.command)||row.command==='BC\0'||row.command==='US\0'));
 }finally{await runtime.dispose();}
});
test('SP detects syntax error after first output before further source settings',async()=>{
 const {modules}=loadModules(true),fake=makeInstrumentContext(modules,{syntaxOnFirstDv:true});
 const runtime=modules.get('measurementRuntime').createRuntime(fake.ctx,{wait:async()=>{}});
 try{
  await runtime.connectAndInspect({host:'169.254.111.118',port:1225,expectedSerial:'1498377'});
  runtime.start(configuredPage(modules.get('model')),true);
  const final=await runtime.waitForCompletion();
  assert.equal(final.run.state,'failed');
  assert.match(final.run.error,/-992/);
  assert.equal(final.run.shutdown,'commands-sent');
  assert.equal(fake.commands.filter(row=>/^DV[1-9],/.test(row.command)).length,1);
  assert.ok(!fake.commands.some(row=>/^TI/.test(row.command)));
 }finally{await runtime.dispose();}
});
test('real DC model reaches guarded SMU runner in point-by-point mode',async()=>{
 const {modules}=loadModules(true),fake=makeInstrumentContext(modules);
 const model=modules.get('model'),runtime=modules.get('measurementRuntime').createRuntime(fake.ctx);
 try{
  const state=model.validate(model.initial());
  const page=state.pages.find(row=>row.kind==='dc');
  page.dc.preset='point-by-point';
  page.dc.terminals.D.segments[0].stop='0.1';
  page.dc.terminals.D.segments[0].step='0.1';
  await runtime.connectAndInspect({host:'169.254.111.118',port:1225,expectedSerial:'1498377'});
  assert.equal(runtime.prepare(page).canExecute,true);
  runtime.start(page,true);
  const result=await runtime.waitForCompletion();
  assert.equal(result.run.state,'completed');
  assert.equal(result.rows,2);
  assert.equal(fake.commands.filter(row=>row.command==='TI1\0').length,2);
 }finally{await runtime.dispose();}
});
test('real time model executes fixed-bias events with selected integration and actual times',async()=>{
 const {modules}=loadModules(true),fake=makeInstrumentContext(modules);
 const model=modules.get('model'),runtime=modules.get('measurementRuntime').createRuntime(fake.ctx);
 try{
  const state=model.add(model.validate(model.initial()),'time'),page=state.pages.at(-1);
  page.timing.mode='native-fixed';
  page.timing.integrationPreset='short';
  page.timing.segments[0].durationS='0.3';
  page.timing.segments[0].bias.D='0.1';
  page.timing.events[0]={...page.timing.events[0],startS:'0.05',intervalS:'0.1',averageS:'0.08',points:'2'};
  await runtime.connectAndInspect({host:'169.254.111.118',port:1225,expectedSerial:'1498377'});
  assert.equal(runtime.prepare(page).canExecute,true);
  runtime.start(page,true);
  const result=await runtime.waitForCompletion();
  assert.equal(result.run.state,'completed');
  assert.equal(result.rows,2);
  assert.equal(fake.commands.filter(row=>row.command==='IT1\0').length,1);
  assert.equal(fake.commands.filter(row=>row.command==='ME1\0').length,1);
  assert.equal(fake.commands.filter(row=>row.command==='TI1\0').length,0);
  const rows=result.run.rows;
  assert.deepEqual(Array.from(rows,row=>row.timeS),[0,0.12]);
  assert.ok(rows.every(row=>row.source==='4200A-KXCI-DO'));
 }finally{await runtime.dispose();}
});

test('Rev F scoped System Mode can run independently of the old User Mode gate',async()=>{
 const {modules}=loadModules(false),fake=makeInstrumentContext(modules);
 const model=modules.get('model'),runtime=modules.get('measurementRuntime').createRuntime(fake.ctx,{wait:async()=>{}});
 try{
  const state=model.validate(model.initial()),page=state.pages.find(p=>p.kind==='dc');
  page.dc.preset='optimized';
  page.dc.terminals.D.segments[0].stop='0.1';
  page.dc.terminals.D.segments[0].step='0.1';
  await runtime.connectAndInspect({host:'169.254.111.118',port:1225,expectedSerial:'1498377'});
  assert.equal(runtime.prepare(page).canExecute,true);
  runtime.start(page,true);const result=await runtime.waitForCompletion();
  assert.equal(result.run.state,'completed');
  assert.equal(result.rows,2);
  assert.equal(result.published.canonical,true);
  assert.equal(fake.commands.filter(c=>c.command==='ME1\0').length,1);
  assert.ok(!fake.commands.some(c=>/^(DV|TI)/.test(c.command)));
 }finally{await runtime.dispose();}
});
