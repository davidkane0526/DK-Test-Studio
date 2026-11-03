'use strict';
// This is a NON-EXECUTABLE arbitrary-waveform planning model.
// Values are planning bounds, NOT verified Keithley 4200A module electrical limits.
function validateWaveform(points){
  if(!Array.isArray(points)||points.length<2||points.length>100000)
    throw Error('波形至少需要 2 个、最多 100000 个时间-电压点');
  let previous=-Infinity;
  const normalized=points.map((point,index)=>{
    if(!point||typeof point!=='object')throw Error('第 '+(index+1)+' 个采样点格式错误');
    const t=Number(point.timeS),v=Number(point.voltageV);
    if(!Number.isFinite(t)||t<0||t>604800)throw Error('时间必须是 0 至 604800 秒内的有限数值');
    if(!Number.isFinite(v)||Math.abs(v)>200)throw Error('电压超出规划范围 ±200 V');
    if(t<=previous)throw Error('时间点必须严格递增，不允许重复');
    previous=t;
    return Object.freeze({timeS:t,voltageV:v});
  });
  const deltas=normalized.slice(1).map((p,i)=>p.timeS-normalized[i].timeS);
  return Object.freeze({
    schema:'dk-test-studio.waveform.v1',
    points:normalized,durationS:normalized.at(-1).timeS-normalized[0].timeS,
    minimumStepS:Math.min(...deltas),maximumStepS:Math.max(...deltas),
    executable:false,hardwareVerified:false,provenance:'user-defined-plan'
  });
}
function parseWaveformText(text){
  const lines=String(text||'').split(/\r?\n/).filter(line=>line.trim()&&!line.trim().startsWith('#'));
  const points=lines.map((line,i)=>{
    const parts=line.trim().split(/[\s,;\t]+/);
    if(parts.length!==2)throw Error('第 '+(i+1)+' 行需要两列：时间(s) 电压(V)');
    if(parts.some(p=>p===''))throw Error('波形数值不能为空');
    return {timeS:parts[0],voltageV:parts[1]};
  });
  return validateWaveform(points);
}
module.exports={validateWaveform,parseWaveformText};
