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
  {id:'arb',label:'分段脉冲',testType:'Pulse'},
  {id:'time',label:'时间扫描',testType:'IVT'},
  {id:'pulse',label:'Pulse I–V',testType:'Pulse'},
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
 const TIME_PMU_MODE='pmu-segmented';
 const TIME_PLAN_MAX_POINTS=65536;
 const TIME_TERMINALS=['D','G','S','B'];
 const timeTerminalDefaults=value=>Object.fromEntries(TIME_TERMINALS.map(key=>[key,value]));
 const SMU_PULSE_DEFAULTS=Object.freeze({
  start:'0.1',stop:'1',step:'0.1',onMs:'5',offMs:'20',drainLimitA:'0.001',
  gateRole:'off',gateV:'0',gateLimitA:'0.001'
 });
 const TIMED_DEFAULTS=Object.freeze({
  time:Object.freeze({mode:'linear-step',smuMode:'',pmu:null,reference:'',sourceModes:Object.freeze(timeTerminalDefaults('voltage')),voltageLimitsV:Object.freeze(timeTerminalDefaults('')),
   switchStepS:'0.1',sampleStepS:'0.1',listDelayS:'0.1',cycles:'1',integrationPreset:'instrument',integrationS:'',
   segments:Object.freeze([{durationS:'1',bias:timeTerminalDefaults('0'),currentBias:timeTerminalDefaults('0')}]),
   events:Object.freeze([{terminal:'D',quantity:'Current',startS:'0.1',intervalS:'0.1',averageS:'0.02',points:'9'}])}),
  retention:Object.freeze({terminal:'D',conditionV:'0',conditionS:'0',holdV:'0',readV:'0.1',
   firstS:'1',lastS:'100',windowS:'0.05',points:'10',spacing:'log',complianceA:'0.001'}),
  pulse:Object.freeze({terminal:'D',channel:'1',rangeV:'10',loadOhms:'',sweep:'amplitude',fixedV:'0',basePeakV:'',
   start:'0.1',stop:'1',step:'0.1',widthUs:'500',periodUs:'1000',riseUs:'10',fallUs:'10',
   delayUs:'0',holdUs:'0',baseDelayUs:'0',windowStartUs:'100',windowTimeUs:'300',
   pulseCount:'1',mode:'spot',rateHz:'1000000',sampleStepUs:'',currentRangeA:'',rangePolicy:'fixed',prePercent:'0',postPercent:'0',secondary:null,arb:null,arbPartner:null,biasSteps:null,smu:null,testMode:'sweep'})
 });
 function defaultBiasSteps(){
  return {edgeUs:'',loops:'1',segments:['0','1','0'].map((biasV,index)=>({
   biasV,durationUs:'10',measure:index===1,measureStartUs:'0',measureStopUs:''
  }))};
 }
 function defaultPmuTimeSettings(){
  return {...clone(TIMED_DEFAULTS.pulse),testMode:'bias-steps',rangeV:'auto',biasSteps:defaultBiasSteps()};
 }
 // KXCI Rev. F, SMU IT (0.1 / 1 / 10 power-line cycles).
 const SMU_INTEGRATION_PLC=Object.freeze({instrument:0,short:0.1,medium:1,long:10});
 function timeGroundNodes(page){
  return ['GND',...page.terminals.filter(term=>term.logical!=='B'&&term.resource==='GNDU').map(term=>term.logical)];
 }
 function timeReference(page,timing=page.timing){
  const nodes=timeGroundNodes(page);
  return timing.reference||nodes[1]||'GND';
 }
 const PLOT_KINDS=Object.freeze(['iv','transfer','it','vt','raw','target','target-h']);
 const timeBiasKey=mode=>mode==='current'?'currentBias':'bias';
 const timeBias=(settings,segment,terminal)=>segment[timeBiasKey(settings.sourceModes?.[terminal])]?.[terminal];
 function timeGrid(v,{allowLegacySampleGrid=false}={}){
  if(v.mode!==undefined&&!['linear-step','native-fixed','native-list'].includes(v.mode))invalidField('mode','Select a supported time sweep mode');
  if(v.mode==='native-list'){
   if(!Array.isArray(v.segments)||!v.segments.length||v.segments.length>64)throw Error('Use 1–64 bias segments');
   if(!Array.isArray(v.events)||v.events.length<1||v.events.length>6)throw Error('Use 1–6 measured signals');
   const delay=atField('listDelayS',()=>numeric(v.listDelayS,'Native list settling delay'));if(delay<0||delay>6.553)invalidField('listDelayS','DT must be between 0 and 6.553 s');
   let count=0;const starts=v.segments.map((s,i)=>{const start=count;count+=atField('segments.'+i+'.listPoints',()=>positiveInt(s.listPoints,4096,'Segment readings'));if(count>4096)invalidField('segments.'+i+'.listPoints','Native list supports up to 4096 readings per cycle');return start;});
   return {starts,durationS:null,segmentCount:v.segments.length,samplePoints:count,sampleStep:null,settlingDelayS:delay,nativeList:true};
  }
  if(v.mode==='native-fixed'){
   if(!Array.isArray(v.segments)||v.segments.length!==1)invalidField('mode','Native fixed bias requires one bias segment');
   if(!Array.isArray(v.events)||v.events.length<1||v.events.length>6)invalidField('mode','Native fixed bias requires 1–6 measurement signals');
   const event=v.events[0];
   const count=atField('events.0.points',()=>positiveInt(event.points,4096,'Native NR'));
   const start=atField('events.0.startS',()=>numeric(event.startS,'Native WT'));
   const interval=atField('events.0.intervalS',()=>numeric(event.intervalS,'Native IN'));
   if(start<0||start>100)invalidField('events.0.startS','WT must be between 0 and 100 s');
   if(interval<0||interval>10)invalidField('events.0.intervalS','IN must be between 0 and 10 s');
   // This is a diagram scale only, not a claimed physical duration.
   return {starts:[0],durationS:Math.max(0.001,start+count*interval),segmentCount:1,samplePoints:count,sampleStep:interval,nativeFixed:true};
  }
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
  if(!Number.isSafeInteger(segmentCount))
   invalidField('switchStepS','A cycle must have a finite number of switching steps');
  if(!Number.isSafeInteger(samplePoints)||(!allowLegacySampleGrid&&samplePoints>TIME_PLAN_MAX_POINTS))
   invalidField('sampleStepS','The planned sampling grid exceeds 65,536 points per cycle');
  if(!allowLegacySampleGrid&&samplePoints<1)
   invalidField('sampleStepS','The planned sampling grid needs at least one point per cycle');
  return {starts,durationS,segmentCount,samplePoints,sampleStep};
 }
 function timePreviewGrid(settings,axis){
  const grid=timeGrid(settings);
  if(!grid.nativeFixed&&!grid.nativeList)return {...grid,origin:0,pointsAxis:false,readings:[]};
  const pointsAxis=axis!=='time',fixed=grid.nativeFixed;
  const wait=fixed?Number(settings.events[0].startS):grid.settlingDelayS;
  const interval=fixed?grid.sampleStep:grid.settlingDelayS;
  const readings=[];
  const starts=grid.starts.map((start,segment)=>{
   const end=grid.starts[segment+1]??grid.samplePoints;
   for(let index=start;index<end;index++)readings.push({at:pointsAxis?index+1:wait+index*interval,segment});
   return pointsAxis?start+1:start*interval;
  });
  return {...grid,starts,origin:pointsAxis?1:0,durationS:readings.at(-1).at,pointsAxis,readings};
 }
 function timeSummary(v,context){
  const grid=timeGrid(v,context),{durationS,sampleStep}=grid;
  if(!['','GND','S','D','G'].includes(v.reference))invalidField('reference','Select a ground reference');
  for(const key of TIME_TERMINALS){
   const mode=v.sourceModes[key];
   if(!['voltage','current'].includes(mode))invalidField('sourceModes.'+key,'Select voltage or current source mode');
   const current=mode==='current';
   if(current&&(grid.nativeFixed||grid.nativeList)){const limit=atField('voltageLimitsV.'+key,()=>numeric(v.voltageLimitsV?.[key],key+' voltage compliance'));if(limit<=0||limit>210)invalidField('voltageLimitsV.'+key,'Current source requires a positive voltage compliance up to 210 V');}
   for(const [index,segment] of v.segments.entries()){
    const field='segments.'+index+'.'+timeBiasKey(mode)+'.'+key;
    const value=atField(field,()=>numeric(timeBias(v,segment,key),key+' bias'));
    if(Math.abs(value)>(current?1.05:210))invalidField(field,'Bias exceeds the SMU planning envelope');
   }
  }
  const cycles=atField('cycles',()=>positiveInt(v.cycles,10000,'Cycles'));
  if(!Object.hasOwn(SMU_INTEGRATION_PLC,v.integrationPreset))
   invalidField('integrationPreset','Select a supported SMU integration preset');
  if(grid.nativeFixed||grid.nativeList){
   if(v.integrationS!=='')invalidField('integrationPreset','Select an instrument integration preset');
   const event=v.events[0],signals=new Set();
   for(const [i,e] of v.events.entries()){
    if(!['D','G','S'].includes(e.terminal)||!['Current','Voltage'].includes(e.quantity))invalidField('events.'+i+'.terminal','Select a valid SMU measurement signal');
    const key=e.terminal+':'+e.quantity;
    if(signals.has(key))invalidField('events.'+i+'.quantity','Select each measurement signal only once');signals.add(key);
    if(grid.nativeFixed)for(const field of ['startS','intervalS','points'])if(Number(e[field])!==Number(event[field]))invalidField('events.'+i+'.'+field,'Native fixed bias signals share start, wait and reading count');
   }
   if(!Number.isSafeInteger(grid.samplePoints*cycles))invalidField('cycles','Total readings exceed safe integer');
   return {...grid,cycles,points:grid.samplePoints*cycles,signalCount:signals.size};
  }
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
  if(!Number.isFinite(durationS*cycles)||points*cycles>TIME_PLAN_MAX_POINTS)invalidField('cycles','Time plan exceeds the offline planning limit');
  return {...grid,cycles,points:points*cycles};
 }
 function timingSettings(kind,settings){
  const values={...clone(TIMED_DEFAULTS[kind]),...settings};
  if(kind==='time'){
   if(values.mode===TIME_PMU_MODE||values.pmu!=null){
    values.pmu=timingSettings('pulse',{...defaultPmuTimeSettings(),...values.pmu,testMode:'bias-steps'});
   }
   values.sourceModes={...timeTerminalDefaults('voltage'),...values.sourceModes};
   values.voltageLimitsV={...timeTerminalDefaults(''),...values.voltageLimitsV};
   if(Array.isArray(values.segments))values.segments=values.segments.map(segment=>segment&&({
    ...segment,listPoints:segment.listPoints??'1',currentBias:{...timeTerminalDefaults('0'),...segment.currentBias}
   }));
  }
  if(kind==='pulse'){
   if(settings?.testMode===undefined&&settings?.arb!=null)values.testMode='sequence';
   if(!['sweep','sequence','bias-steps','smu-sweep'].includes(values.testMode))throw Error('Invalid pulse test mode');
   if(values.smu!=null||values.testMode==='smu-sweep')values.smu={...SMU_PULSE_DEFAULTS,...values.smu};
   if(values.testMode==='sequence'&&values.arb==null)throw Error('Missing custom sequence');
  }
  if(kind==='pulse'&&Object.hasOwn(values,'windowStopUs')){
   values.windowTimeUs=String(numeric(values.windowStopUs,'Window stop')-numeric(values.windowStartUs,'Window start'));
   delete values.windowStopUs;
  }
  return values;
 }
 function pulseSecondarySettings(v){
  const secondary=v.secondary;
  const settings={...v,...secondary,secondary:null,sweep:secondary?.sweep??'amplitude',
   basePeakV:secondary?.basePeakV??'',rangePolicy:secondary?.rangePolicy??'fixed',
   prePercent:secondary?.prePercent??v.prePercent??'0',postPercent:secondary?.postPercent??v.postPercent??'0'};
  if(secondary?.role==='condition')Object.assign(settings,{
   sweep:'amplitude',fixedV:secondary.conditionV,start:'0',stop:'0',step:'0',
   widthUs:v.widthUs,riseUs:v.riseUs,fallUs:v.fallUs,delayUs:v.delayUs,
   windowStartUs:v.windowStartUs,windowTimeUs:v.windowTimeUs,prePercent:v.prePercent,postPercent:v.postPercent
  });
  return settings;
 }
 function smuPulseSummary(settings){
  const v={...SMU_PULSE_DEFAULTS,...settings};
  const n=key=>atField('smu.'+key,()=>numeric(v[key],key));
  const start=n('start'),stop=n('stop'),step=n('step');
  const points=atField('smu.step',()=>segmentPoints({start,stop,step}));
  if(points>256)invalidField('smu.step','SMU pulse supports up to 256 points per run');
  const onMs=n('onMs'),offMs=n('offMs');
  for(const [key,time] of [['onMs',onMs],['offMs',offMs]])
   if(!Number.isInteger(time)||time<5||time>20000)invalidField('smu.'+key,'SMU pulse timing requires 5–20000 whole milliseconds');
  if(points*(onMs+offMs)>120000)invalidField('smu.offMs','SMU pulse programmed waits exceed 120 s per run');
  if(!['off','condition'].includes(v.gateRole))invalidField('smu.gateRole','Invalid SMU gate role');
  const gate=v.gateRole==='condition',gateV=gate?n('gateV'):0;
  for(const [key,voltage] of [['start',start],['stop',stop],['gateV',gateV]])
   if(Math.abs(voltage)>21)invalidField('smu.'+key,'SMU pulse commissioning requires levels within ±21 V');
  const drainLimitA=n('drainLimitA'),gateLimitA=gate?n('gateLimitA'):0;
  if(drainLimitA<=0||drainLimitA>1)invalidField('smu.drainLimitA','SMU pulse compliance must be greater than zero and at most 1 A');
  if(gate&&(gateLimitA<=0||gateLimitA>1))invalidField('smu.gateLimitA','SMU pulse compliance must be greater than zero and at most 1 A');
  return {points,start,stop,step:points===1?0:step,onMs,offMs,gate,gateV,drainLimitA,gateLimitA};
 }
 function timedSummary(kind,settings,context){
  const defaults=TIMED_DEFAULTS[kind];
  if(!defaults)return null;
  const v=timingSettings(kind,settings);
  if(kind==='time')return v.mode===TIME_PMU_MODE?timedSummary('pulse',v.pmu,context):timeSummary(v,context);
  if(kind==='pulse'&&v.testMode==='smu-sweep')return smuPulseSummary(v.smu);
  if(kind==='pulse'&&['sequence','bias-steps'].includes(v.testMode)){
   const capabilities=window.DKDSPluginModules.require('com.dkts.keithley-4200','dkts-capabilities');
   return v.testMode==='sequence'?capabilities.normalizeArbPair(v):capabilities.normalizeSegmentArb(v,context);
  }
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
  const basePeakV=v.sweep==='base'?(v.basePeakV===''?(points===1?start+fixedV:NaN):n('basePeakV')):null;
  if(v.sweep==='base'&&!Number.isFinite(basePeakV))invalidField('basePeakV','Enter the fixed absolute peak voltage for a multi-point base sweep');
  const peakV=v.sweep==='amplitude'?Math.max(Math.abs(fixedV+start),Math.abs(fixedV+stop),Math.abs(fixedV)):Math.max(Math.abs(basePeakV),Math.abs(start),Math.abs(stop));
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
  if(!['fixed','limited-auto'].includes(v.rangePolicy))throw Error('Invalid current range policy');
  const pre=n('prePercent'),post=n('postPercent'),duration=rise+width+fall;
  if(pre<0||pre>1||post<0||post>1)throw Error('Waveform pre/post fraction must be between 0 and 1');
  if(v.mode==='waveform'&&(pre*duration>delay+1e-9||post*duration>period-delay-duration+1e-9))throw Error('Waveform pre/post capture exceeds available base time');
  const captureWindowS=v.mode==='waveform'?duration*(1+pre+post)*1e-6:windowUs*1e-6;
  const result={points,pulseCount,rateHz,rangeV,peakV,basePeakV,captureWindowS,windowS:windowUs*1e-6,loadOhms:v.loadOhms===''?null:n('loadOhms')};
  if(v.secondary!==null){
   if(!v.secondary||typeof v.secondary!=='object'||Array.isArray(v.secondary)||v.secondary.terminal===v.terminal||!['S','D','G'].includes(v.secondary.terminal))throw Error('Select a distinct second pulse terminal');
   const required=['terminal','channel','rangeV','loadOhms','fixedV','start','stop','step','widthUs','riseUs','fallUs','delayUs','windowStartUs','windowTimeUs','currentRangeA'],optional=['sweep','basePeakV','rangePolicy','prePercent','postPercent','role','conditionV'];
   if(Object.keys(v.secondary).some(k=>![...required,...optional].includes(k)||typeof v.secondary[k]!=='string')||required.some(k=>typeof v.secondary[k]!=='string'))throw Error('Invalid second pulse terminal parameters');
   if(v.secondary.role!==undefined&&!['psweep','condition'].includes(v.secondary.role))throw Error('Invalid second pulse terminal role');
   if(v.secondary.role==='condition')atField('secondary.conditionV',()=>{
    const voltage=numeric(v.secondary.conditionV,'Fixed bias');
    if(Math.abs(voltage)>Number(v.secondary.rangeV))throw Error('Fixed bias exceeds the selected PMU voltage range');
   });
   const outer=timedSummary('pulse',pulseSecondarySettings(v));
   if(v.mode==='waveform'&&outer.points!==1&&outer.points!==points)throw Error('Dual waveform requires equal-length simultaneous sweeps or a fixed companion pulse train');
   if(v.mode==='spot'&&outer.points>1&&points===1)throw Error('Psweep requires a multi-point Xsweep');
   result.secondary=outer;result.totalSweepPoints=v.mode==='waveform'?points:points*outer.points;
  }
  return result;
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
   ...(kind==='time'?{timing:{...clone(TIMED_DEFAULTS.time),mode:'native-fixed'}}:{}),
   target:{name:'Id',logical:'D',quantity:'Current',range:'auto'},
   targets:[{id:'target-1',name:'Id',logical:'D',quantity:'Current',range:'auto'}],variables:[]};
 };

 const DC_PRESETS=Object.freeze(['optimized','point-by-point']);
 const ROUTINE_DEFAULTS=Object.freeze(['dc','time']);
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
   strategy:{mode:'global',integrationPreset:'normal',integration:'',delay:'',hold:'',onLimit:'stop',direction:'forward'},specIds:p.associateSpecId?[p.associateSpecId]:[]};
 }
 function dcOutputs(p,settings=p.dc){
  return dcTerminals(p,settings).filter(t=>t.resource!=='GNDU').flatMap(t=>
   ['I','V'].map(prefix=>prefix+t.logical.toLowerCase()));
 }

 // Target functions operate on complete, ordered acquisition groups. They are
 // intentionally separate from the scalar Generator evaluator.
 const TARGET_VECTOR_ARITY=Object.freeze({linsweep:3,linrange:3,logsweep:3,range:-1,sum:-1,dydx:2,d2ydx2:2,d3ydx3:2,dxdy:2,d2xdy2:2,d3xdy3:2,integ:2});
 function targetUsesVector(ast){
  const [op,a,b]=ast;
  if(op==='f')return Object.hasOwn(TARGET_VECTOR_ARITY,a)||b.some(targetUsesVector);
  if(op==='n'||op==='v')return false;
  return targetUsesVector(a)||(op!=='neg'&&targetUsesVector(b));
 }
 function vectorNumber(v){return v==null||v===''?NaN:Number(v);}
 function vectorLength(n){if(!Number.isSafeInteger(n)||n<1||n>250000)throw Error('Target vector length must be 1–250000');return n;}
 function vectorPair(x,y){
  if(!Array.isArray(x)||!Array.isArray(y)||x.length!==y.length)throw Error('Target requires equal length X/Y vectors');
  return x.length;
 }
 function vectorDerivative(x,y){
  const n=vectorPair(x,y),out=Array(n).fill(NaN);
  const slope=(a,b)=>Number.isFinite(x[a])&&Number.isFinite(x[b])&&Number.isFinite(y[a])&&Number.isFinite(y[b])&&x[b]!==x[a]?(y[b]-y[a])/(x[b]-x[a]):NaN;
  for(let i=0;i<n;i++){
   if(!Number.isFinite(x[i])||!Number.isFinite(y[i]))continue;
   const l=i>0?slope(i-1,i):NaN,r=i+1<n?slope(i,i+1):NaN;
   if(i>0&&i+1<n&&Number.isFinite(l)&&Number.isFinite(r)){
    const dl=x[i]-x[i-1],dr=x[i+1]-x[i];
    if(Math.sign(dl)===Math.sign(dr))out[i]=(dr*l+dl*r)/(dl+dr);
   }else if(i===0)out[i]=r;
   else if(i===n-1)out[i]=l;
  }return out;
 }
 function vectorFunction(name,args){
  if(name==='range'){if(args.some(Array.isArray))throw Error('range requires scalar values');return args.slice();}
  if(name==='sum'){const a=args.flat();return a.every(Number.isFinite)?a.reduce((s,v)=>s+v,0):NaN;}
  if(['linsweep','linrange','logsweep'].includes(name)){
   if(args.some(v=>!Number.isFinite(v)))throw Error('Target sweep requires finite scalars');
   const [a,b,c]=args;
   if(name==='linsweep'){
    if(a===b){if(c!==0)throw Error('Single-point linsweep requires zero step');return [a];}
    if(c===0||Math.sign(c)!==Math.sign(b-a))throw Error('Invalid linsweep direction');
    const q=(b-a)/c,n=vectorLength(Math.round(q)+1);
    if(Math.abs(q-Math.round(q))>1e-8*Math.max(1,q))throw Error('linsweep endpoint is not reachable');
    return Array.from({length:n},(_,i)=>i===n-1?b:a+i*c);
   }
   const n=vectorLength(c);if(n===1){if(a!==b)throw Error('Single-point range endpoints must match');return [a];}
   if(name==='logsweep'&&(a<=0||b<=0))throw Error('logsweep requires positive endpoints');
   return Array.from({length:n},(_,i)=>i===0?a:i===n-1?b:name==='logsweep'?Math.exp(Math.log(a)+(Math.log(b)-Math.log(a))*i/(n-1)):a+(b-a)*i/(n-1));
  }
  const [x,y]=args;
  if(name==='integ'){
   const n=vectorPair(x,y),out=Array(n).fill(NaN);
   if(n&&Number.isFinite(x[0])&&Number.isFinite(y[0]))out[0]=0;
   for(let i=1;i<n;i++)if([out[i-1],x[i-1],x[i],y[i-1],y[i]].every(Number.isFinite))out[i]=out[i-1]+(x[i]-x[i-1])*(y[i]+y[i-1])/2;
   return out;
  }
  const reverse=name.includes('xdy'),order=name.startsWith('d3')?3:name.startsWith('d2')?2:1,independent=reverse?y:x;
  let result=reverse?x:y;for(let i=0;i<order;i++)result=vectorDerivative(independent,result);return result;
 }
 function vectorValue(ast,env,polarity){
  const [op,a,b]=ast;
  if(op==='n')return a;if(op==='v')return env[a];
  const scalar=(args,fn)=>{
   const vectors=args.filter(Array.isArray);if(!vectors.length)return fn(...args);
   const n=vectors[0].length;if(vectors.some(v=>v.length!==n))throw Error('Target vector lengths differ');
   return Array.from({length:n},(_,i)=>fn(...args.map(v=>Array.isArray(v)?v[i]:v)));
  };
  if(op==='neg')return scalar([vectorValue(a,env,polarity)],v=>-v);
  if(op==='f'){
   const args=b.map(v=>vectorValue(v,env,polarity));
   if(Object.hasOwn(TARGET_VECTOR_ARITY,a))return vectorFunction(a,args);
   return scalar(args,(...values)=>targetValue(['f',a,values.map(v=>['n',v])],{},polarity));
  }
  return scalar([vectorValue(a,env,polarity),vectorValue(b,env,polarity)],(x,y)=>targetValue([op,['n',x],['n',y]],{},polarity));
 }
 const TARGET_GROUP_KEYS=['routineCycle','stageIndex','cycle','pPoint','pRepeat','xRepeat','pulseResource','sweepDirection'];
 function targetVectorRows(target,rows){
  if(rows.length>250000)throw Error('Target vector calculation exceeds the 250000-row software budget');
  const out=Array(rows.length).fill(null);let start=0;
  const key=row=>JSON.stringify(TARGET_GROUP_KEYS.map(k=>row[k]??null));
  while(start<rows.length){
   let end=start+1;const group=key(rows[start]);
   while(end<rows.length&&key(rows[end])===group&&
    (rows[end].sequence==null||rows[end-1].sequence==null||Number(rows[end].sequence)===Number(rows[end-1].sequence)+1))end++;
   const block=rows.slice(start,end),env=Object.assign(Object.create(null),target.variables||{});
   for(const [k,c] of Object.entries(target.inputs))env[k]=block.map(row=>vectorNumber(row[c.key]));
   for(const z of target.formulas)env[z.name]=vectorValue(z.ast,env,target.polarity);
   const axisValue=axis=>{if(!axis)return null;const v=vectorValue(axis.ast,env,target.polarity);if(Array.isArray(v)&&v.length!==block.length)throw Error('Target plot vector must align with acquired rows');return v;};
   const x=axisValue(target.x),y=axisValue(target.y),h=axisValue(target.h);
   const at=(v,i)=>Array.isArray(v)?v[i]:v;
   for(let i=0;i<block.length;i++){
    if(!targetPassesP(target,block[i]))continue;
    const vx=at(x,i),vy=at(y,i),vh=at(h,i);
    out[start+i]={x:Number.isFinite(vx)?vx:null,y:Number.isFinite(vy)?vy:null,h:Number.isFinite(vh)?vh:null};
   }
   start=end;
  }return out;
 }

