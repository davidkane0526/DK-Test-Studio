(()=>{
 'use strict';
 // DKTS workspace layout only. DKDS owns all controls, themes and plots.
 const CSS="\n#dktsKeithley4200Page [data-dkts-shell] {\n position:relative;display:grid!important;grid-template-columns:252px minmax(0,1fr)!important;\n height:calc(100dvh - 130px);min-height:420px;min-width:0;overflow:hidden;align-items:stretch\n}\n#dktsKeithley4200Page [data-dkts-nav] {\n min-width:0;min-height:0;overflow-x:hidden;overflow-y:auto;padding:10px 11px 14px;\n box-sizing:border-box;border-right:1px solid color-mix(in srgb,currentColor 12%,transparent);\n background:color-mix(in srgb,Canvas 98%,currentColor 2%);scrollbar-width:thin\n}\n#dktsKeithley4200Page [data-dkts-work] {min-width:0;min-height:0;overflow:hidden}\n#dktsKeithley4200Page [data-dkts-editor] {\n min-width:0;min-height:0;height:100%;box-sizing:border-box;\n overflow:auto;padding:11px 12px 18px;scrollbar-width:thin\n}\n#dktsKeithley4200Page [data-dkts-view=\"graph\"] {\n display:flex!important;flex-direction:column;box-sizing:border-box;\n min-width:0;min-height:0;height:100%;overflow:hidden;gap:7px;padding:9px 10px\n}\n#dktsKeithley4200Page [data-dkts-plot-group] {\n flex:1;min-height:0;min-width:0;overflow:auto;scrollbar-width:thin\n}\n#dktsKeithley4200Page [data-dkts-plot-group] [data-dkts-plot-frame] {\n height:clamp(254px,calc((100dvh - 200px)/2),420px)!important;\n min-height:0;min-width:0;overflow:hidden;box-sizing:border-box;\n border:1px solid color-mix(in srgb,currentColor 13%,transparent);\n border-radius:8px;box-shadow:none!important\n}\n#dktsKeithley4200Page [data-dkts-plot-header] {\n min-height:32px;box-sizing:border-box;\n border-bottom:1px solid color-mix(in srgb,currentColor 10%,transparent)\n}\n#dktsKeithley4200Page [data-dkts-plot-group] [data-dkts-plot-host] {\n min-height:0!important;min-width:0\n}\n#dktsKeithley4200Page [data-dkts-nav] [data-dkds-unit-template=\"list-item-v2\"] {\n min-height:31px;box-sizing:border-box;border-radius:5px\n}\n#dktsKeithley4200Page [data-dkts-nav] [data-dkds-unit-template=\"list-item-v2\"]:hover,\n#dktsKeithley4200Page [data-dkts-shell] button:hover {box-shadow:none!important}\n#dktsKeithley4200Page [data-dkts-nav] select {\n min-width:0;max-width:100%;min-height:32px;box-sizing:border-box\n}\n#dktsKeithley4200Page [data-dkts-new-page] {margin-top:8px}\n#dktsKeithley4200Page [data-dkts-nav-scrim],\n#dktsKeithley4200Page [data-dkts-nav-toggle] {display:none}\n@media(max-width:900px) {\n #dktsKeithley4200Page [data-dkts-shell] {\n  grid-template-columns:minmax(0,1fr)!important;\n  height:calc(100dvh - 124px);min-height:400px\n }\n #dktsKeithley4200Page [data-dkts-nav] {\n  position:absolute;left:0;top:0;bottom:0;width:min(284px,84vw);\n  z-index:21;transform:translateX(-105%);transition:transform 150ms ease;\n  border-right:1px solid color-mix(in srgb,currentColor 20%,transparent);\n  box-shadow:5px 0 20px color-mix(in srgb,black 12%,transparent)\n }\n #dktsKeithley4200Page [data-dkts-work] {grid-column:1/-1}\n #dktsKeithley4200Page [data-dkts-shell][data-dkts-nav-open=\"true\"] [data-dkts-nav] {\n  transform:translateX(0)\n }\n #dktsKeithley4200Page [data-dkts-nav-scrim] {\n  position:absolute;inset:0;z-index:20;background:color-mix(in srgb,black 22%,transparent)\n }\n #dktsKeithley4200Page [data-dkts-shell][data-dkts-nav-open=\"true\"] [data-dkts-nav-scrim] {\n  display:block\n }\n #dktsKeithley4200Page [data-dkts-nav-toggle] {display:inline-flex}\n #dktsKeithley4200Page [data-dkts-plot-group] [data-dkts-plot-frame] {\n  height:clamp(250px,calc((100dvh - 185px)/2),360px)!important\n }\n}\n@media(max-width:540px) {\n #dktsKeithley4200Page [data-dkts-editor] {padding:8px 8px 16px}\n #dktsKeithley4200Page [data-dkts-view=\"graph\"] {padding:7px;gap:5px}\n #dktsKeithley4200Page [data-dkts-plot-group] [data-dkts-plot-frame] {height:282px!important}\n}\n";
 function attach(root,nav){
  let open=false,style=null,scrim=null;
  function setOpen(value){open=Boolean(value);root?.setAttribute?.('data-dkts-nav-open',open?'true':'false');}
  const toggle=()=>setOpen(!open),close=()=>setOpen(false);
  root?.setAttribute?.('data-dkts-shell','true');
  nav?.setAttribute?.('data-dkts-nav','true');
  if(typeof document!=='undefined'&&root?.insertBefore){
   style=document.createElement('style');style.setAttribute('data-dkts-style','4200a');
   style.textContent=CSS;(document.head||document.documentElement).appendChild(style);
   scrim=document.createElement('div');scrim.setAttribute('data-dkts-nav-scrim','true');
   scrim.addEventListener('click',close);root.insertBefore(scrim,nav);
   document.addEventListener('keydown',onKey);
  }
  function onKey(e){if(e.key==='Escape')close();}
  setOpen(false);
  return Object.freeze({setOpen,toggle,close,dispose:()=>{
   if(typeof document!=='undefined')document.removeEventListener('keydown',onKey);
   scrim?.remove?.();style?.remove?.();
  }});
 }
 window.DKDSPluginModules.define('com.dkts.keithley-4200','uiShell',Object.freeze({attach}),{replace:true});
})();
