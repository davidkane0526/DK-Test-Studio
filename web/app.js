'use strict';
const $=id=>document.getElementById(id);
// Android WebView has native system bars, not desktop caption/window controls.
if(typeof window.DKTSNative?.request==='function')
  document.body.classList.add('dkts-android-shell');
// UI badge stays hidden until a click on the actual native version.
// Each opening triggers an immediate verified UI-only update check.
const nativeBadge=$('native-version-badge');
const uiBadge=$('ui-version-badge');
const updateStatus=$('ui-update-state');
let uiCheckBusy=false;
function displayUiVersion(){
  const raw=document.querySelector('meta[name="dkts-ui-version"]')?.content||'bundled';
  const isSha=/^[a-f0-9]{40}$/i.test(raw);
  $('ui-version-text').textContent=isSha?'UI '+raw.slice(0,8):'UI 内置';
  uiBadge.setAttribute('aria-label',isSha?'完整 UI 版本：'+raw:'当前使用内置界面资源');
}
displayUiVersion();
async function displayNativeVersion(){
  try{
    let version='';
    if(window.DKTSClient?.nativeVersion)version=await window.DKTSClient.nativeVersion();
    else {
      const response=await fetch('/api/app/version',{cache:'no-store'});
      if(response.ok)version=String((await response.json()).version||'');
    }
    if(/^\d+\.\d+\.\d+$/.test(version))nativeBadge.textContent='v'+version;
  }catch{/* Keep bundled version if unavailable offline. */}
}
void displayNativeVersion();
async function checkUiUpdateNow(){
  if(uiCheckBusy)return;
  uiCheckBusy=true;updateStatus.textContent='正在检查热更新…';
  try{
    if(window.DKTSClient?.checkUiUpdate){
      await window.DKTSClient.checkUiUpdate();
      for(let index=0;index<18;index++){
        await new Promise(resolve=>setTimeout(resolve,900));
        const result=await window.DKTSClient.uiUpdateStatus();
        if(result.status==='updated'){
          updateStatus.textContent='更新已验证，正在刷新界面…';return;
        }
        if(result.status==='current'){updateStatus.textContent='UI 已是最新版本';return;}
        if(result.status==='offline'){
          updateStatus.textContent='检查失败：'+String(result.error||'网络不可用').slice(0,72);return;
        }
      }
      updateStatus.textContent='检查继续在后台执行';
    }else if(window.DKTSClient)updateStatus.textContent='请安装新版 APK 以使用手动检查';
    else {
      const response=await fetch('/api/ui/check',{method:'POST',cache:'no-store',
        headers:{'Content-Type':'application/json','X-DKTS-Request':'1'},body:'{}'});
      if(!response.ok)throw Error('更新接口 HTTP '+response.status);
      const result=await response.json();
      if(result.updated){
        updateStatus.textContent='更新已安装，正在刷新…';
        if(!window.DKTSMeasurementRunning)window.location.reload();
      }else if(result.error)updateStatus.textContent='检查失败：'+String(result.error).slice(0,72);
      else updateStatus.textContent=result.status==='disabled'
        ?'当前浏览器模式未启用自动更新':'UI 已是最新版本';
    }
  }catch(error){updateStatus.textContent='检查失败：'+String(error.message||error).slice(0,72);}
  finally{uiCheckBusy=false;}
}
// Native APK/portable updates are separate from UI-only hot updates.
// Clicking the version checks both; no update binary is executed from HTML.
const nativeAppState=$('native-app-update-state');
const nativeAppAction=$('native-app-update-action');
const nativeAppApi=window.DKTSClient?.checkAppUpdate
  ?window.DKTSClient
  :window.DKTSWindow?.checkAppUpdate
    ?window.DKTSWindow:null;
let nativeAppCheckBusy=false,nativeAppPolling=false;
function nativeUpdateDisplay(result){
  const status=String(result?.status||'idle');
  const version=String(result?.version||'').slice(0,32);
  const error=String(result?.error||'').slice(0,105);
  nativeBadge.classList.toggle('has-native-update',status==='available'||status==='ready');
  nativeAppAction.hidden=!(status==='available'||status==='ready');
  nativeAppAction.disabled=false;
  nativeAppAction.textContent=status==='ready'?'继续安装':'下载并安装';
  const label={
    idle:'点击版本号检查程序更新',
    checking:'正在检查完整程序更新…',
    current:'已是最新程序版本',
    available:'发现程序更新 v'+version,
    downloading:'正在下载更新：'+Math.max(0,Math.min(100,Number(result.progress)||0))+'%',
    ready:'更新文件已验证，可以安装',
    permission:'请在系统设置中允许安装，返回后继续',
    installer:'已打开 Android 系统安装界面',
    restarting:'已下载并验证，正在重启便携程序…',
    unsupported:'当前模式不支持程序内安装',
    error:'程序更新失败：'+error
  };
  nativeAppState.textContent=label[status]||'程序更新状态：'+status;
}
async function pollNativeUpdate(){
  if(!nativeAppApi?.appUpdateStatus||nativeAppPolling)return;
  nativeAppPolling=true;
  try{
    for(let i=0;i<220;i++){
      if(i)await new Promise(resolve=>setTimeout(resolve,1300));
      const result=await nativeAppApi.appUpdateStatus();
      nativeUpdateDisplay(result);
      if(!['checking','downloading'].includes(result?.status))return;
    }
    nativeAppState.textContent='更新继续在后台进行，可稍后再查看';
  }catch(error){nativeAppState.textContent='状态查询失败：'+String(error.message||error).slice(0,90);}
  finally{nativeAppPolling=false;}
}
async function checkNativeAppUpdate(){
  if(nativeAppCheckBusy||!nativeAppApi){nativeUpdateDisplay({status:'unsupported'});return;}
  nativeAppCheckBusy=true;
  nativeUpdateDisplay({status:'checking'});
  try{
    const result=await nativeAppApi.checkAppUpdate();
    if(result?.status)nativeUpdateDisplay(result);
    await pollNativeUpdate();
  }catch(error){nativeUpdateDisplay({status:'error',error:String(error.message||error)});}
  finally{nativeAppCheckBusy=false;}
}
nativeAppAction.addEventListener('click',async()=>{
  if(!nativeAppApi?.installAppUpdate)return;
  nativeAppAction.disabled=true;
  nativeAppAction.hidden=true;
  try{
    const result=await nativeAppApi.installAppUpdate();
    if(result?.status)nativeUpdateDisplay(result);
    if(!nativeAppPolling)void pollNativeUpdate();
  }catch(error){nativeUpdateDisplay({status:'error',error:String(error.message||error)});}
});
if(!nativeAppApi)nativeUpdateDisplay({status:'unsupported'});

