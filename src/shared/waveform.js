(() => {
  'use strict';
  // This is a NON-EXECUTABLE arbitrary-waveform planning model.
  // Values are planning bounds, NOT verified Keithley 4200A module electrical limits.
  function validateWaveform(points,options={}){
    if(!Array.isArray(points)||points.length<2||points.length>100000)
      throw Error('波形至少需要 2 个、最多 100000 个时间-电压点');
    const sourceType=String(options.sourceType||'smu').toLowerCase();
    if(!['smu','pmu','pgu'].includes(sourceType))throw Error('不支持的波形源类型');
    let loadOhms=null,maxCurrentA=null,maxVoltage=210;
    if(sourceType!=='smu'){
      loadOhms=Number(options.loadOhms);
      if(!Number.isFinite(loadOhms)||loadOhms<=0||loadOhms>1e9)
        throw Error('PMU/PGU 必须填写有效的 DUT 与互连总负载阻值（0 至 1 GΩ）');
      // Tektronix 4200A datasheet: the pulse output has 50 Ω source
      // impedance. Vmax = 40 * Rload / (50 + Rload); Imax = 40 / (50 + Rload).
      maxCurrentA=40/(50+loadOhms);
      maxVoltage=maxCurrentA*loadOhms;
    }
    let previous=-Infinity;
    const normalized=points.map((point,index)=>{
      if(!point||typeof point!=='object')throw Error('第 '+(index+1)+' 个采样点格式错误');
      if(point.timeS===undefined||point.voltageV===undefined||String(point.timeS).trim()===''||String(point.voltageV).trim()==='')
        throw Error('第 '+(index+1)+' 个点缺少时间或电压数值');
      const t=Number(point.timeS),v=Number(point.voltageV);
      if(!Number.isFinite(t)||t<0||t>604800)throw Error('时间必须是 0 至 604800 秒内的有限数值');
      if(!Number.isFinite(v)||Math.abs(v)>maxVoltage)throw Error('电压超出 '+sourceType.toUpperCase()+' 规划范围 ±'+maxVoltage+' V');
      if(t<=previous)throw Error('时间点必须严格递增，不允许重复');
      previous=t;
      return Object.freeze({timeS:t,voltageV:v});
    });
    let minimumStepS=Infinity,maximumStepS=0;
    for(let i=1;i<normalized.length;i++){
      const step=normalized[i].timeS-normalized[i-1].timeS;
      minimumStepS=Math.min(minimumStepS,step);
      maximumStepS=Math.max(maximumStepS,step);
    }
    return Object.freeze({
      schema:'dk-test-studio.waveform.v1',
      points:normalized,durationS:normalized.at(-1).timeS-normalized[0].timeS,
      minimumStepS,maximumStepS,sourceType,loadOhms,maxCurrentA,maxVoltageV:maxVoltage,
      executable:false,hardwareVerified:false,provenance:'user-defined-plan'
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
    return validateWaveform(points,options);
  }
  const api=Object.freeze({validateWaveform,parseWaveformText});
    if(typeof window!=='undefined' && window.DKDSPluginModules)window.DKDSPluginModules.define('com.dkds.keithley-4200','dkts-waveform',api);
    if(typeof module!=='undefined'&&module.exports)module.exports=api;
})();
