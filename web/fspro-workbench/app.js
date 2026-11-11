/* DKTS FS-Pro workbench UI proof. No instrument access, no synthetic raw data. */
(()=>{
'use strict';
const $=id=>document.getElementById(id);
const PLAN=window.DKTSFSProPlan;
if(!PLAN)throw Error('FS-Pro sweep planner missing');
const STORAGE='dkts.fspro.workbench.v1',KINDS={
 iv:['I–V Sweep','SMU'],transfer:['Transfer','FET'],output:['Output','FET'],
 it:['I–t','SMU'],pund:['PMU / PUND','PMU'],pulse:['Pulse','Pulse'],
 endurance:['Endurance','Cycle'],retention:['Retention','Time'],arb:['Arbitrary Waveform','ARB']
};
const roles=['source','drain','gate'],roleNames={source:'Source',drain:'Drain',gate:'Gate'};
const portChoices=['None','GNDU','SMU1','SMU2','SMU3','SMU4','SMU5','SMU6','PMU1-1','PMU1-2'];
const ranges=['Auto','1e-12','1e-11','1e-10','1e-9','1e-8','1e-7','1e-6','1e-5','1e-4','1e-3','1e-2','1e-1','1e0'];
const defaults=kind=>({
 id:'page-'+Math.random().toString(36).slice(2,9),routineId:'routine-1',kind,name:KINDS[kind][0],note:'',
 loops:1,terminals:{source:'GNDU',drain:'SMU1',gate:'SMU2'},
 xSweep:{terminal:kind==='transfer'?'gate':'drain',repeats:1,segments:[{startV:0,stopV:2,stepV:.1,rangeA:'Auto',speed:'Normal'}]},
 pSweep:{enabled:false,terminal:kind==='transfer'?'drain':'gate',repeats:1,segments:[{startV:0,stopV:1,stepV:.1,rangeA:'Auto',speed:'Normal'}]},
 fixed:{source:0,drain:0,gate:0},
 portSettings:Object.fromEntries(roles.map(role=>[role,{rangeMode:'Auto',rangeA:'1e-6',complianceA:'1e-4',complianceMode:'Follow range'}])),
 targets:[{name:'Id',terminal:'drain',parameter:'Current',range:'Auto'}],
 variables:[],associateSpec:false,scanMode:'linear',speed:'Normal',pointDelay:20
});
let state={
 devices:[{id:'device-1',name:'MOSFET'}],activeDeviceId:'device-1',
 routines:[{id:'routine-1',deviceId:'device-1',name:'Routine 1'}],activeRoutineId:'routine-1',specs:[],
 pages:[defaults('iv'),defaults('transfer'),defaults('pund')],
 activePage:0,section:'sweep',dataView:'plan',navOpen:false,editorOpen:false,
 theme:'light',lang:'zh',portsVisible:true,frameLayout:'4',frameKinds:['transfer','it','raw']
};
try{
 const stored=JSON.parse(localStorage.getItem(STORAGE)||sessionStorage.getItem(STORAGE)||'null');
 if(stored&&Array.isArray(stored.pages)&&stored.pages.length&&stored.pages.length<100){
  const pages=stored.pages.filter(p=>p&&Object.hasOwn(KINDS,p.kind));
  if(pages.length){state={...state,...stored,pages};state.activePage=Math.max(0,Math.min(pages.length-1,Number(state.activePage)||0));}
 }
}catch{}
// Always start with the project graph; previous selected Page is not auto-opened.
state.editorOpen=false;
if(!['1','2','4'].includes(String(state.frameLayout)))state.frameLayout='4';
if(!Array.isArray(state.frameKinds)||state.frameKinds.length!==3)state.frameKinds=['transfer','it','raw'];
if(!Array.isArray(state.devices)||!state.devices.length||state.devices.length>100)
 state.devices=[{id:'device-1',name:'MOSFET'}];
if(!Array.isArray(state.routines)||!state.routines.length||state.routines.length>100)
 state.routines=[{id:'routine-1',deviceId:state.devices[0].id,name:'Routine 1'}];
for(const routine of state.routines)
 if(!state.devices.some(d=>d.id===routine.deviceId))routine.deviceId=state.devices[0].id;
for(const page of state.pages)
 if(!state.routines.some(r=>r.id===page.routineId))page.routineId=state.routines[0].id;
if(!Array.isArray(state.specs)||state.specs.length>100)state.specs=[];
for(const spec of state.specs)
 if(!state.devices.some(d=>d.id===spec.deviceId))spec.deviceId=state.devices[0].id;
const selectedRoutine=state.routines.find(r=>r.id===state.pages[state.activePage].routineId);
state.activeRoutineId=selectedRoutine.id;state.activeDeviceId=selectedRoutine.deviceId;
const current=()=>state.pages[state.activePage];
const save=()=>{
 try{localStorage.setItem(STORAGE,JSON.stringify(state));$('saved-state').textContent='已保存';}
 catch{$('saved-state').textContent='内存会话';}
};
const text=(value)=>String(value??'');
const esc=value=>text(value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const options=(choices,selected)=>choices.map(x=>'<option value="'+esc(x)+'"'+(text(x)===text(selected)?' selected':'')+'>'+esc(x)+'</option>').join('');
const notice=message=>{$('notice-message').textContent=message;$('notice-dialog').showModal();};
const status=message=>{$('status-text').textContent=message;};
function ensureShape(page){
 const base=defaults(page.kind);
 for(const key of ['terminals','xSweep','pSweep','fixed','portSettings'])
  if(!page[key]||typeof page[key]!=='object')page[key]=base[key];
 for(const axis of ['xSweep','pSweep'])if(!Array.isArray(page[axis].segments)||!page[axis].segments.length)page[axis].segments=base[axis].segments;
 for(const role of roles)if(!page.portSettings[role])page.portSettings[role]=base.portSettings[role];
 if(!Array.isArray(page.targets))page.targets=[];
 if(!Array.isArray(page.variables))page.variables=[];
 return page;
}
state.pages.forEach(ensureShape);
function tree(){
 const picker=$('device-picker');picker.replaceChildren();
 for(const device of state.devices)picker.add(new Option(device.name,device.id));
 picker.value=state.activeDeviceId;
 const parent=$('routine-list');parent.replaceChildren();
 for(const routine of state.routines.filter(r=>r.deviceId===state.activeDeviceId)){
  const block=document.createElement('div');block.className='routine-block';
  const title=document.createElement('button');title.type='button';
  title.className='routine-heading'+(routine.id===state.activeRoutineId?' active':'');
  title.dataset.routineId=routine.id;
  title.innerHTML='<span class="tree-guide">└</span><span class="tree-icon">▦</span>'+esc(routine.name);
  title.addEventListener('click',()=>{
   state.activeRoutineId=routine.id;
   const index=state.pages.findIndex(p=>p.routineId===routine.id);
   if(index<0){addPage('iv',routine.id);state.editorOpen=false;renderPage();save();}
   else{state.activePage=index;state.editorOpen=false;renderPage();save();closeNav();}
  });
  block.append(title);
  const children=document.createElement('div');children.className='routine-pages';
  state.pages.forEach((page,i)=>{
   if(page.routineId!==routine.id)return;
   const b=document.createElement('button');b.type='button';
   b.className='page-tree'+(state.editorOpen&&i===state.activePage?' active':'');
   b.dataset.pageIndex=String(i);
   b.innerHTML='<span>▧</span><strong>'+esc(page.name||KINDS[page.kind][0])+'</strong>';
   b.addEventListener('click',()=>{
    state.activePage=i;state.activeRoutineId=routine.id;state.editorOpen=true;
    renderPage();save();closeNav();
   });
   children.append(b);
  });
  block.append(children);parent.append(block);
 }
 const target=$('spec-list');target.replaceChildren();
 const visibleSpecs=state.specs.filter(s=>s.deviceId===state.activeDeviceId);
 if(visibleSpecs.length){
  const header=document.createElement('div');header.className='spec-tree-header';
  header.textContent='SPEC';target.append(header);
  for(const spec of visibleSpecs){
   const b=document.createElement('button');b.type='button';b.className='spec-tree';
   b.dataset.specId=spec.id;b.innerHTML='<span>◇</span>'+esc(spec.name);
   b.addEventListener('click',()=>{
    current().associateSpec=true;current().associateSpecId=spec.id;
    state.section='spec';state.editorOpen=true;renderPage();closeNav();save();
   });
   target.append(b);
  }
 }
}
function renderSegments(axis){
 const page=current(),list=page[axis+'Sweep'].segments;
 const body=$(axis+'-segments');body.replaceChildren();
 for(const [i,segment] of list.entries()){
  const row=document.createElement('tr');row.dataset.axis=axis;row.dataset.index=String(i);
  row.innerHTML='<td>'+(i+1)+'</td>'+
   ['startV','stopV','stepV'].map(field=>'<td><input type="number" step="any" data-field="'+field+'" value="'+esc(segment[field])+'" aria-label="'+axis+' '+field+' segment '+(i+1)+'"></td>').join('')+
   '<td><select data-field="rangeA" aria-label="电流档位">'+options(ranges,segment.rangeA)+'</select></td>'+
   '<td><select data-field="speed">'+options(['Fast','Normal','Quiet'],segment.speed)+'</select></td>'+
   '<td><button class="remove-row" type="button" data-remove-segment="'+axis+'" data-index="'+i+'" aria-label="删除该扫描段" '+(list.length===1?'disabled':'')+'>×</button></td>';
  body.append(row);
 }
}
function ports(){
 const page=current();
 for(const role of roles){
  const select=$('port-'+role);select.replaceChildren();
  for(const choice of portChoices)select.add(new Option(choice,choice));
  select.value=page.terminals[role]||'None';
 }
 $('terminal-strip').classList.toggle('is-collapsed',!state.portsVisible);
 $('ports-toggle').textContent=state.portsVisible?'隐藏':'显示';
 $('ports-toggle').setAttribute('aria-expanded',String(state.portsVisible));
}
function terminalSettings(){
 const page=current(),target=$('terminal-settings');target.replaceChildren();
 for(const role of roles){
  const assigned=page.terminals[role];
  if(!assigned||assigned==='None'||assigned==='GNDU')continue;
  const cfg=page.portSettings[role];
  const row=document.createElement('div');row.className='terminal-row';row.dataset.role=role;
  row.innerHTML='<strong>'+roleNames[role]+' · '+esc(assigned)+'</strong>'+
    '<label>Range Mode<select data-setting="rangeMode">'+options(['Auto','Fixed','Limited Auto'],cfg.rangeMode)+'</select></label>'+
    '<label>Current Range (A)<select data-setting="rangeA">'+options(ranges,cfg.rangeA)+'</select></label>'+
    '<label>Compliance Mode<select data-setting="complianceMode">'+options(['Follow range','Custom'],cfg.complianceMode)+'</select></label>'+
    '<label>Compliance (A)<input type="number" step="any" min="1e-12" max="1.05" data-setting="complianceA" value="'+esc(cfg.complianceA)+'"></label>';
  target.append(row);
 }
 if(!target.childElementCount)target.textContent='未分配测量通道';
 fixedBiases();
}
function fixedBiases(){
 const page=current(),target=$('fixed-biases');target.replaceChildren();
 const active=new Set([page.xSweep.terminal]);
 if(page.pSweep.enabled)active.add(page.pSweep.terminal);
 for(const role of roles){
  const terminal=page.terminals[role]||'None';
  if(['None','GNDU'].includes(terminal)||active.has(role))continue;
  const label=document.createElement('label');
  label.innerHTML=roleNames[role]+' · '+esc(terminal)+' (V)<input type="number" step="any" data-fixed="'+role+'" value="'+esc(page.fixed[role]??0)+'">';
  target.append(label);
 }
 if(!target.childElementCount){const p=document.createElement('p');p.className='table-note';p.textContent='当前没有独立的固定偏置通道';target.append(p);}
}
function rows(kind){
 const page=current(),target=$(kind+'-rows');target.replaceChildren();
 const items=kind==='target'?page.targets:page.variables;
 for(const [i,item] of items.entries()){
  const row=document.createElement('tr');row.dataset.index=String(i);row.dataset.table=kind;
  if(kind==='target')row.innerHTML=
    '<td><input data-field="name" value="'+esc(item.name)+'"></td>'+
    '<td><select data-field="terminal">'+options(roles.filter(r=>page.terminals[r]!=='None'&&page.terminals[r]!=='GNDU'),item.terminal)+'</select></td>'+
    '<td><select data-field="parameter">'+options(['Current','Voltage','Time','Charge'],item.parameter)+'</select></td>'+
    '<td><select data-field="range">'+options(ranges,item.range)+'</select></td>';
  else row.innerHTML=
    '<td><input data-field="name" value="'+esc(item.name)+'"></td>'+
    '<td><input data-field="value" value="'+esc(item.value)+'"></td>'+
    '<td><input data-field="unit" value="'+esc(item.unit)+'"></td>';
  row.innerHTML+='<td><button class="remove-row" data-remove-table="'+kind+'" data-index="'+i+'">×</button></td>';
  target.append(row);
 }
}
function renderPage(){
 // The graph is an independent child of the project workspace.
 // A selected Page exposes its inspector without changing shared chart ownership.
 $('main-pane').classList.toggle('editor-open',state.editorOpen===true);
 const page=ensureShape(current());
 state.activeRoutineId=page.routineId;
 const routine=state.routines.find(r=>r.id===page.routineId);
 const device=state.devices.find(d=>d.id===routine?.deviceId);
 state.activeDeviceId=device?.id||state.devices[0].id;
 $('page-heading').textContent=page.name;
 $('kind-tag').textContent=KINDS[page.kind][1];
 $('breadcrumb').textContent='Research Project / '+(device?.name||'Device')+' / '+(routine?.name||'Routine')+' / '+page.name;
 $('page-name').value=page.name;
 $('test-kind').value=page.kind;
 $('loops').value=page.loops;
 $('note').value=page.note||'';
 $('x-terminal').value=page.xSweep.terminal;
 $('p-terminal').value=page.pSweep.terminal;
 $('x-repeats').value=page.xSweep.repeats;
 $('p-repeats').value=page.pSweep.repeats;
 $('p-enabled').checked=page.pSweep.enabled;
 $('p-fields').hidden=!page.pSweep.enabled;
 $('p-off').hidden=page.pSweep.enabled;
 $('scan-mode').value=page.scanMode||'linear';
 $('speed-global').value=page.speed||'Normal';
 $('point-delay').value=page.pointDelay??20;
 $('strategy-loops').value=page.loops;
 const allowedSpecs=state.specs.filter(s=>s.deviceId===state.activeDeviceId);
 const linked=!!page.associateSpec&&allowedSpecs.some(s=>s.id===page.associateSpecId);
 $('associate-spec').checked=linked;
 const picker=$('associate-spec-picker');picker.replaceChildren();
 picker.add(new Option('未关联',''));
 for(const spec of allowedSpecs)picker.add(new Option(spec.name,spec.id));
 picker.value=linked?page.associateSpecId:'';
 picker.disabled=!allowedSpecs.length;
 tree();ports();renderSegments('x');renderSegments('p');terminalSettings();rows('target');rows('var');
 openSection(state.section);openDataView(state.dataView);updatePlan(false);updateFrameWindows();
}
function openSection(section){
 if(!['info','sweep','target','strategy','limits','variables','spec'].includes(section))section='sweep';
 state.section=section;
 document.querySelectorAll('[data-panel]').forEach(p=>p.hidden=p.dataset.panel!==section);
 document.querySelectorAll('[data-section]').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.section===section)));
 save();
}
function updateFrameWindows(){
 $('frame-grid').dataset.layout=String(state.frameLayout);
 $('frame-layout').value=String(state.frameLayout);
 for(const card of document.querySelectorAll('[data-frame-kind]')){
  const i=Number(card.dataset.frameKind)-2;
  card.value=state.frameKinds[i];
  // A static web preview never constructs a substitute for instrument raw samples.
  const empty=document.querySelector('[data-empty-frame="'+(i+2)+'"]');
  if(empty)empty.textContent=card.value==='raw'?'暂无原始采样数据':'暂无原始测量数据';
 }
}
function openDataView(view){
 if(!['plan','graph','raw'].includes(view))view='plan';
 state.dataView=view;
 for(const tab of document.querySelectorAll('[data-data-view]'))tab.classList.toggle('active',tab.dataset.dataView===view);
 for(const name of ['plan','graph','raw'])$(name+'-view').hidden=name!==view;
 if(view==='graph')void renderDKDSChart();
 save();
}
let graphRendered=false;
async function renderDKDSChart(){
 if(graphRendered)return;
 const host=$('measurement-plot');
 if(!window.DKDSCharts?.react||!window.DKDSD3Renderer?.react){
  $('data-empty').textContent='DKDS 绘图组件不可用（仅此网页预览）';return;
 }
 try{
  // Only real instrument rows may enter the acquisition chart. The preview sends [].
  await window.DKDSCharts.react(host,[],{
   autosize:true,showlegend:false,margin:{l:56,r:18,t:16,b:45},
   paper_bgcolor:'rgba(0,0,0,0)',plot_bgcolor:'rgba(0,0,0,0)',
   xaxis:{title:'Voltage (V)',showgrid:true},yaxis:{title:'Current (A)',showgrid:true}
  },{responsive:true,scrollZoom:true,__dkdsNavigationTools:true,dkdsRenderer:'d3'});
  graphRendered=true;
 }catch(error){$('data-empty').textContent='绘图组件尚未就绪：'+String(error.message||error).slice(0,80);}
}
function readAxis(axis){
 const page=current(),node=page[axis+'Sweep'];
 node.terminal=$(axis+'-terminal').value;
 node.repeats=Number($(axis+'-repeats').value);
 node.segments=[...document.querySelectorAll('#'+axis+'-segments tr')].map(row=>{
  const values={};
  for(const f of row.querySelectorAll('[data-field]'))
   values[f.dataset.field]=['startV','stopV','stepV'].includes(f.dataset.field)?Number(f.value):f.value;
  return values;
 });
 if(axis==='p')node.enabled=$('p-enabled').checked;
}
function updatePlan(report){
 const page=current();
 let result;
 try{
  result=PLAN.calculate(page);
  $('plan-summary').textContent='Xsweep: '+result.xPoints+' 点'+
    (result.pEnabled?' × Psweep: '+result.pPoints+' 点':' · Psweep: Off')+
    ' · '+result.loops+' Loop · 合计 '+result.totalPoints+' 点';
  $('points-summary').textContent=result.totalPoints+' planned points';
  plot(result.sample);
  if(report)status('扫描方案预检通过 · '+result.totalPoints+' 点（不代表硬件安全验证）');
 }catch(error){
  $('plan-summary').textContent='参数错误：'+error.message;
  $('points-summary').textContent='Plan invalid';
  plot([]);
  if(report)status('参数错误：'+error.message);
 }
 return result;
}
function plot(points){
 const svg=$('plan-plot'),ns='http://www.w3.org/2000/svg';
 svg.replaceChildren();
 const el=(tag,attrs,textContent)=>{
  const node=document.createElementNS(ns,tag);
  for(const [key,value] of Object.entries(attrs))node.setAttribute(key,String(value));
  if(textContent!==undefined)node.textContent=textContent;
  svg.append(node);return node;
 };
 const width=680,height=310,left=57,right=18,top=18,bottom=48;
 const values=points.flatMap(p=>[p.xV,p.pV]);
 const minimum=values.length?Math.min(0,...values):0,maximum=values.length?Math.max(1,...values):1;
 const lo=minimum===maximum?minimum-1:minimum,hi=minimum===maximum?maximum+1:maximum;
 const xp=index=>left+index/Math.max(1,points.length-1)*(width-left-right);
 const yp=value=>height-bottom-(value-lo)/(hi-lo)*(height-top-bottom);
 for(let i=0;i<=4;i++){
  const y=top+i/4*(height-top-bottom);
  el('line',{x1:left,y1:y,x2:width-right,y2:y,class:'gridline'});
  el('text',{x:40,y:y+4,'text-anchor':'end'},(hi-(hi-lo)*i/4).toFixed(2));
 }
 for(let i=0;i<=5;i++){
  const x=left+i/5*(width-left-right);
  el('line',{x1:x,y1:top,x2:x,y2:height-bottom,class:'gridline'});
  el('text',{x,y:height-bottom+16,'text-anchor':'middle'},points.length?String(Math.floor(i/5*(points.at(-1)?.index||0))):'0');
 }
 if(points.length){
  for(const [key,cls] of [['xV','x-line'],['pV','p-line']]){
   if(key==='pV'&&!current().pSweep.enabled)continue;
   const d=points.map((row,i)=>(i?'L':'M')+xp(i).toFixed(2)+' '+yp(row[key]).toFixed(2)).join(' ');
   el('path',{d,class:cls});
  }
 }
 el('text',{x:width/2,y:height-8,'text-anchor':'middle'},'Planned point index');
 el('text',{x:14,y:height/2,transform:'rotate(-90 14 '+height/2+')','text-anchor':'middle'},'Bias (V)');
 el('text',{x:width-right,y:top+8,'text-anchor':'end'},current().pSweep.enabled?'X / P Bias':'X Bias');
}
function closeNav(){state.navOpen=false;$('shell').classList.remove('nav-open');}
function addPage(kind,routineId=state.activeRoutineId){
 if(!state.routines.some(r=>r.id===routineId))routineId=state.routines[0].id;
 const routine=state.routines.find(r=>r.id===routineId);
 const page=defaults(kind);page.routineId=routineId;state.activeDeviceId=routine.deviceId;
 state.pages.push(page);state.activePage=state.pages.length-1;
 state.activeRoutineId=routineId;state.section='sweep';state.editorOpen=true;
 renderPage();save();closeNav();status('已添加 '+page.name+' Page');
}
function addRoutine(deviceId=state.activeDeviceId){
 if(state.routines.length>=100||state.pages.length>=100){status('Routine 或 Page 已达到上限');return;}
 const id='routine-'+Math.random().toString(36).slice(2,9);
 const routine={id,deviceId,name:'Routine '+(state.routines.length+1)};
 state.routines.push(routine);state.activeRoutineId=id;state.activeDeviceId=deviceId;
 addPage('iv',id);status('已创建 '+routine.name+' 与初始 I–V Page');
}
function addDevice(){
 if(state.devices.length>=100||state.routines.length>=100||state.pages.length>=100){
  status('Device、Routine 或 Page 已达到上限');return;
 }
 const device={id:'device-'+Math.random().toString(36).slice(2,9),
  name:'Device '+(state.devices.length+1)};
 state.devices.push(device);state.activeDeviceId=device.id;
 addRoutine(device.id);status('已创建 '+device.name+' 与初始 Routine / Page');
}
function selectDevice(deviceId){
 if(!state.devices.some(d=>d.id===deviceId))return;
 state.activeDeviceId=deviceId;
 const ids=new Set(state.routines.filter(r=>r.deviceId===deviceId).map(r=>r.id));
 const index=state.pages.findIndex(p=>ids.has(p.routineId));
 if(index<0)addRoutine(deviceId);
 else{state.activePage=index;state.editorOpen=false;renderPage();save();closeNav();}
}
function addSpec(){
 if(state.specs.length>=100){status('最多 100 个 Spec');return;}
 const spec={id:'spec-'+Math.random().toString(36).slice(2,9),deviceId:state.activeDeviceId,
  name:'Spec '+(state.specs.length+1)};
 state.specs.push(spec);current().associateSpec=true;
 current().associateSpecId=spec.id;state.section='spec';state.editorOpen=true;
 renderPage();save();status('已新建并关联 '+spec.name);
}
function openPicker(){$('choose-kind').showModal();}
function doExport(){
 save();
 const payload={format:'dkts-fspro-page-plan',version:2,source:'web-ui-preview',
  warning:'Not verified or executable on Keithley 4200A',
   devices:state.devices,routines:state.routines,specs:state.specs,pages:state.pages};
 const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
 const href=URL.createObjectURL(blob),link=document.createElement('a');
 link.href=href;link.download='DKTS-Page-Plan.json';link.click();
 setTimeout(()=>URL.revokeObjectURL(href),500);
 status('已导出规划 JSON（不包含仪器实测数据）');
}
document.addEventListener('click',event=>{
 const b=event.target.closest('button');if(!b)return;
 if(b.dataset.section){openSection(b.dataset.section);return;}
 if(b.dataset.dataView){openDataView(b.dataset.dataView);return;}
 if(b.dataset.kind){addPage(b.dataset.kind);return;}
 if(b.dataset.removeSegment){
  const axis=b.dataset.removeSegment,list=current()[axis+'Sweep'].segments;
  if(list.length>1){list.splice(Number(b.dataset.index),1);renderSegments(axis);updatePlan(false);save();}return;
 }
 if(b.dataset.removeTable){
  const list=b.dataset.removeTable==='target'?current().targets:current().variables;
  list.splice(Number(b.dataset.index),1);rows(b.dataset.removeTable);save();return;
 }
 if(b.dataset.workspace){
  if(b.dataset.workspace!=='test')notice('该工作区属于完整 DKDS Core 宿主。当前页面只验证 FS-Pro 测试编辑器，未假装这些功能已完成迁移。');
  return;
 }
});
document.addEventListener('input',event=>{
 const t=event.target,p=current();
 if(t.id==='page-name'){p.name=t.value.slice(0,60);$('page-heading').textContent=p.name;tree();}
 else if(t.id==='note')p.note=t.value;
 else if(t.id==='loops'||t.id==='strategy-loops'){p.loops=Number(t.value);$('loops').value=p.loops;$('strategy-loops').value=p.loops;}
 else if(t.id==='point-delay')p.pointDelay=Number(t.value);
 else if(t.dataset.fixed)p.fixed[t.dataset.fixed]=Number(t.value);
 else if(t.dataset.setting){
  const row=t.closest('.terminal-row');if(row)p.portSettings[row.dataset.role][t.dataset.setting]=t.value;
 }
 else if(t.closest('tr[data-axis]')){
  const row=t.closest('tr[data-axis]'),segment=p[row.dataset.axis+'Sweep'].segments[Number(row.dataset.index)];
  if(segment){const key=t.dataset.field;segment[key]=['startV','stopV','stepV'].includes(key)?Number(t.value):t.value;}
 }
 else if(t.closest('tr[data-table]')){
  const row=t.closest('tr[data-table]'),arr=row.dataset.table==='target'?p.targets:p.variables,item=arr[Number(row.dataset.index)];
  if(item)item[t.dataset.field]=t.value;
 }
 else if(t.id==='x-repeats'||t.id==='p-repeats'||t.id==='x-terminal'||t.id==='p-terminal'||t.id==='p-enabled'){
  const axis=t.id.startsWith('x-')?'x':'p';readAxis(axis);
  if(t.id==='p-enabled'){$('p-fields').hidden=!p.pSweep.enabled;$('p-off').hidden=p.pSweep.enabled;}
  fixedBiases();
 }
 if(t.id==='associate-spec'){
   const candidates=state.specs.filter(s=>s.deviceId===state.activeDeviceId);
   p.associateSpec=t.checked&&candidates.length>0;
   if(p.associateSpec&&!candidates.some(s=>s.id===p.associateSpecId))p.associateSpecId=candidates[0].id;
   $('associate-spec').checked=p.associateSpec;
   $('associate-spec-picker').value=p.associateSpec?p.associateSpecId:'';
 }
 if(t.id==='associate-spec-picker'){
   p.associateSpec=!!t.value;p.associateSpecId=t.value||null;
   $('associate-spec').checked=p.associateSpec;
 }
 if(t.id==='scan-mode')p.scanMode=t.value;
 if(t.id==='speed-global')p.speed=t.value;
 updatePlan(false);save();
});
document.addEventListener('change',event=>{
 const t=event.target;
 if(t.id==='frame-layout'){
  state.frameLayout=t.value;updateFrameWindows();save();return;
 }
 if(t.dataset.frameKind){
  state.frameKinds[Number(t.dataset.frameKind)-2]=t.value;
  updateFrameWindows();save();return;
 }
 if(t.dataset.port){
  const role=t.dataset.port,p=current(),used=roles.filter(r=>r!==role&&p.terminals[r]===t.value);
  if(t.value!=='None'&&t.value!=='GNDU'&&used.length){
   status('端口冲突：'+t.value+' 已分配给 '+roleNames[used[0]]);
   t.value=p.terminals[role];return;
  }
  p.terminals[role]=t.value;terminalSettings();rows('target');updatePlan(false);save();
 }
 if(t.id==='test-kind'){current().kind=t.value;current().name=KINDS[t.value][0];renderPage();save();}
});
for(const axis of ['x','p'])$(axis+'-add').addEventListener('click',()=>{
 const list=current()[axis+'Sweep'].segments,last=list.at(-1);
 if(list.length>=64){status('最多 64 个扫描段');return;}
 list.push({...last});renderSegments(axis);updatePlan(false);save();
});
$('validate').addEventListener('click',()=>updatePlan(true));
$('save').addEventListener('click',()=>{save();status('规划已保存至当前浏览器会话');});
$('new-device').addEventListener('click',addDevice);
$('new-routine').addEventListener('click',()=>addRoutine());
$('device-picker').addEventListener('change',e=>selectDevice(e.target.value));
$('new-page').addEventListener('click',openPicker);
$('new-spec').addEventListener('click',addSpec);
$('spec-add-inline').addEventListener('click',addSpec);
$('choose-close').addEventListener('click',()=>$('choose-kind').close());
$('choose-grid').replaceChildren();
for(const [kind,[name]] of Object.entries(KINDS)){
 const b=document.createElement('button');b.textContent=name;b.dataset.kind=kind;
 b.addEventListener('click',()=>$('choose-kind').close());$('choose-grid').append(b);
}
$('export-project').addEventListener('click',doExport);
$('project-overview').addEventListener('click',()=>{
 state.editorOpen=false;renderPage();save();closeNav();status('工程数据图');
});
$('back-to-graphs').addEventListener('click',()=>$('project-overview').click());
$('ports-toggle').addEventListener('click',()=>{state.portsVisible=!state.portsVisible;ports();save();});
$('theme-toggle').addEventListener('click',()=>{
 state.theme=state.theme==='light'?'dark':'light';
 document.body.dataset.theme=state.theme;save();
 if(graphRendered){graphRendered=false;void renderDKDSChart();}
});
$('lang-toggle').addEventListener('click',()=>{
 state.lang=state.lang==='zh'?'en':'zh';
 document.documentElement.lang=state.lang==='zh'?'zh-CN':'en';
 status(state.lang==='en'?'English mode selected; FS-Pro technical labels retained.':'已切换至中文模式');
 save();
});
$('version').addEventListener('click',()=>notice('网页版仅用于 FS-Pro 界面评审。热更新不改变安装包 Vx.y.z；该页面不是已发布的 DKDS Core 应用。'));
$('nav-toggle').addEventListener('click',()=>{state.navOpen=!state.navOpen;$('shell').classList.toggle('nav-open',state.navOpen);});
$('collapse-tree').addEventListener('click',closeNav);
$('notice-close').addEventListener('click',()=>$('notice-dialog').close());
$('notice-ok').addEventListener('click',()=>$('notice-dialog').close());
$('target-add').addEventListener('click',()=>{
 current().targets.push({name:'I'+(current().targets.length+1),terminal:'drain',parameter:'Current',range:'Auto'});
 rows('target');save();
});
$('var-add').addEventListener('click',()=>{
 current().variables.push({name:'variable'+(current().variables.length+1),value:'0',unit:'V'});
 rows('var');save();
});
window.DKTSFSProDemo=Object.freeze({
 preview:true,instrumentOutput:false,syntheticRawData:false,
 snapshot:()=>structuredClone(state),calculate:()=>PLAN.calculate(current()),
 createPage:addPage,createRoutine:addRoutine,createDevice:addDevice,selectDevice,createSpec:addSpec,
 showProject:()=>{state.editorOpen=false;renderPage();},
 openPage:index=>{if(!state.pages[index])throw Error('Page not found');state.activePage=index;state.editorOpen=true;renderPage();}
});
document.body.dataset.theme=state.theme;
renderPage();
status('FS-Pro 工作区预览 · 无硬件连接');
})();