nativeBadge.addEventListener('click',()=>{
  const opening=uiBadge.hidden;
  uiBadge.hidden=!opening;
  nativeBadge.setAttribute('aria-expanded',String(opening));
  if(opening){
    void checkUiUpdateNow();
    void checkNativeAppUpdate();
  }
});
document.addEventListener('pointerdown',event=>{
  if(!uiBadge.hidden&&!uiBadge.contains(event.target)&&event.target!==nativeBadge){
    uiBadge.hidden=true;nativeBadge.setAttribute('aria-expanded','false');
  }
});
if(nativeAppApi)setTimeout(()=>{if(!nativeAppCheckBusy)void checkNativeAppUpdate();},7500);
const form=$('connection-form'),planForm=$('plan-form');
const dialog=$('connection-dialog'),statusButton=$('connection-status');
const reconnect=$('reconnect-instrument'),disconnect=$('disconnect-instrument');
let state='disconnected',busy=false;
const messages=[];
function showStatusMessage(message,level='info',record=true,display=true){
  const value=String(message||'').slice(0,300);
  // Instrument connection owns its one status button; connectivity events go
  // into history without overwriting the unrelated operational message.
  if(display){
    $('status-message-text').textContent=value;
    $('status-message').title=value+' · 点击查看历史消息';
    $('status-message-dot').dataset.level=level;
  }
  if(record){
    messages.unshift({time:new Date().toLocaleTimeString('zh-CN',{hour12:false}),message:value});
    if(messages.length>30)messages.pop();
    const list=$('status-log-entries');
    list.replaceChildren();
    for(const item of messages){
      const entry=document.createElement('li');
      const time=document.createElement('time');time.textContent=item.time;
      const text=document.createElement('span');text.textContent=item.message;
      entry.append(time,text);list.appendChild(entry);
    }
  }
}
function initWindowControls(){
  const host=window.DKTSWindow;
  if(!host)return; // Browser and Android show the custom title bar without native window controls.
  const actions=$('window-actions');
  actions.hidden=false;
  document.body.classList.add('dkts-desktop-shell');
  $('window-minimize').addEventListener('click',()=>{void host.minimize();});
  $('window-close').addEventListener('click',()=>{void host.close();});
  const maximize=$('window-maximize');
  const updateMax=(isMaximized)=>{
    maximize.dataset.maximized=String(isMaximized);
    maximize.title=isMaximized?'还原窗口':'最大化';
    maximize.setAttribute('aria-label',maximize.title);
  };
  maximize.addEventListener('click',async()=>{updateMax(Boolean(await host.toggleMaximize()));});
  void host.isMaximized().then(updateMax).catch(()=>{});
  host.onMaximizedChange?.(updateMax);
}
initWindowControls();
showStatusMessage('就绪 · 选择测试方式');
async function post(route,data={}){
  if(window.DKTSClient)return window.DKTSClient.post(route,data);
  const res=await fetch(route,{method:'POST',
    headers:{'Content-Type':'application/json','X-DKTS-Request':'1'},
    body:JSON.stringify(data),cache:'no-store'});
  return res.json();
}
function fields(){
  const f=new FormData(form);return Object.fromEntries(f.entries());
}
function renderStatus(value){
  state=value.phase||'disconnected';
  const connected=state==='connected';
  const label=connected?'连接成功':state==='connecting'?'正在连接…':state==='error'?'连接失败':'未连接';
  $('state-chip').textContent=label;
  $('dot').dataset.phase=state;
  statusButton.setAttribute('aria-label',label+'，点击查看仪器连接详情');
  $('connection-summary').textContent=value.summary||label;
  const route=value.route;
  $('route-line').textContent=route
    ?[route.remoteAddress+':'+route.remotePort,route.interfaceName||'系统路由',route.localAddress].filter(Boolean).join(' · ')
    :String(fields().host||'169.254.111.118')+':'+String(fields().port||1225);
  const identity=value.identity;
  $('identity-line').textContent=identity
    ?[identity.model||'4200A',identity.serial?'序列号 '+identity.serial:'',identity.version||''].filter(Boolean).join(' · ')
    :'尚未识别';
  const inventory=value.inventory;
  const modules=inventory?.knownModules||[];
  $('module-summary').textContent=inventory
    ?(modules.length?modules.map(x=>x.raw).join(' · '):'未识别到已知模块')+'（额定参数未核验）'
    :value.inventoryError?'查询失败：'+String(value.inventoryError).slice(0,90):'尚未查询';
  const detail=String(value.diagnostic||'');
  $('diagnostic-wrap').hidden=!detail;
  $('diagnostic').textContent=detail.slice(0,6000);
  $('diagnostic-wrap').open=false;
  reconnect.disabled=busy;
  disconnect.disabled=busy||!connected;
  reconnect.textContent=busy?'正在连接…':connected?'应用设置并重连':'重新连接';
  if(state!==renderStatus.lastPhase){
    renderStatus.lastPhase=state;
    const statusDetail=state==='connected'?'4200A 连接成功 · 只读模式':
      state==='error'?'连接失败 · 点击底栏连接状态查看详情':
      state==='connecting'?'正在连接 4200A…':'4200A 已断开连接';
    showStatusMessage(statusDetail,state==='error'?'error':connected?'success':'info',true,false);
  }
}
let latestStatus={phase:'disconnected',summary:'未连接'};
async function refresh(){
  try{
    if(window.DKTSClient){latestStatus=await window.DKTSClient.status();return latestStatus;}
    const response=await fetch('/api/status',{cache:'no-store'});
    latestStatus=await response.json();
  }catch{}
  return latestStatus;
}
async function connectInstrument(){
  if(busy)return;
  busy=true;
  renderStatus({phase:'connecting',summary:'正在自动识别仪器'});
  try{
    let result=await post('/api/connect',fields());
    if(result.phase==='connected')result=await post('/api/modules/inspect');
    latestStatus=result;
  }catch(error){
    latestStatus={phase:'error',summary:'本地连接服务异常',diagnostic:String(error)};
  }finally{
    busy=false;
    renderStatus(latestStatus);
  }
}
async function disconnectInstrument(){
  if(busy||state!=='connected')return;
  busy=true;renderStatus(latestStatus);
  try{latestStatus=await post('/api/disconnect');}
  catch(error){latestStatus={phase:'error',summary:'断开连接失败',diagnostic:String(error)};}
  finally{busy=false;renderStatus(latestStatus);}
}
function openConnectionDialog(){
  if(!dialog.open)dialog.showModal();
}
function closeConnectionDialog(){
  if(dialog.open)dialog.close();
}

/* Interactive measured-data plot. Only actual acquisition rows may be supplied
 * by a future instrument adapter; no plan/preview values are used as data. */
/* The full DKDS scientific D3 renderer (not the old simplified SVG).
 * Only actual hardware rows are plotted; planning values never impersonate measurements. */
