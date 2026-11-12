(()=>{
 'use strict';
 // SDK 1.19 Unit-only navigation. DKDS loads ui-shell.css from manifest.styles.
 // No document queries, private host bridge, scheduler or replacement renderer.
 function attach(units,root,nav){
  let open=false;
  const setOpen=value=>{
   open=Boolean(value);
   root?.setAttribute?.('data-dkts-nav-open',open?'true':'false');
  };
  const close=()=>setOpen(false),toggle=()=>setOpen(!open);
  root?.setAttribute?.('data-dkts-shell','true');
  nav?.setAttribute?.('data-dkts-nav','true');
  // Overlay is a DKDS Unit-owned layout, never custom HTML inserted into Core.
  const scrim=units.layout.create(root,{variant:'identity'});
  scrim?.setAttribute?.('data-dkts-nav-scrim','true');
  scrim?.addEventListener?.('click',close);
  const onKey=event=>{if(event.key==='Escape')close();};
  root?.addEventListener?.('keydown',onKey);
  setOpen(false);
  return Object.freeze({setOpen,toggle,close,dispose:()=>{
   scrim?.removeEventListener?.('click',close);
   root?.removeEventListener?.('keydown',onKey);
   scrim?.remove?.();
  }});
 }
 window.DKDSPluginModules.define('com.dkts.keithley-4200','uiShell',Object.freeze({attach}),{replace:true});
})();
