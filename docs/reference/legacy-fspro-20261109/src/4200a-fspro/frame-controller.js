/* Adapter for DKDS ScientificPlot. Never generates readings or sends 4200A commands.
 * Supports only imported, structurally validated instrument-origin captures.
 */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.DK4200FrameView=api;
})(typeof globalThis!=='undefined'?globalThis:undefined,function(){
 'use strict';
 const VERSION='1.0.0';
 function create({plotRuntime,rawData,root,download}={}){
  if(!rawData?.validate||!rawData?.traces)throw new TypeError('DK4200RawData module required');
  const host=root&&typeof root.querySelectorAll==='function'?root:null;
  if(!host)throw new TypeError('Frame host element required');
  const area=host.querySelector('.fs-frames');
  if(!area)throw new TypeError('Frame grid absent');
  const plot=plotRuntime?.createScope?.('dkts.4200a.fspro');
  if(!plot?.react)throw new Error('DKDS ScientificPlot Core is not loaded');
  const renderers=[...area.querySelectorAll('.fs-frame')].map(card=>{
   const content=card.querySelector('.fs-empty-plot');
   if(!content)throw new TypeError('FS-Pro Frame missing plot host');
   content.classList.add('fs-plot-slot');
   const hint=document.createElement('span');hint.className='fs-empty-hint';hint.textContent='暂无原始测量数据';content.replaceChildren(hint);
   return {card,content,hint};
  });
  if(renderers.length!==4)throw new TypeError('FS-Pro requires four visual Frames');
  let capture=null,disposed=false,revision=0;
  const ensure=()=>{if(disposed)throw new Error('Frame viewer disposed')};
  const axes=raw=>({x:raw.columns.find(c=>c.id==='voltage')||raw.columns[0],y:raw.columns.find(c=>c.id==='current')||raw.columns[1]});
  // DKDS D3 Core honors tickvals/ticktext. The default d3 fixed decimal
  // formatting can clip nanoamp-scale values at the mobile plot boundary.
  // Only the AXIS labels are formatted; exact raw readings remain unchanged.
  function compactScientificTicks(values){
   let minimum=Infinity,maximum=-Infinity;
   // Read captures can contain 200k+ points; never spread arrays into Math.min.
   for(const datum of values){
    const value=Number(datum);
    if(!Number.isFinite(value))continue;
    if(value<minimum)minimum=value;
    if(value>maximum)maximum=value;
   }
   if(!Number.isFinite(minimum)||!Number.isFinite(maximum))return null;
   const magnitude=Math.max(Math.abs(minimum),Math.abs(maximum));
   if(magnitude===0||(magnitude>=0.0001&&magnitude<10000))return null;
   const spread=maximum-minimum;
   const exp=Math.floor(Math.log10(spread>0?spread:magnitude));
   const power=Math.pow(10,exp);
   const desired=spread>0?spread/4:magnitude/4;
   const coefficient=desired/power;
   const step=(coefficient<=1?1:coefficient<=2?2:coefficient<=5?5:10)*power;
   if(!Number.isFinite(step)||step<=0)return null;
   const start=Math.floor(minimum/step),end=Math.ceil(maximum/step);
   if(end-start>12)return null;
   const tickvals=[],ticktext=[];
   for(let i=start;i<=end;i++){
    const value=Number((i*step).toPrecision(12));
    tickvals.push(value);
    ticktext.push(value===0?'0':value.toExponential(1).replace(/\\.0e/,'e'));
   }
   return {tickvals,ticktext};
  }
  const plotLayout=(x,y,traces=[])=>{
   const allX=traces.flatMap(t=>Array.isArray(t.x)?t.x:[]);
   const allY=traces.flatMap(t=>Array.isArray(t.y)?t.y:[]);
   const xTicks=compactScientificTicks(allX),yTicks=compactScientificTicks(allY);
   return {
    autosize:true,margin:{t:14,r:18,b:52,l:65},
    xaxis:{title:`${x.label}${x.unit?` (${x.unit})`:''}`,automargin:true,...(xTicks||{})},
    yaxis:{title:`${y.label}${y.unit?` (${y.unit})`:''}`,automargin:true,...(yTicks||{})},
    showlegend:true,legend:{orientation:'h',y:-0.22},dragmode:'pan'
   };
  };
  function renderDataFrame(container,table){
   const existing=container.querySelector('.fs-empty-hint');if(existing)existing.hidden=true;
   const sheet=document.createElement('div');sheet.className='fs-mini-table-wrap';
   const grid=document.createElement('table');grid.className='fs-mini-table';
   const head=document.createElement('thead'),headRow=document.createElement('tr');
   for(const c of table.columns){const th=document.createElement('th');th.textContent=c.unit?`${c.label} (${c.unit})`:c.label;headRow.appendChild(th);}
   head.appendChild(headRow);grid.appendChild(head);
   const body=document.createElement('tbody');
   for(const row of table.rows.slice(0,80)){
    const tr=document.createElement('tr');
    for(const c of table.columns){const td=document.createElement('td');td.textContent=row.values[c.id]??'';tr.appendChild(td);}
    body.appendChild(tr);
   }
   grid.appendChild(body);sheet.appendChild(grid);
   const foot=document.createElement('div');foot.className='fs-mini-table-note';foot.textContent=`显示前 ${Math.min(80,table.rows.length)} / ${table.rows.length} 点`;
   container.replaceChildren(sheet,foot);
  }
  // A new imported capture can omit channels present in the previous one.
  // Clear the old plot as well as restoring its hint; the original hint node
  // may have been removed by ScientificPlot when it rendered the SVG.
  function emptyFrame(index,message){
   const {content,hint}=renderers[index];
   hint.textContent=message;hint.hidden=false;
   content.replaceChildren(hint);
   content.setAttribute('aria-label',message);
  }
  // Hidden mobile Frames may have zero layout width. Re-render from the
  // *same original imported capture* once a Frame becomes visible.
  async function refreshFrame(index){
   ensure();
   if(!capture||!Number.isInteger(index)||index<0||index>3)return false;
   if(index===3)return true; // Frame 4 is always the native raw table.
   const original=capture.raw;
   const validPlotAxes=axes(original);
   const pair=index===0?[validPlotAxes.x,validPlotAxes.y]:
    index===1?(original.columns.some(c=>c.id==='gate_voltage')?
     [original.columns.find(c=>c.id==='gate_voltage'),validPlotAxes.y]:null):
     original.columns.some(c=>c.id==='time')?
      [original.columns.find(c=>c.id==='time'),validPlotAxes.y]:null;
   const {content,hint}=renderers[index];
   if(!pair){
    emptyFrame(index,'当前采样没有此图所需的通道');
    return false;
   }
   const [x,y]=pair,traces=rawData.traces(original,{x:x.id,y:y.id});
   if(!traces.some(t=>t.x.length)){
    emptyFrame(index,'原始数据没有有效采样点');
    return false;
   }
   hint.hidden=true;
   await plot.react(content,traces,plotLayout(x,y,traces),{
    responsive:true,scrollZoom:true,displayModeBar:false
   },{
    source:'dkts.4200a.native',renderKey:`${original.captureId}:${index}:visible`,
    renderPriority:'immediate'
   });
   return true;
  }
  async function setCapture(raw,{provenance='imported-file'}={}){
   ensure();
   if(provenance!=='imported-file'&&provenance!=='native-verified')throw new Error('Unapproved raw-data provenance');
   const check=rawData.validate(raw);
   if(!check.valid)throw new TypeError('Invalid 4200A capture: '+check.errors.map(x=>x.code).join(','));
   const ticket=++revision;
   const original=JSON.parse(JSON.stringify(raw));
   const validPlotAxes=axes(original);
   const specs=[
    [validPlotAxes.x,validPlotAxes.y],
    original.columns.some(c=>c.id==='gate_voltage')?[original.columns.find(c=>c.id==='gate_voltage'),validPlotAxes.y]:null,
    original.columns.some(c=>c.id==='time')?[original.columns.find(c=>c.id==='time'),validPlotAxes.y]:null,
    null
   ];
   for(let i=0;i<renderers.length;i++){
    if(ticket!==revision||disposed)return false;
    if(i<3&&typeof window!=='undefined'&&
       window.matchMedia?.('(max-width:650px)').matches&&
       renderers[i].card.dataset.mobileActive==='false')continue;
    const {content,hint}=renderers[i],pair=specs[i];
    if(!pair){emptyFrame(i,i===3?'原始数据表':'当前采样没有此图所需的通道');continue;}
    const [x,y]=pair,traces=rawData.traces(original,{x:x.id,y:y.id});
    if(!traces.some(t=>t.x.length)){emptyFrame(i,'原始数据没有有效采样点');continue;}
    hint.hidden=true;
    await plot.react(content,traces,plotLayout(x,y,traces),{responsive:true,scrollZoom:true,displayModeBar:false},{
     source:'dkts.4200a.native',renderKey:`${original.captureId}:${i}`,
     renderPriority:'immediate'
    });
   }
   if(ticket!==revision||disposed)return false;
   renderDataFrame(renderers[3].content,rawData.toTable(original));
   capture=Object.freeze({raw:original,provenance,table:rawData.toTable(original)});
   const msg=host.querySelector('#fs-messages');
   if(msg)msg.textContent=`原始数据：${original.captureId} · ${original.samples.length} 点 · 来源：${provenance==='native-verified'?'仪器采集':'导入文件'}`;
   return true;
  }
  function exportCSV(){
   ensure();
   if(!capture)throw new Error('No raw instrument data to export');
   const csv=rawData.toCSV(capture.raw);
   if(typeof download==='function')return download(`${capture.raw.captureId}.csv`,csv,'text/csv');
   return csv;
  }
  function rawJSON(){
   ensure();
   if(!capture)throw new Error('No native raw capture available for export');
   // Preserve all original DO reply frames (base64) and exact numeric text.
   // Do not reconstruct instrument-generated data from plotted coordinates.
   return JSON.stringify(capture.raw,null,2);
  }
  function table(){
   ensure();return capture?capture.table:null;
  }
  function hasCapture(){return !disposed&&capture!==null}
  function provenance(){return capture?.provenance||null}
  function dispose(){
   if(disposed)return false;
   disposed=true;revision++;capture=null;
   try{plot.dispose?.()}catch{}
   return true;
  }
  return Object.freeze({VERSION,setCapture,refreshFrame,exportCSV,rawJSON,table,hasCapture,provenance,dispose});
 }
 return Object.freeze({VERSION,create});
});