function targetExpression(input,known,deps,options={}){
 const s=String(input).trim();if(!s||s.length>512)throw Error('Target expression length must be 1–512');
 const re=/\s*([0-9]+(?:\.[0-9]*)?(?:[eE][+-]?\d+)?|\.[0-9]+(?:[eE][+-]?\d+)?|[A-Za-z][A-Za-z0-9_]*|[()+*/,^-])/y;
 const t=[];for(let p=0;p<s.length;p=re.lastIndex){re.lastIndex=p;const a=re.exec(s);if(!a)throw Error('Invalid Target expression');t.push(a[1]);}
 let i=0;const arity={abs:1,sqrt:1,ln:1,lg:1,sin:1,cos:1,tan:1,asin:1,acos:1,atan:1,sinh:1,cosh:1,tanh:1,sgn:1,pow:2,mod:2,pi:0,e:0,scale:0};
 function atom(){const a=t[i++];if(a==='('){const n=sum();if(t[i++]!==')')throw Error('Unclosed Target expression');return n;}if(/^[\d.]/.test(a||'')){const n=Number(a);if(!Number.isFinite(n))throw Error('Invalid Target number');return ['n',n];}if(!a||! /^[A-Za-z]/.test(a))throw Error('Expected Target value');
 const k=a.toLowerCase();if(t[i]==='('){i++;const args=[];if(t[i]!==')'){args.push(sum());while(t[i]===','){i++;args.push(sum());}}if((k==='getx'||k==='getp')&&options.generator&&args.length===0){if(t[i++]!==')'||k==='getp'&&!options.outer)throw Error('Generator has no Psweep');return ['v',k];}if(t[i++]!==')'||!(Object.hasOwn(arity,k)&&args.length===arity[k]||!options.generator&&Object.hasOwn(TARGET_VECTOR_ARITY,k)&&(TARGET_VECTOR_ARITY[k]===-1?args.length>0:args.length===TARGET_VECTOR_ARITY[k])))throw Error('Unsupported Target function: '+a);return ['f',k,args];}if(!known.has(k))throw Error('Unknown Target variable: '+a);deps.add(k);return ['v',k];}
 function power(){const a=atom();if(t[i]==='^'){i++;return ['^',a,unary()];}return a;}
 function unary(){if(t[i]==='+'||t[i]==='-'){const op=t[i++];return op==='+'?unary():['neg',unary()];}return power();}
 function product(){let a=unary();while(t[i]==='*'||t[i]==='/'){const op=t[i++];a=[op,a,unary()];}return a;}
 function sum(){let a=product();while(t[i]==='+'||t[i]==='-'){const op=t[i++];a=[op,a,product()];}return a;}
 const ast=sum();if(i!==t.length)throw Error('Unexpected Target token');return ast;
}
function targetValue(ast,env,polarity){
 const [op,a,b]=ast;if(op==='n')return a;if(op==='v')return env[a];if(op==='neg')return -targetValue(a,env,polarity);
 if(op==='f'){const fn={abs:Math.abs,sqrt:x=>Math.sqrt(Math.abs(x)),ln:Math.log,lg:Math.log10,sin:Math.sin,cos:Math.cos,tan:Math.tan,asin:Math.asin,acos:Math.acos,atan:Math.atan,sinh:Math.sinh,cosh:Math.cosh,tanh:Math.tanh,sgn:Math.sign,pow:Math.pow,mod:(x,y)=>x%y,pi:()=>Math.PI,e:()=>Math.E,scale:()=>polarity==='PMOS'?-1:1}[a];return fn(...b.map(x=>targetValue(x,env,polarity)));}
 const x=targetValue(a,env,polarity),y=targetValue(b,env,polarity);return op==='+'?x+y:op==='-'?x-y:op==='*'?x*y:op==='/'?x/y:x**y;
}
function dcTargetColumns(page,dc=page.dc){
 const mapped=dcOutputs(page,dc),roleNames={d:'drain',g:'gate',s:'source',b:'body'},signals=[...mapped,'Time'];
 const raw=Object.fromEntries(signals.map(v=>[v.toLowerCase(),{signal:v,key:v==='Time'?'timeS':roleNames[v[1]]+(v[0]==='I'?'CurrentA':'VoltageV'),unit:v==='Time'?'s':v[0]==='I'?'A':'V'}]));
 const variables=Object.create(null);for(const v of page.variables||[]){const k=String(v.name).toLowerCase();if(Object.hasOwn(raw,k)||Object.hasOwn(variables,k))throw Error('Duplicate Target variable: '+v.name);variables[k]=Number(v.value);}
 const known=new Set([...Object.keys(raw),...Object.keys(variables)]),deps=new Set(),formulas=[];
 const formula=String(dc.target.formula||'').trim();if(formula.length>8192)throw Error('Target formula too long');
 if(formula)for(const line of formula.split(/[;\r\n]+/).map(x=>x.trim()).filter(Boolean)){const match=/^set\s+([A-Za-z][A-Za-z0-9_]*)\s*=\s*(.+)$/i.exec(line);if(!match)throw Error('Target formula requires set name = expression');const k=match[1].toLowerCase();if(known.has(k))throw Error('Duplicate Target assignment: '+match[1]);formulas.push({name:k,ast:targetExpression(match[2],known,deps)});known.add(k);}
 const term=dcTerminals(page,dc).find(t=>dc.terminals[t.logical].role==='X'&&t.resource!=='GNDU');
 const fallbackX=term?(dc.terminals[term.logical].mode==='current'?'I':'V')+term.logical.toLowerCase():'Vd',requested=dc.outputs.trim().split(/[\s,]+/);
 const resolve=(name,fallback)=>{const v=String(name||'').trim()||fallback,parts=v.split(':'),expression=parts.length===2?parts[1].trim():v;if(parts.length>2||parts.length===2&&!parts[0].trim())throw Error('Invalid Target alias');const key=expression.toLowerCase(),direct=raw[key],ast=targetExpression(expression,known,deps);return {...(direct||{key:'derived:'+expression,unit:''}),signal:parts.length===2?parts[0].trim():direct?.signal||expression,ast};};
 const x=resolve(dc.target.x,fallbackX),fallbackY=requested.find(v=>mapped.includes(v)&&v!==x.signal)||mapped.find(v=>v!==x.signal),y=resolve(dc.target.y,fallbackY);
 if(x.key===y.key)invalidField('target.y','X and Y must be distinct signals');
 const h=String(dc.target.h||'').trim()?resolve(dc.target.h,''):null;
 const outer=dcTerminals(page,dc).find(t=>dc.terminals[t.logical].role==='P'&&t.resource!=='GNDU');
 const filterText=String(dc.target.p||'').trim();let pFilter=null;
 if(filterText){if(!outer)invalidField('target.p','P filter requires Psweep');const values=filterText.split(/[,;\s]+/).map(x=>Number(x));if(!values.length||values.some(v=>!Number.isFinite(v))||values.length>4096)invalidField('target.p','P filter requires comma-separated finite source levels');pFilter={key:dc.terminals[outer.logical].mode==='current'?'plannedPCurrentA':'plannedPVoltageV',values:[...new Set(values)]};}
 const inputs=Object.fromEntries([...deps].filter(k=>Object.hasOwn(raw,k)).map(k=>[k,raw[k]]));
 if(!Object.keys(inputs).length)throw Error('Target requires at least one acquired signal');
 const needsVector=[x.ast,y.ast,...(h?[h.ast]:[]),...formulas.map(z=>z.ast)].some(targetUsesVector);
 return {x,y,h,pFilter,needsVector,signals,inputs,rawSignals:Object.values(inputs).map(v=>v.signal),variables,formulas,polarity:dc.polarity};
}
function targetPassesP(target,row){const p=target.pFilter;if(!p)return true;const raw=row[p.key];if(raw==null||raw==='')return false;const value=Number(raw);return Number.isFinite(value)&&p.values.some(z=>Math.abs(value-z)<=Math.max(1e-15,Math.abs(z)*1e-9));}
function evaluateTargetPoint(target,row){
 if(target.needsVector||!targetPassesP(target,row))return null;
 const env=Object.assign(Object.create(null),target.variables||{});for(const [k,c] of Object.entries(target.inputs||{})){const v=row[c.key];env[k]=v==null||v===''?NaN:Number(v);}
 for(const z of target.formulas||[])env[z.name]=targetValue(z.ast,env,target.polarity);
 const x=targetValue(target.x.ast,env,target.polarity),y=targetValue(target.y.ast,env,target.polarity);return Number.isFinite(x)&&Number.isFinite(y)?{x,y}:null;
}
 function targetForAxis(target,axis){if(axis==='target-h'){if(!target.h)throw Error('H expression is empty');return {...target,y:target.h};}return target;}
 function targetExportRows(target,rows){const vectors=target.needsVector?targetVectorRows(target,rows):null;const out=[];for(const [i,row] of rows.entries()){if(!targetPassesP(target,row))continue;const point=vectors?vectors[i]:evaluateTargetPoint(target,row),hp=vectors?(point?{x:point.x,y:point.h}:null):target.h?evaluateTargetPoint(targetForAxis(target,'target-h'),row):null;out.push({sourceRow:row.sequence??i+1,cycle:row.cycle??null,pPoint:row.pPoint??null,plannedPVoltageV:row.plannedPVoltageV??null,plannedPCurrentA:row.plannedPCurrentA??null,computedX:point?.x??hp?.x??null,computedY:point?.y??null,computedH:hp?.y??null,xExpression:target.x.signal,yExpression:target.y.signal,hExpression:target.h?.signal??''});}return out;}
 function dcMethods(role){
  return role==='CONDITION'?['constant','generator']:['step','points','log','list'];
 }
