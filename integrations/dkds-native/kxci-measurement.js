(() => {
  'use strict';
  // KXCI Rev. E, section 5: US / DV / TI / RG / RI. Commands are sent as
  // NUL-terminated ASCII. User mode executes each point on the instrument;
  // values returned by TI, not planned voltages, constitute measured data.
  const ROLES=Object.freeze(['source','drain','gate']);
  function integer(v,label,min,max){
    const n=Number(v);
    if(!Number.isSafeInteger(n)||n<min||n>max)throw Error(label+' 无效');
    return n;
  }
  function number(v,label){
    const n=Number(v);
    if(!Number.isFinite(n))throw Error(label+' 不是有限数值');
    return n;
  }
  function numeric(v){
    const n=number(v,'KXCI 数值');
    return systemNumber(n);
  }
  function channelNumber(name){
    const m=/^SMU([1-9])$/.exec(String(name||''));
    return m?Number(m[1]):null;
  }
  function eachAxisPoint(axis,callback){
    let position=0;
    for(let s=0;s<axis.segments.length;s++){
      const seg=axis.segments[s];
      for(let i=0;i<seg.points;i++){
        const voltage=i===seg.points-1?seg.stopV:seg.startV+i*seg.stepV;
        callback(Object.freeze({voltageV:voltage,rangeA:seg.rangeA,
          delayMs:seg.delayMs??axis.delayMs,segmentIndex:s+1,position:position++}));
      }
    }
  }
  function pointOnAxis(axis,index){
    let offset=index;
    for(let segmentIndex=0;segmentIndex<axis.segments.length;segmentIndex++){
      const segment=axis.segments[segmentIndex];
      if(offset<segment.points)return Object.freeze({
        voltageV:offset===segment.points-1?segment.stopV:
          segment.startV+offset*segment.stepV,
        rangeA:segment.rangeA,delayMs:segment.delayMs??axis.delayMs,
        segmentIndex:segmentIndex+1,position:index
      });
      offset-=segment.points;
    }
    throw new RangeError('KXCI sweep point index outside axis');
  }
  function* points(plan){
    // Keep the nested scan lazy. A valid program may contain many segments,
    // repeats and outer loops; prebuilding complete X/P point arrays needlessly
    // allocates the whole run before the first instrument command.
    const x=plan.xSweep,p=plan.pSweep;
    const pCount=p?p.points:1;
    for(let cycle=1;cycle<=plan.loops;cycle++){
      for(let pRepeat=1;pRepeat<=(p?.repeats||1);pRepeat++){
        for(let pi=0;pi<pCount;pi++){
          const pp=p?pointOnAxis(p,pi):null;
          for(let xRepeat=1;xRepeat<=x.repeats;xRepeat++){
            for(let xi=0;xi<x.points;xi++){
              const xp=pointOnAxis(x,xi),voltages={...plan.fixedVoltages,
                [x.terminal]:xp.voltageV};
              if(pp)voltages[p.terminal]=pp.voltageV;
              yield {cycle,pRepeat,pPoint:pi+1,xRepeat,xPoint:xi+1,
                xSegment:xp.segmentIndex,pSegment:pp?.segmentIndex||null,
                xVoltageV:xp.voltageV,pVoltageV:pp?.voltageV??null,
                voltages,rangeX:xp.rangeA,rangeP:pp?.rangeA||'auto',
                delayMs:xp.delayMs,pDelayMs:pp?.delayMs??0,
                changedP:xi===0&&xRepeat===1};
            }
          }
        }
      }
    }
  }
function systemNumber(value){
 const n=Number(value);if(!Number.isFinite(n))throw Error('KXCI number is not finite');
 if(n===0)return '0';
 const candidates=[String(n),...Array.from({length:12},(_,i)=>n.toExponential(11-i))].map(v=>v.replace(/e/i,'E').replace(/E\+/,'E+').replace(/(\.\d*?[1-9])0+(?=E)/,'$1').replace(/\.0+(?=E)/,''));
 const result=candidates.find(v=>v.length<=12&&Math.abs(Number(v)-n)<=Math.abs(n)*1e-7);
 if(!result)throw Error('KXCI 12-character numeric format cannot represent '+n);
 return result;
}
function compileSystemPlan(compiled,input,inventory){
 const {plan,channels,active}=compiled,timing=input.timeProgram||null;
 const assert=(v,m)=>{if(!v)throw Error(m);};
 const fmt=systemNumber,setup=['EM 1,0','BC','DE'];
 // Startup defaults can activate unselected channels (Rev F 5-7).
 // Use KCon logical assignments, not chassis slot indices.
 const installed=inventory?.slots||[];
 assert(installed.length>0,'System Mode 需要实际 KCon 模块清单');
 const disable=[...new Set(installed.filter(s=>['SMU','VS','VM'].includes(s.family)&&Number.isInteger(s.channel)&&s.channel>=1&&s.channel<=9)
 .map(s=>(s.family==='SMU'?'CH':s.family)+s.channel))];
 assert(active.every(r=>disable.includes('CH'+channels[r])),'活动通道未在实际模块中确认');
 setup.push(...disable);
 const x=plan.xSweep,p=plan.pSweep,generators=plan.generators||{};
 assert(x.repeats===1||timing,'System Mode 暂不支持 Xsweep 重复嵌套，请用整体 Cycles');
 assert(!p||p.repeats===1,'System Mode 暂不支持 Psweep 重复嵌套');
 const current=r=>plan.sourceModes?.[r]==='current';
 const levels=(axis,s)=>current(axis.terminal)?[s.startA,s.stopA,s.stepA]:[s.startV,s.stopV,s.stepV];
 const axisValues=axis=>axis.segments.flatMap(s=>{const [a,b,c]=levels(axis,s);return Array.from({length:s.points},(_,i)=>i===s.points-1?b:a+i*c);});
 const compliance=r=>current(r)?plan.portSettings[r].complianceV:plan.portSettings[r].complianceA;
 const axisCount=axis=>axis.segments.reduce((sum,s)=>sum+s.points,0);
 const count=timing?timing.count:axisCount(x)*(p?axisCount(p):1);
 assert(Number.isInteger(count)&&count>=1&&count<=4096,'Rev F ME/NR：单次仪器任务最多 4096 个采样点');
 assert(plan.loops>=1&&Number.isSafeInteger(plan.loops),'循环数无效');
 assert(axisCount(x)<=4096&&(!p||axisCount(p)<=32),'原生单次任务轴长度超过手册限制');
 const xValues=axisValues(x),pValues=p?axisValues(p):[];
 for(const r of active){
  const setting=plan.portSettings[r],axis=x.terminal===r?x:p?.terminal===r?p:null;
  assert(setting.rangeMode!=='fixed'&&(!axis||axis.segments.every(s=>s.rangeA==='auto')),'System Mode 的 RI 不能保证整个 sweep 固定档位；请使用 Auto / 最低自动量程');
  setup.push("CH"+channels[r]+",'V"+channels[r]+"','I"+channels[r]+"',"+(current(r)?2:1)+","+(timing?3:r===x.terminal?1:r===p?.terminal?2:generators[r]?4:3));
 }
 const rpmRoutes=input.rpmRoutes||[];
 for(const route of rpmRoutes){
  assert(/^PMU[1-9]-[12]$/.test(route.pmu)&&/^SMU[1-8]$/.test(route.smu)&&Number.isInteger(route.pulseChannel)&&route.pulseChannel>=1&&route.pulseChannel<=8,'RPM 路由无效');
  assert(active.some(r=>'SMU'+channels[r]===route.smu),'RPM 目标 SMU 不在任务中');
  const m=/^PMU([1-9])-([12])$/.exec(route.pmu);
  assert(installed.some(s=>s.family==='PMU'&&s.channel===Number(m[1])&&s.rpmChannels?.includes(Number(m[2]))&&s.physicalIdentityVerified===true),'RPM 未由模块识别确认');
  assert(route.pulseChannel===2*(Number(m[1])-1)+Number(m[2]),'脉冲通道编号不一致');
 }
 setup.push('SS');
 if(rpmRoutes.length){
  setup.push('ZE');
  for(const route of rpmRoutes)setup.push(':PMU:OUTPUT:STATE '+route.pulseChannel+',0','RP '+route.pmu+', 2');
 }
 for(const r of active){
  const ch=channels[r],setting=plan.portSettings[r],limit=compliance(r);
  if(generators[r]){
   const g=generators[r];assert(!timing,'Generator 不用于固定偏置');setup.push('RT '+fmt(g.ratio)+','+ch,'FS '+fmt(g.offset)+','+ch,'CM '+fmt(limit)+','+ch);
  }else if(timing||r!==x.terminal&&r!==p?.terminal){
   setup.push((current(r)?'IC':'VC')+ch+','+fmt(current(r)?plan.fixedCurrents[r]:plan.fixedVoltages[r])+','+fmt(limit));
  }
  setup.push('ST '+ch+',1');
 }
 if(timing){
  assert(!p&&xValues.length===1,'固定偏置时间测试不能包含电压扫描');
  assert(timing.startS>=0&&timing.startS<=100,'WT 允许 0–100 s');
  assert(timing.intervalS>=0&&timing.intervalS<=10,'IN 允许 0–10 s 的读数后等待');
  assert(plan.loops===timing.cycles&&count===x.repeats,'采样计数与循环不一致');
 }else{
  const delays=new Set(x.segments.map(s=>s.delayMs??x.delayMs));
  assert(delays.size===1,'单次原生扫描要求各段使用同一个 DT');
  const delay=[...delays][0]/1000;
  assert(delay>=0&&delay<=6.553,'DT 范围 0–6.553 s');
  setup.push('DT '+fmt(delay),'HT '+fmt(input.systemHoldS||0));
  const seg=x.segments[0],linear=x.segments.length===1&&seg.points>=2&&seg.points<=1024&&Math.abs(levels(x,seg)[2])<=(current(x.terminal)?1.05:210)&&
    (current(x.terminal)||levels(x,seg).every(v=>v===0||Math.abs(v)>=0.001));
  assert(!Object.keys(generators).length||linear,'原生 Generator 当前核验线性 VAR1；列表或非线性需要另行验收');
  if(linear)setup.push((current(x.terminal)?'IR1,':'VR1,')+[...levels(x,seg),compliance(x.terminal)].map(fmt).join(','));
  else{
   assert(!p,'当前仅核验了单轴 VL 与线性 VAR1/VAR2；非线性嵌套需要独立核验');
   setup.push((current(x.terminal)?'IL':'VL')+channels[x.terminal]+',1,'+fmt(compliance(x.terminal))+','+xValues.map(fmt).join(','));
  }
  if(p){
   assert(p.segments.length===1&&pValues.length<=32,'VAR2 单次最多 32 个线性步进');
   const s=p.segments[0];
   const [start,stop,step]=levels(p,s);
   assert(current(p.terminal)||[start,step].every(v=>v===0||Math.abs(v)>=0.001),'VP 小于 1 mV 的非零值可能被仪器归零');
   assert(Math.abs(step)<=(current(p.terminal)?1.05:210),'外层扫描步长超出原厂指令范围');
   assert((s.delayMs??p.delayMs)===0,'VAR2 独立延迟未映射到原生扫描');
   setup.push((current(p.terminal)?'IP ':'VP ')+[start,step,s.points,compliance(p.terminal)].map(fmt).join(','));
  }
 }
 // Keep automatic range flooring explicit instead of inheriting earlier tasks.
 for(const r of active){
  const setting=plan.portSettings[r],slot=installed.find(s=>s.family==='SMU'&&s.channel===channels[r]);
  if(current(r))continue; // RG sets current measurement floor, not voltage range.
  const floor=setting.rangeMode==='limited-auto'?Number(setting.rangeA):slot?.preamplifier?1e-9:1e-7;
  setup.push('RG '+channels[r]+','+fmt(floor));
 }
 const integration=timing?.integration||input.systemIntegration||'IT2';
 assert(['IT1','IT2','IT3'].includes(integration),'测量速度无效');
 setup.push('EC 1',integration,'RS 7','SM','DM2');
 if(timing)setup.push('WT '+fmt(timing.startS),'IN '+fmt(timing.intervalS),'NR '+count);
 const signals=active.flatMap(r=>[{name:'V'+channels[r],role:r,quantity:'V'},{name:'I'+channels[r],role:r,quantity:'I'}]);
 assert(signals.length<=6,'LI 最多 6 项测量函数');
 setup.push('LI '+signals.map(s=>"'"+s.name+"'").join(','),'MD');
 const timestamp='V'+channels.drain+'T';
 const reads=[...signals.map(s=>"DO '"+s.name+"'"),"DO '"+timestamp+"'"];
 const cleanup=['MD','ME4','DE',...active.map(r=>'CH'+channels[r]),...(rpmRoutes.length?['SS','ZE',...rpmRoutes.map(r=>'RP '+r.pmu+', 0')]:[])];
 // Only these exact validated setup/read/stop strings may pass the internal
 // transport lease. RD indices are separately bounded by count.
 return Object.freeze({setup:Object.freeze(setup),reads:Object.freeze(reads),signals:Object.freeze(signals),timestamp,cleanup:Object.freeze(cleanup),count,cycles:plan.loops,xValues,pValues,active,channels,rpmRoutes:Object.freeze(rpmRoutes.slice()),xRole:x.terminal,pRole:p?.terminal||null,xMode:current(x.terminal)?'current':'voltage',pMode:p?(current(p.terminal)?'current':'voltage'):null,requestedOutputs:input.requestedOutputs||['Id'],timing,rdNames:Object.freeze([...signals.map(s=>s.name),'CH'+channels.drain+'T'])});
}
function parseSystemValues(raw){
 const text=String(raw??'').trim().replace(/,\s*$/,'');
 if(!text||/^UNAVAILABLE$/i.test(text)||/^ACK$/i.test(text))throw Error('KXCI data unavailable: '+text);
 return text.split(',').map(token=>{
  const literal=token.trim(),match=/^([NC])?\s*([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:E[+-]?\d+)?)$/i.exec(literal);
  if(!match)throw Error('Invalid KXCI reading: '+literal);
  const value=Number(match[2]);if(!Number.isFinite(value)||Math.abs(value)>=9e37)throw Error('Invalid/missing KXCI reading: '+literal);
  return {value,status:match[1]?.toUpperCase()||'unknown',literal};
 });
}
function acquiredColumnPrefix(program,columns){
 const lists=Object.values(columns),length=lists[0]?.length||0;
 if(!length||lists.some(v=>v.length!==length)||length>program.count||!columns[program.timestamp])throw Error('KXCI 原始列长度不一致或超过计划点数');
 const time=columns[program.timestamp];let cutoff=length;
 for(let i=1;i<length;i++){
  if(time[i].value===0){cutoff=i;break;}
 }
 if(time.slice(cutoff).some(v=>v.value!==0))throw Error('KXCI 时间戳中间存在未采集点');
 if(length>1&&cutoff===1&&time[0].value===0){
  const confirmed=program.signals.some(s=>['N','C'].includes(columns[s.name]?.[0]?.status)||columns[s.name]?.[0]?.value!==0);
  if(!confirmed)throw Error('所有时间戳均为零，无法确认已采集记录');
 }
 return Object.fromEntries(Object.entries(columns).map(([name,values])=>[name,values.slice(0,cutoff)]));
}
function systemRows(program,columns,cycle,offset,startIndex=0){
 const lengths=Object.values(columns).map(v=>v.length);
 if(!lengths.length||!lengths[0]||lengths.some(v=>v!==lengths[0])||lengths[0]>program.count)throw Error('KXCI 原始列长度不一致或超过计划点数');
 const rows=[];
 for(let i=0;i<lengths[0];i++){
  const t=columns[program.timestamp][i],row={sequence:offset+i+1,cycle,timeS:t.value,measurementCompleteness:'complete',source:'4200A-KXCI-DO',rawKxciResponses:{timestamp:t.literal},measurementStatusByRole:{},measurementOrder:program.signals.map(s=>s.name),complianceRole:null,measurementStatus:'unknown',point:program.timing?startIndex+i+1:(startIndex+i)%program.xValues.length+1,pPoint:program.pRole?Math.floor((startIndex+i)/program.xValues.length)+1:1};
  if(t.value<0||(i&&t.value<columns[program.timestamp][i-1].value))throw Error('仪器时间戳不单调');
  for(const s of program.signals){
   const v=columns[s.name][i];
   row[s.role+(s.quantity==='V'?'VoltageV':'CurrentA')]=v.value;
   row.rawKxciResponses[s.name]=v.literal;
   const before=row.measurementStatusByRole[s.role];
   row.measurementStatusByRole[s.role]=before==='C'||v.status==='C'?'C':before==='N'&&v.status==='N'?'N':before? 'unknown':v.status;
   if(v.status==='C')row.complianceRole=s.role;
  }
  row.measurementStatus=row.complianceRole?'C':Object.values(row.measurementStatusByRole).every(s=>s==='N')?'N':'unknown';
  row.rawKxciResponse=row.rawKxciResponses['I'+program.channels.drain];
  row.voltageV=row.drainVoltageV;row.currentA=row.drainCurrentA;
  row.xVoltageV=row[program.xRole+'VoltageV'];row.pVoltageV=program.pRole?row[program.pRole+'VoltageV']:null;
  const xv=program.xValues[program.timing?0:(startIndex+i)%program.xValues.length],pv=program.pRole?program.pValues[row.pPoint-1]:null;
  row.plannedXVoltageV=program.xMode==='current'?null:xv;
  row.plannedPVoltageV=program.pMode==='current'?null:pv;
  row.plannedXCurrentA=program.xMode==='current'?xv:null;
  row.plannedPCurrentA=program.pMode==='current'?pv:null;
  row.xCurrentA=row[program.xRole+'CurrentA'];row.pCurrentA=program.pRole?row[program.pRole+'CurrentA']:null;
  rows.push(Object.freeze(row));
 }
 return rows;
}
async function executeSystemTask(program,io){
 const {command,wait,cancelled,onBatch,onPreview}=io;
 const poll=async()=>{
  const raw=String(await command('SP',true)).trim().replace(/,+$/,'');
  if(!/^\d{1,3}$/.test(raw)||Number(raw)>255)throw Error('Invalid KXCI SP: '+raw);
  const value=Number(raw);
  if(value&2){let detail='';try{detail=await command(':ERROR:LAST:GET',true);}catch{}throw Error('KXCI syntax error SP='+value+' '+detail);}
  return {busy:Boolean(value&16),ready:Boolean(value&1)};
 };
 let configured=false,triggered=false,offset=0,shutdown='not-started',state='completed',error='',preview=[];
 const switched=[];
 const settle=async()=>{for(let i=0;i<100;i++){const status=await poll();if(!status.busy)return;await wait(100);}throw Error('仪器中止后仍 Busy');};
 try{
  const initial=await poll();
  if(initial.busy)throw Error('仪器已有测量正在运行');
  if(program.rpmRoutes?.length){const pulse=String(await command(':PMU:TEST:STATUS?',true)).trim().replace(/,\s*$/,'');if(pulse!=='0')throw Error('PMU 正在测量或状态无法确认；未切换 RPM');}
  if(cancelled())return {state:'stopped',shutdown,error};
  await command(':ERROR:LAST:CLEAR');
  configured=true;
  for(const cmd of program.setup){if(cancelled())break;
   const route=program.rpmRoutes?.find(r=>cmd==='RP '+r.pmu+', 2');if(route)switched.push(route);
   await command(cmd);const status=await poll();if(status.busy)throw Error('配置期间仪器意外进入 Busy');}
  for(let cycle=1;cycle<=program.cycles&&!cancelled();cycle++){
   // ME1 starts an entire instrument-owned test. No DV/TI loop here.
   triggered=true;await command('ME1');
   let cursor=1,idlePolls=0,done=false;
   preview=[];
   while(!cancelled()){
    const status=await poll();
    if(status.ready&&!status.busy){done=true;triggered=false;break;}
    if(!status.busy&&++idlePolls>50)throw Error('ME1 未返回 Busy 或 Data Ready');
    if(status.busy){
     idlePolls=0;
     // RD is optional preview, not measurement scheduling. A zero timestamp
     // is ambiguous; never invent a data point. Final DO is authoritative.
     for(let k=0;k<8&&cursor<=program.count&&!cancelled();k++){
      const raw=String(await command("RD '"+program.rdNames.at(-1)+"',"+cursor,true)).trim();
      if(!raw||raw==='0'||/^UNAVAILABLE$/i.test(raw))break;
      const time=parseSystemValues(raw);
      if(time.length!==1||time[0].value<=0)break;
      const columns={[program.timestamp]:time};
      let missing=false;
      for(const s of program.signals){const raw=String(await command("RD '"+s.name+"',"+cursor,true)).trim();if(!raw||/^UNAVAILABLE$/i.test(raw)){missing=true;break;}columns[s.name]=parseSystemValues(raw);}
      if(missing)break;
      if(Object.values(columns).some(v=>v.length!==1))throw Error('RD returned multiple points');
      const row=systemRows(program,columns,cycle,offset+cursor-1,cursor-1)[0];
      preview.push({...row,source:'4200A-KXCI-RD',measurementCompleteness:'partial'});
      cursor++;
     }
     if(preview.length)onPreview(preview);
    }
    await wait(100);
   }
   if(!done)break;
   const columns={};
   for(const name of [...program.signals.map(s=>s.name),program.timestamp]){
    columns[name]=parseSystemValues(await command("DO '"+name+"'",true));
   }
   // Trim only an unmeasured suffix before checking timestamp monotonicity.
   // Raw replies remain in the communication trace.
   const acquired=systemRows(program,acquiredColumnPrefix(program,columns),cycle,offset);
   preview=[];onPreview([]);
   for(let i=0;i<acquired.length;i+=128)onBatch(acquired.slice(i,i+128));
   offset+=acquired.length;
   if(acquired.some(r=>r.measurementStatus==='C'))throw Error('仪器检测到 Compliance，保留已取得的原始记录');
   if(acquired.length!==program.count)throw Error('仪器返回有效点数 '+acquired.length+'，预期 '+program.count);
   // GET is non-destructive; clear only before a new task.
   const last=String(await command(':ERROR:LAST:GET',true)).trim().replace(/,+$/,'');
   const match=last.match(/\((-?\d+)\)/);
   if(match?Number(match[1])!==0:!!last&&!/^ACK$|^no errors?\b/i.test(last))throw Error('KXCI 错误：'+last);
  }
  if(cancelled())state='stopped';
 }catch(e){state='failed';error=String(e.message||e);}
 finally{
  // RD samples are real instrument readings, but not final DO columns.
  // Keep the fully received prefix on interruption, explicitly tagged RD.
  if(preview.length){onBatch(preview.slice());preview=[];onPreview([]);}
  if(configured){
   let safe=true;
   if(triggered){
    try{await command('ME4');await settle();}catch(e){safe=false;error+=(error?'；':'')+'停止未确认：'+String(e.message||e);}
   }
   if(safe){
    try{
     await command('DE');await poll();
     for(const r of [...program.active].reverse()){await command('CH'+program.channels[r]);const status=await poll();if(status.busy)throw Error('关断后仍 Busy');}
     if(switched.length){await command('SS');await command('ZE');await poll();for(const route of switched){await command('RP '+route.pmu+', 0');await poll();}}
    }catch(e){safe=false;error+=(error?'；':'')+'关闭未确认：'+String(e.message||e);}
   }
   shutdown=safe?'commands-sent':'unconfirmed';if(!safe)state='failed';
  }
 }
 return {state,shutdown,error};
}
function compilePulse(input,hardware){
 const {inventory,capabilities:h}=hardware,v=input.settings,s=input.summary;
 const check=(b,m)=>{if(!b)throw Error(m)},n=k=>{const x=Number(v[k]);check(v[k]!=null&&String(v[k]).trim()!==''&&Number.isFinite(x),'无效参数 '+k);return x};
 const m=/^PMU([1-9])-([12])$/.exec(input.resource||'');check(m,'请选择独立 PMU 通道');
 const card=+m[1],sub=+m[2],ch=2*(card-1)+sub;
 const cards=inventory?.slots?.filter(z=>['PMU','PGU'].includes(z.family))||[],ids=cards.map(z=>z.channel).sort((a,b)=>a-b);
 check(ids.length<=4&&ids.every((z,i)=>z===i+1)&&ch<=8,'核对 KCon 通道编号');
 const slot=cards.find(z=>z.family==='PMU'&&z.channel===card);check(slot?.physicalIdentityVerified&&slot.ratingsVerified,'PMU 模块未核验');
 const rpm=slot.rpmChannels?.includes(sub)===true;check(!rpm||input.wiringConfirmed===true,'请确认 RPM 接线');
 const role={D:'drain',G:'gate',S:'source'}[v.terminal];check(role,'测量端子无效');
 const range=n('rangeV'),load=n('loadOhms'),fixed=n('fixedV'),a=n('start'),b=n('stop'),step=n('step'),bursts=n('pulseCount'),rate=n('rateHz'),points=s.points;
 check(['spot','waveform'].includes(v.mode)&&['amplitude','base'].includes(v.sweep)&&[10,40].includes(range),'脉冲模式无效');
 check(n('holdUs')===0&&n('baseDelayUs')===0,'保持或基线延迟尚未接入');
 check(Number.isInteger(points)&&points>=1&&points<=4096&&Number.isInteger(bursts)&&bursts>=1&&bursts<=10000&&Number.isInteger(rate)&&rate>=1000&&rate<=200e6,'点数、脉冲数或采样率越界');
 check(points===1?a===b&&step===0:Math.abs((b-a)/step-(points-1))<1e-6,'扫描点数不一致');
 const base=v.sweep==='amplitude'?fixed:a,baseEnd=v.sweep==='amplitude'?fixed:b;
 const topA=v.sweep==='amplitude'?fixed+a:(v.basePeakV==null||v.basePeakV===''?(points===1?a+fixed:NaN):n('basePeakV')),topB=v.sweep==='amplitude'?fixed+b:topA;
 check(Number.isFinite(topA),'多点基线扫描须明确填写固定绝对峰值');
 const levels=[base,baseEnd,topA,topB],peak=Math.max(...levels.map(Math.abs));
 const lim=h.getPulseOutputLimits('pmu',range,load);check(peak<=lim.maxVoltageV+1e-12&&Math.max(...levels)-Math.min(...levels)<=range,'负载或电压跨度越界');
 const sec=k=>n(k)*1e-6,period=sec('periodUs'),flat=sec('widthUs'),rise=sec('riseUs'),fall=sec('fallUs'),delay=sec('delayUs'),width=flat+(rise+fall)/2,duration=flat+rise+fall;
 const timing=h.getPulseTimingRecommendation(range,null,true,'pmu',rpm,peak),t=timing.kxciInterfaceTiming;
 check(period>=Math.max(t.periodMinS,timing.periodMinS)&&period<=t.periodMaxS&&width>=Math.max(t.pulseWidthMinS,timing.pulseWidthMinS)&&width<=period-1e-8&&width>(rise+fall)/2&&rise<=width&&flat>0,'脉冲宽度或周期无效');
 check(rise>=Math.max(t.transitionMinS,timing.transitionMinS||0)&&fall>=Math.max(t.transitionMinS,timing.transitionMinS||0)&&rise<=t.transitionMaxS&&fall<=t.transitionMaxS&&delay>=0&&(delay===0||delay>=t.delayStepS)&&period-delay-duration>t.minOffTimeS,'边沿、延迟或关断时间无效');
 const begin=v.windowStartUs===''?0:sec('windowStartUs'),window=v.windowTimeUs===''?flat-begin:sec('windowTimeUs'),waveform=v.mode==='waveform';
 check(begin>=0&&window>0&&begin+window<=flat+1e-15,'测量窗口无效');
 check(!waveform||(begin===0&&Math.abs(window-flat)<1e-15),'波形采集需选择完整脉冲窗口');
 const multiplier=input.pointMultiplier??1;
 check(Number.isSafeInteger(multiplier)&&multiplier>=1&&multiplier<=4096,'外层点数无效');
 const totalSweep=points*multiplier;
 const pre=v.prePercent==null?0:n('prePercent'),post=v.postPercent==null?0:n('postPercent');
 check(pre>=0&&pre<=1&&post>=0&&post<=1,'波形前后采样比例为 0–1');
 check(!waveform||pre*duration<=delay+1e-15&&post*duration<=period-delay-duration+1e-15,'前后采样窗口超出基线时间');
 const dur=waveform?duration*(1+pre+post):window,budget=h.getPmuCaptureBudget(dur*totalSweep*bursts,dur,rate,{pulseCount:bursts,sweepPoints:points,stepPoints:multiplier});
 check(budget.kxciBoundaryStatus==='within-published-range','采样容量越界');
 const expected=waveform?null:totalSweep*bursts;check(expected===null||expected<=65536,'记录数越界');
 const ir=v.currentRangeA===''?null:n('currentRangeA');check(ir===null||h.getPmuCurrentRanges(range,rpm).some(z=>Math.abs(z-ir)<=z*1e-12),'电流量程不受支持');
 const policy=v.rangePolicy??'fixed';check(['fixed','limited-auto'].includes(policy),'量程模式无效');
 const power=h.calculateChassisPower({inventory,activePulseChannels:[{family:'PMU',cardIndex:card,rangeV:range}]});check(power.known&&power.withinLimit,'机箱功耗未核验');
 const cmd=(name,...args)=>':PMU:'+name+' '+args.map(z=>typeof z==='number'?systemNumber(z):z).join(',');
 const setup=['SS','ZE',':PMU:INIT 0'];
 if(rpm)setup.push(cmd('RPM:CONFIGURE',input.resource,0));
 setup.push(cmd('LOAD',ch,load),cmd('LLEC:CONFIGURE',ch,0),cmd('SOURCE:RANGE',ch,range),cmd('MEASURE:RANGE',ch,ir===null?0:policy==='limited-auto'?1:2,...(ir===null?[]:[ir])),cmd('MEASURE:MODE',waveform?2:1),cmd('SAMPLE:RATE',rate),cmd('PULSE:BURST:COUNT',bursts),points===1?cmd('PULSE:TRAIN',ch,base,topA):v.sweep==='base'?cmd('SWEEP:PULSE:BASE',ch,a,b,step,topA,0):cmd('SWEEP:PULSE:AMPLITUDE',ch,topA,topB,step,base,0),cmd('PULSE:TIMES',ch,period,width,rise,fall,delay));
 if(waveform)setup.push(cmd('TIMES:WAVEFORM',ch,pre,post));else setup.push(cmd('MEASURE:PIV',ch,1,0),cmd('TIMES:PIV',ch,begin/flat,(begin+window)/flat));
 setup.push(cmd('OUTPUT:STATE',ch,1));
 const countQuery=cmd('DATA:COUNT?',ch),statusQuery=':PMU:TEST:STATUS?',fields=waveform?'V,I,T,S':'VH,IH,TH,SH',offCommand=cmd('OUTPUT:STATE',ch,0);
 const pulse=Object.freeze({setup,reads:[countQuery,statusQuery],cleanup:[offCommand,':PMU:ABORT'],rdNames:[],count:65536,pulseChannel:ch,fields,countQuery,statusQuery,offCommand,resource:input.resource,role,waveform,expected,points,bursts,rate,peak,base,baseEnd,topA,topB,withRpm:rpm,rangeV:range,card,estimatedRecords:waveform?budget.sampleCountAtSelectedRate:expected});
 const physicalVerified=inventory?.physicalModelsVerified===true&&inventory?.hardwareLimitsVerified===true;
 return {plan:{kind:'pulse'},pulse,physicalVerified,capabilityVerified:true,requiresInterlock:peak>21,canExecute:physicalVerified&&peak<=21,channels:{[role]:ch},active:[role],totalPoints:pulse.estimatedRecords,commandMode:'KXCI-PMU'};
}
function parsePulseBlock(raw,p,offset){
 const src=String(raw??'').trim().replace(/;\s*$/,'');if(!src)return [];
 return src.split(';').map((record,i)=>{
 const f=record.split(',').map(x=>x.trim());if(f.length!==4||f.some(x=>!x))throw Error('PMU 字段错误');
 const [voltage,current,time]=f.slice(0,3).map(s=>{if(!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:E[+-]?\d+)?$/i.test(s))throw Error('PMU 数值格式错误');const n=Number(s);if(!Number.isFinite(n)||Math.abs(n)>=9e37)throw Error('PMU 读数无效');return n});if(time<0)throw Error('PMU 时间戳无效');
 return {sequence:offset+i+1,cycle:1,point:offset+i+1,timeS:time,source:'4200A-KXCI-PMU',measurementCompleteness:'complete',measurementStatus:'unknown',pulseStatusRaw:f[3],pulseResource:p.resource,pulseMode:p.waveform?'waveform':'spot',pulseProgram:p.arb?'segment-arb':'pulse-sweep',pulseVoltageV:voltage,pulseCurrentA:current,[p.role+'VoltageV']:voltage,[p.role+'CurrentA']:current,rawKxciResponse:record,rawKxciResponses:{[p.resource]:record}};
 });
}
async function executePulseTask(p,io){
 const {command,wait,cancelled,onBatch}=io;
 const integerReply=(s,max)=>{const raw=String(s).trim().replace(/,\s*$/,'');if(!/^\d+$/.test(raw)||Number(raw)>max)throw Error('PMU 状态或点数无效');return Number(raw)};
 const status=async()=>integerReply(await command(p.statusQuery,true),1);
 const verify=async()=>{const s=parseStatusByte(await command('SP',true));if(s.syntaxError)throw Error('仪器指令错误：'+await command(':ERROR:LAST:GET',true));return s};
 let touched=false,started=false,state='completed',error='',shutdown='not-started',sequence=0;
 const channelWarnings=[];
 const channels=p.channels||[p],closed=new Set();
 const disable=async channel=>{await command(channel.offCommand);await verify();closed.add(channel.pulseChannel)};
 try{
 if((await verify()).busy||await status())throw Error('仪器正在执行其他测试');
 if(cancelled())return {state:'stopped',shutdown,error};
 await command(':ERROR:LAST:CLEAR');touched=true;
 for(const c of p.setup){if(cancelled())break;await command(c);if((await verify()).busy)throw Error('配置期间 Busy')}
 if(!cancelled()){
 started=true;await command(':PMU:EXECUTE');
 while(!cancelled()){
 const busy=await status();await verify();
 if(!busy){started=false;for(const channel of channels)await disable(channel);
 for(const channel of channels){if(channel.skipRead)continue;let cursor=0;const count=integerReply(await command(channel.countQuery,true),channel.count);
 while(cursor<count&&!cancelled()){const n=Math.min(128,count-cursor),rows=parsePulseBlock(await command(':PMU:DATA:GET '+channel.pulseChannel+','+cursor+','+n+','+channel.fields,true),channel,cursor);if(!rows.length||rows.length>n)throw Error('PMU 缓冲区计数不一致');onBatch(rows.map(row=>({...row,pulseChannelSequence:row.sequence,sequence:++sequence,measurementCompleteness:channel.expected!==null&&count!==channel.expected?'partial':row.measurementCompleteness})));cursor+=rows.length}
 if(!cancelled()&&(cursor===0||channel.expected!==null&&cursor!==channel.expected))channelWarnings.push(channel.resource+' 实测 '+cursor+' 点，计划 '+(channel.expected??'非空')+' 点');}
 if(channelWarnings.length)throw Error(channelWarnings.join('；'));break}
 await wait(100);
 }
 }
 if(cancelled())state='stopped';
 }catch(e){state='failed';error=String(e.message||e)}
 finally{if(touched){let safe=true;if(started){try{await command(':PMU:ABORT');let idle=false;for(let i=0;i<100;i++){if(!await status()){idle=true;break}await wait(100)}if(!idle)throw Error('中止后仍 Busy')}catch(e){safe=false;error+='；'+e.message}}
 for(const channel of channels)if(!closed.has(channel.pulseChannel)){try{await disable(channel)}catch(e){safe=false;error+='；'+e.message}}
 shutdown=safe?'commands-sent':'unconfirmed';if(!safe)state='failed'}}
 return {state,shutdown,error};
}
function compilePulsePair(input,hardware){
 const a=input.settings,b=input.secondary.settings,as=input.summary,bs=input.secondary.summary;
 if(a.mode!=='spot'||b.mode!=='spot')throw Error('双通道脉冲目前支持 Spot Mean，双路波形待核验');
 if(a.terminal===b.terminal||input.resource===input.secondary.resource)throw Error('Xsweep 与 Psweep 不能使用同一端子或通道');
 for(const field of ['periodUs','pulseCount','rateHz'])if(Number(a[field])!==Number(b[field]))throw Error('双通道必须共享周期、脉冲数和采样率');
 if(bs.points>1&&as.points===1)throw Error('Psweep 多点步进需要 Xsweep 多点扫描');
 const main=compilePulse({...input,secondary:undefined,pointMultiplier:bs.points},hardware);
 const outer=compilePulse({...input,...input.secondary,secondary:undefined,pointMultiplier:as.points},hardware);
 const x=main.pulse,p=outer.pulse;
 if(x.pulseChannel===p.pulseChannel)throw Error('PMU 通道重复');
 const power=hardware.capabilities.calculateChassisPower({inventory:hardware.inventory,activePulseChannels:[x,p].map(z=>({family:'PMU',cardIndex:z.card,rangeV:z.rangeV}))});
 if(!power.known||!power.withinLimit)throw Error('双通道机箱功耗超限或未核验');
 const shared=/^:PMU:(?:INIT |MEASURE:MODE |SAMPLE:RATE |PULSE:BURST:COUNT )/;
 const channelSetup=z=>z.setup.filter(c=>c!=='SS'&&c!=='ZE'&&!shared.test(c)&&!c.startsWith(':PMU:OUTPUT:STATE '));
 const xSetup=channelSetup(x),pSetup=channelSetup(p).map(c=>{
  if(bs.points>1&&c.startsWith(':PMU:SWEEP:PULSE:AMPLITUDE '))return c.replace(':PMU:SWEEP:',':PMU:STEP:').replace(/,0$/,'');
  return c;
 });
 // Rev F example programs VAR2 before VAR1; both are configured before enabling either output.
 const setup=['SS','ZE',':PMU:INIT 0',...x.setup.filter(c=>shared.test(c)&&!c.startsWith(':PMU:INIT ')),...pSetup,...xSetup,`:PMU:OUTPUT:STATE ${x.pulseChannel},1`,`:PMU:OUTPUT:STATE ${p.pulseChannel},1`];
 const pulse={...x,setup,reads:[x.statusQuery,x.countQuery,p.countQuery],cleanup:[x.offCommand,p.offCommand,':PMU:ABORT'],channels:[x,p],peak:Math.max(x.peak,p.peak),estimatedRecords:x.estimatedRecords+p.estimatedRecords,resources:[x.resource,p.resource],sweepPoints:as.points*bs.points};
 return {...main,pulse,channels:{...main.channels,...outer.channels},active:[...main.active,...outer.active],totalPoints:pulse.estimatedRecords,requiresInterlock:main.requiresInterlock||outer.requiresInterlock,canExecute:main.canExecute&&outer.canExecute};
}
function compileSegmentArb(input,hardware){
 const {inventory,capabilities:h}=hardware,v=input.settings,s=h.normalizeSegmentArb(v),check=(b,m)=>{if(!b)throw Error(m)};
 const m=/^PMU([1-9])-([12])$/.exec(input.resource||'');check(m,'请选择独立 PMU 通道');
 const card=Number(m[1]),sub=Number(m[2]),ch=2*(card-1)+sub;
 const cards=inventory?.slots?.filter(z=>['PMU','PGU'].includes(z.family))||[],ids=cards.map(z=>z.channel).sort((a,b)=>a-b);
 check(ids.length<=4&&ids.every((z,i)=>z===i+1)&&ch<=8,'核对 KCon 通道编号');
 const slot=cards.find(z=>z.family==='PMU'&&z.channel===card);check(slot?.physicalIdentityVerified&&slot.ratingsVerified,'PMU 模块未核验');
 const rpm=slot.rpmChannels?.includes(sub)===true;check(!rpm||input.wiringConfirmed===true,'请确认 RPM 接线');
 check(s.loadOhms!==null,'请填写负载');
 const output=h.getPulseOutputLimits('pmu',s.rangeV,s.loadOhms);
 check(s.peakV<=output.maxVoltageV+1e-12,'峰值超过负载对应的输出能力');
 const ir=Number(v.currentRangeA);check(v.currentRangeA!==''&&h.getPmuCurrentRanges(s.rangeV,rpm).some(x=>Math.abs(x-ir)<=x*1e-12),'任意序列必须选择实际支持的固定电流档');
 const power=h.calculateChassisPower({inventory,activePulseChannels:[{family:'PMU',cardIndex:card,rangeV:s.rangeV}]});
 check(power.known&&power.withinLimit,'机箱功耗未核验或超限');
 const role={D:'drain',G:'gate',S:'source'}[v.terminal],waveform=v.mode==='waveform',cmd=(name,...args)=>':PMU:'+name+' '+args.map(x=>typeof x==='number'?systemNumber(x):x).join(',');
 // Exact decimal representation of 10 ns ticks, including long-duration values.
 const sec=t=>{const whole=Math.floor(t/1e8),frac=String(t%1e8).padStart(8,'0').replace(/0+$/,'');return String(whole)+(frac?'.'+frac:'')};
 const setup=['SS','ZE',':PMU:INIT 1'];
 if(rpm)setup.push(cmd('RPM:CONFIGURE',input.resource,0));
 setup.push(cmd('LOAD',ch,s.loadOhms),cmd('SOURCE:RANGE',ch,s.rangeV),cmd('MEASURE:RANGE',ch,2,ir),cmd('SAMPLE:RATE',s.rateHz));
 const blocks=s.blocks||[s];
 for(let bi=0;bi<blocks.length;bi++){
 const seq=bi+1,segments=blocks[bi].segments;
 const arrays=[['STARTV',segments.map(x=>systemNumber(x.startV))],['STOPV',segments.map(x=>systemNumber(x.stopV))],['TIME',segments.map(x=>sec(x.durationTicks))],['MEAS:TYPE',segments.map(x=>x.measure?(waveform?'2':'1'):'0')],['MEAS:START',segments.map(x=>sec(x.startTicks))],['MEAS:STOP',segments.map(x=>sec(x.stopTicks))]];
 for(const [key,values] of arrays)for(let offset=0;offset<values.length;offset+=128)setup.push(':PMU:SARB:SEQ:'+key+(offset?':ADD':'')+' '+ch+','+seq+','+values.slice(offset,offset+128).join(','));
 }
 const list=blocks.map((b,i)=>String(i+1)+','+String(b.loops));
 for(let i=0;i<list.length;i+=64)setup.push(':PMU:SARB:WFM:SEQ:LIST'+(i?':ADD':'')+' '+ch+','+list.slice(i,i+64).join(','));
 setup.push(cmd('OUTPUT:STATE',ch,1));
 const countQuery=cmd('DATA:COUNT?',ch),statusQuery=':PMU:TEST:STATUS?',fields=waveform?'V,I,T,S':'VH,IH,TH,SH',offCommand=cmd('OUTPUT:STATE',ch,0);
 const pulse=Object.freeze({setup,reads:[countQuery,statusQuery],cleanup:[offCommand,':PMU:ABORT'],rdNames:[],count:65536,pulseChannel:ch,fields,countQuery,statusQuery,offCommand,resource:input.resource,role,waveform,expected:s.points?(waveform?null:s.records):0,skipRead:s.points===0,peak:s.peakV,estimatedRecords:s.estimatedRecords,arb:true,sequenceLoops:s.loops,sequenceCount:blocks.length,sequenceSchedule:blocks.map((b,i)=>({sequence:i+1,loops:b.loops,segments:b.segments.length})),durationTicksExact:s.durationTicksExact,rangeV:s.rangeV,card,segments:s.segments});
 const physicalVerified=inventory?.physicalModelsVerified===true&&inventory?.hardwareLimitsVerified===true;
 return Object.freeze({plan:{kind:'pulse'},pulse,physicalVerified,capabilityVerified:true,requiresInterlock:s.peakV>21,canExecute:physicalVerified&&s.peakV<=21,channels:{[role]:ch},active:[role],totalPoints:s.estimatedRecords,commandMode:'KXCI-PMU-SARB'});
}
function compileSegmentArbPair(input,hardware){
 const summary=hardware.capabilities.normalizeArbPair(input.settings);
 if(!input.arbPartner||!summary.partner)throw Error('缺少第二端子配置');
 const a=compileSegmentArb({...input,settings:{...input.settings,arbPartner:null}},hardware),b=compileSegmentArb({...input,...input.arbPartner,settings:{...input.arbPartner.settings,arbPartner:null}},hardware);
 const x=a.pulse,y=b.pulse;
 if(x.role===y.role||x.pulseChannel===y.pulseChannel)throw Error('两个时序端子不能共享物理输出');
 if(x.durationTicksExact!==y.durationTicksExact||x.durationTicksExact!==summary.durationTicksExact)throw Error('时序总时长不一致');
 const power=hardware.capabilities.calculateChassisPower({inventory:hardware.inventory,activePulseChannels:[x,y].map(z=>({family:'PMU',cardIndex:z.card,rangeV:z.rangeV}))});
 if(!power.known||!power.withinLimit)throw Error('双通道机箱功耗超限或未核验');
 const local=z=>z.setup.filter(c=>!['SS','ZE',':PMU:INIT 1'].includes(c)&&!c.startsWith(':PMU:SAMPLE:RATE ')&&!c.startsWith(':PMU:OUTPUT:STATE '));
 const setup=['SS','ZE',':PMU:INIT 1',...x.setup.filter(c=>c.startsWith(':PMU:SAMPLE:RATE ')),...local(x),...local(y),`:PMU:OUTPUT:STATE ${x.pulseChannel},1`,`:PMU:OUTPUT:STATE ${y.pulseChannel},1`];
 const pulse={...x,setup,reads:[x.statusQuery,x.countQuery,y.countQuery],cleanup:[x.offCommand,y.offCommand,':PMU:ABORT'],channels:[x,y],resources:[x.resource,y.resource],peak:Math.max(x.peak,y.peak),estimatedRecords:x.estimatedRecords+y.estimatedRecords};
 return {...a,pulse,channels:{...a.channels,...b.channels},active:[...a.active,...b.active],totalPoints:pulse.estimatedRecords,requiresInterlock:a.requiresInterlock||b.requiresInterlock,canExecute:a.canExecute&&b.canExecute};
}
function compileNativeSequence(input,hardware){
 const repeat=Number(input.repeat),entries=input.stages;
 if(!Number.isSafeInteger(repeat)||repeat<1||repeat>10000||!Array.isArray(entries)||!entries.length)throw Error('流程循环或测试页无效');
 const seen=new Set(),stages=entries.map((entry,i)=>{
  if(!entry?.scope?.pageId||!entry.scope.routineId||seen.has(entry.scope.pageId)||!['system','pulse'].includes(entry.input?.executionMode))throw Error('流程仅包含独立原生测试页');
  seen.add(entry.scope.pageId);
  const compiled=compileSweep(entry.input,hardware);
  return Object.freeze({index:i+1,scope:Object.freeze({...entry.scope}),compiled});
 });
 if(new Set(stages.map(s=>s.scope.routineId)).size!==1)throw Error('流程包含其他工程的测试页');
 const totalPoints=repeat*stages.reduce((n,s)=>n+s.compiled.totalPoints,0);
 if(!Number.isSafeInteger(totalPoints)||totalPoints<0)throw Error('流程记录数超出软件可表示范围');
 const physicalVerified=stages.every(s=>s.compiled.physicalVerified),capabilityVerified=stages.every(s=>s.compiled.capabilityVerified),requiresInterlock=stages.some(s=>s.compiled.requiresInterlock);
 return Object.freeze({plan:{kind:'routine'},stages:Object.freeze(stages),repeat,totalPoints,physicalVerified,capabilityVerified,requiresInterlock,canExecute:physicalVerified&&capabilityVerified&&!requiresInterlock,commandMode:'KXCI-NATIVE-ROUTINE',channels:{},active:[]});
}
async function executeNativeSequence(compiled,io){
 const results=[];let sequence=0,lastShutdown='not-started',state='completed',error='';
 for(let cycle=1;cycle<=compiled.repeat&&!io.cancelled();cycle++){
  for(const stage of compiled.stages){
   if(io.cancelled())break;
   const stageInfo={routineCycle:cycle,stageIndex:stage.index,...stage.scope};
   let local=0,result,entered=false;
   try{
    io.onStage?.(stageInfo);
    const program=stage.compiled.pulse||stage.compiled.system;
    io.beginProgram(program);entered=true;
    result=await (stage.compiled.pulse?executePulseTask:executeSystemTask)(program,{command:io.command,wait:io.wait,cancelled:io.cancelled,
     onBatch:rows=>io.onBatch(rows.map(row=>({...row,...stageInfo,stageSequence:++local,sequence:++sequence}))),
     onPreview:rows=>io.onPreview(rows.map((row,i)=>({...row,...stageInfo,stageSequence:local+i+1,sequence:sequence+i+1})))});
   }catch(e){result={state:'failed',shutdown:'unconfirmed',error:String(e.message||e)};}
   finally{if(entered)try{io.endProgram();}catch(e){result={state:'failed',shutdown:'unconfirmed',error:String(e.message||e)};}io.onPreview([]);}
   lastShutdown=result.shutdown;
   const record={...stageInfo,state:result.state,shutdown:result.shutdown,error:result.error,rows:local};results.push(record);io.onStageResult?.(record);
   if(result.state!=='completed'||result.shutdown!=='commands-sent'){state=result.state==='stopped'&&result.shutdown!=='unconfirmed'?'stopped':'failed';error=result.error|| (state==='failed'?'流程阶段未确认安全关闭':'');return {state,shutdown:lastShutdown,error,stageResults:results};}
  }
 }
 if(io.cancelled())state='stopped';
 return {state,shutdown:lastShutdown,error,stageResults:results};
}
  function compileSweep(input,hardware={}){
    if(input.executionMode==='routine')return compileNativeSequence(input,hardware);
    if(input.executionMode==='pulse')return (input.settings?.testMode==='sequence'||input.settings?.testMode===undefined&&input.settings?.arb!=null)?(input.settings.arbPartner?compileSegmentArbPair(input,hardware):compileSegmentArb(input,hardware)):input.secondary?compilePulsePair(input,hardware):compilePulse(input,hardware);
    const planner=typeof require==='function'
      ?require('./measurement-plan.js')
      :window.DKDSPluginModules.require('dkts-plan');
    const plan=planner.normalizeSweepProgram(input,hardware);
    const active=ROLES.filter(role=>channelNumber(plan.terminals[role])!==null);
    const channels=Object.fromEntries(active.map(role=>[role,channelNumber(plan.terminals[role])]));
    if(!channels.drain)throw Error('当前 KXCI 用户模式需要漏极 SMU');
    // KXCI SMU current-mode TI responses map SMU1..SMU8 to A..H.
    // An SMU9 assignment must not be accepted without protocol evidence.
    if(channels.drain>8)throw Error('当前 KXCI TI 电流回读仅核验 SMU1 至 SMU8，不能选择 SMU9 测量');
    if(active.some(role=>channels[role]>8))
      throw Error('当前用户模式要求所有启用 SMU 均支持 TI 通道回读（SMU1 至 SMU8）');
    const unsupported=ROLES.filter(role=>{
      const name=plan.terminals[role];
      return name!=='None'&&name!=='GNDU'&&!channelNumber(name);
    });
    if(unsupported.length)throw Error('DC KXCI 用户模式暂不支持非 SMU 电压源：'+unsupported.join(', '));
    const limitRoles=active.every(role=>plan.limitsByRole?.[role]?.known);
    // Keep the hardware's documented ratings; only unresolved physical
    // interlocks and incomplete identity block output, never invent a derating.
    const physicalVerified=hardware.inventory?.physicalModelsVerified===true &&
      hardware.inventory?.hardwareLimitsVerified===true;
    let highestV=0;
    for(const role of active){
      const axis=plan.xSweep.terminal===role?plan.xSweep:
        plan.pSweep?.terminal===role?plan.pSweep:null;
      const volts=plan.generators?.[role]?plan.generators[role].segments.flatMap(s=>[s.startV,s.stopV]):plan.sourceModes?.[role]==='current'?[plan.portSettings[role].complianceV]:axis?axis.segments.flatMap(s=>[s.startV,s.stopV]):
        [plan.fixedVoltages[role]];
      highestV=Math.max(highestV,...volts.map(v=>Math.abs(v)));
    }
    const requiresInterlock=highestV>21||active.some(role=>
      plan.limitsByRole?.[role]?.segmentLimits?.some(s=>s.requiresInterlock));
    const base={plan,channels,active};
    const system=input.executionMode==='system'?compileSystemPlan(base,input,hardware.inventory):null;
    return Object.freeze({plan,channels,active,system,physicalVerified,
      capabilityVerified:limitRoles,requiresInterlock,
      canExecute:physicalVerified&&limitRoles&&!requiresInterlock,
      commandMode:system?'KXCI-SYSTEM-ME1':'KXCI-US-DV-TI',measurementChannel:channels.drain,
      totalPoints:plan.totalPoints,integration:input.systemIntegration||'IT2',timeProgram:input.timeProgram||null});
  }
function voltageTrigger(channel){
 const ids=[1,2,3,4,7,8,9,10];
 if(!Number.isInteger(channel)||!ids[channel-1])throw Error('Invalid SMU voltage trigger channel');
 return ids[channel-1];
}
function parseTv(raw,channel){
 const text=String(raw??'').replace(/\0/g,'').trim().replace(/,\s*$/,'');
 const m=/^([NC])([A-Z])V\s*([+-]?(?:\d+(?:\.\d*)?|\.\d+)[Ee][+-]?\d+)$/i.exec(text);
 if(!m)throw Error('KXCI TV 原始响应无法解析：'+text.slice(0,95));
 const trigger=voltageTrigger(channel),observed=m[2].toUpperCase().charCodeAt(0)-64;
 if(observed!==trigger)throw Error('KXCI TV 响应通道无法确认：SMU'+channel+' / '+m[2]);
 const voltageV=Number(m[3]);if(!Number.isFinite(voltageV)||Math.abs(voltageV)>=9e37)throw Error('TV 读数无效');
 return Object.freeze({voltageV,status:m[1].toUpperCase(),rawResponse:text,channel:m[2].toUpperCase(),requestedSmU:channel,trigger});
}
  function parseTi(raw,expectedChannel){
    const text=String(raw??'').replace(/\0/g,'').trim().replace(/,\s*$/,'');
    // 4200A user-mode: status letter, channel letter, I, signed scientific reading.
    const m=/^([A-Z])([A-Z])I\s*([+-]?(?:\d+(?:\.\d*)?|\.\d+)[Ee][+-]?\d+)$/i.exec(text);
    if(!m)throw Error('KXCI TI 原始响应无法解析：'+text.slice(0,95));
    const currentA=Number(m[3]);
    if(!Number.isFinite(currentA))throw Error('KXCI TI 返回非有限电流');
    const status=m[1].toUpperCase();
    if(!['N','C'].includes(status))throw Error('KXCI TI 状态异常：'+status);
    const requested=integer(expectedChannel,'TI 请求通道',1,8);
    const channel=m[2].toUpperCase();
    const observed='ABCDEFGH'.indexOf(channel)+1;
    if(observed!==requested)
      throw Error('KXCI TI 响应通道不匹配：请求 SMU'+requested+'，返回 '+channel+
        (observed?' (SMU'+observed+')':' (未知通道)'));
    return Object.freeze({currentA,status,channel,
      rawResponse:text,requestedSmU:requested});
  }
  function parseStatusByte(raw){
    const text=String(raw??'').trim().replace(/,\s*$/,'');
    if(!/^\d{1,3}$/.test(text)||Number(text)>255)throw Error('KXCI SP 状态字节无法解析：'+text);
    const value=Number(text);
    return {value,ready:Boolean(value&1),syntaxError:Boolean(value&2),busy:Boolean(value&16)};
  }
  function createRunner(options={}){
    const {controller,execution}=options;
    const wait=typeof options.wait==='function'?options.wait:null;
    const onProgress=typeof options.onProgress==='function'?options.onProgress:()=>{};
    if(!controller||typeof controller.measurementExchange!=='function')
      throw Error('缺少经过身份验证的 KXCI 会话');
    let job=null,sequence=0;
    function publicState(cursor=0){
      const j=job;
      if(!j)return {state:'idle',running:false,rows:[],nextCursor:0,totalRows:0};
      const from=integer(cursor,'数据游标',0,j.rows.length);
      const rows=j.rows.slice(from,Math.min(from+250,j.rows.length));
      return {runId:j.id,state:j.state,running:j.state==='running'||j.state==='stopping',
        totalPoints:j.compiled.totalPoints,totalRows:j.rows.length,
        nextCursor:from+rows.length,rows,liveRows:j.state==='running'?[...j.rows.slice(-4096).filter(r=>!j.currentStage||(r.stageIndex===j.currentStage.stageIndex&&r.routineCycle===j.currentStage.routineCycle)),...(j.previewRows||[])].slice(-4096):[],currentStage:j.currentStage||null,stageResults:j.stageResults?.slice()||[],error:j.error,
        shutdown:j.shutdown,startedAt:j.startedAt,finishedAt:j.finishedAt};
    }
    async function command(cmd,reply=false){
      const r=await controller.measurementExchange(cmd,reply);
      return String(r||'');
    }
    async function shutdown(j){
      // DVn with no arguments disables that SMU output (KXCI Rev E, ex. 2).
      let ok=true;
      const failed=[];
      // Drain a prior syntax flag before checking the off commands themselves.
      try{await command('SP',true);}catch{}
      for(const role of [...j.compiled.active].reverse()){
        try{
          await command('DV'+j.compiled.channels[role]);
          const flags=parseStatusByte(await command('SP',true));
          if(flags.syntaxError||flags.busy)throw Error('关闭命令状态异常 SP='+flags.value);
        }
        catch(e){ok=false;failed.push(role+': '+String(e.message||e));}
      }
      j.shutdown=ok?'commands-sent':'unconfirmed';
      if(!ok)j.error=(j.error?j.error+'；':'')+
        '输出关闭未获确认，请在仪器现场检查：'+failed.join('; ');
      return ok;
    }
    async function executeNative(j,lease){
      try{
        const program=j.compiled.pulse||j.compiled.system;
        controller.beginSystemProgram(program);
        const result=await (j.compiled.pulse?executePulseTask:executeSystemTask)(program,{command,wait,cancelled:()=>j.cancelled,
          onBatch:rows=>{j.rows.push(...rows);try{onProgress(publicState(0));}catch{}},
          onPreview:rows=>{j.previewRows=rows.slice();try{onProgress(publicState(0));}catch{}}});
        Object.assign(j,result);
      }catch(error){j.state='failed';j.error=String(error.message||error);j.shutdown='unconfirmed';}
      finally{controller.endSystemProgram();j.previewRows=[];j.finishedAt=new Date().toISOString();lease.end();}
      return publicState(0);
    }
    async function executeRoutine(j,lease){
     try{const progress=()=>{try{onProgress(publicState(0));}catch{}};j.stageResults=[];
      const result=await executeNativeSequence(j.compiled,{command,wait,cancelled:()=>j.cancelled,beginProgram:p=>controller.beginSystemProgram(p),endProgram:()=>controller.endSystemProgram(),onStage:s=>{j.currentStage=s;progress();},onStageResult:r=>{j.stageResults.push(r);progress();},onBatch:rows=>{j.rows.push(...rows);progress();},onPreview:rows=>{j.previewRows=rows;progress();}});Object.assign(j,result);
     }catch(e){j.state='failed';j.error=String(e.message||e);j.shutdown='unconfirmed';}
     finally{j.previewRows=[];j.finishedAt=new Date().toISOString();lease.end();}return publicState(0);
    }
    async function execute(j,lease){
      if(j.compiled.stages)return executeRoutine(j,lease);
      if(j.compiled.system||j.compiled.pulse)return executeNative(j,lease);
      const plan=j.compiled.plan;
      const lastCommands=Object.create(null);
      let previousP=null,timeOrigin=null;
      let outputAttempted=false;
      const timing=j.compiled.timeProgram;
      const started=Date.now();
      const waitFor=async delay=>{
        if(delay<=0||j.cancelled)return;
        if(!wait)throw Error('宿主缺少受控时序调度器');
        const pending=wait(delay);
        await Promise.race([Promise.resolve(pending),new Promise(resolve=>{j.wake=()=>{try{pending?.cancel?.();}finally{resolve();}};})]);
        j.wake=null;
      };
      const verifyError=async()=>{
        const flags=parseStatusByte(await command('SP',true));
        if(flags.syntaxError){
          let detail='';
          try{detail=await command(':ERROR:LAST:GET',true);}catch(error){detail=String(error.message||error);}
          throw Error('KXCI 命令错误（SP='+flags.value+'）：'+(detail||'请查看仪器 KXCI Console'));
        }
        if(flags.busy)throw Error('仪器仍处于 Busy 状态，拒绝叠加新的测量');
      };
      try{
        const initialStatus=parseStatusByte(await command('SP',true));
        if(initialStatus.busy)throw Error('仪器已有测量正在运行；未启动本次输出');
        await command(':ERROR:LAST:CLEAR');
        await command('EM 1,0');
        await command('US');
        await command('BC');
        // IT2 is the documented medium/default preset. Do not inherit IT1/IT3 from a previous run.
        const integration=timing?.integration||j.compiled.integration||'IT2';
        if(!['IT1','IT2','IT3'].includes(integration))throw Error('测量速度无效');
        await command(integration);
        await verifyError();
        for(const point of points(plan)){
          if(j.cancelled)break;
          for(const role of j.compiled.active){
            const ch=j.compiled.channels[role];
            const voltage=point.voltages[role];
            const setting=plan.portSettings[role];
            const isX=plan.xSweep.terminal===role;
            const isP=plan.pSweep?.terminal===role;
            const segmentRange=isX?point.rangeX:isP?point.rangeP:'auto';
            const selected=segmentRange!=='auto'?Number(segmentRange):
              setting.rangeMode==='fixed'?Number(setting.rangeA):null;
            const compliance=setting.complianceMode==='custom'?
              setting.complianceA:(selected??setting.complianceA);
            const code='DV'+ch+',0,'+numeric(voltage)+','+numeric(compliance);
            if(lastCommands[role]!==code){
              outputAttempted=true;
              await command(code);
              await verifyError();
              lastCommands[role]=code;
              // DV may change range state; reapply the selected range after a new source level.
              delete lastCommands[role+'-range'];
            }
            if(selected!==null){
              const rangeCode='RI '+ch+','+numeric(selected)+','+numeric(compliance);
              if(lastCommands[role+'-range']!==rangeCode){
                await command(rangeCode);
                await verifyError();
                lastCommands[role+'-range']=rangeCode;
              }
            }else if(setting.rangeMode==='limited-auto'){
              const rangeCode='RG '+ch+','+numeric(Number(setting.rangeA));
              if(lastCommands[role+'-range']!==rangeCode){
                await command(rangeCode);
                await verifyError();
                lastCommands[role+'-range']=rangeCode;
              }
            }
            if(j.cancelled)break;
          }
          if(j.cancelled)break;
          if(timing&&timeOrigin===null)timeOrigin=Date.now();
          const plannedS=timing?(point.cycle-1)*timing.durationS+timing.startS+(point.xRepeat-1)*timing.intervalS:null;
          const deadline=timing?timeOrigin+plannedS*1000:null;
          const delay=timing?Math.max(0,deadline-Date.now()):point.delayMs+(point.changedP&&previousP!==null?point.pDelayMs:0);
          previousP=point.pPoint;
          await waitFor(delay);
          if(timing&&!j.cancelled&&Date.now()>deadline+timing.windowS*1000)throw Error('I–T 采样窗口已错过');
          const sampleStarted=Date.now();
          if(j.cancelled)break;
          // TI samples one SMU at a time. All actively driven terminals need
          // their own compliance check; a healthy drain never proves the gate
          // or source is within its independent current protection.
          const rolesToRead=['drain',...j.compiled.active.filter(role=>role!=='drain')];
          const readings=Object.create(null);
          let complianceRole=null,readError=null;
          for(const role of rolesToRead){
            if(j.cancelled)break;
            const channel=j.compiled.channels[role];
            try{
             const raw=await command('TI'+channel,true),sample=parseTi(raw,channel);
             readings[role]={...sample,voltageV:null,voltageRaw:null,voltageStatus:null};
             if(sample.status==='C'){complianceRole=role;break;}
             if(j.cancelled)break;
             const voltage=parseTv(await command('TV'+voltageTrigger(channel),true),channel);
             Object.assign(readings[role],{voltageV:voltage.voltageV,voltageRaw:voltage.rawResponse,voltageStatus:voltage.status});
             if(voltage.status==='C'){complianceRole=role;break;}
            }catch(e){readError=e;break;}
          }
          // Keep a partial row if cancellation arrives between channel reads,
          // rather than fabricating values for channels never measured.
          if(readings.drain){
            const now=Date.now();
            const full=rolesToRead.every(role=>Number.isFinite(readings[role]?.voltageV)&&Number.isFinite(readings[role]?.currentA));
            j.rows.push(Object.freeze({
              timeS:(now-(timeOrigin??started))/1000,plannedTimeS:plannedS,
              sampleStartS:timing?(sampleStarted-timeOrigin)/1000:null,
              sampleWindowOverrun:timing?now>deadline+timing.windowS*1000:false,
              voltageV:readings.drain.voltageV,
              currentA:readings.drain.currentA,
              drainCurrentA:readings.drain.currentA,
              gateCurrentA:readings.gate?.currentA??null,
              sourceCurrentA:readings.source?.currentA??null,
              sourceVoltageV:readings.source?.voltageV??null,
              drainVoltageV:readings.drain.voltageV,gateVoltageV:readings.gate?.voltageV??null,
              plannedSourceVoltageV:point.voltages.source,plannedDrainVoltageV:point.voltages.drain,plannedGateVoltageV:point.voltages.gate,
              xVoltageV:readings[plan.xSweep.terminal]?.voltageV??null,pVoltageV:plan.pSweep?readings[plan.pSweep.terminal]?.voltageV??null:null,
              plannedXVoltageV:point.xVoltageV,plannedPVoltageV:point.pVoltageV,timeOrigin:'host-elapsed',
              sequence:j.rows.length+1,cycle:point.cycle,pRepeat:point.pRepeat,
              pPoint:point.pPoint,pSegment:point.pSegment,
              xRepeat:point.xRepeat,xSegment:point.xSegment,
              point:point.xPoint,
              measurementStatus:complianceRole?'C':'N',
              complianceRole,measurementCompleteness:full?'complete':'partial',
              measurementOrder:[...rolesToRead.filter(role=>Boolean(readings[role]))],
              measurementStatusByRole:Object.fromEntries(
                Object.entries(readings).map(([role,value])=>[role,value.status==='C'||value.voltageStatus==='C'?'C':value.voltageStatus==='N'?'N':'unknown'])),
              rawKxciResponses:Object.fromEntries(Object.entries(readings).flatMap(([role,value])=>[[role+':I',value.rawResponse],...(value.voltageRaw?[[role+':V',value.voltageRaw]]:[])])),
              rawKxciResponse:readings.drain.rawResponse,source:'4200A-KXCI-TI'
            }));
            try{onProgress(publicState(0));}catch{}
          }
          if(timing&&Date.now()>deadline+timing.windowS*1000&&!j.cancelled)throw Error('I–T 超出采样窗口，已保留真实读数并停止');
          if(readError)throw readError;
          if(complianceRole)
            throw Error(complianceRole+' SMU 触及电流保护（Compliance），测量已终止');
          if(j.cancelled)break;
        }
        if(timing&&timeOrigin!==null&&!j.cancelled)await waitFor(timeOrigin+timing.durationS*timing.cycles*1000-Date.now());
        if(j.cancelled)j.state='stopping';
        // KXCI exposes its last error non-destructively. A failed query is
        // handled as a communication failure, not as an acceptable null read.
        if(!j.cancelled){
          await verifyError();
          const last=await command(':ERROR:LAST:GET',true);
          const match=last.match(/\((-?\d+)\)/);
          if(match&&Number(match[1])!==0)
            throw Error('4200A KXCI 仪器错误：'+last.slice(0,140));
          if(!match&&last&&!/^\s*(?:no\s+errors?\b|ACK$)/i.test(last))
            throw Error('KXCI 错误查询响应无法确认：'+last.slice(0,140));
        }
      }catch(error){j.state='failed';j.error=String(error.message||error);}
      finally{
        const safe=outputAttempted?await shutdown(j):true;
        if(!outputAttempted)j.shutdown='not-started';
        if(j.state!=='failed')j.state=safe?(j.cancelled?'stopped':'completed'):'failed';
        j.finishedAt=new Date().toISOString();
        lease.end();
      }
      return publicState(0);
    }
    function start(input,hardware,authorization){
      if(job&&(job.state==='running'||job.state==='stopping'))
        throw Error('已有测试正在执行');
      if(authorization!=='CONFIRM_WIRING_AND_OUTPUT')
        throw Error('必须确认实际接线、电流保护及现场安全条件');
      if(controller.status().phase!=='connected')
        throw Error('4200A 未连接');
      const compiled=compileSweep(input,hardware);
      if(compiled.stages){const policy=hardware.capabilities?.DATABASE?.safetyPolicies?.kxci||{};for(const s of compiled.stages){const c=s.compiled;if(c.pulse?(policy.allowPulseModeOutput!==true||policy.pmuModeManualVerified!==true||(c.pulse.arb&&(policy.allowSegmentArbOutput!==true||policy.segmentArbManualVerified!==true))):(policy.allowSystemModeOutput!==true||policy.smuSystemModeManualVerified!==true))throw Error('流程阶段 '+s.scope.pageName+' 尚未开放真实输出');}}
      if(compiled.pulse&&hardware.capabilities?.DATABASE?.safetyPolicies?.kxci?.allowPulseModeOutput!==true)throw Error('PMU 尚待受控实机验收');
      if(compiled.pulse?.arb&&hardware.capabilities?.DATABASE?.safetyPolicies?.kxci?.allowSegmentArbOutput!==true)throw Error('自定义时序尚待受控实机验收');
      if(!compiled.capabilityVerified||!compiled.physicalVerified)
        throw Error('实际模块型号及其理论额定值尚未完整核验');
      if(compiled.requiresInterlock)
        throw Error('该方案需要硬件高压互锁，尚未实现互锁状态的可靠读取');
      // No implicit partial plan override and no software-derived measurement.
      const needsWait=Boolean(compiled.stages)||Boolean(compiled.pulse)||Boolean(compiled.system)||Boolean(compiled.timeProgram)||compiled.plan.xSweep.delayMs>0||
        compiled.plan.xSweep.segments.some(s=>(s.delayMs||0)>0)||
        Boolean(compiled.plan.pSweep&&(compiled.plan.pSweep.delayMs>0||
          compiled.plan.pSweep.segments.some(s=>(s.delayMs||0)>0)));
      if(needsWait&&!wait)throw Error('当前 DKDS 插件宿主未提供受控测量时序调度器');
      const lease=execution.begin(compiled.plan.kind);
      job={id:'kxci-'+(++sequence),state:'running',cancelled:false,
        compiled,rows:[],error:'',shutdown:'pending',wake:null,task:null,
        startedAt:new Date().toISOString(),finishedAt:null};
      job.task=execute(job,lease);
      return publicState(0);
    }
    function stop(){
      if(!job)return publicState(0);
      if(job.state==='running'||job.state==='stopping'){
        job.cancelled=true;job.state='stopping';job.wake?.();
      }
      return publicState(job.rows.length);
    }
    function waitForCompletion(){
      return job?.task||Promise.resolve(publicState(0));
    }
    async function dispose(){
      stop();
      // Wait for the owned execution task to finish before disconnecting.
      if(job?.task)await job.task;
    }
    return Object.freeze({start,stop,status:publicState,waitForCompletion,dispose});
  }
  const api=Object.freeze({compileSweep,compileNativeSequence,executeNativeSequence,points,parseTi,parseTv,voltageTrigger,parseStatusByte,createRunner,compileSystemPlan,parseSystemValues,systemRows,executeSystemTask,systemNumber,acquiredColumnPrefix,compilePulse,compilePulsePair,compileSegmentArb,compileSegmentArbPair,parsePulseBlock,executePulseTask});
  if(typeof window!=='undefined'&&window.DKDSPluginModules)
    window.DKDSPluginModules.define('com.dkts.keithley-4200','dkts-kxci-measurement',api);
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})();
