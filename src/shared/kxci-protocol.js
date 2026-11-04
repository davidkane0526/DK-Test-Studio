(() => {
  'use strict';
  // Derived from DK Data Studio 4200/kxci-protocol.js.
  // Read-only allowlist: *IDN? and *OPT?; no output-producing commands.
  const IDN_REQUEST='*IDN?\0';
  const OPTIONS_REQUEST='*OPT?\0';
  function parseIdentity(input,expectedSerial=''){
    const raw=String(input||'').replace(/\0+$/g,'').trim();
    const parts=raw.split(',').map(part=>part.trim());
    if(parts[0]!=='KEITHLEY INSTRUMENTS'||parts[1]!=='KI4200A')
      throw Error('仪器身份不匹配：'+(raw||'空响应'));
    if(expectedSerial&&parts[2]!==String(expectedSerial))
      throw Error('序列号不匹配：预期 '+expectedSerial+'，实际 '+(parts[2]||'未知'));
    return Object.freeze({manufacturer:parts[0],model:parts[1],serial:parts[2]||'',version:parts[3]||'',raw});
  }
  function parseOptions(value){
    // *OPT? in 4200A native KXCI mode returns up to eight slot descriptors.
    // Never infer calibrated electrical limits from this inventory.
    const raw=String(value??'').replace(/\0+$/g,'').trim();
    if(!raw||raw.length>4096)throw Error('模块配置响应为空或过长');
    const parts=raw.split(',');
    if(parts.length>8)throw Error('模块配置超过八个插槽');
    const modules=Object.freeze(parts.map((part,index)=>{
      const token=part.trim().toUpperCase();
      const simple=/^(HPSMUPA|HPSMU|SMUPA|SMU|CVU|VPU|PMU|VS|VM)([1-9])$/.exec(token);
      const type=simple?simple[1]:token.startsWith('PMU')?'PMU-variant':token===''?'empty':'unknown';
      const family=type.includes('SMU')?'SMU':type==='CVU'?'CVU':type==='VPU'?'PGU':
        type.startsWith('PMU')?'PMU':type==='VS'?'VS':type==='VM'?'VM':type;
      return Object.freeze({slot:index+1,raw:token,type,family,
        channel:simple?Number(simple[2]):null,ratingsVerified:false});
    }));
    return Object.freeze({schema:'dkts.4200.modules.v1',raw,slots:modules,
      knownModules:modules.filter(x=>x.family!=='empty'&&x.family!=='unknown'),
      unknownModules:modules.filter(x=>x.family==='unknown'),hardwareLimitsVerified:false});
  }
  const api=Object.freeze({IDN_REQUEST,OPTIONS_REQUEST,parseIdentity,parseOptions});
    if(typeof window!=='undefined' && window.DKDSPluginModules)window.DKDSPluginModules.define('com.dkts.keithley-4200','dkts-kxci',api);
    if(typeof module!=='undefined'&&module.exports)module.exports=api;
})();