function dcAffine(raw,variables,polarity){
 const input=String(raw??'').trim();
 if(!input||input.length>256)throw Error('Generator expression length must be 1–256');
 const re=/\s*([0-9]+(?:\.[0-9]*)?(?:[eE][+-]?\d+)?|\.[0-9]+(?:[eE][+-]?\d+)?|[A-Za-z][A-Za-z0-9_]*|[()+*/-])/y;
 const tokens=[];for(let p=0;p<input.length;p=re.lastIndex){re.lastIndex=p;const m=re.exec(input);if(!m)throw Error('Invalid Generator expression');tokens.push(m[1]);}
 let i=0;const constant=b=>[0,b],scale=(a,b)=>a.map(v=>v*b);
 function atom(){const t=tokens[i++];if(t==='-'||t==='+')return scale(atom(),t==='-'?-1:1);if(t==='('){const v=sum();if(tokens[i++]!==')')throw Error('Unclosed Generator expression');return v;}
  if(/^(?:[0-9]|\.)/.test(t||''))return constant(Number(t));
  if(tokens[i]==='('&&tokens[i+1]===')'){i+=2;if(t==='getx')return [1,0];if(t==='scale')return constant(polarity==='PMOS'?-1:1);throw Error('Native Generator supports getx() and scale(), not '+t+'()');}
  if(Object.hasOwn(variables,t))return constant(Number(variables[t]));throw Error('Unknown Generator variable '+t);}
 function product(){let a=atom();while(['*','/'].includes(tokens[i])){const op=tokens[i++],b=atom();if(op==='/'){if(b[0]!==0||b[1]===0)throw Error('Native Generator requires a nonzero constant divisor');a=scale(a,1/b[1]);}else{if(a[0]!==0&&b[0]!==0)throw Error('Native Generator must be affine in getx()');a=a[0]===0?scale(b,a[1]):scale(a,b[1]);}}return a;}
 function sum(){let a=product();while(['+','-'].includes(tokens[i])){const op=tokens[i++],b=scale(product(),op==='-'?-1:1);a=[a[0]+b[0],a[1]+b[1]];}return a;}
 const [ratio,offset]=sum();if(i!==tokens.length||!Number.isFinite(ratio)||!Number.isFinite(offset))throw Error('Invalid Generator expression');if(Math.abs(ratio)>10||Math.abs(offset)>210)throw Error('Native Generator ratio/offset exceed RT/FS limits');return {ratio,offset};
}
 function generatorEvaluator(raw,variables,polarity,outer){const env=Object.assign(Object.create(null),Object.fromEntries(Object.entries(variables).map(([k,v])=>[k.toLowerCase(),Number(v)])));const ast=targetExpression(raw,new Set(Object.keys(env)),new Set(),{generator:true,outer});return (x,p)=>{const value=targetValue(ast,{...env,getx:x,getp:p},polarity);if(!Number.isFinite(value))throw Error('Generator output is not finite');return value;};}
