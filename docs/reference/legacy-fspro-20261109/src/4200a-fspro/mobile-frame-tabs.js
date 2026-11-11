(() => {
 'use strict';
 // One DKDS-style layout selector in the Visual Area heading owns Frame visibility.
 // The four original plot nodes remain mounted; their real raw traces are refreshed
 // after becoming visible, never synthesized or copied from a placeholder.
 const control=document.getElementById('fs-plot-layout');
 const container=document.querySelector('.fs-frames');
 const frames=[...container.querySelectorAll('.fs-frame')];
 if(!control||frames.length!==4)throw Error('FS-Pro requires all four scientific Frames');
 const narrow=window.matchMedia('(max-width:650px)');
 let active=0,selectedByUser=false;
 function broadcast(index){
  document.dispatchEvent(new CustomEvent('dkts:frame-selected',{detail:{index}}));
 }
 function set(value,{manual=false,focus=false}={}){
  const key=String(value);
  if(key!=='grid'&&!/^[0-3]$/.test(key))throw RangeError('Unknown scientific Frame layout');
  if(key!=='grid')active=Number(key);
  if(manual)selectedByUser=true;
  control.value=key;
  container.dataset.layout=key==='grid'?'grid':'single';
  frames.forEach((frame,i)=>{
   const show=key==='grid'||i===active;
   frame.dataset.mobileActive=String(show);
   // Keep DOM plots mounted. Hidden state is CSS-owned, not data ownership.
   frame.setAttribute('aria-hidden',String(!show));
  });
  if(focus)control.focus({preventScroll:true});
  requestAnimationFrame(()=>{
   for(let i=0;i<3;i++)if(key==='grid'||i===active)broadcast(i);
   window.dispatchEvent(new Event('resize'));
  });
 }
 function adapt(){
  // On first load and orientation change, restore a useful mobile-only Frame;
  // wide screens default to the four-panel DKDS scientific grid.
  if(!selectedByUser)set(narrow.matches?String(active):'grid');
  else if(narrow.matches&&control.value==='grid')set(String(active));
  else set(control.value);
 }
 control.addEventListener('change',()=>set(control.value,{manual:true}));
 narrow.addEventListener?.('change',adapt);
 set(narrow.matches?'0':'grid');
 window.DK4200MobileFrames=Object.freeze({
  current:()=>active,select:index=>set(String(index),{manual:true}),
  visible:()=>narrow.matches,layout:()=>container.dataset.layout,
  setLayout:choice=>set(choice,{manual:true})
 });
})();