#!/usr/bin/env node
'use strict';
/*
 * Assemble DKTS from DKDS source in a NEW directory. This does not modify
 * upstream DKDS. Stage-only: not an approved installable binary yet.
 */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {verify}=require('./dkds-host-profile.cjs');
const {verifyUpdaterParity}=require('./verify-dkds-updater-parity.cjs');
const {buildIdentity}=require('./core-build-identity.cjs');
function stage(source,target,{dktsRoot=path.resolve(__dirname,'..'),validateUpdater=verifyUpdaterParity,patchUpdaters=true}={}){
 const upstream=path.resolve(source),output=path.resolve(target);
 if(output===upstream||output.startsWith(upstream+path.sep)||
     upstream.startsWith(output+path.sep))throw Error('Unsafe overlapping staging directories');
 const profile=verify(upstream);
 const updaterSafety=validateUpdater(upstream);
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
 const identity=buildIdentity();
 pkg.name='dk-test-studio-host';pkg.productName='DK Test Studio';
 // Preview is a separate app identity: never overwrite the installed stable
 // studio.dk.test package before real-host visual and update validation.
 const previewId='studio.dk.test.corepreview';
 pkg.version=dktsPackage.version;pkg.dktsBuildId=identity.buildId;
 if(pkg.build&&typeof pkg.build==='object'){
  pkg.build.productName='DK Test Studio';
  pkg.build.appId=previewId;
  pkg.build.productName='DK Test Studio Core Preview';
  pkg.build.win={...(pkg.build.win||{}),
   icon:'assets/dkds-icon.ico',executableName:'DK Test Studio Core Preview'};
  pkg.build.portable={...(pkg.build.portable||{}),
   artifactName:'DKTS-Core-Preview-Windows-V'+dktsPackage.version+'-'+identity.buildId+'.${ext}'};
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
   mobile.expo.android.versionCode=identity.versionCode;
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
 // On first launch, DKTS should open its 4200A testing workspace, not Data
 // Center. Existing explicit SUPER preferences still override this default.
 replaceExact('src/core/plugins/kernel/modules/workspace/top.js',
  "const selected=String(saved||preferredId||defaultSuperCandidate()||'').trim();",
  "const selected=String(saved||preferredId||'com.dkts.keithley-4200'||defaultSuperCandidate()||'').trim();");
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
 fs.mkdirSync(path.join(tmp,'tools'),{recursive:true});
 fs.copyFileSync(path.join(dktsRoot,'tools/generate-app-icons.cjs'),
  path.join(tmp,'tools/dkts-icon-generator.cjs'));
 fs.copyFileSync(path.join(dktsRoot,'tools/dkts-core-brand.cjs'),
  path.join(tmp,'tools/dkts-core-brand.cjs'));
 const upstreamBrand=path.join(tmp,'scripts/generate-brand-assets.js');
 fs.appendFileSync(upstreamBrand,
  "\nrequire('../tools/dkts-core-brand.cjs').applyBrand(require('node:path').resolve(__dirname,'..'));\n");
 if(patchUpdaters){
 // Route both the API manifest and asset URL validation to the DKTS preview release.
 replaceExact('src/app/modules/floating-docks.js',
  "if(el)el.textContent=(label[state]||state)+(result.version?' · V'+result.version:'')+",
  "if(el)el.textContent=(label[state]||state)+(result.version?' · V'+result.version:'')+(result.buildId?' '+result.buildId:'')+");
 replaceExact('desktop/native-update.js',
  "const expected='https://github.com/davidkane0526/DK-Data-Studio/releases/download/'+release.tag_name+'/';",
  "const expected='https://github.com/davidkane0526/DK-Test-Studio/releases/download/'+release.tag_name+'/';");
 replaceExact('desktop/native-update.js',
  "const RELEASES='https://api.github.com/repos/davidkane0526/DK-Data-Studio/releases?per_page=100';",
  "const RELEASES='https://api.github.com/repos/davidkane0526/DK-Test-Studio/releases?per_page=100';");
 replaceExact('desktop/native-update.js',
  "const PREVIEW=/^dkds-windows-v(\\d+\\.\\d+\\.\\d+)-(a\\d{4,})$/;",
  "const PREVIEW=/^dkts-core-preview-v(\\d+\\.\\d+\\.\\d+)-(a\\d+)$/;");
 replaceExact('desktop/native-update.js',
  "const PORTABLE=/^DK-Data-Studio-Portable-(\\d+\\.\\d+\\.\\d+)-(a\\d{4,})-x64\\.exe$/;",
  "const PORTABLE=/^DKTS-Core-Preview-Windows-V(\\d+\\.\\d+\\.\\d+)-(a\\d+)\\.exe$/;");
 // The native package updater compares the full V/a identity, not semver alone.
 replaceExact('desktop/native-update.js',
  "const x=/^a(\\d{4,})$/.exec(String(a||'')),y=/^a(\\d{4,})$/.exec(String(b||''));",
  "const x=/^a(\\d+)$/.exec(String(a||'')),y=/^a(\\d+)$/.exec(String(b||''));");
 replaceExact('desktop/native-update.js',
  'function pickRelease(releases,currentVersion){',
  "function pickRelease(releases,currentVersion,currentBuildId='a0'){");
 replaceExact('desktop/native-update.js',
  'const releaseVersion=releaseMatch[1],releaseBuildId=releaseMatch[2];',
  'const releaseVersion=releaseMatch[1],releaseBuildId=releaseMatch[2];\n    const expectedVersionCode=100000+Number(releaseBuildId.slice(1));\n    const releaseNotes=String(release.body||\'\');\n    if(!releaseNotes.includes(\'Build identity: \'+releaseBuildId)||!releaseNotes.includes(\'Android versionCode: \'+expectedVersionCode))continue;');
 replaceExact('desktop/native-update.js',
  'if(!match||match[1]!==releaseVersion||match[2]!==releaseBuildId||!newer(releaseVersion,currentVersion))continue;',
  'if(!match||match[1]!==releaseVersion||match[2]!==releaseBuildId||(!newer(releaseVersion,currentVersion)&&!(releaseVersion===currentVersion&&compareBuildIds(releaseBuildId,currentBuildId)>0)))continue;');
 replaceExact('desktop/native-update.js',
  "function createPortableUpdater({app,userData,scriptPath,currentVersion,portablePath=process.env.PORTABLE_EXECUTABLE_FILE||''}){",
  "function createPortableUpdater({app,userData,scriptPath,currentVersion,currentBuildId='a0',portablePath=process.env.PORTABLE_EXECUTABLE_FILE||''}){");
 replaceExact('desktop/native-update.js',
  'const status=()=>({status:state,version:candidate?.version||currentVersion,error,progress,',
  'const status=()=>({status:state,version:candidate?.version||currentVersion,buildId:candidate?.buildId||currentBuildId,installedVersion:currentVersion,installedBuildId:currentBuildId,error,progress,');
 replaceExact('desktop/native-update.js',
  'const next=pickRelease(releases,currentVersion);',
  'const next=pickRelease(releases,currentVersion,currentBuildId);');
 replaceExact('desktop/native-update.js',
  "state=file&&file.version===next.version&&file.digest===next.digest?'ready':'available';",
  "state=file&&file.version===next.version&&file.buildId===next.buildId&&file.digest===next.digest?'ready':'available';");
 replaceExact('desktop/native-update.js',
  "if(!newer(candidate.version,currentVersion))throw Error('更新版本必须高于本地版本');",
  "if(!newer(candidate.version,currentVersion)&&!(candidate.version===currentVersion&&compareBuildIds(candidate.buildId,currentBuildId)>0))throw Error('更新版本必须高于本地版本');");
 replaceExact('desktop/native-update.js',
  "staged=path.join(folder,'DKDS-portable-'+candidate.version+'.exe');",
  "staged=path.join(folder,'DKTS-portable-'+candidate.version+'-'+candidate.buildId+'.exe');");
 replaceExact('desktop/native-update.js',
  'const downloadNeeded=file?.version!==candidate.version||',
  'const downloadNeeded=file?.version!==candidate.version||file?.buildId!==candidate.buildId||');
 replaceExact('desktop/native-update.js',
  'file={version:candidate.version,digest:candidate.digest};',
  'file={version:candidate.version,buildId:candidate.buildId,digest:candidate.digest};');
 replaceExact('desktop/main-modules/online-update-ipc.js',
  "const userData=app.getPath('userData'),currentVersion=app.getVersion();",
  "const userData=app.getPath('userData'),currentVersion=app.getVersion(),currentBuildId=require('../../package.json').dktsBuildId||'a0';");
 replaceExact('desktop/main-modules/online-update-ipc.js',
  "scriptPath:path.join(__dirname,'../apply-portable-update.ps1'),currentVersion});",
  "scriptPath:path.join(__dirname,'../apply-portable-update.ps1'),currentVersion,currentBuildId});");
 replaceExact('desktop/main-modules/online-update-ipc.js',
  'const hot=createUiHotUpdater({userData,currentVersion});',
  'const hot=createUiHotUpdater({userData,currentVersion,currentBuildId});');
 // The preview updater accepts only DKTS Core Preview V/a assets. Android still
 // requires the exact preview package ID and installed signing certificate.
 replaceExact('desktop/ui-hot-update.js',
  "const REPO='davidkane0526/DK-Data-Studio';",
  "const REPO='davidkane0526/DK-Test-Studio';");
 replaceExact('desktop/ui-hot-update.js',
  "const FILES=Object.freeze(['src/styles/structure/connectivity-panels.css',\n  'src/styles/platform/native-client-shell.css','src/styles/theme/component-appearance.css']);",
  "const FILES=Object.freeze(['src/styles/structure/connectivity-panels.css',\n  'src/styles/platform/native-client-shell.css','src/styles/theme/component-appearance.css','src/plugins/dkts-4200a/ui-shell.css']);");
 replaceExact('desktop/ui-hot-update.js',
  'const buildIdPattern=/^a\\d{4,}$/;',
  'const buildIdPattern=/^a\\d+$/;');
 replaceExact('desktop/ui-hot-update.js',
  'const releasePattern=/^dkds-(?:ui|android)-v(\\d+\\.\\d+\\.\\d+)-(a\\d{4,})$/;',
  'const releasePattern=/^dkts-ui-v(\\d+\\.\\d+\\.\\d+)-(a\\d+)$/;');
 replaceExact('desktop/ui-hot-update.js',
  'function createUiHotUpdater({userData,currentVersion}){',
  "function createUiHotUpdater({userData,currentVersion,currentBuildId='a0'}){");
 replaceExact('desktop/ui-hot-update.js',
  "let status='idle',error='',appVersion=currentVersion,buildId='a0000',tag='',css='',busy=null;",
  "let status='idle',error='',appVersion=currentVersion,buildId=currentBuildId,tag='',css='',busy=null;");
 replaceExact('desktop/ui-hot-update.js',
  "const value=valid(row.bundle,currentVersion);",
  "const value=valid(row.bundle,currentVersion);\n    if(compareUiIdentities({appVersion:row.bundle.appVersion,buildId:row.bundle.buildId},{appVersion:currentVersion,buildId:currentBuildId})<0)throw Error('Cached UI is older than the installed app');");
 replaceExact('desktop/ui-hot-update.js',
  "catch{css='';tag='';appVersion=currentVersion;buildId='a0000';}",
  "catch{css='';tag='';appVersion=currentVersion;buildId=currentBuildId;}");
 replaceExact('tools/updates/build-ui-hot-bundle.js',
  "if(!/^a\\d{4,}$/.test(buildId))",
  "if(!/^a\\d+$/.test(buildId))");
 replaceExact('tools/updates/build-ui-hot-bundle.js',
  "  'src/styles/platform/native-client-shell.css',\n  'src/styles/theme/component-appearance.css'",
  "  'src/styles/platform/native-client-shell.css',\n  'src/styles/theme/component-appearance.css',\n  'src/plugins/dkts-4200a/ui-shell.css'");
 replaceExact('tools/updates/build-ui-hot-bundle.js',
  "repository:'davidkane0526/DK-Data-Studio'",
  "repository:'davidkane0526/DK-Test-Studio'");
 replaceExact('mobile/plugins/DkdsAppUpdate.template',
  'private static final String REPO = "davidkane0526/DK-Data-Studio";',
  'private static final String REPO = "davidkane0526/DK-Test-Studio";');
 replaceExact('mobile/plugins/DkdsAppUpdate.template',
  'private static final String APK_ASSET = "DK-Data-Studio-arm64-v8a-release.apk";',
  'private static final Pattern APK_ASSET = Pattern.compile("DKTS-Core-Preview-Android-FIXED-SIGNED-V(\\\\d+\\\\.\\\\d+\\\\.\\\\d+)-(a\\\\d+)\\\\.apk");');
 replaceExact('mobile/plugins/DkdsAppUpdate.template',
  'Pattern.compile("dkds-android-v(\\\\d+\\\\.\\\\d+\\\\.\\\\d+)-(a\\\\d{4,})")',
  'Pattern.compile("^dkts-core-preview-v(\\\\d+\\\\.\\\\d+\\\\.\\\\d+)-(a\\\\d+)$")');
  replaceExact('mobile/plugins/DkdsAppUpdate.template',
   'if(row.optBoolean("draft",false)||!tagMatcher.matches())continue;',
   'if(row.optBoolean("draft",false)||!tagMatcher.matches())continue;\n            long expectedVersionCode=100000L+Long.parseLong(tagMatcher.group(2).substring(1));\n            String releaseNotes=row.optString("body","");\n            if(!releaseNotes.contains("Build identity: "+tagMatcher.group(2))||!releaseNotes.contains("Android versionCode: "+expectedVersionCode))continue;');
  replaceExact('mobile/plugins/DkdsAppUpdate.template',
   'if(APK_ASSET.equals(item.optString("name")))apk=item;',
   'Matcher asset=APK_ASSET.matcher(item.optString("name"));if(asset.matches()&&releaseVersion.equals(asset.group(1))&&releaseBuildId.equals(asset.group(2)))apk=item;');
  replaceExact('mobile/plugins/DkdsAppUpdate.template',
   'JSONObject status() throws org.json.JSONException {',
   'private String installedBuildId(){\n        try{int code=activity.getPackageManager().getPackageInfo(activity.getPackageName(),0).versionCode;return code>=100000?"a"+(code-100000):"a0";}\n        catch(Exception ignored){return "a0";}\n    }\n    JSONObject status() throws org.json.JSONException {');
  replaceExact('mobile/plugins/DkdsAppUpdate.template',
   'return new JSONObject().put("status",state).put("version",version)',
   'return new JSONObject().put("status",state).put("version",version).put("buildId",candidate==null?installedBuildId():candidate.buildId).put("installedBuildId",installedBuildId())');
  replaceExact('mobile/plugins/DkdsAppUpdate.template',
   'if(found==null||compareVersions(found.version,installed)<=0){',
   'int versionOrder=found==null?-1:compareVersions(found.version,installed);\n                if(found==null||versionOrder<0||(versionOrder==0&&compareBuildIds(found.buildId,installedBuildId())<=0)){');
  replaceExact('mobile/plugins/DkdsAppUpdate.template',
   'if(candidate==null||!candidate.version.equals(found.version)||',
   'if(candidate==null||!candidate.version.equals(found.version)||!candidate.buildId.equals(found.buildId)||');
  replaceExact('mobile/plugins/DkdsAppUpdate.template',
   'try{verifyDownloaded(apk,selected);validateApk(apk,selected.version);}',
   'try{verifyDownloaded(apk,selected);validateApk(apk,selected.version,selected.buildId);}');
  replaceExact('mobile/plugins/DkdsAppUpdate.template',
   'validateApk(apk,selected.version);',
   'validateApk(apk,selected.version,selected.buildId);');
  replaceExact('mobile/plugins/DkdsAppUpdate.template',
   'File destination=new File(folder,"verified-update.apk");',
   'File destination=new File(folder,"DKTS-"+selected.version+"-"+selected.buildId+".apk");');
  replaceExact('mobile/plugins/DkdsAppUpdate.template',
   'File temp=new File(folder,"download.tmp");',
   'File temp=new File(folder,"download-"+selected.version+"-"+selected.buildId+".tmp");');
  replaceExact('mobile/plugins/DkdsAppUpdate.template',
   'private void validateApk(File apk,String expectedVersion)throws Exception{',
   'private void validateApk(File apk,String expectedVersion,String expectedBuildId)throws Exception{');
  replaceExact('mobile/plugins/DkdsAppUpdate.template',
   '||!expectedVersion.equals(archive.versionName))',
   '||!expectedVersion.equals(archive.versionName)||archive.versionCode!=100000+Integer.parseInt(expectedBuildId.substring(1)))');
 replaceExact('mobile/plugins/DkdsUiHotUpdate.template',
  'private static final String REPO="davidkane0526/DK-Data-Studio";',
  'private static final String REPO="davidkane0526/DK-Test-Studio";');
   replaceExact('mobile/plugins/DkdsUiHotUpdate.template',
   'private static final Pattern TAG=Pattern.compile("dkds-(?:ui|android)-v(\\\\d+\\\\.\\\\d+\\\\.\\\\d+)-[0-9]+");',
   'private static final Pattern TAG=Pattern.compile("^dkts-ui-v(\\\\d+\\\\.\\\\d+\\\\.\\\\d+)-(a\\\\d+)$");');
  replaceExact('mobile/plugins/DkdsUiHotUpdate.template',
   'private static final String[] FILES={"src/styles/structure/connectivity-panels.css",\n    "src/styles/platform/native-client-shell.css","src/styles/theme/component-appearance.css"};',
   'private static final String[] FILES={"src/styles/structure/connectivity-panels.css",\n    "src/styles/platform/native-client-shell.css","src/styles/theme/component-appearance.css","src/plugins/dkts-4200a/ui-shell.css"};');
  replaceExact('mobile/plugins/DkdsUiHotUpdate.template',
   'private volatile String status="idle",version="",tag="",error="",css="";',
   'private volatile String status="idle",version="",buildId="a0",tag="",error="",css="";');
  replaceExact('mobile/plugins/DkdsUiHotUpdate.template',
   'try{JSONObject data=readBundle(active);css=validate(data);tag=data.optString("_tag");version=data.optString("version");}',
   'try{JSONObject data=readBundle(active);css=validate(data);tag=data.optString("_tag");version=data.optString("appVersion");buildId=data.optString("buildId","a0");}');
  replaceExact('mobile/plugins/DkdsUiHotUpdate.template',
   'try{JSONObject data=readBundle(backup);css=validate(data);tag=data.optString("_tag");version=data.optString("version");',
   'try{JSONObject data=readBundle(backup);css=validate(data);tag=data.optString("_tag");version=data.optString("appVersion");buildId=data.optString("buildId","a0");');
  replaceExact('mobile/plugins/DkdsUiHotUpdate.template',
   'catch(Exception ignored){css="";tag="";version="";}',
   'catch(Exception ignored){css="";tag="";version="";buildId="a0";}');
  replaceExact('mobile/plugins/DkdsUiHotUpdate.template',
   '    }\n  }\n  private static void copy(File a,File b)throws Exception{',
   '    }\n    try{String installed=installedBuildId();if(DkdsAppUpdateManager.compareBuildIds(buildId,installed)<0){css="";tag="";version="";buildId=installed;}}catch(Exception ignored){}\n  }\n  private static void copy(File a,File b)throws Exception{');
  replaceExact('mobile/plugins/DkdsUiHotUpdate.template',
   '  private String installedVersion()throws Exception{',
   '  private String installedBuildId()throws Exception{int code=activity.getPackageManager().getPackageInfo(activity.getPackageName(),0).versionCode;return code>=100000?"a"+(code-100000):"a0";}\n  private String installedVersion()throws Exception{');
  replaceExact('mobile/plugins/DkdsUiHotUpdate.template',
   'return candidate[0].equals(current[0])&&candidate[1].equals(current[1]);',
   'return available.equals(installed);');
  replaceExact('mobile/plugins/DkdsUiHotUpdate.template',
   'if(!"dkds-ui-v1".equals(doc.optString("schema"))||!REPO.equals(doc.optString("repository")))',
   'if(!"dkds-ui-v2".equals(doc.optString("schema"))||!REPO.equals(doc.optString("repository")))');
  replaceExact('mobile/plugins/DkdsUiHotUpdate.template',
   'String ver=doc.optString("version");',
   'String ver=doc.optString("appVersion");');
  replaceExact('mobile/plugins/DkdsUiHotUpdate.template',
   'JSONObject files=doc.getJSONObject("files");',
   'if(!doc.optString("buildId").matches("a\\\\d+"))throw new SecurityException("Invalid UI build identity");\n    JSONObject files=doc.getJSONObject("files");');
  replaceExact('mobile/plugins/DkdsUiHotUpdate.template',
   'return new JSONObject().put("status",status).put("version",version).put("tag",tag).put("error",error).put("applied",!css.isEmpty());',
   'return new JSONObject().put("status",status).put("appVersion",version).put("version",version).put("buildId",buildId).put("tag",tag).put("error",error).put("applied",!css.isEmpty());');
  replaceExact('mobile/plugins/DkdsUiHotUpdate.template',
   'JSONObject chosen=null,asset=null;String latestTag="",latestVersion="";long latestRun=-1;',
   'JSONObject chosen=null,asset=null;String latestTag="",latestVersion="",latestBuildId="";long latestRun=-1;');
  replaceExact('mobile/plugins/DkdsUiHotUpdate.template',
   'String tagVersion=matcher.group(1);',
   'String tagVersion=matcher.group(1),tagBuildId=matcher.group(2);');
  replaceExact('mobile/plugins/DkdsUiHotUpdate.template',
   'long run=Long.parseLong(row.getString("tag_name").substring(row.getString("tag_name").lastIndexOf(\'-\')+1));',
   'long run=Long.parseLong(tagBuildId.substring(1));');
  replaceExact('mobile/plugins/DkdsUiHotUpdate.template',
   'chosen=row;asset=target;latestTag=row.getString("tag_name");latestVersion=tagVersion;latestRun=run;',
   'chosen=row;asset=target;latestTag=row.getString("tag_name");latestVersion=tagVersion;latestBuildId=tagBuildId;latestRun=run;');
  replaceExact('mobile/plugins/DkdsUiHotUpdate.template',
   'if(chosen==null||latestTag.equals(tag)){status="current";return;}',
   'String floor=installedBuildId();if(DkdsAppUpdateManager.compareBuildIds(buildId,floor)>0)floor=buildId;\n        if(chosen==null||DkdsAppUpdateManager.compareBuildIds(latestBuildId,floor)<=0){status="current";return;}');
  replaceExact('mobile/plugins/DkdsUiHotUpdate.template',
   'if(!latestVersion.equals(bundle.optString("version")))throw new SecurityException("UI version mismatch");',
   'if(!latestVersion.equals(bundle.optString("appVersion"))||!latestBuildId.equals(bundle.optString("buildId")))throw new SecurityException("UI version/build identity mismatch");');
  replaceExact('mobile/plugins/DkdsUiHotUpdate.template',
   'css=nextCss;tag=latestTag;version=latestVersion;status="updated";',
   'css=nextCss;tag=latestTag;version=latestVersion;buildId=latestBuildId;status="updated";');
 }
const sourceHash=crypto.createHash('sha256')
  .update(fs.readFileSync(path.join(upstream,'package.json'))).digest('hex');
 const staging={...profile,updaterSafety,upstream:{...profile.upstream,packageSha256:sourceHash},
  dktsVersion:dktsPackage.version,buildId:identity.buildId,androidVersionCode:identity.versionCode,derivedDistribution:true,
  instrumentPlugin:'src/plugins/dkts-4200a (DKTS build only; absent upstream)',
  previewAppId:previewId,hostRenderer:'src/index.html',
  previewOnly:true,outputReady:false,
  updaterOrigin:'davidkane0526/DK-Test-Studio (read-only preview; no production installation)',
  blockingGates:['End-to-end Core UI/native updater, cache verification and rollback tests on both platforms',
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
module.exports={stage,buildIdentity};
