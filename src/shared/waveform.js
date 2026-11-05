(() => {
  'use strict';
  function capabilityApi(options) {
    if (options?.capabilities) return options.capabilities;
    if (typeof window !== 'undefined' && window.DKTSHardwareCapabilities) return window.DKTSHardwareCapabilities;
    if (typeof module !== 'undefined' && typeof require === 'function') return require('./hardware-capabilities.js');
    return null;
  }
  function closeEnough(a, b) { return Math.abs(a - b) <= Math.max(1e-12, Math.abs(b) * 1e-8); }
  function validateWaveform(points, options = {}) {
    if (!Array.isArray(points) || points.length < 2 || points.length > 100000) throw Error('波形至少需要 2 个、最多 100000 个时间-电压点');
    const sourceType = String(options.sourceType || 'smu').toLowerCase();
    if (!['smu', 'pmu', 'pgu'].includes(sourceType)) throw Error('不支持的波形源类型');
    const caps = capabilityApi(options);
    if (!caps) throw Error('4200A 硬件能力数据库不可用');
    const normalized = points.map((point, index) => {
      if (!point || typeof point !== 'object') throw Error('第 ' + (index + 1) + ' 个采样点格式错误');
      if (point.timeS === undefined || point.voltageV === undefined || String(point.timeS).trim() === '' || String(point.voltageV).trim() === '') throw Error('第 ' + (index + 1) + ' 个点缺少时间或电压数值');
      const t = Number(point.timeS), v = Number(point.voltageV);
      if (!Number.isFinite(t) || t < 0 || t > 604800) throw Error('时间必须是 0 至 604800 秒内的有限数值');
      if (!Number.isFinite(v)) throw Error('电压必须是有限数值');
      if (index && t <= Number(points[index - 1].timeS)) throw Error('时间点必须严格递增，不允许重复');
      return Object.freeze({ timeS: t, voltageV: v });
    });
    let minimumStepS = Infinity, maximumStepS = 0;
    const steps = [];
    for (let i = 1; i < normalized.length; i++) { const step = normalized[i].timeS - normalized[i - 1].timeS; steps.push(step); minimumStepS = Math.min(minimumStepS, step); maximumStepS = Math.max(maximumStepS, step); }
    const durationS = normalized[normalized.length - 1].timeS - normalized[0].timeS;
    let maxVoltageV = 210, maxCurrentA = null, rangeV = null, loadOhms = null;
    let waveformMode = '', timingStatus = '', moduleDetected = false, moduleType = null;
    let powerBudget = { known: false, reason: '未计算' }, captureBudget = null, pulseCurrentRangesA = null, timingRecommendation = null, interfaceLimits = null;
    if (sourceType === 'smu') {
      const channel = Number(options.channel ?? 1);
      const slot = Array.isArray(options.inventory?.slots) ? options.inventory.slots.find(item => item?.channel === channel) || null : null;
      if (Array.isArray(options.inventory?.slots) && !slot) throw Error('SMU 通道 ' + channel + ' 不在仪器 *OPT? 模块清单中');
      if (slot && !['SMU', 'VS'].includes(slot.family)) throw Error('所选通道不是 SMU/VS 电压源');
      moduleDetected = Boolean(slot); moduleType = slot?.type || null; maxVoltageV = slot?.family === 'VS' ? 20 : 210;
      const uniform = steps.every(step => closeEnough(step, steps[0]));
      if (!uniform) throw Error('SMU KXCI 列表扫描只支持统一点间延迟；非等间隔时间-电压点请使用 PMU Segment Arb');
      if (normalized.length > 4096) throw Error('SMU KXCI 列表扫描最多 4096 个电压点');
      waveformMode = 'smu-voltage-list'; timingStatus = 'measurement-and-settling-dependent';
      if (normalized.some(point => Math.abs(point.voltageV) > maxVoltageV + 1e-12)) throw Error('电压超出 ' + (slot?.family === 'VS' ? 'VS ±20 V' : 'SMU ±210 V') + ' 规划范围');
      if (slot?.family === 'SMU') maxCurrentA = caps.getSmuLimits(slot, Math.max(...normalized.map(point => Math.abs(point.voltageV)))).maxComplianceA;
      const activeSmuChannels = [{ channel, family: slot?.family || 'SMU' }];
      if (options.measureSmU !== undefined && options.measureSmU !== null) {
        const measureChannel = Number(options.measureSmU);
        const measureSlot = Array.isArray(options.inventory?.slots) ? options.inventory.slots.find(item => item?.family === 'SMU' && item.channel === measureChannel) : null;
        if (!measureSlot) throw Error('指定的电流测量 SMU 通道未在 *OPT? 中识别');
        activeSmuChannels.push({ channel: measureChannel, family: 'SMU' });
      }
      powerBudget = caps.calculateChassisPower({ inventory: options.inventory, activeSmuChannels });
    } else {
      rangeV = Number(options.rangeV ?? 10); loadOhms = Number(options.loadOhms);
      const limits = caps.getPulseOutputLimits(sourceType, rangeV, loadOhms);
      maxVoltageV = limits.maxVoltageV; maxCurrentA = limits.maxCurrentA;
      const arb = caps.getSegmentArbLimits(sourceType, rangeV), segmentCount = normalized.length - 1;
      const kxciSegmentCompatible = steps.every(step => step >= arb.kxciMinSegmentS - 1e-15 && step <= arb.kxciMaxSegmentS + 1e-12);
      interfaceLimits = Object.freeze({ transport: 'KXCI', minSegmentTimeS: arb.kxciMinSegmentS, maxSegmentTimeS: arb.kxciMaxSegmentS, maxSegmentsPerCommand: arb.maxSegmentsPerCommand, requiresCommandChunking: segmentCount > arb.maxSegmentsPerCommand, segmentTimesCompatible: kxciSegmentCompatible, verificationStatus: arb.kxciLimitVerificationStatus, requiresAlternateBackend: !kxciSegmentCompatible });
      if (segmentCount < arb.minSegments) throw Error('4200A Segment Arb 每个序列至少需要 ' + arb.minSegments + ' 个分段');
      if (segmentCount > arb.maxSegments) throw Error('4200A Segment Arb 每通道最多支持 ' + arb.maxSegments + ' 个分段');
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        if (step < arb.minSegmentS - 1e-15 || step > arb.maxSegmentS + 1e-12) throw Error('第 ' + (i + 1) + ' 个分段时间必须在 ' + arb.minSegmentS + ' 至 ' + arb.maxSegmentS + ' 秒之间');
        const ticks = step / arb.timeResolutionS;
        if (Math.abs(ticks - Math.round(ticks)) > 1e-6) throw Error('第 ' + (i + 1) + ' 个分段时间必须符合 10 ns 时间分辨率');
      }
      if (normalized.some(point => Math.abs(point.voltageV) > maxVoltageV + 1e-12)) throw Error('电压超出 ' + sourceType.toUpperCase() + ' 在当前负载下的理论输出边界 ±' + maxVoltageV + ' V');
      waveformMode = 'segment-arb'; timingStatus = 'documented-segment-arb';
      const family = sourceType === 'pgu' ? 'PGU' : 'PMU';
      const card = Array.isArray(options.inventory?.slots) ? options.inventory.slots.find(item => item?.family === family) || null : null;
      if (Array.isArray(options.inventory?.slots) && !card) throw Error('当前 *OPT? 清单中没有已识别的 ' + (sourceType === 'pgu' ? '4220-PGU/VPU' : '4225-PMU'));
      moduleDetected = Boolean(card); moduleType = card?.type || (sourceType === 'pgu' ? 'VPU' : 'PMU');
      const cardIndex = Number(card?.channel ?? options.cardIndex ?? 1), channel = Number(options.channel ?? ((cardIndex - 1) * 2 + 1));
      const activePulseChannels = [{ family, cardIndex, channel, rangeV }];
      powerBudget = caps.calculateChassisPower({ inventory: options.inventory, activePulseChannels });
      if (powerBudget.known && !powerBudget.withinLimit) throw Error('4200A 机箱功耗预算超限：' + powerBudget.totalW + ' W > ' + powerBudget.limitW + ' W');
      const captureCurrent = options.captureCurrent === true;
      if (captureCurrent && sourceType === 'pgu') throw Error('4220-PGU/VPU 是源输出模块，不支持电流波形测量；请使用 4225-PMU');
      if (captureCurrent) {
        const rpm = Boolean(card?.rpmCount || card?.rpmChannels?.length);
        pulseCurrentRangesA = caps.getPmuCurrentRanges(rangeV, rpm);
        if (options.measurementRangeA !== undefined && options.measurementRangeA !== null && !pulseCurrentRangesA.some(value => closeEnough(value, Number(options.measurementRangeA)))) throw Error('当前 PMU/RPM 模块在所选电压档不支持该电流测量量程');
        captureBudget = caps.getPmuCaptureBudget(durationS, options.measureWindowS, options.sampleRateHz);
        if (options.measurementRangeA !== undefined && options.measurementRangeA !== null) {
          try { timingRecommendation = caps.getPulseTimingRecommendation(rangeV, options.measurementRangeA, true, 'pmu', rpm, Math.max(...normalized.map(point => Math.abs(point.voltageV)))); } catch { timingRecommendation = null; }
        }
      }
    }
    const resolvedInterfaceLimits = interfaceLimits ? Object.freeze({
      ...interfaceLimits,
      capturePointsCompatible: captureBudget?.kxciCompatible !== false,
      requiresAlternateBackend: interfaceLimits.requiresAlternateBackend || captureBudget?.kxciCompatible === false
    }) : null;
    return Object.freeze({
      schema: 'dk-test-studio.waveform.v2', points: normalized, durationS, minimumStepS, maximumStepS,
      sourceType, waveformMode, timingStatus, rangeV, loadOhms, maxCurrentA, maxVoltageV,
      moduleType, moduleDetected, powerBudget, captureBudget, pulseCurrentRangesA, timingRecommendation, interfaceLimits: resolvedInterfaceLimits,
      executionCompatibility: resolvedInterfaceLimits?.requiresAlternateBackend ? 'hardware-valid-kxci-limited' : 'hardware-plan-only',
      executable: false, hardwareVerified: false, provenance: 'user-defined-plan', capabilityDatabaseVersion: caps.DATABASE.databaseVersion
    });
  }
  function parseWaveformText(text, options = {}) {
    const lines = String(text || '').split(/\r?\n/).filter(line => line.trim() && !line.trim().startsWith('#'));
    const points = lines.map((line, i) => {
      const parts = line.trim().split(/[\s,;\t]+/);
      if (parts.length !== 2) throw Error('第 ' + (i + 1) + ' 行需要两列：时间(s) 电压(V)');
      if (parts.some(p => p === '')) throw Error('波形数值不能为空');
      return { timeS: parts[0], voltageV: parts[1] };
    });
    return validateWaveform(points, options);
  }
  const api = Object.freeze({ validateWaveform, parseWaveformText });
  if (typeof window !== 'undefined' && window.DKDSPluginModules) window.DKDSPluginModules.define('com.dkds.keithley-4200', 'dkts-waveform', api);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();