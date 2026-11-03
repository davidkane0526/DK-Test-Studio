'use strict';
// Runs in Electron's sandboxed preload context. Do not expose ipcRenderer directly.
const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('DKTSWindow',Object.freeze({
  minimize:()=>ipcRenderer.invoke('dkts:window-control','minimize'),
  toggleMaximize:()=>ipcRenderer.invoke('dkts:window-control','toggleMaximize'),
  isMaximized:()=>ipcRenderer.invoke('dkts:window-control','isMaximized'),
  close:()=>ipcRenderer.invoke('dkts:window-control','close'),
  onMaximizedChange:(callback)=>{
    if(typeof callback!=='function')return ()=>{};
    const handler=(_event,isMaximized)=>callback(Boolean(isMaximized));
    ipcRenderer.on('dkts:window-maximized',handler);
    return ()=>ipcRenderer.removeListener('dkts:window-maximized',handler);
  }
}));
