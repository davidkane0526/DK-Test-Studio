(() => {
  'use strict';
  // Derived from DK Data Studio 4200/kxci-protocol.js.
  // The ONLY instrument command in this milestone is the exact ASCII *IDN? followed by NUL.
  const IDN_REQUEST='*IDN?\0';
  function parseIdentity(input,expectedSerial=''){
    const raw=String(input||'').replace(/\0+$/g,'').trim();
    const parts=raw.split(',').map(part=>part.trim());
    if(parts[0]!=='KEITHLEY INSTRUMENTS'||parts[1]!=='KI4200A')
      throw Error('仪器身份不匹配：'+(raw||'空响应'));
    if(expectedSerial&&parts[2]!==String(expectedSerial))
      throw Error('序列号不匹配：预期 '+expectedSerial+'，实际 '+(parts[2]||'未知'));
    return Object.freeze({manufacturer:parts[0],model:parts[1],serial:parts[2]||'',version:parts[3]||'',raw});
  }
  const api=Object.freeze(Object.freeze({IDN_REQUEST,parseIdentity}));
    if(typeof window!=='undefined' && window.DKDSPluginModules)window.DKDSPluginModules.define('com.dkds.keithley-4200','dkts-kxci',api);
    if(typeof module!=='undefined'&&module.exports)module.exports=api;
})();
