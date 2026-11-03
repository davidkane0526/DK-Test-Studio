'use strict';
const {app,BrowserWindow,shell}=require('electron');
const {createAppServer}=require('../src/server.cjs');
let serverInstance;
async function start(){
  serverInstance=await createAppServer();
  const win=new BrowserWindow({
    width:1200,height:790,minWidth:780,minHeight:560,
    title:'DK Test Studio',backgroundColor:'#f6f7fb',
    webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true,webSecurity:true}
  });
  win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  win.webContents.on('will-navigate',(event,url)=>{
    if(!url.startsWith(serverInstance.url))event.preventDefault();
  });
  await win.loadURL(serverInstance.url);
}
app.whenReady().then(start).catch(error=>{console.error(error);app.quit();});
app.on('window-all-closed',()=>app.quit());
app.on('before-quit',()=>{if(serverInstance)serverInstance.close().catch(()=>{});});