const measurementPlot=(()=>{
  const host=$('measurement-plot');
  const library=window.DKDSCharts;
  if(!library?.react || !window.DKDSD3Renderer?.react)
    throw new Error('Bundled DKDS scientific renderer failed to initialize');
  const navIcon={
    grip:'<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="5" cy="4" r="1"/><circle cx="11" cy="4" r="1"/><circle cx="5" cy="8" r="1"/><circle cx="11" cy="8" r="1"/><circle cx="5" cy="12" r="1"/><circle cx="11" cy="12" r="1"/></svg>',
    in:'<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3v10M3 8h10"/></svg>',
    out:'<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h10"/></svg>',
    home:'<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 7.6 8 3l5.5 4.6M4.3 6.8V13h7.4V6.8"/></svg>'
  };
  let kind='iv',rows=[],xMode='linear',sequence=0,resizeObserver=null;
  const isAndroid=document.body.classList.contains('dkts-android-shell');
  if(isAndroid){
    document.documentElement.classList.add('react-native-client');
    document.documentElement.dataset.dkdsHost='mobile';
  }
  function decorateNav(){
    const bar=host.querySelector('.dkds-scientific-nav-tools');if(!bar)return;
    bar.setAttribute('role','toolbar');bar.setAttribute('aria-label','图形导航与拖动');
    const grip=bar.querySelector('.dkds-scientific-nav-drag');
    if(grip){grip.innerHTML=navIcon.grip;grip.removeAttribute('title');grip.setAttribute('aria-label','拖动绘图工具条');}
    for(const [action,icon] of [['zoom-in','in'],['zoom-out','out'],['home','home']]){
      const button=bar.querySelector('[data-action="'+action+'"]');
      if(button){button.innerHTML=navIcon[icon];button.removeAttribute('title');}
    }
  }
  function xValue(row){
    if(kind==='iv')return row.voltageV;
    if(kind==='transfer')return row.gateVoltageV??row.voltageV;
    if(kind==='output')return row.drainVoltageV??row.voltageV;
    if(kind==='endurance')return row.cycle??row.cycleIndex??row.timeS;
    return row.timeS;
  }
  function xTitle(){
    if(kind==='iv')return 'Voltage (V)';
    if(kind==='transfer')return 'Gate voltage (V)';
    if(kind==='output')return 'Drain voltage (V)';
    if(kind==='endurance')return 'Cycle';
    return 'Time (s)';
  }
  function normalizeRows(raw){
    if(!Array.isArray(raw))throw TypeError('Expected instrument raw rows');
    return raw.filter(row=>row&&Number.isFinite(row.currentA)&&Number.isFinite(xValue(row)))
      .map(row=>({...row}));
  }
  const trace=()=>rows.length?[{
    type:'scatter',mode:'lines+markers',name:'4200A 实测',
    x:rows.map(row=>xValue(row)),
    y:rows.map(row=>row.currentA),
    line:{width:1.6,color:'#3d77b6'},marker:{size:4,color:'#3d77b6'},
    meta:{source:'instrument-raw',measurement:true}
  }]:[];
  const layout=()=>({
    autosize:true,showlegend:false,
    margin:{l:65,r:16,t:20,b:48},
    paper_bgcolor:'rgba(0,0,0,0)',plot_bgcolor:'rgba(0,0,0,0)',
    xaxis:{title:xTitle(),type:xMode,automargin:true,showgrid:true,zeroline:false},
    yaxis:{title:'Current (A)',type:'linear',automargin:true,showgrid:true,zeroline:false}
  });
  const config={responsive:true,displaylogo:false,scrollZoom:true,
    doubleClick:'reset+autosize',__dkdsNavigationTools:true,dkdsRenderer:'d3'};
  async function render(){
    const revision=++sequence;
    try{
      await library.react(host,trace(),layout(),config);
      if(revision!==sequence)return;
      decorateNav();
      const empty=$('measurement-empty');empty.hidden=rows.length>0;
      if(isAndroid)host.classList.add('dkts-mobile-gesture-host');
    }catch(e){
      const empty=$('measurement-empty');
      empty.hidden=false;empty.textContent='绘图内核异常：'+String(e.message||e).slice(0,100);
    }
  }
  function selectTest(testKind,rawRows=[]){
    kind=testKind;
    rows=normalizeRows(rawRows);
    xMode='linear';
    void render();
  }
  function setMeasurements(raw){
    rows=normalizeRows(raw);
    void render();
    return rows.map(row=>({...row}));
  }
  function dblclick(e){
    const target=e.target;
    const cls=String(target?.getAttribute?.('class')||'');
    const rect=host.getBoundingClientRect(),size=host._fullLayout?._size;
    if(!size||!rect.width||!rect.height)return;
    const px=e.clientX-rect.left,py=e.clientY-rect.top;
    const xHit=/xaxis|x-axis|xtick|xtitle|dkds-d3-x-axis/i.test(cls)||
      (px>=size.l-10&&px<=size.l+size.w+10&&py>=size.t+size.h-2&&py<=rect.height);
    if(!xHit)return; // Native DKDS handler owns Y-axis double-click mode.
    e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
    xMode=xMode==='linear'?'log':'linear';
    void render();
  }
  host.addEventListener('dblclick',dblclick,true);
  // DKDS touch drag (native capture) owns the grip; normal single-finger
  // vertical panning must remain available outside a deliberate chart gesture.
  if(isAndroid) {
    let pinch=null,lastTap=null;
    const coord=e=>{const r=host.getBoundingClientRect();return {x:e.clientX-r.left,y:e.clientY-r.top};};
    const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
    host.addEventListener('touchstart',event=>{
      if(event.touches.length!==2){pinch=null;return;}
      const a=coord(event.touches[0]),b=coord(event.touches[1]);
      pinch={span:dist(a,b),center:{x:(a.x+b.x)/2,y:(a.y+b.y)/2},
        range:host._fullLayout?{x:host._fullLayout.xaxis?.range?.slice(),y:host._fullLayout.yaxis?.range?.slice()}:null};
    },{passive:true});
    let nextFrame=0;
    host.addEventListener('touchmove',event=>{
      if(event.touches.length!==2||!pinch?.range)return;
      if(event.cancelable)event.preventDefault();
      const a=coord(event.touches[0]),b=coord(event.touches[1]),span=dist(a,b);
      const factor=Math.max(.2,Math.min(5,pinch.span/Math.max(1,span)));
      if(nextFrame)cancelAnimationFrame(nextFrame);
      nextFrame=requestAnimationFrame(()=>{
        nextFrame=0;
        const patch={};
        for(const axis of ['x','y']){
          const initial=pinch?.range?.[axis];if(!Array.isArray(initial)||initial.length<2)continue;
          const low=Number(initial[0]),high=Number(initial[1]),mid=(low+high)/2;
          if(!Number.isFinite(low+high))continue;
          patch[axis+'axis.range']=[mid-(mid-low)*factor,mid+(high-mid)*factor];
          patch[axis+'axis.autorange']=false;
        }
        if(Object.keys(patch).length)void library.relayout(host,patch);
      });
    },{passive:false});
    host.addEventListener('touchend',event=>{if(event.touches.length<2)pinch=null;},{passive:true});
  }
  if(typeof ResizeObserver!=='undefined'){
    resizeObserver=new ResizeObserver(()=>{if(host.isConnected)library.resize(host);});
    resizeObserver.observe(host);
  }
  void render();
  return Object.freeze({selectTest,setMeasurements,reset:()=>void render(),
    get renderer(){return library.runtimeState().renderer;}});
})();
// The public acquisition API is bound after workspace-scoped history is initialized.

