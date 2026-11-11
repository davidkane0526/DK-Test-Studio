/* Pure update policy: one signed manifest and one ABI contract for both platforms.
 * No network, download, installation, signature verification or auto-update side effects.
 */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.DK4200ReleaseContract=api;
})(typeof globalThis!=='undefined'?globalThis:undefined,function(){
 'use strict';
 const HEX64=/^[a-f\d]{64}$/i,REV=/^a\d+$/,SEMVER=/^\d+\.\d+\.\d+$/;
 const nonblank=x=>typeof x==='string'&&x.trim().length>0;
 const validAsset=v=>{
  if(!v||typeof v!=='object'||Array.isArray(v))return false;
  if(!nonblank(v.url)||!v.url.startsWith('https://')||/[\s<>"']/.test(v.url))return false;
  if(!HEX64.test(v.sha256||''))return false;
  if(!Number.isSafeInteger(v.bytes)||v.bytes<=0)return false;
  if(!nonblank(v.filename)||/[\\/]/.test(v.filename))return false;
  return true;
 };
 function validateManifest(m){
  const errors=[];
  const check=(ok,code)=>{if(!ok)errors.push(code);};
  check(!!m&&typeof m==='object'&&!Array.isArray(m),'OBJECT');
  if(errors.length)return Object.freeze({ok:false,errors:Object.freeze(errors)});
  check(m.schema==='dkts.release.v1','SCHEMA');
  check(['preview','stable'].includes(m.channel),'CHANNEL');
  check(SEMVER.test(m.nativeVersion||''),'NATIVE_VERSION');
  check(REV.test(m.uiRevision||''),'UI_REVISION');
  check(Number.isSafeInteger(m.sequence)&&m.sequence>0,'SEQUENCE');
  check(Number.isSafeInteger(m.nativeAbi)&&m.nativeAbi>0,'NATIVE_ABI');
  check(HEX64.test(m.commit||'')||/^[a-f\d]{40}$/i.test(m.commit||''),'COMMIT_SHA');
  check(nonblank(m.releaseId),'RELEASE_ID');
  check(validAsset(m.assets?.ui),'UI_ASSET');
  check(validAsset(m.assets?.windows),'WINDOWS_ASSET');
  check(validAsset(m.assets?.android),'ANDROID_ASSET');
  check(m.signature?.algorithm==='ed25519'&&nonblank(m.signature?.keyId)&&nonblank(m.signature?.value),'SIGNATURE_DESCRIPTOR');
  return Object.freeze({ok:errors.length===0,errors:Object.freeze(errors)});
 }
 function canonicalManifestText(manifest){
  if(!manifest||typeof manifest!=='object'||Array.isArray(manifest))throw new TypeError('Manifest object required');
  // Canonical signing covers *all* properties except the detached signature bytes.
  // UTF-8, recursively alphabetized keys, no hidden keys or implicit URL changes.
  const sort=value=>{
   if(Array.isArray(value))return value.map(sort);
   if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(key=>[key,sort(value[key])]));
   if(value===null||typeof value==='string'||typeof value==='boolean'||Number.isFinite(value))return value;
   throw new TypeError('Unsupported manifest data type');
  };
  const unsigned={...manifest,signature:{...manifest.signature}};
  delete unsigned.signature.value;
  return JSON.stringify(sort(unsigned));
 }
 function decideUpdate(local,manifest,{signatureVerified=false,platform='windows'}={}){
  const validation=validateManifest(manifest);
  if(!validation.ok)return Object.freeze({action:'blocked',reason:'INVALID_MANIFEST',errors:validation.errors});
  if(!['windows','android'].includes(platform))return Object.freeze({action:'blocked',reason:'UNKNOWN_PLATFORM'});
  // Caller must verify Ed25519 signature using a pinned, trusted public key.
  if(signatureVerified!==true)return Object.freeze({action:'blocked',reason:'SIGNATURE_NOT_VERIFIED'});
  if(!local||!Number.isSafeInteger(local.nativeAbi)||local.nativeAbi<1||
     !Number.isSafeInteger(local.sequence)||local.sequence<0||
     !SEMVER.test(local.nativeVersion||'')||!nonblank(local.uiRevision))
    return Object.freeze({action:'blocked',reason:'INVALID_LOCAL_VERSION'});
  if(local.sequence>=manifest.sequence)return Object.freeze({action:'none',reason:'CURRENT_OR_NEWER'});
  if(local.nativeAbi>manifest.nativeAbi)return Object.freeze({action:'blocked',reason:'NATIVE_ABI_DOWNGRADE'});
  const sameNative=local.nativeVersion===manifest.nativeVersion&&local.nativeAbi===manifest.nativeAbi;
  const asset=sameNative?manifest.assets.ui:manifest.assets[platform];
  return Object.freeze({action:sameNative?'hot':'full',reason:sameNative?'UI_ONLY':'NATIVE_REQUIRED',
   url:asset.url,sha256:asset.sha256,bytes:asset.bytes,filename:asset.filename,
   target:Object.freeze({nativeVersion:manifest.nativeVersion,uiRevision:manifest.uiRevision,sequence:manifest.sequence,nativeAbi:manifest.nativeAbi})});
 }
 return Object.freeze({VERSION:'1.1.0',validateManifest,canonicalManifestText,decideUpdate});
});
