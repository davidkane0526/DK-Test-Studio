'use strict';
// Injected into the DKTS-owned staging copy only. Smoke cannot output to 4200A.
const fs=require('node:fs'),path=require('node:path');
module.exports=function start({app,BrowserWindow,APP_ROOT}){
 if(process.env.DKTS_CORE_BOOT_SMOKE!=='1')return;
 const dir=process.env.DKTS_CORE_SMOKE_DIR||path.join(APP_ROOT,'dist/core-boot-smoke');
 fs.mkdirSync(dir,{recursive:true});
 let busy=false,complete=false,attempts=0,lastProbe=null,lastProbeError='';
 const started=Date.now();
 const fail=error=>{
  if(complete)return;
  complete=true;
  const report={ok:false,error:String(error?.message||error),
   attempts,elapsedMs:Date.now()-started,lastProbe,lastProbeError};
  fs.writeFileSync(path.join(dir,'report.json'),JSON.stringify(report,null,2)+'\n');
  console.error('DKTS Core host smoke FAIL:',JSON.stringify(report));
  app.exit(1);
 };
 const probe=async()=>{
  if(busy||complete)return;
  busy=true;attempts++;
  try{
   const win=BrowserWindow.getAllWindows().find(x=>!x.isDestroyed()&&
    !x.webContents.isDestroyed()&&x.webContents.getURL().includes('index.html'));
   if(!win||win.webContents.isLoadingMainFrame())return;
   const state=await win.webContents.executeJavaScript(`(()=>{
    const ids=(window.DKDS_BUILTIN_PLUGINS||[]).map(p=>p.id);
    const superState=window.DKDSPlugins?.workspace?.super?.()||null;
    return {
     readyState:document.readyState,title:document.title,
     selectedSuper:superState?.pluginId||'',
     superAvailable:superState?.available===true,
     activeActivity:window.DKDSPlugins?.activities?.active?.()||'',
     neutralMainVisible:document.body?.innerText?.includes('尚未指定 / 当前主界面不可用')===true,
     startup:window.DKDSPlugins?.startupState?.()||null,
     manager4200:window.DKDSPlugins?.manager?.get?.('com.dkts.keithley-4200')||null,
     brand:document.querySelector('.brand-full')?.textContent||'',
     hasCoreShell:!!document.getElementById('primaryActivityBar'),
     hasStatusBar:!!document.querySelector('[id*="statusBar"],footer,.statusbar'),
     has4200Workspace:ids.includes('com.dkts.keithley-4200'),
     hasNativePageTabs:[...document.querySelectorAll('[data-dkds-unit-template="tabs-v2"]')]
      .some(node=>node.textContent.includes('扫描')&&
       node.textContent.includes('目标')&&node.textContent.includes('页面变量')),
     hasTerminalEditor:[...document.querySelectorAll('[data-dkds-unit-template="panel-v2"]')]
      .some(node=>node.textContent.includes('端口设置'))||
      document.body.innerText.includes('端口设置'),
     hasRedundant4200Header:[...document.querySelectorAll('.analysis-page-header')]
      .some(node=>node.textContent.trim()==='4200A'&&
       node.getBoundingClientRect().height>0),
     hasDeviceNavigation:document.body.innerText.includes('＋ 器件')&&
      document.body.innerText.includes('MOSFET'),
     terminalGrid:(()=>{
      const grid=[...document.querySelectorAll('[data-dkds-unit-layout-recipe="form-grid-4"]')]
       .find(node=>node.querySelectorAll('select').length===4);
      if(!grid)return {found:false,rows:0,columns:0};
      const style=getComputedStyle(grid);
      const coords=[...grid.querySelectorAll('select')]
       .map(node=>({x:Math.round(node.getBoundingClientRect().x),
        y:Math.round(node.getBoundingClientRect().y),
        w:Math.round(node.getBoundingClientRect().width)}));
      return {found:true,connected:grid.isConnected,display:style.display,
       gridTemplateColumns:style.gridTemplateColumns,
       gridWidth:Math.round(grid.getBoundingClientRect().width),
       rows:new Set(coords.filter(p=>p.w>0).map(p=>p.y)).size,
       columns:Math.max(0,...[...new Set(coords.map(p=>p.y))].map(
        y=>coords.filter(p=>p.y===y&&p.w>0).length)),
       coords};
     })(),
     nativePlotGroupCount:document.querySelectorAll('#dktsKeithley4200Page [data-dkds-unit-plot-group="plot-group-v2"]').length,
     nativePlotViewCount:document.querySelectorAll('#dktsKeithley4200Page [data-dkds-unit-plot-view="plot-view-v2"]').length,
     keptDataCenter:ids.includes('builtin.data-center'),
     keptConnectivity:ids.includes('builtin.connectivity-center'),
     keptTheme:ids.some(x=>x.startsWith('com.dkds.theme.')),
     removedAnalysis:!ids.includes('builtin.pulse-analysis')&&
      !ids.includes('builtin.ter-analysis'),
     pluginCount:ids.length
    };
   })()`,true);
   lastProbe=state;
   if(attempts===4){
    // Keep real Electron pixels even when a changed UI acceptance predicate fails.
    const diagnostic=await win.webContents.capturePage();
    if(!diagnostic.isEmpty())fs.writeFileSync(path.join(dir,'core-host-diagnostic.png'),diagnostic.toPNG());
   }
   // A failed plugin activation is deterministic; fail fast and report the
   // actual Core error instead of making developers wait for a generic timeout.
   if(attempts>=3&&state.manager4200?.status==='error')
    throw Error('4200A runtime activation rejected: '+state.manager4200.error);
   if(state.readyState!=='complete'||!state.hasCoreShell||
       !state.has4200Workspace||!state.keptDataCenter||
       !state.keptConnectivity||!state.keptTheme||!state.removedAnalysis||
       state.brand!=='DK Test Studio'||
       state.selectedSuper!=='com.dkts.keithley-4200'||!state.superAvailable||
       state.activeActivity!=='dkts-keithley-4200'||state.neutralMainVisible||
       !state.hasNativePageTabs||!state.hasTerminalEditor||
       !state.hasDeviceNavigation||state.hasRedundant4200Header||
       state.nativePlotGroupCount!==1||state.nativePlotViewCount<4)return;
   const img=await win.webContents.capturePage();
   if(img.isEmpty())throw Error('Empty Electron screen capture');
   const size=img.getSize(),bitmap=img.toBitmap(),unique=new Set();
   for(let y=0;y<size.height;y+=Math.max(1,Math.floor(size.height/23))){
    for(let x=0;x<size.width;x+=Math.max(1,Math.floor(size.width/31))){
     const pos=(y*size.width+x)*4;
     unique.add(bitmap.readUInt32LE(pos));
    }
   }
   if(unique.size<8)throw Error('Electron app screenshot is blank/flat');
   fs.writeFileSync(path.join(dir,'core-host.png'),img.toPNG());
   // Secondary responsive proof runs on real Electron renderer, not a static
   // HTML screenshot. This is not a substitute for Android device testing.
   const oldMin=win.getMinimumSize(),oldSize=win.getSize();
   let narrowSize=null;
   try{
    win.setMinimumSize(640,400);
    win.setSize(744,600);
    await new Promise(resolve=>setTimeout(resolve,450));
    const narrow=await win.webContents.capturePage();
    if(narrow.isEmpty())throw Error('Responsive Core screenshot is empty');
    narrowSize=narrow.getSize();
    if(narrowSize.width>850||narrowSize.width<630)
     throw Error('Responsive Core screenshot width out of expected range');
    fs.writeFileSync(path.join(dir,'core-host-narrow.png'),narrow.toPNG());
   }finally{
    win.setSize(...oldSize);
    win.setMinimumSize(...oldMin);
   }
   const report={ok:true,kind:'DKTS-derived-real-DKDS-Electron-host',
    narrowScreenshot:narrowSize,
    ...state,screenSize:size,uniqueSampleColors:unique.size,
    previewOnly:true,hasOutputVerification:false,attempts,elapsedMs:Date.now()-started};
   fs.writeFileSync(path.join(dir,'report.json'),JSON.stringify(report,null,2)+'\n');
   console.log('DKTS real Core host boot/screenshot PASS:',JSON.stringify(report));
   complete=true;
   app.exit(0);
  }catch(error){lastProbeError=String(error?.stack||error);if(attempts>=24||lastProbe?.manager4200?.status==='error')fail(error);}
  finally{busy=false;}
 };
 app.whenReady().then(()=>{
  const timer=setInterval(()=>{
   if(complete){clearInterval(timer);return;}
   if(Date.now()-started>110000){clearInterval(timer);fail('Core host did not reach fully initialized UI');return;}
   void probe();
  },1500);
 }).catch(fail);
};