function drawWave(points){
  const svg=$('waveform-plot');svg.replaceChildren();
  const NS='http://www.w3.org/2000/svg',width=640,height=260,left=48,right=18,top=20,bottom=34;
  const times=points.map(p=>p.timeS),volts=points.map(p=>p.voltageV);
  const t0=Math.min(...times),t1=Math.max(...times);
  const v0=Math.min(...volts,0),v1=Math.max(...volts,0),vr=(v1-v0)||1,tr=(t1-t0)||1;
  const x=t=>left+(t-t0)/tr*(width-left-right);
  const y=v=>height-bottom-(v-v0)/vr*(height-top-bottom);
  const make=(tag,attrs)=>{const node=document.createElementNS(NS,tag);
    for(const [k,v] of Object.entries(attrs))node.setAttribute(k,String(v));svg.appendChild(node);return node;};
  for(const frac of [0,0.25,0.5,0.75,1]){
    const yy=top+frac*(height-top-bottom);
    make('line',{x1:left,y1:yy,x2:width-right,y2:yy,stroke:'currentColor','stroke-opacity':0.12});
  }
  const d=points.map((p,i)=>(i?'L':'M')+x(p.timeS).toFixed(2)+' '+y(p.voltageV).toFixed(2)).join(' ');
  make('path',{d,fill:'none',stroke:'#4068c4','stroke-width':2.5,'stroke-linecap':'round','stroke-linejoin':'round'});
  const lx=make('text',{x:width/2,y:height-6,'text-anchor':'middle','font-size':13,fill:'currentColor'});
  lx.textContent='Time (s)';
  const ly=make('text',{x:13,y:height/2,transform:'rotate(-90 13 '+height/2+')','text-anchor':'middle','font-size':13,fill:'currentColor'});
  ly.textContent='Voltage (V)';
}
async function validateWave(){
  const expectedTabId=getActiveWorkspace()?.id,expectedMode=activeMode;
  const info=$('waveform-info');
  try{
    const r=await post('/api/waveform/validate',{text:$('waveform-text').value});
    if(expectedTabId!==getActiveWorkspace()?.id||expectedMode!==activeMode)return;
    if(!r.ok)throw Error(r.error||'波形参数不正确');
    info.textContent=r.count+' 点 · 总时长 '+r.durationS+' s · 最小时间间隔 '+r.minimumStepS+' s · 未验证硬件可执行性';
    drawWave(r.preview);
    showStatusMessage('波形校验通过 · '+r.count+' 个规划点（无硬件输出）','success');
  }catch(error){
    if(expectedTabId!==getActiveWorkspace()?.id||expectedMode!==activeMode)return;
    info.textContent='校验失败：'+String(error.message||error).slice(0,120);
    showStatusMessage('波形校验失败：'+String(error.message||error).slice(0,90),'error');
    $('waveform-plot').replaceChildren();
  }
}
const TEST_MODES=Object.freeze({
  iv:{title:'SMU I–V 扫描',x:'Voltage (V)',xColumn:'电压 (V)',ready:true},
  it:{title:'SMU I–t 恒压读出',x:'Time (s)',xColumn:'时间 (s)',ready:true},
  transfer:{title:'转移特性',x:'Gate voltage (V)',xColumn:'栅极电压 (V)'},
  output:{title:'输出特性',x:'Drain voltage (V)',xColumn:'漏极电压 (V)'},
  pund:{title:'PMU / PUND',x:'Time (s)',xColumn:'时间 (s)'},
  retention:{title:'Retention',x:'Time (s)',xColumn:'时间 (s)'},
  endurance:{title:'Endurance',x:'Cycle',xColumn:'循环次数'},
  arbitrary:{title:'任意波形测量',x:'Time (s)',xColumn:'时间 (s)',planner:true}
});
function createWorkspaceStore(options = {}) {
  const tabs=[];
  const changed=()=>{if(typeof options.onChange==='function')options.onChange();};
  let activeTabId=null;
  let tabSerial=0,idSerial=0;
  const idFactory=typeof options.idFactory==='function'?options.idFactory:null;
  function clone(value){
    if(value===undefined)return undefined;
    return JSON.parse(JSON.stringify(value));
  }
  function cloneRows(rows){
    if(!Array.isArray(rows))throw new TypeError('Measurement rows must be an array');
    return rows.map(row=>clone(row));
  }
  function requiredText(value,label){
    const next=String(value??'').trim();
    if(!next)throw new TypeError(label+' must not be empty');
    return next;
  }
  function makeId(kind){
    if(idFactory)return requiredText(idFactory(kind),kind+' id');
    return kind+'-'+Date.now().toString(36)+'-'+(++idSerial).toString(36);
  }
  function findTab(id){return tabs.find(tab=>tab.id===id)||null;}
  function createTab({name='',mode=null}={}){
    const index=++tabSerial;
    const tab={
      id:makeId('workspace'),
      name:String(name||'').trim()||'工作区 '+index,
      activeMode:mode==null?null:requiredText(mode,'test mode'),
      modeDrafts:Object.create(null),
      historyByMode:Object.create(null),
      dataByMode:Object.create(null),
      activeRunByMode:Object.create(null)
    };
    tabs.push(tab);activeTabId=tab.id;changed();return tab;
  }
  function listTabs(){return tabs.slice();}
  function getTab(id){return findTab(id);}
  function getActiveTab(){return findTab(activeTabId);}
  function activateTab(id){
    const tab=findTab(id);if(!tab)return null;
    activeTabId=tab.id;changed();return tab;
  }
  function closeTab(id){
    const index=tabs.findIndex(tab=>tab.id===id);
    if(index<0)return getActiveTab();
    const wasActive=activeTabId===id;
    tabs.splice(index,1);
    if(wasActive)activeTabId=tabs[Math.min(index,tabs.length-1)]?.id||null;
    changed();return getActiveTab();
  }
  function renameTab(id,name){
    const tab=findTab(id),next=String(name??'').trim();
    if(!tab||!next)return false;
    tab.name=next.slice(0,48);changed();return true;
  }
  function setMode(id,mode){
    const tab=findTab(id);if(!tab)return false;
    tab.activeMode=mode==null?null:requiredText(mode,'test mode');changed();return true;
  }
  function saveDraft(id,mode,draft){
    const tab=findTab(id),key=requiredText(mode,'test mode');
    if(!tab)return false;
    tab.modeDrafts[key]=clone(draft||{});changed();return true;
  }
  function getDraft(id,mode){
    const tab=findTab(id),key=requiredText(mode,'test mode');
    return tab&&Object.hasOwn(tab.modeDrafts,key)?clone(tab.modeDrafts[key]):null;
  }
  function getHistory(id,mode){
    const tab=findTab(id),key=requiredText(mode,'test mode');
    return tab?clone(tab.historyByMode[key]||[]):[];
  }
  function getData(id,mode){
    const tab=findTab(id),key=requiredText(mode,'test mode');
    return tab&&Object.hasOwn(tab.dataByMode,key)?clone(tab.dataByMode[key]):[];
  }
  function recordRun(id,mode,rawRows,metadata={}){
    const tab=findTab(id);if(!tab)throw new Error('Workspace tab not found');
    const key=requiredText(mode,'test mode'),rows=cloneRows(rawRows);
    const run={
      id:metadata.id?requiredText(metadata.id,'run id'):makeId('run'),
      mode:key,
      createdAt:metadata.createdAt||new Date().toISOString(),
      status:metadata.status||'completed',
      parameters:clone(metadata.parameters||{}),
      summary:String(metadata.summary||''),
      rawRows:rows
    };
    if(!tab.historyByMode[key])tab.historyByMode[key]=[];
    tab.historyByMode[key].push(run);
    tab.dataByMode[key]=cloneRows(rows);
    tab.activeRunByMode[key]=run.id;
    changed();return clone(run);
  }
  function updateRun(id,mode,runId,rawRows,metadata={}){
    const tab=findTab(id),key=requiredText(mode,'test mode');
    if(!tab)return null;
    const run=(tab.historyByMode[key]||[]).find(item=>item.id===runId);
    if(!run)return null;
    run.rawRows=cloneRows(rawRows);
    if(metadata.status)run.status=metadata.status;
    if(metadata.summary!==undefined)run.summary=String(metadata.summary||'');
    if(metadata.parameters!==undefined)run.parameters=clone(metadata.parameters||{});
    tab.dataByMode[key]=cloneRows(run.rawRows);
    tab.activeRunByMode[key]=run.id;
    changed();return clone(run);
  }
  function appendRunRows(id,mode,runId,rows){
    const tab=findTab(id),key=requiredText(mode,'test mode');
    if(!tab)return null;
    const run=(tab.historyByMode[key]||[]).find(item=>item.id===runId);
    if(!run)return null;
    run.rawRows.push(...cloneRows(rows));
    tab.dataByMode[key]=cloneRows(run.rawRows);
    tab.activeRunByMode[key]=run.id;
    changed();return clone(run);
  }
  function selectRun(id,mode,runId){
    const tab=findTab(id),key=requiredText(mode,'test mode');
    if(!tab)return null;
    const run=(tab.historyByMode[key]||[]).find(item=>item.id===runId);
    if(!run)return null;
    tab.dataByMode[key]=cloneRows(run.rawRows);
    tab.activeRunByMode[key]=run.id;
    changed();return clone(run);
  }
  function getActiveRunId(id,mode){
    const tab=findTab(id),key=requiredText(mode,'test mode');
    return tab?.activeRunByMode[key]||null;
  }
  function snapshot(){
    return {
      schema:'dkts.workspace.v1',
      activeTabId,tabSerial,idSerial,
      tabs:tabs.map(tab=>clone(tab))
    };
  }
  function restore(saved){
    if(!saved||saved.schema!=='dkts.workspace.v1'||!Array.isArray(saved.tabs)||
       saved.tabs.length>500)throw Error('不受支持的工作区数据格式');
    const next=[],ids=new Set();
    const dictionary=value=>{
      const result=Object.create(null);
      if(value&&typeof value==='object'&&!Array.isArray(value))
        for(const [key,item] of Object.entries(value)){
          if(['__proto__','prototype','constructor'].includes(key))continue;
          result[key]=clone(item);
        }
      return result;
    };
    for(const item of saved.tabs){
      if(!item||typeof item!=='object'||Array.isArray(item)||
         typeof item.id!=='string'||!item.id||item.id.length>128||
         ids.has(item.id))throw Error('工作区 ID 重复或无效');
      ids.add(item.id);
      const mode=typeof item.activeMode==='string'&&item.activeMode
        ?item.activeMode:null;
      next.push({
        id:item.id,
        name:typeof item.name==='string'&&item.name.trim()
          ?item.name.trim().slice(0,48):'工作区',
        activeMode:mode,
        modeDrafts:dictionary(item.modeDrafts),
        historyByMode:dictionary(item.historyByMode),
        dataByMode:dictionary(item.dataByMode),
        activeRunByMode:dictionary(item.activeRunByMode)
      });
    }
    tabs.splice(0,tabs.length,...next);
    activeTabId=ids.has(saved.activeTabId)?saved.activeTabId:(tabs[0]?.id||null);
    tabSerial=Math.max(tabs.length,Number.isSafeInteger(saved.tabSerial)?saved.tabSerial:0);
    idSerial=Math.max(tabs.length,Number.isSafeInteger(saved.idSerial)?saved.idSerial:0);
    return true;
  }
  return Object.freeze({
    createTab,listTabs,getTab,getActiveTab,activateTab,closeTab,renameTab,
    setMode,saveDraft,getDraft,getHistory,getData,recordRun,updateRun,
    appendRunRows,selectRun,getActiveRunId,snapshot,restore
  });
}
const workspaceStore=createWorkspaceStore({onChange:scheduleWorkspaceSave});
let workspaceStorageReady=false;
let workspaceStorageFailed=false;
let workspaceChangeDuringLoad=false;
let workspaceSaveTimer=null;
let workspaceSaveQueue=Promise.resolve();
let lastWorkspaceSaveError='';
async function persistWorkspaceState(){
  if(!workspaceStorageReady||workspaceStorageFailed)return;
  if(workspaceSaveTimer!==null)clearTimeout(workspaceSaveTimer);
  workspaceSaveTimer=null;
  const snapshot=workspaceStore.snapshot();
  workspaceSaveQueue=workspaceSaveQueue.catch(()=>{}).then(async()=>{
    const result=await post('/api/workspaces',{workspace:snapshot});
    if(!result?.ok)throw Error(result?.error||'工作区数据保存未获确认');
    lastWorkspaceSaveError='';
  });
  try{await workspaceSaveQueue;}
  catch(error){
    const message=String(error.message||error).slice(0,110);
    if(message!==lastWorkspaceSaveError){
      lastWorkspaceSaveError=message;
      showStatusMessage('工作区保存失败：'+message,'error');
    }
  }
}
function scheduleWorkspaceSave(){
  if(workspaceStorageFailed)return;
  if(!workspaceStorageReady){workspaceChangeDuringLoad=true;return;}
  if(workspaceSaveTimer!==null)clearTimeout(workspaceSaveTimer);
  workspaceSaveTimer=setTimeout(()=>void persistWorkspaceState(),220);
}
function applyWorkspaceSnapshot(snapshot){
  if(!snapshot)return;
  workspaceStore.restore(snapshot);
  const tab=workspaceStore.getActiveTab();
  activeMode=tab?.activeMode&&Object.hasOwn(TEST_MODES,tab.activeMode)
    ?tab.activeMode:null;
  if(activeMode)restoreTabDraft(activeMode);
  else resetModeInputs('iv');
  renderTestSelection();
}
async function loadWorkspaceState(){
  try{
    const result=window.DKTSClient?.loadWorkspace
      ?await window.DKTSClient.loadWorkspace()
      :await fetch('/api/workspaces',{cache:'no-store'}).then(async response=>{
        const json=await response.json();
        if(!response.ok)throw Error(json.error||'工作区读取失败');
        return json;
      });
    if(!result?.ok)throw Error(result?.error||'工作区读取失败');
    if(!workspaceChangeDuringLoad&&result.workspace)applyWorkspaceSnapshot(result.workspace);
    workspaceStorageReady=true;
    if(workspaceChangeDuringLoad)void persistWorkspaceState();
  }catch(error){
    workspaceStorageFailed=true;
    showStatusMessage('工作区读取失败，已停止自动覆盖旧数据：'+
      String(error.message||error).slice(0,95),'error');
  }
}
window.DKTSWorkspaceState=Object.freeze({
  snapshot:()=>workspaceStore.snapshot(),
  restore:snapshot=>{
    if(!snapshot)return;
    workspaceChangeDuringLoad=true;
    applyWorkspaceSnapshot(snapshot);
    if(workspaceStorageReady)scheduleWorkspaceSave();
  }
});
document.addEventListener('visibilitychange',()=>{
  if(document.visibilityState==='hidden'&&workspaceStorageReady)
    void persistWorkspaceState();
});
window.addEventListener('pagehide',()=>{
  if(workspaceStorageReady)void persistWorkspaceState();
});
let activeMode=null;
const detail=$('test-detail');
const getActiveWorkspace=()=>workspaceStore.getActiveTab();

