'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const assetRoot=path.join(root,'android/app/src/main/assets');
test('Android APK includes independent native launcher and byte-identical shared core',()=>{
  execFileSync(process.execPath,['tools/sync-android-assets.cjs'],{cwd:root,stdio:'pipe'});
  const html=fs.readFileSync(path.join(assetRoot,'index.html'),'utf8');
  assert.match(html,/android\/native-client\.js/);
  assert.match(html,/shared\/identity-core\.js/);
  assert.match(html,/app\.js/);
  for(const file of ['hardware-capabilities.js','kxci-protocol.js','measurement-plan.js','kxci-measurement.js','waveform.js','identity-core.js'])
    assert.equal(fs.readFileSync(path.join(assetRoot,'shared',file),'utf8'),
      fs.readFileSync(path.join(root,'src/shared',file),'utf8'));
  const manifest=fs.readFileSync(path.join(root,'android/app/src/main/AndroidManifest.xml'),'utf8');
  assert.match(manifest,/DK Test Studio/);
  assert.doesNotMatch(manifest,/DK Data Studio/);
  const bridge=fs.readFileSync(path.join(root,'android/app/src/main/java/studio/dk/test/InstrumentBridge.java'),'utf8');
  assert.match(bridge,/isReadOnlyKxciRequest\(request\)/);
  assert.match(bridge,/isMeasurementKxciRequest\(request\)/);
  assert.match(bridge,/if \(noReply && querying\)/);
  assert.match(bridge,/if \(!noReply && isMeasurementKxciRequest\(request\) && !querying\)/);
});
test('Android host exercises the exact shared identity controller via native TCP adapter',async()=>{
  const writes=[];
  const window={};
  let session=null,lastQuery='';
  const instrumentInfo=[
    'slotno:1,name:SMU1,model:KISMU4200,serialno:SMU001,hwver:1.0,fwver:1.0,caldate:Jan 01, 2025,caldue:Jan 01, 2026',
    'slotno:2,name:PMU3,model:KIPMU4225,serialno:PMU001,hwver:1.0,fwver:1.0,caldate:Jan 01, 2025,caldue:Jan 01, 2026',
    'slotno:3,name:CVU1,model:KICVU4210,serialno:CVU001,hwver:1.0,fwver:1.0,caldate:Jan 01, 2025,caldue:Jan 01, 2026'
  ].join(',');
  const remoteInfo=[
    'slotno:1,name:PA1,model:KI4200,serialno:PA001,hwver:1.0,fwver:1.0,caldate:Jan 01, 2025,caldue:Jan 01, 2026',
    'slotno:2,name:RPM3-1,model:KIRPM4225,serialno:RPM001,hwver:1.0,fwver:1.0,caldate:Jan 01, 2025,caldue:Jan 01, 2026'
  ].join(',');
  const hex=value=>Buffer.from(value,'ascii').toString('hex');
  const commands={idn:hex('*IDN?\0'),opt:hex('*OPT?\0'),ul:hex('UL\0'),instrument:hex('EX SystemUtil instrumentinfo(,4096,)\0'),remote:hex('EX SystemUtil remotemoduleinfo(,4096,)\0'),gn:hex('GN result\0'),de:hex('DE\0')};
  window.DKTSNative={request(payload){
    const request=JSON.parse(payload);
    let value={};
    if(request.op==='open'){
      session='mock';
      value={sessionId:session,remoteAddress:'169.254.111.118',remotePort:1225,interfaceName:'eth0',localAddress:'169.254.111.115'};
    }else if(request.op==='exchange'){
      assert.equal(request.payload.sessionId,session);
      const command=Buffer.from(request.payload.base64,'base64').toString('hex');
      writes.push(command);
      const responses={
        [commands.idn]:'KEITHLEY INSTRUMENTS,KI4200A,1498377,V1.14\0',
        [commands.opt]:'SMUPA1,PMU3RPM1,CVU1\0',
        [commands.instrument]:'OK\0',[commands.remote]:'OK\0',
        [commands.gn]:(lastQuery==='instrument'?instrumentInfo:remoteInfo)+'\0'
      };
      if(command===commands.instrument)lastQuery='instrument';
      if(command===commands.remote)lastQuery='remote';
      let response='';
      if(command===commands.ul||command===commands.de){
        assert.equal(request.payload.noReply,true,'KXCI UL/DE must be sent as write-only commands');
      }else{
        assert(Object.hasOwn(responses,command),'Unexpected KXCI request '+command);
        response=responses[command];
      }
      value={base64:Buffer.from(response).toString('base64')};
    }else if(request.op==='close'){
      session=null;value={closed:true};
    }else assert.fail('Unexpected native operation '+request.op);
    queueMicrotask(()=>window.DKTSNativeBridgeResolve(JSON.stringify({id:request.id,ok:true,value})));
  }};
  const context={window,atob,btoa};
  vm.createContext(context);
  for(const file of [
    'android/web/bootstrap.js',
    'src/shared/hardware-capabilities.js',
    'src/shared/kxci-protocol.js',
    'src/shared/measurement-plan.js',
    'src/shared/kxci-measurement.js',
    'src/shared/waveform.js',
    'src/shared/identity-core.js',
    'android/web/native-client.js'
  ])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file});
  const client=window.DKTSClient;
  assert(client,'native Android client must expose independent application bridge');
  const connected=await client.post('/api/connect',{host:'169.254.111.118',port:1225});
  assert.equal(connected.phase,'connected');
  const modules=await client.post('/api/modules/inspect',{});
  assert.equal(modules.inventory.knownModules.length,3);
  assert.equal(modules.inventory.hardwareLimitsVerified,true);
  assert.deepEqual(writes,[commands.idn,commands.opt,commands.ul,commands.instrument,commands.gn,commands.remote,commands.gn,commands.de]);
  const database=await client.post('/api/hardware/capabilities');
  assert.equal(database.database.schema,'dkts.4200a.hardware-capabilities.v1');
  const plan=await client.post('/api/plan/validate',{kind:'iv',points:3,loops:2});
  assert.equal(plan.plan.executable,false);
  const waveform=await client.post('/api/waveform/validate',{text:'0,0\n0.00000002,1'});
  assert.equal(waveform.executable,false);
  await assert.rejects(()=>client.post('/api/output',{voltageV:200}),/未授权/);
  assert.equal((await client.post('/api/disconnect')).phase,'disconnected');
});

