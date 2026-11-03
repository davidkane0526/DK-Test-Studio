'use strict';
const $=id=>document.getElementById(id);
const form=$('connection-form'),planForm=$('plan-form');
const dialog=$('connection-dialog'),statusButton=$('connection-status');
const reconnect=$('reconnect-instrument'),disconnect=$('disconnect-instrument');
let state='disconnected',busy=false;
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
  }catch(error){info.textContent='校验失败：'+String(error.message||error).slice(0,120);$('waveform-plot').replaceChildren();}
}
function updatePlanMode(){
  const kind=$('test-kind').value;
  const it=kind==='it';
  document.querySelectorAll('.iv-only').forEach(node=>node.hidden=it);
  document.querySelectorAll('.it-only').forEach(node=>node.hidden=!it);
  $('test-params-title').textContent=(it?'SMU I–t 恒压读出':'SMU I–V 扫描')+' · 测试参数';
  document.querySelectorAll('.test-type-card').forEach(card=>{
    const selected=card.dataset.testKind===kind;
    card.classList.toggle('is-selected',selected);
    if(!card.disabled)card.setAttribute('aria-pressed',String(selected));
  });
}
function selectTestKind(kind){
  const card=document.querySelector('.test-type-card[data-test-kind="'+kind+'"]');
  if(!card||card.disabled)return;
  $('test-kind').value=kind;
  updatePlanMode();
  validatePlan();
}
async function validatePlan(){
  const status=$('plan-status');
  try{
    const payload=Object.fromEntries(new FormData(planForm).entries());
    const r=await post('/api/plan/validate',payload);
    if(!r.ok)throw Error(r.error||'参数校验失败');
    const p=r.plan;
    status.textContent=(p.kind==='iv'?'I–V 扫描':'I–t 恒压读出')+' · '+p.totalPoints+
      ' 个规划数据点 · '+p.loops+' 循环 · SMU '+p.sourceSmU+' · 硬件执行未开放';
  }catch(e){status.textContent='方案校验失败：'+String(e.message||e).slice(0,120);}
}
statusButton.addEventListener('click',openConnectionDialog);
$('connection-close').addEventListener('click',closeConnectionDialog);
reconnect.addEventListener('click',connectInstrument);
disconnect.addEventListener('click',disconnectInstrument);
dialog.addEventListener('click',event=>{
  if(event.target===dialog)closeConnectionDialog();
});
$('validate-plan').addEventListener('click',validatePlan);
document.querySelectorAll('.test-type-card:not(:disabled)').forEach(card=>{
  card.addEventListener('click',()=>selectTestKind(card.dataset.testKind));
});
planForm.addEventListener('input',()=>{$('plan-status').textContent='方案参数已更改，请重新校验。';});
form.addEventListener('input',()=>{$('connection-hint').textContent='连接设置已修改，点击“应用设置并重连”后生效。';});
$('validate-waveform').addEventListener('click',validateWave);
(async()=>{renderStatus(await refresh());if(state!=='connected')await connectInstrument();updatePlanMode();await validatePlan();await validateWave();})();

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
