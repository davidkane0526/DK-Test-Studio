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
     startup:window.DKDSPlugins?.startupState?.()||null,
     manager4200:window.DKDSPlugins?.manager?.get?.('com.dkts.keithley-4200')||null,
     brand:document.querySelector('.brand-full')?.textContent||'',
     hasCoreShell:!!document.getElementById('primaryActivityBar'),
     hasStatusBar:!!document.querySelector('[id*="statusBar"],footer,.statusbar'),
     has4200Workspace:ids.includes('com.dkts.keithley-4200'),
     keptDataCenter:ids.includes('builtin.data-center'),
     keptConnectivity:ids.includes('builtin.connectivity-center'),
     keptTheme:ids.some(x=>x.startsWith('com.dkds.theme.')),
     removedAnalysis:!ids.includes('builtin.pulse-analysis')&&
      !ids.includes('builtin.ter-analysis'),
     pluginCount:ids.length
    };
   })()`,true);
   lastProbe=state;
   if(state.readyState!=='complete'||!state.hasCoreShell||
       !state.has4200Workspace||!state.keptDataCenter||
       !state.keptConnectivity||!state.keptTheme||!state.removedAnalysis||
       state.brand!=='DK Test Studio'||
       state.selectedSuper!=='com.dkts.keithley-4200'||!state.superAvailable)return;
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
   const report={ok:true,kind:'DKTS-derived-real-DKDS-Electron-host',
    ...state,screenSize:size,uniqueSampleColors:unique.size,
    previewOnly:true,hasOutputVerification:false,attempts,elapsedMs:Date.now()-started};
   fs.writeFileSync(path.join(dir,'report.json'),JSON.stringify(report,null,2)+'\n');
   console.log('DKTS real Core host boot/screenshot PASS:',JSON.stringify(report));
   complete=true;
   app.exit(0);
  }catch(error){lastProbeError=String(error?.stack||error);if(attempts>=24)fail(error);}
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
