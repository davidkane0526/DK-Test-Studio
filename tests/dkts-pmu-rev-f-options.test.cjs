'use strict';
// Rev F section 7 options for the standard pulse path: dual sweep (7-30..7-33),
// average modes (7-14), base-level readings (7-15/7-7), LLEC (7-11) and
// connection compensation (7-5).
const test=require('node:test'),assert=require('node:assert/strict');
const k=require('../integrations/dkds-native/kxci-measurement.js'),h=require('../integrations/dkds-native/hardware-capabilities.js');
const inventory={physicalModelsVerified:true,hardwareLimitsVerified:true,slots:[
 {family:'PMU',channel:1,type:'PMURPM',rpmCount:2,rpmChannels:[1,2],physicalIdentityVerified:true,ratingsVerified:true},
 {family:'PMU',channel:2,type:'PMU',rpmCount:0,rpmChannels:[],physicalIdentityVerified:true,ratingsVerified:true}]};
const hardware={inventory,capabilities:h};
const base={terminal:'G',channel:'1',rangeV:'10',loadOhms:'1000000',sweep:'amplitude',fixedV:'0.2',start:'0.1',stop:'0.3',step:'0.1',
 widthUs:'1',periodUs:'5',riseUs:'0.1',fallUs:'0.1',delayUs:'0',holdUs:'0',baseDelayUs:'0',windowStartUs:'0.2',windowTimeUs:'0.6',
 pulseCount:'50',mode:'spot',rateHz:'10000000',currentRangeA:'0.00001'};
const compile=(extra={},resource='PMU1-2',points=extra.start===extra.stop&&extra.start!==undefined?1:3)=>k.compilePulse({executionMode:'pulse',settings:{...base,...extra},summary:{points},resource,wiringConfirmed:true},hardware).pulse;
const find=(p,prefix)=>p.setup.filter(c=>c.startsWith(prefix));

test('defaults keep the previous command list',()=>{
 const p=compile();
 assert.deepEqual(find(p,':PMU:MEASURE:MODE '),[':PMU:MEASURE:MODE 1']);
 assert.deepEqual(find(p,':PMU:LLEC:CONFIGURE '),[':PMU:LLEC:CONFIGURE 2,0']);
 assert.deepEqual(find(p,':PMU:CONNECTION:COMP '),[]);
 assert.deepEqual(find(p,':PMU:MEASURE:PIV '),[':PMU:MEASURE:PIV 2,1,0']);
 assert.match(find(p,':PMU:SWEEP:PULSE:AMPLITUDE ')[0],/,0$/);
 assert.equal(p.fields,'VH,IH,TH,SH');assert.equal(p.expected,150);
});

test('dual sweep sets the dualSweep argument and doubles the expected records',()=>{
 const p=compile({dualSweep:'1'});
 assert.match(find(p,':PMU:SWEEP:PULSE:AMPLITUDE ')[0],/,1$/);
 assert.equal(p.expected,300);assert.equal(p.dualSweep,true);
 const b=compile({dualSweep:'1',sweep:'base',start:'0',stop:'0.2',step:'0.1',basePeakV:'1'});
 assert.match(find(b,':PMU:SWEEP:PULSE:BASE ')[0],/^:PMU:SWEEP:PULSE:BASE 2,0,0\.2,0\.1,1,1$/);
 // A single pulse train has no sweep to reverse.
 assert.throws(()=>compile({dualSweep:'1',start:'0.1',stop:'0.1',step:'0'}),/双向扫描/);
 assert.throws(()=>compile({dualSweep:'2'}),/dualSweep/);
});

test('average modes map to MEASURE:MODE 3 and 4',()=>{
 const spot=compile({average:'1'});
 assert.deepEqual(find(spot,':PMU:MEASURE:MODE '),[':PMU:MEASURE:MODE 3']);
 assert.equal(spot.expected,3,'spot mean average returns one record per sweep point');
 const wave=compile({average:'1',mode:'waveform',windowStartUs:'0',windowTimeUs:'1',pulseCount:'4',rateHz:'100000000'});
 assert.deepEqual(find(wave,':PMU:MEASURE:MODE '),[':PMU:MEASURE:MODE 4']);
 const each=compile({mode:'waveform',windowStartUs:'0',windowTimeUs:'1',pulseCount:'4',rateHz:'100000000'});
 assert.equal(wave.expected,null);
 assert.equal(wave.estimatedRecords,Math.ceil(each.estimatedRecords/4));
 assert.equal(k.parsePulseBlock('0.3,1E-9,0,0',spot,0)[0].pulseAveraged,true);
});

