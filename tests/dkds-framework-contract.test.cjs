'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {verify}=require('../tools/dkds-host-profile.cjs');
const {stage,buildIdentity}=require('../tools/stage-dkds-host.cjs');
const repo=path.resolve(__dirname,'..');
function fixture(){
 const top=fs.mkdtempSync(path.join(os.tmpdir(),'dkts-framework-'));
 const root=path.join(top,'DKDS');
 const write=(file,data)=>{const dest=path.join(root,file);fs.mkdirSync(path.dirname(dest),{recursive:true});
  fs.writeFileSync(dest,data);};
 write('package.json',JSON.stringify({name:'dk-data-studio',version:'3.72.3',
  build:{productName:'DK Data Studio',appId:'com.dk.datastudio'}}));
 write('mobile/app.json',JSON.stringify({expo:{name:'DK Data Studio',
  slug:'dk-data-studio',version:'3.72.3',android:{package:'com.dk.datastudio'}}}));
 write('mobile/package.json',JSON.stringify({name:'dk-data-studio-mobile',version:'3.72.3'}));
 for(const f of [
  'src/index.html','src/app/placeholder.js','src/core/placeholder.js',
  'desktop/native-update.js','desktop/ui-hot-update.js','desktop/apply-portable-update.ps1',
  'mobile/plugins/DkdsLanTcp.template','mobile/plugins/DkdsAppUpdate.template',
  'mobile/plugins/DkdsUiHotUpdate.template','sdk/tools/dkds-plugin.js'
 ])write(f,'\n');
 const keep=[
  ['connectivity-center','builtin.connectivity-center','foundation'],
  ['data-center','builtin.data-center','foundation'],
  ['status-monitor','builtin.status-monitor','foundation'],
  ['shell-navigation','builtin.shell-navigation','foundation'],
  ['scientific-data-contracts','builtin.scientific-data-contracts','foundation'],
  ['workspace-safeguards','builtin.workspace-safeguards','foundation'],
  ['thin-glass-theme','com.dkds.theme.liquid-glass','theme'],
  ['aurora-pop-theme','com.dkds.theme.aurora-pop','theme'],
  ['flexible-import','builtin.flexible-import','data']
 ];
 const analysis=[
  ['pulse-analysis','builtin.pulse-analysis','workbench',['analysis.pulse']],
  ['ter-analysis','builtin.ter-analysis','workbench',['analysis.ter']]
 ];
 for(const [folder,id,pluginType,capabilities=[]] of [...keep,...analysis])
  write('src/plugins/'+folder+'/plugin.json',JSON.stringify({id,pluginType,capabilities}));
 // Minimal pinned-DKDS compatibility fixtures exercise each derived-host patch.
 write('src/core/plugins/kernel/modules/workspace/top.js',
  "const selected=String(saved||preferredId||defaultSuperCandidate()||'').trim();");
 write('desktop/main.js',[
  "const APP_NAME = 'DK Data Studio';",
  "const APP_ID = 'com.dk.datastudio';"
 ].join('\n'));
 write('src/app/modules/floating-docks.js',"if(el)el.textContent=(label[state]||state)+(result.version?' · V'+result.version:'')+");
 write('desktop/native-update.js',String.raw`const expected='https://github.com/davidkane0526/DK-Data-Studio/releases/download/'+release.tag_name+'/';
const RELEASES='https://api.github.com/repos/davidkane0526/DK-Data-Studio/releases?per_page=100';
const PREVIEW=/^dkds-windows-v(\d+\.\d+\.\d+)-(a\d{4,})$/;
const PORTABLE=/^DK-Data-Studio-Portable-(\d+\.\d+\.\d+)-(a\d{4,})-x64\.exe$/;
const x=/^a(\d{4,})$/.exec(String(a||'')),y=/^a(\d{4,})$/.exec(String(b||''));
function pickRelease(releases,currentVersion){
if(!match||match[1]!==releaseVersion||match[2]!==releaseBuildId||!newer(releaseVersion,currentVersion))continue;
function createPortableUpdater({app,userData,scriptPath,currentVersion,portablePath=process.env.PORTABLE_EXECUTABLE_FILE||''}){
const status=()=>({status:state,version:candidate?.version||currentVersion,error,progress,
const next=pickRelease(releases,currentVersion);
state=file&&file.version===next.version&&file.digest===next.digest?'ready':'available';
if(!newer(candidate.version,currentVersion))throw Error('更新版本必须高于本地版本');
staged=path.join(folder,'DKDS-portable-'+candidate.version+'.exe');
const downloadNeeded=file?.version!==candidate.version||
file?.digest!==candidate.digest||!fs.existsSync(staged);
file={version:candidate.version,digest:candidate.digest};`);
 write('desktop/main-modules/online-update-ipc.js',String.raw`const userData=app.getPath('userData'),currentVersion=app.getVersion();
  const portable=createPortableUpdater({app,userData,scriptPath:path.join(__dirname,'../apply-portable-update.ps1'),currentVersion});
  const hot=createUiHotUpdater({userData,currentVersion});`);
 write('desktop/ui-hot-update.js',String.raw`const REPO='davidkane0526/DK-Data-Studio';
const FILES=Object.freeze(['src/styles/structure/connectivity-panels.css',
  'src/styles/platform/native-client-shell.css','src/styles/theme/component-appearance.css']);
const buildIdPattern=/^a\d{4,}$/;
const releasePattern=/^dkds-(?:ui|android)-v(\d+\.\d+\.\d+)-(a\d{4,})$/;
function createUiHotUpdater({userData,currentVersion}){
let status='idle',error='',appVersion=currentVersion,buildId='a0000',tag='',css='',busy=null;
const value=valid(row.bundle,currentVersion);
catch{css='';tag='';appVersion=currentVersion;buildId='a0000';}`);
 write('tools/updates/build-ui-hot-bundle.js',String.raw`if(!/^a\d{4,}$/.test(buildId))
const names=Object.freeze([
  'src/styles/structure/connectivity-panels.css',
  'src/styles/platform/native-client-shell.css',
  'src/styles/theme/component-appearance.css'
]);
const bundle={schema:'dkds-ui-v2',repository:'davidkane0526/DK-Data-Studio',appVersion,buildId};`);
 write('mobile/plugins/DkdsAppUpdate.template',String.raw`private static final String REPO = "davidkane0526/DK-Data-Studio";
private static final String APK_ASSET = "DK-Data-Studio-arm64-v8a-release.apk";
Pattern.compile("dkds-android-v(\\\\d+\\\\.\\\\d+\\\\.\\\\d+)-(a\\\\d{4,})");
if(APK_ASSET.equals(item.optString("name")))apk=item;
JSONObject status() throws org.json.JSONException {
return new JSONObject().put("status",state).put("version",version)
if(found==null||compareVersions(found.version,installed)<=0){
if(candidate==null||!candidate.version.equals(found.version)||
try{verifyDownloaded(apk,selected);validateApk(apk,selected.version);}
validateApk(apk,selected.version);
File destination=new File(folder,"verified-update.apk");
File temp=new File(folder,"download.tmp");
private void validateApk(File apk,String expectedVersion)throws Exception{
            ||!expectedVersion.equals(archive.versionName))`);
 write('mobile/plugins/DkdsUiHotUpdate.template',String.raw`private static final String REPO="davidkane0526/DK-Data-Studio";
private static final Pattern TAG=Pattern.compile("dkds-(?:ui|android)-v(\\\\d+\\\\.\\\\d+\\\\.\\\\d+)-[0-9]+");
private static final String[] FILES={"src/styles/structure/connectivity-panels.css",
    "src/styles/platform/native-client-shell.css","src/styles/theme/component-appearance.css"};
private volatile String status="idle",version="",tag="",error="",css="";
try{JSONObject data=readBundle(active);css=validate(data);tag=data.optString("_tag");version=data.optString("version");}
try{JSONObject data=readBundle(backup);css=validate(data);tag=data.optString("_tag");version=data.optString("version");
catch(Exception ignored){css="";tag="";version="";}
    }
  }
  private static void copy(File a,File b)throws Exception{
  private String installedVersion()throws Exception{
return candidate[0].equals(current[0])&&candidate[1].equals(current[1]);
if(!"dkds-ui-v1".equals(doc.optString("schema"))||!REPO.equals(doc.optString("repository")))
String ver=doc.optString("version");
JSONObject files=doc.getJSONObject("files");
return new JSONObject().put("status",status).put("version",version).put("tag",tag).put("error",error).put("applied",!css.isEmpty());
JSONObject chosen=null,asset=null;String latestTag="",latestVersion="";long latestRun=-1;
String tagVersion=matcher.group(1);
long run=Long.parseLong(row.getString("tag_name").substring(row.getString("tag_name").lastIndexOf('-')+1));
chosen=row;asset=target;latestTag=row.getString("tag_name");latestVersion=tagVersion;latestRun=run;
if(chosen==null||latestTag.equals(tag)){status="current";return;}
if(!latestVersion.equals(bundle.optString("version")))throw new SecurityException("UI version mismatch");
css=nextCss;tag=latestTag;version=latestVersion;status="updated";`);

 write('scripts/generate-brand-assets.js','// fixture branding generator');
 write('src/index.html',
  '<title>DK Data Studio</title><span class="brand-full">DK Data Studio</span>'+
  '<span>V3.72.3</span><img src="../assets/dkds-mark.svg">');
 write('src/generated/plugin-index.js','OLD-CATALOG');
 return {top,root,write};
}
test('DKTS profiles ALL non-analysis plugin types but excludes analysis workbenches',()=>{
 const f=fixture();
 try{
  const p=verify(f.root);
  assert.equal(p.counts.total,11);
  assert.equal(p.counts.retained,9);
  assert.equal(p.counts.excluded,2);
  assert(p.included.some(x=>x.id==='builtin.data-center'));
  assert(p.excluded.some(x=>x.id==='builtin.pulse-analysis'));
  f.write('src/plugins/keithley/plugin.json',
   JSON.stringify({id:'com.dkds.keithley-4200',name:'Keithley',pluginType:'workbench'}));
  assert.throws(()=>verify(f.root),/prohibited built-in instrument plugin/);
 }finally{fs.rmSync(f.top,{recursive:true,force:true});}
});
test('stage DKDS Core into DKTS directory without touching upstream or shipping analysis plugins',()=>{
 const f=fixture();
  const previousBuildNumber=process.env.DKTS_PREVIEW_BUILD_NUMBER;
  process.env.DKTS_PREVIEW_BUILD_NUMBER='162';
 try{
  const out=path.join(f.top,'DKTS-BUILD'),before=fs.readFileSync(
   path.join(f.root,'src/plugins/pulse-analysis/plugin.json'),'utf8');
  assert.throws(()=>stage(f.root,out,{dktsRoot:repo}),/lacks required updater safety contracts/,
   'production staging must reject the deliberately incomplete SDK fixture');
  const p=stage(f.root,out,{dktsRoot:repo,validateUpdater:()=>({verifiedCount:10,testOnly:true})});
  assert.equal(p.derivedDistribution,true);
  assert.equal(p.buildId,'a162');
  assert.equal(p.androidVersionCode,100162);
  assert.equal(p.outputReady,false,'staging is not deployable');
  assert(fs.existsSync(path.join(out,'src/plugins/data-center/plugin.json')));
  assert(!fs.existsSync(path.join(out,'src/plugins/pulse-analysis')));
  assert(fs.existsSync(path.join(out,'src/core/placeholder.js')));
  assert(!fs.existsSync(path.join(out,'src/generated/plugin-index.js')));
  assert(fs.existsSync(path.join(out,'src/plugins/dkts-4200a/plugin.json')));
  assert(!fs.existsSync(path.join(f.root,'src/plugins/dkts-4200a')),
   'DKDS upstream must never acquire the owned DKTS 4200 plugin');
  assert.match(fs.readFileSync(path.join(out,'src/index.html'),'utf8'),
   /DK Test Studio/);
  assert(!fs.readFileSync(path.join(out,'src/index.html'),'utf8')
   .includes('DK Data Studio'),'upstream brand must not remain on DKTS host screen');
  assert.match(fs.readFileSync(path.join(out,'desktop/main.js'),'utf8'),
   /const APP_NAME = 'DK Test Studio Core Preview'/);
  assert(!fs.readFileSync(path.join(out,'desktop/native-update.js'),'utf8')
   .includes('repos/davidkane0526/DK-Data-Studio/releases'),
   'preview native updater must not download DKDS releases');
  const windowsUpdate=fs.readFileSync(path.join(out,'desktop/native-update.js'),'utf8');
  assert(windowsUpdate.includes('dkts-core-preview-v'));
  assert(windowsUpdate.includes('DKTS-Core-Preview-Windows-V'));
  assert(windowsUpdate.includes('compareBuildIds(releaseBuildId,currentBuildId)>0'));
  assert(windowsUpdate.includes('currentBuildId'));
  const windowsUi=fs.readFileSync(path.join(out,'desktop/ui-hot-update.js'),'utf8');
  assert(windowsUi.includes('dkts-ui-v'));
  assert(windowsUi.includes('src/plugins/dkts-4200a/ui-shell.css'));
  assert(windowsUi.includes('Cached UI is older than the installed app'));
  const uiBuilder=fs.readFileSync(path.join(out,'tools/updates/build-ui-hot-bundle.js'),'utf8');
  assert(uiBuilder.includes('davidkane0526/DK-Test-Studio'));
  assert(uiBuilder.includes('src/plugins/dkts-4200a/ui-shell.css'));
  const ipc=fs.readFileSync(path.join(out,'desktop/main-modules/online-update-ipc.js'),'utf8');
  assert(ipc.includes('currentBuildId'));
  const appUpdate=fs.readFileSync(path.join(out,'mobile/plugins/DkdsAppUpdate.template'),'utf8');
  assert(appUpdate.includes('davidkane0526/DK-Test-Studio'));
  assert(appUpdate.includes('DKTS-Core-Preview-Android-FIXED-SIGNED-V'));
  assert(appUpdate.includes('installedBuildId()'));
  const uiUpdate=fs.readFileSync(path.join(out,'mobile/plugins/DkdsUiHotUpdate.template'),'utf8');
  assert(uiUpdate.includes('dkds-ui-v2'));
  assert(uiUpdate.includes('src/plugins/dkts-4200a/ui-shell.css'));
  assert(uiUpdate.includes('latestBuildId'));
  assert(uiUpdate.includes('doc.optString("appVersion")'));
  assert(uiUpdate.includes('bundle.optString("appVersion")'));
   assert(uiUpdate.includes('.put("appVersion",version)'));
   assert(fs.readFileSync(path.join(out,'src/app/modules/floating-docks.js'),'utf8').includes('result.buildId'));
  assert(fs.existsSync(path.join(out,'tools/dkts-icon-generator.cjs')));
  assert(fs.existsSync(path.join(out,'tools/dkts-core-brand.cjs')));
  assert(fs.existsSync(path.join(out,'desktop/dkts-core-boot-smoke.cjs')));
  const summary=JSON.parse(fs.readFileSync(path.join(out,'DKTS_FRAMEWORK_STAGING.json')));
  assert.equal(summary.instrumentPlugin,'src/plugins/dkts-4200a (DKTS build only; absent upstream)');
  assert.equal(summary.previewAppId,'studio.dk.test.corepreview');
  const pkg=JSON.parse(fs.readFileSync(path.join(out,'package.json'),'utf8'));
  assert.equal(pkg.name,'dk-test-studio-host');
  assert.equal(pkg.version,require('../package.json').version);
  assert.equal(pkg.dktsBuildId,'a162');
  const mobile=JSON.parse(fs.readFileSync(path.join(out,'mobile/app.json'),'utf8'));
  assert.equal(mobile.expo.android.package,'studio.dk.test.corepreview');
  assert.equal(mobile.expo.android.versionCode,1);
  assert.equal(fs.readFileSync(path.join(f.root,'src/plugins/pulse-analysis/plugin.json'),'utf8'),before);
  assert(fs.existsSync(path.join(f.root,'src/generated/plugin-index.js')));
  assert(!fs.existsSync(path.join(f.root,'desktop/dkts-core-boot-smoke.cjs')));
  assert.equal(JSON.parse(fs.readFileSync(path.join(f.root,'mobile/app.json'),'utf8')).expo.android.package,
   'com.dk.datastudio');
 }finally{
  if(previousBuildNumber===undefined)delete process.env.DKTS_PREVIEW_BUILD_NUMBER;
  else process.env.DKTS_PREVIEW_BUILD_NUMBER=previousBuildNumber;
  fs.rmSync(f.top,{recursive:true,force:true});
 }
});

test('Core Preview Android versionCode is monotonic while visible package version remains fixed',()=>{
 assert.equal(buildIdentity('').versionCode,1);
 assert.equal(buildIdentity('162').versionCode,100162);
 assert.equal(buildIdentity('163').versionCode,100163);
 assert.equal(buildIdentity('a163').buildId,'a163');
 assert.throws(()=>buildIdentity('0'),/positive aNNN/);
 assert.throws(()=>buildIdentity('3.14'),/positive aNNN/);
 assert.throws(()=>buildIdentity('10000000'),/positive aNNN/);
 const workflow=fs.readFileSync(path.join(repo,'.github/workflows/dkts-framework-contract.yml'),'utf8');
 assert(workflow.includes('DKTS_PREVIEW_BUILD_NUMBER: ${{ github.run_number }}'));
 assert(workflow.includes('100000+GITHUB_RUN_NUMBER'));
 assert.equal(require('../package.json').version,'0.3.13');
});
