(() => {
  'use strict';
  // Pure host adapter: the UI markup and all interactions come from the same
  // standalone web/index.html, web/styles.css and web/app.js as Windows/Android.
  function mount(ctx,page,{shell,onRequest,onPlanChanged,onWorkspaceState}={}){
    if(typeof shell?.createDocument!=='function'||typeof onRequest!=='function')
      throw Error('DKTS shared UI / DKDS bridge is not available');
    const units=ctx.ui.unitTemplates,dom=ctx.ui.dom;
    const body=units.page.create(page,{
      variant:'tool',className:'dkts-plugin-page dkts-shared-host'
    }).element;
    const workspaceHost=units.layout.create(body,{
      variant:'identity',className:'dkts-shared-workspace-host'
    });
    const workbench=units.workspace.create(workspaceHost,{
      variant:'standard',header:false,activity:'dkts-keithley-4200',
      primaryScroll:'safe'
    });
    const main=units.layout.create(null,{
      variant:'stack-comfortable',className:'dkts-shared-workbench'
    });
    dom.style(main,{
      display:'flex',flexDirection:'column',width:'100%',height:'100%',
      minHeight:'min(720px,calc(100dvh - 130px))',overflow:'hidden'
    });
    const tabStrip=dom.create('div');
    tabStrip.className='dkts-host-workspace-tabs';
    tabStrip.setAttribute('role','tablist');
    tabStrip.setAttribute('aria-label','DK Test Studio 工作区');
    dom.style(tabStrip,{
      display:'flex',alignItems:'center',gap:'5px',width:'100%',
      height:'36px',minHeight:'36px',padding:'3px 8px',
      overflowX:'auto',overflowY:'hidden',boxSizing:'border-box',
      borderBottom:'1px solid var(--dkds-border-subtle,rgba(128,128,128,.22))'
    });
    main.appendChild(tabStrip);
    const frame=dom.create('iframe');
    frame.className='dkts-standalone-workbench-frame';
    frame.setAttribute('title','DK Test Studio 完整测试工作区');
    // The App uses native <dialog>. Keep the opaque origin and deny same-origin
    // access while explicitly permitting only script execution and modal dialogs.
    frame.setAttribute('sandbox','allow-scripts allow-modals');
    frame.setAttribute('referrerpolicy','no-referrer');
    frame.setAttribute('loading','eager');
    dom.style(frame,{
      display:'block',flex:'1 1 auto',width:'100%',height:'calc(100% - 36px)',
      minHeight:'min(684px,calc(100dvh - 166px))',
      border:'0',background:'transparent'
    });
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
    function renderWorkspaceTabs(snapshot){
      const tabs=Array.isArray(snapshot?.tabs)?snapshot.tabs:[];
      const activeId=String(snapshot?.activeTabId||'');
      tabStrip.replaceChildren();
      for(const tab of tabs){
        const id=String(tab?.id||''),name=String(tab?.name||'工作区');
        if(!id)continue;
        const group=dom.create('div');
        dom.style(group,{display:'flex',alignItems:'center',flex:'0 0 auto',gap:'2px'});
        const select=dom.create('button');
        select.type='button';select.textContent=name;
        select.className='dkts-host-workspace-tab';
        select.setAttribute('role','tab');
        select.setAttribute('aria-selected',String(id===activeId));
        select.setAttribute('title',name+' · 双击重命名');
        dom.style(select,{
          maxWidth:'180px',minWidth:'54px',height:'28px',padding:'0 10px',
          overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',
          border:'1px solid '+(id===activeId?'var(--dkds-border-strong,rgba(100,130,170,.55))':'transparent'),
          borderRadius:'6px',
          background:id===activeId?'var(--dkds-surface-selected,rgba(100,130,170,.14))':'transparent',
          color:'var(--dkds-text-primary,inherit)',font:'inherit',fontSize:'12px',
          cursor:'pointer'
        });
        select.addEventListener('click',()=>send({type:'workspace-select',workspaceId:id}));
        select.addEventListener('dblclick',async()=>{
          const next=await ctx.ui.dialogs.prompt({
            title:'重命名工作区',message:'输入新的工作区名称',
            input:{type:'text',label:'工作区名称',value:name,placeholder:'最多 48 个字符'}
          });
          if(typeof next==='string'&&next.trim())
            send({type:'workspace-rename',workspaceId:id,name:next.trim().slice(0,48)});
        });
        const close=dom.create('button');
        close.type='button';close.textContent='×';
        close.setAttribute('aria-label','关闭 '+name);
        close.setAttribute('title','归档工作区');
        dom.style(close,{
          width:'22px',height:'24px',padding:'0',border:'0',borderRadius:'5px',
          background:'transparent',color:'var(--dkds-text-secondary,inherit)',
          cursor:'pointer',fontSize:'15px'
        });
        close.addEventListener('click',()=>send({type:'workspace-close',workspaceId:id}));
        group.append(select,close);tabStrip.appendChild(group);
      }
      const add=dom.create('button');
      add.type='button';add.textContent='+';
      add.setAttribute('aria-label','新建工作区');
      add.setAttribute('title','新建工作区');
      dom.style(add,{
        flex:'0 0 28px',width:'28px',height:'28px',padding:'0',
        border:'1px solid var(--dkds-border-subtle,rgba(128,128,128,.22))',
        borderRadius:'6px',background:'transparent',
        color:'var(--dkds-text-primary,inherit)',cursor:'pointer'
      });
      add.addEventListener('click',()=>send({type:'workspace-create'}));
      tabStrip.appendChild(add);
    }
    const receive=event=>{
      if(!alive||event.source!==frame.contentWindow)return;
      const data=event.data;
      if(!data||data.channel!=='dkts-standalone-workbench-v1'||
        data.session!==token)return;
      if(data.type==='ready'){
        frameReady=true;
        for(const payload of queued.splice(0))frame.contentWindow?.postMessage(payload,'*');
      }else if(data.type==='workspace-state'){
        renderWorkspaceTabs(data.workspace||{});
        onWorkspaceState?.(data.workspace||{});
      }else if(data.type==='draft'||data.type==='commit'){
        if(data.plan&&typeof data.plan==='object'&&!Array.isArray(data.plan)){
          draft={...draft,...data.plan};
        }
        if(data.connection&&typeof data.connection==='object'&&!Array.isArray(data.connection))
          connection={...data.connection};
        onPlanChanged?.({...draft},{commit:data.type==='commit',source:data.source||'all'});
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
      restoreWorkspace:value=>send({type:'restore-workspace',workspace:value}),
      renderConnection:value=>send({type:'status',snapshot:value}),
      renderWorkspaceTabs,
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
