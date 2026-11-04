'use strict';
const {app,BrowserWindow,ipcMain}=require('electron');
const path=require('node:path');
// Windows groups the taskbar window and packaged EXE under the same AppUserModelID.
if(process.platform==='win32')app.setAppUserModelId('studio.dk.test');
const {createAppServer}=require('../src/server.cjs');
const {createPortableUpdater}=require('./native-update.cjs');
let serverInstance,portableUpdater;
// Narrow, origin-bound bridge. The renderer can only invoke window operations.
ipcMain.handle('dkts:window-control',(event,operation)=>{
  const win=BrowserWindow.fromWebContents(event.sender);
  if(!win||win.isDestroyed()||!serverInstance||
     event.senderFrame!==win.webContents.mainFrame)return false;
  try{
    const requestOrigin=new URL(event.senderFrame.url).origin;
    const expectedOrigin=new URL(serverInstance.url).origin;
    if(requestOrigin!==expectedOrigin)return false;
  }catch{return false;}
  switch(operation){
    case 'minimize':win.minimize();return true;
    case 'toggleMaximize':
      if(win.isMaximized())win.unmaximize();else win.maximize();
      return win.isMaximized();
    case 'isMaximized':return win.isMaximized();
    case 'close':win.close();return true;
    default:return false;
  }
});
ipcMain.handle('dkts:app-update',async(event,operation)=>{
  const win=BrowserWindow.fromWebContents(event.sender);
  if(!win||win.isDestroyed()||!portableUpdater||!serverInstance||
      event.senderFrame!==win.webContents.mainFrame)return {status:'unsupported'};
  try{
    if(new URL(event.senderFrame.url).origin!==new URL(serverInstance.url).origin)
      return {status:'unsupported'};
  }catch{return {status:'unsupported'};}
  if(operation==='status')return portableUpdater.status();
  if(operation==='check')return portableUpdater.check();
  if(operation==='install')return portableUpdater.install();
  return {status:'unsupported'};
});
async function start(){
  // This is the one-time update-capable native shell. UI comes from a verified user-data cache.
  serverInstance=await createAppServer({
    uiCacheDir:path.join(app.getPath('userData'),'ui-updates'),
    workspaceFile:path.join(app.getPath('userData'),'workspace-state.json')
  });
  portableUpdater=createPortableUpdater({
    app,userData:app.getPath('userData'),
    scriptPath:path.join(__dirname,'apply-portable-update.ps1'),
    currentVersion:app.getVersion()
  });
  const win=new BrowserWindow({
    width:1200,height:790,minWidth:780,minHeight:560,
    frame:false,resizable:true,autoHideMenuBar:true,
    title:'DK Test Studio',icon:path.join(__dirname,'../build/icon.ico'),backgroundColor:'#f6f7fb',
    webPreferences:{
      preload:path.join(__dirname,'preload.cjs'),
      nodeIntegration:false,contextIsolation:true,sandbox:true,webSecurity:true
    }
  });
  // Keep the bottom maximize/restore button aligned with native window state.
  win.on('maximize',()=>{if(!win.isDestroyed())win.webContents.send('dkts:window-maximized',true);});
  win.on('unmaximize',()=>{if(!win.isDestroyed())win.webContents.send('dkts:window-maximized',false);});
  // Keep native menus out of the reclaimed top edge.
  win.setMenuBarVisibility(false);
  win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  win.webContents.on('will-navigate',(event,url)=>{
    if(!url.startsWith(serverInstance.url))event.preventDefault();
  });
  await win.loadURL(serverInstance.url);
}
app.whenReady().then(start).catch(error=>{console.error(error);app.quit();});
app.on('window-all-closed',()=>app.quit());
app.on('before-quit',()=>{if(serverInstance)serverInstance.close().catch(()=>{});});