function resetModeInputs(mode='iv'){
  planForm.reset();
  $('test-kind').value=mode;
  $('waveform-text').value=$('waveform-text').defaultValue;
  $('waveform-info').textContent='输入波形仅作规划，不会输出到仪器';
  $('waveform-plot').replaceChildren();
  $('plan-status').textContent='仅校验方案，尚未开放实机执行。';
}
function rememberTabDraft(){
  const tab=getActiveWorkspace();
  if(!tab||!activeMode)return;
  const formValues={};
  for(const control of planForm.elements){
    if(!control.name)continue;
    formValues[control.name]=control.value;
  }
  workspaceStore.saveDraft(tab.id,activeMode,{formValues,waveform:$('waveform-text').value});
}
function restoreTabDraft(mode){
  resetModeInputs(mode);
  const tab=getActiveWorkspace();
  const draft=tab?workspaceStore.getDraft(tab.id,mode):null;
  if(!draft)return;
  for(const control of planForm.elements){
    if(control.name&&Object.hasOwn(draft.formValues||{},control.name))
      control.value=draft.formValues[control.name];
  }
  $('waveform-text').value=draft.waveform??$('waveform-text').defaultValue;
  $('test-kind').value=mode;
}
function beginTabRename(tabId,button){
  const tab=workspaceStore.getTab(tabId);
  if(!tab||!button?.isConnected)return;
  const editor=document.createElement('input');
  editor.type='text';editor.className='workspace-tab-rename';
  editor.maxLength=48;editor.value=tab.name;
  editor.setAttribute('aria-label','重命名工作区');
  button.replaceWith(editor);
  let finished=false;
  const finish=save=>{
    if(finished)return;
    finished=true;
    if(save)workspaceStore.renameTab(tabId,editor.value);
    renderWorkspaceTabs();
  };
  editor.addEventListener('keydown',event=>{
    if(event.key==='Enter'){event.preventDefault();finish(true);}
    else if(event.key==='Escape'){event.preventDefault();finish(false);}
  });
  editor.addEventListener('blur',()=>finish(true));
  editor.focus({preventScroll:true});editor.select();
}
function bindTabRenameGestures(button,tabId){
  let timer=null,pointerId=null,startX=0,startY=0;
  const cancel=()=>{
    if(timer!==null)clearTimeout(timer);
    timer=null;pointerId=null;
  };
  if(!document.body.classList.contains('dkts-android-shell'))return;
  button.addEventListener('pointerdown',event=>{
    if(!['touch','pen'].includes(event.pointerType)||event.button!==0)return;
    cancel();pointerId=event.pointerId;startX=event.clientX;startY=event.clientY;
    timer=setTimeout(()=>{
      timer=null;
      beginTabRename(tabId,button);
    },560);
  },{passive:true});
  button.addEventListener('pointermove',event=>{
    if(timer===null||event.pointerId!==pointerId)return;
    if(Math.hypot(event.clientX-startX,event.clientY-startY)>9)cancel();
  },{passive:true});
  for(const name of ['pointerup','pointercancel','pointerleave'])
    button.addEventListener(name,event=>{if(pointerId===event.pointerId)cancel();},{passive:true});
  button.addEventListener('contextmenu',event=>{
    event.preventDefault();cancel();beginTabRename(tabId,button);
  });
}
function renderWorkspaceTabs(){
  const nav=$('workspace-tabs');
  if(!nav.dataset.renameBound){
    nav.dataset.renameBound='true';
    nav.addEventListener('dblclick',event=>{
      const button=event.target.closest('.workspace-tab');
      const item=button?.closest('.workspace-tab-item');
      if(!button||!item)return;
      event.preventDefault();event.stopPropagation();
      beginTabRename(item.dataset.workspaceId,button);
    });
  }
  nav.querySelectorAll('.workspace-tab-item').forEach(node=>node.remove());
  const activeId=getActiveWorkspace()?.id||null;
  $('tab-home').classList.toggle('is-active',false);
  for(const workspace of workspaceStore.listTabs()){
    const item=document.createElement('div');
    item.className='workspace-tab-item';
    item.dataset.workspaceId=workspace.id;
    const select=document.createElement('button');
    select.type='button';select.className='workspace-tab';
    select.setAttribute('role','tab');
    select.setAttribute('aria-selected',String(activeId===workspace.id));
    select.setAttribute('aria-controls',activeId===workspace.id&&workspace.activeMode?'test-detail':'test-library');
    select.classList.toggle('is-active',activeId===workspace.id);
    select.textContent=workspace.name;select.title=workspace.name;
    select.addEventListener('click',()=>activateWorkspaceTab(workspace.id));
    bindTabRenameGestures(select,workspace.id);
    const close=document.createElement('button');
    close.type='button';close.className='workspace-tab-close';
    close.setAttribute('aria-label','关闭'+workspace.name+'工作区');
    close.innerHTML='<svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" aria-hidden="true" focusable="false"><path d="M5.5 5.5l9 9m0-9-9 9"/></svg>';
    close.addEventListener('click',()=>closeWorkspaceTab(workspace.id));
    item.append(select,close);nav.appendChild(item);
  }
}
function createWorkspaceTab(){
  rememberTabDraft();
  const tab=workspaceStore.createTab();
  activeMode=null;resetModeInputs('iv');
  renderTestSelection();
  window.scrollTo({top:0,behavior:'instant'});
  $('test-types-title').setAttribute('tabindex','-1');
  $('test-types-title').focus({preventScroll:true});
  showStatusMessage('已创建'+tab.name+' · 请选择测试方式');
}
function activateWorkspaceTab(tabId){
  if(getActiveWorkspace()?.id===tabId)return;
  rememberTabDraft();
  const tab=workspaceStore.activateTab(tabId);
  if(!tab)return;
  activeMode=tab.activeMode;
  if(activeMode)restoreTabDraft(activeMode);
  else resetModeInputs('iv');
  renderTestSelection();
  window.scrollTo({top:0,behavior:'instant'});
}
function closeWorkspaceTab(tabId){
  const wasActive=getActiveWorkspace()?.id===tabId;
  if(wasActive)rememberTabDraft();
  const next=workspaceStore.closeTab(tabId);
  if(!wasActive){renderWorkspaceTabs();return;}
  activeMode=next?.activeMode||null;
  if(activeMode)restoreTabDraft(activeMode);
  else resetModeInputs('iv');
  renderTestSelection();
}
$('tab-home').addEventListener('click',createWorkspaceTab);

