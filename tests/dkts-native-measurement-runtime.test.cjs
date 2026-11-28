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
  require:(id,name)=>{if(!modules.has(name??id))throw Error('missing module '+(name??id));if(name)assert.equal(id,OWNER);return modules.get(name??id);}
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
 let state=model.editPage(model.initial(),{kind:'iv'});
 state=model.edit(state,'D',{resource:'SMU1'});
 const page=state.pages[0];
 page.sweep.xSegments=[{start:'0',stop:'0.1',step:'0.1',delayMs:'5',range:'auto'}];
 return page;
}
function makeInstrumentContext(modules,options={}){
 const commands=[],published=[],status=[];let closed=false;
 let lastQuery='',measurementStarted=false,syntaxPending=false,firstOutput=true,systemRun=false,pulseBusy=false,pulseReadCount=0;
 let kultBusy=false,kultToken=0;
 const instrumentInfo=[
  'slotno:1,name:SMU1,model:KISMU4200,serialno:SMU001,hwver:1.0,fwver:1.0,caldate:Jan 01, 2025,caldue:Jan 01, 2026',
  'slotno:2,name:SMU2,model:KISMU4200,serialno:SMU002,hwver:1.0,fwver:1.0,caldate:Jan 01, 2025,caldue:Jan 01, 2026',
  ...(options.pmu?['slotno:3,name:PMU1,model:'+(options.pmuModel||'4225-PMU')+',serialno:PMU001,hwver:1.0,fwver:1.0,caldate:Jan 01, 2025,caldue:Jan 01, 2026']:[])
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
    if(command==='*OPT?\0')return reply(options.pmu?'SMU1,SMU2,PMU1\0':'SMU1,SMU2\0');
    if(options.pmu){
     if(options.failPmuOffAck&&command===':PMU:OUTPUT:STATE 1,0\0')return reply('');
     if(command===':PMU:EXECUTE\0'){pulseBusy=true;return reply('ACK\0');}
     if(command===':PMU:TEST:STATUS?\0'){
      if(pulseBusy){pulseBusy=false;return reply('1\0');}
      return reply('0\0');
     }
     if(command===':PMU:DATA:COUNT? 1\0')return reply('2\0');
     if(command===':PMU:DATA:GET 1,0,2,VH,IH,TH,SH\0'){
      return reply(pulseReadCount++===0?'\0':'0.75,1E-6,0.00003,0;0.76,1.1E-6,0.000061,0\0');
     }
     if(/^:PMU:(?:INIT |LOAD |LLEC:CONFIGURE |SOURCE:RANGE |MEASURE:(?:RANGE|MODE|PIV) |SAMPLE:RATE |PULSE:(?:BURST:COUNT|TIMES|TRAIN) |SWEEP:PULSE:AMPLITUDE |TIMES:PIV |SARB:|OUTPUT:STATE |ABORT\0)/.test(command))return reply('ACK\0');
    }
    if(options.smuPulse){
     if(command==='GD DKTSsmu Smupulse\0')return reply((options.missingKult?'ACK':'DKTS_SMU_PULSE_ABI_1')+'\0');
     if(command.startsWith('EX DKTSsmu Smupulse(')){
      const args=command.slice(command.indexOf('(')+1,-2).split(',');
      assert.equal(args.length,22);
      kultToken=Number(args[14]);
      kultBusy=true;
      return reply((options.kultNumericReply?'0':'ACK')+'\0');
     }
     if(command==='AB\0'){kultBusy=false;return reply('ACK\0');}
     if(command==='SP\0'&&kultBusy){if(!options.kultPersistentBusy)kultBusy=false;return reply('16\0');}
     if(command==='GN receipt\0')return reply(String(options.staleKult?kultToken-1:kultToken)+'\0');
     if(command==='GN vd 2\0')return reply('0.101;0.197\0');
     if(command==='GN id 2\0')return reply('1.2E-6;1E22\0');
     if(command==='GN elapsed 2\0')return reply('0.011;0.045\0');
     if(command==='ZE\0'&&options.kultShutdownFails&&commands.some(row=>row.command.startsWith('EX DKTSsmu')))
      return reply('ERROR\0');
    }
    if(command==='US\0')measurementStarted=true;
    if(command==='ME1\0'){systemRun=true;measurementStarted=true;return reply('ACK\0');}
    if(command==='ME4\0'){systemRun=false;return reply('ACK\0');}
    if(/^(?:CH[1-9](?:,.*)?|SS|ZE|SM|MD|DM2|RS 7|VC[1-9],.*|ST .+|EC 1|WT .+|IN .+|NR .+|LI .+|VR1,.+|VL[1-9],.+|DT .+|HT .+|VP .+)\0$/.test(command))return reply('ACK\0');
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
    if(/^TV[12]\0$/.test(command)){const ch=Number(command[2]);const last=commands.filter(r=>r.command.startsWith('DV'+ch+',')).at(-1);const v=last?Number(last.command.split(',')[2]):0;return reply('N'+(ch===1?'A':'B')+'V'+v.toExponential(4)+'\0');}
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
 let state=model.editPage(model.initial(),{kind:'iv'});
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
  assert.match(prepared.reason,/生命周期管理的查询\/停止调度器/);
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
  await assert.rejects(()=>runtime.disconnect(),/仪器输出关闭未获确认/);
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
 const model=modules.get('model'),runtime=modules.get('measurementRuntime').createRuntime(fake.ctx,{getSmuIntegration:()=> 'long'});
 try{
  const state=model.add(model.validate(model.initial()),'time'),page=state.pages.at(-1);
  page.timing.mode='native-fixed';
  page.timing.integrationPreset='short';
  assert.equal(model.timeReference(page),'S');
  assert.deepEqual(Array.from(model.timeGroundNodes(page)),['GND','S']);
  page.timing.reference='GND';
  page.timing.segments[0].durationS='0.3';
  page.timing.segments[0].bias.D='0.1';
  page.timing.events[0]={...page.timing.events[0],startS:'0.05',intervalS:'0.1',averageS:'0.08',points:'2'};
  await runtime.connectAndInspect({host:'169.254.111.118',port:1225,expectedSerial:'1498377'});
  assert.match(runtime.prepare({...page,timing:{...page.timing,reference:'D'}}).reason,/GNDU/);
  const inherited=runtime.prepare({...page,timing:{...page.timing,integrationPreset:'instrument'}});
  assert.equal(inherited.input.timeProgram.integration,'IT3');
  assert.equal(runtime.prepare(page).canExecute,true);
  runtime.start(page,true);
  const result=await runtime.waitForCompletion();
  assert.equal(result.run.state,'completed');
  assert.equal(result.rows,2);
  assert.equal(fake.commands.filter(row=>row.command==='IT1\0').length,1);
  assert.ok(fake.commands.some(row=>row.command==='NR 2\0'));
  assert.equal(fake.commands.filter(row=>row.command==='ME1\0').length,1);
  assert.equal(fake.commands.filter(row=>row.command==='TI1\0').length,0);
  const rows=result.run.rows;
  assert.deepEqual(Array.from(rows,row=>row.timeS),[0,0.12]);
  assert.ok(rows.every(row=>row.source==='4200A-KXCI-DO'));
 }finally{await runtime.dispose();}
});

