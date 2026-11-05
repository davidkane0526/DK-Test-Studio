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
  for(const file of ['hardware-capabilities.js','kxci-protocol.js','measurement-plan.js','waveform.js','identity-core.js'])
    assert.equal(fs.readFileSync(path.join(assetRoot,'shared',file),'utf8'),
      fs.readFileSync(path.join(root,'src/shared',file),'utf8'));
  const manifest=fs.readFileSync(path.join(root,'android/app/src/main/AndroidManifest.xml'),'utf8');
  assert.match(manifest,/DK Test Studio/);
  assert.doesNotMatch(manifest,/DK Data Studio/);
  const bridge=fs.readFileSync(path.join(root,'android/app/src/main/java/studio/dk/test/InstrumentBridge.java'),'utf8');
  assert.match(bridge,/isReadOnlyKxciRequest\(request\)/);
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
        [commands.opt]:'SMU1,PMU3,CVU1\0',
        [commands.ul]:'OK\0',[commands.de]:'OK\0',
        [commands.instrument]:'OK\0',[commands.remote]:'OK\0',
        [commands.gn]:(lastQuery==='instrument'?instrumentInfo:remoteInfo)+'\0'
      };
      if(command===commands.instrument)lastQuery='instrument';
      if(command===commands.remote)lastQuery='remote';
      assert(Object.hasOwn(responses,command),'Unexpected KXCI request '+command);
      value={base64:Buffer.from(responses[command]).toString('base64')};
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

test('Android standalone hides system status bar while keeping navigation and embedded UI SHA',()=>{
  const activity=fs.readFileSync(path.join(root,'android/app/src/main/java/studio/dk/test/MainActivity.java'),'utf8');
  const workflow=fs.readFileSync(path.join(root,'.github/workflows/windows-preview.yml'),'utf8');
  const source=fs.readFileSync(path.join(root,'web/styles.css'),'utf8');
  assert.match(activity,/controller\.hide\(WindowInsets\.Type\.statusBars\(\)\)/);
  assert.match(activity,/WindowManager\.LayoutParams\.FLAG_FULLSCREEN/);
  assert.doesNotMatch(activity,/WindowInsets\.Type\.navigationBars\(\)/);
  assert.match(activity,/controller\.setSystemBarsBehavior\(/);
  assert.doesNotMatch(activity,/getWindow\(\)\.setStatusBarColor\(/);
  assert.match(source,/body\.dkts-android-shell\{[\s\S]*?--dkts-title-height:39px/);
  assert.match(workflow,/Stamp offline Android UI version/);
  assert.match(workflow,/Stamp offline bundled UI version/);
  const stamp=fs.readFileSync(path.join(root,'tools/stamp-native-ui.cjs'),'utf8');
  assert.match(stamp,/dkts-ui-version/);
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

test('released Android artifacts use a fixed, pinned certificate and never use CI debug keystore',()=>{
  const gradle=fs.readFileSync(path.join(root,'android/app/build.gradle'),'utf8');
  const workflow=fs.readFileSync(path.join(root,'.github/workflows/windows-preview.yml'),'utf8');
  const cert=fs.readFileSync(path.join(root,'android/signing-certificate.sha256'),'utf8').trim();
  assert.match(cert,/^[a-f0-9]{64}$/);
  assert.match(gradle,/signingConfigs\s*\{/);
  assert.match(gradle,/stablePreview/);
  assert.match(gradle,/System.getenv\('DKTS_ANDROID_KEYSTORE_PATH'\)/);
  assert.match(gradle,/System.getenv\('DKTS_ANDROID_SIGNING_PASSWORD'\)/);
  assert.match(workflow,/secrets.DKTS_ANDROID_KEYSTORE_B64/);
  assert.match(workflow,/secrets.DKTS_ANDROID_SIGNING_PASSWORD/);
  assert.match(workflow,/:app:assembleRelease/);
  assert.doesNotMatch(workflow,/:app:assembleDebug/);
  assert.match(workflow,/apksigner/);
  assert.match(workflow,/signing-certificate.sha256/);
  assert.match(workflow,/adb install -r android\/app\/build\/outputs\/apk\/release\/app-release.apk/);
  assert.match(workflow,/certificate drift detected/);
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

test('Android WebView surfaces chart script exceptions in startup smoke testing',()=>{
  const main=fs.readFileSync(path.join(root,'android/app/src/main/java/studio/dk/test/MainActivity.java'),'utf8');
  const workflow=fs.readFileSync(path.join(root,'.github/workflows/windows-preview.yml'),'utf8');
  assert.match(main,/setWebChromeClient\(new WebChromeClient\(\)/);
  assert.match(main,/Log\.e\("DKTS-WebJS"/);
  assert.match(workflow,/android-startup-webjs\.log/);
  assert.match(workflow,/! grep -Eq 'Uncaught\|ReferenceError\|TypeError/);
});

test('emulator verifies the actual DKDS engine and toolbar grip at runtime',()=>{
  const activity=fs.readFileSync(path.join(root,'android/app/src/main/java/studio/dk/test/MainActivity.java'),'utf8');
  const workflow=fs.readFileSync(path.join(root,'.github/workflows/windows-preview.yml'),'utf8');
  assert.match(activity,/DKTS-PlotReady/);
  assert.match(activity,/window\.DKDSD3Renderer/);
  assert.match(activity,/dkds-scientific-nav-drag/);
  assert.match(workflow,/android-plot-ready\.log/);
  assert.match(workflow,/grep -q 'd3\.\*true\.\*renderer\.\*true\.\*charts\.\*true\.\*grip\.\*true'/);
});
