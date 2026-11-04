(() => {
  if (window.DKDSD3Renderer) return;

  const VERSION='1.2.0';
  const StyleGate=globalThis.DKDSStyleGate;
  const Display=globalThis.DKDSScientificDisplay;
  const HeatmapCanvas=globalThis.DKDSScientificHeatmapCanvas;
  const HeatmapSelection=globalThis.DKDSScientificHeatmapSelection;
  if(!StyleGate)throw new Error('DKDSStyleGate must initialize before D3 chart renderer.');
  if(!Display)throw new Error('DKDSScientificDisplay must initialize before D3 chart renderer.');
  if(!HeatmapCanvas)throw new Error('DKDSScientificHeatmapCanvas must initialize before D3 chart renderer.');
  if(!HeatmapSelection)throw new Error('DKDSScientificHeatmapSelection must initialize before D3 chart renderer.');
  const STYLE_OWNER='core.d3-chart-renderer';
  const STYLE_SOURCE='src/core/scientific/d3-chart-renderer.js';
  const d3StyleSet=(el,prop,value,component='scientific-d3-runtime')=>StyleGate.set(el,prop,value,{owner:STYLE_OWNER,component,kind:'runtime-inline',source:STYLE_SOURCE});
  function selectionStyle(selection,property,value,component='scientific-d3-runtime'){
    selection?.each?.(function(d,i,nodes){const next=typeof value==='function'?value.call(this,d,i,nodes):value;if(next===null||next===undefined||next==='')StyleGate.remove(this,property,{owner:STYLE_OWNER,component,kind:'runtime-inline',source:STYLE_SOURCE});else d3StyleSet(this,property,next,component);});return selection;
  }
  function selectionPaint(selection,attribute,value,component='scientific-d3-paint'){
    selection?.each?.(function(d,i,nodes){const next=typeof value==='function'?value.call(this,d,i,nodes):value;if(next===null||next===undefined||next==='')StyleGate.removePaint(this,attribute,{owner:STYLE_OWNER,component,scope:'scientific-render',source:STYLE_SOURCE});else StyleGate.setPaint(this,attribute,next,{owner:STYLE_OWNER,component,scope:'scientific-render',source:STYLE_SOURCE});});return selection;
  }
  const states=new WeakMap();
  const DEFAULT_COLORS=Object.freeze(['#2563eb','#0f9f9a','#dc2626','#f97316','#6d28d9','#db2777','#16a34a','#ca8a04','#0891b2','#7c3aed']);
  const defaultColors=()=>{const themed=window.DKDSTheme?.scientific?.()?.seriesPalette;return Array.isArray(themed)&&themed.length>=2?themed:DEFAULT_COLORS;};
  const SUPPORTED_TYPES=Object.freeze(new Set(['scatter','scattergl','heatmap']));
  const clone=value=>{if(value===undefined)return undefined;try{return structuredClone(value);}catch{try{return JSON.parse(JSON.stringify(value));}catch{return value;}}};
  const finite=value=>value!==null&&value!==undefined&&!(typeof value==='string'&&!value.trim())&&Number.isFinite(Number(value));
  const traceType=t=>String(t?.type||'scatter').toLowerCase();
  const visible=t=>t?.visible!==false&&t?.visible!=='legendonly';
  const element=value=>value?.nodeType===1?value:(typeof value==='string'?document.getElementById(value)||document.querySelector(value):null);
  const supports=(data=[])=>Array.isArray(data)&&data.every(trace=>SUPPORTED_TYPES.has(traceType(trace)));
  const themeName=()=>String(window.DKDSTheme?.current?.()||document.documentElement?.dataset?.dkdsTheme||'').toLowerCase()||(globalThis.matchMedia?.('(prefers-color-scheme: dark)')?.matches?'dark':'light');
  const theme=()=>themeName()==='dark'
    ?{paper:'#1d232e',plot:'#1d232e',grid:'#303a49',zero:'#414d5f',axis:'#5a687c',text:'#d8e0eb',muted:'#9aa7b9',tooltip:'rgba(20,26,35,.94)',tooltipBorder:'rgba(255,255,255,.16)'}
    :{paper:'#ffffff',plot:'#ffffff',grid:'#e8edf4',zero:'#d3dbe6',axis:'#adb8c7',text:'#46546a',muted:'#6f7d91',tooltip:'rgba(31,41,55,.94)',tooltipBorder:'rgba(255,255,255,.22)'};

  function ensureEmitter(el){
    if(el.__dkdsChartEmitter)return el.__dkdsChartEmitter;
    const handlers=new Map();
    const emitter={
      on(name,handler){const key=String(name||'');if(!handlers.has(key))handlers.set(key,new Set());handlers.get(key).add(handler);return el;},
      removeListener(name,handler){handlers.get(String(name||''))?.delete(handler);return el;},
      removeAllListeners(name){if(name===undefined)handlers.clear();else handlers.delete(String(name||''));return el;},
      emit(name,payload){for(const handler of [...(handlers.get(String(name||''))||[])])try{handler(payload);}catch(err){console.warn('[DKDS D3 renderer event]',err);}return el;},
      clear(){handlers.clear();}
    };
    if(typeof el.on!=='function')el.on=(name,handler)=>emitter.on(name,handler);
    if(typeof el.removeListener!=='function')el.removeListener=(name,handler)=>emitter.removeListener(name,handler);
    if(typeof el.removeAllListeners!=='function')el.removeAllListeners=name=>emitter.removeAllListeners(name);
    Object.defineProperty(el,'__dkdsChartEmitter',{value:emitter,configurable:true});
    return emitter;
  }

  function getState(target){const el=element(target)||target;return el?states.get(el)||null:null;}
  function stateSnapshot(target){const s=getState(target);return s?Object.freeze({renderer:'d3',width:s.width,height:s.height,revision:s.revision,traceCount:s.data.length,kind:s.kind,dataRevision:s.dataRevision||0,geometryRevision:s.geometryRevision||0,paintRevision:s.paintRevision||0,selectionRevision:s.selectionRevision||0,invalidations:Object.freeze({...s.invalidations}),display:Object.freeze({...s.displayStats}),nodes:Object.freeze({...s.nodeStats}),raster:HeatmapCanvas.snapshot(s.el)}):null;}
  function nestedPatch(target,path,value){const parts=String(path||'').split('.').filter(Boolean);if(!parts.length)return;let node=target;for(let i=0;i<parts.length-1;i++){const key=parts[i];if(!node[key]||typeof node[key]!=='object')node[key]={};node=node[key];}node[parts.at(-1)]=value;}
  function restyleValue(value,index,count){if(Array.isArray(value)&&count>1)return value[index];if(Array.isArray(value)&&count===1&&value.length===1&&Array.isArray(value[0]))return value[0];return value;}
  function applyRestyle(data,update={},indices=[]){const ids=(Array.isArray(indices)?indices:[indices]).map(Number).filter(Number.isInteger),count=ids.length;for(let j=0;j<count;j++){const trace=data[ids[j]];if(!trace)continue;for(const [key,raw] of Object.entries(update||{}))nestedPatch(trace,key,restyleValue(raw,j,count));}return data;}
  function applyRelayout(layout,patch={}){for(const [key,value] of Object.entries(patch||{}))nestedPatch(layout,key,value);return layout;}
  function titleText(value){return typeof value==='string'?value:String(value?.text||'');}
  function scalar(value,index,fallback){if(Array.isArray(value))return value[Math.min(index,value.length-1)]??fallback;return value??fallback;}
  function traceColor(trace,index){return String(trace?.line?.color||(!Array.isArray(trace?.marker?.color)&&trace?.marker?.color)||defaultColors()[Number(index||0)%defaultColors().length]);}
  function overlayPatchValue(update,key,traceOffset,traceCount){return restyleValue(update?.[key],traceOffset,traceCount);}
  function dashArray(value){const key=String(value||'solid').toLowerCase();return key==='dash'?'7 4':key==='dot'?'2 3':key==='dashdot'?'7 3 2 3':key==='longdash'?'11 5':key==='longdashdot'?'11 4 2 4':'';}
  function symbolType(d3,name){const key=String(name||'circle').toLowerCase().replace('-open','');return ({circle:d3.symbolCircle,diamond:d3.symbolDiamond,triangle:d3.symbolTriangle,square:d3.symbolSquare,cross:d3.symbolCross,star:d3.symbolStar,'triangle-down':d3.symbolTriangle})[key]||d3.symbolCircle;}
  function formatValue(value){const n=Number(value);if(!Number.isFinite(n))return String(value??'');const a=Math.abs(n);if(a&&(a>=1e4||a<1e-3))return n.toExponential(3);return String(Number(n.toPrecision(6)));}
  function safeExtent(_d3,values,fallback=[0,1]){if(values?.__dkdsAxisSummary){const extent=values.extent||[];if(extent.length<2)return fallback.slice();let lo=Number(extent[0]),hi=Number(extent[1]);if(lo===hi){const pad=Math.abs(lo||1)*.05||1;lo-=pad;hi+=pad;}return[lo,hi];}const rows=values.filter(finite).map(Number);if(!rows.length)return fallback.slice();let lo=Infinity,hi=-Infinity;for(const value of rows){if(value<lo)lo=value;if(value>hi)hi=value;}if(lo===hi){const pad=Math.abs(lo||1)*.05||1;lo-=pad;hi+=pad;}return [lo,hi];}
  function categoryValues(values=[]){return [...new Set(values.map(value=>String(value)))];}
  function axisDomainPixels(axis={},top,height){const domain=Array.isArray(axis?.domain)&&axis.domain.length>=2&&axis.domain.every(finite)?axis.domain.map(Number):[0,1];const lo=Math.max(0,Math.min(1,domain[0])),hi=Math.max(0,Math.min(1,domain[1]));return [top+(1-lo)*height,top+(1-hi)*height];}
  function autoPadFraction(axis={}){const raw=Number(axis?.autorangepadding);return Number.isFinite(raw)?Math.max(0,Math.min(.25,raw)):.045;}
  function paddedLinearDomain(domain,axis={}){
    let [lo,hi]=domain.map(Number);if(!Number.isFinite(lo)||!Number.isFinite(hi))return [0,1];if(lo===hi){const pad=Math.abs(lo||1)*.05||1;return [lo-pad,hi+pad];}
    const span=hi-lo,pad=span*autoPadFraction(axis),mode=String(axis?.rangemode||'normal').toLowerCase();
    lo-=pad;hi+=pad;if(mode==='tozero'){if(domain[0]>=0)lo=0;if(domain[1]<=0)hi=0;}else if(mode==='nonnegative')lo=Math.max(0,lo);return [lo,hi];
  }
  function scaleForAxis(d3,axis={},values=[],range=[0,1]){
    const type=String(axis?.type||'linear').toLowerCase(),manual=Array.isArray(axis?.range)&&axis.range.length>=2&&axis.range.every(finite);
    if(type==='category')return d3.scalePoint().domain(categoryValues(values)).range(range).padding(.25);
    if(type==='log'){
      const positives=values?.__dkdsAxisSummary?{__dkdsAxisSummary:true,extent:values.positiveExtent||[]}:values.filter(finite).map(value=>Math.abs(Number(value))).filter(value=>value>0);
      let domain=manual?axis.range.map(value=>Math.pow(10,Number(value))):safeExtent(d3,positives,[1e-3,1]);
      domain=domain.map(value=>Math.max(Number.MIN_VALUE,Math.abs(Number(value))));
      if(!manual&&domain[0]!==domain[1]){const logs=domain.map(Math.log10),span=logs[1]-logs[0],pad=span*autoPadFraction(axis);domain=[Math.pow(10,logs[0]-pad),Math.pow(10,logs[1]+pad)];}
      const scale=d3.scaleLog().domain(domain).range(range);return manual?scale:scale.nice();
    }
    const domain=manual?axis.range.map(Number):paddedLinearDomain(safeExtent(d3,values,[0,1]),axis);
    const scale=d3.scaleLinear().domain(domain).range(range);return manual?scale:scale.nice();
  }
  function scaleForHeatmapAxis(d3,axis={},values=[],range=[0,1]){
    const type=String(axis?.type||'linear').toLowerCase(),manual=Array.isArray(axis?.range)&&axis.range.length>=2&&axis.range.every(finite);
    if(type==='category'||!values.every(finite))return d3.scaleBand().domain(values.map(String)).range(range).padding(0);
    const edges=numericEdges(values),domain=manual?axis.range.map(Number):(edges.length>=2?[edges[0],edges.at(-1)]:safeExtent(d3,values,[0,1]));
    return d3.scaleLinear().domain(domain).range(range);
  }
  function normalizedColorDomain(d3,values,zminValue,zmaxValue){
    const extent=safeExtent(d3,values,[0,1]);let lo=finite(zminValue)?Number(zminValue):extent[0],hi=finite(zmaxValue)?Number(zmaxValue):extent[1];
    if(!Number.isFinite(lo)||!Number.isFinite(hi)){lo=extent[0];hi=extent[1];}
    if(lo>hi)[lo,hi]=[hi,lo];if(lo===hi){const fallback=safeExtent(d3,values,[lo-1,hi+1]);lo=fallback[0];hi=fallback[1];if(lo===hi){const pad=Math.abs(lo||1)*.05||1;lo-=pad;hi+=pad;}}
    return [lo,hi];
  }
  function axisValue(scale,value){
    if(!scale)return NaN;
    const domain=scale.domain?.()||[];
    const categorical=typeof scale.bandwidth==='function'||typeof scale.step==='function'&&domain.some(item=>!finite(item));
    return categorical?scale(String(value)):scale(Number(value));
  }
  function scaleRangeForFullLayout(scale,axis={}){const domain=scale?.domain?.()?.slice?.()||[];return String(axis?.type||'linear').toLowerCase()==='log'?domain.map(value=>Math.log10(Math.max(Number.MIN_VALUE,Math.abs(Number(value))))):domain;}
  function zoomRange(scale,axis,pixel,factor){const r=scaleRangeForFullLayout(scale,axis),a=Number(r[0]),b=Number(r[1]),raw=scale?.invert?.(pixel);let c=Number(raw);if(String(axis?.type||'linear').toLowerCase()==='log')c=Math.log10(Math.abs(c)||Number.MIN_VALUE);return [a,b,c].every(Number.isFinite)?[c+(a-c)*factor,c+(b-c)*factor]:null;}
  function installWheelZoom(state,{x,y,y2}){if(state.config?.scrollZoom===false)return;const svg=state.svg,m=state.margin;svg.on('wheel.dkds-zoom',event=>{const e=event?.sourceEvent||event;if(e?.ctrlKey||e?.metaKey)return;const [px,py]=window.d3.pointer(e,state.el);if(px<m.l||px>m.l+state.innerW||py<m.t||py>m.t+state.innerH)return;e.preventDefault?.();e.stopPropagation?.();const factor=(Number(e?.deltaY)||0)>0?1.18:.84,patch={};for(const [key,scale,axis,pixel] of [['xaxis',x,state.layout?.xaxis,px],['yaxis',y,state.layout?.yaxis,py],['yaxis2',y2,state.layout?.yaxis2,py]]){if(!scale)continue;const r=zoomRange(scale,axis,pixel,factor);if(!r)continue;patch[`${key}.range`]=r;patch[`${key}.autorange`]=false;}if(Object.keys(patch).length)void relayout(state.el,patch);},{passive:false});}
  function linearTickValues(domain=[],stepValue){const step=Math.abs(Number(stepValue));if(!Number.isFinite(step)||step<=0||domain.length<2)return null;let lo=Math.min(Number(domain[0]),Number(domain[1])),hi=Math.max(Number(domain[0]),Number(domain[1]));if(!Number.isFinite(lo)||!Number.isFinite(hi))return null;const eps=step*1e-9,start=Math.ceil((lo-eps)/step)*step,out=[];for(let value=start;value<=hi+eps&&out.length<240;value+=step)out.push(Number(value.toPrecision(14)));return out;}
  function configuredAxis(d3,side,scale,axis={},count=5){const factory=side==='left'?d3.axisLeft:side==='right'?d3.axisRight:side==='top'?d3.axisTop:d3.axisBottom,generator=factory(scale),explicit=Array.isArray(axis?.tickvals)&&axis.tickvals.length?axis.tickvals:null,linear=String(axis?.type||'linear').toLowerCase()!=='log'?linearTickValues(scale?.domain?.()||[],axis?.dtick):null;
    if(explicit)generator.tickValues(explicit);else if(linear?.length)generator.tickValues(linear);else generator.ticks?.(count);
    if(explicit&&Array.isArray(axis?.ticktext)&&axis.ticktext.length)generator.tickFormat((value,index)=>axis.ticktext[index]??formatValue(value));return generator;}

  function prepareHost(el){el.classList.add('dkds-d3-chart-host','dkds-scientific-chart-host');if(!el.style.position)d3StyleSet(el,'position','relative','scientific-chart-host');return el;}
  function clearRendererNodes(el){for(const node of [...el.querySelectorAll(':scope > .dkds-d3-chart-svg,:scope > .dkds-d3-chart-tooltip')])node.remove();}
  function resolveGeometry(state){const rect=state.el.getBoundingClientRect?.()||{},layout=state.layout||{},width=Math.max(120,Math.round(Number(layout.width)||Number(rect.width)||state.el.clientWidth||640)),height=Math.max(100,Math.round(Number(layout.height)||Number(rect.height)||state.el.clientHeight||360)),margin={l:56,r:18,t:18,b:46,...(layout.margin||{})};Object.assign(state,{width,height,margin,innerW:Math.max(24,width-margin.l-margin.r),innerH:Math.max(24,height-margin.t-margin.b)});return state;}
  function newSvg(state){const d3=window.d3;let svg=d3.select(state.el).select(':scope > svg.dkds-d3-chart-svg');if(svg.empty())svg=d3.select(state.el).append('svg').attr('class','dkds-d3-chart-svg');svg.selectAll('*').remove();svg.attr('width',state.width).attr('height',state.height).attr('role','img');selectionStyle(svg,'width',`${state.width}px`,'scientific-chart-svg');selectionStyle(svg,'height',`${state.height}px`,'scientific-chart-svg');state.svg=svg;return svg;}
  function tooltipHost(state){let node=state.el.querySelector(':scope > .dkds-d3-chart-tooltip');if(node)return node;node=document.createElement('div');node.className='dkds-d3-chart-tooltip';node.hidden=true;state.el.appendChild(node);return node;}
  function hideTooltip(state){const host=state?.el?.querySelector?.(':scope > .dkds-d3-chart-tooltip');if(host)host.hidden=true;}
  function templateValue(trace,pointIndex,token){if(token==='x')return trace?.x?.[pointIndex];if(token==='y')return trace?.y?.[pointIndex];if(token==='z')return trace?.z;const custom=token.match(/^customdata\[(\d+)\]$/);if(custom){const row=trace?.customdata?.[pointIndex];return Array.isArray(row)?row[Number(custom[1])]:undefined;}if(token==='text')return Array.isArray(trace?.text)?trace.text[pointIndex]:trace?.text;return undefined;}
  function formatHoverTemplate(trace,pointIndex){let text=String(trace?.hovertemplate||'').replace(/<extra>[\s\S]*?<\/extra>/g,'');if(!text)return '';text=text.replace(/%\{([^}:]+(?:\[\d+\])?)(?::[^}]+)?\}/g,(_all,token)=>formatValue(templateValue(trace,pointIndex,token)));return text.replace(/<br\s*\/?>/gi,'\n').replace(/<[^>]+>/g,'').trim();}
  function showTooltip(state,event,trace,index,pointIndex){const host=tooltipHost(state),rect=state.el.getBoundingClientRect(),templated=formatHoverTemplate(trace,pointIndex),hoverText=String(trace?.hoverinfo||'')==='text'?(Array.isArray(trace?.text)?trace.text[pointIndex]:trace?.text):'';host.hidden=false;host.replaceChildren();const title=document.createElement('b');title.textContent=String(trace?.name||`Series ${index+1}`);host.appendChild(title);const body=document.createElement('div');d3StyleSet(body,'white-space','pre-line','scientific-tooltip-body');body.textContent=hoverText||templated||`x = ${formatValue(trace?.x?.[pointIndex])}   y = ${formatValue(trace?.y?.[pointIndex])}`;host.appendChild(body);d3StyleSet(host,'left',`${Math.max(6,Math.min(state.width-230,event.clientX-rect.left+12))}px`,'scientific-tooltip');d3StyleSet(host,'top',`${Math.max(6,Math.min(state.height-68,event.clientY-rect.top+12))}px`,'scientific-tooltip');}
  function pointPayload(state,traceIndex,pointIndex,event){const trace=state.data[traceIndex]||{};return {curveNumber:traceIndex,pointNumber:pointIndex,x:trace?.x?.[pointIndex],y:trace?.y?.[pointIndex],z:undefined,customdata:Array.isArray(trace?.customdata)?trace.customdata[pointIndex]:trace?.customdata,data:trace,fullData:trace,event};}
  function emitChartEvent(state,name,payload){
    const eventName=`dkds_chart_${name}`;
    state.emitter.emit(eventName,payload);
    try{state.el.dispatchEvent?.(new CustomEvent(eventName,{detail:payload}));}catch{}
    return payload;
  }
  function emitPoint(state,name,traceIndex,pointIndex,event){const payload={points:[pointPayload(state,traceIndex,pointIndex,event)],event};return emitChartEvent(state,name,payload);}

  function drawAxisStyle(group,t){group.selectAll('path,line').call(selectionPaint,'stroke',t.axis);const labels=group.selectAll('text').call(selectionPaint,'fill',t.muted);selectionStyle(labels,'font-family','Segoe UI Variable Text, Microsoft YaHei UI, Segoe UI, sans-serif','scientific-axis-label');selectionStyle(labels,'font-size','11px','scientific-axis-label');}
  function drawAxes(state,scales){
    const d3=window.d3,svg=state.svg,t=theme(),{x,y,y2}=scales,m=state.margin,w=state.innerW,h=state.innerH,xAxisY=scales.xAxisY??m.t+h;
    const xAxis=state.layout?.xaxis||{},yAxis=state.layout?.yaxis||{},y2Axis=state.layout?.yaxis2||{};
    if(yAxis.visible!==false){const range=y.range(),count=Math.max(3,Math.floor(Math.abs(range[0]-range[1])/52));if(yAxis.showgrid!==false){const gridAxis=configuredAxis(d3,'left',y,yAxis,count).tickSize(-w).tickFormat(''),grid=svg.append('g').attr('class','dkds-d3-grid dkds-d3-y-grid').attr('transform',`translate(${m.l},0)`).call(gridAxis);grid.select('.domain').remove();grid.selectAll('line').call(selectionPaint,'stroke',t.grid);}const gy=svg.append('g').attr('class','dkds-d3-axis dkds-d3-y-axis').attr('transform',`translate(${m.l},0)`).call(configuredAxis(d3,'left',y,yAxis,count));drawAxisStyle(gy,t);}
    if(xAxis.visible!==false){const gx=svg.append('g').attr('class','dkds-d3-axis dkds-d3-x-axis').attr('transform',`translate(0,${xAxisY})`).call(configuredAxis(d3,'bottom',x,xAxis,Math.max(3,Math.floor(w/90))));drawAxisStyle(gx,t);}
    if(y2&&y2Axis.visible!==false){const g2=svg.append('g').attr('class','dkds-d3-axis dkds-d3-y2-axis').attr('transform',`translate(${m.l+w},0)`).call(configuredAxis(d3,'right',y2,y2Axis,Math.max(3,Math.floor(Math.abs(y2.range()[0]-y2.range()[1])/52))));drawAxisStyle(g2,t);}
    const xTitle=titleText(xAxis.title),yTitle=titleText(yAxis.title),y2Title=titleText(y2Axis.title);
    if(xTitle&&xAxis.visible!==false)svg.append('text').attr('class','dkds-d3-axis-title').attr('x',m.l+w/2).attr('y',Math.min(state.height-7,xAxisY+34)).attr('text-anchor','middle').call(selectionPaint,'fill',t.text).text(xTitle);
    if(yTitle&&yAxis.visible!==false){const yr=y.range(),cy=(yr[0]+yr[1])/2;svg.append('text').attr('class','dkds-d3-axis-title').attr('transform',`translate(16,${cy}) rotate(-90)`).attr('text-anchor','middle').call(selectionPaint,'fill',t.text).text(yTitle);}
    if(y2&&y2Title&&y2Axis.visible!==false){const yr=y2.range(),cy=(yr[0]+yr[1])/2;svg.append('text').attr('class','dkds-d3-axis-title').attr('transform',`translate(${state.width-9},${cy}) rotate(90)`).attr('text-anchor','middle').call(selectionPaint,'fill',t.text).text(y2Title);}
  }
  function updateFullLayout(state,scales){const m=state.margin;state.el._fullLayout={_size:{l:m.l,r:m.r,t:m.t,b:m.b,w:state.innerW,h:state.innerH},xaxis:{range:scaleRangeForFullLayout(scales.x,state.layout?.xaxis)}};if(scales.y)state.el._fullLayout.yaxis={range:scaleRangeForFullLayout(scales.y,state.layout?.yaxis)};if(scales.y2)state.el._fullLayout.yaxis2={range:scaleRangeForFullLayout(scales.y2,state.layout?.yaxis2)};}
  function scaleForRef(scales,ref='y'){return String(ref||'y')==='y2'&&scales.y2?scales.y2:scales.y;}
  function paperY(state,value){return state.margin.t+(1-Number(value))*state.innerH;}
  function paperX(state,value){return state.margin.l+Number(value)*state.innerW;}
  function drawShapes(state,scales){const svg=state.svg,rows=Array.isArray(state.layout?.shapes)?state.layout.shapes:[];for(const shape of rows){if(!shape||shape.visible===false)continue;const type=String(shape.type||'line'),xRef=String(shape.xref||'x'),yRef=String(shape.yref||'y'),x0=xRef==='paper'?paperX(state,shape.x0):axisValue(scales.x,shape.x0),x1=xRef==='paper'?paperX(state,shape.x1):axisValue(scales.x,shape.x1),ys=scaleForRef(scales,yRef),y0=yRef==='paper'?paperY(state,shape.y0):ys?.(Number(shape.y0)),y1=yRef==='paper'?paperY(state,shape.y1):ys?.(Number(shape.y1));if(![x0,x1,y0,y1].every(v=>Number.isFinite(Number(v))))continue;const line=shape.line||{},color=String(line.color||'#dc2626'),width=Number(line.width)||1,dash=dashArray(line.dash);if(type==='rect'){svg.append('rect').attr('class','dkds-d3-shape').attr('x',Math.min(x0,x1)).attr('y',Math.min(y0,y1)).attr('width',Math.abs(x1-x0)).attr('height',Math.abs(y1-y0)).call(selectionPaint,'fill',shape.fillcolor||'none').call(selectionPaint,'fill-opacity',Number.isFinite(Number(shape.opacity))?Number(shape.opacity):1).call(selectionPaint,'stroke',color).call(selectionPaint,'stroke-width',width).call(selectionPaint,'stroke-dasharray',dash);}else{svg.append('line').attr('class','dkds-d3-shape').attr('x1',x0).attr('x2',x1).attr('y1',y0).attr('y2',y1).call(selectionPaint,'stroke',color).call(selectionPaint,'stroke-width',width).call(selectionPaint,'stroke-dasharray',dash);}}}
  function drawAnnotations(state,scales){const svg=state.svg,t=theme(),rows=Array.isArray(state.layout?.annotations)?state.layout.annotations:[];for(const [annotationIndex,row] of rows.entries()){if(!row||row.visible===false)continue;const xRef=String(row.xref||'x'),yRef=String(row.yref||'y'),ys=scaleForRef(scales,yRef),x=xRef==='paper'?paperX(state,row.x):axisValue(scales.x,row.x),y=yRef==='paper'?paperY(state,row.y):ys?.(Number(row.y));if(!Number.isFinite(Number(x))||!Number.isFinite(Number(y)))continue;const annotation=svg.append('text').attr('class','dkds-d3-annotation').attr('data-annotation-index',annotationIndex).attr('x',x).attr('y',y).attr('text-anchor',row.xanchor==='left'?'start':row.xanchor==='right'?'end':'middle').attr('dominant-baseline','middle').call(selectionPaint,'fill',row?.font?.color||t.muted).text(String(row.text||'').replace(/<[^>]+>/g,''));selectionStyle(annotation,'font-size',`${Number(row?.font?.size)||12}px`,'scientific-annotation');}}

  function reusableTraceGroups(state){
    const rows=new Map();if(!state?.svg)return rows;
    state.svg.selectAll('.dkds-d3-data-layer > .dkds-d3-trace-group').each(function(){const key=String(this.getAttribute('data-series-id')||'');if(key&&!rows.has(key))rows.set(key,this);});return rows;
  }
  function stableSeriesRows(active){const seen=new Map();return active.map(row=>{const base=Display.seriesKey(row.trace,row.index),count=seen.get(base)||0;seen.set(base,count+1);return {...row,seriesKey:count?`${base}::${count}`:base};});}
  function nearestDisplayPointPixel(points,scaleX,scaleY,px,py){let best=-1,bestDistance=Infinity;for(const point of points||[]){if(!point?.valid)continue;const sx=axisValue(scaleX,point.x),sy=scaleY(Number(point.y));if(!Number.isFinite(Number(sx))||!Number.isFinite(Number(sy)))continue;const distance=(sx-px)*(sx-px)+(sy-py)*(sy-py);if(distance<bestDistance){bestDistance=distance;best=Number(point.i);}}return best;}
  function renderScatter(state){
    state.heatmapGeometry=null;HeatmapCanvas.purge(state.el);
    const d3=window.d3,reusable=reusableTraceGroups(state),svg=newSvg(state),t=theme(),active=stableSeriesRows(state.data.map((trace,index)=>({trace,index})).filter(({trace})=>visible(trace)&&['scatter','scattergl'].includes(traceType(trace)))),m=state.margin;
    const xAxis=state.layout?.xaxis||{},yAxis=state.layout?.yaxis||{},y2Axis=state.layout?.yaxis2||{},yRows=active.filter(({trace})=>String(trace.yaxis||'y')!=='y2'),y2Rows=active.filter(({trace})=>String(trace.yaxis||'y')==='y2'),xRows=active.map(row=>row.trace),yPrimary=yRows.map(row=>row.trace),ySecondary=y2Rows.map(row=>row.trace),xValues=String(xAxis.type||'linear').toLowerCase()==='category'?active.flatMap(({trace})=>Array.isArray(trace.x)?trace.x:[]):Display.axisSummary(xRows,'x'),yValues=String(yAxis.type||'linear').toLowerCase()==='category'?yRows.flatMap(({trace})=>Array.isArray(trace.y)?trace.y:[]):Display.axisSummary(yPrimary,'y'),y2Values=String(y2Axis.type||'linear').toLowerCase()==='category'?y2Rows.flatMap(({trace})=>Array.isArray(trace.y)?trace.y:[]):Display.axisSummary(ySecondary,'y');
    const yRange=axisDomainPixels(yAxis,m.t,state.innerH),y2Range=axisDomainPixels(y2Axis,m.t,state.innerH),x=scaleForAxis(d3,xAxis,xValues,[m.l,m.l+state.innerW]),y=scaleForAxis(d3,yAxis,yValues,yRange),y2=y2Rows.length?scaleForAxis(d3,y2Axis,y2Values,y2Range):null;
    const anchor=String(state.layout?.xaxis?.anchor||'y'),anchorScale=anchor==='y2'&&y2?y2:y,xAxisY=anchorScale?.range?.()?.[0]??(m.t+state.innerH),scales={x,y,y2,xAxisY};
    svg.append('rect').attr('class','dkds-d3-plot-bg').attr('x',m.l).attr('y',m.t).attr('width',state.innerW).attr('height',state.innerH).call(selectionPaint,'fill',t.plot);
    drawAxes(state,scales);updateFullLayout(state,scales);drawShapes(state,scales);
    const clipId=`dkds-d3-clip-${Math.random().toString(36).slice(2,9)}`;svg.append('defs').append('clipPath').attr('id',clipId).append('rect').attr('x',m.l).attr('y',m.t).attr('width',state.innerW).attr('height',state.innerH);const plot=svg.append('g').attr('class','dkds-d3-data-layer').attr('clip-path',`url(#${clipId})`),plotNode=plot.node();
    const displayTotals={rawPoints:0,visiblePoints:0,displayPoints:0,segments:0,traces:active.length},nodeTotals={reusedTraces:0,createdTraces:0,removedTraces:0,reusedMarkers:0,createdMarkers:0,removedMarkers:0};
    active.forEach(({trace,index,seriesKey})=>{
      const scaleY=String(trace.yaxis||'y')==='y2'&&y2?y2:y,sampled=Display.sampleTrace(trace,{layout:state.layout,pixelWidth:state.innerW});displayTotals.rawPoints+=sampled.rawCount;displayTotals.visiblePoints+=sampled.visibleCount;displayTotals.displayPoints+=sampled.displayCount;displayTotals.segments+=sampled.segmentCount;
      let groupNode=reusable.get(seriesKey);if(groupNode){reusable.delete(seriesKey);plotNode.appendChild(groupNode);nodeTotals.reusedTraces+=1;}else{groupNode=plot.append('g').node();nodeTotals.createdTraces+=1;}
      const group=d3.select(groupNode).attr('class','dkds-d3-trace-group').attr('data-series-id',seriesKey).attr('data-trace-index',index),points=sampled.points,finitePoints=points.filter(point=>point.valid),mode=String(trace.mode||'lines').toLowerCase(),color=traceColor(trace,index),opacity=Number.isFinite(Number(trace.opacity))?Number(trace.opacity):1,line=d3.line().defined(point=>point?.valid===true).x(point=>axisValue(x,point.x)).y(point=>scaleY(Number(point.y)));
      const lineData=mode.includes('lines')&&finitePoints.length?[points]:[];
      let lineNode=group.selectAll('.dkds-d3-trace-line').data(lineData);lineNode.exit().remove();lineNode=lineNode.enter().append('path').attr('class','dkds-d3-trace-line').merge(lineNode).datum(points).attr('data-trace-index',index).attr('data-series-id',seriesKey).call(selectionPaint,'fill','none').call(selectionPaint,'stroke',color).call(selectionPaint,'stroke-width',Number(trace?.line?.width)||1.5).call(selectionPaint,'stroke-dasharray',dashArray(trace?.line?.dash)).call(selectionPaint,'opacity',opacity).attr('d',line);
      let hit=group.selectAll('.dkds-d3-trace-hit').data(lineData);hit.exit().remove();hit=hit.enter().append('path').attr('class','dkds-d3-trace-hit').merge(hit).datum(points).attr('data-trace-index',index).attr('data-series-id',seriesKey).call(selectionPaint,'fill','none').call(selectionPaint,'stroke','transparent').call(selectionPaint,'stroke-width',12).attr('d',line);hit.on('pointermove',event=>{const [px,py]=d3.pointer(event,state.el),pi=nearestDisplayPointPixel(points,x,scaleY,px,py);if(pi<0)return;showTooltip(state,event,trace,index,pi);emitPoint(state,'hover',index,pi,event);}).on('pointerleave',event=>{hideTooltip(state);emitChartEvent(state,'unhover',{event});}).on('click',event=>{const [px,py]=d3.pointer(event,state.el),pi=nearestDisplayPointPixel(points,x,scaleY,px,py);if(pi>=0)emitPoint(state,'click',index,pi,event);});
      const marker=trace.marker||{},markerData=mode.includes('markers')?finitePoints:[],markerJoin=group.selectAll('.dkds-d3-trace-marker').data(markerData,point=>String(point.i)),markerExit=markerJoin.exit();nodeTotals.reusedMarkers+=markerJoin.size();nodeTotals.removedMarkers+=markerExit.size();markerExit.remove();const markerEnter=markerJoin.enter().append('path').attr('class','dkds-d3-trace-marker');nodeTotals.createdMarkers+=markerEnter.size();
      markerEnter.merge(markerJoin).attr('data-trace-index',index).attr('data-series-id',seriesKey).attr('data-point-index',point=>point.i).attr('transform',point=>`translate(${axisValue(x,point.x)},${scaleY(point.y)})`).attr('d',point=>{const size=Math.max(2,Number(scalar(marker.size,point.i,6))||6),sym=String(scalar(marker.symbol,point.i,'circle'));return d3.symbol().type(symbolType(d3,sym)).size(Math.max(18,size*size*.9))();}).each(function(point){const mc=String(scalar(marker.color,point.i,color)),sym=String(scalar(marker.symbol,point.i,'circle')),open=sym.toLowerCase().includes('-open'),node=d3.select(this);node.call(selectionPaint,'fill',open?'none':mc).call(selectionPaint,'stroke',String(marker?.line?.color||mc)).call(selectionPaint,'stroke-width',Number(marker?.line?.width)||1).call(selectionPaint,'opacity',Number.isFinite(Number(marker.opacity))?Number(marker.opacity):opacity);}).on('pointerenter',(event,point)=>{showTooltip(state,event,trace,index,point.i);emitPoint(state,'hover',index,point.i,event);}).on('pointerleave',event=>{hideTooltip(state);emitChartEvent(state,'unhover',{event});}).on('click',(event,point)=>{event.stopPropagation();emitPoint(state,'click',index,point.i,event);});
    });
    nodeTotals.removedTraces=reusable.size;state.displayStats=displayTotals;state.nodeStats=nodeTotals;
    drawAnnotations(state,scales);
    svg.on('click.dkds-background',event=>{if(event.target?.closest?.('.dkds-d3-trace-hit,.dkds-d3-trace-marker'))return;hideTooltip(state);emitChartEvent(state,'deselect',{event});});
    installWheelZoom(state,scales);
  }

  function heatInterpolator(d3,name='Viridis',reverse=false){const stopScale=colors=>{const scale=d3.scaleLinear().domain(colors.map((_,i)=>i/(colors.length-1))).range(colors).clamp(true);return t=>scale(t);};if(Array.isArray(name)){const stops=name.map(row=>Array.isArray(row)?[Number(row[0]),String(row[1])]:null).filter(Boolean).sort((a,b)=>a[0]-b[0]);if(stops.length>=2){const scale=d3.scaleLinear().domain(stops.map(row=>row[0])).range(stops.map(row=>row[1])).clamp(true);return reverse?t=>scale(1-t):t=>scale(t);}}const key=String(name||'Viridis').toLowerCase();let fn=key.includes('rdbu')?d3.interpolateRdBu:key.includes('turbo')?d3.interpolateTurbo:key.includes('cividis')?(d3.interpolateCividis||d3.interpolateViridis):key.includes('plasma')?d3.interpolatePlasma:key.includes('magma')?d3.interpolateMagma:key.includes('jet')?stopScale(['#00007f','#0000ff','#00bfff','#00ff80','#ffff00','#ff7f00','#ff0000','#7f0000']):key.includes('hot')?stopScale(['#000000','#7f0000','#ff0000','#ffbf00','#ffff80','#ffffff']):d3.interpolateViridis;if(reverse){const base=fn;fn=t=>base(1-t);}return fn;}
  function numericEdges(values){const v=values.map(Number);if(!v.length)return [];if(v.length===1)return [v[0]-.5,v[0]+.5];const out=[v[0]-(v[1]-v[0])/2];for(let i=0;i<v.length-1;i++)out.push((v[i]+v[i+1])/2);out.push(v.at(-1)+(v.at(-1)-v.at(-2))/2);return out;}
  function renderHeatmap(state){
    const d3=window.d3,svg=newSvg(state),t=theme(),trace=state.data.find(row=>visible(row)&&traceType(row)==='heatmap');if(!trace){state.heatmapGeometry=null;HeatmapCanvas.purge(state.el);drawAnnotations(state,{x:d3.scaleLinear().domain([0,1]).range([state.margin.l,state.margin.l+state.innerW]),y:d3.scaleLinear().domain([0,1]).range([state.margin.t+state.innerH,state.margin.t])});return;}
    const xs=Array.isArray(trace.x)?trace.x:[],ys=Array.isArray(trace.y)?trace.y:[],z=Array.isArray(trace.z)?trace.z:[],xCategory=String(state.layout?.xaxis?.type||'').toLowerCase()==='category'||!xs.every(finite),yCategory=String(state.layout?.yaxis?.type||'').toLowerCase()==='category'||!ys.every(finite),x=scaleForHeatmapAxis(d3,state.layout?.xaxis||{},xs,[state.margin.l,state.margin.l+state.innerW]),y=scaleForHeatmapAxis(d3,state.layout?.yaxis||{},ys,[state.margin.t+state.innerH,state.margin.t]),scales={x,y,y2:null,xAxisY:state.margin.t+state.innerH};
    drawAxes(state,scales);updateFullLayout(state,scales);
    const [zmin,zmax]=HeatmapCanvas.normalizedDomain(z,trace.zmin,trace.zmax),interpolate=heatInterpolator(d3,trace.colorscale,!!trace.reversescale),rawMid=finite(trace.zmid)?Number(trace.zmid):null,zmid=rawMid!==null&&rawMid>zmin&&rawMid<zmax?rawMid:null,color=zmid!==null?d3.scaleDiverging(interpolate).domain([zmin,zmid,zmax]):d3.scaleSequential(interpolate).domain([zmin,zmax]).clamp(true),xEdges=xCategory?null:numericEdges(xs),yEdges=yCategory?null:numericEdges(ys),xBands=xs.map((value,index)=>{const a=xCategory?x(String(value)):x(xEdges[index]),b=xCategory?a+x.bandwidth():x(xEdges[index+1]);return {lo:Math.min(a,b),hi:Math.max(a,b),index};}),yBands=ys.map((value,index)=>{const a=yCategory?y(String(value)):y(yEdges[index]),b=yCategory?a+y.bandwidth():y(yEdges[index+1]);return {lo:Math.min(a,b),hi:Math.max(a,b),index};});state.heatmapGeometry={traceIndex:state.data.indexOf(trace),xBands,yBands};
    const raster=HeatmapCanvas.render(state.el,{width:state.width,height:state.height,plot:{x:state.margin.l,y:state.margin.t,width:state.innerW,height:state.innerH},xBands,yBands,z,color,colorKey:JSON.stringify([trace.colorscale||null,!!trace.reversescale,zmin,zmax,zmid]),background:t.plot});state.displayStats={rawPoints:raster?.totalCells||0,visiblePoints:raster?.finiteCells||0,displayPoints:raster?.paintedCells||0,segments:0,traces:1};state.nodeStats={reusedTraces:0,createdTraces:0,removedTraces:0,reusedMarkers:0,createdMarkers:0,removedMarkers:0,heatmapSvgCells:0,heatmapCanvas:1};
    HeatmapSelection.mount(state);
    const hit=svg.append('rect').attr('class','dkds-d3-heatmap-hit').attr('x',state.margin.l).attr('y',state.margin.t).attr('width',state.innerW).attr('height',state.innerH).call(selectionPaint,'fill','transparent');
    hit.on('pointermove',event=>{const [px,py]=d3.pointer(event,state.el),cell=HeatmapCanvas.hitTest(state.el,px,py);if(!cell?.finite){hideTooltip(state);return;}const {xi,yi,value}=cell,host=tooltipHost(state),r=state.el.getBoundingClientRect();host.hidden=false;host.textContent=`x = ${formatValue(xs[xi])}   y = ${formatValue(ys[yi])}   z = ${formatValue(value)}`;d3StyleSet(host,'left',`${Math.max(6,Math.min(state.width-220,event.clientX-r.left+12))}px`,'scientific-tooltip');d3StyleSet(host,'top',`${Math.max(6,Math.min(state.height-46,event.clientY-r.top+12))}px`,'scientific-tooltip');emitChartEvent(state,'hover',{points:[HeatmapSelection.eventPoint(state,trace,xi,yi,event)],event});}).on('pointerleave',event=>{hideTooltip(state);emitChartEvent(state,'unhover',{event});}).on('click',event=>{event.stopPropagation();const [px,py]=d3.pointer(event,state.el),cell=HeatmapCanvas.hitTest(state.el,px,py);if(cell?.finite)emitChartEvent(state,'click',{points:[HeatmapSelection.eventPoint(state,trace,cell.xi,cell.yi,event)],event});});
    installWheelZoom(state,scales);
    const cb=trace.colorbar||{},cbX=state.width-Math.max(16,state.margin.r-26),cbY=state.margin.t+8,cbH=Math.max(50,state.innerH-16),gradId=`dkds-d3-grad-${Math.random().toString(36).slice(2,9)}`,defs=svg.append('defs'),grad=defs.append('linearGradient').attr('id',gradId).attr('x1','0%').attr('y1','100%').attr('x2','0%').attr('y2','0%');for(let i=0;i<=10;i++)grad.append('stop').attr('offset',`${i*10}%`).call(selectionPaint,'stop-color',color(zmin+(zmax-zmin)*i/10));const cbGroup=svg.append('g').attr('class','dkds-d3-colorbar');cbGroup.append('rect').attr('x',cbX).attr('y',cbY).attr('width',10).attr('height',cbH).call(selectionPaint,'fill',`url(#${gradId})`).attr('rx',2);const cbScale=d3.scaleLinear().domain([zmin,zmax]).range([cbY+cbH,cbY]),axis=configuredAxis(d3,'right',cbScale,cb,5);const cbAxis=cbGroup.append('g').attr('transform',`translate(${cbX+10},0)`).call(axis);cbAxis.selectAll('path,line').call(selectionPaint,'stroke',t.axis);const cbLabels=cbAxis.selectAll('text').call(selectionPaint,'fill',t.muted);selectionStyle(cbLabels,'font-size','9px','scientific-colorbar-label');const cbTitle=titleText(cb.title);if(cbTitle){const cbTitleNode=cbGroup.append('text').attr('x',cbX+4).attr('y',Math.max(10,cbY-5)).attr('text-anchor','middle').call(selectionPaint,'fill',t.text).text(cbTitle);selectionStyle(cbTitleNode,'font-size','10px','scientific-colorbar-title');}drawAnnotations(state,scales);
  }

  function ensureInvalidationState(state){
    if(!state.invalidations)state.invalidations={data:0,geometry:0,themePaint:0,selectionOverlay:0};
    if(!(state.selectionOverlays instanceof Map))state.selectionOverlays=new Map();
    return state;
  }
  function emitInvalidation(state,kind){
    ensureInvalidationState(state);state.invalidations[kind]=(Number(state.invalidations[kind])||0)+1;
    try{state.emitter.emit('dkds_chart_invalidated',{renderer:'d3',kind,revisions:{data:state.dataRevision||0,geometry:state.geometryRevision||0,paint:state.paintRevision||0,selection:state.selectionRevision||0},target:state.el});}catch{}
  }
  function overlayForTrace(state,index){ensureInvalidationState(state);return state.selectionOverlays.get(Number(index))||null;}
  function applyTraceOverlay(state,index){
    const patch=overlayForTrace(state,index);if(!patch||!state.svg)return false;const d3=window.d3,trace=state.data[index]||{};let changed=false;if(Object.prototype.hasOwnProperty.call(patch,'heatmap.rows'))changed=HeatmapSelection.apply(state,index,patch)||changed;
    const opacityRaw=patch.opacity,lineWidthRaw=patch['line.width'],markerOpacityRaw=patch['marker.opacity'],markerSizeRaw=patch['marker.size'];
    const line=state.svg.selectAll(`.dkds-d3-trace-line[data-trace-index="${index}"]`);
    if(!line.empty()){if(opacityRaw!==undefined)line.call(selectionPaint,'opacity',Number(scalar(opacityRaw,0,trace.opacity??1)));if(lineWidthRaw!==undefined)line.call(selectionPaint,'stroke-width',Number(scalar(lineWidthRaw,0,trace?.line?.width??1.5)));}
    state.svg.selectAll(`.dkds-d3-trace-marker[data-trace-index="${index}"]`).each(function(){
      const node=d3.select(this),pointIndex=Number(this.getAttribute('data-point-index'))||0;
      if(markerOpacityRaw!==undefined)node.call(selectionPaint,'opacity',Number(scalar(markerOpacityRaw,pointIndex,trace?.marker?.opacity??trace.opacity??1)));else if(opacityRaw!==undefined)node.call(selectionPaint,'opacity',Number(scalar(opacityRaw,0,trace.opacity??1)));
      if(markerSizeRaw!==undefined){const size=Math.max(2,Number(scalar(markerSizeRaw,pointIndex,scalar(trace?.marker?.size,pointIndex,6)))||6),symbol=String(scalar(trace?.marker?.symbol,pointIndex,'circle')),path=d3.symbol().type(symbolType(d3,symbol)).size(Math.max(18,size*size*.9))();node.attr('d',path);}
    });
    return true;
  }
  function reapplySelectionOverlays(state){if(!state.selectionOverlays?.size)return false;let changed=false;for(const index of state.selectionOverlays.keys())changed=applyTraceOverlay(state,index)||changed;return changed;}
  function selectionOverlay(target,update={},traces){
    const state=getState(target);if(!state?.svg)return Promise.resolve(false);ensureInvalidationState(state);const indices=(traces===undefined?state.data.map((_,i)=>i):(Array.isArray(traces)?traces:[traces])).map(Number).filter(Number.isInteger),count=indices.length;
    for(let offset=0;offset<count;offset++){const index=indices[offset],previous=state.selectionOverlays.get(index)||{},next={...previous};for(const key of ['opacity','line.width','marker.opacity','marker.size','heatmap.rows'])if(Object.prototype.hasOwnProperty.call(update||{},key))next[key]=overlayPatchValue(update,key,offset,count);state.selectionOverlays.set(index,next);applyTraceOverlay(state,index);}
    state.selectionRevision=(Number(state.selectionRevision)||0)+1;emitInvalidation(state,'selectionOverlay');return Promise.resolve(true);
  }
  function paintTheme(state){
    if(!state?.svg)return false;const d3=window.d3,t=theme(),svg=state.svg;
    svg.selectAll('.dkds-d3-plot-bg').call(selectionPaint,'fill',t.plot);if(state.kind==='heatmap')HeatmapCanvas.repaint(state.el,{background:t.plot});svg.selectAll('.dkds-d3-grid line').call(selectionPaint,'stroke',t.grid);
    svg.selectAll('.dkds-d3-axis').each(function(){const group=d3.select(this);group.selectAll('path,line').call(selectionPaint,'stroke',t.axis);group.selectAll('text').call(selectionPaint,'fill',t.muted);});
    svg.selectAll('.dkds-d3-axis-title').call(selectionPaint,'fill',t.text);
    svg.selectAll('.dkds-d3-annotation').each(function(){const index=Number(this.getAttribute('data-annotation-index'))||0,row=state.layout?.annotations?.[index]||{};d3.select(this).call(selectionPaint,'fill',row?.font?.color||t.muted);});
    svg.selectAll('.dkds-d3-trace-line').each(function(){const index=Number(this.getAttribute('data-trace-index'))||0;d3.select(this).call(selectionPaint,'stroke',traceColor(state.data[index]||{},index));});
    svg.selectAll('.dkds-d3-trace-marker').each(function(){const index=Number(this.getAttribute('data-trace-index'))||0,pointIndex=Number(this.getAttribute('data-point-index'))||0,trace=state.data[index]||{},base=traceColor(trace,index),marker=trace.marker||{},color=String(scalar(marker.color,pointIndex,base)),symbol=String(scalar(marker.symbol,pointIndex,'circle')),open=symbol.toLowerCase().includes('-open');d3.select(this).call(selectionPaint,'fill',open?'none':color).call(selectionPaint,'stroke',String(marker?.line?.color||color));});
    svg.selectAll('.dkds-d3-colorbar path,.dkds-d3-colorbar line').call(selectionPaint,'stroke',t.axis);svg.selectAll('.dkds-d3-colorbar text').call(selectionPaint,'fill',t.muted);HeatmapSelection.repaint(state);
    state.paintRevision=(Number(state.paintRevision)||0)+1;emitInvalidation(state,'themePaint');return true;
  }
  function render(state,invalidation='data'){
    if(!window.d3)throw new Error('D3 runtime unavailable.');ensureInvalidationState(state);prepareHost(state.el);resolveGeometry(state);state.kind=state.data.some(row=>traceType(row)==='heatmap')?'heatmap':'cartesian';if(state.kind==='heatmap')renderHeatmap(state);else renderScatter(state);reapplySelectionOverlays(state);state.revision+=1;if(invalidation==='data')state.dataRevision=(Number(state.dataRevision)||0)+1;else state.geometryRevision=(Number(state.geometryRevision)||0)+1;emitInvalidation(state,invalidation==='data'?'data':'geometry');state.el.dataset.dkdsChartRenderer='d3';state.el.data=state.data;state.el.layout=state.layout;state.el._context=state.config;state.el._fullData=state.data;state.emitter.emit('dkds_chart_rendered',{renderer:'d3',revision:state.revision,invalidation,target:state.el});return state.el;
  }
  function react(target,data=[],layout={},config={}){const el=element(target)||target;if(!el)throw new Error('D3 chart target not found.');if(!supports(data))throw new Error('D3 renderer received an unsupported trace type.');let state=states.get(el);if(!state){state={el,data:[],layout:{},config:{},width:0,height:0,revision:0,dataRevision:0,geometryRevision:0,paintRevision:0,selectionRevision:0,invalidations:{data:0,geometry:0,themePaint:0,selectionOverlay:0},selectionOverlays:new Map(),heatmapGeometry:null,displayStats:{},nodeStats:{},kind:'cartesian',emitter:ensureEmitter(el)};states.set(el,state);}state.data=clone(Array.isArray(data)?data:[]);state.layout=clone(layout||{});state.config={...(config||{})};state.selectionOverlays.clear();return Promise.resolve(render(state,'data'));}
  function restyle(target,update,traces){const state=getState(target);if(!state)return Promise.resolve(false);const indices=traces===undefined?state.data.map((_,i)=>i):(Array.isArray(traces)?traces:[traces]);applyRestyle(state.data,update,indices);return Promise.resolve(render(state,'data'));}
  function relayout(target,update){const state=getState(target);if(!state)return Promise.resolve(false);applyRelayout(state.layout,update||{});const result=render(state,'geometry'),payload=clone(update||{});emitChartEvent(state,'relayout',payload);return Promise.resolve(result);}
  function resize(target){const state=getState(target);if(!state)return false;render(state,'geometry');return true;}
  function themePaint(target){const state=getState(target);return state?paintTheme(state):false;}
  function purge(target){const el=element(target)||target,state=el?states.get(el):null;if(!el)return false;if(state){hideTooltip(state);state.selectionOverlays?.clear?.();states.delete(el);}HeatmapCanvas.purge(el);clearRendererNodes(el);delete el.data;delete el.layout;delete el._fullData;delete el._fullLayout;delete el._context;delete el.dataset.dkdsChartRenderer;return true;}
  async function toImage(target,{format='svg',width,height,scale=2}={}){const state=getState(target);if(!state?.svg)throw new Error('D3 chart has not rendered.');const node=state.svg.node(),exportNode=node.cloneNode(true),raster=state.kind==='heatmap'?HeatmapCanvas.exportLayer(state.el):null;if(raster&&typeof document!=='undefined'&&typeof document.createElementNS==='function'){const image=document.createElementNS('http://www.w3.org/2000/svg','image');image.setAttribute('href',raster.href);image.setAttribute('x','0');image.setAttribute('y','0');image.setAttribute('width',String(raster.width));image.setAttribute('height',String(raster.height));exportNode.insertBefore(image,exportNode.firstChild);}const serializer=new XMLSerializer(),text=serializer.serializeToString(exportNode),svgText=text.includes('xmlns=')?text:text.replace('<svg','<svg xmlns="http://www.w3.org/2000/svg"');if(String(format).toLowerCase()==='svg')return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgText)}`;if(typeof document==='undefined'||typeof Image==='undefined')throw new Error('PNG export requires a browser canvas runtime.');const canvas=document.createElement('canvas'),w=Math.max(1,Number(width)||state.width),h=Math.max(1,Number(height)||state.height),ratio=Math.max(1,Number(scale)||1);canvas.width=w*ratio;canvas.height=h*ratio;const ctx=canvas.getContext('2d');ctx.scale(ratio,ratio);const img=new Image();await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=reject;img.src=`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgText)}`;});ctx.drawImage(img,0,0,w,h);return canvas.toDataURL('image/png');}

  const geometry=Object.freeze({autoPadFraction,paddedLinearDomain,numericEdges,linearTickValues,zoomRange,normalizedColorDomain:(values,zmin,zmax)=>normalizedColorDomain(null,values,zmin,zmax)});
  window.DKDSD3Renderer=Object.freeze({VERSION,backend:'d3',supportedTraceTypes:Object.freeze([...SUPPORTED_TYPES]),supports,react,restyle,relayout,resize,selectionOverlay,themePaint,purge,toImage,state:stateSnapshot,rawState:getState,geometry});
})();
