'use strict';
const assert=require('node:assert/strict');
const test=require('node:test');
const {compileSweep,points,parseTi,createRunner}=require('../src/shared/kxci-measurement.js');
const {createExecutionCoordinator}=require('../src/shared/measurement-plan.js');

const inventory={
  slots:[{channel:1,family:'SMU',type:'SMU',ratingsVerified:true},
    {channel:2,family:'SMU',type:'SMU',ratingsVerified:true}],
  physicalModelsVerified:true,hardwareLimitsVerified:true
};
const ranges=[1e-7,1e-6,1e-5,1e-4,1e-3,1e-2,1e-1];
const capabilities={
  DATABASE:{modules:{SMU:{electrical:{complianceMinFractionOfRange:0.1,
    rangeOverrangeFactor:1.05}}}},
  getSourceLimits:(_slot,voltage,limit)=>({
    known:true,moduleType:'SMU',maxAbsVoltageV:210,maxComplianceA:voltage>21?.0105:.105,
    minComplianceA:1e-7,availableCurrentRangesA:ranges,
    ...(limit?{selectedCurrentRangeA:limit}:{}),
  }),
  calculateChassisPower:()=>({known:true,withinLimit:true,totalW:0,limitW:500})
};
const hardware={inventory,capabilities};
function program(options={}){
  return {kind:'output',sweepProgram:{
    terminals:{source:'None',drain:'SMU1',gate:'SMU2'},
    xSweep:{terminal:'drain',delayMs:0,repeats:2,segments:[
      {startV:0,stopV:1,stepV:0.5,rangeA:'auto'}
    ]},
    pSweep:{enabled:true,terminal:'gate',delayMs:0,repeats:1,segments:[
      {startV:0,stopV:0.1,stepV:0.1,rangeA:'auto'}
    ]},
    fixedVoltages:{source:0,drain:0,gate:0},loops:1,
    portSettings:{
      source:{rangeMode:'auto',rangeA:'1e-6',complianceMode:'follow-range',complianceA:1e-4},
      drain:{rangeMode:'auto',rangeA:'1e-6',complianceMode:'custom',complianceA:1e-4},
      gate:{rangeMode:'auto',rangeA:'1e-6',complianceMode:'custom',complianceA:1e-4}
    },
    ...options
  }};
}
function makeController(onCommand){
  const commands=[];
  return {commands,status:()=>({phase:'connected',inventory}),
    async measurementExchange(command,read){
      commands.push({command,read});
      return onCommand?await onCommand(command,read):
        command.startsWith('TI')?'NAI+1.2500E-09':
          command===':ERROR:LAST:GET'?'No error (0)':'';
    }
  };
}
async function untilStopped(runner){
  for(let i=0;i<250;i++){
    const state=runner.status(0);
    if(!state.running)return state;
    await new Promise(resolve=>setTimeout(resolve,4));
  }
  throw Error('Test runner did not complete');
}
test('compile nested Xsweep repeats inside Psweep; never invent measured rows',()=>{
  const compiled=compileSweep(program(),hardware);
  assert.equal(compiled.canExecute,true);
  const rows=[...points(compiled.plan)];
  assert.equal(rows.length,12);
  assert.deepEqual(rows.slice(0,6).map(x=>x.xVoltageV),[0,.5,1,0,.5,1]);
  assert.equal(rows[6].pVoltageV,.1);
  assert.equal(rows[6].gateVoltageV,undefined);
  assert.equal(rows[6].voltages.gate,.1);
});
test('parse KXCI user-mode TI status and preserve exact raw text',()=>{
  const reading=parseTi('NAI+1.2500E-09\r\n',1);
  assert.equal(reading.currentA,1.25e-9);
  assert.equal(reading.rawResponse,'NAI+1.2500E-09');
  assert.equal(parseTi('CAI+2.1000E-06',1).status,'C');
  assert.throws(()=>parseTi('1.2e-9',1),/无法解析/);
});
test('physical identity, authorization and high voltage interlock gate real output',()=>{
  const controller=makeController();
  const runner=createRunner({controller,execution:createExecutionCoordinator()});
  assert.throws(()=>runner.start(program(),hardware,'wrong'),/必须确认/);
  const uncertain={inventory:{...inventory,physicalModelsVerified:false},capabilities};
  assert.equal(compileSweep(program(),uncertain).canExecute,false);
  assert.throws(()=>runner.start(program(),uncertain,'CONFIRM_WIRING_AND_OUTPUT'),/实际模块/);
  const high=program();
  high.sweepProgram.xSweep.segments=[{startV:0,stopV:30,stepV:10,rangeA:'auto'}];
  assert.equal(compileSweep(high,hardware).requiresInterlock,true);
  assert.throws(()=>runner.start(high,hardware,'CONFIRM_WIRING_AND_OUTPUT'),/互锁/);
  assert.equal(controller.commands.length,0);
});
test('hardware TI responses, status and shutdown are preserved and sequenced',async()=>{
  const controller=makeController();
  const runner=createRunner({controller,execution:createExecutionCoordinator()});
  const initial=runner.start(program(),hardware,'CONFIRM_WIRING_AND_OUTPUT');
  assert.equal(initial.running,true);
  const result=await untilStopped(runner);
  assert.equal(result.state,'completed');
  assert.equal(result.shutdown,'commands-sent');
  assert.equal(result.totalRows,12);
  assert.equal(result.rows[0].currentA,1.25e-9);
  assert.equal(result.rows[0].rawKxciResponse,'NAI+1.2500E-09');
  assert.equal(controller.commands[0].command,'US');
  assert.equal(controller.commands[1].command,':ERROR:LAST:CLEAR');
  assert.equal(controller.commands.filter(x=>x.command==='TI1').length,12);
  assert.deepEqual(controller.commands.slice(-2).map(x=>x.command),['DV2','DV1']);
  assert.equal(result.rows[6].gateVoltageV,.1);
});
test('stop breaks host delay, then disables every driven SMU',async()=>{
  const controller=makeController();
  const runner=createRunner({controller,execution:createExecutionCoordinator()});
  const many=program({xSweep:{terminal:'drain',repeats:2,delayMs:15,
    segments:[{startV:0,stopV:1,stepV:0.01,rangeA:'auto'}]}});
  runner.start(many,hardware,'CONFIRM_WIRING_AND_OUTPUT');
  await new Promise(resolve=>setTimeout(resolve,10));
  assert.equal(runner.stop().state,'stopping');
  const result=await untilStopped(runner);
  assert.equal(result.state,'stopped');
  assert.equal(result.shutdown,'commands-sent');
  assert.ok(result.totalRows<many.sweepProgram.xSweep.segments[0].points||result.totalRows<101);
  assert.deepEqual(controller.commands.slice(-2).map(x=>x.command),['DV2','DV1']);
});
test('a compliance status terminates and reports the instrument protection event',async()=>{
  const controller=makeController((command)=>command==='TI1'?'CAI+1.0000E-04':
    command===':ERROR:LAST:GET'?'No error (0)':'');
  const runner=createRunner({controller,execution:createExecutionCoordinator()});
  runner.start(program(),hardware,'CONFIRM_WIRING_AND_OUTPUT');
  const result=await untilStopped(runner);
  assert.equal(result.state,'failed');
  assert.match(result.error,/Compliance/);
  assert.equal(result.totalRows,1);
  assert.equal(result.shutdown,'commands-sent');
});