function modeXValue(row,mode){
  if(!row)return undefined;
  if(mode==='iv')return row.voltageV;
  if(mode==='transfer')return row.gateVoltageV??row.voltageV;
  if(mode==='output')return row.drainVoltageV??row.voltageV;
  if(mode==='endurance')return row.cycle??row.cycleIndex??row.timeS;
  return row.timeS;
}
function formatRawValue(value){
  if(!Number.isFinite(value))return '—';
  return String(Number(value.toPrecision(7)));
}
function renderMeasurementData(rawRows,mode){
  const rows=Array.isArray(rawRows)?rawRows:[];
  $('data-count').textContent=rows.length+' 点';
  const body=$('measurement-rows');body.replaceChildren();
  if(!rows.length){
    const tr=document.createElement('tr'),td=document.createElement('td');
    td.colSpan=4;td.className='empty-row';td.textContent='暂无该测试方式的实测数据';
    tr.appendChild(td);body.appendChild(tr);
    for(const id of ['readout-voltage','readout-current','readout-samples','readout-duration'])
      $(id).textContent='—';
    return;
  }
  const last=rows[rows.length-1];
  const voltage=Number.isFinite(last.voltageV)?last.voltageV:
    (['iv','transfer','output'].includes(mode)?modeXValue(last,mode):undefined);
  $('readout-voltage').textContent=formatRawValue(voltage);
  $('readout-current').textContent=formatRawValue(last.currentA);
  $('readout-samples').textContent=String(rows.length);
  const times=rows.map(row=>row.timeS).filter(Number.isFinite);
  $('readout-duration').textContent=times.length>1
    ?formatRawValue(Math.max(...times)-Math.min(...times)):'—';
  for(let index=0;index<rows.length;index++){
    const row=rows[index],tr=document.createElement('tr');
    for(const value of [index+1,modeXValue(row,mode),row.currentA,row.timeS]){
      const td=document.createElement('td');
      td.textContent=typeof value==='number'?formatRawValue(value):String(value??'—');
      tr.appendChild(td);
    }
    body.appendChild(tr);
  }
}
function renderMeasurementHistory(tab,mode){
  const history=workspaceStore.getHistory(tab.id,mode);
  const list=$('test-history-list');list.replaceChildren();
  $('test-history-count').textContent=history.length+' 次';
  const activeRunId=workspaceStore.getActiveRunId(tab.id,mode);
  if(!history.length){
    const empty=document.createElement('span');
    empty.className='history-empty';empty.textContent='暂无'+TEST_MODES[mode].title+'历史记录';
    list.appendChild(empty);return;
  }
  for(let index=history.length-1;index>=0;index--){
    const run=history[index],button=document.createElement('button');
    const date=new Date(run.createdAt);
    const stamp=Number.isNaN(date.getTime())?'未知时间':
      date.toLocaleString('zh-CN',{hour12:false,month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});
    button.type='button';button.className='history-run';
    button.classList.toggle('is-active',run.id===activeRunId);
    button.setAttribute('role','listitem');
    button.setAttribute('aria-pressed',String(run.id===activeRunId));
    button.textContent=stamp+' · '+run.rawRows.length+' 点';
    button.title=(run.summary?run.summary+' · ':'')+run.status+' · '+run.rawRows.length+' 个原始数据点';
    button.addEventListener('click',()=>selectMeasurementHistory(tab.id,mode,run.id));
    list.appendChild(button);
  }
}
function selectMeasurementHistory(tabId,mode,runId){
  const run=workspaceStore.selectRun(tabId,mode,runId);
  if(!run)return null;
  renderStoredMeasurementState(tabId,mode);
  showStatusMessage('已加载'+TEST_MODES[mode].title+'历史数据 · '+run.rawRows.length+' 点');
  return run;
}
function currentParameterSnapshot(){
  return {
    form:Object.fromEntries(new FormData(planForm).entries()),
    waveform:$('waveform-text').value
  };
}
function renderStoredMeasurementState(tabId,mode){
  const active=getActiveWorkspace();
  if(!active||active.id!==tabId||activeMode!==mode)return;
  const rows=workspaceStore.getData(tabId,mode);
  measurementPlot.selectTest(mode,rows);
  renderMeasurementData(rows,mode);
  renderMeasurementHistory(active,mode);
}
function recordMeasurementRun(rawRows,metadata={}){
  const tab=getActiveWorkspace();
  if(!tab||!activeMode)throw new Error('请先创建工作区并选择测试方式');
  const run=workspaceStore.recordRun(tab.id,activeMode,rawRows,{
    ...metadata,parameters:metadata.parameters||currentParameterSnapshot()
  });
  renderStoredMeasurementState(tab.id,activeMode);
  return run.id;
}
function beginMeasurementRun(metadata={}){
  const tab=getActiveWorkspace();
  if(!tab||!activeMode)throw new Error('请先创建工作区并选择测试方式');
  const run=workspaceStore.recordRun(tab.id,activeMode,[],{
    ...metadata,status:'running',parameters:metadata.parameters||currentParameterSnapshot()
  });
  renderStoredMeasurementState(tab.id,activeMode);
  return {tabId:tab.id,mode:activeMode,runId:run.id};
}
function updateMeasurementRun(context,rawRows,metadata={}){
  if(!context?.tabId||!context?.mode||!context?.runId)throw new TypeError('Invalid measurement run context');
  const run=workspaceStore.updateRun(context.tabId,context.mode,context.runId,rawRows,metadata);
  if(!run)throw new Error('Measurement run not found');
  renderStoredMeasurementState(context.tabId,context.mode);
  return run.id;
}
function appendMeasurementRun(context,rawRows){
  if(!context?.tabId||!context?.mode||!context?.runId)throw new TypeError('Invalid measurement run context');
  const run=workspaceStore.appendRunRows(context.tabId,context.mode,context.runId,rawRows);
  if(!run)throw new Error('Measurement run not found');
  renderStoredMeasurementState(context.tabId,context.mode);
  return run.id;
}
function finishMeasurementRun(context,metadata={}){
  if(!context?.tabId||!context?.mode||!context?.runId)throw new TypeError('Invalid measurement run context');
  const run=workspaceStore.getHistory(context.tabId,context.mode).find(item=>item.id===context.runId);
  if(!run)throw new Error('Measurement run not found');
  return updateMeasurementRun(context,run.rawRows,{...metadata,status:metadata.status||'completed'});
}
window.DKTSMeasurementPlot=Object.freeze({
  selectTest:measurementPlot.selectTest,
  reset:measurementPlot.reset,
  setMeasurements(rawRows,metadata={}){
    if(metadata.runContext)return updateMeasurementRun(metadata.runContext,rawRows,metadata);
    const tab=getActiveWorkspace();
    if(metadata.runId&&tab&&activeMode)
      return updateMeasurementRun({tabId:tab.id,mode:activeMode,runId:metadata.runId},rawRows,metadata);
    return recordMeasurementRun(rawRows,metadata);
  },
  beginRun:beginMeasurementRun,
  updateRun:updateMeasurementRun,
  appendMeasurements:appendMeasurementRun,
  finishRun:finishMeasurementRun,
  selectRun(runId){
    const tab=getActiveWorkspace();
    if(!tab||!activeMode)return null;
    return selectMeasurementHistory(tab.id,activeMode,runId);
  },
  get renderer(){return measurementPlot.renderer;}
});

