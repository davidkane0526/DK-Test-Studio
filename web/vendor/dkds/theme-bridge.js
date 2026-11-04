(() => {
  'use strict';
  // DK Test Studio runs the original DKDS chart engine in its own shell.
  // Theme bridge provides only the environmental hooks owned by the host.
  if(globalThis.DKDSTheme)return;
  const watchers=new Set();
  const dark=()=>globalThis.matchMedia?.('(prefers-color-scheme: dark)')?.matches===true;
  const current=()=>dark()?'dark':'light';
  globalThis.DKDSTheme=Object.freeze({
    current,
    scientific:()=>({seriesPalette:['#2563eb','#0f9f9a','#dc2626','#f97316','#6d28d9']}),
    subscribeRevision(_id,handler){
      if(typeof handler!=='function')return ()=>{};
      const media=globalThis.matchMedia?.('(prefers-color-scheme: dark)');
      const callback=()=>handler({theme:current()});
      media?.addEventListener?.('change',callback);
      const off=()=>media?.removeEventListener?.('change',callback);
      watchers.add(off);
      return ()=>{watchers.delete(off);off();};
    }
  });
})();