function dcExpression(raw,variables,polarity,{generator=false,outer=false}={}){
  if(generator){generatorEvaluator(raw,variables,polarity,outer);return NaN;}
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
   if(dc.strategy.integrationPreset===undefined)dc.strategy.integrationPreset=dc.strategy.integration?.trim()?'legacy':'normal';
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
     !['fast','normal','quiet','legacy'].includes(dc.strategy.integrationPreset??(dc.strategy.integration?.trim()?'legacy':'normal'))||!text(dc.strategy.integration)||!text(dc.strategy.delay)||!text(dc.strategy.hold)||
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
  if(dc.strategy.hold.trim()){
   const hold=atField('hold',()=>numeric(dc.strategy.hold,'Hold time'));
   if(hold<0||hold>655.3)invalidField('hold','Hold time must be between 0 and 655.3 s');
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

 const initial=()=>({schema:1,sequence:ROUTINE_DEFAULTS.length,activeId:'page-1',smuIntegration:'medium',
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
  state.smuIntegration??='medium';
  if(!['short','medium','long'].includes(state.smuIntegration))throw Error('Select a global SMU integration preset');
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
   if(p.ivAlternate!==undefined){
    if(p.kind==='dc'){
     p.ivAlternate=timingSettings('pulse',p.ivAlternate);
     timedSummary('pulse',p.ivAlternate);
    }else if(p.kind==='pulse'){
     if(p.ivAlternate&&typeof p.ivAlternate==='object')migrateDcPreset(p.ivAlternate);
     validateDcShape(p.ivAlternate);
     if(p.ivAlternate.specIds.some(id=>specOwners.get(id)!==routineOwners.get(p.routineId)))
      throw Error('DC Spec must belong to the same Device');
    }else delete p.ivAlternate;
   }
   if(p.kind==='dc'){
    if(p.dc===undefined)p.dc=defaultDc(p);
    else if(p.dc&&typeof p.dc==='object')migrateDcPreset(p.dc);
    validateDcShape(p.dc);
    if(p.dc.specIds.some(id=>specOwners.get(id)!==routineOwners.get(p.routineId)))
     throw Error('DC Spec must belong to the same Device');
   }
   if(p.kind==='arb'){
    p.kind='pulse';
    p.timing={...p.timing,testMode:p.timing?.testMode??(p.timing?.arb?'sequence':'bias-steps'),
     biasSteps:p.timing?.biasSteps??defaultBiasSteps()};
   }
   if(p.kind==='pulse'&&p.timing?.testMode==='bias-steps'){
    p.kind='time';
    p.testType='IVT';
    p.timing={mode:TIME_PMU_MODE,pmu:p.timing};
   }
   if(TIMED_DEFAULTS[p.kind]){
    p.timing=timingSettings(p.kind,p.timing);
    // Older projects may contain a finite but oversized linear sampling grid.
    // Let them reopen for repair. A changed plan still has to pass the current limit.
    timedSummary(p.kind,p.timing,{allowLegacySampleGrid:true});
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
 function templateSnapshot(state,kind,id){
  const s=validate(state);
  if(kind==='test'){
   const page=s.pages.find(row=>row.id===id);
   if(!page)throw Error('测试已不存在');
   return {kind,name:page.name,pages:[templatePage(page)]};
  }
  const routine=s.routines.find(row=>row.id===id);
  const pages=s.pages.filter(row=>row.routineId===id);
  if(kind!=='routine'||!routine||!pages.length)throw Error('流程需要至少一个测试');
  return {kind,name:routine.name,loops:routine.loops,pages:pages.map(templatePage)};
 }
 function templatePage(page){
  const {kind,name,testType,note,terminals,sweep,dc,timing,ivAlternate,target,targets,variables}=clone(page);
  const dcConfig=dc||(kind==='pulse'?ivAlternate:null);
  if(dcConfig){dcConfig.specIds=[];dcConfig.bodyResource='None';}
  return {kind,name,testType,note,terminals,sweep,dc,timing,ivAlternate,target,targets,variables};
 }
 function numberedCopy(name,n){
  const suffix=' ('+n+')';
  return name.slice(0,64-suffix.length)+suffix;
 }
 function insertSetup(state,setup,{after=null,count='1',copy=false}={}){
  const s=validate(state),n=positiveInt(count,128,'复制次数');
  const routineMode=setup?.kind==='routine';
  if(!['test','routine'].includes(setup?.kind)||!Array.isArray(setup.pages)||!setup.pages.length||
     !routineMode&&setup.pages.length!==1)throw Error('测试模板无效');
  if(s.pages.length+n*setup.pages.length>128||routineMode&&s.routines.length+n>100)
   throw Error('超过工程容量：最多 128 个测试、100 个流程');
  const existingRoutine=[...s.routines].find(row=>row.id===(routineMode?after:s.activeRoutineId));
  const sourcePage=!routineMode&&after?s.pages.find(row=>row.id===after):null;
  if(after&&(routineMode?!existingRoutine:!sourcePage))throw Error('复制来源已不存在');
  const deviceId=existingRoutine?.deviceId||s.activeDeviceId;
  const routineId=sourcePage?.routineId||s.activeRoutineId;
  let pageIndex=sourcePage?s.pages.indexOf(sourcePage)+1:s.pages.length;
  if(routineMode&&after){
   const last=s.pages.findLastIndex(row=>row.routineId===after);
   if(last>=0)pageIndex=last+1;
  }
  if(!routineMode&&!sourcePage)pageIndex=s.pages.findLastIndex(row=>row.routineId===routineId)+1;
  const newPages=[],newRoutines=[];
  const usedRows=routineMode?s.routines.filter(row=>row.deviceId===deviceId):s.pages.filter(row=>row.routineId===routineId);
  const names=new Set(usedRows.map(row=>row.name)),usedIds=new Set(s.routines.map(row=>row.id));
  for(let i=0;i<n;i++){
   let name=setup.name;
   for(let j=2;names.has(name)||(copy&&j===2);j++)name=numberedCopy(setup.name,j);
   names.add(name);
   let target=routineId;
   if(routineMode){
    let next=s.routines.length+newRoutines.length+1;
    while(usedIds.has('routine-'+next))next++;
    target='routine-'+next;
    usedIds.add(target);
    newRoutines.push({id:target,deviceId,name,loops:setup.loops});
   }
   for(const original of setup.pages){
    const page=copy?clone(original):templatePage(original);
    const {kind,testType,note,terminals,sweep,dc,timing,ivAlternate,target:measurementTarget,targets,variables,associateSpecId}=page;
    const pageId='page-'+(++s.sequence);
    newPages.push({id:pageId,routineId:target,name:routineMode?page.name:name,kind,testType,note,terminals,sweep,dc,timing,ivAlternate,
     target:measurementTarget,targets,variables,associateSpecId:copy?associateSpecId:null});
   }
  }
  const afterRoutineIndex=after?s.routines.indexOf(existingRoutine)+1:s.routines.length;
  s.routines.splice(afterRoutineIndex,0,...newRoutines);
  s.pages.splice(pageIndex,0,...newPages);
  s.activeId=newPages[0].id;
  return validate(s);
 }
 function duplicateSetup(state,kind,id,count){
  const s=validate(state);
  const setup=templateSnapshot(s,kind,id);
  setup.pages=s.pages.filter(row=>kind==='test'?row.id===id:row.routineId===id);
  return insertSetup(s,setup,{after:id,count,copy:true});
 }
 function reorderTests(state,routineId,order){
  const s=validate(state);
  const pages=new Map(s.pages.filter(row=>row.routineId===routineId).map(row=>[row.id,row]));
  if(!Array.isArray(order)||order.length!==pages.size||new Set(order).size!==order.length||order.some(id=>!pages.has(id)))
   throw Error('流程测试已变化，请重新打开设置');
  let index=0;
  s.pages=s.pages.map(row=>row.routineId===routineId?pages.get(order[index++]):row);
  return s;
 }
 function editSmuIntegration(s,preset){
  return validate({...s,smuIntegration:preset});
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
    delete page.ivAlternate;
   }
   page.kind=kind.id;page.testType=kind.testType;
   if(patch.name===undefined)page.name=kind.label;
   delete patch.kind;
  }
  Object.assign(page,patch);
  return validate(s);
 }
 function setIvType(s,value){
  s=validate(s);
  const page=s.pages.find(p=>p.id===s.activeId);
  const pulseMode={pulse:'sweep','pulse-smu':'smu-sweep'}[value];
  if(!['dc','pulse'].includes(page.kind)||(!DC_PRESETS.includes(value)&&!pulseMode))
   throw Error('Unknown I–V test type');
  const kind=pulseMode?'pulse':'dc';
  if(page.kind!==kind){
   const previous=KINDS.find(row=>row.id===page.kind),next=KINDS.find(row=>row.id===kind);
   if(page.name===previous.label||(page.kind==='pulse'&&page.name==='脉冲扫描'))page.name=next.label;
   const alternate=page.ivAlternate;
   page.ivAlternate=kind==='pulse'?page.dc:page.timing;
   if(kind==='pulse'){
    page.timing={...alternate,testMode:pulseMode};
    delete page.dc;
   }else{
    page.dc=alternate||defaultDc(page);
    delete page.timing;
   }
   page.kind=kind;
   page.testType=next.testType;
  }
  if(kind==='dc')page.dc.preset=value;
  else page.timing.testMode=pulseMode;
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
  if(p.kind==='time')timedSummary(p.kind,p.timing);
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
 function curvesFromArtifacts(refs,store,{maxRead=65536,maxDisplay=8192,axis='iv',target=null}={}){
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
    vt:['times','time','elapsedseconds','seconds','t'],target:[]
   };
   if(!Object.prototype.hasOwnProperty.call(xkeys,axis))throw Error('Unknown graph axis');
   const pulse=cols.some(c=>norm(c)==='pulsevoltagev')&&cols.some(c=>norm(c)==='pulsecurrenta');
   if(pulse&&axis==='transfer')continue;
   const targetCols=axis==='target'&&target?Object.fromEntries([...new Set([...Object.values(target.inputs).map(v=>v.key),...(target.pFilter?[target.pFilter.key]:[])])].map(key=>[key,cols.find(c=>norm(c)===key.toLowerCase())])):null;
   if(axis==='target'&&(!targetCols||Object.values(targetCols).some(c=>!c)))continue;
   const x=axis==='target'?Object.values(targetCols)[0]:pulse?choose(axis==='iv'?['pulsevoltagev']:xkeys[axis],'x',false):choose(xkeys[axis],'x',axis==='iv');
   const y=axis==='target'?x:pulse?choose(axis==='vt'?['pulsevoltagev']:['pulsecurrenta'],'y',false):axis==='vt'?choose(['drainvoltagev','measuredvoltagev','measuredvoltage','voltagev','voltage','vd'],'y',false):
    choose(['draincurrenta','id','current','ids','i','draincurrent','y'],'y',axis!=='it');
      if(!x||!y||(axis!=='target'&&x===y))continue;
   const total=Math.min(...(targetCols?Object.values(targetCols):[x,y]).map(c=>Number(c.length)||0));
   const groupCols=Object.fromEntries((target?.needsVector?[...TARGET_GROUP_KEYS,'sequence']:['cycle','pPoint','pRepeat','xRepeat']).map(k=>[k,cols.find(c=>norm(c)===k.toLowerCase()&&Number(c.length)>=total)]).filter(([,c])=>c));
   if(!Number.isSafeInteger(total)||total<=0)continue;
   // Span the entire raw table, not just the first 65536 rows. All accesses
   // use the DKDS Data Center bounded column-read interface; no artifacts.get().
   const vectorMode=axis==='target'&&target?.needsVector===true;
   if(vectorMode&&(total>250000||Object.values(targetCols).some(c=>Number(c.length)!==total)))continue;
   const limit=vectorMode?total:Math.min(budget,total);
   const windows=vectorMode?Math.ceil(total/4096):total<=limit?1:Math.min(32,Math.max(2,Math.ceil(total/limit)));
   const baseSize=Math.floor(limit/windows),extra=limit%windows;
   const spans=[];
   let cursor=0;
   for(let i=0;i<windows;i++){
    const size=baseSize+(i<extra?1:0);
    if(!size)continue;
    const ideal=windows===1?0:Math.round(i*(total-size)/(windows-1));
    const start=vectorMode?cursor:Math.max(cursor,Math.min(total-size,ideal));
    spans.push({start,limit:size});
    cursor=start+size;
   }
   const sampled=[],vectorRows=[];
   let readRows=0,vectorReadFailed=false;
   for(const span of spans){
    const read=c=>store.readColumnRange(id,c.id||c.key,span)?.values;
    const isColumn=v=>Array.isArray(v)||ArrayBuffer.isView(v);
    const columns=targetCols?Object.fromEntries(Object.entries(targetCols).map(([k,c])=>[k,read(c)])):{x:read(x),y:read(y)};
    const values=Object.values(columns);if(values.some(v=>!isColumn(v)))continue;
    const groups=Object.fromEntries(Object.entries(groupCols).map(([k,c])=>[k,read(c)]).filter(([,v])=>isColumn(v)&&v.length>=Math.min(span.limit,...values.map(x=>x.length))));
    const count=Math.min(span.limit,...values.map(v=>v.length));readRows+=count;
    if(vectorMode){if(count!==span.limit||Object.keys(groups).length!==Object.keys(groupCols).length){vectorReadFailed=true;break;}for(let j=0;j<count;j++)vectorRows.push(Object.fromEntries([...Object.entries(columns),...Object.entries(groups)].map(([k,v])=>[k,v[j]])));continue;}
    for(let j=0;j<count;j++){
     let point;if(targetCols){point=evaluateTargetPoint(target,Object.fromEntries(Object.entries(columns).map(([k,v])=>[k,v[j]])));}else{
      const vx=columns.x[j],vy=columns.y[j];if(vx==null||vy==null||vx===''||vy==='')continue;point={x:Number(vx),y:Number(vy)};
     }
     if(point&&Number.isFinite(point.x)&&Number.isFinite(point.y)){
      const group=Object.entries(groups).filter(([,v])=>v[j]!=null&&v[j]!==''&&Number.isFinite(Number(v[j]))).map(([k,v])=>k+'='+v[j]).join(' / ');
      sampled.push({index:span.start+j,point,group});
     }
    }
   }
   if(vectorMode&&!vectorReadFailed&&readRows===total&&vectorRows.length===total){
    let result;try{result=targetVectorRows(target,vectorRows);}catch{continue;}
    let segment=0,previous='';for(let i=0;i<result.length;i++){const p=result[i],row=vectorRows[i];const key=JSON.stringify(TARGET_GROUP_KEYS.map(k=>row[k]??null));if(key!==previous||i>0&&row.sequence!=null&&vectorRows[i-1].sequence!=null&&Number(row.sequence)!==Number(vectorRows[i-1].sequence)+1){segment++;previous=key;}if(!p||!Number.isFinite(p.x)||!Number.isFinite(p.y)){segment++;continue;}sampled.push({index:i,point:{x:p.x,y:p.y},group:TARGET_GROUP_KEYS.filter(k=>row[k]!=null&&row[k]!=='').map(k=>k+'='+row[k]).join(' / ')+' #'+segment});}
   }
   if(!sampled.length)continue;
   const partitions=new Map();for(const item of sampled){if(!partitions.has(item.group))partitions.set(item.group,[]);partitions.get(item.group).push(item);}
   for(const [group,series] of partitions){
   const chosen=[],seen=new Set();
   function keep(entry){
    if(entry&&!seen.has(entry.index)){seen.add(entry.index);chosen.push(entry);}
   }
   // Chronological min/max decimation retains local extrema of the rows
   // actually inspected. Unsampled gaps are NEVER represented as full coverage.
   keep(series[0]);
   const groups=Math.max(1,Math.floor((Math.max(4,Math.floor(display/partitions.size))-2)/2));
   const groupStep=Math.max(1,Math.ceil(series.length/groups));
   for(let start=0;start<series.length;start+=groupStep){
    const block=series.slice(start,start+groupStep);
    let lo=block[0],hi=block[0];
    for(const point of block){
     if(point.point.y<lo.point.y)lo=point;
     if(point.point.y>hi.point.y)hi=point;
    }
    for(const entry of [lo,hi].sort((a,b)=>a.index-b.index))keep(entry);
   }
   keep(series[series.length-1]);
   chosen.sort((a,b)=>a.index-b.index);
   const partial=readRows<total;
   out.push({id:partitions.size>1?id+':'+group:id,artifactId:id,label:String(ref.name||id)+(partitions.size>1?' · '+group:'')+
     (partial?' (preview '+readRows+'/'+total+')':''),
    points:chosen.map(x=>x.point),...(axis==='target'?{target:{x:target.x,y:target.y}}:{}),
    source:{artifactId:id,kind:'dkds-artifact-bounded-preview',
     totalRows:total,readRows,displayRows:chosen.length,truncated:partial,
     coverage:partial?'stratified-intervals':'all-rows',
     windows:spans.map(x=>({start:x.start,rows:x.limit}))}});
   }
  }
  return out;
 }
 const api=Object.freeze({KINDS,PLOT_KINDS,DC_PRESETS,DC_METHODS,dcMethods,dcTerminals,dcOutputs,dcTargetColumns,evaluateTargetPoint,targetForAxis,targetExportRows,targetVectorRows,dcSummary,dcExpression,dcAffine,generatorEvaluator,setIvType,editDc,editDcBody,removeDcSpec,initial,validate,add,editSmuIntegration,addDevice,selectDevice,addRoutine,selectRoutine,setRoutineLoops,addSpec,associateSpec,remove,select,editPage,editDevice,editTiming,timedSummary,smuPulseSummary,SMU_PULSE_DEFAULTS,TIME_PMU_MODE,defaultPmuTimeSettings,templateSnapshot,insertSetup,duplicateSetup,reorderTests,pulseSecondarySettings,timeGrid,timePreviewGrid,timeGroundNodes,timeReference,SMU_INTEGRATION_PLC,editTarget,addTarget,removeTarget,addVariable,editVariable,removeVariable,edit,editSweep,editSegment,addSegment,removeSegment,summary,pointAt,visible:p=>p.terminals.filter(t=>!['None','GNDU'].includes(t.resource)),curvesFromArtifacts});
 window.DKDSPluginModules.define('com.dkts.keithley-4200','model',api,{replace:true});
})();
