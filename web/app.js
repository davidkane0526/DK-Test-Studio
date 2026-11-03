'use strict';
const $=id=>document.getElementById(id);
const form=$('connection-form'),toggle=$('toggle');
let state='disconnected',busy=false;
async function post(route,data={}){
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
  $('connection-summary').textContent=value.summary||'未连接';
  $('state-chip').textContent=connected?'已识别':state==='connecting'?'正在连接':state==='error'?'连接失败':'未连接';
  $('dot').dataset.phase=state;
  toggle.textContent=busy?'正在处理…':connected?'断开':'连接';
  toggle.disabled=busy;
  const route=value.route;
  $('route-line').textContent=route
    ?[route.remoteAddress+':'+route.remotePort,route.interfaceName||'系统路由',route.localAddress].filter(Boolean).join(' · ')
    :String(fields().host||'169.254.111.118')+':'+String(fields().port||1225);
  const detail=String(value.diagnostic||'');
  $('diagnostic-wrap').hidden=!detail;
  $('diagnostic').textContent=detail.slice(0,6000);
  $('diagnostic-wrap').open=false;
}
let latestStatus={phase:'disconnected',summary:'未连接'};
async function refresh(){
  try{
    const response=await fetch('/api/status',{cache:'no-store'});
    latestStatus=await response.json();
  }catch{}
  return latestStatus;
}
async function onToggle(){
  if(busy)return;
  busy=true;toggle.disabled=true;
  try{
    const result=state==='connected'?await post('/api/disconnect'):await post('/api/connect',fields());
    latestStatus=result;renderStatus(result);
  }catch(error){latestStatus={phase:'error',summary:'本地控制服务异常',diagnostic:String(error)};renderStatus(latestStatus);}
  finally{busy=false;renderStatus(latestStatus);}
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
toggle.addEventListener('click',onToggle);
form.addEventListener('input',()=>{if(state==='connected')$('connection-summary').textContent='连接设置已修改，断开后重新连接生效';});
$('validate-waveform').addEventListener('click',validateWave);
(async()=>{renderStatus(await refresh());await onToggle();await validateWave();})();
