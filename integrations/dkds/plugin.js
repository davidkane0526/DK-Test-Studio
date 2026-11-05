(() => {
  'use strict';
  const manifest={"id":"com.dkts.keithley-4200","name":"DK Test Studio - Keithley 4200A","version":"0.6.12","apiVersion":"1.19.0","entry":"plugin.js","enabled":true,"order":82,"description":"DK Test Studio shared standalone UI, DKDS-owned transport and project integration","pluginType":"developer","requiresCore":["runtime","status","services","modules","project","workspace","capabilities","data.model","data.artifacts","ui.dom","ui.activities","ui.top-workspace","ui.pages","ui.unit-templates","ui.status-bar"],"capabilities":["instrument.dkts-keithley-4200","network.tcp-client","ui.page","ui.top-workspace","ui.plugin-workspace"],"platformPresentation":{"desktop":{"mode":"shared"},"mobile":{"mode":"adaptive"}},"scripts":["kxci-protocol.js","measurement-plan.js","waveform.js","identity-core.js","interop.js","standalone-shell.js","presentation.js","plugin.js"],"workspace":{"role":"top","activity":"dkts-keithley-4200","icon":"K","title":"Keithley 4200A"},"window":{"activity":"dkts-keithley-4200","title":"DK Test Studio - Keithley 4200A","width":1280,"height":820,"minWidth":800,"minHeight":620,"dependencies":[],"prewarm":false,"reuse":true,"persistence":"project"}};
  DKDSPlugins.define(manifest,async ctx=>{
    const modules=ctx.modules;
    const protocol=modules.require('dkts-kxci');
    const domain=modules.require('dkts-identity-core');
    const planner=modules.require('dkts-plan');
    const execution=planner.createExecutionCoordinator();
    const waveform=modules.require('dkts-waveform');
    const interop=modules.require('dkts-interop');
    const presentation=modules.require('presentation');
    // Both applications inject their own transport; only one shared domain state machine exists.
    const controller=domain.createIdentityController(ctx.services.require('tcp'),protocol);
    let ui=null,storedPlan={},disposed=false,savedWorkspace=null;
    const statusItem=ctx.ui.statusBar.add({
      id:'dkts-4200a',side:'right',order:42,icon:'',label:'4200A 未连接',
      state:'stopped',className:'compact dkts-4200a-status',
      title:'Keithley 4200A 连接状态',
      onClick:()=>ctx.workspace.openPage('dktsKeithley4200Page')
    });
    const EMPTY_WORKSPACE=()=>({
      schema:'dkts.workspace.v2',activeTabId:null,tabSerial:0,idSerial:0,tabs:[],archivedTabs:[]
    });
    function workspaceCopy(value){
      if(!value||typeof value!=='object'||Array.isArray(value)||
        !['dkts.workspace.v1','dkts.workspace.v2'].includes(value.schema)||
        !Array.isArray(value.tabs)||
        (value.schema==='dkts.workspace.v2'&&!Array.isArray(value.archivedTabs)))
        throw Error('工作区数据格式无效');
      const json=JSON.stringify(value);
      if(json.length>64*1024*1024)throw Error('项目工作区数据超过限制');
      return JSON.parse(json);
    }
    function plan(){
      const candidate=ui?ui.readPlan():storedPlan;
      return planner.normalizePlan(candidate);
    }
    function endpoint(){return ui?ui.readConnection():{};}
    function notify(snapshot){
      ui?.renderConnection(snapshot);
      const connected=snapshot.phase==='connected';
      statusItem.update({
        label:connected?'4200A 已连接':snapshot.phase==='connecting'?'4200A 连接中':'4200A 未连接',
        state:connected?'ready':snapshot.phase==='error'?'error':snapshot.phase==='connecting'?'starting':'stopped',
        title:String(snapshot.summary||'Keithley 4200A 连接状态')
      });
      ctx.status.set('4200A：'+String(snapshot.summary||'未连接'));
      return snapshot;
    }
    async function connect(settings=endpoint()){
      try{
        const connected=await controller.connect(settings);
        if(connected.phase==='connected')await controller.inspectModules();
        return notify(controller.status());
      }
      catch(e){notify(controller.status());return {ok:false,error:domain.summarizeError(e)};}
    }
    async function disconnect(){return notify(await controller.disconnect());}
    async function toggleConnection(){
      return controller.status().phase==='connected'?disconnect():connect();
    }
    function preview(){
      try{
        const result=planner.previewPlan(plan());
        ui?.renderPlan(result);
        return result;
      }catch(e){ui?.renderPlanError(String(e.message||e));throw e;}
    }
    function exportPlan(){return interop.createPlanEnvelope(plan(),planner);}
    function importPlan(envelope){
      const restored=interop.readPlanEnvelope(envelope,planner);
      storedPlan={...restored};ui?.restorePlan(restored);preview();ctx.project.capture();
      return restored;
    }
    function onOpen(){
      if(disposed)return;
      // The shared standalone UI automatically probes its own bridge on load.
      // Do not create an additional connection behind the user's active tab.
    }
    ctx.ui.activities.add({id:'dkts-keithley-4200',label:'4200A',contextLabel:'',
      order:82,primary:true,openMode:'window',
      description:'共用 DK Test Studio 测试核心；只读仪器连接和方案校验',
      onActivate:()=>{ctx.workspace.openPage('dktsKeithley4200Page');onOpen();}});
    const page=ctx.ui.pages.add({id:'dkts-keithley-4200-page',pageId:'dktsKeithley4200Page',
      activity:'dkts-keithley-4200',label:'4200A',title:'',
      toolbar:false,html:'',onOpen});
    const shell=modules.require('standalone-shell');
    async function handleUiRequest({method,route,payload={}}){
      try{
        if(method==='GET'){
          if(route==='/api/status')return {status:200,data:{ok:true,...controller.status()}};
          if(route==='/api/app/version')return {status:200,data:{version:'0.3.10'}};
          if(route==='/api/ui/version')return {status:200,data:{version:'bundled',status:'disabled'}};
          if(route==='/api/workspaces')return {status:200,data:{ok:true,workspace:savedWorkspace}};
        }
        if(method==='POST'){
          if(route==='/api/workspaces'){
            savedWorkspace=workspaceCopy(payload.workspace);
            ctx.project.capture();
            return {status:200,data:{ok:true}};
          }
          if(route==='/api/ui/check')return {status:200,data:{ok:true,status:'disabled',updated:false}};
          if(route==='/api/connect'){
            try{
              const value=await controller.connect(payload);
              return {status:200,data:{ok:true,...notify(value)}};
            }catch(error){
              return {status:200,data:{ok:false,...notify(controller.status()),
                summary:domain.summarizeError(error)}};
            }
          }
          if(route==='/api/disconnect')
            return {status:200,data:{ok:true,...notify(await controller.disconnect())}};
          if(route==='/api/modules/inspect'){
            const value=await controller.inspectModules();
            return {status:200,data:{ok:true,...notify(value)}};
          }
          if(route==='/api/plan/validate'){
            const value=planner.previewPlan(payload,300);
            return {status:200,data:{ok:true,plan:value.plan,
              firstPoints:value.firstPoints,truncated:value.truncated}};
          }
          if(route==='/api/waveform/validate'){
            if(typeof payload.text!=='string')return {status:400,data:{error:'波形应为文本'}};
            const wave=waveform.parseWaveformText(payload.text);
            const interval=Math.max(1,Math.ceil(wave.points.length/300));
            return {status:200,data:{ok:true,count:wave.points.length,
              durationS:wave.durationS,minimumStepS:wave.minimumStepS,
              maximumStepS:wave.maximumStepS,executable:false,hardwareVerified:false,
              preview:wave.points.length<=300?wave.points:
                wave.points.filter((_,i)=>i%interval===0)}};
          }
        }
        return {status:404,data:{ok:false,error:'接口不存在'}};
      }catch(error){
        return {status:400,data:{ok:false,error:String(error.message||error).slice(0,180)}};
      }
    }
    ui=presentation.mount(ctx,page,{
      shell,
      onRequest:handleUiRequest,
      onPlanChanged:(value,meta={})=>{
        try{
          const next=planner.normalizePlan(value);
          storedPlan={...next};
          // Draft typing updates the in-memory state; commit only completed plan
          // edits and test-tab changes. Connection settings are never project data.
          if(meta.commit===true&&meta.source==='plan')ctx.project.capture();
        }catch{/* Invalid drafts stay visible in the UI but cannot enter saved plans. */}
      }
    });
    // The mobile drawer only displays the activity when TOP Workspace is registered.
    ctx.ui.topWorkspace.register({
      id:'dkts-keithley-4200',activity:'dkts-keithley-4200',label:'4200A',
      layout:{mode:'native',root:{selector:'#dktsKeithley4200Page .dkds-plugin-workspace'},
      primary:{id:'main',label:'4200A',role:'analysis-primary',
        presentationRole:'utility-primary',priority:100,collapsible:false},prime:[],sub:[]}
    });
    ctx.project.registerSlice('dkts-keithley-4200',{
      serialize:()=>({plan:{...plan(),executable:false,hardwareVerified:false},
        workspace:savedWorkspace}),
      restore:value=>{
        savedWorkspace=value?.workspace?workspaceCopy(value.workspace):null;
        ui?.restoreWorkspace(savedWorkspace||EMPTY_WORKSPACE());
        if(!value?.plan||typeof value.plan!=='object')return;
        // Preserve the former plugin project slice and upgrade its mode field.
        const old=value.plan;
        const candidate={...old,kind:old.kind||(old.mode==='timed'?'it':old.mode||'iv')};
        try{storedPlan={...planner.normalizePlan(candidate)};ui?.restorePlan(storedPlan);preview();}catch{}
      },
      reset:()=>{storedPlan={};savedWorkspace=null;ui?.restoreWorkspace(EMPTY_WORKSPACE());}
    });
    function publishMeasurement(result={}){
      if(!ctx.data?.model?.createTable||!ctx.data?.artifacts?.upsert)
        throw Error('DKDS Artifact 数据中心接口不可用');
      const x=Array.from(result.xValues||[]),y=Array.from(result.yValues||[]);
      if(x.length<2||x.length!==y.length||x.length>1000000)
        throw Error('原始测量数据必须包含等长的 X/Y 数组，且为 2 至 1000000 个点');
      if(!x.every(Number.isFinite)||!y.every(Number.isFinite))
        throw Error('原始测量数据包含非有限数值');
      const id='dkts-4200-'+Date.now()+'-'+Math.random().toString(36).slice(2,8);
      const artifact=ctx.data.model.createTable({
        id,name:String(result.name||'Keithley 4200A 原始测量'),
        semanticType:'science.instrument.4200.raw',transient:false,
        metadata:{instrument:'Keithley 4200A',model:controller.status().identity?.model||'KI4200A',
          serial:controller.status().identity?.serial||'',measurementKind:String(result.kind||'unknown'),
          rawInstrumentData:true,processing:'none',dataAssignments:[]},
        columns:[
          {key:String(result.xKey||'X'),name:String(result.xName||'X'),unit:String(result.xUnit||''),role:'x',values:x},
          {key:String(result.yKey||'Y'),name:String(result.yName||'Y'),unit:String(result.yUnit||''),role:'y',values:y}
        ],
        provenance:[{type:'acquisition',label:'Keithley 4200A 原始仪器数据',
          producer:'com.dkts.keithley-4200',operation:'instrument-acquisition',
          source:{model:controller.status().identity?.model||'KI4200A',
            serial:controller.status().identity?.serial||''}}]
      });
      ctx.data.artifacts.upsert(artifact);
      return {id:artifact.id,kind:artifact.kind,rowCount:x.length};
    }
    ctx.capabilities.register('instrument.dkts-keithley-4200',{
      kind:'instrument.connection',title:'DK Test Studio 4200A KXCI',
      remote:false,
      methods:{
        status:()=>({connected:controller.status().phase==='connected',
          identified:controller.status().identity,
          sessionEndpoint:controller.status().route,
          inventory:controller.status().inventory,
          runningSimulation:false,
          execution:execution.status()}),
        connect,identify:connect,disconnect,inspectModules:()=>controller.inspectModules(),
        executionStatus:()=>execution.status(),
        validatePlan:()=>plan(),previewPlan:()=>planner.previewPlan(plan()),
        validateWaveform:(points,options)=>waveform.validateWaveform(points,options),
        publishMeasurement,
        parseWaveformText:text=>waveform.parseWaveformText(text),
        exportPlan,importPlan
      }
    });
    try{preview();}catch{}
    return {deactivate(){
      disposed=true;
      statusItem.remove?.();
      ui?.dispose?.();ui=null;
      void controller.dispose();
    }};
  });
})();
