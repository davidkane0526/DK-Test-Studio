'use strict';
const $=id=>document.getElementById(id);
// Android WebView has native system bars, not desktop caption/window controls.
if(typeof window.DKTSNative?.request==='function')
  document.body.classList.add('dkts-android-shell');
function displayUiVersion(){
  const raw=document.querySelector('meta[name="dkts-ui-version"]')?.content||'bundled';
  const badge=$('ui-version-badge');
  if(!badge)return;
  const isCommit=/^[a-f0-9]{40}$/i.test(raw);
  badge.textContent=isCommit?'UI '+raw.slice(0,8):'UI 内置版';
  badge.title=isCommit?'当前界面版本：'+raw:'当前界面版本：内置资源';
  badge.setAttribute('aria-label',badge.title);
}
displayUiVersion();
async function displayNativeVersion(){
  const badge=$('native-version-badge');
  if(!badge)return;
  try{
    let version='';
    if(window.DKTSClient?.nativeVersion)version=await window.DKTSClient.nativeVersion();
    else {
      const response=await fetch('/api/app/version',{cache:'no-store'});
      if(response.ok)version=String((await response.json()).version||'');
    }
    if(/^\d+\.\d+\.\d+$/.test(version)){
      badge.textContent='v'+version;
      badge.title='当前原生安装版本：'+version;
    }
  }catch{/* Native version falls back to bundled package label when offline. */}
}
void displayNativeVersion();
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
  const info=$('waveform-info');
  try{
    const r=await post('/api/waveform/validate',{text:$('waveform-text').value});
    if(!r.ok)throw Error(r.error||'波形参数不正确');
    info.textContent=r.count+' 点 · 总时长 '+r.durationS+' s · 最小时间间隔 '+r.minimumStepS+' s · 未验证硬件可执行性';
    drawWave(r.preview);
    showStatusMessage('波形校验通过 · '+r.count+' 个规划点（无硬件输出）','success');
  }catch(error){
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
let expandedKind=null;
const detail=$('test-detail');
const openedTabs=[];
const tabDrafts=new Map();
function rememberTabDraft(){
  if(!expandedKind)return;
  const formValues={};
  for(const control of planForm.elements){
    if(!control.name)continue;
    formValues[control.name]=control.value;
  }
  tabDrafts.set(expandedKind,{formValues,waveform:$('waveform-text').value});
}
function restoreTabDraft(kind){
  const draft=tabDrafts.get(kind);
  if(!draft)return;
  for(const control of planForm.elements){
    if(control.name&&Object.hasOwn(draft.formValues,control.name))
      control.value=draft.formValues[control.name];
  }
  $('waveform-text').value=draft.waveform;
  $('test-kind').value=kind;
}
function renderWorkspaceTabs(){
  const nav=$('workspace-tabs');
  nav.querySelectorAll('.workspace-tab-item').forEach(node=>node.remove());
  $('tab-home').classList.toggle('is-active',expandedKind===null);
  for(const kind of openedTabs){
    const tab=document.createElement('div');
    tab.className='workspace-tab-item';
    const select=document.createElement('button');
    select.type='button';select.className='workspace-tab';
    select.setAttribute('role','tab');
    select.setAttribute('aria-selected',String(expandedKind===kind));
    select.setAttribute('aria-controls','test-detail');
    select.classList.toggle('is-active',expandedKind===kind);
    select.textContent=TEST_MODES[kind].title;
    select.title=TEST_MODES[kind].title;
    select.addEventListener('click',()=>selectTestKind(kind));
    const close=document.createElement('button');
    close.type='button';close.className='workspace-tab-close';
    close.setAttribute('aria-label','关闭'+TEST_MODES[kind].title+'标签');
    close.title='关闭标签';
    close.innerHTML='<svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" aria-hidden="true" focusable="false"><path d="M5.5 5.5l9 9m0-9-9 9"/></svg>';
    close.addEventListener('click',()=>closeWorkspaceTab(kind));
    tab.append(select,close);
    nav.appendChild(tab);
  }
}
function closeWorkspaceTab(kind){
  const i=openedTabs.indexOf(kind);
  if(i<0)return;
  if(expandedKind===kind)rememberTabDraft();
  openedTabs.splice(i,1);
  tabDrafts.delete(kind);
  if(expandedKind===kind){
    const next=openedTabs[Math.min(i,openedTabs.length-1)]||null;
    expandedKind=null;
    if(next)selectTestKind(next);
    else returnToTestLibrary();
  }else renderWorkspaceTabs();
}
$('tab-home').addEventListener('click',returnToTestLibrary);

function renderTestSelection(){
  const mode=expandedKind?TEST_MODES[expandedKind]:null;
  const isEditable=Boolean(mode?.ready);
  const isWaveform=Boolean(mode?.planner);
  const active=Boolean(mode);
  $('test-library').hidden=active;
  detail.hidden=!active;
  detail.inert=!active;
  detail.setAttribute('aria-hidden',String(!active));
  document.querySelector('.workspace').classList.toggle('workspace-active',active);
  renderWorkspaceTabs();
  if(!mode)return;
  $('test-detail-title').textContent=mode.title+' · 测试工作区';
  $('test-detail-subtitle').textContent='参数设置 / 数据读取 / 实时曲线';
  $('measurement-x-label').textContent=mode.x;
  $('data-column-x').textContent=mode.xColumn;
  $('measurement-empty').textContent='尚无'+mode.title+'的仪器实测数据';
  $('plan-form').hidden=!isEditable;
  $('plan-status').hidden=!isEditable;
  $('validate-plan').hidden=!isEditable;
  $('waveform-editor').hidden=!isWaveform;
  $('validate-waveform').hidden=!isWaveform;
  $('pending-parameters').hidden=isEditable||isWaveform;
  if(isEditable){
    $('test-kind').value=expandedKind;
    const it=expandedKind==='it';
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
  // The measured plot stays empty until the actual instrument acquisition layer is implemented.
  $('acquisition-state').textContent='等待实机采集';
}
function selectTestKind(kind){
  if(!Object.hasOwn(TEST_MODES,kind))return;
  if(expandedKind!==kind)rememberTabDraft();
  if(!openedTabs.includes(kind))openedTabs.push(kind);
  expandedKind=kind;
  restoreTabDraft(kind);
  renderTestSelection();
  window.scrollTo({top:0,behavior:'instant'});
  $('test-detail-title').focus({preventScroll:true});
  showStatusMessage('已打开 '+TEST_MODES[kind].title+' · 尚未开放实机测量');
}
function returnToTestLibrary(){
  rememberTabDraft();
  expandedKind=null;
  renderTestSelection();
  window.scrollTo({top:0,behavior:'instant'});
  $('test-types-title').setAttribute('tabindex','-1');
  $('test-types-title').focus({preventScroll:true});
  showStatusMessage('已返回测试方式选择');
}
async function validatePlan(){
  if(!expandedKind||!TEST_MODES[expandedKind]?.ready)return;
  const status=$('plan-status');
  const expectedKind=expandedKind;
  try{
    const payload=Object.fromEntries(new FormData(planForm).entries());
    const r=await post('/api/plan/validate',payload);
    if(expectedKind!==expandedKind)return;
    if(!r.ok)throw Error(r.error||'参数校验失败');
    const p=r.plan;
    status.textContent=(p.kind==='iv'?'I–V 扫描':'I–t 恒压读出')+' · '+p.totalPoints+
      ' 个规划点 · '+p.loops+' 循环 · SMU '+p.sourceSmU+' · 不执行硬件输出';
    showStatusMessage('方案校验通过 · '+p.totalPoints+' 个规划点 · 不执行硬件输出','success');
  }catch(e){
    if(expectedKind===expandedKind){
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
  const collapse=$('toggle-parameters'),restore=$('restore-parameters');
  collapse.setAttribute('aria-expanded',String(!collapsed));
  restore.setAttribute('aria-expanded',String(!collapsed));
  restore.hidden=!collapsed;
  if(collapsed)restore.focus({preventScroll:true});
  else collapse.focus({preventScroll:true});
  showStatusMessage(collapsed?'参数已收起 · 绘图区域使用全部宽度':'参数栏已显示');
}
$('toggle-parameters').addEventListener('click',()=>setParametersCollapsed(true));
$('restore-parameters').addEventListener('click',()=>setParametersCollapsed(false));
document.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&expandedKind&&!dialog.open){
    event.preventDefault();
    returnToTestLibrary();
  }
});
planForm.addEventListener('input',()=>{
  $('plan-status').textContent='方案参数已更改，请重新校验。';
  showStatusMessage('参数已修改 · 尚未重新校验','info',false);
});
form.addEventListener('input',()=>{
  $('connection-hint').textContent='连接设置已修改，点击“应用设置并重连”后生效。';
  showStatusMessage('连接设置已修改 · 重新连接后生效','info',false);
});
$('validate-waveform').addEventListener('click',validateWave);
(async()=>{renderTestSelection();renderStatus(await refresh());if(state!=='connected')await connectInstrument();})();

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
