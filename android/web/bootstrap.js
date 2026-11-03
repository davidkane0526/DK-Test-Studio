(() => {
  'use strict';
  const modules=new Map();
  window.DKDSPluginModules=Object.freeze({
    define(owner,name,api){
      if(owner!=='com.dkds.keithley-4200'||modules.has(name))
        throw Error('Untrusted or repeated shared module '+name);
      modules.set(name,api);
    },
    require(name){
      if(!modules.has(name))throw Error('DKTS shared module unavailable: '+name);
      return modules.get(name);
    }
  });
})();
