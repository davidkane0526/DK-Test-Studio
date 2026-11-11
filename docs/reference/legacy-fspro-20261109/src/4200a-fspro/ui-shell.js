(() => {
 'use strict';
 // Compact frameless DK Test Studio shell, shared unchanged by desktop and Android.
 const byId=id=>document.getElementById(id);
 const info=window.DKTSPreviewBuild||{};
 // The packaged PNG comes from the *original* DKTS icon generator. Direct
 // source checkouts retain the matching readable DK fallback until generated.
 const brand=byId('fs-brand-mark');
 const brandedImage=new Image();
 brandedImage.onload=()=>{
  if(brandedImage.naturalWidth<64)return;
  brand.textContent='';
  brand.dataset.brand='legacy-native-icon';
  window.DKDSStyleGate.set(brand,'background-image','url("brand-icon.png")',{component:'dkts.fspro.brand',owner:'dkts.fspro.shell',source:'src/4200a-fspro/ui-shell.js'});
 };
 brandedImage.src='brand-icon.png';
 const nativeVersion=/^\d+\.\d+\.\d+$/.test(info.nativeVersion||'')?info.nativeVersion:'0.3.13';
 const uiVersion=/^a\d{1,10}$/.test(info.uiRevision||'')?info.uiRevision:'a0';
 const version=byId('fs-version-badge'),panel=byId('fs-version-popover');
 version.textContent='V'+nativeVersion;
 byId('fs-version-ui').textContent=uiVersion;
 version.title='V'+nativeVersion+' · '+uiVersion;
 const setVersionOpen=open=>{
  panel.hidden=!open;
  version.setAttribute('aria-expanded',String(open));
 };
 version.addEventListener('click',()=>setVersionOpen(panel.hidden));
 document.addEventListener('pointerdown',event=>{
  if(!panel.hidden&&!panel.contains(event.target)&&!version.contains(event.target))setVersionOpen(false);
 });
 document.addEventListener('keydown',event=>{
  if(event.key==='Escape')setVersionOpen(false);
 });
 const actions=byId('fs-window-actions'),native=window.DKTSWindow;
 const maximize=byId('fs-window-maximize');
 function setMaximized(value){
  maximize.dataset.maximized=String(!!value);
  const en=document.documentElement.lang==='en';
  const label=value?(en?'Restore':'还原'):(en?'Maximize':'最大化');
  maximize.setAttribute('aria-label',label);maximize.title=label;
 }
 if(native&&typeof native.control==='function'){
  actions.hidden=false;
  byId('fs-window-minimize').addEventListener('click',()=>native.control('minimize'));
  maximize.addEventListener('click',()=>native.control('toggleMaximize').then(setMaximized).catch(()=>{}));
  byId('fs-window-close').addEventListener('click',()=>native.control('close'));
  native.control('isMaximized').then(setMaximized).catch(()=>{});
  native.onMaximize?.(setMaximized);
 }
 window.DKTSPreviewShell=Object.freeze({
  VERSION:'1.0.0',nativeVersion,uiVersion,
  isFrameless:Boolean(native?.control)
 });
})();
