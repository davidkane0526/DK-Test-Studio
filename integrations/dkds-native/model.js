(() => {
 'use strict';
 const KINDS=Object.freeze([
  {id:'iv',label:'I–V 扫描',testType:'DC'},
  {id:'dc',label:'DC 测试',testType:'DC'},
  {id:'transfer',label:'转移特性',testType:'DC'},
  {id:'output',label:'输出特性',testType:'DC'},
  {id:'pund',label:'PUND',testType:'Pulse'},
  {id:'endurance',label:'耐久性',testType:'Cycle'},
  {id:'retention',label:'保持特性',testType:'Time'},
  {id:'arb',label:'任意波形',testType:'Pulse'},
  {id:'time',label:'时间扫描',testType:'IVT'},
  {id:'pulse',label:'脉冲扫描',testType:'Pulse'},
  {id:'cv',label:'C–V 扫描',testType:'CV'}
 ]);
 const clone=x=>JSON.parse(JSON.stringify(x));
 // Offline scan structure mirrors the nested Xsweep/Psweep programming model.
 // No field in this project state authorizes or sends an instrument command.
 const segment=(mode='voltage',axis='X')=>({
  start:'0',stop:axis==='P'?'1':mode==='current'?'0.01':'2',
  step:mode==='current'?'0.001':'0.1',delayMs:'20',range:'auto',speed:'Normal'
 });
 const defaultSweep=()=>({
  contractVersion:2,loops:'1',xRepeats:'1',pRepeats:'1',pEnabled:false,
  mode:'linear',speed:'Normal',pointDelay:'20',
  xSegments:[segment()],pSegments:[segment('voltage','P')]
 });
 const sweepKeys=Object.freeze(['loops','xRepeats','pRepeats','pEnabled','mode','speed','pointDelay']);
 const segmentKeys=Object.freeze(['start','stop','step','delayMs','range','speed']);
 const positiveInt=(raw,max,label)=>{
  const text=String(raw??'');
  if(!/^[1-9][0-9]*$/.test(text))throw Error(label+' must be a positive integer');
  const n=Number(text);
  if(!Number.isSafeInteger(n)||n>max)throw Error(label+' exceeds planning bound');
  return n;
 };
 const numeric=(raw,label)=>{
  const text=String(raw??'').trim();
  if(!/^[+-]?(?:[0-9]+[.]?[0-9]*|[.][0-9]+)(?:[eE][+-]?[0-9]+)?$/.test(text)||
      !Number.isFinite(Number(text)))throw Error('Invalid numeric input: '+label);
  return Number(text);
 };
 function atField(field,validate){
  try{return validate();}
  catch(error){error.field??=field;throw error;}
 }
 function invalidField(field,message){
  throw Object.assign(Error(message),{field});
 }
 const TIME_TERMINALS=['D','G','S','B'];
 const timeTerminalDefaults=value=>Object.fromEntries(TIME_TERMINALS.map(key=>[key,value]));
 const TIMED_DEFAULTS=Object.freeze({
  time:Object.freeze({mode:'linear-step',sourceModes:Object.freeze(timeTerminalDefaults('voltage')),
   switchStepS:'0.1',sampleStepS:'0.1',cycles:'1',integrationPreset:'instrument',integrationS:'',
   segments:Object.freeze([{durationS:'1',bias:timeTerminalDefaults('0'),currentBias:timeTerminalDefaults('0')}]),
   events:Object.freeze([{terminal:'D',quantity:'Current',startS:'0.1',intervalS:'0.1',averageS:'0.02',points:'9'}])}),
  retention:Object.freeze({terminal:'D',conditionV:'0',conditionS:'0',holdV:'0',readV:'0.1',
   firstS:'1',lastS:'100',windowS:'0.05',points:'10',spacing:'log',complianceA:'0.001'}),
  pulse:Object.freeze({terminal:'D',channel:'1',rangeV:'10',loadOhms:'',sweep:'amplitude',fixedV:'0',
   start:'0.1',stop:'1',step:'0.1',widthUs:'500',periodUs:'1000',riseUs:'10',fallUs:'10',
   delayUs:'0',holdUs:'0',baseDelayUs:'0',windowStartUs:'100',windowTimeUs:'300',
   pulseCount:'1',mode:'spot',rateHz:'1000000',currentRangeA:''})
 });
 // KXCI Rev. F, SMU IT (0.1 / 1 / 10 power-line cycles).
 const SMU_INTEGRATION_PLC=Object.freeze({instrument:0,short:0.1,medium:1,long:10});
 const PLOT_KINDS=Object.freeze(['iv','transfer','it','vt','raw']);
 const timeBiasKey=mode=>mode==='current'?'currentBias':'bias';
 const timeBias=(settings,segment,terminal)=>segment[timeBiasKey(settings.sourceModes?.[terminal])]?.[terminal];
 function timeGrid(v){
  if(v.mode!==undefined&&v.mode!=='linear-step')invalidField('mode','Select a supported time sweep mode');
  const switchStep=atField('switchStepS',()=>numeric(v.switchStepS,'Switching Step'));
  const sampleStep=atField('sampleStepS',()=>numeric(v.sampleStepS,'Sampling Step'));
  if(switchStep<=0)invalidField('switchStepS','Switching Step must be positive');
  if(sampleStep<=0)invalidField('sampleStepS','Sampling Step must be positive');
  if(!Array.isArray(v.segments)||!v.segments.length||v.segments.length>64)throw Error('Use 1–64 time segments');
  let durationS=0,segmentCount=0;
  const starts=v.segments.map((segment,index)=>{
   const field='segments.'+index+'.durationS';
   const start=durationS,duration=atField(field,()=>numeric(segment?.durationS,'Segment duration'));
   const ticks=duration/switchStep;
   if(duration<=0||Math.round(ticks)<1||!Number.isSafeInteger(Math.round(ticks))||Math.abs(ticks-Math.round(ticks))>1e-7)
    invalidField(field,'Segment duration must be a positive multiple of Switching Step');
   durationS+=duration;
   segmentCount+=Math.round(ticks);
   return start;
  });
  const sampleRatio=durationS/sampleStep;
  const wholeSamples=Math.round(sampleRatio);
  const samplePoints=Math.abs(sampleRatio-wholeSamples)<1e-7?wholeSamples:Math.floor(sampleRatio);
  if(!Number.isSafeInteger(segmentCount)||!Number.isSafeInteger(samplePoints))
   throw Error('A cycle must have a finite number of switching and sampling steps');
  return {starts,durationS,segmentCount,samplePoints,sampleStep};
 }
 function timeSummary(v){
  const grid=timeGrid(v),{durationS,sampleStep}=grid;
  for(const key of TIME_TERMINALS){
   const mode=v.sourceModes[key];
   if(!['voltage','current'].includes(mode))invalidField('sourceModes.'+key,'Select voltage or current source mode');
   const current=mode==='current';
   for(const [index,segment] of v.segments.entries()){
    const field='segments.'+index+'.'+timeBiasKey(mode)+'.'+key;
    const value=atField(field,()=>numeric(timeBias(v,segment,key),key+' bias'));
    if(Math.abs(value)>(current?1.05:210))invalidField(field,'Bias exceeds the SMU planning envelope');
   }
  }
  const cycles=atField('cycles',()=>positiveInt(v.cycles,10000,'Cycles'));
  if(!Object.hasOwn(SMU_INTEGRATION_PLC,v.integrationPreset))
   invalidField('integrationPreset','Select a supported SMU integration preset');
  const legacyIntegration=v.integrationS!==''?atField('integrationPreset',()=>numeric(v.integrationS,'Legacy integration time')):null;
  // Even at 60 Hz, a PLC preset has this minimum conversion time.
  // Instrument line frequency and settling time are verified separately.
  const integrationMinimumS=legacyIntegration??SMU_INTEGRATION_PLC[v.integrationPreset]/60;
  if((legacyIntegration!==null&&legacyIntegration<=0)||integrationMinimumS>sampleStep+1e-12)
   invalidField('integrationPreset','The SMU integration time must fit within a sampling step');
  if(!Array.isArray(v.events)||!v.events.length||v.events.length>16)throw Error('Use 1–16 measurement events');
  let points=0;
  for(const [index,event] of v.events.entries()){
   const field=key=>'events.'+index+'.'+key;
   if(!['D','G','S','B'].includes(event?.terminal)||!['Current','Voltage'].includes(event.quantity))
    invalidField(field('terminal'),'Select a valid measurement terminal and quantity');
   const start=atField(field('startS'),()=>numeric(event.startS,'Event start'));
   const interval=atField(field('intervalS'),()=>numeric(event.intervalS,'Event interval'));
   const average=atField(field('averageS'),()=>numeric(event.averageS,'Average time'));
   const count=atField(field('points'),()=>positiveInt(event.points,65536,'Event points'));
   if(start<0)invalidField(field('startS'),'Event start cannot be negative');
   if(interval<sampleStep)invalidField(field('intervalS'),'Event interval cannot be shorter than Sampling Step');
   if(average<=0||average>interval||integrationMinimumS>average+1e-12)
    invalidField(field('averageS'),'The averaging window must fit the measurement interval and integration time');
   if(start+(count-1)*interval+average>durationS+Math.max(1e-12,durationS*1e-9))
    invalidField(field('points'),'A measurement event exceeds the cycle duration');
   points+=count;
  }
  if(!Number.isFinite(durationS*cycles)||points*cycles>65536)invalidField('cycles','Time plan exceeds the offline planning limit');
  return {...grid,cycles,points:points*cycles};
 }
 function timingSettings(kind,settings){
  const values={...clone(TIMED_DEFAULTS[kind]),...settings};
  if(kind==='time'){
   values.sourceModes={...timeTerminalDefaults('voltage'),...values.sourceModes};
   if(Array.isArray(values.segments))values.segments=values.segments.map(segment=>segment&&({
    ...segment,currentBias:{...timeTerminalDefaults('0'),...segment.currentBias}
   }));
  }
  if(kind==='pulse'&&Object.hasOwn(values,'windowStopUs')){
   values.windowTimeUs=String(numeric(values.windowStopUs,'Window stop')-numeric(values.windowStartUs,'Window start'));
   delete values.windowStopUs;
  }
  return values;
 }
 function timedSummary(kind,settings){
  const defaults=TIMED_DEFAULTS[kind];
  if(!defaults)return null;
  const v=timingSettings(kind,settings);
  if(kind==='time')return timeSummary(v);
  if(!['S','D','G'].includes(v.terminal))throw Error('Select a Source, Drain or Gate terminal');
  const n=key=>numeric(v[key],key);
  if(kind==='retention'){
   const points=positiveInt(v.points,65536,'Read points');
   const first=n('firstS'),last=n('lastS'),window=n('windowS'),condition=n('conditionS');
   if(!['log','linear'].includes(v.spacing)||first<0||condition<0||window<=0||last<first||
      (points>1&&last===first)||(points===1&&last!==first)||(v.spacing==='log'&&first<=0))
    throw Error('Enter a valid retention schedule. For one point, use the same first and last time.');
   const shortest=points===1?Infinity:v.spacing==='linear'?(last-first)/(points-1):
    first*Math.expm1((Math.log(last)-Math.log(first))/(points-1));
   if(window>shortest+1e-12)throw Error('Read windows overlap. Increase the spacing or shorten the window.');
   const peakV=Math.max(...['conditionV','holdV','readV'].map(key=>Math.abs(n(key))));
   const complianceA=n('complianceA');
   if(peakV>210||complianceA<=0||complianceA>1.05||(peakV>21&&complianceA>0.105))
    throw Error('Retention bias or compliance exceeds the SMU planning envelope');
   return {points,conditionS:condition,firstS:first,lastS:last,windowS:window,peakV,complianceA};
  }
  const rangeV=n('rangeV'),fixedV=n('fixedV'),start=n('start'),stop=n('stop'),step=n('step');
  if(![10,40].includes(rangeV)||!['1','2'].includes(v.channel)||!['amplitude','base'].includes(v.sweep)||!['spot','waveform'].includes(v.mode))
   throw Error('Invalid PMU range, sweep or acquisition mode');
  const points=segmentPoints({start,stop,step});
  const peakV=Math.max(Math.abs(fixedV+start),Math.abs(fixedV+stop),
   ...(v.sweep==='amplitude'?[Math.abs(fixedV)]:[Math.abs(start),Math.abs(stop)]));
  if(peakV>rangeV)throw Error('Pulse base or top exceeds the selected voltage range');
  if(v.loadOhms!==''&&(n('loadOhms')<1||n('loadOhms')>1000000))throw Error('Load must be between 1 Ω and 1 MΩ');
  const rise=n('riseUs'),fall=n('fallUs'),period=n('periodUs'),width=n('widthUs'),delay=n('delayUs');
  const startUs=v.windowStartUs===''?0:n('windowStartUs');
  const windowUs=v.windowTimeUs===''?width-startUs:n('windowTimeUs');
  const hold=n('holdUs'),baseDelay=n('baseDelayUs');
  if(hold<0||baseDelay<0)throw Error('Hold Time and Base Delay must be non-negative');
  if(rise<=0||fall<=0||width<=0||delay<0||period<rise+width+fall||
     startUs<0||windowUs<=0||startUs+windowUs>width+1e-9)
   throw Error('Fit the rise, flat top and fall within the period, and the measurement window within the flat top');
  const pulseCount=positiveInt(v.pulseCount,65536,'Pulse count'),rateHz=positiveInt(v.rateHz,200000000,'Sample rate');
  if(rateHz<1000)throw Error('Sample rate is below 1 kSa/s');
  if(v.currentRangeA!==''&&n('currentRangeA')<=0)throw Error('Current range must be positive');
  return {points,pulseCount,rateHz,rangeV,peakV,windowS:windowUs*1e-6,
   loadOhms:v.loadOhms===''?null:n('loadOhms')};
 }
 function segmentPoints(seg){
  const a=Number(seg.start),b=Number(seg.stop),step=Number(seg.step);
  if(a===b){
   if(step!==0)throw Error('SWEEP_STEP: identical endpoints require zero step');
   return 1;
  }
  if(step===0||Math.sign(b-a)!==Math.sign(step))
   throw Error('SWEEP_DIRECTION: step direction differs from endpoint');
  // Mirror the standalone KXCI planner: no silently shortened final step.
  const interval=(b-a)/step,nearest=Math.round(interval);
  if(!Number.isSafeInteger(nearest)||nearest<1||
      Math.abs(interval-nearest)>1e-8*Math.max(1,Math.abs(interval)))
   throw Error('SWEEP_ENDPOINT: step cannot exactly reach requested stop');
  if(nearest+1>4096)throw Error('SWEEP_POINTS: KXCI segment exceeds 4096 points');
  return nearest+1;
 }
 function validateSweep(p){
  const defaults=defaultSweep();
  const legacy=!p.sweep||p.sweep.contractVersion===undefined;
  p.sweep={...defaults,...(p.sweep||{})};
  const sw=p.sweep;
  if(sw.contractVersion!==2)throw Error('Unsupported sweep contract version');
  if(legacy){
   // v0.8.0 created a one-point append with a nonzero default step.
   // Normalize only snapshots without an explicit contract version.
   for(const key of ['xSegments','pSegments'])
    if(Array.isArray(sw[key]))for(const row of sw[key]){
     if(row&&Number.isFinite(Number(row.start))&&
         Number(row.start)===Number(row.stop))row.step='0';
    }
  }
  for(const key of ['loops','xRepeats','pRepeats'])positiveInt(sw[key],10000,key);
  if(typeof sw.pEnabled!=='boolean')throw Error('Invalid Psweep enable state');
  if(!['linear','bidirectional','hysteresis'].includes(sw.mode))throw Error('Invalid scan mode');
  if(!['Fast','Normal','Quiet'].includes(sw.speed))throw Error('Invalid measurement speed');
  const pointDelay=numeric(sw.pointDelay,'point delay');
  if(pointDelay<0||pointDelay>6553)throw Error('Invalid sweep delay (0..6553 ms)');
  for(const axis of ['X','P']){
   const key=axis==='X'?'xSegments':'pSegments',list=sw[key];
   if(!Array.isArray(list)||!list.length||list.length>64)throw Error('Invalid '+axis+' segment count');
   const terminal=p.terminals.find(t=>t.role===axis&&t.resource!=='None');
   const voltageSource=terminal?.sourceMode!=='current';
   const sourceMax=voltageSource?210:1.05;
   const rangeMax=voltageSource?1.05:210;
   for(const [i,row] of list.entries()){
    if(!row||typeof row!=='object'||Array.isArray(row))throw Error('Invalid '+axis+' segment');
    for(const key of ['start','stop','step','delayMs'])numeric(row[key],axis+'['+i+'].'+key);
    if(Number(row.delayMs)<0||Number(row.delayMs)>6553)
     throw Error('Invalid sweep delay (0..6553 ms)');
    if(!['Fast','Normal','Quiet'].includes(row.speed||'Normal'))
     throw Error('Invalid segment speed');
    if(Math.max(Math.abs(Number(row.start)),Math.abs(Number(row.stop)))>sourceMax)
     throw Error('HARDWARE_ENVELOPE: scan source exceeds theoretical SMU envelope');
    if(terminal&&Math.max(Math.abs(Number(row.start)),Math.abs(Number(row.stop)))>
        (voltageSource?21:0.105)&&Number(terminal.compliance)>(voltageSource?0.105:21))
     throw Error('HARDWARE_POWER_ENVELOPE: scan source and compliance conflict');
    if(row.range!=='auto'){
     const range=numeric(row.range,axis+'['+i+'].range');
     if(range<=0||range>rangeMax)throw Error('HARDWARE_RANGE_ENVELOPE: scan measurement range');
    }
    segmentPoints(row);
   }
  }
 }
 function summary(p){
  const scan=p.sweep||defaultSweep();
  const x=p.terminals.find(t=>!['None','GNDU'].includes(t.resource)&&t.role==='X');
  const second=scan.pEnabled;
  const parallel=p.terminals.find(t=>!['None','GNDU'].includes(t.resource)&&t.role==='P');
  if(!x)return {ready:false,reason:'请先分配 Xsweep 的 SMU 端口'};
  if(second&&!parallel)return {ready:false,reason:'Psweep 已启用，请分配独立的 SMU 端口'};
  const xPoints=scan.xSegments.reduce((n,row)=>n+segmentPoints(row),0);
  const pPoints=second?scan.pSegments.reduce((n,row)=>n+segmentPoints(row),0):1;
  const total=xPoints*positiveInt(scan.xRepeats,10000,'Xsweep repeats')*
    pPoints*(second?positiveInt(scan.pRepeats,10000,'Psweep repeats'):1)*
    positiveInt(scan.loops,10000,'cycles');
  if(!Number.isSafeInteger(total))return {ready:false,reason:'总扫描点数超过可精确表示范围'};
  return {ready:true,mode:'offline-only',xTerminal:x.logical,pTerminal:second?parallel.logical:null,
   xPoints,pPoints,total,loops:Number(scan.loops),xRepeats:Number(scan.xRepeats),
   pRepeats:second?Number(scan.pRepeats):0};
 }
 // Deterministic, zero-allocation-at-scale *offline* planning cursor.
 // X steps form the innermost loop, followed by X repeats, P steps,
 // P repeats, and finally whole-page loops. Not an instrument runner.
 function segmentAt(segments,index){
  let cursor=index;
  for(let i=0;i<segments.length;i++){
   const seg=segments[i],length=segmentPoints(seg);
   if(cursor<length){
    const value=cursor===length-1?Number(seg.stop):
     Number((Number(seg.start)+cursor*Number(seg.step)).toPrecision(13));
    return Object.freeze({segment:i+1,step:cursor+1,value,
     delayMs:Number(seg.delayMs),range:seg.range,speed:seg.speed||'Normal'});
   }
   cursor-=length;
  }
  throw new RangeError('Sweep cursor outside segment list');
 }
 function pointAt(page,index){
  // Validate a copy: cursor reads must not mutate persisted project state.
  if(!page||!['iv','transfer','output'].includes(page.kind))
   throw Error('Only DC sweep pages have an offline X/P scan cursor');
  const p={...page,sweep:clone(page.sweep||defaultSweep())};
  validateSweep(p);
  const info=summary(p);
  if(!info.ready)throw Error(info.reason);
  if(!Number.isSafeInteger(index)||index<0||index>=info.total)
   throw new RangeError('Sweep cursor index out of bounds');
  const sw=p.sweep;
  const xBlock=info.xPoints*info.xRepeats;
  const pBlock=info.pPoints*(sw.pEnabled?info.pRepeats:1);
  const cyclePoints=xBlock*pBlock;
  const inner=index%cyclePoints;
  const pBlockOffset=Math.floor(inner/xBlock);
  const xOffset=inner%xBlock;
  const xTerminal=p.terminals.find(t=>t.logical===info.xTerminal);
  const pTerminal=sw.pEnabled?p.terminals.find(t=>t.logical===info.pTerminal):null;
  const x=Object.freeze({...segmentAt(sw.xSegments,xOffset%info.xPoints),
   logical:xTerminal.logical,resource:xTerminal.resource,mode:xTerminal.sourceMode,
   repeat:Math.floor(xOffset/info.xPoints)+1});
  const outer=sw.pEnabled?Object.freeze({
   ...segmentAt(sw.pSegments,pBlockOffset%info.pPoints),
   logical:pTerminal.logical,resource:pTerminal.resource,mode:pTerminal.sourceMode,
   repeat:Math.floor(pBlockOffset/info.pPoints)+1}):null;
  const fixed=Object.freeze(p.terminals.filter(t=>!['None','GNDU'].includes(t.resource)&&
   (t.role==='CONDITION'||(!sw.pEnabled&&t.role==='P')))
   .map(t=>Object.freeze({logical:t.logical,resource:t.resource,
    mode:t.sourceMode,value:Number(t.bias)})));
  return Object.freeze({index,loop:Math.floor(index/cyclePoints)+1,
   x,p:outer,fixed,provenance:'planned-only',executable:false,hardwareVerified:false});
 }
 const ports=()=>[
  {logical:'D',resource:'SMU1',sourceMode:'voltage',role:'X'},
  {logical:'G',resource:'SMU2',sourceMode:'voltage',role:'CONDITION'},
  {logical:'S',resource:'GNDU',sourceMode:'voltage',role:'CONDITION'},
  {logical:'B',resource:'None',sourceMode:'voltage',role:'CONDITION'}
 ].map(row=>({...row,bias:'0',start:'0',stop:'2',step:'0.1',compliance:'0.01',complianceMode:'follow-range',rangeMode:'auto',rangeValue:'1e-6'}));
 const logicalsList=['S','D','G','B'];
 const validResource=value=>/^(?:None|GNDU|SMU[1-9]|PMU[1-9](?:-[12])?)$/.test(value);
 const mappingOf=terminals=>Object.fromEntries(terminals.map(({logical,resource})=>[logical,resource]));
 const page=(kind='iv',id='page-1',routineId='routine-1')=>{
  const type=KINDS.find(x=>x.id===kind);if(!type)throw Error('Unknown test type');
  return {id,routineId,kind,name:type.label,testType:type.testType,note:'',
   terminals:ports(),sweep:defaultSweep(),
   target:{name:'Id',logical:'D',quantity:'Current',range:'auto'},
   targets:[{id:'target-1',name:'Id',logical:'D',quantity:'Current',range:'auto'}],variables:[]};
 };

 const DC_PRESETS=Object.freeze(['optimized','point-by-point']);
 const ROUTINE_DEFAULTS=Object.freeze(['iv','dc']);
 const DC_METHODS=Object.freeze({
  constant:'Constant',step:'Linear Step',points:'Linear Points',log:'Log Points',list:'List',generator:'Generator'
 });
 const dcResource=t=>t?.resource==='GNDU'||/^SMU[1-9]$/.test(t?.resource||'');
 const validDcBody=value=>value==='None'||dcResource({resource:value});
 function dcTerminals(p,settings=p.dc){
  return ['D','G','S','B'].map(key=>{
   const terminal=p.terminals.find(t=>t.logical===key);
   return key==='B'&&settings?{...terminal,resource:settings.bodyResource}:terminal;
  }).filter(dcResource);
 }
 function defaultDc(p){
  const visible=dcTerminals(p),smus=visible.filter(t=>t.resource!=='GNDU');
  const ground=visible.find(t=>t.resource==='GNDU')?.logical||'GND';
  const axis=smus.find(t=>t.logical==='D')?.logical||smus[0]?.logical||'D';
  const output=smus.find(t=>t.logical==='D')?.logical||axis;
  const lastPort=p.terminals.find(t=>t.logical==='B').resource;
  const bodyResource=validDcBody(lastPort)?lastPort:'None';
  return {preset:'optimized',group:'',polarity:'NMOS',bodyResource,reference:ground,referenceV:'0',outputs:'I'+output.toLowerCase(),
   terminals:Object.fromEntries(['D','G','S','B'].map(key=>[key,{
    mode:'voltage',role:key===axis?'X':'CONDITION',ref:key===ground?'GND':ground,
    limitI:'0.01',limitV:'1',segments:[{method:key===axis?'step':'constant',
     value:'0',start:'0',stop:'1',step:'0.1',points:'11',list:'0, 0.1, 0.2',formula:'getx()',range:'auto'}]
   }])),target:{formula:'',x:'',y:'',h:'',p:''},
   strategy:{mode:'global',integration:'',delay:'',hold:'',onLimit:'stop',direction:'forward'},specIds:p.associateSpecId?[p.associateSpecId]:[]};
 }
 function dcOutputs(p,settings=p.dc){
  return dcTerminals(p,settings).filter(t=>t.resource!=='GNDU').flatMap(t=>
   ['I','V'].map(prefix=>prefix+t.logical.toLowerCase()));
 }
 function dcMethods(role){
  return role==='CONDITION'?['constant','generator']:['step','points','log','list'];
 }
 function dcExpression(raw,variables,polarity,{generator=false,outer=false}={}){
  const input=String(raw??'').trim();
  if(!input||input.length>256)throw Error('Enter an expression of 1–256 characters');
  const tokenPattern=/\s*([0-9]+(?:\.[0-9]*)?(?:[eE][+-]?\d+)?|\.[0-9]+(?:[eE][+-]?\d+)?|[A-Za-z][A-Za-z0-9_]*|[()+*/-])/y;
  const tokens=[];
  for(let position=0;position<input.length;position=tokenPattern.lastIndex){
   tokenPattern.lastIndex=position;
   const match=tokenPattern.exec(input);
   if(!match)throw Error('Invalid expression: '+input);
   tokens.push(match[1]);
  }
  let index=0;
  function atom(){
   const token=tokens[index++];
   if(token==='-'||token==='+')return (token==='-'?-1:1)*atom();
   if(token==='('){
    const value=sum();
    if(tokens[index++]!==')')throw Error('Unclosed expression: '+input);
    return value;
   }
   if(/^(?:[0-9]|\.)/.test(token||''))return numeric(token,'DC expression');
   if(tokens[index]==='('&&tokens[index+1]===')'){
    index+=2;
    if(token==='scale')return polarity==='PMOS'?-1:1;
    if(generator&&(token==='getx'||(token==='getp'&&outer)))return NaN;
    throw Error('Unsupported function: '+token+'()');
   }
   if(Object.hasOwn(variables,token))return variables[token];
   throw Error('Unknown value or function: '+(token||input));
  }
  function product(){
   let result=atom();
   while(['*','/'].includes(tokens[index])){
    const op=tokens[index++],value=atom();
    if(op==='/'&&value===0)throw Error('Division by zero: '+input);
    result=op==='*'?result*value:result/value;
   }
   return result;
  }
  function sum(){
   let result=product();
   while(['+','-'].includes(tokens[index])){
    const op=tokens[index++],value=product();
    result=op==='+'?result+value:result-value;
   }
   return result;
  }
  const result=sum();
  if(index!==tokens.length||(!Number.isFinite(result)&&!(generator&&Number.isNaN(result))))
   throw Error('Invalid expression: '+input);
  return result;
 }
 // Preserve the roles, range values and expression polarity of saved DC pages.
 function migrateDcPreset(dc){
  if(dc.preset===undefined)dc.preset='optimized';
  if(dc.strategy){
   if(dc.strategy.hold===undefined)dc.strategy.hold='';
   if(dc.strategy.onLimit===undefined)dc.strategy.onLimit='stop';
   if(dc.strategy.direction===undefined)dc.strategy.direction='forward';
  }
  for(const terminal of Object.values(dc.terminals||{}))
   if(Array.isArray(terminal?.segments))
    for(const segment of terminal.segments)
     if(segment&&segment.range===undefined)segment.range='auto';
 }
 function validateDcShape(dc){
  const text=(value,max=256)=>typeof value==='string'&&value.length<=max;
  if(!dc||!DC_PRESETS.includes(dc.preset)||!validDcBody(dc.bodyResource)||!text(dc.group,64)||!['NMOS','PMOS','Other'].includes(dc.polarity)||
     !['GND','D','G','S','B'].includes(dc.reference)||!text(dc.referenceV)||!text(dc.outputs,128)||
     !Array.isArray(dc.specIds)||dc.specIds.length>100||new Set(dc.specIds).size!==dc.specIds.length||
     !dc.target||!['formula','x','y','h','p'].every(key=>text(dc.target[key],key==='formula'?4096:256))||
     !dc.strategy||!['global','local'].includes(dc.strategy.mode)||
     !text(dc.strategy.integration)||!text(dc.strategy.delay)||!text(dc.strategy.hold)||
     !['stop','skip'].includes(dc.strategy.onLimit)||!['forward','forward-reverse'].includes(dc.strategy.direction))
   throw Error('Invalid DC test parameters');
  for(const key of ['D','G','S','B']){
   const row=dc.terminals?.[key];
   if(!row||!['voltage','current'].includes(row.mode)||!['CONDITION','X','P'].includes(row.role)||
      !['GND','D','G','S','B'].includes(row.ref)||!text(row.limitI)||!text(row.limitV)||
      !Array.isArray(row.segments)||!row.segments.length||row.segments.length>16||
      !row.segments.every(seg=>seg&&Object.hasOwn(DC_METHODS,seg.method)&&
       ['value','start','stop','step','points','list','formula'].every(field=>text(seg[field],field==='list'?2048:256))&&
       text(seg.range,32)&&(seg.range==='auto'||/^[0-9]+(?:\.[0-9]+)?(?:e[+-]?\d+)?$/i.test(seg.range))))
    throw Error('Invalid DC terminal: '+key);
  }
 }
 function dcSummary(p,dc=p.dc){
  validateDcShape(dc);
  const terminals=dcTerminals(p,dc),byKey=new Map(terminals.map(t=>[t.logical,t]));
  if(new Set(terminals.map(t=>t.resource)).size!==terminals.length)
   invalidField('bodyResource','Assign a different resource to the DC body terminal');
  const smus=terminals.filter(t=>t.resource!=='GNDU');
  const assigned=role=>smus.filter(t=>dc.terminals[t.logical].role===role);
  if(assigned('X').length!==1||assigned('P').length>1)
   invalidField('roles','Select exactly one Xsweep and at most one Psweep on mapped SMUs');
  const outer=assigned('P').length===1;
  const reference=dc.reference,referenceRow=dc.terminals[reference];
  const grounded=reference==='GND'||byKey.get(reference)?.resource==='GNDU';
  if(!grounded&&(!byKey.has(reference)||referenceRow.mode!=='voltage'||
     referenceRow.role!=='CONDITION'||referenceRow.ref!=='GND'))
   invalidField('reference','Ref Node must be GND or a mapped voltage Condition with Ref set to GND');
  const variables=Object.fromEntries(p.variables.map(row=>[row.name,Number(row.value)]));
  const value=(raw,options)=>dcExpression(raw,variables,dc.polarity,options);
  const referenceV=grounded?0:atField('referenceV',()=>value(dc.referenceV));
  if(Math.abs(referenceV)>210)invalidField('referenceV','Ref Node exceeds the SMU voltage envelope');
  const outputs=dc.outputs.trim().split(/[\s,]+/);
  if(outputs.some(out=>!dcOutputs(p,dc).includes(out))||new Set(outputs).size!==outputs.length)
   invalidField('outputs','Outputs must be distinct measured signals on mapped SMUs');
  for(const {logical} of smus){
   const row=dc.terminals[logical],current=row.mode==='current';
   let ref=row.ref;
   const visited=new Set([logical]);
   while(ref!=='GND'){
    if(visited.has(ref)||!byKey.has(ref)||
       (byKey.get(ref).resource!=='GNDU'&&dc.terminals[ref].mode!=='voltage'))
     invalidField(logical+'.ref',logical+' Ref must lead to GND through mapped voltage terminals without a cycle');
    visited.add(ref);
    ref=byKey.get(ref).resource==='GNDU'?'GND':dc.terminals[ref].ref;
   }
   if(current&&row.ref!=='GND')invalidField(logical+'.ref',logical+' Current mode uses Ref GND');
   const compliance=Number(current?row.limitV:row.limitI);
   for(const [key,max] of [['limitI',1.05],['limitV',210]]){
    const limit=row[key],field=logical+'.'+key;
    if(limit.trim()&&(atField(field,()=>numeric(limit,logical+' limit'))<=0||Number(limit)>max))
     invalidField(field,logical+' limit exceeds the SMU planning envelope');
   }
   if(!compliance)invalidField(logical+'.'+(current?'limitV':'limitI'),
    logical+' requires a positive '+(current?'voltage':'current')+' limit');
   if(row.role==='CONDITION'&&row.segments.length!==1)
    invalidField(logical+'.role',logical+' Condition requires one segment');
   if(row.segments.some(seg=>seg.method!==row.segments[0].method))
    invalidField(logical+'.method',logical+' requires a single method shared by all segments');
   for(const [index,seg] of row.segments.entries()){
    const field=key=>logical+'.segments.'+index+'.'+key;
    const input=(key,options)=>atField(field(key),()=>value(seg[key],options));
    if(!dcMethods(row.role).includes(seg.method))invalidField(logical+'.method',logical+' has an invalid method for its role');
    if(dc.preset==='point-by-point'&&seg.range!=='auto'){
     const range=atField(field('range'),()=>numeric(seg.range,logical+' range'));
     if(range<=0||range>(current?200:1))
      invalidField(field('range'),logical+' measurement range is outside the SMU planning envelope');
    }
    let values,keys=[];
    if(logical===reference)values=[referenceV];
    else if(seg.method==='constant'){values=[input('value')];keys=['value'];}
    else if(seg.method==='generator'){
     const generated=input('formula',{generator:true,outer});
     if(Number.isNaN(generated))continue;
     values=[generated];keys=['formula'];
    }
    else if(seg.method==='list'){
     values=atField(field('list'),()=>seg.list.split(/[,\n]/).map(item=>value(item)));
     keys=values.map(()=> 'list');
    }
    else{
     const start=input('start'),stop=input('stop');
     values=[start,stop];
     keys=['start','stop'];
     if(seg.method==='step'){
      const step=input('step');
      if(start===stop||Math.sign(stop-start)!==Math.sign(step)||Math.abs((stop-start)/step)>4095)
       invalidField(field('step'),logical+' requires a step toward Stop and no more than 4096 planned points');
     }else{
      const points=atField(field('points'),()=>positiveInt(input('points'),4096,logical+' Points'));
      if(points<2||start===stop||(seg.method==='log'&&(start===0||Math.sign(start)!==Math.sign(stop))))
       invalidField(field(points<2?'points':'stop'),
        logical+' requires distinct endpoints and at least two points; log endpoints must share a nonzero sign');
     }
    }
    const outside=values.findIndex(level=>Math.abs(level)>(current?1.05:210)||
     (Math.abs(level)>(current?0.105:21)&&compliance>(current?21:0.105)));
    if(outside>=0)invalidField(keys[outside]?field(keys[outside]):'referenceV',
     logical+' source or compliance exceeds the SMU planning envelope');
   }
  }
  if(dc.preset==='point-by-point'&&dc.strategy.hold.trim()){
   const hold=atField('hold',()=>numeric(dc.strategy.hold,'Hold time'));
   if(hold<0||hold>1000)invalidField('hold','Hold time must be between 0 and 1000 s');
  }
  if(dc.strategy.mode==='local'){
   for(const key of ['integration','delay']){
    const raw=dc.strategy[key].trim();
    if(raw&&(atField(key,()=>numeric(raw,key))<0||(key==='integration'&&Number(raw)===0)))
     invalidField(key,'Enter a positive integration time and a nonnegative delay, or leave them blank for Default');
   }
  }
  return {x:assigned('X')[0].logical,p:assigned('P')[0]?.logical||null,outputs,preset:dc.preset};
 }

 const initial=()=>({schema:1,sequence:ROUTINE_DEFAULTS.length,activeId:'page-1',
  activeDeviceId:'device-1',devices:[{id:'device-1',name:'MOSFET'}],
  activeRoutineId:'routine-1',
  routines:[{id:'routine-1',deviceId:'device-1',name:'测试流程 1'}],
  specs:[],pages:ROUTINE_DEFAULTS.map((kind,index)=>page(kind,'page-'+(index+1))),ui:{graphs:{count:4,
   kinds:['iv','transfer','it','raw'],sources:['','','','']}}});
 function validate(state){
  if(state?.schema!==1||!Array.isArray(state.pages)||!state.pages.length||
     state.pages.length>128||!Number.isSafeInteger(state.sequence)||state.sequence<1)
   throw Error('Invalid DKTS project state');
  state=clone(state);
  // Schema-1 snapshots predate Device ownership. Migrate in a cloned state
  // only; never change an already persisted project while merely validating.
  if(!Array.isArray(state.devices))
   state.devices=[{id:'device-1',name:'MOSFET'}];
  if(!state.devices.length||state.devices.length>100)
   throw Error('Invalid Device count');
  const deviceIds=new Set();
  for(const device of state.devices){
   if(!/^device-[A-Za-z0-9-]+$/.test(device?.id||'')||
      deviceIds.has(device.id)||typeof device.name!=='string'||
      !device.name.trim()||device.name.length>64)
    throw Error('Invalid Device');
   deviceIds.add(device.id);
  }
  if(!Array.isArray(state.routines)||!state.routines.length)
   state.routines=[{id:'routine-1',deviceId:state.devices[0].id,name:'测试流程 1'}];
  if(state.routines.length>100)throw Error('Too many Routines');
  const routineIds=new Set(),routineOwners=new Map();
  for(const routine of state.routines){
   if(!routine.deviceId)routine.deviceId=state.devices[0].id;
   if(!/^routine-[A-Za-z0-9-]+$/.test(routine?.id||'')||
      routineIds.has(routine.id)||typeof routine.name!=='string'||
      !routine.name.trim()||routine.name.length>64||
      !deviceIds.has(routine.deviceId))throw Error('Invalid Routine or Device ownership');
   routine.loops=String(positiveInt(routine.loops??'1',10000,'Routine loops'));
   routineIds.add(routine.id);
   routineOwners.set(routine.id,routine.deviceId);
  }
  if(!Array.isArray(state.specs))state.specs=[];
  if(state.specs.length>100)throw Error('Too many Specs');
  const specIds=new Set(),specOwners=new Map();
  for(const spec of state.specs){
   if(!spec.deviceId)spec.deviceId=state.devices[0].id;
   if(!/^spec-[A-Za-z0-9-]+$/.test(spec?.id||'')||
      specIds.has(spec.id)||typeof spec.name!=='string'||
      !spec.name.trim()||spec.name.length>64||
      !deviceIds.has(spec.deviceId))throw Error('Invalid Spec or Device ownership');
   specIds.add(spec.id);
   specOwners.set(spec.id,spec.deviceId);
  }
  const ids=new Set();
  const legacyMapping=state.portMapping===undefined;
  if(!legacyMapping&&(!state.portMapping||Object.keys(state.portMapping).length!==4||
     logicalsList.some(logical=>!validResource(state.portMapping[logical]))))
   throw Error('Invalid project port mapping');
  for(const p of state.pages){
   if(!p.routineId)p.routineId=state.routines[0].id;
   if(!routineIds.has(p.routineId))throw Error('Page references an unknown Routine');
   if(p.associateSpecId===undefined)p.associateSpecId=null;
   if(p.associateSpecId!==null&&
      (!specIds.has(p.associateSpecId)||
       specOwners.get(p.associateSpecId)!==routineOwners.get(p.routineId)))
    throw Error('Page Spec must belong to the same Device');
   if(!/^page-[1-9]\d*$/.test(p?.id||'')||ids.has(p.id)||!KINDS.some(k=>k.id===p.kind)||
      !Array.isArray(p.terminals)||p.terminals.length!==4)throw Error('Invalid Page');
   ids.add(p.id);
   if(typeof p.name!=='string'||!p.name.trim()||p.name.length>64)
    throw Error('Invalid Page name');
   if(p.note===undefined)p.note='';
   if(typeof p.note!=='string'||p.note.length>512)throw Error('Invalid Page note');
   // UI planning metadata is never a hardware execution permission.
   if(!p.target)p.target={name:'Id',logical:'D',quantity:'Current',range:'auto'};
   if(typeof p.target.name!=='string'||!p.target.name.trim()||p.target.name.length>32)
    p.target.name='Id';
   if(!['D','G','S','B'].includes(p.target.logical)||
      !['Current','Voltage'].includes(p.target.quantity))throw Error('Invalid Target plan');
   if(!Array.isArray(p.targets)||!p.targets.length){
    p.targets=[{id:'target-1',name:p.target.name||'Id',logical:p.target.logical,
     quantity:p.target.quantity,range:p.target.range||'auto'}];
   }
   if(p.targets.length>16)throw Error('Too many measurement targets');
   const targetIds=new Set(),targetNames=new Set();
   for(const [index,target] of p.targets.entries()){
    if(!target||!/^target-[1-9][0-9]*$/.test(target.id||'')||targetIds.has(target.id)||
       typeof target.name!=='string'||! /^[A-Za-z][A-Za-z0-9_]{0,31}$/.test(target.name)||
       targetNames.has(target.name)||!['D','G','S','B'].includes(target.logical)||
       !['Current','Voltage'].includes(target.quantity)||
       !(target.range==='auto'||/^(?:1e-[0-9]+|1e[0-9]+|[0-9]+(?:\.[0-9]+)?)$/.test(String(target.range))))
     throw Error('Invalid measurement target '+(index+1));
    targetIds.add(target.id);targetNames.add(target.name);
   }
   p.target={...p.targets[0]};
   if(!Array.isArray(p.variables))p.variables=[];
   if(p.variables.length>32)throw Error('Too many Page variables');
   const variableNames=new Set();
   for(const variable of p.variables){
    if(!/^[A-Za-z][A-Za-z0-9_]{0,31}$/.test(variable?.name||'')||
       variableNames.has(variable.name))throw Error('Invalid or duplicate Page variable name');
    variableNames.add(variable.name);
    numeric(variable.value,'Page variable');
    if(typeof variable.unit!=='string'||variable.unit.length>12)
     throw Error('Invalid Page variable unit');
   }
   const resources=new Set(),roles=new Set(),logicals=new Set();
   for(const t of p.terminals){
    if(logicals.has(t.logical))throw Error('Duplicate logical terminal: '+t.logical);
    logicals.add(t.logical);
    if(!legacyMapping)t.resource=state.portMapping[t.logical];
    if(t.resource!=='None'){
     if(resources.has(t.resource))throw Error('Duplicate SMU assignment: '+t.resource);
     resources.add(t.resource);
     if(t.role!=='CONDITION'){
      if(roles.has(t.role))throw Error('Duplicate sweep role: '+t.role);
      roles.add(t.role);
     }
    }
    if(t.complianceMode===undefined)t.complianceMode='follow-range';
    if(!logicalsList.includes(t.logical)||!validResource(t.resource)||
       !['voltage','current'].includes(t.sourceMode)||!['CONDITION','X','P'].includes(t.role)||
       !['auto','minimum','limited-auto','fixed'].includes(t.rangeMode)||
       !['follow-range','custom'].includes(t.complianceMode)||
       (['minimum','limited-auto'].includes(t.rangeMode)&&t.sourceMode!=='voltage'))
     throw Error('Invalid port mapping');
    const numeric=/^[+-]?(?:[0-9]+[.]?[0-9]*|[.][0-9]+)(?:[eE][+-]?[0-9]+)?$/;
    for(const key of ['bias','start','stop','step','compliance','rangeValue']){
     const raw=String(t[key]??'').trim();
     if(!numeric.test(raw)||!Number.isFinite(Number(raw)))
      throw Error('Invalid numeric input: '+t.logical+'.'+key);
    }
    const magnitude=Math.max(Math.abs(Number(t.bias)),Math.abs(Number(t.start)),Math.abs(Number(t.stop)));
    const compliance=Number(t.compliance),range=Number(t.rangeValue);
    if(compliance<=0||Number(t.step)===0||range<=0)throw Error('Invalid limit/step/range');
    // Overall theoretical envelope across SMUs: this is NOT per-model
    // authorization. Exact attached module/preamp check remains mandatory.
    const sourceMax=t.sourceMode==='voltage'?210:1.05;
    const complianceMax=t.sourceMode==='voltage'?1.05:210;
    if(magnitude>sourceMax||compliance>complianceMax)
     throw Error('HARDWARE_ENVELOPE: source/compliance exceeds 4200A SMU maximum');
    if((t.sourceMode==='voltage'&&magnitude>21&&compliance>0.105)||
       (t.sourceMode==='current'&&magnitude>0.105&&compliance>21))
     throw Error('HARDWARE_POWER_ENVELOPE: high voltage and high current cannot coexist');
    if(t.rangeMode!=='auto'&&range>complianceMax)
     throw Error('HARDWARE_RANGE_ENVELOPE: measurement range exceeds theoretical limit');
   }
   validateSweep(p);
   if(p.kind==='dc'){
    if(p.dc===undefined)p.dc=defaultDc(p);
    else if(p.dc&&typeof p.dc==='object')migrateDcPreset(p.dc);
    validateDcShape(p.dc);
    if(p.dc.specIds.some(id=>specOwners.get(id)!==routineOwners.get(p.routineId)))
     throw Error('DC Spec must belong to the same Device');
   }
   if(TIMED_DEFAULTS[p.kind]){
    p.timing=timingSettings(p.kind,p.timing);
    timedSummary(p.kind,p.timing);
   }
  }
  // UI plot layout is canonical project state and survives Core workspace reopening.
  if(!state.ui||typeof state.ui!=='object')state.ui={};
  if(!state.ui.graphs)state.ui.graphs=initial().ui.graphs;
  const graphs=state.ui.graphs;
  if(![1,2,4].includes(Number(graphs.count))||!Array.isArray(graphs.kinds)||
     graphs.kinds.length!==4||!Array.isArray(graphs.sources)||graphs.sources.length!==4)
   throw Error('Invalid persisted plot window state');
  if(graphs.kinds.some(kind=>!PLOT_KINDS.includes(kind))||
     graphs.sources.some(id=>typeof id!=='string'||id.length>160))
   throw Error('Invalid plot selection');
  if(!ids.has(state.activeId))throw Error('Active Page missing');
  if(legacyMapping){
   state.portMapping=mappingOf(state.pages.find(p=>p.id===state.activeId).terminals);
   for(const p of state.pages){
    const original=mappingOf(p.terminals);
    if(logicalsList.some(logical=>original[logical]!==state.portMapping[logical]))
     p.previousPortMapping=original;
   }
   return validate(state);
  }
  const scoped=state.ui.scopedGraphs||{};
  state.ui.scopedGraphs=Object.fromEntries(Object.entries(scoped).filter(([id,graph])=>
   (ids.has(id)||routineIds.has(id))&&graph&&[1,2,4].includes(Number(graph.count))&&
   Array.isArray(graph.kinds)&&graph.kinds.length===4&&graph.kinds.every(kind=>PLOT_KINDS.includes(kind))&&
   Array.isArray(graph.sources)&&graph.sources.length===4&&graph.sources.every(id=>typeof id==='string'&&id.length<=160)));
  state.activeRoutineId=state.pages.find(p=>p.id===state.activeId).routineId;
  state.activeDeviceId=routineOwners.get(state.activeRoutineId);
  return state;
 }
 function add(s,kind,routineId){
  s=validate(s);const id='page-'+(s.sequence+1);
  const target=routineId||s.activeRoutineId;
  if(!s.routines.some(r=>r.id===target))throw Error('Unknown Routine');
  s.sequence++;s.pages.push(page(kind,id,target));
  s.activeId=id;s.activeRoutineId=target;return validate(s);
 }
 function addRoutineDefaults(s,routineId){
  let next=s;
  const firstId='page-'+(s.sequence+1);
  for(const kind of ROUTINE_DEFAULTS)next=add(next,kind,routineId);
  return select(next,firstId);
 }
 function addRoutine(s,deviceId){
  s=validate(s);
  if(s.routines.length>=100||s.pages.length+ROUTINE_DEFAULTS.length>128)
   throw Error('Maximum Routines or Pages reached');
  const owner=deviceId||s.activeDeviceId;
  if(!s.devices.some(d=>d.id===owner))throw Error('Unknown Device');
  const routineId='routine-'+(s.routines.length+1);
  if(s.routines.some(r=>r.id===routineId))throw Error('Duplicate Routine ID');
  s.routines.push({id:routineId,deviceId:owner,name:'测试流程 '+(s.routines.length+1)});
  return addRoutineDefaults(s,routineId);
 }
 function addDevice(s){
  s=validate(s);
  if(s.devices.length>=100)throw Error('Maximum 100 Devices');
  const deviceId='device-'+(s.devices.length+1);
  if(s.devices.some(d=>d.id===deviceId))throw Error('Duplicate Device ID');
  s.devices.push({id:deviceId,name:'器件 '+(s.devices.length+1)});
  return addRoutine(s,deviceId);
 }
 function selectDevice(s,deviceId){
  s=validate(s);
  if(!s.devices.some(d=>d.id===deviceId))throw Error('Unknown Device');
  const routine=s.routines.find(r=>r.deviceId===deviceId);
  if(!routine)return addRoutine(s,deviceId);
  return selectRoutine(s,routine.id);
 }
 function selectRoutine(s,routineId){
  s=validate(s);
  if(!s.routines.some(r=>r.id===routineId))throw Error('Unknown Routine');
  const first=s.pages.find(p=>p.routineId===routineId);
  if(!first)return addRoutineDefaults(s,routineId);
  s.activeId=first.id;s.activeRoutineId=routineId;
  return validate(s);
 }
 function setRoutineLoops(s,routineId,loops){
  s=validate(s);
  const routine=s.routines.find(row=>row.id===routineId);
  if(!routine)throw Error('Unknown Routine');
  routine.loops=String(positiveInt(loops,10000,'Routine loops'));
  return s;
 }
 function addSpec(s){
  s=validate(s);
  if(s.specs.length>=100)throw Error('Maximum 100 Specs');
  const id='spec-'+(s.specs.length+1);
  if(s.specs.some(spec=>spec.id===id))throw Error('Duplicate Spec ID');
  s.specs.push({id,deviceId:s.activeDeviceId,name:'Spec '+(s.specs.length+1)});
  return associateSpec(s,id);
 }
 function associateSpec(s,specId){
  s=validate(s);
  if(specId!==null&&!s.specs.some(spec=>spec.id===specId&&
      spec.deviceId===s.activeDeviceId))
   throw Error('Spec belongs to another Device or is unknown');
  const active=s.pages.find(p=>p.id===s.activeId);
  active.associateSpecId=specId;
  if(active.kind==='dc'&&specId&&!active.dc.specIds.includes(specId))active.dc.specIds.push(specId);
  return validate(s);
 }
 function removeDcSpec(s,specId){
  s=validate(s);
  const page=s.pages.find(p=>p.id===s.activeId);
  if(page.kind!=='dc')throw Error('Select a DC test');
  page.dc.specIds=page.dc.specIds.filter(id=>id!==specId);
  if(page.associateSpecId===specId)page.associateSpecId=page.dc.specIds[0]||null;
  return validate(s);
 }
 function remove(s,id){
  s=validate(s);
  if(s.pages.length===1)throw Error('Cannot remove the last test');
  const index=s.pages.findIndex(x=>x.id===id);
  if(index<0)throw Error('Page missing');
  s.pages.splice(index,1);
  if(s.activeId===id)s.activeId=s.pages[Math.min(index,s.pages.length-1)].id;
  return validate(s);
 }
 function select(s,id){
  s=validate(s);if(!s.pages.some(x=>x.id===id))throw Error('Page missing');
  s.activeId=id;s.activeRoutineId=s.pages.find(p=>p.id===id).routineId;return s;
 }
 function editPage(s,changes){
  s=validate(s);
  if(!changes||typeof changes!=='object'||
     Object.keys(changes).some(k=>!['name','note','kind'].includes(k)))
   throw Error('Invalid Page metadata change');
  const page=s.pages.find(p=>p.id===s.activeId),patch={...changes};
  if(patch.kind!==undefined){
   const kind=KINDS.find(row=>row.id===patch.kind);if(!kind)throw Error('Unknown test type');
   if(page.kind!==kind.id){
    delete page.timing;
    delete page.dc;
   }
   page.kind=kind.id;page.testType=kind.testType;
   if(patch.name===undefined)page.name=kind.label;
   delete patch.kind;
  }
  Object.assign(page,patch);
  return validate(s);
 }
 function editDc(s,settings){
  s=validate(s);
  const page=s.pages.find(p=>p.id===s.activeId);
  if(page.kind!=='dc')throw Error('Select a DC test');
  const dc=clone({...settings,bodyResource:page.dc.bodyResource,specIds:page.dc.specIds});
  dcSummary(page,dc);
  page.dc=dc;
  return validate(s);
 }
 function editDcBody(s,resource){
  s=validate(s);
  const page=s.pages.find(p=>p.id===s.activeId);
  if(page.kind!=='dc'||!validDcBody(resource))throw Error('Select an SMU, GNDU or None for the DC body terminal');
  if(resource!=='None'&&page.terminals.some(t=>t.logical!=='B'&&t.resource===resource))
   throw Error('Resource already assigned: '+resource);
  page.dc.bodyResource=resource;
  return validate(s);
 }
 function editTiming(s,changes){
  s=validate(s);
  const p=s.pages.find(row=>row.id===s.activeId),defaults=TIMED_DEFAULTS[p.kind];
  if(!defaults||!changes||Object.keys(changes).some(key=>!Object.hasOwn(defaults,key)&&!(p.kind==='pulse'&&key==='windowStopUs')))
   throw Error('Invalid timing parameter');
  p.timing={...p.timing,...changes};
  return validate(s);
 }
 function editDevice(s,changes,id){
  s=validate(s);
  if(!changes||typeof changes!=='object'||Object.keys(changes).some(k=>k!=='name'))
   throw Error('Invalid Device metadata change');
  const device=s.devices.find(row=>row.id===(id||s.activeDeviceId));
  if(!device)throw Error('Active Device missing');
  Object.assign(device,changes);return validate(s);
 }
 function editTarget(s,indexOrChanges,maybeChanges){
  s=validate(s);
  const index=typeof indexOrChanges==='number'?indexOrChanges:0;
  const changes=typeof indexOrChanges==='number'?maybeChanges:indexOrChanges;
  if(!Number.isInteger(index)||!changes||typeof changes!=='object'||
     Object.keys(changes).some(k=>!['name','logical','quantity','range'].includes(k)))
   throw Error('Invalid Target change');
  const page=s.pages.find(p=>p.id===s.activeId),target=page.targets[index];
  if(!target)throw Error('Target missing');
  Object.assign(target,changes);page.target={...page.targets[0]};
  return validate(s);
 }
 function addTarget(s){
  s=validate(s);const page=s.pages.find(p=>p.id===s.activeId);
  if(page.targets.length>=16)throw Error('Maximum 16 measurement targets');
  let index=page.targets.length+1,name='I'+index;
  while(page.targets.some(row=>row.name===name)){index++;name='I'+index;}
  const available=page.terminals.find(t=>!['None','GNDU'].includes(t.resource));
  if(!available)throw Error('No assigned SMU is available for a measurement target');
  let targetIndex=1;while(page.targets.some(row=>row.id==='target-'+targetIndex))targetIndex++;
  const id='target-'+targetIndex;
  page.targets.push({id,name,logical:available.logical,quantity:'Current',range:'auto'});
  page.target={...page.targets[0]};return validate(s);
 }
 function removeTarget(s,index){
  s=validate(s);const page=s.pages.find(p=>p.id===s.activeId);
  if(!Number.isInteger(index)||index<0||index>=page.targets.length)throw Error('Target missing');
  if(page.targets.length<=1)throw Error('At least one measurement target must remain');
  page.targets.splice(index,1);page.target={...page.targets[0]};return validate(s);
 }
 function addVariable(s){
  s=validate(s);
  const vars=s.pages.find(p=>p.id===s.activeId).variables;
  if(vars.length>=32)throw Error('Maximum 32 Page variables');
  let index=vars.length+1;
  while(vars.some(row=>row.name==='var'+index))index++;
  vars.push({name:'var'+index,value:'0',unit:'V'});
  return validate(s);
 }
 function editVariable(s,index,changes){
  s=validate(s);
  if(!Number.isInteger(index)||!changes||typeof changes!=='object'||
     Object.keys(changes).some(k=>!['name','value','unit'].includes(k)))
   throw Error('Invalid Page variable change');
  const vars=s.pages.find(p=>p.id===s.activeId).variables;
  if(index<0||index>=vars.length)throw Error('Page variable missing');
  Object.assign(vars[index],changes);
  return validate(s);
 }
 function removeVariable(s,index){
  s=validate(s);
  const vars=s.pages.find(p=>p.id===s.activeId).variables;
  if(!Number.isInteger(index)||index<0||index>=vars.length)
   throw Error('Page variable missing');
  vars.splice(index,1);
  return validate(s);
 }
 function edit(s,logical,values){
  s=validate(s);
  const p=s.pages.find(x=>x.id===s.activeId),t=p.terminals.find(x=>x.logical===logical);
  if(!t||!values||Object.keys(values).some(key=>![
   'resource','sourceMode','role','bias','start','stop','step','compliance','complianceMode','rangeMode','rangeValue'
  ].includes(key)))throw Error('Invalid terminal change');
  Object.assign(t,values);
  if(Object.hasOwn(values,'resource'))s.portMapping[logical]=values.resource;
  if(values.sourceMode&&t.role!=='CONDITION'){
   // Changing source quantity must reset all associated sweep segment units.
   const key=t.role==='X'?'xSegments':'pSegments';
   p.sweep[key]=[segment(values.sourceMode,t.role)];
  }
  if(values.sourceMode){
   // Source units have changed (volts versus amperes), so retaining a
   // voltage sweep 0..2 as a 0..2 A sweep would violate the hardware
   // envelope. Reset ALL incompatible numeric quantities atomically.
   if(values.sourceMode==='current')Object.assign(t,{
    bias:'0',start:'0',stop:'0.01',step:'0.001',compliance:'2',
    rangeMode:'auto',rangeValue:'2'
   });else Object.assign(t,{
    bias:'0',start:'0',stop:'2',step:'0.1',compliance:'0.01',
    rangeMode:'auto',rangeValue:'1e-6'
   });
  }
  if(values.resource==='None')for(const page of s.pages)
   page.terminals.find(term=>term.logical===logical).role='CONDITION';
  if(values.role&&values.role!=='CONDITION')for(const other of p.terminals)
   if(other!==t&&other.role===values.role)other.role='CONDITION';
  return validate(s);
 }
 function editSweep(s,changes){
  s=validate(s);
  if(!changes||typeof changes!=='object'||Object.keys(changes).some(k=>!sweepKeys.includes(k)))
   throw Error('Invalid sweep setting');
  const p=s.pages.find(x=>x.id===s.activeId);
  Object.assign(p.sweep,changes);
  if(Object.prototype.hasOwnProperty.call(changes,'pointDelay')){
   for(const row of [...p.sweep.xSegments,...p.sweep.pSegments])row.delayMs=String(changes.pointDelay);
  }
  return validate(s);
 }
 function orientSegmentStep(row){
  const direction=Math.sign(numeric(row.stop,'stop')-numeric(row.start,'start'));
  const step=numeric(row.step,'step');
  if(direction&&step&&Math.sign(step)!==direction)row.step=String(-step);
 }
 function connectFollowingSegments(list,index){
  for(let i=index+1;i<list.length;i++){
   const row=list[i];
   const singlePoint=Number(row.start)===Number(row.stop)&&Number(row.step)===0;
   row.start=list[i-1].stop;
   if(singlePoint)row.stop=row.start;
   if(Number(row.start)===Number(row.stop))row.step='0';
   orientSegmentStep(row);
  }
 }
 function editSegment(s,axis,index,changes){
  s=validate(s);
  if(!['X','P'].includes(axis)||!Number.isInteger(index)||!changes||
     Object.keys(changes).some(k=>!segmentKeys.includes(k)))throw Error('Invalid sweep segment change');
  const p=s.pages.find(x=>x.id===s.activeId),list=p.sweep[axis==='X'?'xSegments':'pSegments'];
  if(index<0||index>=list.length)throw Error('Sweep segment missing');
  const row=list[index];
  Object.assign(row,changes);
  if(['start','stop','step'].some(key=>Object.hasOwn(changes,key))){
   if(!Object.hasOwn(changes,'step')&&numeric(row.start,'start')===numeric(row.stop,'stop'))
    row.step='0';
   orientSegmentStep(row);
   if(Object.hasOwn(changes,'stop'))connectFollowingSegments(list,index);
  }
  return validate(s);
 }
 function addSegment(s,axis){
  s=validate(s);
  if(!['X','P'].includes(axis))throw Error('Unknown sweep axis');
  const p=s.pages.find(x=>x.id===s.activeId),list=p.sweep[axis==='X'?'xSegments':'pSegments'];
  if(list.length>=64)throw Error('Maximum 64 segments per axis');
  const terminal=p.terminals.find(t=>t.role===axis&&t.resource!=='None');
  const next=segment(terminal?.sourceMode||'voltage',axis);
  next.delayMs=String(p.sweep.pointDelay??'20');
  const last=list[list.length-1];
  next.start=last.stop;
  next.stop=next.start;
  next.step='0'; // A one-point segment must use step=0, per the KXCI planner.
  list.push(next);
  return validate(s);
 }
 function removeSegment(s,axis,index){
  s=validate(s);
  if(!['X','P'].includes(axis)||!Number.isInteger(index))throw Error('Invalid sweep axis/index');
  const p=s.pages.find(x=>x.id===s.activeId),list=p.sweep[axis==='X'?'xSegments':'pSegments'];
  if(index<0||index>=list.length)throw Error('Sweep segment missing');
  if(list.length<=1)throw Error('At least one segment must remain');
  list.splice(index,1);
  if(index>0)connectFollowingSegments(list,index-1);
  return validate(s);
 }
 // Core owns the canonical DataTable buffer and the drawing engine.
 // A curve reads bounded, immutable column slices instead of copying a whole
 // Artifact with artifacts.get(). Display decimation never changes raw data.
 function curvesFromArtifacts(refs,store,{maxRead=65536,maxDisplay=8192,axis='iv'}={}){
  const out=[];
  if(!Array.isArray(refs)||!store?.columnMetadata||!store?.readColumnRange)return out;
  const budget=Math.max(1,Math.min(65536,Math.floor(Number(maxRead)||65536)));
  const display=Math.max(4,Math.min(16384,Math.floor(Number(maxDisplay)||8192)));
  for(const ref of refs){
   if(!ref||!ref.artifactId||ref.excluded===true)continue;
   const id=String(ref.artifactId),cols=store.columnMetadata(id);
   if(!Array.isArray(cols)||!cols.length)continue;
   const norm=c=>String(c.key||c.name||c.id||'').toLowerCase().replace(/[^a-z0-9]/g,'');
   const choose=(keys,role,allowRole=true)=>cols.find(c=>keys.includes(norm(c)))||
    (allowRole?cols.find(c=>c.role===role):null);
   const xkeys={
    iv:['drainvoltagev','vdset','vd','voltage','vds','drainvoltage','x'],
    transfer:['gatevoltagev','vg','vgs','gatevoltage'],
    it:['times','time','elapsedseconds','seconds','t'],
    vt:['times','time','elapsedseconds','seconds','t']
   };
   if(!Object.prototype.hasOwnProperty.call(xkeys,axis))throw Error('Unknown graph axis');
   const x=choose(xkeys[axis],'x',axis==='iv');
   const y=axis==='vt'?choose(['drainvoltagev','measuredvoltagev','measuredvoltage','voltagev','voltage','vd'],'y',false):
    choose(['draincurrenta','id','current','ids','i','draincurrent','y'],'y',axis!=='it');
      if(!x||!y||x===y)continue;
   const total=Math.min(Number(x.length)||0,Number(y.length)||0);
   if(!Number.isSafeInteger(total)||total<=0)continue;
   // Span the entire raw table, not just the first 65536 rows. All accesses
   // use the DKDS Data Center bounded column-read interface; no artifacts.get().
   const limit=Math.min(budget,total);
   const windows=total<=limit?1:Math.min(32,Math.max(2,Math.ceil(total/limit)));
   const baseSize=Math.floor(limit/windows),extra=limit%windows;
   const spans=[];
   let cursor=0;
   for(let i=0;i<windows;i++){
    const size=baseSize+(i<extra?1:0);
    if(!size)continue;
    const ideal=windows===1?0:Math.round(i*(total-size)/(windows-1));
    const start=Math.max(cursor,Math.min(total-size,ideal));
    spans.push({start,limit:size});
    cursor=start+size;
   }
   const sampled=[];
   let readRows=0;
   for(const span of spans){
    const xc=store.readColumnRange(id,x.id||x.key,span);
    const yc=store.readColumnRange(id,y.id||y.key,span);
    const isColumn=v=>Array.isArray(v)||ArrayBuffer.isView(v);
    if(!isColumn(xc?.values)||!isColumn(yc?.values))continue;
    const count=Math.min(span.limit,xc.values.length,yc.values.length);
    readRows+=count;
    for(let j=0;j<count;j++){
     const vx=Number(xc.values[j]),vy=Number(yc.values[j]);
     if(Number.isFinite(vx)&&Number.isFinite(vy))
      sampled.push({index:span.start+j,point:{x:vx,y:vy}});
    }
   }
   if(!sampled.length)continue;
   const chosen=[],seen=new Set();
   function keep(entry){
    if(entry&&!seen.has(entry.index)){seen.add(entry.index);chosen.push(entry);}
   }
   // Chronological min/max decimation retains local extrema of the rows
   // actually inspected. Unsampled gaps are NEVER represented as full coverage.
   keep(sampled[0]);
   const groups=Math.max(1,Math.floor((display-2)/2));
   const groupStep=Math.max(1,Math.ceil(sampled.length/groups));
   for(let start=0;start<sampled.length;start+=groupStep){
    const block=sampled.slice(start,start+groupStep);
    let lo=block[0],hi=block[0];
    for(const point of block){
     if(point.point.y<lo.point.y)lo=point;
     if(point.point.y>hi.point.y)hi=point;
    }
    for(const entry of [lo,hi].sort((a,b)=>a.index-b.index))keep(entry);
   }
   keep(sampled[sampled.length-1]);
   chosen.sort((a,b)=>a.index-b.index);
   const partial=readRows<total;
   out.push({id,artifactId:id,label:String(ref.name||id)+
     (partial?' (preview '+readRows+'/'+total+')':''),
    points:chosen.map(x=>x.point),
    source:{artifactId:id,kind:'dkds-artifact-bounded-preview',
     totalRows:total,readRows,displayRows:chosen.length,truncated:partial,
     coverage:partial?'stratified-intervals':'all-rows',
     windows:spans.map(x=>({start:x.start,rows:x.limit}))}});
  }
  return out;
 }
 const api=Object.freeze({KINDS,PLOT_KINDS,DC_PRESETS,DC_METHODS,dcMethods,dcTerminals,dcOutputs,dcSummary,editDc,editDcBody,removeDcSpec,initial,validate,add,addDevice,selectDevice,addRoutine,selectRoutine,setRoutineLoops,addSpec,associateSpec,remove,select,editPage,editDevice,editTiming,timedSummary,timeGrid,SMU_INTEGRATION_PLC,editTarget,addTarget,removeTarget,addVariable,editVariable,removeVariable,edit,editSweep,editSegment,addSegment,removeSegment,summary,pointAt,visible:p=>p.terminals.filter(t=>!['None','GNDU'].includes(t.resource)),curvesFromArtifacts});
 window.DKDSPluginModules.define('com.dkts.keithley-4200','model',api,{replace:true});
})();
