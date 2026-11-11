(() => {
'use strict';
const host=document.getElementById('fs-modal-host');
const shell=document.getElementById('fs-shell');
const VALIDATE=window.DK4200PagePlanGuard?.validatePagePlan;
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clone=value=>JSON.parse(JSON.stringify(value));
const e=value=>esc(value);
const modes=['Constant','Linear Step','Linear Points','Log Points','List','Generator'];
const roles=[['CONDITION','Condition'],['X','Xsweep'],['P','Psweep']];
const inventory=new Set(); // Filled exclusively by a trusted native 4200A module enumeration.
const sample=()=>({
  schema:'dkts.fspro.page.v1', project:'Project',device:'Device 01',routine:'Routine 01',
  info:{type:'Mosfet',polarity:'PMOS',group:'MOS_IV',testType:'DC',name:'IV Sweep'},
  refNode:'S',refValue:'0',outputs:'Id',
  terminals:[
    {logical:'D',sourceMode:'voltage',signal:'Vds',resource:'None',relativeTo:'S',role:'CONDITION',generator:'Constant',bias:'0.05',compliance:'0.1',measureRange:{mode:'auto',value:'1e-6'},segments:[]},
    {logical:'G',sourceMode:'voltage',signal:'Vgs',resource:'None',relativeTo:'S',role:'X',generator:'Linear Step',start:'-0.3',stop:'0',step:'0.02',points:'21',compliance:'0.1',measureRange:{mode:'auto',value:'1e-6'},segments:[]},
    {logical:'S',sourceMode:'voltage',signal:'Vs',resource:'None',relativeTo:'GND',role:'CONDITION',generator:'Constant',bias:'0',compliance:'0.1',measureRange:{mode:'auto',value:'1e-6'},segments:[]},
    {logical:'B',sourceMode:'voltage',signal:'Vbs',resource:'None',relativeTo:'S',role:'P',generator:'Linear Points',start:'0',stop:'-1.1',step:'0.1',points:'5',compliance:'0.1',measureRange:{mode:'auto',value:'1e-6'},segments:[]}
  ],
  pageVars:[{name:'vgs',value:'1.1'},{name:'vstep',value:'0.02'},{name:'vbb',value:'-1.1'},{name:'vdthx',value:'0.05'}],
  associateSpecs:[],
  target:{expression:'Id = I(D)',plot:{X:'Vgs',Y:'Id',H:'',P:''},quoteVars:[]},
  strategy:{scope:'Local Setting',method:'Custom',integrationTime:'0.02',delayTime:'0.04',sourceRange:'Auto',measureRange:'Auto'}
});
const TEST_TYPES=Object.freeze([
 {id:'iv',label:'I–V Sweep',testType:'DC',group:'MOS_IV'},
 {id:'transfer',label:'Transfer Sweep',testType:'DC',group:'MOS_TRANSFER'},
 {id:'time',label:'Time Sweep',testType:'IVT',group:'TIME'},
 {id:'pulse',label:'Pulse Sweep',testType:'Pulse',group:'PULSE'},
 {id:'cv',label:'C–V Sweep',testType:'CV',group:'CV'}
]);
let saved=sample(),pages=[{id:'page-1',data:clone(saved)}],activePageId='page-1',pageSeq=1,
 draft=null,original=null,activeTab='Sweep',activeDialog='',unlocked=true,connectionOrigin='';
let frameViewer=null;
const ensureFrameViewer=()=>{
 if(frameViewer)return frameViewer;
 if(!window.DK4200RawData?.validate||!window.DK4200FrameView?.create||!window.DKDSScientificPlot?.createScope)
  throw new Error('DKDS 科学绘图组件尚未加载完成');
 frameViewer=window.DK4200FrameView.create({
  root:document.getElementById('fs-shell'),
  plotRuntime:window.DKDSScientificPlot,rawData:window.DK4200RawData
 });
 return frameViewer;
};
document.addEventListener('dkts:frame-selected',event=>{
 const index=event.detail?.index;
 if(!Number.isInteger(index)||index<0||index>3||!frameViewer?.hasCapture?.())return;
 // The plot must be visible before DKDS Core measures its canvas dimensions.
 requestAnimationFrame(()=>frameViewer.refreshFrame(index).catch(error=>{
  note('图窗刷新失败：'+String(error?.message||error).slice(0,90));
 }));
});
function saveText(filename,text,mime){
 const blob=new Blob([text],{type:mime}),url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);
}
function showDataViewer(){
 const table=frameViewer?.table?.();if(!table){note('当前没有可查看的仪器原始数据');return;}
 const host=document.getElementById('fs-data-host');
 const fields=table.columns.map(c=>`${e(c.label)}${c.unit?` (${e(c.unit)})`:''}`);
 const statusKeys=[...new Set(table.rows.flatMap(row=>Object.keys(row.channelStatuses||{})))].sort();
 const nativeKeys=[...new Set(table.rows.flatMap(row=>Object.keys(row.instrumentStatuses||{})))].sort();
 const heads=['Index','Sweep','Status',...fields,
  ...statusKeys.map(x=>x+' N/C'),...nativeKeys.map(x=>x+' 仪器状态')].map(v=>`<th scope="col">${e(v)}</th>`).join('');
 const displayStatus=value=>value===1?'限流 (C)':value===0?'正常 (N)':'未知';
 const rows=table.rows.slice(0,800).map(row=>`<tr data-native-status="${row.status===1?'compliance':row.status===0?'normal':'unknown'}"><td>${row.index}</td><td>${e(row.sweepId)}</td><td>${displayStatus(row.status)}</td>${table.columns.map(c=>`<td>${e(row.values[c.id]??'')}</td>`).join('')}${statusKeys.map(key=>`<td>${e(row.channelStatuses?.[key]??'')}</td>`).join('')}${nativeKeys.map(key=>`<td>${e(row.instrumentStatuses?.[key]??'')}</td>`).join('')}</tr>`).join('');
 const countC=table.rows.filter(row=>row.status===1).length;
 const countUnknown=table.rows.filter(row=>row.status!==0&&row.status!==1).length;
 host.innerHTML=`<div class="fs-editor fs-data-dialog" role="dialog" aria-modal="true" aria-label="Data Viewer"><div class="fs-editor-title">Data Viewer<button data-raw-action="close" aria-label="关闭">×</button></div><p class="fs-data-note">原始采样：${e(table.captureId)} · 显示前 ${Math.min(table.rows.length,800)} / ${table.rows.length} 行 · 限流 ${countC} · 状态未知 ${countUnknown}。导出 CSV 保留全部原始数值与状态文本。</p><div class="fs-data-table-wrap"><table class="fs-data-table"><thead><tr>${heads}</tr></thead><tbody>${rows}</tbody></table></div><footer class="fs-editor-footer"><button data-raw-action="export">Export CSV</button><button data-raw-action="export-native">Raw JSON</button><button data-raw-action="close" class="fs-primary">Close</button></footer></div>`;
 const previewRowCount=Math.min(table.rows.length,800);
 const desiredHeight=Math.min(740,Math.max(245,172+Math.min(previewRowCount,20)*26));
 const dataDialog=host.querySelector('.fs-data-dialog');
  if(dataDialog)window.DKDSStyleGate.setToken(dataDialog,'--fs-data-height',desiredHeight+'px',{component:'dkts.fspro.data-dialog',owner:'dkts.fspro.editor',source:'src/4200a-fspro/editor.js'});
 host.hidden=false;
}
document.getElementById('fs-data-host').addEventListener('click',ev=>{
 const action=ev.target.closest('[data-raw-action]')?.dataset.rawAction;
 if(action==='close'){const host=document.getElementById('fs-data-host');host.hidden=true;host.innerHTML='';}
 if(action==='export')exportRawCSV();
  if(action==='export-native')exportNativeRawJSON();
});
function exportNativeRawJSON(){
  try{
   const viewer=ensureFrameViewer();
   if(!viewer.hasCapture())throw new Error('当前没有仪器原始数据');
   const table=viewer.table();
   saveText(`${table.captureId}.raw.json`,viewer.rawJSON(),'application/json;charset=utf-8');
   note('已导出原始 KXCI 帧、精确数值文本与完整采样记录');
  }catch(err){note('无法导出原始记录：'+err.message);}
 }
 function exportRawCSV(){
 try{
  const viewer=ensureFrameViewer();
  if(!viewer.hasCapture())throw new Error('当前没有仪器原始数据');
  const table=viewer.table();
  saveText(`${table.captureId}.csv`,viewer.exportCSV(),'text/csv;charset=utf-8');
  note('已导出包含全部采样点的原始数据 CSV');
 }catch(err){note('无法导出原始数据：'+err.message);}
}
document.getElementById('fs-raw-input').addEventListener('change',async ev=>{
 const file=ev.target.files?.[0];if(!file)return;
 try{
  if(file.size>48*1024*1024)throw new Error('文件超过 48 MiB，请采用分段采集文件');
  const raw=JSON.parse(await file.text());
  const checked=window.DK4200RawData?.validate?.(raw);
  if(!checked?.valid)throw new Error('不符合 4200A 原始采样记录格式：'+(checked?.errors?.[0]?.code||'SCHEMA'));
  await ensureFrameViewer().setCapture(raw,{provenance:'imported-file'});
  note(`已导入原始记录 ${raw.captureId}，${raw.samples.length} 点（导入文件，非当前在线测量）`);
 }catch(err){note('导入原始数据失败：'+err.message);}
 finally{ev.target.value='';}
});

const options=(items,selected)=>items.map(item=>{const [v,l,disabled,reason]=Array.isArray(item)?item:[item,item];return `<option value="${e(v)}"${String(v)===String(selected)?' selected':''}${disabled?' disabled':''}${disabled&&reason?' title="'+e(reason)+'"':''}>${e(l)}</option>`}).join('');
const field=(label,key,value,kind='text',extra='')=>`<span class="fs-inline-field"><label for="field-${e(key)}">${e(label)}</label><input id="field-${e(key)}" data-bind="${e(key)}" type="${kind}" value="${e(value)}" ${extra}></span>`;
const select=(key,opts,value,attrs='')=>`<select data-bind="${e(key)}" aria-label="${e(key)}" ${attrs}>${options(opts,value)}</select>`;
const get=(obj,path)=>path.replace(/\[(\d+)\]/g,'.$1').split('.').reduce((x,k)=>x?.[k],obj);
const set=(obj,path,value)=>{const parts=path.replace(/\[(\d+)\]/g,'.$1').split('.');let at=obj;for(const k of parts.slice(0,-1)){if(!Object.prototype.hasOwnProperty.call(at,k))throw Error('Invalid field');at=at[k];}if(!Object.prototype.hasOwnProperty.call(at,parts[parts.length-1]))throw Error('Invalid field '+path);at[parts[parts.length-1]]=value;};
const note=message=>{document.getElementById('fs-messages').textContent=String(message??'').slice(0,320);};
const emptyOption=(id)=>[['None','None'],...Array.from(inventory).sort().map(v=>[v,v])];
function buildSequence(t){
  const map={'Linear Step':'linear_step','Linear Points':'linear_points','Log Points':'log_points','List':'list','Generator':'multi_segment','Constant':'linear_points'};
  const mode=map[t.generator]||'linear_step';
  if(mode==='linear_step')return {mode,start:t.start??'0',stop:t.stop??'0',step:t.step??'1'};
  if(mode==='linear_points'||mode==='log_points')return {mode,start:t.start??'0',stop:t.stop??'0',points:t.points??'1'};
  if(mode==='list')return {mode,values:String(t.list??'').split(/[\s,]+/).filter(Boolean)};
  return {mode,segments:(t.segments?.length?t.segments:[{start:t.start??'0',stop:t.stop??'0'}])};
}
function createValidationPlan(){
  const x=draft.terminals.find(t=>t.role==='X'),p=draft.terminals.find(t=>t.role==='P');
  return {terminals:draft.terminals.map(t=>({
    logical:t.logical,resource:t.resource,role:t.role,sourceMode:t.sourceMode,compliance:t.compliance,
    relativeTo:t.relativeTo==='GND'?'GND':t.relativeTo,
    bias:t.bias??'0',measureRange:t.measureRange
  })),xSweep:x?buildSequence(x):undefined,...(p?{pSweep:buildSequence(p)}:{})};
}
function validateDraft(){
  if(!draft)return {valid:false,errors:[{reason:'No page'}]};
  const result=VALIDATE?VALIDATE(createValidationPlan()):{valid:false,errors:[{reason:'Validation module not loaded'}],warnings:[],executionAuthorized:false};
  const extra=[];
  // Non-DC Page is editable but remains blocked by the native KXCI compiler.
  for(const [i,t] of draft.terminals.entries()){
    // Saved offline assignments are not evidence of installed physical modules.
    if(!t.logical.trim())extra.push({code:'EMPTY_TERMINAL',path:`terminals[${i}].logical`,reason:'Terminal name is required'});
    if(t.role!=='CONDITION'&&!['Linear Step','Linear Points','Log Points','List','Generator'].includes(t.generator))extra.push({code:'SWEEP_GENERATOR',path:`terminals[${i}].generator`,reason:'Sweep must use a sweep generator'});
    if(t.role==='CONDITION'&&t.generator==='Constant'&&!String(t.bias||'').trim())extra.push({code:'EMPTY_BIAS',path:`terminals[${i}].bias`,reason:'Constant bias is required'});
  }
  return {...result,valid:result.valid&&extra.length===0,errors:[...result.errors,...extra],executionAuthorized:false};
}
function updateStatus(){
  if(activeDialog!=='page')return;
  const el=document.querySelector('.fs-validation');
  if(!el)return;
  const v=validateDraft();
  el.classList.toggle('fs-error',!v.valid);
  const configured=draft.terminals.some(t=>t.measureRange?.mode!=='auto');
  el.textContent=v.valid?(draft.info.testType!=='DC'?'仅离线配置：该测试类型尚未接入原生测量':draft.terminals.some(t=>t.resource!=='None'&&!inventory.has(t.resource))?'离线保存：物理通道尚未验证':configured?'量程参数已配置 · 需实机验证全程保持':'离线参数检查通过 · 未启用仪器输出'):
    `检查：${v.errors[0]?.reason||'无效参数'}`;
  el.title=v.errors.map(x=>x.path+' '+x.reason).join('\n');
}
function infoMarkup(){
 const i=draft.info;
 const opts=[['Mosfet','Mosfet'],['Diode','Diode'],['2-terminal','2-terminal'],['Custom','Custom']];
 return `<fieldset class="fs-fieldset"><legend>Info</legend><div class="fs-info">
 <span class="fs-inline-field"><label>Type:</label>${select('info.type',opts,i.type)}</span>
 <span class="fs-inline-field"><label>Polarity:</label>${select('info.polarity',['PMOS','NMOS','N/A'],i.polarity)}</span>
 ${field('Group:','info.group',i.group)}
 <span class="fs-inline-field"><label>Test Type:</label>${select('info.testType',[['DC','DC'],['IVT','IVT'],['Pulse','Pulse'],['CV','CV']],i.testType)}</span>
 ${field('Name:','info.name',i.name)}
 </div></fieldset>`;
}
function generatorFields(t,i,j=null) {
 const prefix=j===null?`terminals[${i}]`:`terminals[${i}].segments[${j}]`;
 const kind=j===null?t.generator:(t.segments[j].generator||'Linear Step');
 const value=(key)=>j===null?(t[key]??''):(t.segments[j][key]??'');
 const inp=(key,cls='fs-small-input')=>`<input class="${cls}" data-bind="${e(prefix+'.'+key)}" aria-label="${e(key)}" value="${e(value(key))}"/>`;
 if(kind==='Constant'||kind==='Generator') return inp('bias','fs-expression');
 if(kind==='List')return inp('list','fs-expression');
 return `<label>Start:</label>${inp('start')}<label>Stop:</label>${inp('stop')}<label>${kind==='Linear Step'?'Step:':'Points:'}</label>${inp(kind==='Linear Step'?'step':'points')}`;
}
function segmentMarkup(t,i){
 const segmentRows=(t.segments||[]).map((s,j)=>`<div class="fs-segment-row" data-segment="${j}">
 <span class="fs-muted">Segment ${j+2}</span>
 ${select(`terminals[${i}].segments[${j}].generator`,modes.filter(m=>m!=='Generator'),s.generator)}
 <div class="fs-generator-values">${generatorFields(t,i,j)}</div>
 <button data-action="remove-segment" data-i="${i}" data-j="${j}" aria-label="删除分段">−</button></div>`).join('');
 return segmentRows;
}
function visibleTerminals(){return draft.terminals.map((t,i)=>({t,i})).filter(row=>row.t.resource!=='None');}
function terminalMarkup(t,i){
 const logicalOpts=visibleTerminals().filter(row=>row.i!==i).map(row=>[row.t.logical,row.t.logical]);
 const segmentButton=`<button data-action="add-segment" data-i="${i}" title="在当前端子下方添加分段">+</button>`;
  const voltageMeasurement=t.sourceMode==='current';
  // The measured quantity is voltage if the SMU sources current.
  // Never display current-range presets for voltage measurement.
  const presetRanges=voltageMeasurement?
    ['2e-1','2e0','2e1','2e2']:
    ['1e-12','1e-11','1e-10','1e-9','1e-8','1e-7','1e-6','1e-5','1e-4','1e-3','1e-2','1e-1','1e0'];
 return `<div class="fs-terminal" data-terminal="${i}"><div class="fs-terminal-top">
 <strong class="fs-terminal-label">${e(t.logical)}</strong>
 ${select(`terminals[${i}].sourceMode`,[['voltage','Voltage'],['current','Current']],t.sourceMode)}
 <span class="fs-signal-name">${e(t.signal)}${t.role==='X'?' (X)':t.role==='P'?' (P)':''}</span>
 <div class="fs-generator">
 <button data-action="remove-segment" data-i="${i}" data-j="-1" title="删除最后一个分段" ${t.segments?.length?'':'disabled'}>−</button>
 ${select(`terminals[${i}].generator`,modes,t.generator)}
 <div class="fs-generator-values">${generatorFields(t,i)}</div>
 ${segmentButton}
 </div></div>
 <div class="fs-terminal-bottom">
 <div class="fs-terminal-reference" aria-label="${e(t.logical)} 参考节点与扫描角色">
  <label>Ref to:</label>${select(`terminals[${i}].relativeTo`,[['GND','GND'],...logicalOpts],t.relativeTo)}
  ${select(`terminals[${i}].role`,roles,t.role)}
 </div>
 <div class="fs-terminal-range" aria-label="${e(t.logical)} 量程与限流">
   <label>测量档位</label>
   ${select(`terminals[${i}].measureRange.mode`,
     [['auto','自动'],['minimum','自动下限',voltageMeasurement,'仅支持电流测量'],['fixed','即时指定']],t.measureRange?.mode||'auto',
     `data-fs-range-mode="${i}"`)}
   <label>${t.sourceMode==='voltage'?'电流 (A)':'电压 (V)'}</label>
   <input class="fs-range-value" data-bind="terminals[${i}].measureRange.value"
     aria-label="${e(t.logical)} 测量档位值" inputmode="decimal"
     value="${e(t.measureRange?.value||'1e-6')}"
     ${t.measureRange?.mode==='auto'?'disabled':''}/>
   <label>预设档位</label>
   <select class="fs-range-presets" data-range-preset="${i}" aria-label="${e(t.logical)} 固定量程预设"
     ${t.measureRange?.mode==='auto'?'disabled':''}>
     ${options([['','自定义'],...presetRanges.map(v=>[v,v])],
       t.measureRange?.mode!=='auto'?t.measureRange?.value:'')}
   </select>
   <span class="fs-range-note" title="RG 设置电流自动量程下限；RI/RV 请求即时量程，是否全程保持需要实机验收">量程指令仅离线编译</span>
 </div></div>${segmentMarkup(t,i)}</div>`;
}
function limitsPanel(){
 return `<div class="fs-triptych-panel"><h3>Limits</h3><div class="fs-table-wrap"><table class="fs-table">
 <thead><tr><th>Node</th><th>I (A)</th><th>V</th></tr></thead><tbody>
 ${visibleTerminals().map(({t,i})=>`<tr><td>${e(t.logical)}</td><td>${t.sourceMode==='voltage'?`<input data-bind="terminals[${i}].compliance" value="${e(t.compliance)}" aria-label="${e(t.logical)} current compliance"/>`:'—'}</td><td>${t.sourceMode==='current'?`<input data-bind="terminals[${i}].compliance" value="${e(t.compliance)}" aria-label="${e(t.logical)} voltage compliance"/>`:'—'}</td></tr>`).join('')}
 </tbody></table></div></div>`;
}
function varsPanel(){
 return `<div class="fs-triptych-panel"><h3>Page Var</h3><div class="fs-panel-row"><div class="fs-table-wrap"><table class="fs-table"><thead><tr><th>Name</th><th>Value</th></tr></thead><tbody>
 ${draft.pageVars.map((v,i)=>`<tr><td><input aria-label="变量名" data-bind="pageVars[${i}].name" value="${e(v.name)}"/></td><td><input aria-label="变量值" data-bind="pageVars[${i}].value" value="${e(v.value)}"/></td></tr>`).join('')}
 </tbody></table></div><div class="fs-rail"><button data-action="add-var" title="增加变量">+</button><button data-action="remove-var" title="删除最后一个变量" ${draft.pageVars.length?'':'disabled'}>−</button></div></div></div>`;
}
function specsPanel(){
 return `<div class="fs-triptych-panel"><h3>Associate Spec</h3><div class="fs-panel-row"><div class="fs-table-wrap"><table class="fs-table"><tbody>
 ${draft.associateSpecs.map((v,i)=>`<tr><td><input aria-label="关联规格" data-bind="associateSpecs[${i}]" value="${e(v)}"/></td></tr>`).join('')}
 </tbody></table></div><div class="fs-rail"><button data-action="add-spec" title="增加关联规格">+</button><button data-action="remove-spec" title="删除最后一个规格" ${draft.associateSpecs.length?'':'disabled'}>−</button></div></div></div>`;
}
function sweepMarkup(){
 return `<div class="fs-sweep-head">
 <span class="fs-inline-field"><label>RefNode:</label>${select('refNode',draft.terminals.map(t=>t.logical),draft.refNode)}</span>
 <span class="fs-inline-field"><input aria-label="Reference Value" data-bind="refValue" value="${e(draft.refValue)}"/><label>(V)</label></span>
 <label>Outputs:</label><input data-bind="outputs" aria-label="Outputs" value="${e(draft.outputs)}"/>
 </div><section class="fs-terminal-list" aria-label="Input Setting"><div class="fs-section-title">Input Setting</div>
 ${visibleTerminals().length?visibleTerminals().map(({t,i})=>terminalMarkup(t,i)).join(''):'<div class="fs-no-ports">尚未分配测量通道，请先到「端口配置」选择实际模块。</div>'}</section>
 <section class="fs-triptych" aria-label="Limits Page Var Associate Spec">
 ${limitsPanel()}${varsPanel()}${specsPanel()}</section>`;
}
function targetMarkup(){
 const p=draft.target.plot;
 return `<div class="fs-target"><div class="fs-target-top">
 <textarea data-bind="target.expression" aria-label="Function editor" spellcheck="false">${e(draft.target.expression)}</textarea>
 <aside class="fs-function-info"><strong>Function Info</strong><p>V(node), I(node) · 输出量引用</p><p>公式仅保存为文本，尚未连接求值引擎。</p></aside>
 </div><div class="fs-triptych">
 <div class="fs-triptych-panel"><h3>Plot</h3><div class="fs-plot-options">
 ${['X','Y','H','P'].map(a=>`<span class="fs-inline-field"><label>${a}:</label><input aria-label="Plot ${a}" data-bind="target.plot.${a}" value="${e(p[a])}" class="fs-plot-input"/></span>`).join('')}
 </div></div>
 ${varsPanel()}
 <div class="fs-triptych-panel"><h3>Quote Var</h3><div class="fs-table-wrap"><table class="fs-table"><tbody>
 ${draft.target.quoteVars.map((x,i)=>`<tr><td><input data-bind="target.quoteVars[${i}]" value="${e(x)}"/></td></tr>`).join('')}
 </tbody></table></div></div></div></div>`;
}
function strategyMarkup(){
 const s=draft.strategy;
 return `<div class="fs-strategy"><div class="fs-strategy-grid">
 <label>Strategy:</label>${select('strategy.scope',['Global Setting','Local Setting'],s.scope)}
 <label>Source / Measure:</label>${select('strategy.method',['Custom','Standard'],s.method)}
 <label>Integration Time (s):</label><input data-bind="strategy.integrationTime" value="${e(s.integrationTime)}"/>
 <label>Delay Time (s):</label><input data-bind="strategy.delayTime" value="${e(s.delayTime)}"/>
 <label>Source Range:</label>${select('strategy.sourceRange',['Auto','Fixed'],s.sourceRange)}
 <label>Measure Range:</label>${select('strategy.measureRange',['Auto','Fixed'],s.measureRange)}
 </div>
 <fieldset class="fs-fieldset"><legend>Per-Terminal Measurement Range</legend>
 <table class="fs-connection-table"><thead><tr><th>Terminal</th><th>Range Mode</th><th>Range Value</th></tr></thead><tbody>
 ${visibleTerminals().map(({t,i})=>`<tr><td>${e(t.logical)}</td>
 <td>${select(`terminals[${i}].measureRange.mode`,[['auto','Auto'],['minimum','Auto Floor (I)'],['fixed','Immediate Range']],t.measureRange.mode)}</td>
 <td><input aria-label="${e(t.logical)} range value" data-bind="terminals[${i}].measureRange.value" value="${e(t.measureRange.value)}" ${t.measureRange.mode==='auto'?'disabled title="自动量程模式"':''}/></td>
 </tr>`).join('')}
 </tbody></table></fieldset></div>`;
}
function pageHTML(){
 return `<div class="fs-editor" role="dialog" aria-modal="true" aria-label="Edit Page">
 <div class="fs-editor-title">Edit Page<button data-action="cancel" title="关闭" aria-label="关闭">×</button></div>
 <div class="fs-editor-main">
 ${infoMarkup()}
 <div class="fs-editor-controls">
 <button data-action="lock" class="fs-primary">${unlocked?'Lock':'Unlock'}</button>
 <button data-action="reset">Reset</button>
 <button data-action="connection">Set Connection</button>
 <button data-action="autoscale" disabled title="需要确认 4200A 测量范围配置后才能启用">AutoScale</button>
 <button data-action="unscale" disabled title="需要确认 4200A 测量范围配置后才能启用">UnScale</button>
 </div>
 <div class="fs-tabs" role="tablist">
 ${['Sweep','Target','Strategy'].map(t=>`<button data-action="tab" data-tab="${t}" role="tab" aria-selected="${t===activeTab}" id="fs-tab-${t}">${t}</button>`).join('')}
 </div>
 <div class="fs-tab-content" role="tabpanel" aria-labelledby="fs-tab-${activeTab}">
 ${activeTab==='Sweep'?sweepMarkup():activeTab==='Target'?targetMarkup():strategyMarkup()}
 </div>
 </div>
 <footer class="fs-editor-footer"><span class="fs-validation" role="status"></span>
 <button data-action="ok" class="fs-primary">OK</button><button data-action="cancel">Cancel</button></footer>
 </div>`;
}
function connectionHTML(){
 return `<div class="fs-editor fs-connection-dialog" role="dialog" aria-modal="true" aria-label="Set Connection">
 <div class="fs-editor-title">Set Connection<button data-action="close-connection" aria-label="关闭">×</button></div>
 <div class="fs-connection-content">
 <fieldset class="fs-fieldset"><legend>Connection List</legend>
 <select aria-label="Connection preset" class="fs-full-field"><option>Local 4200A — 当前 Page</option></select>
 </fieldset>
 <fieldset class="fs-fieldset"><legend>Terminal to Resource</legend>
 <table class="fs-connection-table"><thead><tr><th>Terminal</th><th>Resource</th><th>Source</th></tr></thead><tbody>
 ${draft.terminals.map((t,i)=>`<tr><td>${e(t.logical)}</td><td>${select(`terminals[${i}].resource`,emptyOption(),t.resource)} </td><td>${e(t.sourceMode)}</td></tr>`).join('')}
 </tbody></table></fieldset>
 <div class="fs-connection-footer">仅显示经过 4200A 模块识别的资源。修改共享 Connection 预设可能影响其他 Page；本次仅保存当前 Page 的映射。</div>
 </div>
 <footer class="fs-editor-footer"><span class="fs-validation"></span><button data-action="connection-ok" class="fs-primary">OK</button>
 <button data-action="close-connection">Cancel</button></footer></div>`;
}
function render(){if(!draft)return;host.hidden=false;host.innerHTML=activeDialog==='connection'?connectionHTML():pageHTML();window.DKDSComponents?.hydrate?.(host);
 window.DK4200UIControls?.enhance?.(host);
 window.DKTSNumericKeypad?.bindNew?.(host);
 for(const el of host.querySelectorAll?.('[data-bind]')||[]){
  const path=String(el.dataset.bind||'');
  el.dataset.fsProManualPage=activeDialog==='connection'?'21':path.startsWith('strategy.')?'20':path.startsWith('target.')?'19':'18';
 }
 if(activeDialog==='page'){updateStatus();if(!unlocked)host.querySelectorAll?.('[data-bind],[data-range-preset],[data-action="add-segment"],[data-action="remove-segment"],[data-action="add-var"],[data-action="remove-var"],[data-action="add-spec"],[data-action="remove-spec"]').forEach(el=>el.disabled=true);}}
function renderPages(){
 const nav=document.getElementById('fs-page-list');
 if(nav)nav.innerHTML=pages.map(row=>{
  const selected=row.id===activePageId;
  return `<button type="button" class="fs-depth3${selected?' fs-tree-selected':''}"
  role="treeitem" aria-current="${selected?'page':'false'}" data-command="select-page"
  data-page-id="${e(row.id)}" title="${e(row.data.info.testType)} · ${e(row.data.info.name)}">
  Page · ${e(row.data.info.name)}</button>`;
 }).join('');
 const label=document.getElementById('fs-toolbar-page-name');if(label)label.textContent=saved.info.name;
 const status=document.getElementById('fs-page-name');if(status)status.textContent=saved.info.name;
}
function selectPage(id){
 const selected=pages.find(p=>p.id===id);if(!selected)return;
 if(activeDialog)close();
 activePageId=selected.id;saved=clone(selected.data);renderPages();
 note('当前测试：'+saved.info.name+'（'+saved.info.testType+'，未执行测量）');
}
function addTest(type){
 const template=TEST_TYPES.find(row=>row.id===type);
 if(!template)throw Error('不支持的测试类型');
 const page=sample();page.info.name=template.label;page.info.testType=template.testType;page.info.group=template.group;
 if(type==='iv'){
  page.terminals.forEach(t=>{t.role=t.logical==='D'?'X':'CONDITION';
    t.generator=t.logical==='D'?'Linear Step':'Constant';});
  Object.assign(page.terminals[0],{start:'0',stop:'2',step:'0.1'});
 }else if(type==='transfer'){page.info.polarity='NMOS';}
 const id='page-'+(++pageSeq);
 pages.push({id,data:page});
 close();selectPage(id);
}
function openTestPicker(){
 if(activeDialog)close();
 activeDialog='picker';host.hidden=false;
 host.innerHTML=`<div class="fs-editor fs-test-picker" role="dialog" aria-modal="true" aria-label="Add Test">
  <div class="fs-editor-title">新增测试类型<button type="button" data-action="close-picker" aria-label="关闭">×</button></div>
  <div class="fs-test-type-list">${TEST_TYPES.map(t=>`<button type="button" data-action="create-test"
     data-test-type="${t.id}"><strong>${e(t.label)}</strong>
     <span>${e(t.testType)} · ${t.testType==='DC'?'离线参数可配置':'尚未接入原生测量'}</span></button>`).join('')}</div>
  <footer class="fs-editor-footer"><button data-action="close-picker">取消</button></footer>
 </div>`;
}
function startEdit(){original=clone(saved);draft=clone(saved);activeTab='Sweep';activeDialog='page';unlocked=true;connectionOrigin='page';render();}
function close(){activeDialog='';connectionOrigin='';host.hidden=true;host.innerHTML='';draft=null;original=null;}
function setInventory(resourceIDs){
 if(!Array.isArray(resourceIDs)||resourceIDs.some(x=>typeof x!=='string'||!/^(?:SMU|PMU|CVU|VM|VS)\d+(?:\.\d+)?$/i.test(x))) throw Error('Invalid instrument resource inventory');
 inventory.clear();resourceIDs.forEach(x=>inventory.add(x));if(activeDialog==='connection')render();
}
function dispatch(action,target){
 if(action==='close-picker'){close();return;}
 if(action==='create-test'){addTest(target.dataset.testType);return;}
 if(action==='tab'){activeTab=target.dataset.tab;render();return;}
 if(action==='cancel'){close();return;}
 if(action==='ok'){
  const v=validateDraft();if(!v.valid){updateStatus();return;}
  saved=clone(draft);pages.find(p=>p.id===activePageId).data=clone(saved);renderPages();note('Page 已保存（未执行测量）');close();return;
 }
 if(action==='reset'){draft=clone(original);render();return;}
 if(action==='lock'){unlocked=!unlocked;render();return;}
 if(action==='connection'){connectionOrigin='page';activeDialog='connection';render();return;}
 if(action==='close-connection'){if(connectionOrigin==='toolbar'){close();return;}activeDialog='page';render();return;}
 if(action==='connection-ok'){if(connectionOrigin==='toolbar'){saved=clone(draft);pages.find(p=>p.id===activePageId).data=clone(saved);close();note('端口配置已保存（未执行测量）');return;}activeDialog='page';render();return;}
 if(action==='add-var'){draft.pageVars.push({name:'',value:''});render();return;}
 if(action==='remove-var'){draft.pageVars.pop();render();return;}
 if(action==='add-spec'){draft.associateSpecs.push('');render();return;}
 if(action==='remove-spec'){draft.associateSpecs.pop();render();return;}
 if(action==='add-segment'){const t=draft.terminals[Number(target.dataset.i)];t.segments.push({generator:'Linear Step',start:'0',stop:'0',step:'0.1',points:'5',bias:'0',list:''});render();return;}
 if(action==='remove-segment'){const t=draft.terminals[Number(target.dataset.i)],j=Number(target.dataset.j);if(j===-1)t.segments.pop();else t.segments.splice(j,1);render();return;}
}
host.addEventListener('click',event=>{
 const btn=event.target.closest('button[data-action]');if(!btn)return;
 if(!unlocked&&activeDialog==='page'&&!['lock','cancel','tab','close-connection','connection','reset','ok'].includes(btn.dataset.action))return;
 dispatch(btn.dataset.action,btn);
});
function bindControl(el){
 if(!el?.dataset?.bind||!draft||!unlocked)return;
 const path=el.dataset.bind,prev=get(draft,path);
 if(prev===undefined){note('未知参数：'+path);return;}
 set(draft,path,el.value);
 if(path.endsWith('.role')){
  if(el.value==='X'||el.value==='P'){
   const changed=path.match(/terminals\[(\d+)\]/);
   const current=changed?Number(changed[1]):-1;
   draft.terminals.forEach((t,i)=>{if(i!==current&&t.role===el.value)t.role='CONDITION';});
  }
  render();
 } else if(path.endsWith('.sourceMode')){
   // An SMU changing source mode changes its measured unit (A versus V).
   // Reject stale range values without forcing the user to infer the unit.
   const match=/terminals\[(\d+)\]/.exec(path);
   const terminal=match?draft.terminals[Number(match[1])]:null;
   if(terminal)terminal.measureRange={mode:'auto',value:el.value==='current'?'2e0':'1e-6'};
   render();note('源模式已更改，测量量程已重置为自动');
  } else if(path.endsWith('.generator')||path.endsWith('.logical')||path.endsWith('.measureRange.mode')){render();}
 else updateStatus();
}
host.addEventListener('input',event=>{if(event.target.matches('input[data-bind],textarea[data-bind]'))bindControl(event.target);});
host.addEventListener('change',event=>{
 const preset=event.target.closest?.('select[data-range-preset]');
 if(preset&&draft&&unlocked){
   const i=Number(preset.dataset.rangePreset);
   const t=draft.terminals[i];
   if(t&&preset.value){
     t.measureRange=t.measureRange||{mode:'auto',value:'1e-6'};
     if(t.measureRange.mode==='auto')t.measureRange.mode='fixed';
      t.measureRange.value=preset.value;
     const input=host.querySelector(`[data-bind="terminals[${i}].measureRange.value"]`);
     if(input)input.value=preset.value;
     updateStatus();
   }
   return;
 }
 if(event.target.matches('select[data-bind]'))bindControl(event.target);
});
host.addEventListener('keydown',event=>{if(event.key==='Escape'){if(activeDialog==='connection'){if(connectionOrigin==='toolbar')close();else{activeDialog='page';render();}}else close();}});
document.addEventListener('click',event=>{
 const btn=event.target.closest('[data-command]');
 if(!btn||host.contains(btn))return;
 const command=btn.dataset.command;
 if(command==='import-raw'){document.getElementById('fs-raw-input').click();return;}
 if(command==='export-raw'){exportRawCSV();return;}
 if(command==='data-viewer'){showDataViewer();return;}
 if(command==='edit'){startEdit();return;}
 if(command==='connection'){startEdit();connectionOrigin='toolbar';activeDialog='connection';render();return;}
 if(command==='new'){if(activeDialog)close();saved=sample();pages=[{id:'page-1',data:clone(saved)}];activePageId='page-1';pageSeq=1;renderPages();note('新建工程 · 配置未保存');return;}
 if(command==='add-test'){openTestPicker();return;}
 if(command==='select-page'){selectPage(btn.dataset.pageId);return;}
 if(command==='arrange'){note(window.matchMedia('(max-width:650px)').matches?
    '手机竖屏使用图窗标签；宽屏自动恢复 2 × 2 绘图布局':
    '绘图区已使用 2 × 2 布局');return;}
 if(command==='save'){
  const json=JSON.stringify({schema:'dkts.fspro.project.v1',activePageId,pages},null,2),blob=new Blob([json],{type:'application/json'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='4200A-project.json';a.click();URL.revokeObjectURL(url);
  note('已导出包含 '+pages.length+' 个测试页面的工程（不含仪器数据）');return;
 }
 if(command==='open'){document.getElementById('fs-open-input').click();return;}
});
document.getElementById('fs-open-input').addEventListener('change',async event=>{
 const file=event.target.files?.[0];if(!file)return;
 try{
  if(file.size>1024*1024)throw Error('配置文件超出 1 MiB 限制');
  const parsed=JSON.parse(await file.text());
  let incoming;
  if(parsed.schema==='dkts.fspro.project.v1'){
    if(!Array.isArray(parsed.pages)||parsed.pages.length<1||parsed.pages.length>128)
      throw Error('工程测试页面数量无效');
    if(!parsed.pages.every(row=>/^page-[1-9][0-9]*$/.test(row?.id||'')&&
      row.data?.schema==='dkts.fspro.page.v1'&&Array.isArray(row.data?.terminals)))
      throw Error('工程页面数据不完整');
    if(new Set(parsed.pages.map(row=>row.id)).size!==parsed.pages.length)
      throw Error('工程中存在重复页面 ID');
    incoming=parsed.pages.map(row=>({id:row.id,data:clone(row.data)}));
  }else if(parsed.schema==='dkts.fspro.page.v1'){
    incoming=[{id:'page-1',data:clone(parsed)}];
  }else throw Error('不是受支持的 4200A 工程或页面文件');
  const selected=incoming.find(row=>row.id===parsed.activePageId)||incoming[0];
  // Every Page must pass the offline bounds/role validator. A malicious or
  // damaged project must not hide an unsafe plan in an inactive test page.
  const previous=draft;
  try{
   for(const row of incoming){
    if(!row.data.info||!Array.isArray(row.data.terminals)||
       !Array.isArray(row.data.pageVars)||!Array.isArray(row.data.associateSpecs)||
       !row.data.strategy||!row.data.target)
      throw Error('工程页面结构不完整：'+row.id);
    draft=clone(row.data);
    const check=validateDraft();
    if(!check.valid)throw Error(row.id+' 参数校验失败：'+check.errors[0]?.reason);
   }
  }finally{draft=previous;}
  pages=incoming;activePageId=selected.id;saved=clone(selected.data);
  pageSeq=Math.max(...pages.map(row=>Number(row.id.slice(5))));
  if(activeDialog)close();
  renderPages();note('已载入 '+pages.length+' 个测试页面（离线）');
 }catch(err){draft=null;note('导入失败：'+err.message);}finally{event.target.value='';}
});
window.DK4200FSPro=Object.freeze({
 openEdit:startEdit,
 setVerifiedInventory:setInventory,
 getDraft:()=>clone(draft||saved),
 validate:()=>{const tmp=draft;draft=clone(draft||saved);try{return validateDraft();}finally{draft=tmp;}}
});
renderPages();
if(new URLSearchParams(location.search).get('open')==='edit')startEdit();
})();
