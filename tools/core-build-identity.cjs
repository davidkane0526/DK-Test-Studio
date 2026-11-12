'use strict';
function buildIdentity(value=process.env.DKTS_PREVIEW_BUILD_NUMBER||process.env.DKTS_BUILD_NUMBER||process.env.GITHUB_RUN_NUMBER||''){
  const raw=String(value||'').trim();
  if(!raw)return Object.freeze({buildId:'a0',buildNumber:0,versionCode:1});
  const normalized=/^a[1-9][0-9]*$/.test(raw)?raw.slice(1):raw;
  if(!/^[1-9][0-9]{0,6}$/.test(normalized))throw Error('DKTS build identity must be a positive aNNN value');
  const buildNumber=Number(normalized),versionCode=100000+buildNumber;
  if(!Number.isSafeInteger(versionCode)||versionCode>2100000000)
    throw Error('DKTS Android versionCode outside supported range');
  return Object.freeze({buildId:'a'+buildNumber,buildNumber,versionCode});
}
function fromRunNumber(value){
  const n=Number(value);
  if(!Number.isSafeInteger(n)||n<1)throw Error('GITHUB_RUN_NUMBER must be a positive integer');
  return buildIdentity(String(n));
}
module.exports={buildIdentity,fromRunNumber};
