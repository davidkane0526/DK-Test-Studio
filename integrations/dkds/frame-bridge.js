(() => {
  'use strict';
  // Runs only in the sandboxed DK Test Studio frame, never in the DKDS host.
  const session=__DKTS_FRAME_TOKEN__,mobile=__DKTS_FRAME_MOBILE__;
  const allowed=Object.freeze({
    GET:new Set(['/api/status','/api/ui/version','/api/app/version']),
    POST:new Set(['/api/connect','/api/disconnect','/api/modules/inspect',
      '/api/plan/validate','/api/waveform/validate','/api/ui/check'])
  });
  const pending=new Map();
  let id=0,ready=false;
  const emit=payload=>window.parent.postMessage({
    channel:'dkts-standalone-workbench-v1',session,...payload
  },'*');
  window.fetch=async (input,init={})=>{
    const route=typeof input==='string'?input:input?.url;
    const method=String(init.method||'GET').toUpperCase();
    if(!allowed[method]?.has(route))
      return new Response(JSON.stringify({ok:false,error:'DKDS 插件禁止未授权的资源请求'}),{
        status:403,headers:{'Content-Type':'application/json'}
      });
    let payload={};
    if(method==='POST'){
      try{payload=JSON.parse(init.body||'{}');}
      catch{throw Error('Invalid request payload');}
      if(!payload||typeof payload!=='object'||Array.isArray(payload))
        throw Error('Expected JSON object');
    }
    const ticket=++id;
    const result=await new Promise((resolve,reject)=>{
      const timeout=window.setTimeout(()=>{
        pending.delete(ticket);reject(Error('DKDS 宿主请求超时'));
      },35000);
      pending.set(ticket,{resolve,reject,timeout});
      emit({type:'api',ticket,method,route,payload});
    });
    return new Response(JSON.stringify(result.data||{}),{
      status:Math.min(599,Math.max(200,Number(result.status)||500)),
      headers:{'Content-Type':'application/json'}
    });
  };
  function fieldSnapshot(formId){
    const form=document.getElementById(formId);
    return form?Object.fromEntries(new FormData(form).entries()):{};
  }
  function publishDraft(){
    if(!ready)return;
    emit({type:'draft',plan:fieldSnapshot('plan-form'),connection:fieldSnapshot('connection-form')});
  }
  function restore(value){
    const plan=value&&typeof value==='object'?value:{};
    const kind=String(plan.kind||plan.mode||'iv');
    if(['iv','it'].includes(kind)&&typeof window.selectTestKind==='function')
      window.selectTestKind(kind);
    const form=document.getElementById('plan-form');
    if(form)for(const field of form.elements){
      if(field.name&&Object.prototype.hasOwnProperty.call(plan,field.name))
        field.value=String(plan[field.name]);
    }
    publishDraft();
    document.getElementById('validate-plan')?.click();
  }
  window.addEventListener('message',event=>{
    if(event.source!==window.parent)return;
    const data=event.data;
    if(!data||data.channel!=='dkts-standalone-workbench-v1'||data.session!==session)return;
    if(data.type==='api-response'){
      const task=pending.get(data.ticket);
      if(!task)return;
      window.clearTimeout(task.timeout);pending.delete(data.ticket);
      task.resolve({status:data.status,data:data.data});
    }else if(data.type==='restore-plan')restore(data.plan);
    else if(data.type==='status'&&typeof window.renderStatus==='function')
      window.renderStatus(data.snapshot||{});
  });
  // Isolated frame retains exactly the Android responsive behavior inside DKDS Mobile.
  if(mobile){
    document.body.classList.add('dkts-android-shell');
    document.documentElement.dataset.dkdsHost='mobile';
  }
  document.addEventListener('DOMContentLoaded',()=>{
    ready=true;
    emit({type:'ready'});
    publishDraft();
    document.addEventListener('input',event=>{
      if(event.target?.closest?.('#plan-form,#connection-form'))
        publishDraft();
    });
    document.addEventListener('change',event=>{
      if(event.target?.closest?.('#plan-form,#connection-form'))
        publishDraft();
    });
    document.addEventListener('click',event=>{
      if(event.target?.closest?.('.test-type-card,.workspace-tab,.workspace-tab-close'))
        window.setTimeout(publishDraft,0);
    });
  });
  window.addEventListener('pagehide',()=>{
    for(const task of pending.values()){
      window.clearTimeout(task.timeout);
      task.reject(Error('DKDS embedded workbench closed'));
    }
    pending.clear();
  });
})();
