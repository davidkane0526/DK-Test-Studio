(() => {
  'use strict';

  const touchPoint=(touch,event)=>{
    const clientX=Number(touch?.clientX),clientY=Number(touch?.clientY);
    if(!Number.isFinite(clientX)||!Number.isFinite(clientY))return null;
    return Object.freeze({clientX,clientY,identifier:Number(touch?.identifier),sourceEvent:event||null});
  };
  const findTouch=(event,identifier)=>{
    const pools=[event?.touches,event?.changedTouches];
    for(const pool of pools||[]){
      for(let i=0;i<(pool?.length||0);i+=1){const touch=pool[i];if(Number(touch?.identifier)===Number(identifier))return touch;}
    }
    return null;
  };

  function bind(handle,{enabled=()=>true,onStart,onMove,onEnd,onCancel}={}){
    if(!handle?.addEventListener||typeof window==='undefined')return ()=>{};
    let active=null;
    const stop=event=>{if(event?.cancelable)event.preventDefault?.();event?.stopPropagation?.();};
    const detach=()=>{
      window.removeEventListener('touchmove',move,true);
      window.removeEventListener('touchend',end,true);
      window.removeEventListener('touchcancel',cancel,true);
    };
    const finish=(event,cancelled=false)=>{
      if(!active)return;
      const touch=findTouch(event,active.identifier),point=touchPoint(touch,event)||active.last;
      const state=active;active=null;detach();stop(event);
      try{(cancelled?onCancel:onEnd)?.(point,state.meta,event);}catch(error){console.warn('[DKDS native touch drag finish]',error);}
    };
    const move=event=>{
      if(!active)return;
      const touch=findTouch(event,active.identifier);if(!touch)return;
      const point=touchPoint(touch,event);if(!point)return;
      active.last=point;stop(event);
      try{onMove?.(point,active.meta,event);}catch(error){console.warn('[DKDS native touch drag move]',error);}
    };
    const end=event=>finish(event,false);
    const cancel=event=>finish(event,true);
    const start=event=>{
      if(active||enabled?.(event)===false)return;
      const touch=event?.changedTouches?.[0]||event?.touches?.[0],point=touchPoint(touch,event);if(!point)return;
      let meta;try{meta=onStart?.(point,event);}catch(error){console.warn('[DKDS native touch drag start]',error);return;}
      if(meta===false)return;
      active={identifier:point.identifier,last:point,meta};stop(event);
      window.addEventListener('touchmove',move,{capture:true,passive:false});
      window.addEventListener('touchend',end,{capture:true,passive:false});
      window.addEventListener('touchcancel',cancel,{capture:true,passive:false});
    };
    handle.addEventListener('touchstart',start,{passive:false});
    return ()=>{handle.removeEventListener('touchstart',start);active=null;detach();};
  }

  const api=Object.freeze({version:'1.0.0',bind,touchPoint});
  if(typeof window!=='undefined')window.DKDSNativeTouchDrag=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})();