function renderTestSelection(){
  const tab=getActiveWorkspace();
  activeMode=tab?.activeMode||null;
  const mode=activeMode?TEST_MODES[activeMode]:null;
  const isEditable=Boolean(mode?.ready);
  const isWaveform=Boolean(mode?.planner);
  const active=Boolean(tab&&mode);
  $('test-library').hidden=active;
  detail.hidden=!active;
  detail.inert=!active;
  detail.setAttribute('aria-hidden',String(!active));
  document.querySelector('.workspace').classList.toggle('workspace-active',active);
  $('workspace-context-label').hidden=!tab;
  $('workspace-context-label').textContent=tab
    ?'当前工作区：'+tab.name+' · 可在此工作区切换不同测试方式':'';
  renderWorkspaceTabs();
  if(!active)return;
  $('test-detail-title').textContent=mode.title;
  $('data-column-x').textContent=mode.xColumn;
  $('measurement-empty').textContent='尚无'+mode.title+'的仪器实测数据';
  const rows=workspaceStore.getData(tab.id,activeMode);
  measurementPlot.selectTest(activeMode,rows);
  renderMeasurementData(rows,activeMode);
  renderMeasurementHistory(tab,activeMode);
  $('plan-form').hidden=!isEditable;
  $('plan-status').hidden=!isEditable;
  $('validate-plan').hidden=!isEditable;
  $('waveform-editor').hidden=!isWaveform;
  $('validate-waveform').hidden=!isWaveform;
  $('pending-parameters').hidden=isEditable||isWaveform;
  if(isEditable){
    $('test-kind').value=activeMode;
    const it=activeMode==='it';
    document.querySelectorAll('.iv-only').forEach(node=>node.hidden=it);
    document.querySelectorAll('.it-only').forEach(node=>node.hidden=!it);
    $('parameters-title').textContent='SMU 测试参数';
    void validatePlan();
  }else if(isWaveform){
    $('parameters-title').textContent='任意波形方案';
    void validateWave();
  }else{
    $('parameters-title').textContent='测试参数';
    $('pending-title').textContent=mode.title+' · 开发中';
    $('pending-description').textContent='此测试方式的参数配置与仪器采集尚未实现。界面仅保留工作区，不会执行任何输出。';
  }
}
function selectTestKind(kind){
  if(!Object.hasOwn(TEST_MODES,kind))return;
  let tab=getActiveWorkspace();
  if(!tab)tab=workspaceStore.createTab();
  rememberTabDraft();
  workspaceStore.setMode(tab.id,kind);
  activeMode=kind;
  restoreTabDraft(kind);
  renderTestSelection();
  window.scrollTo({top:0,behavior:'instant'});
  $('test-detail-title').focus({preventScroll:true});
  showStatusMessage('已切换到'+TEST_MODES[kind].title+' · '+tab.name);
}
function returnToTestLibrary(){
  rememberTabDraft();
  const tab=getActiveWorkspace();
  if(tab)workspaceStore.setMode(tab.id,null);
  activeMode=null;
  renderTestSelection();
  window.scrollTo({top:0,behavior:'instant'});
  $('test-types-title').setAttribute('tabindex','-1');
  $('test-types-title').focus({preventScroll:true});
  showStatusMessage(tab?'已返回'+tab.name+'的测试方式选择':'已返回测试方式选择');
}
renderTestSelection();

async function validatePlan(){
  if(!activeMode||!TEST_MODES[activeMode]?.ready)return;
  const status=$('plan-status');
  const expectedKind=activeMode,expectedTabId=getActiveWorkspace()?.id;
  try{
    const payload=Object.fromEntries(new FormData(planForm).entries());
    const r=await post('/api/plan/validate',payload);
    if(expectedKind!==activeMode||expectedTabId!==getActiveWorkspace()?.id)return;
    if(!r.ok)throw Error(r.error||'参数校验失败');
    const p=r.plan;
    status.textContent=(p.kind==='iv'?'I–V 扫描':'I–t 恒压读出')+' · '+p.totalPoints+
      ' 个规划点 · '+p.loops+' 循环 · SMU '+p.sourceSmU+' · 不执行硬件输出';
    showStatusMessage('方案校验通过 · '+p.totalPoints+' 个规划点 · 不执行硬件输出','success');
  }catch(e){
    if(expectedKind===activeMode&&expectedTabId===getActiveWorkspace()?.id){
      status.textContent='方案校验失败：'+String(e.message||e).slice(0,120);
      showStatusMessage('方案校验失败：'+String(e.message||e).slice(0,90),'error');
    }
  }
}
$('status-message').addEventListener('click',()=>{$('status-log-dialog').showModal();});
$('status-log-close').addEventListener('click',()=>{$('status-log-dialog').close();});
statusButton.addEventListener('click',openConnectionDialog);
$('connection-close').addEventListener('click',closeConnectionDialog);
reconnect.addEventListener('click',connectInstrument);
disconnect.addEventListener('click',disconnectInstrument);
dialog.addEventListener('click',event=>{
  if(event.target===dialog)closeConnectionDialog();
});
$('validate-plan').addEventListener('click',validatePlan);
document.querySelectorAll('.test-type-card').forEach(card=>{
  card.addEventListener('click',()=>selectTestKind(card.dataset.testKind));
});
$('close-test-detail').addEventListener('click',returnToTestLibrary);
function setParametersCollapsed(collapsed){
  const columns=$('detail-columns');
  columns.classList.toggle('parameters-collapsed',collapsed);
  $('parameters-panel').hidden=collapsed;
  const restore=$('restore-parameters');
  restore.setAttribute('aria-expanded',String(collapsed));
  restore.textContent=collapsed?'收起':'展开';
  restore.setAttribute('aria-label',collapsed?'收起绘图区':'展开绘图区');
  restore.title=collapsed?'收起绘图区':'展开绘图区';
  showStatusMessage(collapsed?'参数已收起 · 绘图区域使用全部宽度':'参数栏已显示');
}
$('restore-parameters').addEventListener('click',()=>setParametersCollapsed(
  !$('detail-columns').classList.contains('parameters-collapsed')
));
document.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&activeMode&&!dialog.open){
    event.preventDefault();
    returnToTestLibrary();
  }
});
planForm.addEventListener('input',()=>{
  rememberTabDraft();
  $('plan-status').textContent='方案参数已更改，请重新校验。';
  showStatusMessage('参数已修改 · 尚未重新校验','info',false);
});
form.addEventListener('input',()=>{
  $('connection-hint').textContent='连接设置已修改，点击“应用设置并重连”后生效。';
  showStatusMessage('连接设置已修改 · 重新连接后生效','info',false);
});
$('validate-waveform').addEventListener('click',validateWave);
$('waveform-text').addEventListener('input',rememberTabDraft);

