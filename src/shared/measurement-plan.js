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
  const api = Object.freeze({ normalizePlan, previewPlan, detectedSmUClass, createExecutionCoordinator });
  if (typeof window !== 'undefined' && window.DKDSPluginModules) window.DKDSPluginModules.define('com.dkds.keithley-4200', 'dkts-plan', api);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();