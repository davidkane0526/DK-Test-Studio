'use strict';
const assert=require('node:assert/strict');
const {executePulseTask}=require('../integrations/dkds-native/kxci-measurement.js');
function mock(opts={}){
 let executing=false,aborted=false,poll=0,stop=false;const trace=[],rows=[];
 const channels=[1,2].map(ch=>({resource:'PMU1-'+ch,pulseChannel:ch,offCommand:'OFF '+ch,countQuery:'COUNT '+ch,count:1000,expected:3,fields:'V,I,T,S'}));
 return {p:{channels,statusQuery:'STATUS',setup:['SETUP']},rows,trace,io:{cancelled:()=>stop,wait:async()=>{if(opts.stop)stop=true},onBatch:x=>rows.push(...x),command:async c=>{
 trace.push(c);if(c==='SP')return '0';
 if(c==='STATUS')return executing&&!aborted&&++poll<=2?'1':'0';
 if(c===':PMU:EXECUTE'){if(opts.ackFail)throw Error('lost ACK');executing=true;return ''}
 if(c===':PMU:ABORT'){aborted=true;return ''}
 if(c==='SETUP'&&opts.before)stop=true;
 if(c==='OFF 1'&&opts.offFail)throw Error('lost OFF');
 if(c.startsWith('COUNT '))return String(opts.shrink&&poll===2?0:aborted&&opts.stop?1:poll===1?1:3);
 if(c.startsWith(':PMU:DATA:GET ')){const m=c.match(/GET (\d+),(\d+),(\d+),/);return Array.from({length:Math.min(+m[3],opts.short?1:128)},(_,i)=>`${+m[2]+i+1},0.001,${+m[2]+i},0`).join(';')}
 return '';
 }}}
}
async function review(run,assert){
 for(const opts of [{},{short:true},{stop:true},{before:true},{ackFail:true},{shrink:true},{offFail:true}]){
  const m=mock(opts),r=await run(m.p,m.io);
  if(opts.before||opts.ackFail){assert(!m.trace.some(s=>s.startsWith('COUNT')),'no stale buffer');assert(r.state===(opts.before?'stopped':'failed'),'pre-execute state')}
  else if(opts.shrink){assert(r.state==='failed'&&m.trace.includes(':PMU:ABORT'),'shrinking buffer abort')}
  else if(opts.offFail){assert(r.shutdown==='unconfirmed'&&r.state==='failed','shutdown failure')}
  else {assert(r.state===(opts.stop?'stopped':'completed'),'run state');assert(m.rows.length===(opts.stop?2:6),'actual row count');assert(m.rows.every((r,i)=>r.sequence===i+1),'global sequence');assert(m.trace.findIndex(s=>s.startsWith(':PMU:DATA:GET'))<m.trace.indexOf('OFF 1'),'live read before OFF');if(opts.stop)assert(m.trace.indexOf(':PMU:ABORT')<m.trace.indexOf('OFF 1'),'abort before off')}
 }
}
review(executePulseTask,assert).then(()=>console.log('PMU stream review passed')).catch(e=>{console.error(e);process.exitCode=1});
