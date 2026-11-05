(() => {
  'use strict';
  const DB=typeof window!=='undefined'&&window.DKTS4200ACapabilities
    ?window.DKTS4200ACapabilities
    :typeof module!=='undefined'&&module.exports?require('./4200a-capabilities-data.js'):null;
  if(!DB)throw Error('缺少 4200A 能力数据库；必须先加载 canonical JSON 生成的数据模块');
  function freeze(value){
    if(value&&typeof value==='object'&&!Object.isFrozen(value)){
      Object.values(value).forEach(freeze);Object.freeze(value);
    }
    return value;
  }
  freeze(DB);
  const EPS=1e-12;
  function finite(value,label,min,max){
    if(value===undefined||value===null||String(value).trim()==='')
      throw Error(label+' 不能为空');
    const n=Number(value);
    if(!Number.isFinite(n)||n<min-EPS||n>max+EPS)
      throw Error(label+' 必须在 '+min+' 到 '+max+' 之间');
    return n;
  }
  function integer(value,label,min,max){
    const n=finite(value,label,min,max);
    if(!Number.isSafeInteger(n))throw Error(label+' 必须是整数');
    return n;
  }
  function roundKey(value){
    const n=Number(value);
    return String(Number(n.toPrecision(12)));
  }
  function getDatabase(){return DB;}
  function slotFor(family,channel,hardware={},label='模块',modelHint=null){
    const id=integer(channel,label+' 编号',1,9);
    const inventory=hardware.inventory;
    if(!inventory){
      if(hardware.connected)throw Error('仪器已连接，但模块清单未成功读取，禁止推断模块型号或额定能力');
      let modelKey=null;
      if(family==='SMU'){
        modelKey=modelHint||hardware.selectedModels?.SMU?.[id]||null;
        if(!['4200-SMU','4201-SMU','4210-SMU','4211-SMU'].includes(modelKey))
          throw Error('离线规划必须明确选择 SMU'+id+' 的具体型号（4200-SMU、4201-SMU、4210-SMU 或 4211-SMU），DKTS 不会默认套用较低规格');
      }else if(family==='CVU'){
        modelKey=modelHint||hardware.selectedModels?.CVU?.[id]||null;
        if(!['4210-CVU','4215-CVU'].includes(modelKey))
          throw Error('离线规划必须明确选择 CVU'+id+' 的具体型号（4210-CVU 或 4215-CVU）');
      }else if(family==='PMU')modelKey='4225-PMU';
      else if(family==='PGU')modelKey='4220-PGU';
      else throw Error('离线状态下无法确定 '+family+' 模块的具体型号');
      const model=DB.modules[modelKey];
      if(!model)throw Error('能力数据库中不存在所选模块型号 '+modelKey);
      return {...model,offline:true,channel:id,family,modelKey,
        powerClass:model.powerClass||'unknown',preamplifier:false,rpm:false,exactModelVerified:false};
    }
    if(!Array.isArray(inventory.slots))throw Error('模块清单格式无效');
    const slot=inventory.slots.find(x=>x&&Number(x.channel)===id&&x.family===family);
    if(!slot)throw Error('所选 '+label+id+' 不在已识别的 '+family+' 模块清单中');
    if(slot.family==='unknown'||slot.type==='unknown')throw Error(label+id+' 的模块类型未知，已阻止使用');
    const modelKey=slot.modelKey&&DB.modules[slot.modelKey]?slot.modelKey:
      family==='SMU'?(slot.powerClass==='high'?'4210-SMU':slot.powerClass==='medium'?'4200-SMU':null):
      family==='PMU'?'4225-PMU':family==='PGU'?'4220-PGU':null;
    const remotes=Array.isArray(inventory.remoteModules)?inventory.remoteModules:[];
    const preamp=family==='SMU'&&(slot.preamplifier===true||remotes.some(x=>
      x&&x.category==='SMU-PREAMPLIFIER'&&Number(x.channel)===id));
    const rpm=family==='PMU'&&(slot.rpm===true||
      (Array.isArray(slot.rpmChannels)&&slot.rpmChannels.includes(Number(hardware.pmuChannel||1)))||
      slot.rpmChannels==='unknown'||
      remotes.some(x=>x&&x.category==='PMU-REMOTE-PREAMPLIFIER-SWITCH'&&
        Number(x.pmuChannel)===id&&Number(x.rpmChannel)===Number(hardware.pmuChannel||1)));
    return {...slot,offline:false,modelKey,
      exactModelVerified:!!(slot.modelKey&&DB.modules[slot.modelKey]),preamplifier:preamp,rpm};
  }
  function smuClass(slot){
    const exact=DB.modules[slot.modelKey];
    const value=exact?.powerClass||slot.powerClass;
    if(value!=='medium'&&value!=='high')throw Error('无法确定 SMU'+slot.channel+' 的功率等级；禁止提高输出限值');
    return value;
  }
  function smuModel(slot){
    return DB.modules[slot.modelKey]||DB.modules[smuClass(slot)==='high'?'4210-SMU':'4200-SMU'];
  }
  function voltageRangeFor(absV){
    if(absV<=0.2*1.05+EPS)return 0.2;
    if(absV<=2*1.05+EPS)return 2;
    if(absV<=20*1.05+EPS)return 20;
    if(absV<=200*1.05+EPS)return 200;
    throw Error('SMU 电压超出官方 ±210 V 范围');
  }
  function currentRanges(slot){
    const base=smuModel(slot).currentSourceRanges.map(x=>Number(x.rangeA));
    if(slot.preamplifier)base.push(...DB.modules['4200-PA'].addedCurrentRangesA.map(Number));
    return [...new Set(base)].sort((a,b)=>a-b);
  }
  function currentRangeFor(slot,requested){
    const ranges=currentRanges(slot);
    const value=Number(requested);
    return ranges.find(x=>x*DB.rules.smu.rangeOverrangeFactor+EPS>=value)||null;
  }
  function smuVoltageBounds(slot,absV){
    const cls=smuClass(slot),rule=DB.rules.smu;
    const rangeV=voltageRangeFor(absV);
    const rangeCurrent=Number(rule.voltageSourceMaxCurrentAByPowerClassAndRange[cls][String(rangeV)]);
    const power=Number(rule.maxPowerW[cls]);
    const powerBound=absV>0?power/absV:rangeCurrent;
    return {powerClass:cls,modelKey:slot.modelKey||null,preamplifier:!!slot.preamplifier,
      rangeV,maxAbsVoltageV:210,maxCurrentByRangeA:rangeCurrent,maxPowerW:power,
      maxComplianceA:Math.min(rangeCurrent,powerBound,rule.currentSourceMaxA[cls]),
      minComplianceA:Math.min(...currentRanges(slot))*rule.currentComplianceFraction.min};
  }
  function validateSmuPlan(input={},hardware={}){
    const kind=String(input.kind||'iv');
    if(!['iv','it'].includes(kind))throw Error('该 SMU 测试方式尚未进入安全规划器');
    const sourceSmU=integer(input.sourceSmU??1,'源 SMU',1,9);
    const measureSmU=integer(input.measureSmU??sourceSmU,'测量 SMU',1,9);
    const gateSmU=integer(input.gateSmU??0,'栅极 SMU（0 为不使用）',0,9);
    if(gateSmU&&(gateSmU===sourceSmU||gateSmU===measureSmU))
      throw Error('栅极 SMU 不得与源/测量 SMU 使用相同编号');
    const source=slotFor('SMU',sourceSmU,hardware,'SMU',input.sourceModel);
    const measure=measureSmU===sourceSmU?source:slotFor('SMU',measureSmU,hardware,'测量 SMU',input.measureModel);
    const measurementClass=smuClass(measure);
    const sourceMode=String(input.sourceMode||'voltage').toLowerCase();
    if(!['voltage','current'].includes(sourceMode))throw Error('SMU 源模式只能是 voltage 或 current');
    if(sourceMode==='current'&&gateSmU)throw Error('电流源模式暂不支持独立栅极通道，请先使用电压源模式');
    const gate=gateSmU?slotFor('SMU',gateSmU,hardware,'栅极 SMU',input.gateModel):null;
    const gateBiasV=finite(input.gateBiasV??0,'栅极电压',-210,210);
    if(!gate&&Math.abs(gateBiasV)>EPS)throw Error('设置栅极偏置时必须选择独立的栅极 SMU');
    let bounds,complianceA=null,voltageComplianceV=null,maxAbsVoltageV=0,maxAbsCurrentA=0;
    if(sourceMode==='voltage'){
      const values=kind==='iv'
        ?[finite(input.startV??-1,'扫描起始电压',-210,210),finite(input.stopV??1,'扫描结束电压',-210,210)]
        :[finite(input.fixedV??0.1,'固定偏置',-210,210)];
      maxAbsVoltageV=Math.max(...values.map(Math.abs),Math.abs(gateBiasV));
      bounds=smuVoltageBounds(source,maxAbsVoltageV);
      let gateBounds=null;
      if(gate)gateBounds=smuVoltageBounds(gate,Math.abs(gateBiasV));
      const maxComplianceA=Math.min(bounds.maxComplianceA,gateBounds?.maxComplianceA??Infinity);
      const minComplianceA=Math.max(bounds.minComplianceA,gateBounds?.minComplianceA??0);
      complianceA=finite(input.complianceA??1e-4,'电流 Compliance (A)',minComplianceA,maxComplianceA);
      const selectedCurrentRangeA=currentRangeFor(source,complianceA);
      if(!selectedCurrentRangeA)throw Error('电流 Compliance 超出该 SMU 可用电流量程');
      const selectedGateRangeA=gate?currentRangeFor(gate,complianceA):null;
      const requiresInterlock=maxAbsVoltageV>21;
      if(requiresInterlock&&hardware.interlockState===false)
        throw Error('超过 ±21 V 的 200 V SMU 量程需要物理安全联锁闭合');
      return Object.freeze({
        sourceMode,sourceSmU,measureSmU,gateSmU,sourceModel:source.modelKey||('SMU-'+bounds.powerClass+'-class'),
        measureModel:measure.modelKey||('SMU-'+measurementClass+'-class'),
        gateModel:gate?(gate.modelKey||('SMU-'+gateBounds.powerClass+'-class')):null,
        sourcePowerClass:bounds.powerClass,gatePowerClass:gateBounds?.powerClass||null,
        sourcePreamplifier:bounds.preamplifier,gatePreamplifier:gateBounds?.preamplifier||false,
        sourceVoltageRangeV:bounds.rangeV,gateVoltageRangeV:gateBounds?.rangeV||null,
        sourceMaxAbsVoltageV:Math.max(...values.map(Math.abs)),gateMaxAbsVoltageV:Math.abs(gateBiasV),
        maxAbsVoltageV:maxAbsVoltageV,sourceMaxComplianceA:bounds.maxComplianceA,
        gateMaxComplianceA:gateBounds?.maxComplianceA??null,maxComplianceA,
        minComplianceA,complianceA,selectedCurrentRangeA,selectedGateCurrentRangeA:selectedGateRangeA,
        maxPowerW:bounds.maxPowerW,requiresInterlock,warnings:[
          source.offline?'离线规划按明确选择的 '+source.modelKey+' 型号及数据库额定能力校验；连接仪器后必须重新读取模块清单并校验。':null,
          requiresInterlock&&hardware.interlockState==null?'该方案使用 200 V 量程；必须确认实体安全联锁已闭合。软件不能读取联锁状态。':null,
          !source.offline&&!source.exactModelVerified?'*OPT? 只识别了 SMU 功率等级；电气限值按该硬件等级的公开规格执行，型号专属功能需等 SystemUtil 精确型号。':null
        ].filter(Boolean),executable:false,hardwareVerified:false
      });
    }
    const currentValues=kind==='iv'
      ?[finite(input.startA??-1e-3,'扫描起始电流 (A)',-1.05,1.05),finite(input.stopA??1e-3,'扫描结束电流 (A)',-1.05,1.05)]
      :[finite(input.fixedA??1e-4,'固定电流 (A)',-1.05,1.05)];
    maxAbsCurrentA=Math.max(...currentValues.map(Math.abs));
    const cls=smuClass(source),model=smuModel(source),ranges=currentRanges(source);
    const maxCurrent=DB.rules.smu.currentSourceMaxA[cls];
    if(maxAbsCurrentA>maxCurrent+EPS)throw Error('电流源设定超过所选 SMU 的最大输出电流');
    const selectedCurrentRangeA=currentRangeFor(source,maxAbsCurrentA);
    if(!selectedCurrentRangeA)throw Error('电流设定超出 SMU 当前可用量程');
    const requestedVoltage=finite(input.voltageComplianceV,'电压 Compliance (V)',0.0001,210);
    const currentRange=(model.currentSourceRanges.find(x=>Math.abs(Number(x.rangeA)-selectedCurrentRangeA)<=Math.max(1e-15,selectedCurrentRangeA*1e-9))||
      {maxComplianceV:210});
    const powerBound=maxAbsCurrentA>0?model.maxPowerW/maxAbsCurrentA:210;
    const maxVoltageComplianceV=Math.min(Number(currentRange.maxComplianceV),powerBound,210);
    const rangeV=voltageRangeFor(requestedVoltage);
    const minVoltageComplianceV=rangeV*DB.rules.smu.voltageComplianceFraction.min;
    voltageComplianceV=finite(requestedVoltage,'电压 Compliance (V)',minVoltageComplianceV,maxVoltageComplianceV);
    const requiresInterlock=voltageComplianceV>21;
    if(requiresInterlock&&hardware.interlockState===false)
      throw Error('超过 ±21 V 的 200 V SMU 量程需要物理安全联锁闭合');
    return Object.freeze({
      sourceMode,sourceSmU,measureSmU,gateSmU,sourceModel:source.modelKey||('SMU-'+cls+'-class'),measureModel:measure.modelKey||('SMU-'+measurementClass+'-class'),
      sourcePowerClass:cls,sourcePreamplifier:!!source.preamplifier,
      sourceCurrentRangeA:selectedCurrentRangeA,maxAbsCurrentA,
      maxVoltageComplianceV,voltageComplianceV,voltageRangeV:rangeV,
      requiresInterlock,warnings:[
        source.offline?'离线规划按明确选择的 '+source.modelKey+' 型号及数据库额定能力校验；连接仪器后必须重新读取模块清单并校验。':null,
        requiresInterlock&&hardware.interlockState==null?'该方案使用 200 V 量程；必须确认实体安全联锁已闭合。软件不能读取联锁状态。':null
      ].filter(Boolean),executable:false,hardwareVerified:false
    });
  }
  function resolvePulseSlot(sourceType,options,hardware){
    const family=sourceType==='pmu'?'PMU':'PGU';
    const card=integer(sourceType==='pmu'?(options.pmuCard??1):(options.pguCard??1),
      sourceType==='pmu'?'PMU 卡':'PGU 卡',1,9);
    const channel=integer(sourceType==='pmu'?(options.pmuChannel??1):(options.pguChannel??1),
      '脉冲通道',1,2);
    const slot=slotFor(family,card,{...hardware,pmuChannel:channel},family);
    return {...slot,selectedOutputChannel:channel};
  }
  function pulseTimingProfile(sourceType,rangeV,measureMode,useRPM,currentRangeA){
    if(sourceType==='pgu'||measureMode==='none')return null;
    const pmu=DB.modules['4225-PMU'],rangeKey=String(rangeV)+'V';
    const profiles=[];
    if(measureMode==='current'||measureMode==='both'){
      const table=useRPM?pmu.timing.currentMeasureWithRpm:pmu.timing.currentMeasureNoRpm;
      const profile=table[rangeKey]?.[roundKey(currentRangeA)];
      if(profile)profiles.push(profile);
    }
    if(measureMode==='voltage'||measureMode==='both'){
      const table=useRPM?pmu.timing.voltageMeasureWithRpm:pmu.timing.voltageMeasureNoRpm;
      const profile=table[rangeKey];
      if(profile)profiles.push(profile);
    }
    if(!profiles.length)return null;
    return {
      minPulseS:Math.max(...profiles.map(x=>x.minPulseS)),
      minMeasureWindowS:Math.max(...profiles.map(x=>x.minMeasureWindowS)),
      minTransitionS:Math.max(...profiles.map(x=>x.minTransitionS)),
      settlingS:Math.max(...profiles.map(x=>x.settlingS))
    };
  }
  function validatePulseWaveform(points,options={},hardware={}){
    const sourceType=String(options.sourceType||'pmu').toLowerCase();
    if(!['pmu','pgu'].includes(sourceType))throw Error('脉冲波形源类型必须为 PMU 或 PGU');
    const requestedRangeV=finite(options.rangeV??10,'脉冲电压量程 (V)',10,40);
    if(requestedRangeV!==10&&requestedRangeV!==40)throw Error('PMU/PGU 电压量程只能选择 10 V 或 40 V');
    const loadOhms=finite(options.loadOhms,'DUT 与互连最小总负载阻值 (Ω)',0.000001,1e9);
    const dutCurrentLimitA=finite(options.dutCurrentLimitA,'DUT 允许最大电流 (A)',1e-12,0.8);
    const slot=resolvePulseSlot(sourceType,options,hardware);
    const useRPM=sourceType==='pmu'&&!!slot.rpm;
    const effectiveRangeV=useRPM?Math.min(requestedRangeV,10):requestedRangeV;
    const instrumentCurrentLimitA=DB.rules.pulse.instrumentCurrentCeilingAByRange[String(effectiveRangeV)];
    const sourceImpedanceOhm=DB.modules[sourceType==='pmu'?'4225-PMU':'4220-PGU'].sourceImpedanceOhm;
    const availableCurrentA=effectiveRangeV/(sourceImpedanceOhm+loadOhms);
    const maxCurrentA=Math.min(availableCurrentA,instrumentCurrentLimitA);
    const effectiveCurrentLimitA=Math.min(dutCurrentLimitA,maxCurrentA);
    const maxVoltageV=Math.min(effectiveRangeV*loadOhms/(sourceImpedanceOhm+loadOhms),
      effectiveCurrentLimitA*loadOhms,effectiveRangeV);
    const measureMode=String(options.measureMode||(sourceType==='pmu'?'current':'none')).toLowerCase();
    if(!['none','current','voltage','both'].includes(measureMode))throw Error('PMU 测量模式无效');
    if(sourceType==='pgu'&&measureMode!=='none')throw Error('4220-PGU 是纯电压脉冲源，不能测量电流或电压波形；需要使用 4225-PMU');
    let currentMeasureRangeA=null,timing=null,measureWindowS=null;
    const pmu=DB.modules['4225-PMU'];
    const sampleIntervalS=Number(pmu.sampling.minimumMeasureWindowS||pmu.sampling.nominalSampleIntervalS);
    if(sourceType==='pmu'&&(measureMode==='current'||measureMode==='both')){
      const allowed=(useRPM?DB.modules['4225-RPM'].currentMeasureRangesA:pmu.currentMeasureRangesA)[String(effectiveRangeV)+'V']||[];
      if(!allowed.length)throw Error('当前 PMU/RPM 硬件组合没有对应的电流测量量程');
      const defaultRange=allowed[allowed.length-1];
      currentMeasureRangeA=finite(options.currentMeasureRangeA??defaultRange,'PMU 电流测量量程 (A)',Math.min(...allowed),Math.max(...allowed));
      if(!allowed.some(x=>Math.abs(x-currentMeasureRangeA)<=Math.max(1e-15,x*1e-9)))
        throw Error('所选电流测量量程与 PMU 电压量程/RPM 配置不匹配');
    }
    timing=pulseTimingProfile(sourceType,effectiveRangeV,measureMode,useRPM,currentMeasureRangeA);
    if(sourceType==='pmu'&&measureMode!=='none'){
      measureWindowS=finite(options.measureWindowS??timing?.minMeasureWindowS??sampleIntervalS,
        'PMU 测量窗口 (s)',sampleIntervalS,DB.rules.waveform.segmentArb.hardware.maxSegmentTimeS);
    }
    const hw=DB.rules.waveform.segmentArb.hardware;
    const minSegmentS=Number(hw.minSegmentTimeS);
    const maxSegmentS=Number(hw.maxSegmentTimeS);
    const minSegments=Number(hw.minSegments??1);
    const maxSegments=Number(hw.maxSegments??2048);
    if(!Array.isArray(points)||points.length<minSegments+1||points.length>maxSegments+1)
      throw Error('Segment ARB 需要 '+minSegments+' 至 '+maxSegments+' 段（即 '+(minSegments+1)+' 至 '+(maxSegments+1)+' 个时间-电压点）');
    const firstTime=Number(points[0]?.timeS);
    if(!Number.isFinite(firstTime)||Math.abs(firstTime)>EPS)throw Error('Segment ARB 第一个时间点必须为 0 s');
    let previous=-Infinity,minimumStepS=Infinity,maximumStepS=0;
    const normalized=points.map((point,index)=>{
      if(!point||typeof point!=='object')throw Error('第 '+(index+1)+' 个波形点格式错误');
      const t=finite(point.timeS,'第 '+(index+1)+' 个时间点 (s)',0,1e9);
      const v=finite(point.voltageV,'第 '+(index+1)+' 个电压点 (V)',-maxVoltageV,maxVoltageV);
      if(t<=previous)throw Error('波形时间点必须严格递增，不允许重复');
      previous=t;
      return Object.freeze({timeS:t,voltageV:v});
    });
    if(Math.abs(normalized[0].voltageV-normalized.at(-1).voltageV)>1e-9)
      throw Error('Segment ARB 波形必须首尾电压相同，以满足循环序列的闭合条件');
    let belowRecommendedPulse=false,belowRecommendedTransition=false,belowRecommendedWindow=false;
    for(let i=1;i<normalized.length;i++){
      const dt=normalized[i].timeS-normalized[i-1].timeS;
      if(dt<minSegmentS-EPS||dt>maxSegmentS+EPS)
        throw Error('第 '+i+' 段持续时间必须在硬件范围 '+minSegmentS+' 至 '+maxSegmentS+' s 之间');
      const ticks=dt/Number(hw.timeResolutionS);
      if(Math.abs(ticks-Math.round(ticks))>1e-6)
        throw Error('第 '+i+' 段时间必须符合 '+(Number(hw.timeResolutionS)*1e9)+' ns 硬件编程分辨率');
      if(measureWindowS!==null&&measureWindowS>dt+EPS)
        throw Error('第 '+i+' 段持续时间小于 PMU 测量窗口；测量窗口必须位于当前段内');
      const deltaV=Math.abs(normalized[i].voltageV-normalized[i-1].voltageV);
      if(deltaV>EPS&&timing&&dt<timing.minTransitionS-EPS)belowRecommendedTransition=true;
      if(timing&&dt<timing.minPulseS-EPS)belowRecommendedPulse=true;
      minimumStepS=Math.min(minimumStepS,dt);maximumStepS=Math.max(maximumStepS,dt);
    }
    if(timing&&measureWindowS!==null&&measureWindowS<timing.minMeasureWindowS-EPS)
      belowRecommendedWindow=true;
    const recommendations=timing?{
      minimumPulseWidthS:timing.minPulseS,
      minimumMeasureWindowS:timing.minMeasureWindowS,
      minimumTransitionTimeS:timing.minTransitionS,
      settlingTimeS:timing.settlingS,
      status:'typical-recommended-not-hard-limits'
    }:null;
    const warnings=[
      slot.offline?'离线规划按 '+slot.modelKey+' 的官方硬件规格校验；连接后必须重新读取实际卡槽/RPM 配置。':null,
      sourceType==='pmu'&&useRPM?'检测到 RPM：PMU 输出量程按 RPM 规格限制为 ±10 V。':null,
      sourceType==='pmu'&&measureMode==='current'?'电流测量量程是 ADC 测量范围，不是 DUT 输出电流限值；输出限流另按 DUT 限流和 50 Ω 负载模型计算。':null,
      belowRecommendedPulse?'部分段时间低于所选测量量程的典型推荐最小脉宽；仍在 Segment ARB 硬件定时范围内，但测量稳定性/精度可能下降。':null,
      belowRecommendedTransition?'部分电压变化段短于典型推荐转换时间；软件保留硬件允许值，实际波形边沿可能无法达到目标斜率。':null,
      belowRecommendedWindow?'测量窗口低于典型推荐窗口，但不低于 PMU 的一个 ADC 采样周期。':null,
      sourceType==='pmu'&&measureMode!=='none'&&!timing?'当前量程组合没有可用的典型时序建议；仅按 Segment ARB 硬件范围和 ADC 采样周期校验。':null
    ].filter(Boolean);
    return Object.freeze({
      sourceType,requestedRangeV,rangeV:effectiveRangeV,loadOhms,sourceImpedanceOhm,
      maxCurrentA,availableCurrentA,effectiveCurrentLimitA,maxVoltageV,
      dutCurrentLimitA,measureMode,currentMeasureRangeA,measureWindowS,useRPM,
      sourceCard:slot.channel,sourceChannel:slot.selectedOutputChannel,
      segmentCount:normalized.length-1,durationS:normalized.at(-1).timeS-normalized[0].timeS,
      minimumStepS,maximumStepS,minSegmentTimeS:minSegmentS,maxSegmentTimeS:maxSegmentS,
      timeResolutionS:Number(hw.timeResolutionS),sampleIntervalS:sourceType==='pmu'?sampleIntervalS:null,
      timingRecommendations:recommendations,
      points:normalized,warnings,executable:false,hardwareVerified:false,
      safetyDatabaseVersion:DB.databaseVersion
    });
  }
  function validateSmuWaveform(points,options={},hardware={}){
    if(!Array.isArray(points)||points.length<2||points.length>100000)
      throw Error('SMU 列表波形至少 2 点、最多 100000 点');
    const voltages=points.map((p,i)=>finite(p?.voltageV,'第 '+(i+1)+' 个电压点 (V)',-210,210));
    const plan=validateSmuPlan({
      kind:'iv',sourceMode:'voltage',sourceSmU:options.sourceSmU??1,
      measureSmU:options.measureSmU??options.sourceSmU??1,
      sourceModel:options.sourceModel,measureModel:options.measureModel,
      gateSmU:0,startV:Math.min(...voltages),stopV:Math.max(...voltages),
      complianceA:options.complianceA??1e-4
    },hardware);
    const sourceDelayS=finite(options.sourceDelayS??0.02,'SMU 源延迟 (s)',0,60);
    const integrationTimeS=finite(options.integrationTimeS??0.02,'SMU 测量积分时间 (s)',1e-6,60);
    const minStepS=sourceDelayS+integrationTimeS;
    let previous=-Infinity,minimumStepS=Infinity,maximumStepS=0;
    const normalized=points.map((p,i)=>{
      const t=finite(p.timeS,'第 '+(i+1)+' 个时间点 (s)',0,604800);
      const v=voltages[i];
      if(t<=previous)throw Error('波形时间点必须严格递增，不允许重复');
      previous=t;return Object.freeze({timeS:t,voltageV:v});
    });
    for(let i=1;i<normalized.length;i++){
      const dt=normalized[i].timeS-normalized[i-1].timeS;
      if(dt<minStepS-EPS)throw Error('SMU 列表步进间隔不能小于源延迟与测量积分时间之和 '+minStepS+' s');
      minimumStepS=Math.min(minimumStepS,dt);maximumStepS=Math.max(maximumStepS,dt);
    }
    return Object.freeze({
      sourceType:'smu',rangeV:plan.sourceVoltageRangeV,loadOhms:null,
      maxVoltageV:Math.min(210,Math.max(...voltages.map(Math.abs))),
      maxCurrentA:plan.maxComplianceA,effectiveCurrentLimitA:plan.complianceA,
      sourceDelayS,integrationTimeS,minimumStepS,maximumStepS,
      durationS:normalized.at(-1).timeS-normalized[0].timeS,
      points:normalized,warnings:[...plan.warnings,'SMU 列表点时间是 SDM 计划下限估算；实际稳定时间和自动量程可能延长。'],
      executable:false,hardwareVerified:false,safetyDatabaseVersion:DB.databaseVersion
    });
  }
  function validateCvuPlan(input={},hardware={}){
    const cvuChannel=integer(input.cvuChannel??1,'CVU 通道',1,9);
    const slot=slotFor('CVU',cvuChannel,hardware,'CVU',input.cvuModel);
    const modelKey=slot.modelKey;
    if(!modelKey||!DB.modules[modelKey])throw Error('未识别到 CVU 的确切型号，不能用较低规格型号代替');
    const model=DB.modules[modelKey];
    const acDriveVrms=finite(input.acDriveVrms??0.05,'CVU AC 激励 (Vrms)',model.acDriveVrms.min,model.acDriveVrms.max);
    const frequencyHz=finite(input.frequencyHz??100000,'CVU 测试频率 (Hz)',model.frequencyHz.min,model.frequencyHz.max);
    const schedule=model.frequencyHz;
    let frequencyValid=false;
    if(Array.isArray(schedule.stepSchedule)){
      frequencyValid=schedule.stepSchedule.some(x=>frequencyHz>=x.from-EPS&&frequencyHz<=x.to+EPS&&
        Math.abs((frequencyHz-x.from)/x.step-Math.round((frequencyHz-x.from)/x.step))<1e-8);
    }else if(schedule.step){
      frequencyValid=Math.abs((frequencyHz-schedule.min)/schedule.step-
        Math.round((frequencyHz-schedule.min)/schedule.step))<1e-8;
    }
    if(!frequencyValid)throw Error(modelKey+' 不支持该频率步进');
    const biasSource=String(input.biasSource||'internal');
    if(!['internal','external-smu','cvu-pwr'].includes(biasSource))throw Error('CVU DC Bias 来源无效');
    const dcBiasV=finite(input.dcBiasV??0,'CVU DC Bias (V)',
      biasSource==='internal'?-30:biasSource==='cvu-pwr'?-200:-210,biasSource==='internal'?30:biasSource==='cvu-pwr'?200:210);
    const dcBiasCurrentLimitA=finite(input.dcBiasCurrentLimitA??0.001,'CVU DC Bias 电流限制 (A)',1e-9,
      biasSource==='internal'?0.01:biasSource==='cvu-pwr'?0.3:1);
    if(biasSource==='cvu-pwr'&&Math.abs(dcBiasV)>200+EPS)throw Error('4200-CVU-PWR 的单端 DC Bias 不得超过 ±200 V');
    if(biasSource==='external-smu'){
      if(hardware.connected&&!hardware.inventory?.externalAccessories?.cviv)
        throw Error('外部 SMU 偏置需要确认 4200A-CVIV 路径；当前仪器清单未确认 CVIV');
      const biasSmU=integer(input.biasSmU,'CVU 外部偏置 SMU',1,9);
      const biasComplianceA=finite(input.biasComplianceA,'CVU 外部 SMU 电流 Compliance (A)',1e-12,1.05);
      validateSmuPlan({kind:'it',sourceMode:'voltage',sourceSmU:biasSmU,measureSmU:biasSmU,
        sourceModel:input.biasModel,measureModel:input.biasModel,
        fixedV:dcBiasV,complianceA:biasComplianceA},hardware);
    }
    if(biasSource==='cvu-pwr'&&!hardware.inventory?.externalAccessories?.cvuPower&&hardware.connected)
      throw Error('未确认安装 4200-CVU-PWR 高功率 C-V 选件');
    return Object.freeze({
      cvuChannel,modelKey,frequencyHz,acDriveVrms,biasSource,dcBiasV,dcBiasCurrentLimitA,
      warnings:[slot.offline?'离线规划按明确选择的 '+modelKey+' 官方规格校验；连接后必须重新读取实际 CVU 型号。':null].filter(Boolean),
      executable:false,hardwareVerified:false,safetyDatabaseVersion:DB.databaseVersion
    });
  }
  const api=Object.freeze({getDatabase,slotFor,validateSmuPlan,validateSmuWaveform,
    validatePulseWaveform,validateCvuPlan,voltageRangeFor});
  if(typeof window!=='undefined'){
    window.DKTS4200ASafetyPolicy=api;
    if(window.DKDSPluginModules)window.DKDSPluginModules.define('com.dkds.keithley-4200','dkts-safety-policy',api);
  }
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})();
