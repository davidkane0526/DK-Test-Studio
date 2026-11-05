(() => {
  'use strict';
  function capabilityApi(hardware) {
    if (hardware?.capabilities) return hardware.capabilities;
    if (typeof window !== 'undefined' && window.DKTSHardwareCapabilities) return window.DKTSHardwareCapabilities;
    if (typeof module !== 'undefined' && typeof require === 'function') return require('./hardware-capabilities.js');
    return null;
  }
  function finite(input, label, min, max) {
    if (input === undefined || input === null || String(input).trim() === '') throw Error(label + ' 不能为空');
    const n = Number(input);
    if (!Number.isFinite(n) || n < min || n > max) throw Error(label + ' 必须在 ' + min + ' 到 ' + max + ' 的规划范围内');
    return n;
  }
  function positive(input, label) {
    if (input === undefined || input === null || String(input).trim() === '') throw Error(label + ' 不能为空');
    const n = Number(input);
    if (!Number.isFinite(n) || n <= 0) throw Error(label + ' 必须是大于 0 的有限数值');
    return n;
  }
  function count(input, label, min, max) {
    const n = finite(input, label, min, max);
    if (!Number.isSafeInteger(n)) throw Error(label + ' 必须是整数');
    return n;
  }
  function findChannel(inventory, channel, allowedFamilies = ['SMU','VS','VM']) {
    if (!Array.isArray(inventory?.slots)) return null;
    const candidates=inventory.slots.filter(item=>item&&item.channel===Number(channel)&&allowedFamilies.includes(item.family));
    if(!candidates.length)return null;
    return candidates.find(item=>item.family===allowedFamilies[0])||candidates[0];
  }
  function detectedSmUClass(channel, inventory) {
    const slot = findChannel(inventory, channel, ['SMU']);
    return slot?.family === 'SMU' ? slot.powerClass : 'UNKNOWN';
  }
  function normalizePlan(input = {}, hardware = {}) {
    const kind = String(input.kind || 'iv');
    if (!['iv', 'it'].includes(kind)) throw Error('该测试方式尚未进入安全执行计划');
    const loops = count(input.loops ?? 1, '循环次数', 1, 10000);
    const points = count(input.points ?? 101, '每循环点数', 2, 4096);
    const sourceSmU = count(input.sourceSmU ?? 1, '源 SMU', 1, 9);
    const measureSmU = count(input.measureSmU ?? 1, '测量 SMU', 1, 9);
    const gateSmU = count(input.gateSmU ?? 0, '栅极 SMU（0 为不使用）', 0, 9);
    if (gateSmU && (gateSmU === sourceSmU || gateSmU === measureSmU)) throw Error('栅极 SMU 不得与源/测量 SMU 使用相同编号');
    const startV = finite(input.startV ?? -1, '扫描起始电压', -210, 210);
    const stopV = finite(input.stopV ?? 1, '扫描结束电压', -210, 210);
    const fixedV = finite(input.fixedV ?? 0.1, '固定偏置', -210, 210);
    const gateBiasV = finite(input.gateBiasV ?? 0, '栅极电压', -210, 210);
    if (!gateSmU && gateBiasV !== 0) throw Error('设置栅极偏置时必须选择独立的栅极 SMU');
    const sourceMaxAbsVoltage = kind === 'iv' ? Math.max(Math.abs(startV), Math.abs(stopV)) : Math.abs(fixedV);
    const gateMaxAbsVoltage = gateSmU ? Math.abs(gateBiasV) : 0;
    const sourceSlot = findChannel(hardware.inventory, sourceSmU, ['SMU','VS']);
    const measureSlot = findChannel(hardware.inventory, measureSmU, ['SMU']);
    const gateSlot = gateSmU ? findChannel(hardware.inventory, gateSmU, ['SMU','VS']) : null;
    const caps = capabilityApi(hardware);
    const hasInventory = Array.isArray(hardware.inventory?.slots);
    if (hasInventory && !sourceSlot) throw Error('源通道 ' + sourceSmU + ' 不在仪器 *OPT? 模块清单中');
    if (hasInventory && !measureSlot) throw Error('测量通道 ' + measureSmU + ' 不在仪器 *OPT? 模块清单中');
    if (hasInventory && gateSmU && !gateSlot) throw Error('栅极通道 ' + gateSmU + ' 不在仪器 *OPT? 模块清单中');
    if (sourceSlot && !['SMU', 'VS'].includes(sourceSlot.family)) throw Error('所选源通道不是 SMU 或 KXCI VS 电压源');
    if (measureSlot && measureSlot.family !== 'SMU') throw Error('I–V/I–t 电流测量通道必须是 SMU，VM 只能测量电压');
    if (gateSlot && !['SMU', 'VS'].includes(gateSlot.family)) throw Error('栅极通道必须是 SMU 或 KXCI VS 电压源');
    if (sourceSmU === measureSmU && sourceSlot?.family === 'VS') throw Error('VS 是电压源专用通道，不能同时承担电流测量');
    const complianceA = positive(input.complianceA ?? 1e-4, '电流限值');
    const sourceLimits = caps?.getSourceLimits ? caps.getSourceLimits(sourceSlot, sourceMaxAbsVoltage, complianceA) : { known: false, maxAbsVoltageV: 210 };
    const gateLimits = gateSmU && caps?.getSourceLimits ? caps.getSourceLimits(gateSlot, gateMaxAbsVoltage) : null;
    const sourceVoltageMax = sourceLimits.maxAbsVoltageV ?? 210;
    if (sourceMaxAbsVoltage > sourceVoltageMax + 1e-12) throw Error('源电压超过所选通道的理论上限 ±' + sourceVoltageMax + ' V');
    if (gateLimits && gateMaxAbsVoltage > (gateLimits.maxAbsVoltageV ?? 210) + 1e-12) throw Error('栅极电压超过所选通道的理论上限 ±' + (gateLimits.maxAbsVoltageV ?? 210) + ' V');
    const sourceCompliance = sourceLimits?.known === true && sourceLimits.maxComplianceA != null ? sourceLimits : null;
    const gateSourceLimits = gateSmU && caps?.getSourceLimits ? caps.getSourceLimits(gateSlot, gateMaxAbsVoltage, complianceA) : null;
    const gateCompliance = gateSourceLimits?.known === true && gateSourceLimits.maxComplianceA != null ? gateSourceLimits : null;
    const knownComplianceLimits = [sourceCompliance, gateCompliance].filter(Boolean);
    const knownMaxComplianceA = knownComplianceLimits.length ? Math.min(...knownComplianceLimits.map(item => item.maxComplianceA)) : null;
    const knownMinComplianceA = knownComplianceLimits.length ? Math.max(...knownComplianceLimits.map(item => item.minComplianceA)) : null;
    const allComplianceChannelsKnown = Boolean(sourceCompliance) && (!gateSmU || Boolean(gateCompliance));
    if (knownMaxComplianceA !== null && complianceA > knownMaxComplianceA + 1e-15) throw Error('电流限值超过已识别 SMU 通道的理论能力上限 ' + knownMaxComplianceA + ' A');
    if (knownMinComplianceA !== null && complianceA < knownMinComplianceA - 1e-15) throw Error('电流限值低于已识别 SMU 通道的 KXCI 最小值 ' + knownMinComplianceA + ' A');
    const direction = String(input.direction || 'roundtrip');
    if (!['forward', 'reverse', 'roundtrip'].includes(direction)) throw Error('不支持的扫描方向');
    const delayMs = finite(input.delayMs ?? 20, '扫描点间延迟', 0, 6553);
    const intervalMs = finite(input.intervalMs ?? 100, 'I–t 采样间隔', 10, 10000);
    const pointsPerCycle = kind === 'iv' && direction === 'roundtrip' ? points * 2 - 1 : points;
    if (pointsPerCycle > 4096) throw Error('单次 KXCI 列表扫描最多 4096 个点；往返扫描请相应减少每个方向的点数');
    const totalPoints = loops * pointsPerCycle;
    if (totalPoints > 250000) throw Error('预计采样点超过 250000，请减少循环或点数');
    const maxAbsVoltage = Math.max(sourceMaxAbsVoltage, gateMaxAbsVoltage);
    const activeSmuChannels = [sourceSlot, measureSlot, gateSlot].filter(Boolean).map(slot=>({channel:slot.channel,family:slot.family}));
    const powerBudget = caps?.calculateChassisPower ? caps.calculateChassisPower({ inventory: hardware.inventory, activeSmuChannels }) : { known: false, reason: '能力数据库不可用' };
    if (powerBudget.known && !powerBudget.withinLimit) throw Error('4200A 机箱功耗预算超限：' + powerBudget.totalW + ' W > ' + powerBudget.limitW + ' W');
    const capabilityStatus = !hasInventory ? 'not-inspected' : allComplianceChannelsKnown ? 'identified' : knownComplianceLimits.length ? 'partial' : 'unresolved';
    const requiresInterlock = sourceMaxAbsVoltage > 21 || gateMaxAbsVoltage > 21 || Boolean(sourceLimits.requiresInterlock || gateLimits?.requiresInterlock);
    return Object.freeze({
      schema: 'dk-test-studio.smu-plan.v2', kind, loops, points, direction, sourceSmU, measureSmU, gateSmU,
      sourceModel: sourceSlot?.type || 'UNKNOWN', gateModel: gateSlot?.type || null, sourcePowerClass: sourceSlot?.powerClass || null,
      sourceMaxAbsVoltageV: sourceMaxAbsVoltage, gateMaxAbsVoltageV: gateMaxAbsVoltage, maxAbsVoltageV: maxAbsVoltage,
      sourceVoltageRangeV: sourceCompliance?.voltageRangeNominalV ?? null, gateVoltageRangeV: gateCompliance?.voltageRangeNominalV ?? null,
      sourceMaxComplianceA: sourceCompliance?.maxComplianceA ?? null, gateMaxComplianceA: gateCompliance?.maxComplianceA ?? null,
      maxComplianceA: allComplianceChannelsKnown ? knownMaxComplianceA : null, knownMaxComplianceA,
      minComplianceA: allComplianceChannelsKnown ? knownMinComplianceA : null,
      sourceCurrentRangeA: sourceCompliance?.selectedCurrentRangeA ?? null, gateCurrentRangeA: gateCompliance?.selectedCurrentRangeA ?? null,
      complianceA, delayMs, intervalMs, startV, stopV, fixedV, gateBiasV, pointsPerCycle, totalPoints,
      hardwareCapabilityStatus: capabilityStatus, hardwareLimitsVerified: Boolean(hardware.inventory?.hardwareLimitsVerified),
      powerBudget, requiresInterlock, interlockStatus: requiresInterlock ? 'not-read-by-current-read-only-bridge' : 'not-required-for-selected-voltage-range',
      executable: false, hardwareVerified: false, provenance: 'user-test-plan',
      capabilityDatabaseVersion: caps?.DATABASE?.databaseVersion || null,
      safetyNote: '未识别模块不套用猜测的电流上限；已识别通道按模块和电压档校验。未知或未完整识别的方案仍不可执行。'
    });
  }
  function previewPlan(plan, limit = 300, hardware = {}) {
    if(plan?.sweepProgram)return previewSweepProgram(plan,limit,hardware);
    const p = normalizePlan(plan, hardware), max = Math.min(p.totalPoints, Math.max(2, Math.trunc(limit))), rows = [];
    for (let index = 0; index < max; index++) {
      const cycle = Math.floor(index / p.pointsPerCycle) + 1, pos = index % p.pointsPerCycle;
      let voltageV = p.fixedV;
      if (p.kind === 'iv') {
        const fraction = pos < p.points ? pos / (p.points - 1) : (p.pointsPerCycle - pos - 1) / (p.points - 1);
        const progress = p.direction === 'reverse' ? 1 - fraction : fraction;
        voltageV = p.startV + (p.stopV - p.startV) * progress;
      }
      rows.push({ cycle, point: pos + 1, setVoltageV: voltageV, plannedElapsedS: p.kind === 'it' ? index * p.intervalMs / 1000 : null });
    }
    return { plan: p, firstPoints: rows, truncated: p.totalPoints > max };
  }

  // Multi-segment, nested-parameter DC scan planner. This is a read-only
  // validation/preview contract, NOT an instrument execution implementation.
  const DC_ROLES=Object.freeze(['source','drain','gate']);
  const SCIENTIFIC_RANGES=Object.freeze([1e-12,1e-11,1e-10,1e-9,1e-8,1e-7,
    1e-6,1e-5,1e-4,1e-3,1e-2,1e-1,1]);
  function formatCurrentRange(value){
    const n=Number(value);
    if(!Number.isFinite(n)||n<=0)throw Error('电流量程必须为正数');
    return n.toExponential(0).replace('e+','e');
  }
  function scanChannel(value,label){
    const raw=String(value??'None').toUpperCase().trim();
    if(raw==='NONE')return {name:'None',family:'none',number:null};
    if(raw==='GNDU')return {name:'GNDU',family:'GNDU',number:null};
    const match=/^(SMU|VS|VM|PMU|VPU)([1-9])(?:-([12]))?$/.exec(raw);
    if(!match)throw Error(label+' 不是有效的 4200A 通道标识');
    if(match[3]&& !['PMU','VPU'].includes(match[1]))
      throw Error(label+' 的子通道编号只适用于 PMU/PGU');
    return {name:raw,family:match[1],number:Number(match[2]),subchannel:match[3]?Number(match[3]):null};
  }
  function sweepSegment(input,index,axisName){
    if(!input||typeof input!=='object')throw Error(axisName+' 第 '+index+' 段参数无效');
    const label=axisName+' 第 '+index+' 段';
    const startV=finite(input.startV,label+' 起点',-210,210);
    const stopV=finite(input.stopV,label+' 终点',-210,210);
    const stepV=finite(input.stepV,label+' 步长',-420,420);
    const delta=stopV-startV;
    if(delta===0){
      if(stepV!==0)throw Error(label+' 起止相同必须使用 0 步长');
      return Object.freeze({startV,stopV,stepV,points:1,
        rangeA:String(input.rangeA??'auto').toLowerCase(),
        delayMs:input.delayMs==null||input.delayMs===''?null:
          finite(input.delayMs,label+' 点间延迟',0,6553)});
    }
    if(stepV===0||Math.sign(delta)!==Math.sign(stepV))
      throw Error(label+' 步长符号必须与扫描方向一致');
    const interval=delta/stepV,nearest=Math.round(interval);
    if(!Number.isSafeInteger(nearest)||nearest<1||
       Math.abs(interval-nearest)>1e-8*Math.max(1,Math.abs(interval)))
      throw Error(label+' 步长不能准确到达终点，请修改起点、终点或步长');
    // Per-command KXCI list capacity, not a guessed hardware voltage limit.
    if(nearest+1>4096)throw Error(label+' 超过 KXCI 单段 4096 点，请拆分扫描段');
    return Object.freeze({startV,stopV,stepV,points:nearest+1,
      rangeA:String(input.rangeA??'auto').toLowerCase(),
      delayMs:input.delayMs==null||input.delayMs===''?null:
        finite(input.delayMs,label+' 点间延迟',0,6553)});
  }
  function sweepAxis(input,name,defaultRole){
    if(!input||typeof input!=='object')throw Error(name+' 设置缺失');
    const terminal=String(input.terminal||defaultRole).toLowerCase();
    if(!DC_ROLES.includes(terminal))throw Error(name+' 必须指定源极、漏极或栅极');
    const delayMs=finite(input.delayMs??20,name+' 点间延迟',0,6553);
    const repeats=count(input.repeats??1,name+' 重复次数',1,10000);
    if(!Array.isArray(input.segments)||input.segments.length<1||input.segments.length>256)
      throw Error(name+' 需要 1–256 个连续扫描段');
    const segments=input.segments.map((row,i)=>sweepSegment(row,i+1,name));
    const points=segments.reduce((sum,row)=>sum+row.points,0);
    if(!Number.isSafeInteger(points))throw Error(name+' 点数超出安全整数范围');
    return Object.freeze({terminal,delayMs,repeats,segments,points});
  }
  function pointOnAxis(axis,index){
    let offset=index;
    for(const segment of axis.segments){
      if(offset<segment.points)return Object.freeze({
        voltageV:offset===segment.points-1?segment.stopV:
          segment.startV+offset*segment.stepV,
        rangeA:segment.rangeA,delayMs:segment.delayMs??axis.delayMs,
        segmentIndex:axis.segments.indexOf(segment)+1});
      offset-=segment.points;
    }
    throw Error('扫描点索引越界');
  }
  function normalizeSweepProgram(input={},hardware={}){
    const program=input.sweepProgram||input;
    const kind=String(input.kind||program.kind||'iv');
    if(!['iv','transfer','output'].includes(kind))
      throw Error('当前扫描规划仅支持 I–V、转移特性和输出特性');
    const requested=program.terminals||{};
    const terminalChannels=Object.create(null),taken=new Set();
    for(const role of DC_ROLES){
      const channel=scanChannel(requested[role],role);
      if(channel.name!=='None'){
        if(taken.has(channel.name))throw Error('端口冲突：同一仪器通道不能同时分配给多个电极');
        taken.add(channel.name);
      }
      terminalChannels[role]=channel.name;
    }
    const x=sweepAxis(program.xSweep,'Xsweep',kind==='transfer'?'gate':'drain');
    const pEnabled=program.pSweep?.enabled===true;
    const p=pEnabled?sweepAxis(program.pSweep,'Psweep',
      x.terminal==='gate'?'drain':'gate'):null;
    if(p&&p.terminal===x.terminal)
      throw Error('Psweep 和 Xsweep 不能扫描同一个电极');
    if(['None','GNDU'].includes(terminalChannels[x.terminal])||
       (p&&['None','GNDU'].includes(terminalChannels[p.terminal])))
      throw Error('扫描电极必须分配能输出电压的仪器通道');
    const loops=count(program.loops??1,'整体循环次数',1,10000);
    const totalPoints=x.points*x.repeats*(p?p.points*p.repeats:1)*loops;
    if(!Number.isSafeInteger(totalPoints))throw Error('总规划点数超过安全整数范围');
    const fixedVoltages=Object.create(null);
    for(const role of DC_ROLES)
      fixedVoltages[role]=finite(program.fixedVoltages?.[role]??0,
        role+' 固定电压',-210,210);
    for(const role of DC_ROLES){
      if(['None','GNDU'].includes(terminalChannels[role])&&fixedVoltages[role]!==0)
        throw Error(role+' 未分配源通道或为 GNDU，不能施加非零偏置');
    }
    const caps=capabilityApi(hardware);
    const inventory=hardware.inventory;
    const configured=Array.isArray(inventory?.slots);
    const portSettings=Object.create(null),slotForRole=Object.create(null),limitsByRole=Object.create(null);
    for(const role of DC_ROLES){
      const name=terminalChannels[role];
      const channel=scanChannel(name,role);
      if(!['none','GNDU','SMU','VS'].includes(channel.family))
        throw Error(role+' 的 DC 扫描必须使用 SMU 或 VS；PMU/PGU 应在脉冲测试中配置');
      const entry=program.portSettings?.[role]||{};
      const rangeMode=String(entry.rangeMode||'auto');
      const complianceMode=String(entry.complianceMode||'follow-range');
      if(!['auto','fixed','limited-auto'].includes(rangeMode))
        throw Error(role+' 的电流测量模式无效');
      if(!['follow-range','custom'].includes(complianceMode))
        throw Error(role+' 的电流保护模式无效');
      const rangeA=String(entry.rangeA??'1e-6').toLowerCase();
      const complianceA=positive(entry.complianceA??1e-4,role+' 电流保护值');
      if(rangeMode!=='auto'&&!SCIENTIFIC_RANGES.some(v=>String(v)===String(Number(rangeA))))
        throw Error(role+' 固定量程/自动量程下限必须为原厂支持的离散档位');
      portSettings[role]=Object.freeze({rangeMode,complianceMode,rangeA,complianceA});
      if(channel.family==='none'||channel.family==='GNDU')continue;
      const slot=inventory?.slots?.find(item=>item&&item.channel===channel.number&&
        (item.family===channel.family||
          (channel.family==='SMU'&&item.family==='SMU'))) ||null;
      if(configured&&!slot)throw Error(role+' 端口 '+name+' 未在实际模块清单中发现');
      slotForRole[role]=slot;
      if(!configured||!slot)continue;
      const ownAxis=x.terminal===role?x:p?.terminal===role?p:null;
      const voltageMax=ownAxis
        ?Math.max(...ownAxis.segments.flatMap(z=>[Math.abs(z.startV),Math.abs(z.stopV)]))
        :Math.abs(fixedVoltages[role]);
      const lim=caps?.getSourceLimits?.(slot,voltageMax);
      if(lim?.known===true){
        if(voltageMax>lim.maxAbsVoltageV+1e-12)throw Error(role+' 电压超出实装模块能力');
        const supported=lim.availableCurrentRangesA||[];
        function ensureRange(value,label){
          if(!supported.some(v=>Math.abs(v-value)<=Math.max(v,value)*1e-10))
            throw Error(label+' 不受已识别模块支持');
        }
        if(rangeMode!=='auto')ensureRange(Number(rangeA),role+' 电流测量档位');
        const segmentRanges=ownAxis?ownAxis.segments:[{rangeA:'auto'}];
        for(const [i,segment] of segmentRanges.entries()){
          const specific=segment.rangeA!=='auto'?Number(segment.rangeA):null;
          if(specific!=null)ensureRange(specific,role+' 第 '+(i+1)+' 段电流档位');
          const range=specific ?? (rangeMode==='fixed'?Number(rangeA):null);
          const limit=complianceMode==='custom'?complianceA:(range??complianceA);
          const checked=caps.getSourceLimits(slot,voltageMax,limit);
          if(range){
            const fraction=caps.DATABASE.modules[checked.moduleType].electrical.complianceMinFractionOfRange;
            const factor=caps.DATABASE.modules[checked.moduleType].electrical.rangeOverrangeFactor;
            if(limit<range*fraction-1e-15||limit>range*factor+1e-15)
              throw Error(role+' 第 '+(i+1)+' 段电流保护值 '+formatCurrentRange(limit)+
                ' A 与固定档位 '+formatCurrentRange(range)+' A 不匹配');
          }
        }
        limitsByRole[role]=Object.freeze({known:true,moduleType:lim.moduleType,
          maxComplianceA:lim.maxComplianceA,minComplianceA:lim.minComplianceA,
          currentRangesA:[...supported]});
      }else limitsByRole[role]=Object.freeze({known:false});
    }
    const roles=DC_ROLES.filter(role=>!['None','GNDU'].includes(terminalChannels[role]));
    const powerBudget=caps?.calculateChassisPower?.({
      inventory,activeSmuChannels:roles.map(role=>slotForRole[role]).filter(Boolean)
        .map(slot=>({channel:slot.channel,family:slot.family}))
    }) || {known:false,reason:'未识别物理模块'};
    if(powerBudget.known&&!powerBudget.withinLimit)
      throw Error('4200A 机箱功耗超过原厂 500 W 额定值');
    const allVerified=configured&&roles.length>0&&roles.every(role=>limitsByRole[role]?.known===true);
    return Object.freeze({
      schema:'dkts.sweep-program.v1',kind,terminals:terminalChannels,
      fixedVoltages,portSettings,xSweep:x,pSweep:p,loops,totalPoints,
      hardwareCapabilityStatus:!configured?'not-inspected':allVerified?'identified':'unresolved',
      limitsByRole,powerBudget,hardwareVerified:false,executable:false,
      provenance:'user-configured-plan',
      note:'Xsweep 是内层扫描。每个 Psweep 点执行 Xsweep 指定的重复次数；未经硬件执行器校验，禁止输出。'
    });
  }
  function previewSweepProgram(input,limit=300,hardware={}){
    const plan=normalizeSweepProgram(input,hardware);
    const x=plan.xSweep,p=plan.pSweep;
    const firstPoints=[];
    const max=Math.min(plan.totalPoints,Math.max(1,Math.trunc(limit)));
    const inner=x.points*x.repeats;
    const pPoints=p?p.points:1;
    for(let i=0;i<max;i++){
      const fullCycle=Math.floor(i/(inner*pPoints*(p?p.repeats:1)))+1;
      const pOffset=Math.floor(i/inner)%(pPoints*(p?p.repeats:1));
      const pPoint=p?pOffset%pPoints:0;
      const xOffset=i%x.points;
      const xp=pointOnAxis(x,xOffset);
      const pp=p?pointOnAxis(p,pPoint):null;
      const voltageByRole={...plan.fixedVoltages,
        [x.terminal]:xp.voltageV};
      if(p)voltageByRole[p.terminal]=pp.voltageV;
      firstPoints.push(Object.freeze({cycle:fullCycle,pPoint:pPoint+1,
        xRepeat:Math.floor(i/x.points)%x.repeats+1,
        xSegment:xp.segmentIndex,pSegment:pp?.segmentIndex||null,
        point:xOffset+1,setVoltageV:xp.voltageV,
        xVoltageV:xp.voltageV,pVoltageV:pp?.voltageV??null,
        sourceVoltageV:voltageByRole.source,drainVoltageV:voltageByRole.drain,
        gateVoltageV:voltageByRole.gate,
        currentRangeA:xp.rangeA,plannedPointDelayMs:xp.delayMs,
        pPointDelayMs:pp?.delayMs??null}));
    }
    return {plan,firstPoints,truncated:plan.totalPoints>max};
  }

  function createExecutionCoordinator() {
    let current = null;
    function status() { return Object.freeze({ running: current !== null, kind: current?.kind || null }); }
    function begin(kind) {
      const name = String(kind || '').trim();
      if (!name) throw Error('测试类型不能为空');
      if (current) throw Error('测试 ' + current.kind + ' 正在运行，不允许同时执行两项测试');
      const token = Symbol(name); current = { kind: name, token }; let finished = false;
      return Object.freeze({ kind: name, end() { if (finished) return false; finished = true; if (current?.token !== token) return false; current = null; return true; } });
    }
    async function run(kind, task) {
      if (typeof task !== 'function') throw Error('必须提供测试执行函数');
      const lease = begin(kind);
      try { return await task(); } finally { lease.end(); }
    }
    return Object.freeze({ status, begin, run });
  }
  const api = Object.freeze({ normalizePlan, previewPlan, normalizeSweepProgram, previewSweepProgram, formatCurrentRange, detectedSmUClass, createExecutionCoordinator });
  if (typeof window !== 'undefined' && window.DKDSPluginModules) window.DKDSPluginModules.define('com.dkds.keithley-4200', 'dkts-plan', api);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();