test('Rev F scoped System Mode can run independently of the old User Mode gate',async()=>{
 const {modules}=loadModules(false),fake=makeInstrumentContext(modules);
 const model=modules.get('model'),runtime=modules.get('measurementRuntime').createRuntime(fake.ctx,{wait:async()=>{},getSmuIntegration:()=> 'long'});
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
  assert.ok(fake.commands.some(c=>c.command==='IT3\0'));
  assert.ok(!fake.commands.some(c=>/^(DV|TI)/.test(c.command)));
 }finally{await runtime.dispose();}
});

test('segmented pulse uses the verified PMU port, exact hold profile and original readback',async()=>{
 const {modules}=loadModules(),model=modules.get('model'),runtimeModule=modules.get('measurementRuntime');
 const seeded=model.validate(model.initial()),timePage=seeded.pages.find(p=>p.kind==='time');
 let project=model.select(seeded,timePage.id);
 project=model.editTiming(project,{mode:model.TIME_PMU_MODE});
 project=model.edit(project,'D',{resource:'PMU1-1'});
 const page=project.pages.find(p=>p.id===timePage.id),pmu=page.timing.pmu;
 assert.equal(page.kind,'time');
 assert.equal(page.timing.mode,model.TIME_PMU_MODE);
 const steps={...pmu.biasSteps,loops:'2',segments:[
  {...pmu.biasSteps.segments[0],durationUs:'5'},
  {...pmu.biasSteps.segments[1],biasV:'0.8',durationUs:'25',measureStartUs:'3'},
  {...pmu.biasSteps.segments[2],durationUs:'4'}
 ]};
 Object.assign(pmu,{biasSteps:steps,loadOhms:'1000000',currentRangeA:'0.01',sampleStepUs:'0.5'});
 const capabilities=modules.get('dkts-capabilities');
 const preview=capabilities.segmentArbPreview(pmu);
 assert.equal(preview.durationTicks,3404);
 assert.deepEqual(Array.from(preview.segments,s=>[s.startV,s.stopV]),[[0,0],[0,.8],[.8,.8],[.8,0],[0,0]]);
 assert.deepEqual({...preview.segments[2].window},{startTicks:802,endTicks:3002});
 const hardware=modules.get('dkts-kxci-measurement');
 const blockedDatabase=JSON.parse(JSON.stringify(capabilities.DATABASE));
 blockedDatabase.safetyPolicies.kxci.allowSegmentArbOutput=false;
 modules.set('dkts-capabilities',{...capabilities,DATABASE:blockedDatabase});
 const fake=makeInstrumentContext(modules,{pmu:true});
 const blocked=runtimeModule.createRuntime(fake.ctx,{wait:async()=>{}});
 const endpoint={host:'169.254.111.118',port:1225,expectedSerial:'1498377'};
 try{
  await blocked.connectAndInspect(endpoint);
  const check=blocked.prepare(page);
  assert.equal(check.ready,true,check.reason);
  assert.equal(check.canExecute,false);
  assert.throws(()=>blocked.start(page,true),/未开放/);
  assert.ok(fake.commands.every(row=>!row.command.startsWith(':PMU:')));
 }finally{await blocked.dispose();}
 modules.set('dkts-capabilities',capabilities);
 const commissioned=makeInstrumentContext(modules,{pmu:true});
 const runtime=runtimeModule.createRuntime(commissioned.ctx,{wait:async()=>{}});
 try{
  await runtime.connectAndInspect(endpoint);
  const prepared=runtime.prepare(page);
  assert.equal(prepared.canExecute,true,prepared.reason);
  const {pulse}=prepared.compiled;
  assert.equal(pulse.durationTicksExact,'6808');
  assert.equal(pulse.expected,2);
  assert.ok(pulse.setup.includes(':PMU:SARB:SEQ:TIME 1,1,0.000005,0.00000002,0.000025,0.00000002,0.000004'));
  assert.ok(pulse.setup.includes(':PMU:SAMPLE:RATE 2000000'));
  assert.ok(pulse.setup.includes(':PMU:SARB:SEQ:MEAS:START 1,1,0,0,0.000003,0,0'));
  assert.ok(pulse.setup.includes(':PMU:SARB:SEQ:MEAS:STOP 1,1,0,0,0.000025,0,0'));
  const invalidWindow={...pmu,biasSteps:{...steps,segments:steps.segments.map((s,i)=>i===1?{...s,measureStopUs:'26'}:s)}};
  assert.throws(()=>hardware.compileSweep({...prepared.input,settings:invalidWindow},{inventory:prepared.inventory,capabilities}),/窗口/);
  runtime.start(page,true);
  const result=await runtime.waitForCompletion();
  assert.equal(result.run.state,'completed',result.run.error);
  assert.equal(result.run.shutdown,'commands-sent');
  assert.equal(result.rows,2);
  assert.deepEqual(Array.from(result.run.rows,r=>[r.timeS,r.pulseVoltageV,r.rawKxciResponse]),[
   [0.00003,0.75,'0.75,1E-6,0.00003,0'],[0.000061,0.76,'0.76,1.1E-6,0.000061,0']
  ]);
  assert.equal(result.published.canonical,true);
  const commands=commissioned.commands.map(row=>row.command);
  assert.equal(commands.filter(c=>c===':PMU:EXECUTE\0').length,1);
  assert.ok(commands.indexOf(':PMU:OUTPUT:STATE 1,0\0')<commands.lastIndexOf(':PMU:DATA:GET 1,0,2,VH,IH,TH,SH\0'));
 }finally{await runtime.dispose();}
});