test('base-level readings request VL/IL/TL/SL and parse eight fields',()=>{
 const p=compile({acquireLow:'1'});
 assert.deepEqual(find(p,':PMU:MEASURE:PIV '),[':PMU:MEASURE:PIV 2,1,1']);
 assert.equal(p.fields,'VH,IH,TH,SH,VL,IL,TL,SL');
 const [r]=k.parsePulseBlock('0.3,1E-9,2E-6,00000000,0.2,-3E-12,4.5E-6,00000001',p,0);
 assert.equal(r.pulseVoltageV,0.3);assert.equal(r.gateCurrentA,1e-9);
 assert.equal(r.pulseBaseVoltageV,0.2);assert.equal(r.pulseBaseCurrentA,-3e-12);assert.equal(r.pulseBaseTimeS,4.5e-6);assert.equal(r.pulseBaseStatusRaw,'00000001');
 assert.throws(()=>k.parsePulseBlock('0.3,1E-9,2E-6,0',p,0),/字段/);
 assert.throws(()=>compile({acquireLow:'1',mode:'waveform',windowStartUs:'0',windowTimeUs:'1'}),/Spot Mean/);
});

test('LLEC and connection compensation follow Rev F channel addressing',()=>{
 const p=compile({llec:'1',connectionComp:'both'});
 assert.deepEqual(find(p,':PMU:LLEC:CONFIGURE '),[':PMU:LLEC:CONFIGURE 2,1']);
 // 7-5: compensation is addressed by the lowest channel of the card, PMU1 -> 1.
 assert.deepEqual(find(p,':PMU:CONNECTION:COMP '),[':PMU:CONNECTION:COMP 1,1,1',':PMU:CONNECTION:COMP 1,3,1']);
 const second=compile({connectionComp:'offset',channel:'1',currentRangeA:'0.01'},'PMU2-2');
 assert.deepEqual(find(second,':PMU:CONNECTION:COMP '),[':PMU:CONNECTION:COMP 3,3,1']);
 assert.ok(p.setup.indexOf(':PMU:CONNECTION:COMP 1,1,1')<p.setup.indexOf(':PMU:OUTPUT:STATE 2,1'));
 assert.throws(()=>compile({connectionComp:'open'}),/连接补偿/);
});

test('paired channels on one card send compensation once and reject dual sweep',()=>{
 const secondary={channel:'1',rangeV:'10',loadOhms:'1000000',fixedV:'0.2',start:'0.5',stop:'1',step:'0.5',widthUs:'1',riseUs:'0.1',fallUs:'0.1',delayUs:'0',windowStartUs:'0.2',windowTimeUs:'0.6',currentRangeA:'0.00001',terminal:'D'};
 const settings={...base,pulseCount:'2',connectionComp:'short',secondary};
 const input={executionMode:'pulse',settings,summary:{points:3},resource:'PMU1-1',wiringConfirmed:true,
  secondary:{settings:{...settings,...secondary,secondary:null},summary:{points:2},resource:'PMU1-2',wiringConfirmed:true}};
 const pair=k.compileSweep(input,hardware).pulse;
 assert.deepEqual(pair.setup.filter(c=>c.startsWith(':PMU:CONNECTION:COMP ')),[':PMU:CONNECTION:COMP 1,1,1']);
 assert.throws(()=>k.compileSweep({...input,settings:{...settings,dualSweep:'1'}},hardware),/双向扫描/);
});

test('planner mirrors the compiler for the new options',()=>{
 const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');let model;
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../integrations/dkds-native/model.js'),'utf8'),{window:{DKDSPluginModules:{define:(_id,name,api)=>{if(name==='model')model=api;},require:()=>h}}});
 const plan=v=>model.timedSummary('pulse',{...base,...v});
 assert.equal(plan({dualSweep:'1'}).totalSweepPoints,6);
 assert.equal(plan({average:'1'}).average,true);
 assert.throws(()=>plan({dualSweep:'1',start:'0.1',stop:'0.1',step:'0'}),/Dual sweep/);
 assert.throws(()=>plan({acquireLow:'1',mode:'waveform'}),/Base-level/);
 assert.throws(()=>plan({connectionComp:'x'}),/compensation/);
});

test('R-20261128-005 opens PMU pulse and Segment Arb output only for <=21 V plans',()=>{
 const policy=h.DATABASE.safetyPolicies.kxci;
 assert.equal(policy.allowPulseModeOutput,true);assert.equal(policy.allowSegmentArbOutput,true);
 // Other gates are unchanged.
 assert.equal(policy.allowInstrumentOutput,false);assert.equal(policy.allowMultiChannelListOutput,false);
 const low=k.compilePulse({executionMode:'pulse',settings:base,summary:{points:3},resource:'PMU1-2',wiringConfirmed:true},hardware);
 assert.equal(low.canExecute,true);assert.equal(low.requiresInterlock,false);
 const high=k.compilePulse({executionMode:'pulse',settings:{...base,rangeV:'40',fixedV:'0',start:'22',stop:'22',step:'0',periodUs:'10',widthUs:'2',riseUs:'0.2',fallUs:'0.2',windowStartUs:'0.5',windowTimeUs:'1',currentRangeA:'0.01'},summary:{points:1},resource:'PMU1-2',wiringConfirmed:true},hardware);
 assert.equal(high.canExecute,false);assert.equal(high.requiresInterlock,true);
 // Unverified modules stay blocked.
 const unverified={inventory:{...inventory,physicalModelsVerified:false},capabilities:h};
 assert.equal(k.compilePulse({executionMode:'pulse',settings:base,summary:{points:3},resource:'PMU1-2',wiringConfirmed:true},unverified).canExecute,false);
});