/* Compact cross-platform select menu. Keep the underlying native <select>
 * in the form so connect/plan payloads and DKDS interoperability are unchanged.
 * Without JS the original accessible native selector remains usable. */
function enhanceWorkspaceSelects(){
  let active=null;
  const close=(returnFocus=false)=>{
    if(!active)return;
    const current=active;
    active=null;
    current.trigger.setAttribute('aria-expanded','false');
    current.trigger.removeAttribute('aria-controls');
    current.popover.remove();
    if(returnFocus)current.trigger.focus({preventScroll:true});
  };
  const selections=[...document.querySelectorAll('select:not([multiple])')];
  selections.forEach((source,index)=>{
    if(source.dataset.dktsEnhanced==='true')return;
    const fieldName=source.closest('label')?.firstChild?.textContent?.trim()||source.name||'选择项目';
    const wrapper=document.createElement('span');
    wrapper.className='dkts-select-wrapper';
    const trigger=document.createElement('button');
    trigger.type='button';
    trigger.className='dkts-select-trigger';
    trigger.setAttribute('aria-haspopup','listbox');
    trigger.setAttribute('aria-expanded','false');
    trigger.setAttribute('aria-label',fieldName);
    const selection=document.createElement('span');
    selection.className='dkts-select-value';
    const arrow=document.createElementNS('http://www.w3.org/2000/svg','svg');
    arrow.setAttribute('viewBox','0 0 20 20');
    arrow.setAttribute('width','16');
    arrow.setAttribute('height','16');
    arrow.setAttribute('aria-hidden','true');
    const chevron=document.createElementNS('http://www.w3.org/2000/svg','path');
    chevron.setAttribute('d','m5 7.5 5 5 5-5');
    chevron.setAttribute('fill','none');
    chevron.setAttribute('stroke','currentColor');
    chevron.setAttribute('stroke-width','1.7');
    chevron.setAttribute('stroke-linecap','round');
    chevron.setAttribute('stroke-linejoin','round');
    arrow.appendChild(chevron);
    trigger.append(selection,arrow);
    source.insertAdjacentElement('afterend',wrapper);
    wrapper.append(source,trigger);
    const sync=()=>{
      const option=source.selectedOptions[0];
      selection.textContent=option?.textContent||'请选择';
      trigger.disabled=source.disabled;
    };
    source.addEventListener('change',sync);
    source.dataset.dktsEnhanced='true';
    source.hidden=true;
    sync();
    function open(){
      close();
      const list=document.createElement('div');
      list.className='dkts-select-popover';
      list.setAttribute('role','listbox');
      list.setAttribute('aria-label',fieldName);
      list.id='dkts-select-list-'+index;
      const entries=[];
      let selected=source.selectedIndex;
      const choose=(i)=>{
        if(i<0||source.options[i]?.disabled)return;
        const next=source.options[i].value;
        if(source.value!==next){
          source.value=next;
          source.dispatchEvent(new Event('input',{bubbles:true}));
          source.dispatchEvent(new Event('change',{bubbles:true}));
        }
        sync();
        close(true);
      };
      const focusEntry=(i)=>{
        if(!entries.length)return;
        const safe=Math.max(0,Math.min(entries.length-1,i));
        const target=entries[safe];
        if(target.disabled)return;
        selected=safe;
        target.focus({preventScroll:true});
        target.scrollIntoView({block:'nearest'});
      };
      const available=Array.from(source.options);
      available.forEach((option,i)=>{
        const item=document.createElement('button');
        item.type='button';
        item.className='dkts-select-option';
        item.setAttribute('role','option');
        item.setAttribute('aria-selected',String(source.selectedIndex===i));
        item.textContent=option.textContent;
        item.disabled=option.disabled;
        item.tabIndex=-1;
        item.addEventListener('click',()=>choose(i));
        list.appendChild(item);
        entries.push(item);
      });
      const root=source.closest('dialog')?.open?source.closest('dialog'):document.body;
      root.appendChild(list);
      trigger.setAttribute('aria-expanded','true');
      trigger.setAttribute('aria-controls',list.id);
      active={trigger,popover:list};
      const rect=trigger.getBoundingClientRect();
      const width=Math.min(Math.max(165,rect.width),window.innerWidth-12);
      const left=Math.min(Math.max(6,rect.left),Math.max(6,window.innerWidth-width-6));
      const below=window.innerHeight-rect.bottom-8;
      const above=rect.top-8;
      const placeAbove=below<170&&above>below;
      const height=Math.max(90,Math.min(280,(placeAbove?above:below)-5));
      list.style.width=width+'px';
      list.style.maxHeight=height+'px';
      list.style.left=left+'px';
      const actual=Math.min(height,list.scrollHeight);
      list.style.top=Math.max(6,placeAbove?rect.top-actual-5:rect.bottom+5)+'px';
      list.addEventListener('keydown',event=>{
        if(event.key==='Escape'){
          event.preventDefault();event.stopPropagation();close(true);return;
        }
        if(event.key==='Tab'){close();return;}
        let step=0;
        if(event.key==='ArrowDown')step=1;
        if(event.key==='ArrowUp')step=-1;
        let next=selected;
        if(event.key==='Home')next=0;
        else if(event.key==='End')next=entries.length-1;
        else if(step){
          next=(selected+step+entries.length)%entries.length;
          for(let i=0;i<entries.length&&entries[next]?.disabled;i++)
            next=(next+step+entries.length)%entries.length;
        }else if(event.key==='Enter'||event.key===' '){
          event.preventDefault();choose(selected);return;
        }else return;
        event.preventDefault();
        if(entries[next]&&!entries[next].disabled)focusEntry(next);
      });
      const first=entries[selected]&&!entries[selected].disabled?selected:
        entries.findIndex(entry=>!entry.disabled);
      if(first>=0)focusEntry(first);
    }
    trigger.addEventListener('click',()=>active?.trigger===trigger?close():open());
    trigger.addEventListener('keydown',event=>{
      if(event.key==='ArrowDown'||event.key==='ArrowUp'){
        event.preventDefault();
        if(active?.trigger!==trigger)open();
      }else if(event.key==='Escape'&&active?.trigger===trigger){
        event.preventDefault();event.stopPropagation();close();
      }
    });
  });
  document.addEventListener('pointerdown',event=>{
    if(active&&!active.trigger.contains(event.target)&&
      !active.popover.contains(event.target))close();
  },true);
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&active){
      event.preventDefault();event.stopImmediatePropagation();close(true);
    }
  },true);
  window.addEventListener('resize',()=>close());
  document.addEventListener('scroll',event=>{
    if(active&&!active.popover.contains(event.target))close();
  },true);
  document.querySelectorAll('dialog').forEach(dialog=>
    dialog.addEventListener('close',()=>close()));
}
enhanceWorkspaceSelects();

(async()=>{await loadWorkspaceState();renderTestSelection();renderStatus(await refresh());if(state!=='connected')await connectInstrument();})();

/* Native shells update UI assets in the background, without replacing instrument drivers.
 * The local UI version endpoint is cheap; GitHub is queried by the host, not this page. */
if(!window.DKTSClient){
  let loadedUiVersion=null;
  async function inspectUiVersion(){
    try{
      const reply=await fetch('/api/ui/version',{cache:'no-store'});
      if(!reply.ok)return;
      const value=await reply.json();
      if(loadedUiVersion===null){loadedUiVersion=value.version;return;}
      if(value.version!==loadedUiVersion&&!busy&&!window.DKTSMeasurementRunning){
        window.location.reload();
      }
    }catch{/* Offline UI continues normally. */}
  }
  void inspectUiVersion();
  window.setInterval(inspectUiVersion,5000);
}