test('linear time sampling rejects oversized grids and can repair older saved plans',()=>{
 const {modules}=loadModules(),model=modules.get('model');
 const project=model.initial(),timePage=project.pages.find(page=>page.kind==='time');
 project.activeId=timePage.id;
 timePage.timing.mode='linear-step';
 const timing=timePage.timing;
 assert.equal(model.timeGrid({...timing,sampleStepS:'0.0000152587890625'}).samplePoints,65536);
 for(const sampleStepS of ['1e-12','1e-100','0','2']){
  assert.throws(()=>model.timeGrid({...timing,sampleStepS}),error=>error.field==='sampleStepS');
 }
 timing.sampleStepS='1e-12';
 const restored=model.validate(JSON.parse(JSON.stringify(project)));
 assert.equal(restored.pages.find(page=>page.id===timePage.id).timing.sampleStepS,'1e-12');
 assert.throws(()=>model.editTiming(restored,{sampleStepS:'1e-9'}),error=>error.field==='sampleStepS');
 const repaired=model.editTiming(restored,{sampleStepS:'0.001'});
 assert.equal(model.timedSummary('time',repaired.pages.find(page=>page.id===timePage.id).timing).samplePoints,1000);
});

test('Pulse I–V switches from DC, restores both configurations, and publishes spot records from mocked instrument replies',async()=>{
 const {modules}=loadModules(),model=modules.get('model'),capabilities=modules.get('dkts-capabilities');
 const runtimeModule=modules.get('measurementRuntime');
 const original=model.initial(),id=original.activeId;
 const dc=model.setIvType(original,'point-by-point');
 const dcProfile=dc.pages.find(p=>p.id===id).dc;
 let project=model.setIvType(dc,'pulse');
 assert.equal(project.activeId,id);
 assert.equal(project.pages.find(p=>p.id===id).name,'Pulse I–V');
 project=model.editTiming(project,{start:'0.5',step:'0.5',loadOhms:'1000000',currentRangeA:'0.01'});
 const restored=model.setIvType(JSON.parse(JSON.stringify(project)),'point-by-point');
 assert.deepEqual(restored.pages.find(p=>p.id===id).dc,dcProfile);
 const both=model.setIvType(restored,'pulse');
 const snapshot=model.templateSnapshot(both,'test',id);
 const imported=model.insertSetup(original,snapshot);
 assert.deepEqual(imported.pages.find(p=>p.id===imported.activeId).ivAlternate,dcProfile);
 project=model.edit(both,'D',{resource:'PMU1-1'});
 const page=project.pages.find(p=>p.id===id);
 assert.equal(page.timing.start,'0.5');
 const endpoint={host:'169.254.111.118',port:1225,expectedSerial:'1498377'};
 const blockedDatabase=JSON.parse(JSON.stringify(capabilities.DATABASE));
 blockedDatabase.safetyPolicies.kxci.allowPulseModeOutput=false;
 modules.set('dkts-capabilities',{...capabilities,DATABASE:blockedDatabase});
 const guarded=makeInstrumentContext(modules,{pmu:true});
 const blocked=runtimeModule.createRuntime(guarded.ctx,{wait:async()=>{}});
 try{
  await blocked.connectAndInspect(endpoint);
  const prepared=blocked.prepare(page);
  assert.equal(prepared.ready,true,prepared.reason);
  assert.equal(prepared.canExecute,false);
  assert.throws(()=>blocked.start(page,true),/未开放/);
  assert.ok(guarded.commands.every(row=>!row.command.startsWith(':PMU:')));
 }finally{await blocked.dispose();}
 modules.set('dkts-capabilities',capabilities);
 const fixture=makeInstrumentContext(modules,{pmu:true});
 const runtime=runtimeModule.createRuntime(fixture.ctx,{wait:async()=>{}});
 try{
  await runtime.connectAndInspect(endpoint);
  const prepared=runtime.prepare(page);
  assert.equal(prepared.canExecute,true,prepared.reason);
  assert.equal(prepared.compiled.pulse.expected,2);
  assert.throws(()=>runtime.start(page,false),/确认接线/);
  assert.ok(fixture.commands.every(row=>!row.command.startsWith(':PMU:')));
  assert.ok(prepared.compiled.pulse.setup.includes(':PMU:SWEEP:PULSE:AMPLITUDE 1,0.5,1,0.5,0,0'));
  const spotWindow=prepared.compiled.pulse.setup.find(command=>command.startsWith(':PMU:TIMES:PIV 1,'));
  assert.ok(spotWindow,prepared.compiled.pulse.setup.join('\n'));
  const [,start,stop]=spotWindow.split(',').map(Number);
  assert.ok(Math.abs(start-0.2)<1e-9&&Math.abs(stop-0.8)<1e-9,spotWindow);
  runtime.start(page,true);
  const result=await runtime.waitForCompletion();
  assert.equal(result.run.state,'completed',result.run.error);
  assert.equal(result.published.canonical,true);
  assert.deepEqual(Array.from(result.run.rows,row=>[row.pulseProgram,row.timeS,row.rawKxciResponse]),[
   ['pulse-sweep',0.00003,'0.75,1E-6,0.00003,0'],['pulse-sweep',0.000061,'0.76,1.1E-6,0.000061,0']
  ]);
  const commands=fixture.commands.map(row=>row.command);
  assert.ok(commands.includes(':PMU:EXECUTE\0'));
  assert.ok(commands.indexOf(':PMU:OUTPUT:STATE 1,0\0')<commands.lastIndexOf(':PMU:DATA:GET 1,0,2,VH,IH,TH,SH\0'));
 }finally{await runtime.dispose();}
});

