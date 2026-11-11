(() => {
 'use strict';
 /* Dedicated host connection UX. Never sends KXCI strings or authorizes tests.
  * Native preload only exposes identity read + disconnect.
  */
 const modal=document.getElementById('fs-instrument-host');
 const trigger=document.getElementById('fs-instrument-link');
 const fields={host:'169.254.111.118',port:'1225',networkMode:'auto',interfaceName:'',localAddress:'',expectedSerial:'1498377'};
 const bridge=window.DK4200Native;
 let connected=false,pending=false,discovery=null;
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const note=s=>{const el=document.getElementById('fs-messages');if(el)el.textContent=String(s||'').slice(0,240);};
 const summary=s=>{const el=document.getElementById('fs-bottom-status');if(el)el.textContent=String(s||'').slice(0,92);};
 function renderStatus(){
  trigger.textContent=pending?'连接中…':connected?'断开':'连接';
  trigger.disabled=pending;
  trigger.dataset.state=connected?'connected':'disconnected';
 }
 function optionsFromFields(){
  const port=Number(fields.port);
  if(!/^(?:[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*)$/.test(fields.host)||fields.host.length>253)throw Error('仪器地址无效');
  if(!Number.isSafeInteger(port)||port<1||port>65535)throw Error('TCP 端口无效');
  return {...fields,port,timeoutMs:5000};
 }
 function describe(info){
  const route=info.route||{},slots=info.inventory?.addressableSMUs?.length||0;
  return `${info.idn.split(',').slice(1,3).join(' · ')} · ${slots} SMU · ${route.interfaceName||route.routeStrategy||'网络'}`;
 }
 function summarizeConnectionError(error){
  const value=String(error?.message||error||'未知错误');
  if(/identity|serial|身份|序列号/i.test(value))return '设备身份或序列号不匹配';
  if(/EPERM|Operation not permitted|Binding socket|network was not available|EHOSTUNREACH|ENETUNREACH|路由/i.test(value))
   return '无法使用当前网络访问仪器，请检查网卡 IP 与路由';
  if(/ETIMEDOUT|timeout|timed out/i.test(value))return '连接超时，请检查仪器地址与端口';
  // Android SocketFactory reports a long Java ConnectException containing
  // "/169.254.x.x (port 1225)"; do not put an exception trace in the UI log.
  if(/failed to connect|connect failed|java\.net\.ConnectException|connection failed/i.test(value))
   return '连接失败，请检查仪器网络、IP 地址及 KXCI 端口';
  if(/ECONNREFUSED|refused/i.test(value))return '仪器拒绝连接，请检查 KXCI 服务';
  if(/not connected|closed|reset|broken pipe/i.test(value))return '连接已中断，请重新连接';
  return value.split('\\n')[0].slice(0,76);
 }
 async function connect(){
  if(pending)return false;
  if(!bridge?.connect){note('此预览宿主尚未提供原生 TCP 连接');return false;}
  pending=true;renderStatus();
  try{
   const result=await bridge.connect(optionsFromFields());
   if(result?.verifiedIdentity!==true||result.connected!==true||result.executionAuthorized!==false)
    throw Error('仪器身份或连接状态未验证');
   discovery=result;connected=true;
   const channels=result.inventory?.addressableSMUs?.map(row=>row.resource).filter(Boolean)||[];
   window.DK4200FSPro?.setVerifiedInventory?.(channels);
   summary('已连接（只读）');
   note(describe(result));
   showDialogStatus();
   return true;
  }catch(err){
   connected=false;discovery=null;
   // A failed reconnect must revoke resource selections from the prior
   // verified session. Never let stale KCon channels appear as live.
   window.DK4200FSPro?.setVerifiedInventory?.([]);
   summary('未连接');
   note('连接失败：'+summarizeConnectionError(err));
   showDialogStatus();
   return false;
  }finally{pending=false;renderStatus();}
 }
 async function disconnect(){
  if(pending)return false;
  pending=true;renderStatus();
  try{
   if(bridge?.disconnect)await bridge.disconnect();
   connected=false;discovery=null;
   window.DK4200FSPro?.setVerifiedInventory?.([]);
   summary('未连接');note('已断开');showDialogStatus();
   return true;
  }catch(err){
   note('断开异常：'+String(err?.message||err).slice(0,130));
   return false;
  }finally{pending=false;renderStatus();}
 }
 function showDialogStatus(){
  const el=modal.querySelector('[data-connection-summary]');
  if(el)el.textContent=connected?describe(discovery):'未连接';
 }
 const selectOptions=[['auto','自动'],['ethernet','以太网'],['wifi','Wi-Fi'],['interface','指定网卡']].map(([v,l])=>`<option value="${v}"${fields.networkMode===v?' selected':''}>${l}</option>`).join('');
 function openSettings(){
  if(modal.hidden===false)return;
  modal.innerHTML=`<div class="fs-editor fs-device-dialog" role="dialog" aria-modal="true" aria-label="Connection Settings">
  <div class="fs-editor-title">Connection Settings <button type="button" data-fs-device-action="close" title="关闭">×</button></div>
  <div class="fs-device-form">
   <label>仪器地址<input data-device-field="host" value="${esc(fields.host)}" autocomplete="off" spellcheck="false"></label>
   <label>端口<input data-device-field="port" type="number" min="1" max="65535" value="${esc(fields.port)}"></label>
   <label>网络方式<select data-device-field="networkMode">${selectOptions}</select></label>
   <label>指定网卡<input data-device-field="interfaceName" value="${esc(fields.interfaceName)}" placeholder="自动选择时留空"></label>
   <label>本地 IP<input data-device-field="localAddress" value="${esc(fields.localAddress)}" placeholder="自动选择时留空"></label>
   <label>设备序列号<input data-device-field="expectedSerial" value="${esc(fields.expectedSerial)}" placeholder="可留空"></label>
  </div>
  <div class="fs-device-summary" data-connection-summary></div>
  <div class="fs-device-hint">连接期间仅允许 *IDN? 与 *OPT?。端口分配与仪器额定能力需要另外验证。</div>
  <div class="fs-editor-footer"><button data-fs-device-action="toggle" class="fs-primary">${connected?'断开':'连接'}</button><button data-fs-device-action="close">关闭</button></div>
 </div>`;
  modal.hidden=false;
  window.DKDSComponents?.hydrate?.(modal);
  window.DK4200UIControls?.enhance?.(modal);
  window.DKTSNumericKeypad?.bindNew?.(modal);
  showDialogStatus();
 }
 function closeSettings(){modal.hidden=true;modal.replaceChildren();}
 async function toggle(){return connected?disconnect():connect();}
 modal.addEventListener('input',event=>{
  const field=event.target.dataset.deviceField;
  if(field&&Object.prototype.hasOwnProperty.call(fields,field))fields[field]=String(event.target.value);
 });
 modal.addEventListener('change',event=>{
  const field=event.target.dataset.deviceField;
  if(field&&Object.prototype.hasOwnProperty.call(fields,field))fields[field]=String(event.target.value);
 });
 modal.addEventListener('click',event=>{
  const action=event.target.closest('[data-fs-device-action]')?.dataset.fsDeviceAction;
  if(action==='close')closeSettings();
  if(action==='toggle')toggle().finally(()=>{const btn=modal.querySelector('[data-fs-device-action="toggle"]');if(btn)btn.textContent=connected?'断开':'连接';});
 });
 document.addEventListener('click',event=>{
  const action=event.target.closest('[data-native-action]')?.dataset.nativeAction;
  if(action==='settings')openSettings();
  if(action==='toggle')toggle();
 });
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!modal.hidden)closeSettings();});
 window.DK4200ConnectionStatus=Object.freeze({snapshot:()=>Object.freeze({
  connected,pending,instrumentId:discovery?.idn||null,route:discovery?.route||null,executionAuthorized:false}),
  connect,disconnect,openSettings
 });
 renderStatus();
 // Native host: begin read-only auto-connection to the last verified user's 4200A.
 // Browser/Android previews remain offline until their native transport exists.
 if(bridge?.connect)Promise.resolve().then(connect);
})();