test('Android frontend adapts to safe areas, native touch interaction and narrow portrait/landscape screens',()=>{
  const index=fs.readFileSync(path.join(root,'web/index.html'),'utf8');
  const app=fs.readFileSync(path.join(root,'web/app.js'),'utf8');
  const css=fs.readFileSync(path.join(root,'web/styles.css'),'utf8');
  assert.match(index,/viewport-fit=cover/);
  assert.match(app,/typeof window\.DKTSNative\?\.request==='function'/);
  assert.match(app,/classList\.add\('dkts-android-shell'\)/);
  assert.match(css,/body\.dkts-android-shell\{/);
  assert.match(css,/env\(safe-area-inset-top,0px\)/);
  assert.match(css,/env\(safe-area-inset-bottom,0px\)/);
  assert.match(css,/env\(safe-area-inset-left,0px\)/);
  assert.match(css,/env\(safe-area-inset-right,0px\)/);
  assert.match(css,/body\.dkts-android-shell :is\(\.statusbar-message,\.statusbar-connection\)\{/);
  assert.match(css,/min-height:36px;height:36px/);
  assert.match(css,/@media\(max-height:530px\) and \(orientation:landscape\)/);
  const gradle=fs.readFileSync(path.join(root,'android/app/build.gradle'),'utf8');
  assert.match(gradle,/targetSdk 35/);
  assert.match(css,/#window-actions\[hidden\]\{display:none!important\}/);
});

test('Android standalone recovers unregistered USB Ethernet and can use source binding without requiring root',()=>{
  const bridge=fs.readFileSync(path.join(root,'android/app/src/main/java/studio/dk/test/InstrumentBridge.java'),'utf8');
  const repair=fs.readFileSync(path.join(root,'android/app/src/main/java/studio/dk/test/EthernetRouteRecovery.java'),'utf8');
  assert.match(bridge,/EthernetRouteRecovery\.sources\(mode,interfaceName,linkLocal\)/);
  assert.match(bridge,/EthernetRouteRecovery\.prepare\(host,mode,interfaceName\)/);
  assert.match(bridge,/candidate\.bind\(new InetSocketAddress\(source\.address,0\)\)/);
  assert.match(bridge,/if\(pass==0&&linkLocal&&!mode\.equals\("wifi"\)\)/);
  assert.match(bridge,/networkPreparation/);
  assert.match(repair,/ProcessBuilder\("su","-c",command\)/);
  assert.match(repair,/ip -4 addr add/);
  assert.match(repair,/ip -4 rule add pref 9000 to/);
  assert.match(repair,/ip -4 route replace/);
  assert.match(repair,/if\(!safeIpv4\(target\)\|\|!target\.startsWith\("169\.254\."\)\|\|mode\.equals\("wifi"\)\)/);
  assert.doesNotMatch(repair,/ip route (?:add|replace) default/);
});

test('legacy Android shell retains status bar rules while Core Android is built from true DKDS WebView',()=>{
  const activity=fs.readFileSync(path.join(root,'android/app/src/main/java/studio/dk/test/MainActivity.java'),'utf8');
  const source=fs.readFileSync(path.join(root,'web/styles.css'),'utf8');
  const coreCI=fs.readFileSync(path.join(root,'.github/workflows/dkts-framework-contract.yml'),'utf8');
  assert.match(activity,/controller\.hide\(WindowInsets\.Type\.statusBars\(\)\)/);
  assert.match(activity,/WindowManager\.LayoutParams\.FLAG_FULLSCREEN/);
  assert.doesNotMatch(activity,/WindowInsets\.Type\.navigationBars\(\)/);
  assert.match(activity,/controller\.setSystemBarsBehavior\(/);
  assert.doesNotMatch(activity,/getWindow\(\)\.setStatusBarColor\(/);
  assert.match(fs.readFileSync(path.join(root,'web/ui/responsive.css'),'utf8'),/body\.dkts-android-shell\{--dkts-titlebar-height:39px;/);
  assert.match(source,/body\.dkts-android-shell \.app-titlebar\{\s*height:calc\(var\(--dkts-title-height\) \+ var\(--dkts-safe-top\)\);[\s\S]*?padding-top:var\(--dkts-safe-top\);/);
  assert.match(coreCI,/Regenerate offline DKDS Core WebView source/);
  assert.match(coreCI,/Launch real DKDS-derived Android Core Preview on API 36 emulator/);
  assert.match(coreCI,/studio\.dk\.test\.corepreview/);
});
test('native Android shell version comes from its actual installed package',()=>{
 const src=fs.readFileSync(path.join(root,'android/app/src/main/java/studio/dk/test/InstrumentBridge.java'),'utf8');
 const bridge=fs.readFileSync(path.join(root,'android/web/native-client.js'),'utf8');
 const gradle=fs.readFileSync(path.join(root,'android/app/build.gradle'),'utf8');
 assert.match(src,/case "version": return new JSONObject\(\)/);
 assert.match(src,/getPackageInfo\(context\.getPackageName\(\),0\)\.versionName/);
 assert.match(bridge,/nativeVersion:async\(\)=>String/);
 assert(gradle.includes("versionName '"+require('../package.json').version+"'"));
});

test('Android workspace snapshots use private chunked atomic storage',()=>{
  const bridge=fs.readFileSync(path.join(root,
    'android/app/src/main/java/studio/dk/test/InstrumentBridge.java'),'utf8');
  const native=fs.readFileSync(path.join(root,'android/web/native-client.js'),'utf8');
  const storage=fs.readFileSync(path.join(root,
    'android/app/src/main/java/studio/dk/test/WorkspaceFileStore.java'),'utf8');
  assert.match(bridge,/case "workspace-info"/);
  assert.match(bridge,/case "workspace-begin"/);
  assert.match(bridge,/case "workspace-append"/);
  assert.match(bridge,/case "workspace-commit"/);
  assert.match(bridge,/case "workspace-read"/);
  assert.match(native,/WORKSPACE_CHUNK_BYTES=32768/);
  assert.match(native,/async function saveWorkspace\(snapshot\)/);
  assert.match(native,/async function loadWorkspace\(\)/);
  assert.match(storage,/context\.getFilesDir\(\)/);
  assert.match(storage,/StandardCopyOption\.ATOMIC_MOVE/);
  assert.match(storage,/StandardCopyOption\.REPLACE_EXISTING/);
  assert.match(storage,/written!=expected/);
  assert.match(bridge,/Arrays\.equals\(request, IDN\)/);
});

test('Android 16 immersive mode is coalesced and cannot repeatedly re-enter from focus changes',()=>{
  const src=fs.readFileSync(path.join(root,'android/app/src/main/java/studio/dk/test/MainActivity.java'),'utf8');
  assert(src.includes('setContentView(webView)'));
  assert(src.includes('scheduleImmersive()'));
  assert(src.indexOf('setContentView(webView)')<src.indexOf('scheduleImmersive();'),'setContentView must precede immersive setup');
  assert.match(src,/webView\.removeCallbacks\(immersiveTask\)/);
  assert.match(src,/webView\.post\(immersiveTask\)/);
  assert.match(src,/@Override protected void onResume\(\)/);
  assert.doesNotMatch(src,/onWindowFocusChanged\(/);
  assert.match(src,/controller\.hide\(WindowInsets\.Type\.statusBars\(\)\)/);
  assert.doesNotMatch(src,/controller\.hide\(WindowInsets\.Type\.navigationBars\(\)\)/);
  assert.match(src,/catch \(RuntimeException error\)/);
  assert.doesNotMatch(src,/getWindow\(\)\.setStatusBarColor\(/);
  const modern=src.slice(src.indexOf('if (Build.VERSION.SDK_INT >= 30)'),src.indexOf('} else {',src.indexOf('if (Build.VERSION.SDK_INT >= 30)')));
  assert.doesNotMatch(modern,/setFlags\(/);
});

test('legacy signing identity is pinned, while Core Android debug-signed builds are isolated as previews',()=>{
  const gradle=fs.readFileSync(path.join(root,'android/app/build.gradle'),'utf8');
  const coreCI=fs.readFileSync(path.join(root,'.github/workflows/dkts-framework-contract.yml'),'utf8');
  const release=fs.readFileSync(path.join(root,'.github/workflows/dkts-framework-contract.yml'),'utf8');
  const cert=fs.readFileSync(path.join(root,'android/signing-certificate.sha256'),'utf8').trim();
  assert.match(cert,/^[a-f0-9]{64}$/);
  assert.match(gradle,/signingConfigs\s*\{/);
  assert.match(gradle,/stablePreview/);
  assert.match(gradle,/System.getenv\('DKTS_ANDROID_KEYSTORE_PATH'\)/);
  assert.match(gradle,/System.getenv\('DKTS_ANDROID_SIGNING_PASSWORD'\)/);
  assert.match(coreCI,/studio\.dk\.test\.corepreview/);
  assert.match(coreCI,/CN=Android Debug/);
  assert.match(release,/TEST-SIGNED/);
  assert.match(release,/NOT a production in-place upgrade/);
  assert(!release.slice(release.indexOf('  publish-core-preview:')).includes('DKTS_ANDROID_KEYSTORE_B64'));
  assert.match(release,/android\/signing-certificate\.sha256/);
});
test('manual UI update op routes through Android updater without arbitrary TCP access',()=>{
  const java=fs.readFileSync(path.join(root,'android/app/src/main/java/studio/dk/test/InstrumentBridge.java'),'utf8');
  const manager=fs.readFileSync(path.join(root,'android/app/src/main/java/studio/dk/test/UiUpdateManager.java'),'utf8');
  const activity=fs.readFileSync(path.join(root,'android/app/src/main/java/studio/dk/test/MainActivity.java'),'utf8');
  const client=fs.readFileSync(path.join(root,'android/web/native-client.js'),'utf8');
  assert.match(java,/case "ui-check"/);
  assert.match(java,/case "ui-status"/);
  assert.match(java,/uiUpdates\.checkNow\(\)/);
  assert.match(activity,/new InstrumentBridge\(this, webView, uiUpdates, appUpdates\)/);
  assert.match(manager,/void checkNow\(\)/);
  assert.match(manager,/updateWorker\.execute\(/);
  assert.match(manager,/updateStatus = "updated"/);
  assert.match(client,/checkUiUpdate:async\(\)=>native\('ui-check'\)/);
  assert.match(client,/uiUpdateStatus:async\(\)=>native\('ui-status'\)/);
});

test('legacy WebView JS diagnostics remain available; Core emulator checks offline runtime failures',()=>{
  const main=fs.readFileSync(path.join(root,'android/app/src/main/java/studio/dk/test/MainActivity.java'),'utf8');
  const smoke=fs.readFileSync(path.join(root,'tools/run-core-android-smoke.sh'),'utf8');
  assert.match(main,/setWebChromeClient\(new WebChromeClient\(\)/);
  assert.match(main,/Log\.e\("DKTS-WebJS"/);
  assert.match(smoke,/runtime-errors\.txt/);
  assert.match(smoke,/ReactNativeJS:E/);
  assert.match(smoke,/FATAL EXCEPTION/);
  assert.match(smoke,/CORE_ANDROID_CRASH/);
});
test('Core Android builds real DKDS scientific plotting and records emulator evidence',()=>{
  const legacy=fs.readFileSync(path.join(root,'android/app/src/main/java/studio/dk/test/MainActivity.java'),'utf8');
  const plugin=fs.readFileSync(path.join(root,'integrations/dkds-native/plugin.js'),'utf8');
  const coreCI=fs.readFileSync(path.join(root,'.github/workflows/dkts-framework-contract.yml'),'utf8');
  assert.match(legacy,/DKTS-PlotReady/);
  assert.match(legacy,/window\.DKDSD3Renderer/);
  assert.match(legacy,/dkds-scientific-nav-drag/);
  assert.match(plugin,/units\.plotGroup\.create/);
  assert.match(plugin,/frameGroup\.adoptPlot/);
  assert.match(plugin,/units\.scientificPlot\.create/);
  assert.match(coreCI,/Launch real DKDS-derived Android Core Preview on API 36 emulator/);
  assert.match(coreCI,/Retain Android emulator screenshot and crash diagnostics/);
});
test('Android updater accepts current GitHub Release tags and never hot-swaps native versions',()=>{
  const java=fs.readFileSync(path.join(root,'android/app/src/main/java/studio/dk/test/UiUpdateManager.java'),'utf8');
  const updater=fs.readFileSync(path.join(root,'android/app/src/main/java/studio/dk/test/NativeAppUpdateManager.java'),'utf8');
  const bridge=fs.readFileSync(path.join(root,'web/app.js'),'utf8');
  const gradle=fs.readFileSync(path.join(root,'android/app/build.gradle'),'utf8');
  assert(java.includes('MAX_COMPARE_BYTES = 8 * 1024 * 1024'));
  assert(java.includes('jsonGet(API+"/compare/"+installed+"..."+head,MAX_COMPARE_BYTES)'));
  assert(java.indexOf('nativePackageVersion.equals(bundle.getString("packageVersion"))')<java.indexOf('JSONObject comparison=jsonGet('));
  assert(java.includes('updateStatus="native-required"'));
  assert(updater.includes('RELEASE_TAG.matcher(row.optString("tag_name"))'));
  assert(updater.includes('tag.group(1).equals(releaseVersion)'));
  assert(bridge.includes('inspectNativeAppUpdate()')&&bridge.includes('native-app-update-btn'));
  assert(gradle.includes('versionCode 24')&&gradle.includes("versionName '0.3.13'"));
});


test('Android UI updater retries only transient 502/503/504 on its worker and preserves the verified cache',()=>{
  const java=fs.readFileSync(path.join(root,'android/app/src/main/java/studio/dk/test/UiUpdateManager.java'),'utf8');
  assert.match(java,/for\(int attempt=0;attempt<3;attempt\+\+\)/);
  assert.match(java,/code==502\|\|code==503\|\|code==504/);
  assert.match(java,/if\(!transientGateway && code!=200\)/);
  assert.match(java,/Thread\.sleep\(\(attempt\+1\)\*700L\)/);
  assert.match(java,/已自动重试 3 次；当前界面保持不变/);
});
