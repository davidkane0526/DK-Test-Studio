#!/usr/bin/env node
'use strict';
/*
 * Assemble DKTS from DKDS source in a NEW directory. This does not modify
 * upstream DKDS. Stage-only: not an approved installable binary yet.
 */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {verify}=require('./dkds-host-profile.cjs');
function stage(source,target,{dktsRoot=path.resolve(__dirname,'..')}={}){
 const upstream=path.resolve(source),output=path.resolve(target);
 if(output===upstream||output.startsWith(upstream+path.sep)||
     upstream.startsWith(output+path.sep))throw Error('Unsafe overlapping staging directories');
 const profile=verify(upstream);
 const tmp=output+'.staging';
 if(fs.existsSync(tmp))fs.rmSync(tmp,{recursive:true,force:true});
 const ignored=new Set(['.git','node_modules','dist','.expo','.gradle',
  '.cache','coverage','build']);
 fs.cpSync(upstream,tmp,{recursive:true,filter:src=>{
  const relative=path.relative(upstream,src);
  if(!relative||relative==='.')return true;
  return !relative.split(path.sep).some(x=>ignored.has(x));
 }});
 // Analysis is excluded in DKTS' copy only. The upstream filesystem is
 // never written to. Retain scientific Core and Data Center infrastructure.
 for(const p of profile.excluded){
  fs.rmSync(path.join(tmp,'src','plugins',p.directory),{recursive:true,force:true});
 }
 const pkgFile=path.join(tmp,'package.json'),pkg=JSON.parse(fs.readFileSync(pkgFile,'utf8'));
 const dktsPackage=JSON.parse(fs.readFileSync(path.join(dktsRoot,'package.json'),'utf8'));
 pkg.name='dk-test-studio-host';pkg.productName='DK Test Studio';
 pkg.version=dktsPackage.version;
 if(pkg.build&&typeof pkg.build==='object'){
  pkg.build.productName='DK Test Studio';
  pkg.build.appId='studio.dk.test';
 }
 fs.writeFileSync(pkgFile,JSON.stringify(pkg,null,2)+'\n');
 const mobileFile=path.join(tmp,'mobile/app.json');
 if(fs.existsSync(mobileFile)){
  const mobile=JSON.parse(fs.readFileSync(mobileFile,'utf8'));
  mobile.expo.name='DK Test Studio';mobile.expo.slug='dk-test-studio';
  mobile.expo.version=dktsPackage.version;
  if(mobile.expo.android)mobile.expo.android.package='studio.dk.test';
  fs.writeFileSync(mobileFile,JSON.stringify(mobile,null,2)+'\n');
 }
 const mobilePkg=path.join(tmp,'mobile/package.json');
 if(fs.existsSync(mobilePkg)){
  const p=JSON.parse(fs.readFileSync(mobilePkg,'utf8'));
  p.name='dk-test-studio-mobile';p.version=dktsPackage.version;
  fs.writeFileSync(mobilePkg,JSON.stringify(p,null,2)+'\n');
 }
 // DKDS-generated plugin-index assets are deliberately not retained in the
 // source copy. Rebuild the catalog from the filtered src/plugins directory.
 const generated=path.join(tmp,'src/generated/plugin-index.js');
 fs.rmSync(generated,{force:true});
 const nativePlugin=path.join(dktsRoot,'integrations/dkds-native');
 const external=path.join(tmp,'dkts-external-plugins/4200A');
 fs.mkdirSync(path.dirname(external),{recursive:true});
 fs.cpSync(nativePlugin,external,{recursive:true});
 const sourceHash=crypto.createHash('sha256')
  .update(fs.readFileSync(path.join(upstream,'package.json'))).digest('hex');
 const staging={...profile,upstream:{...profile.upstream,packageSha256:sourceHash},
  dktsVersion:dktsPackage.version,derivedDistribution:true,
  instrumentPlugin:'dkts-external-plugins/4200A (not built in)',
  outputReady:false,
  blockingGates:['DKTS update origin / full-package updater wiring',
   'shared FS-Pro GUI replaces existing standalone screen',
   'real Windows/Android host rendering and measurement verification']};
 fs.writeFileSync(path.join(tmp,'DKTS_FRAMEWORK_STAGING.json'),
  JSON.stringify(staging,null,2)+'\n');
 if(fs.existsSync(output))fs.rmSync(output,{recursive:true,force:true});
 fs.renameSync(tmp,output);
 return staging;
}
if(require.main===module){
 const source=process.argv[2],target=process.argv[3];
 if(!source||!target)throw Error('Usage: node tools/stage-dkds-host.cjs <read-only-DKDS-checkout> <DKTS-staging-directory>');
 const result=stage(source,target);
 console.log('DKTS framework staging complete (NOT yet a distributable binary): '+
  JSON.stringify(result.counts));
}
module.exports={stage};
