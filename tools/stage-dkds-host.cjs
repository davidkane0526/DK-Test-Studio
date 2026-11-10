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
 // Preview is a separate app identity: never overwrite the installed stable
 // studio.dk.test package before real-host visual and update validation.
 const previewId='studio.dk.test.corepreview';
 pkg.version=dktsPackage.version;
 if(pkg.build&&typeof pkg.build==='object'){
  pkg.build.productName='DK Test Studio';
  pkg.build.appId=previewId;
  pkg.build.productName='DK Test Studio Core Preview';
  pkg.build.win={...(pkg.build.win||{}),
   icon:'assets/dkds-icon.ico',executableName:'DK Test Studio Core Preview'};
  pkg.build.portable={...(pkg.build.portable||{}),
   artifactName:'DKTS-Core-Preview-'+dktsPackage.version+'-${arch}.${ext}'};
  delete pkg.build.publish; // No DKDS update origin can leak into DKTS release. 
 }
 fs.writeFileSync(pkgFile,JSON.stringify(pkg,null,2)+'\n');
 const mobileFile=path.join(tmp,'mobile/app.json');
 if(fs.existsSync(mobileFile)){
  const mobile=JSON.parse(fs.readFileSync(mobileFile,'utf8'));
  mobile.expo.name='DK Test Studio';mobile.expo.slug='dk-test-studio';
  mobile.expo.version=dktsPackage.version;
  if(mobile.expo.android){
   mobile.expo.android.package=previewId;
   mobile.expo.android.versionCode=1;
  }
  fs.writeFileSync(mobileFile,JSON.stringify(mobile,null,2)+'\n');
 }
 const mobilePkg=path.join(tmp,'mobile/package.json');
 if(fs.existsSync(mobilePkg)){
  const p=JSON.parse(fs.readFileSync(mobilePkg,'utf8'));
  p.name='dk-test-studio-mobile';p.version=dktsPackage.version;
  fs.writeFileSync(mobilePkg,JSON.stringify(p,null,2)+'\n');
 }
 // DKTS is the owning app. The FS-Pro/4200A workspace is a DKTS-owned
 // built-in ONLY in the derived DKTS copy. It is NOT installed into DKDS.
 const nativePlugin=path.join(dktsRoot,'integrations/dkds-native');
 const hostPlugin=path.join(tmp,'src/plugins/dkts-4200a');
 if(fs.existsSync(hostPlugin))throw Error('Upstream unexpectedly contains DKTS plugin');
 fs.cpSync(nativePlugin,hostPlugin,{recursive:true});
 const manifest=JSON.parse(fs.readFileSync(path.join(hostPlugin,'plugin.json'),'utf8'));
 if(manifest.id!=='com.dkts.keithley-4200')throw Error('Unexpected DKTS workspace plugin identity');
 // Keep manifest byte-compatible with its runtime-embedded declaration.
 // The upstream validator requires exact matching name/order/description.
 // Never reuse a generated catalog with removed analysis plugins.
 const generated=path.join(tmp,'src/generated/plugin-index.js');
 fs.rmSync(generated,{force:true});
 // DKDS's actual Electron boot code is the entrypoint, not a DKTS imitation.
 const replaceExact=(file,search,replace)=>{
  const target=path.join(tmp,file),value=fs.readFileSync(target,'utf8');
  if(value.split(search).length!==2)throw Error('Pinned DKDS compatibility mismatch: '+file+' / '+search.slice(0,60));
  fs.writeFileSync(target,value.replace(search,replace),'utf8');
 };
 replaceExact('desktop/main.js',"const APP_NAME = 'DK Data Studio';",
  "const APP_NAME = 'DK Test Studio Core Preview';");
 replaceExact('desktop/main.js',"const APP_ID = 'com.dk.datastudio';",
  "const APP_ID = 'studio.dk.test.corepreview';");
 const hostMain=path.join(tmp,'desktop/main.js');
 fs.appendFileSync(hostMain,"\nif(process.env.DKTS_CORE_BOOT_SMOKE==='1')require('./dkts-core-boot-smoke.cjs')({app,BrowserWindow,APP_ROOT});\n");
 fs.copyFileSync(path.join(dktsRoot,'tools/dkts-core-boot-smoke.cjs'),
  path.join(tmp,'desktop/dkts-core-boot-smoke.cjs'));
 const htmlPath=path.join(tmp,'src/index.html');
 let html=fs.readFileSync(htmlPath,'utf8');
 html=html.replaceAll('DK Data Studio','DK Test Studio')
  .replaceAll('V3.72.3','V'+dktsPackage.version)
  .replace('../assets/dkds-mark.svg','../assets/dkds-icon.png');
 fs.writeFileSync(htmlPath,html,'utf8');
 // Use DKTS's pre-existing canonical icon generator, not the upstream icon.
 fs.copyFileSync(path.join(dktsRoot,'tools/generate-app-icons.cjs'),
  path.join(tmp,'tools/dkts-icon-generator.cjs'));
 fs.copyFileSync(path.join(dktsRoot,'tools/dkts-core-brand.cjs'),
  path.join(tmp,'tools/dkts-core-brand.cjs'));
 const upstreamBrand=path.join(tmp,'scripts/generate-brand-assets.js');
 fs.appendFileSync(upstreamBrand,
  "\nrequire('../tools/dkts-core-brand.cjs').applyBrand(require('node:path').resolve(__dirname,'..'));\n");
 // Fail closed on old SDK origins. UI bundle format is not yet DKDS Core-compatible.
 replaceExact('desktop/native-update.js',
  "const RELEASES='https://api.github.com/repos/davidkane0526/DK-Data-Studio/releases?per_page=100';",
  "const RELEASES='https://api.github.com/repos/davidkane0526/DK-Test-Studio/releases?per_page=100';");
 replaceExact('desktop/native-update.js',
  "const PREVIEW=/^dkds-windows-v(\\d+\\.\\d+\\.\\d+)-(a\\d{4,})$/;",
  "const PREVIEW=/^dkts-preview-v(\\d+\\.\\d+\\.\\d+)-(a\\d+)$/;");
 replaceExact('desktop/native-update.js',
  "const PORTABLE=/^DK-Data-Studio-Portable-(\\d+\\.\\d+\\.\\d+)-(a\\d{4,})-x64\\.exe$/;",
  "const PORTABLE=/^DKTS-Core-Preview-(\\d+\\.\\d+\\.\\d+)-x64\\.exe$/;");
 // For now, no release asset targets the temporary corepreview native package,
 // so installer signature/package validation must reject stable-app binaries.
 replaceExact('desktop/ui-hot-update.js',
  "const REPO='davidkane0526/DK-Data-Studio';",
  "const REPO='davidkane0526/DK-Test-Studio';");
 replaceExact('mobile/plugins/DkdsAppUpdate.template',
  'private static final String REPO = "davidkane0526/DK-Data-Studio";',
  'private static final String REPO = "davidkane0526/DK-Test-Studio";');
 replaceExact('mobile/plugins/DkdsAppUpdate.template',
  'private static final String APK_ASSET = "DK-Data-Studio-arm64-v8a-release.apk";',
  'private static final String APK_ASSET = "DKTS-Core-Preview-Android.apk";');
 replaceExact('mobile/plugins/DkdsAppUpdate.template',
  'Pattern.compile("dkds-android-v(\\\\d+\\\\.\\\\d+\\\\.\\\\d+)-(a\\\\d{4,})")',
  'Pattern.compile("dkts-preview-v(\\\\d+\\\\.\\\\d+\\\\.\\\\d+)-(a\\\\d+)")');
 replaceExact('mobile/plugins/DkdsUiHotUpdate.template',
  'private static final String REPO="davidkane0526/DK-Data-Studio";',
  'private static final String REPO="davidkane0526/DK-Test-Studio";');
 const sourceHash=crypto.createHash('sha256')
  .update(fs.readFileSync(path.join(upstream,'package.json'))).digest('hex');
 const staging={...profile,upstream:{...profile.upstream,packageSha256:sourceHash},
  dktsVersion:dktsPackage.version,derivedDistribution:true,
  instrumentPlugin:'src/plugins/dkts-4200a (DKTS build only; absent upstream)',
  previewAppId:previewId,hostRenderer:'src/index.html',
  previewOnly:true,outputReady:false,
  updaterOrigin:'davidkane0526/DK-Test-Studio (read-only preview; no production installation)',
  blockingGates:['DKTS Core-safe UI bundle format and Android/Windows full updater',
   'FS-Pro Edit Page exact hierarchy and production 4200A controller',
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
