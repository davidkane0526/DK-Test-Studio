(() => {
  'use strict';
  // Pure host adapter: the UI markup and all interactions come from the same
  // standalone web/index.html, web/styles.css and web/app.js as Windows/Android.
  function mount(ctx,page,{shell,onRequest,onPlanChanged}={}){
    if(typeof shell?.createDocument!=='function'||typeof onRequest!=='function')
      throw Error('DKTS shared UI / DKDS bridge is not available');
    const units=ctx.ui.unitTemplates,dom=ctx.ui.dom;
    const body=units.page.create(page,{
      variant:'tool',className:'dkts-plugin-page dkts-shared-host'
    }).element;
    const workbench=units.workspace.create(body,{
      variant:'standard',header:false,activity:'dkts-keithley-4200',
      primaryScroll:'safe'
    });
    const main=dom.create('div');
    main.className='dkts-shared-workbench';
    if(main.style){
      main.style.display='block';
      main.style.width='100%';
      main.style.minHeight='min(720px,calc(100dvh - 130px))';
      main.style.height='calc(100dvh - 100px)';
      main.style.overflow='hidden';
    }
    const frame=dom.create('iframe');
    frame.className='dkts-standalone-workbench-frame';
    frame.setAttribute('title','DK Test Studio 完整测试工作区');
    frame.setAttribute('sandbox','allow-scripts');
    frame.setAttribute('referrerpolicy','no-referrer');
    frame.setAttribute('loading','eager');
    if(frame.style){
      frame.style.display='block';
      frame.style.width='100%';
      frame.style.height='100%';
      frame.style.border='0';
      frame.style.background='transparent';
    }
    main.appendChild(frame);
    workbench.compose({primary:{
      id:'main',label:'DK Test Studio',
      presentationRole:'utility-primary',
      scroll:'safe',titlePolicy:'host-only',mainNode:main
    },primes:[],subs:[]});
    const token=(typeof crypto!=='undefined'&&crypto.randomUUID
      ?crypto.randomUUID().replace(/-/g,'')
      :Math.random().toString(36).slice(2)+Math.random().toString(36).slice(2));
    const hostMobile=typeof document!=='undefined'&&(
      document.documentElement?.dataset?.dkdsHost==='mobile'||
      document.documentElement?.classList?.contains('react-native-client')
    );
    let alive=true,frameReady=false;
    let draft={kind:'iv'},connection={};
    const queued=[];
    const send=message=>{
      if(!alive)return;
      const payload={channel:'dkts-standalone-workbench-v1',session:token,...message};
      if(!frameReady){queued.push(payload);return;}
      frame.contentWindow?.postMessage(payload,'*');
    };
    const receive=event=>{
      if(!alive||event.source!==frame.contentWindow)return;
      const data=event.data;
      if(!data||data.channel!=='dkts-standalone-workbench-v1'||
        data.session!==token)return;
      if(data.type==='ready'){
        frameReady=true;
        for(const payload of queued.splice(0))frame.contentWindow?.postMessage(payload,'*');
      }else if(data.type==='draft'){
        if(data.plan&&typeof data.plan==='object'&&!Array.isArray(data.plan)){
          draft={...draft,...data.plan};
        }
        if(data.connection&&typeof data.connection==='object'&&!Array.isArray(data.connection))
          connection={...data.connection};
        onPlanChanged?.({...draft});
      }else if(data.type==='api'){
        const ticket=data.ticket;
        if(!Number.isSafeInteger(ticket)||ticket<1)return;
        Promise.resolve().then(()=>onRequest({
          method:data.method,route:data.route,payload:data.payload
        })).then(value=>{
          send({type:'api-response',ticket,status:value?.status||500,data:value?.data||{}});
        }).catch(error=>{
          send({type:'api-response',ticket,status:500,
            data:{ok:false,error:String(error.message||error).slice(0,160)}});
        });
      }
    };
    window.addEventListener('message',receive);
    frame.srcdoc=shell.createDocument(token,hostMobile);
    return Object.freeze({
      readConnection:()=>({...connection}),
      readPlan:()=>({...draft}),
      restorePlan:value=>{draft={...value};send({type:'restore-plan',plan:value});},
      renderConnection:value=>send({type:'status',snapshot:value}),
      renderPlan:()=>{},
      renderPlanError:()=>{},
      activate:()=>{},
      dispose(){
        alive=false;
        window.removeEventListener('message',receive);
        queued.length=0;
        try{frame.srcdoc='';}catch{}
        frame.remove?.();
        workbench?.dispose?.();
      }
    });
  }
  window.DKDSPluginModules.define('com.dkts.keithley-4200',
    'presentation',Object.freeze({mount}));
})();