test('SMU Pulse I–V uses the installed LPT module and publishes only returned values',async()=>{
 const {modules}=loadModules(),model=modules.get('model');
 const makePage=()=>{
  let project=model.setIvType(model.initial(),'pulse-smu');
  const page=project.pages.find(row=>row.id===project.activeId);
  assert.equal(page.timing.testMode,'smu-sweep');
  project=model.editTiming(project,{smu:{...page.timing.smu,start:'0.1',stop:'0.2',step:'0.1',gateRole:'condition',gateV:'1.2'}});
  return project.pages.find(row=>row.id===project.activeId);
 };
 const page=makePage();
 assert.throws(()=>model.smuPulseSummary({...page.timing.smu,onMs:'0.05'}),/5–20000/);
 const endpoint={host:'169.254.111.118',expectedSerial:'1498377'};
 const fixture=makeInstrumentContext(modules,{smuPulse:true,kultNumericReply:true});
 const runtime=modules.get('measurementRuntime').createRuntime(fixture.ctx,{wait:async()=>{}});
 try{
  await runtime.connectAndInspect(endpoint);
  const prepared=runtime.prepare(page);
  assert.equal(prepared.canExecute,true,prepared.reason);
  assert.equal(prepared.compiled.commandMode,'KXCI-SMU-PULSE-KULT');
  assert.deepEqual({...prepared.channels},{drain:1,gate:2});
  assert.match(prepared.compiled.smuPulse.moduleExecute,/Smupulse\(1,2,0.1,0.2,2,5,20,1.2,0.001,0.2,0.001/);
  assert.throws(()=>runtime.start(page,false),/必须经过用户确认/);
  assert.equal(fixture.commands.some(row=>row.command.startsWith('EX DKTSsmu')),false);
  runtime.start(page,true);
  const result=await runtime.waitForCompletion();
  assert.equal(result.run.state,'completed',result.run.error);
  assert.equal(result.run.shutdown,'commands-sent');
  assert.equal(result.rows,2);
  assert.equal(result.published?.canonical,true,result.publishError);
  assert.deepEqual(Array.from(result.run.rows,row=>row.drainVoltageV),[0.101,0.197]);
  assert.equal(result.run.rows[0].gateVoltageV,undefined);
  assert.equal(result.run.rows[0].plannedGateVoltageV,1.2);
  assert.equal(result.run.rows[1].measurementCompleteness,'partial');
  assert.equal(result.run.rows[1].rawKxciResponse,'0.197;1E22;0.045');
  assert.equal(fixture.published[0].metadata.timeOrigin,'instrument-after-mpulse');
  const commands=fixture.commands.map(row=>row.command);
  assert.ok(commands.indexOf('GD DKTSsmu Smupulse\0')<commands.findIndex(command=>command.startsWith('EX DKTSsmu')));
  assert.ok(commands.includes('ZE\0'));
 }finally{await runtime.dispose();}
 for(const [options,message] of [
  [{missingKult:true},/安装并构建/],
  [{staleKult:true},/本次运行的关断回执/],
  [{kultShutdownFails:true},/ZE/]
 ]){
  const failure=makeInstrumentContext(modules,{smuPulse:true,...options});
  const api=modules.get('measurementRuntime').createRuntime(failure.ctx,{wait:async()=>{}});
  try{
   await api.connectAndInspect(endpoint);
   api.start(page,true);
   const result=await api.waitForCompletion();
   assert.equal(result.run.state,'failed');
   assert.match(result.run.error,message);
   if(options.missingKult){
    assert.equal(result.run.shutdown,'not-started');
    assert.equal(failure.commands.some(row=>row.command.startsWith('EX DKTSsmu')),false);
   }
   if(options.staleKult)assert.equal(result.rows,0);
   if(options.kultShutdownFails){
    assert.equal(result.run.shutdown,'unconfirmed');
    assert.equal(api.prepare(page).canExecute,false);
   }
  }finally{await api.dispose();}
 }
 const stopped=makeInstrumentContext(modules,{smuPulse:true,kultPersistentBusy:true});
 let cancel;
 const api=modules.get('measurementRuntime').createRuntime(stopped.ctx,{wait:async()=>{cancel();}});
 try{
  cancel=()=>api.stop();
  await api.connectAndInspect(endpoint);
  api.start(page,true);
  const result=await api.waitForCompletion();
  assert.equal(result.run.state,'stopped',result.run.error);
  assert.equal(result.run.shutdown,'commands-sent');
  assert.equal(result.rows,0);
  assert.ok(stopped.commands.some(row=>row.command==='AB\0'));
 }finally{await api.dispose();}
});

test('Pulse I–V can accompany Xsweep with a constant gate bias and records only measured X data',async()=>{
 const {modules}=loadModules(),model=modules.get('model');
 let project=model.setIvType(model.initial(),'pulse');
 const initial=project.pages.find(page=>page.id===project.activeId).timing;
 const secondary={terminal:'G',role:'condition',conditionV:'1.2',channel:'2',rangeV:'10',loadOhms:'1000000',
  fixedV:'0.25',start:'0.1',stop:'0.3',step:'0.1',widthUs:initial.widthUs,riseUs:initial.riseUs,
  fallUs:initial.fallUs,delayUs:initial.delayUs,windowStartUs:initial.windowStartUs,
  windowTimeUs:initial.windowTimeUs,currentRangeA:''};
 project=model.editTiming(project,{secondary,start:'0.5',step:'0.5',loadOhms:'1000000',currentRangeA:'0.01'});
 const endpoint={host:'169.254.111.118',port:1225,expectedSerial:'1498377'};
 const fixture=makeInstrumentContext(modules,{pmu:true});
 const runtime=modules.get('measurementRuntime').createRuntime(fixture.ctx,{wait:async()=>{}});
 try{
  const currentPage=()=>project.pages.find(page=>page.id===project.activeId);
  assert.deepEqual(Array.from(runtime.pulseRouting(currentPage()).issues,item=>item.logical+' '+item.mapped),
   ['D SMU1','G SMU2']);
  await runtime.connectAndInspect(endpoint);
  assert.match(runtime.prepare(currentPage()).reason,/D · SMU 1、G · SMU 2 为独立 SMU/);
  project=model.edit(project,'D',{resource:'PMU1-1'});
  assert.equal(model.timedSummary('pulse',currentPage().timing).totalSweepPoints,2);
  const unsupported=runtime.prepare(currentPage());
  assert.equal(unsupported.canExecute,false);
  assert.match(unsupported.reason,/G · SMU 2 为独立 SMU/);
  assert.throws(()=>runtime.start(currentPage(),true),/独立 SMU/);
  assert.ok(fixture.commands.every(row=>!row.command.startsWith(':PMU:')));
  project=model.edit(project,'G',{resource:'PMU2-1'});
  assert.throws(()=>runtime.start(currentPage(),true),/未检测到 PMU2-1/);
  assert.ok(fixture.commands.every(row=>!row.command.startsWith(':PMU:')));
  project=model.edit(project,'G',{resource:'PMU1-2'});
  const prepared=runtime.prepare(currentPage());
  assert.equal(prepared.canExecute,true,prepared.reason);
  assert.equal(prepared.pointCount,2);
  assert.equal(prepared.compiled.pulse.pairedMode,'fixed-bias');
  assert.ok(prepared.compiled.pulse.setup.includes(':PMU:PULSE:TRAIN 2,1.2,1.2'));
  assert.ok(prepared.compiled.pulse.setup.every(command=>!command.startsWith(':PMU:STEP:')));
  const overvoltage={...currentPage(),timing:{...currentPage().timing,secondary:{...secondary,rangeV:'40',conditionV:'22'}}};
  assert.match(runtime.prepare(overvoltage).reason,/高压互锁/);
  runtime.start(currentPage(),true);
  const result=await runtime.waitForCompletion();
  assert.equal(result.run.state,'completed',result.run.error);
  assert.equal(result.run.shutdown,'commands-sent');
  assert.equal(result.rows,2);
  assert.ok(result.run.rows.every(row=>row.pulseResource==='PMU1-1'&&row.gateVoltageV===undefined));
  const commands=fixture.commands.map(row=>row.command);
  assert.ok(commands.includes(':PMU:OUTPUT:STATE 2,0\0'));
  assert.ok(!commands.some(command=>/^:PMU:DATA:(?:COUNT\?|GET) 2/.test(command)));
  const restored=model.editTiming(project,{secondary:{...secondary,role:'psweep'}});
  assert.equal(model.timedSummary('pulse',restored.pages.find(page=>page.id===restored.activeId).timing).secondary.points,3);
 }finally{await runtime.dispose();}
});

test('PMU commissioning blocks unchecked hardware and peaks above 21 V',async()=>{
 const {modules}=loadModules(),model=modules.get('model');
 const runtimeModule=modules.get('measurementRuntime');
 let project=model.setIvType(model.initial(),'pulse');
 project=model.edit(project,'D',{resource:'PMU1-1'});
 project=model.editTiming(project,{rangeV:'40',start:'20',stop:'21',step:'1',loadOhms:'1000000',currentRangeA:'0.01'});
 const page=project.pages.find(row=>row.id===project.activeId);
 const overvoltage={...page,timing:{...page.timing,stop:'22'}};
 const segmentProject=model.editPage(project,{kind:'time'});
 const segment=segmentProject.pages.find(row=>row.id===segmentProject.activeId);
 const bias=model.defaultPmuTimeSettings();
 Object.assign(bias,{loadOhms:'1000000',currentRangeA:'0.01'});
 bias.biasSteps.segments[1].biasV='22';
 segment.timing={...segment.timing,mode:model.TIME_PMU_MODE,pmu:bias};
 const endpoint={host:'169.254.111.118',port:1225,expectedSerial:'1498377'};
 const verified=makeInstrumentContext(modules,{pmu:true});
 const runtime=runtimeModule.createRuntime(verified.ctx,{wait:async()=>{}});
 try{
  await runtime.connectAndInspect(endpoint);
  const control=runtime.prepare(page);
  assert.equal(control.canExecute,true,control.reason);
  assert.equal(control.compiled.pulse.peak,21);
  for(const candidate of [overvoltage,segment]){
   const prepared=runtime.prepare(candidate);
   assert.equal(prepared.ready,true,prepared.reason);
   assert.equal(prepared.canExecute,false);
   assert.match(prepared.reason,/高压互锁/);
   assert.throws(()=>runtime.start(candidate,true),/高压互锁/);
  }
  assert.ok(verified.commands.every(row=>!row.command.startsWith(':PMU:')));
 }finally{await runtime.dispose();}
 const unknown=makeInstrumentContext(modules,{pmu:true,pmuModel:'Unrecognized-PMU'});
 const unchecked=runtimeModule.createRuntime(unknown.ctx,{wait:async()=>{}});
 try{
  await unchecked.connectAndInspect(endpoint);
  assert.equal(unchecked.prepare(page).canExecute,false);
  assert.throws(()=>unchecked.start(page,true),/核验|额定值|模块/);
  assert.ok(unknown.commands.every(row=>!row.command.startsWith(':PMU:')));
 }finally{await unchecked.dispose();}
});

test('an unacknowledged PMU output-off blocks further runs',async()=>{
 const {modules}=loadModules(),model=modules.get('model');
 let project=model.setIvType(model.initial(),'pulse');
 project=model.edit(project,'D',{resource:'PMU1-1'});
 project=model.editTiming(project,{start:'0.5',step:'0.5',loadOhms:'1000000',currentRangeA:'0.01'});
 const page=project.pages.find(row=>row.id===project.activeId);
 const mock=makeInstrumentContext(modules,{pmu:true,failPmuOffAck:true});
 const runtime=modules.get('measurementRuntime').createRuntime(mock.ctx,{wait:async()=>{}});
 try{
  await runtime.connectAndInspect({host:'169.254.111.118',port:1225,expectedSerial:'1498377'});
  runtime.start(page,true);
  const result=await runtime.waitForCompletion();
  assert.equal(result.run.state,'failed');
  assert.equal(result.run.shutdown,'unconfirmed');
  assert.match(runtime.prepare(page).reason,/输出关闭未获确认/);
  assert.throws(()=>runtime.start(page,true),/输出关闭未获确认/);
  await assert.rejects(runtime.disconnect(),/仪器输出关闭未获确认/);
  assert.equal(mock.commands.filter(row=>row.command===':PMU:EXECUTE\0').length,1);
 }finally{await runtime.dispose();}
});

test('PMU time keeps legacy profiles and selects auto edges for the installed hardware and voltages',()=>{
 const {modules}=loadModules(),model=modules.get('model'),capabilities=modules.get('dkts-capabilities');
 const seed=model.validate(model.initial()),legacy=seed.pages.find(page=>page.kind==='time');
 const pmu=model.defaultPmuTimeSettings();
 Object.assign(legacy,{kind:'pulse',testType:'Pulse',name:'用户命名',timing:{...pmu,biasSteps:{...pmu.biasSteps,edgeUs:'1'}}});
 const migrated=model.validate(seed).pages.find(page=>page.id===legacy.id);
 assert.equal(migrated.kind,'time');
 assert.equal(migrated.name,'用户命名');
 assert.equal(migrated.timing.pmu.biasSteps.edgeUs,'1');
 const t=options=>capabilities.normalizeSegmentArb({...pmu,...options});
 assert.deepEqual(Array.from(t({}).transitionUs),[0.02]);
 assert.deepEqual(Array.from(t({rangeV:'40',currentRangeA:'0.01'}).transitionUs),[0.1]);
 const rpmSettings={...pmu,loadOhms:'1000000',currentRangeA:'0.0000001'};
 const rpmPreview=capabilities.segmentArbPreview(rpmSettings,0,{withRpm:true});
 const inventory={physicalModelsVerified:true,hardwareLimitsVerified:true,slots:[
  {family:'PMU',channel:1,type:'PMURPM',rpmCount:2,rpmChannels:[1,2],physicalIdentityVerified:true,ratingsVerified:true}
 ]};
 const rpmProgram=modules.get('dkts-kxci-measurement').compileSweep(
  {executionMode:'pulse',settings:rpmSettings,resource:'PMU1-1',wiringConfirmed:true},{capabilities,inventory}
 ).pulse;
 assert.equal(rpmProgram.durationTicksExact,String(rpmPreview.durationTicks));
 assert.ok(rpmProgram.setup.includes(':PMU:SARB:SEQ:TIME 1,1,0.00001,0.000001,0.00001,0.000001,0.00001'));
 assert.ok(rpmProgram.setup.includes(':PMU:RPM:CONFIGURE PMU1-1,0'));
 const levels=pmu.biasSteps.segments.map((segment,i)=>({...segment,biasV:['0','1','12'][i],measure:false}));
 assert.deepEqual(Array.from(t({rangeV:'40',biasSteps:{...pmu.biasSteps,segments:levels}}).transitionUs),[0.05,0.1]);
 assert.equal(t({sampleStepUs:'2.5'}).rateHz,400000);
 const highBias={...pmu.biasSteps,segments:pmu.biasSteps.segments.map((row,i)=>i===1?{...row,biasV:'8'}:row)};
 assert.equal(t({biasSteps:highBias}).rangeV,10);
 const loaded={...pmu,biasSteps:highBias,loadOhms:'100',currentRangeA:'0.01'};
 assert.equal(t(loaded).rangeV,40);
 const compiled=modules.get('dkts-kxci-measurement').compileSweep(
  {executionMode:'pulse',settings:loaded,resource:'PMU1-1',wiringConfirmed:true},{capabilities,inventory}
 ).pulse;
 assert.ok(compiled.setup.includes(':PMU:SOURCE:RANGE 1,40'));
 assert.equal(compiled.durationTicksExact,String(capabilities.segmentArbPreview(loaded,0,{withRpm:true}).durationTicks));
 assert.throws(()=>t({...loaded,loadOhms:'1'}),/输出能力/);
 assert.throws(()=>t({sampleStepUs:'0.001'}),/采样步长/);
});

test('SMU time preview uses inclusive indices and estimates programmed waits only',()=>{
 const {modules}=loadModules(),model=modules.get('model');
 const fixed=model.validate(model.initial()).pages.find(page=>page.kind==='time').timing;
 Object.assign(fixed.events[0],{startS:'0.2',intervalS:'0.125',points:'60'});
 const points=model.timePreviewGrid(fixed,'point');
 const timing=model.timePreviewGrid(fixed,'time');
 assert.equal(points.origin,1);
 assert.equal(points.readings.at(-1).at,60);
 assert.equal(timing.readings[0].at,0.2);
 assert.equal(timing.readings.at(-1).at,0.2+59*0.125);
 const list={...fixed,mode:'native-list',listDelayS:'0.25',segments:[
  {...fixed.segments[0],listPoints:'60'},{...fixed.segments[0],listPoints:'2'}
 ]};
 const listPoints=model.timePreviewGrid(list,'point'),listTimes=model.timePreviewGrid(list,'time');
 assert.deepEqual(Array.from(listPoints.starts),[1,61]);
 assert.equal(listTimes.starts[1],15);
 assert.deepEqual({...listTimes.readings[60]},{at:15.25,segment:1});
 assert.equal(model.timePreviewGrid({...list,listDelayS:'0'},'time').durationS,0);
});

test('test and routine duplication preserve settings and order with fresh project identities',()=>{
 const {modules}=loadModules(),model=modules.get('model');
 const base=model.validate(model.initial());
 const copied=model.duplicateSetup(base,'test','page-1','2');
 assert.deepEqual(Array.from(copied.pages,row=>row.id),['page-1','page-3','page-4','page-2']);
 assert.deepEqual(copied.pages[1].dc,copied.pages[0].dc);
 assert.equal(copied.pages[1].routineId,'routine-1');
 assert.equal(base.pages.length,2);
 const cloned=model.duplicateSetup(copied,'routine','routine-1','2');
 assert.equal(cloned.routines.length,3);
 assert.deepEqual(Array.from(cloned.pages.filter(row=>row.routineId==='routine-2'),row=>row.kind),['dc','dc','dc','time']);
 assert.equal(new Set(cloned.pages.map(row=>row.id)).size,cloned.pages.length);
 const order=['page-2','page-1','page-3','page-4'];
 assert.deepEqual(Array.from(model.reorderTests(cloned,'routine-1',order).pages.slice(0,4),row=>row.id),order);
 assert.throws(()=>model.reorderTests(cloned,'routine-1',order.slice(1)),/已变化/);
 assert.throws(()=>model.duplicateSetup(base,'test','page-1','128'),/工程容量/);
 const template=model.templateSnapshot(copied,'routine','routine-1');
 assert.equal(template.pages[0].id,undefined);
 assert.equal(template.pages[0].routineId,undefined);
 const restored=model.insertSetup(base,{...template,name:'工作模板'});
 assert.equal(restored.routines.at(-1).name,'工作模板');
 assert.deepEqual(Array.from(restored.pages.slice(2),row=>row.kind),['dc','dc','dc','time']);
});
