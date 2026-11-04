(() => {
  'use strict';
  // Portable, host-neutral interchange for test plans. No network or hardware side effects.
  const SCHEMA='dkts.4200.interop.v1';
  const PLUGIN_ID='com.dkds.keithley-4200';
  const LEGACY_PLUGIN_ID='com.dkds.keithley-4200';
  function createPlanEnvelope(plan,planApi){
    if(!planApi||typeof planApi.normalizePlan!=='function')throw Error('缺少共享测试规划模块');
    const normalized=planApi.normalizePlan(plan);
    return Object.freeze({
      schema:SCHEMA,kind:'test-plan',producer:'DK Test Studio',
      instrument:'Keithley 4200A-SCS',pluginId:PLUGIN_ID,
      plan:Object.freeze({...normalized,executable:false,hardwareVerified:false})
    });
  }
  function readPlanEnvelope(envelope,planApi){
    if(!envelope||typeof envelope!=='object'||Array.isArray(envelope)||
      envelope.schema!==SCHEMA||envelope.kind!=='test-plan'||![PLUGIN_ID,LEGACY_PLUGIN_ID].includes(envelope.pluginId))
      throw Error('不支持的 DK Test Studio 测试方案格式');
    if(!envelope.plan||envelope.plan.executable!==false||envelope.plan.hardwareVerified!==false)
      throw Error('此方案包含未获验证的硬件执行声明');
    return planApi.normalizePlan(envelope.plan);
  }
  const api=Object.freeze({SCHEMA,PLUGIN_ID,LEGACY_PLUGIN_ID,createPlanEnvelope,readPlanEnvelope});
  if(typeof window!=='undefined'&&window.DKDSPluginModules)
    window.DKDSPluginModules.define(PLUGIN_ID,'dkts-interop',api);
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})();
