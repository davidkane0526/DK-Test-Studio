(() => {
  'use strict';
  const safety=typeof window!=='undefined'&&window.DKTS4200ASafetyPolicy
    ?window.DKTS4200ASafetyPolicy:typeof module!=='undefined'&&module.exports
      ?require('./4200a-safety-policy.js'):null;
  if(!safety)throw Error('缺少 4200A 安全策略模块');
  function validateWaveform(points,options={},hardware=options.hardware||{}){
    const sourceType=String(options.sourceType||'smu').toLowerCase();
    let result;
    if(sourceType==='smu')result=safety.validateSmuWaveform(points,options,hardware);
    else if(sourceType==='pmu'||sourceType==='pgu')
      result=safety.validatePulseWaveform(points,options,hardware);
    else throw Error('不支持的波形源类型');
    return Object.freeze({
      schema:'dk-test-studio.waveform.v2',
      ...result,
      durationS:result.durationS,
      minimumStepS:result.minimumStepS,
      maximumStepS:result.maximumStepS,
      maxCurrentA:result.effectiveCurrentLimitA??result.maxCurrentA,
      maxVoltageV:result.maxVoltageV,
      executable:false,hardwareVerified:false,
      provenance:'user-defined-plan'
    });
  }
  function parseWaveformText(text,options={}){
    const lines=String(text||'').split(/\r?\n/).filter(line=>line.trim()&&!line.trim().startsWith('#'));
    const points=lines.map((line,i)=>{
      const parts=line.trim().split(/[\s,;\t]+/);
      if(parts.length!==2)throw Error('第 '+(i+1)+' 行需要两列：时间(s) 电压(V)');
      if(parts.some(p=>p===''))throw Error('波形数值不能为空');
      return {timeS:parts[0],voltageV:parts[1]};
    });
    return validateWaveform(points,options,options.hardware||{});
  }
  const api=Object.freeze({validateWaveform,parseWaveformText});
  if(typeof window!=='undefined'&&window.DKDSPluginModules)
    window.DKDSPluginModules.define('com.dkds.keithley-4200','dkts-waveform',api);
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})();
