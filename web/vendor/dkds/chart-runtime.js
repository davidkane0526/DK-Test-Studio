(() => {
  if(window.DKDSCharts)return;
  const VERSION='2.0.0';
  const ChartExport=window.DKDSChartExport;if(!ChartExport)throw new Error('DKDSChartExport must initialize before chart runtime.');
  const StyleGate=globalThis.DKDSStyleGate;
  if(!StyleGate)throw new Error('DKDSStyleGate must initialize before chart runtime.');
  const STYLE_OWNER='core.chart-runtime-navigation';
  const STYLE_SOURCE='src/core/scientific/chart-runtime.js';
  const navStyleSet=(el,prop,value)=>StyleGate.set(el,prop,value,{owner:STYLE_OWNER,component:'scientific-navigation',kind:'runtime-inline',source:STYLE_SOURCE});
  const navStyleRemove=(el,prop)=>StyleGate.remove(el,prop,{owner:STYLE_OWNER,component:'scientific-navigation',kind:'runtime-inline',source:STYLE_SOURCE});
  const ownerBindings=new Map();
  const presentation=window.DKDSPlotPresentation||Object.freeze({
    solveLegend:({entries=[],enabled=true}={})=>({enabled:enabled!==false&&entries.length>1,placement:enabled!==false&&entries.length>1?'top':'none',count:entries.length,rows:entries.length>1?1:0,width:0,height:0,reserve:entries.length>1?26:0,overflow:false,entries,rowGroups:entries.length?[entries]:[],signature:entries.map(row=>row?.key||'').join('|'),reason:'fallback'}),
    LegendController:class{constructor(container){this.container=container;this.host=null;}update(){return null;}dispose(){}}
  });
  const displayScaleStates=new WeakMap();
  const legendLayoutStates=new WeakMap();
  const legendBaseLayouts=new WeakMap();
  const legendResizeFrames=new WeakMap();
  const plotNavigationStates=new WeakMap();
  const nativeTouchDrag=()=>window.DKDSNativeTouchDrag||null;
  const plotLegendStates=new WeakMap();
  const plotLegendSelectionStates=new WeakMap();
  const rendererStates=new WeakMap();
  const neutralBindings=new WeakMap();
  let runtimeConfig={preferredRenderer:'d3',host:'main'};
  const element=value=>{
    if(value?.nodeType===1)return value;
    if(typeof value==='string')return document.getElementById(value)||document.querySelector(value);
    return null;
  };
  const d3Renderer=()=>window.DKDSD3Renderer||null;
  const d3Ready=()=>!!(window.d3&&d3Renderer()?.react);
  function configureRuntime(options={}){
    if(options.host)runtimeConfig.host=String(options.host);
    if(options.preferredRenderer&&String(options.preferredRenderer).toLowerCase()!=='d3'){
      throw new Error('DK Data Studio scientific rendering is D3-only.');
    }
    runtimeConfig.preferredRenderer='d3';
    return runtimeState();
  }
  function runtimeState(){return {version:VERSION,host:runtimeConfig.host,preferredRenderer:'d3',renderer:'d3',ready:d3Ready(),d3Ready:d3Ready(),singleBackend:true};}
  function rendererFor(target){const el=element(target)||target;return String(rendererStates.get(el)||el?.dataset?.dkdsChartRenderer||'');}
  function chooseRenderer(data=[],config={}){
    const requested=String(config?.dkdsRenderer||config?.renderer||'').toLowerCase();
    if(requested&&requested!=='d3')throw new Error(`Unsupported scientific renderer: ${requested}. DK Data Studio is D3-only.`);
    const renderer=d3Renderer();
    if(!renderer?.supports?.(data)){
      const kinds=[...new Set((Array.isArray(data)?data:[]).map(row=>String(row?.type||'scatter').toLowerCase()))].join(', ')||'empty';
      throw new Error(`D3 renderer does not support trace type(s): ${kinds}.`);
    }
    return 'd3';
  }
  async function ensureRenderer(name='d3'){
    if(String(name||'d3')!=='d3')throw new Error('DK Data Studio scientific rendering is D3-only.');
    const renderer=d3Renderer();if(!window.d3||!renderer?.react)throw new Error('D3 scientific renderer unavailable.');return renderer;
  }
  function track(owner,off){const id=String(owner||'plugin');if(!ownerBindings.has(id))ownerBindings.set(id,new Set());ownerBindings.get(id).add(off);return()=>{try{off();}finally{ownerBindings.get(id)?.delete(off);}};}
  const UI_FONT='Segoe UI Variable Text, Microsoft YaHei UI, Segoe UI, sans-serif';
  const TOOLTIP_BASE=Object.freeze({align:'left',font:Object.freeze({size:12,family:UI_FONT})});
  const PLOT_SERIES_PALETTE=Object.freeze(['#2563eb','#0f9f9a','#dc2626','#f97316','#6d28d9','#db2777','#16a34a','#ca8a04','#0891b2','#7c3aed']);
  const PLOT_THEME_LIGHT=Object.freeze({paper:'#ffffff',plot:'#ffffff',grid:'#e8edf4',zero:'#d3dbe6',axis:'#adb8c7',text:'#46546a',muted:'#6f7d91',legend:'rgba(214,223,235,.72)',colorbar:'#d3dce8',tooltip:'rgba(255,255,255,.96)',tooltipBorder:'#d8e0eb'});
  const PLOT_THEME_DARK=Object.freeze({paper:'#1d232e',plot:'#1d232e',grid:'#303a49',zero:'#414d5f',axis:'#5a687c',text:'#d8e0eb',muted:'#9aa7b9',legend:'rgba(72,84,103,.80)',colorbar:'#4b586b',tooltip:'rgba(17,24,39,.96)',tooltipBorder:'#465369'});
  const activeThemeName=()=>String(window.DKDSTheme?.current?.()||document.documentElement?.dataset?.dkdsTheme||'').toLowerCase()|| (globalThis.matchMedia?.('(prefers-color-scheme: dark)')?.matches?'dark':'light');
  const plotTheme=()=>activeThemeName()==='dark'?PLOT_THEME_DARK:PLOT_THEME_LIGHT;
  const currentTooltipTheme=()=>{const theme=plotTheme();return Object.freeze({...TOOLTIP_BASE,bgcolor:theme.tooltip,bordercolor:theme.tooltipBorder,font:Object.freeze({...TOOLTIP_BASE.font,color:theme.text})});};
  const isPlainWhite=value=>['','#fff','#ffffff','white','rgb(255, 255, 255)','rgba(255, 255, 255, 1)'].includes(String(value??'').trim().toLowerCase());
  const oldGrid=value=>['','#edf0f5','#e8edf5','#e5e9f0','#dfe5ef'].includes(String(value??'').trim().toLowerCase());
  function themeAxis(axis={},theme=plotTheme()){
    const source=axis&&typeof axis==='object'?axis:{};const title=source.title&&typeof source.title==='object'?source.title:{text:source.title};const tickfont=source.tickfont&&typeof source.tickfont==='object'?source.tickfont:{};
    return {...source,gridcolor:oldGrid(source.gridcolor)?theme.grid:source.gridcolor,zerolinecolor:oldGrid(source.zerolinecolor)?theme.zero:source.zerolinecolor,linecolor:source.linecolor||theme.axis,tickcolor:source.tickcolor||theme.axis,tickfont:{family:UI_FONT,size:11,color:theme.muted,...tickfont},title:{...title,font:{family:UI_FONT,size:12,color:theme.text,...(title.font||{})}},automargin:source.automargin!==false};
  }
  function themeLayout(layout={}){
    const source=layout&&typeof layout==='object'?layout:{};const hover=source.hoverlabel&&typeof source.hoverlabel==='object'?source.hoverlabel:{};const next={...source},theme=plotTheme();
    for(const [key,value] of Object.entries(source))if(/^[xy]axis\d*$/.test(key))next[key]=themeAxis(value,theme);
    if(!next.xaxis)next.xaxis=themeAxis({},theme);if(!next.yaxis)next.yaxis=themeAxis({},theme);
    const font=source.font&&typeof source.font==='object'?source.font:{};next.font={family:UI_FONT,size:12,color:theme.text,...font};
    if(isPlainWhite(source.paper_bgcolor))next.paper_bgcolor=theme.paper;
    if(isPlainWhite(source.plot_bgcolor))next.plot_bgcolor=theme.plot;
    if(source.legend&&typeof source.legend==='object')next.legend={...source.legend,bgcolor:isPlainWhite(source.legend.bgcolor)?'rgba(255,255,255,0)':source.legend.bgcolor,bordercolor:source.legend.bordercolor||theme.legend,borderwidth:Number(source.legend.borderwidth)||0,font:{family:UI_FONT,size:11,color:theme.text,...(source.legend.font||{})}};
    next.modebar={bgcolor:'rgba(0,0,0,0)',color:theme.muted,activecolor:theme.text,...(source.modebar||{})};
    const tooltip=currentTooltipTheme();next.hoverlabel={...tooltip,...hover,font:{...tooltip.font,...(hover.font||{}),family:UI_FONT,size:TOOLTIP_BASE.font.size}};
    return next;
  }
  function normalizeHoverTemplate(value){
    const text=String(value??'');if(!text||!/<extra>[\s\S]*?<\/extra>/i.test(text))return text;
    return text.replace(/<extra>([\s\S]*?)<\/extra>/gi,(_all,extra)=>{const label=String(extra||'').replace(/<[^>]*>/g,'').trim();return label?`<br><b>${label}</b><extra></extra>`:'<extra></extra>';});
  }
  function themeTrace(trace={}){
    if(!trace||typeof trace!=='object')return trace;
    const hover=trace.hoverlabel&&typeof trace.hoverlabel==='object'?trace.hoverlabel:{};
    const tooltip=currentTooltipTheme();const next={...trace,hoverlabel:{...tooltip,...hover,font:{...tooltip.font,...(hover.font||{}),family:UI_FONT,size:TOOLTIP_BASE.font.size}}};
    if(trace.colorbar&&typeof trace.colorbar==='object'){const theme=plotTheme(),title=trace.colorbar.title&&typeof trace.colorbar.title==='object'?trace.colorbar.title:{text:trace.colorbar.title};next.colorbar={...trace.colorbar,outlinecolor:trace.colorbar.outlinecolor||theme.colorbar,tickfont:{family:UI_FONT,size:10,color:theme.muted,...(trace.colorbar.tickfont||{})},title:{...title,font:{family:UI_FONT,size:11,color:theme.text,...(title.font||{})}}};}
    if(typeof trace.hovertemplate==='string')next.hovertemplate=normalizeHoverTemplate(trace.hovertemplate);
    if(document.documentElement?.classList?.contains('react-native-client')&&trace.marker&&typeof trace.marker==='object'&&Number.isFinite(Number(trace.marker.size))){next.marker={...trace.marker,size:Math.max(3,Number(trace.marker.size)*.78)};}
    return next;
  }
  function themeData(data=[]){return normalizedLegendData(Array.isArray(data)?data:[]).map(themeTrace);}
  function compactLegendLabel(value=''){let text=String(value??'').trim();if(!text)return '';text=text.replace(/\\/g,'/');if(text.includes('/'))text=text.split('/').filter(Boolean).at(-1)||text;text=text.replace(/\.(csv|txt|dat|tsv|xlsx?|json)$/i,'');return text.length>44?`${text.slice(0,20)}…${text.slice(-20)}`:text;}
  function normalizedLegendData(data=[]){const rows=(Array.isArray(data)?data:[]).map((trace,index)=>{if(!trace||typeof trace!=='object')return trace;const explicit=trace.legendlabel??trace.meta?.legendLabel??trace.meta?.label;let name=compactLegendLabel(explicit??trace.name??'');if(!name)name=`Series ${index+1}`;return {...trace,name};});const counts=new Map();for(const row of rows){const name=String(row?.name||'');counts.set(name,(counts.get(name)||0)+1);}const seen=new Map();return rows.map((row,index)=>{const name=String(row?.name||'');if((counts.get(name)||0)<=1)return row;const ordinal=(seen.get(name)||0)+1;seen.set(name,ordinal);const suffix=row?.meta?.vg!=null?` · ${row.meta.vg} V`:row?.legendgroup?` · ${compactLegendLabel(row.legendgroup)}`:` · ${ordinal}`;return {...row,name:`${name}${suffix}`};});}
  function legendableTrace(trace={}){const type=String(trace?.type||'scatter').toLowerCase();return trace?.showlegend!==false&&!!String(trace?.name||'').trim()&&!['heatmap','contour','surface','image','histogram2d','histogram2dcontour'].includes(type);}
  function traceLegendGroup(trace={}){return String(trace?.legendgroup??'').trim();}
  function legendEntryKey(trace,index){const group=traceLegendGroup(trace);return group?`legendgroup:${group}`:traceSeriesKey(trace,index);}
  function legendEntriesFor(data=[],el=null){
    const rows=Array.isArray(data)?data:[],out=[],seen=new Set();
    rows.forEach((trace,index)=>{
      if(!legendableTrace(trace))return;const key=legendEntryKey(trace,index);if(seen.has(key))return;seen.add(key);const group=traceLegendGroup(trace);
      const indices=group?rows.map((candidate,i)=>traceLegendGroup(candidate)===group?i:-1).filter(i=>i>=0):[index];
      out.push({trace,index,key,indices,label:String(trace?.name||''),color:plotLegendColor(el,trace,index)});
    });
    return out;
  }
  function smartLegendLayout(target,data=[],layout={}){
    const source=layout&&typeof layout==='object'?layout:{},entries=legendEntriesFor(data,target),explicitOff=source.showlegend===false,previous=legendLayoutStates.get(target)||{};
    const current=source.legend&&typeof source.legend==='object'?source.legend:{};
    let requested=String(current.placement||current.autoplacePlacement||'auto').toLowerCase();
    if(!['auto','top','bottom','right','left'].includes(requested)){
      const orientation=String(current.orientation||'').toLowerCase(),x=Number(current.x),y=Number(current.y);
      requested=orientation==='v'?(Number.isFinite(x)&&x<.5?'left':'right'):(Number.isFinite(y)&&y<0?'bottom':'top');
    }else if(requested==='auto'&&current.autoplace===false){
      const orientation=String(current.orientation||'').toLowerCase(),x=Number(current.x),y=Number(current.y);
      requested=orientation==='v'?(Number.isFinite(x)&&x<.5?'left':'right'):(Number.isFinite(y)&&y<0?'bottom':'top');
    }
    const rect=target?.getBoundingClientRect?.()||{},width=Math.max(240,Number(rect.width)||Number(source.width)||640),height=Math.max(160,Number(rect.height)||Number(source.height)||360),margin={l:56,r:18,t:18,b:46,...(source.margin||{})};
    const metrics=presentation.solveLegend({entries,width,height,margin:{left:margin.l,right:margin.r,top:margin.t,bottom:margin.b},placement:requested,maxRows:2,enabled:!explicitOff,previous,stabilize:true,options:{maxItemWidth:146,minPlotWidth:220}});
    const nextMargin={...margin};
    if(metrics.reserve>0&&metrics.placement==='top')nextMargin.t=Math.max(nextMargin.t,Math.ceil(metrics.reserve)+7);
    else if(metrics.reserve>0&&metrics.placement==='bottom')nextMargin.b=Math.max(nextMargin.b,Math.ceil(metrics.reserve)+40);
    else if(metrics.reserve>0&&metrics.placement==='left')nextMargin.l=Math.max(nextMargin.l,Math.ceil(metrics.reserve)+30);
    else if(metrics.reserve>0&&metrics.placement==='right')nextMargin.r=Math.max(nextMargin.r,Math.ceil(metrics.reserve)+4);
    const stored={...metrics,reason:metrics.reason||'core-presentation-solver'};legendLayoutStates.set(target,stored);
    return {...source,showlegend:!explicitOff,margin:nextMargin,legend:{...current,autoplace:true,placement:metrics.placement,itemclick:false,itemdoubleclick:false,font:{size:10,...(current.font||{})},itemsizing:'constant',tracegroupgap:3}};
  }
  function legendMetrics(target){const el=element(target)||target;return {...(legendLayoutStates.get(el)||{enabled:false,placement:'none',count:0,rows:0,width:0,height:0,reserve:0,reason:'unrendered'})};}
  function normalizeConfig(config={}){
    const source=config&&typeof config==='object'?config:{},staticPlot=source.staticPlot===true,explicitOff=source.dkdsNavigationTools===false;
    const next={responsive:true,displaylogo:false,scrollZoom:!staticPlot,doubleClick:'reset+autosize',...source};
    next.__dkdsNavigationTools=!staticPlot&&!explicitOff;
    // Renderer-native chrome is intentionally suppressed. Core renders one compact,
    // theme-aware, draggable navigation strip shared with D3 ScientificCurveSurface.
    next.displayModeBar=false;delete next.dkdsNavigationTools;return next;
  }
  const cloneLayout=value=>{try{return structuredClone(value);}catch{try{return JSON.parse(JSON.stringify(value));}catch{return {...(value||{})};}}};
  const axisType=layout=>String(layout?.yaxis?.type||'linear').toLowerCase();
  const toggleableAxisType=type=>!['category','date','multicategory'].includes(String(type||'').toLowerCase());
  const absNumber=value=>{const n=Number(value);return Number.isFinite(n)?Math.abs(n):value;};
  const isHeatmapTrace=trace=>String(trace?.type||'').toLowerCase()==='heatmap';
  const hasHeatmap=data=>(Array.isArray(data)?data:[]).some(isHeatmapTrace);
  const displayAxisFor=(data,layout)=>hasHeatmap(data)?'z':(toggleableAxisType(axisType(layout))?'y':'');
  const finitePositiveAbs=value=>{const n=Math.abs(Number(value));return Number.isFinite(n)&&n>0?n:null;};
  const flattenNumbers=value=>{const out=[];const visit=row=>{if(Array.isArray(row)){for(const item of row)visit(item);return;}const n=finitePositiveAbs(row);if(n!==null)out.push(n);};visit(value);return out;};
  const decadeValues=(lo,hi,{multipliers=[1]}={})=>{
    const a=finitePositiveAbs(lo),b=finitePositiveAbs(hi);if(a===null||b===null)return [];
    const min=Math.min(a,b),max=Math.max(a,b),from=Math.floor(Math.log10(min)),to=Math.ceil(Math.log10(max)),rows=[];
    for(let exp=from;exp<=to;exp++)for(const factor of multipliers){const value=factor*Math.pow(10,exp);if(value>=min*(1-1e-12)&&value<=max*(1+1e-12))rows.push(value);}
    return rows;
  };
  const formatLogValue=value=>{
    const n=Number(value);if(!Number.isFinite(n))return '';
    const a=Math.abs(n);if(a===0)return '0';
    if(a>=1e4||a<1e-3)return n.toExponential(0).replace('e+','e');
    if(a>=100)return String(Math.round(n));
    if(a>=10)return String(Math.round(n*10)/10);
    if(a>=1)return String(Math.round(n*100)/100);
    return String(Number(n.toPrecision(2)));
  };
  function heatmapDisplayTrace(trace,mode){
    if(mode!=='log'||!isHeatmapTrace(trace))return trace;
    const next={...trace};
    const rawZ=Array.isArray(trace.z)?trace.z:[];
    const positives=flattenNumbers(rawZ);
    if(!positives.length)return next;
    const min=Math.min(...positives),max=Math.max(...positives);
    const project=value=>{const n=finitePositiveAbs(value);return n===null?null:Math.log10(n);};
    next.z=rawZ.map(row=>Array.isArray(row)?row.map(project):project(row));
    const magnitudeZ=rawZ.map(row=>Array.isArray(row)?row.map(value=>finitePositiveAbs(value)):finitePositiveAbs(row));
    const logMin=Math.log10(min),logMax=Math.log10(max);next.zmin=logMin===logMax?logMin-.5:logMin;next.zmax=logMin===logMax?logMax+.5:logMax;
    delete next.zmid;
    const tickOriginal=decadeValues(min,max,{multipliers:[1,2,5]});
    const ticks=tickOriginal.length>=2?tickOriginal:decadeValues(min,max,{multipliers:[1,1.5,2,3,5,7]});
    next.colorbar={...(trace.colorbar||{}),tickmode:'array',tickvals:ticks.map(value=>Math.log10(value)),ticktext:ticks.map(formatLogValue)};
    if(typeof trace.hovertemplate==='string'){
      if(trace.customdata===undefined){next.customdata=magnitudeZ;next.hovertemplate=trace.hovertemplate.replace(/%\{z(?::([^}]+))?\}/g,(_all,fmt)=>`%{customdata${fmt?`:${fmt}`:''}}`);}
      else if(trace.text===undefined){next.text=magnitudeZ;next.hovertemplate=trace.hovertemplate.replace(/%\{z(?::([^}]+))?\}/g,(_all,fmt)=>`%{text${fmt?`:${fmt}`:''}}`);}
    }
    return next;
  }
  function displayTrace(trace,mode,axis='y'){
    if(mode!=='log'||!trace||typeof trace!=='object')return trace;
    if(axis==='z')return heatmapDisplayTrace(trace,mode);
    const next={...trace};
    if(Array.isArray(trace.y))next.y=trace.y.map(absNumber);
    else if(Number.isFinite(Number(trace.y0)))next.y0=Math.abs(Number(trace.y0));
    return next;
  }
  function displayLayout(source,mode,axis='y'){
    const layout=cloneLayout(source||{});
    if(axis!=='y')return layout;
    const base=axisType(source);if(!toggleableAxisType(base))return layout;
    layout.yaxis={...(layout.yaxis||{}),type:mode};
    if(mode==='log'){
      delete layout.yaxis.range;layout.yaxis.autorange=true;
      delete layout.yaxis.tickvals;delete layout.yaxis.ticktext;delete layout.yaxis.tick0;
      layout.yaxis.tickmode='linear';layout.yaxis.dtick=1;
      if(Array.isArray(layout.shapes))layout.shapes=layout.shapes.map(shape=>{if(!shape||typeof shape!=='object'||!/^y(?:\d+)?$/.test(String(shape.yref||'y')))return shape;return {...shape,y0:absNumber(shape.y0),y1:absNumber(shape.y1)};});
      if(Array.isArray(layout.annotations))layout.annotations=layout.annotations.map(row=>{if(!row||typeof row!=='object'||!/^y(?:\d+)?$/.test(String(row.yref||'y')))return row;return {...row,y:absNumber(row.y)};});
    }
    return layout;
  }
  function displayState(el){let state=displayScaleStates.get(el);if(!state){state={axis:'y',mode:null,baseType:'linear',sourceData:[],sourceLayout:{},sourceConfig:{},handler:null,legendSoloKey:'',legendSelectedKey:'',legendBaselineVisibility:[]};displayScaleStates.set(el,state);}return state;}
  function isYAxisInteraction(el,event){
    let current=event?.target;while(current&&current!==el){const cls=typeof current.getAttribute==='function'?String(current.getAttribute('class')||''):'';if(/(^|\s)(ytick|ytitle|yaxislayer-above|yaxislayer-below|g-ytitle|dkds-d3-y-axis)(\s|$)/.test(cls)||/yaxis|y-axis/i.test(cls))return true;current=current.parentNode;}
    const rect=el?.getBoundingClientRect?.(),size=el?._fullLayout?._size;if(!rect||!size||!Number.isFinite(Number(event?.clientX))||!Number.isFinite(Number(event?.clientY)))return false;
    const x=Number(event.clientX)-rect.left,y=Number(event.clientY)-rect.top,left=Number(size.l)||0,top=Number(size.t)||0,height=Number(size.h)||0;
    return x>=0&&x<=left+12&&y>=Math.max(0,top-14)&&y<=top+height+14;
  }
  function isColorScaleInteraction(el,event){
    let current=event?.target;while(current&&current!==el){const cls=typeof current.getAttribute==='function'?String(current.getAttribute('class')||''):'';if(/(^|\s)(cbaxis|cbtitle|cbbg|cbfill|cboutline|cbline|colorbar|dkds-d3-colorbar)(\s|$)/i.test(cls)||/colorbar/i.test(cls))return true;current=current.parentNode;}
    const rect=el?.getBoundingClientRect?.(),size=el?._fullLayout?._size;if(!rect||!size||!Number.isFinite(Number(event?.clientX))||!Number.isFinite(Number(event?.clientY)))return false;
    const x=Number(event.clientX)-rect.left,y=Number(event.clientY)-rect.top,right=(Number(size.l)||0)+(Number(size.w)||0),top=Number(size.t)||0,height=Number(size.h)||0;
    return x>=right-4&&x<=rect.width&&y>=Math.max(0,top-18)&&y<=top+height+18;
  }
  function traceSeriesKey(trace,index){return String(trace?.uid??trace?.meta?.seriesId??trace?.meta?.id??trace?.id??`${trace?.name||'series'}#${index}`);}
  function baselineVisibility(state,index,trace){const value=state?.legendBaselineVisibility?.[index];if(value!==undefined)return value;return trace?.visible===false?false:(trace?.visible==='legendonly'?'legendonly':true);}
  function legendFocusedRows(state,rows){
    const solo=String(state?.legendSoloKey||'');if(!solo)return rows.map((trace,index)=>({...trace,visible:baselineVisibility(state,index,trace)}));const entries=legendEntriesFor(rows),selected=entries.find(row=>row.key===solo);if(!selected){state.legendSoloKey='';return rows.map((trace,index)=>({...trace,visible:baselineVisibility(state,index,trace)}));}const selectedIndices=new Set(selected.indices),controlled=new Set(entries.flatMap(row=>row.indices));
    return rows.map((trace,index)=>controlled.has(index)?{...trace,visible:selectedIndices.has(index)?baselineVisibility(state,index,trace):'legendonly'}:{...trace,visible:baselineVisibility(state,index,trace)});
  }
  function legendVisibilityPlan(state){
    const rows=Array.isArray(state?.sourceData)?state.sourceData:[],entries=legendEntriesFor(rows),solo=String(state?.legendSoloKey||''),selected=entries.find(row=>row.key===solo)||null;if(solo&&!selected)state.legendSoloKey='';const selectedIndices=new Set(selected?.indices||[]),controlled=[...new Set(entries.flatMap(row=>row.indices))].sort((a,b)=>a-b);
    return {indices:controlled,values:controlled.map(index=>selected?selectedIndices.has(index)?baselineVisibility(state,index,rows[index]):'legendonly':baselineVisibility(state,index,rows[index]))};
  }
  function applyPlotLegendFocus(el,state){const plan=legendVisibilityPlan(state);if(!plan.indices.length)return Promise.resolve(false);return Promise.resolve(restyle(el,{visible:plan.values},plan.indices,{internal:true})).catch(()=>false);}
  function rendererConfig(config={}){const next={...(config||{})};delete next.__dkdsNavigationTools;delete next.dkdsRenderer;delete next.renderer;return next;}
  function rendererLayout(_el,layout={}){const next=cloneLayout(layout||{});next.showlegend=false;return next;}
  function plotLegendColor(el,trace,index){const full=el?._fullData?.[index]||{},candidates=[trace?.line?.color,trace?.marker?.color,trace?.fillcolor,full?.line?.color,full?.marker?.color,full?.fillcolor];for(const value of candidates)if(typeof value==='string'&&value.trim())return value;return PLOT_SERIES_PALETTE[Math.abs(Number(index)||0)%PLOT_SERIES_PALETTE.length];}
  function ensurePlotPresentationHost(el){if(el?.classList?.add)el.classList.add('dkds-scientific-chart-host','dkds-chart-surface-host','dkds-d3-surface-host');return el;}
  function ensurePlotLegendController(el,state){
    let binding=plotLegendStates.get(el);if(binding?.controller?.host?.isConnected)return binding.controller;
    const controller=new presentation.LegendController(el,{engine:rendererFor(el)||'core',onActivate:({key,entry,event})=>{
      const current=displayScaleStates.get(el);if(!current)return;
      const restoring=current.legendSoloKey===key;
      current.legendSoloKey=restoring?'':key;
      current.legendSelectedKey=current.legendSoloKey;
      void applyPlotLegendFocus(el,current).then(()=>{
        renderPlotLegend(el,current);positionPlotNavigation(el,current);
        const detail={key,entry,indices:[...(entry?.indices||[])],curveNumber:Number(entry?.indices?.[0]??entry?.index??-1),soloKey:current.legendSoloKey,restored:restoring,originalEvent:event||null};
        try{el.dispatchEvent?.(new CustomEvent('dkds:chart-legend-activate',{detail}));}catch{}
        try{el.__dkdsChartEmitter?.emit?.('dkds_chart_legendactivate',detail);}catch{}
      });
    }});
    plotLegendStates.set(el,{controller});return controller;
  }
  function renderPlotLegend(el,state){
    if(!el)return;ensurePlotPresentationHost(el);const metrics=legendLayoutStates.get(el)||{enabled:false,placement:'none'},entries=legendEntriesFor(state?.sourceData||[],el),controller=ensurePlotLegendController(el,state);
    controller.update(entries,metrics,{soloKey:String(state?.legendSoloKey||''),selectedKey:String(state?.legendSelectedKey||'')});
  }
  function installPlotLegendSelection(el,state){
    if(!el?.addEventListener||plotLegendSelectionStates.has(el))return;
    const click=event=>{const payload=event?.detail??event,index=Number(payload?.points?.[0]?.curveNumber);if(!Number.isInteger(index)||index<0)return;const current=displayScaleStates.get(el);if(!current)return;const entry=legendEntriesFor(current.sourceData||[],el).find(row=>row.indices.includes(index));current.legendSelectedKey=entry?.key||'';renderPlotLegend(el,current);};
    const deselect=()=>{const current=displayScaleStates.get(el);if(!current||current.legendSoloKey)return;current.legendSelectedKey='';renderPlotLegend(el,current);};
    el.addEventListener('dkds_chart_click',click);el.addEventListener('dkds_chart_deselect',deselect);plotLegendSelectionStates.set(el,{click,deselect});
  }
  function uninstallPlotLegendSelection(el){const binding=plotLegendSelectionStates.get(el);if(!binding)return;try{el.removeEventListener?.('dkds_chart_click',binding.click);}catch{}try{el.removeEventListener?.('dkds_chart_deselect',binding.deselect);}catch{}plotLegendSelectionStates.delete(el);}
  function navigationStorageKey(el){const id=String(el?.id||el?.dataset?.dkdsScientificPlotId||'').trim();return id?`dkds.plot-nav.${id}`:'';}
  function setPlotNavigationPosition(el,tools,x,y,{persist=false,moved=true}={}){const host=el?.getBoundingClientRect?.(),rect=tools?.getBoundingClientRect?.();if(!host||!rect||!(host.width>0&&host.height>0&&rect.width>0&&rect.height>0))return false;const pad=5,nx=Math.max(pad,Math.min(host.width-rect.width-pad,Number(x)||pad)),ny=Math.max(pad,Math.min(host.height-rect.height-pad,Number(y)||pad));navStyleSet(tools,'left',`${Math.round(nx)}px`);navStyleSet(tools,'top',`${Math.round(ny)}px`);navStyleSet(tools,'right','auto');if(moved)tools.dataset.moved='1';else delete tools.dataset.moved;if(persist){const key=navigationStorageKey(el);if(key)try{localStorage.setItem(key,JSON.stringify({x:nx,y:ny}));}catch{}}return true;}
  function positionPlotNavigation(el,state){const nav=plotNavigationStates.get(el),tools=nav?.tools;if(!tools||tools.dataset.moved==='1')return false;const host=el.getBoundingClientRect(),tool=tools.getBoundingClientRect();if(!(host.width>0&&host.height>0&&tool.width>0&&tool.height>0))return false;const metrics=legendLayoutStates.get(el)||{},pad=6;let x=Math.max(pad,host.width-tool.width-pad),y=pad;if(metrics.enabled&&metrics.placement==='top')y=Math.min(Math.max(pad,(Number(metrics.reserve)||0)+7),Math.max(pad,host.height-tool.height-pad));else if(metrics.enabled&&metrics.placement==='right')x=Math.max(pad,host.width-tool.width-(Number(metrics.reserve)||0)-pad);setPlotNavigationPosition(el,tools,x,y,{moved:false});return true;}
  function plotZoom(el,factor){if(!el?._fullLayout)return Promise.resolve(false);const patch={};for(const key of Object.keys(el._fullLayout)){if(!/^[xy]axis\d*$/.test(key))continue;const range=el._fullLayout[key]?.range;if(!Array.isArray(range)||range.length<2||!range.every(v=>Number.isFinite(Number(v))))continue;const a=Number(range[0]),b=Number(range[1]),c=(a+b)/2,span=(b-a)*factor/2;patch[`${key}.range`]=[c-span,c+span];patch[`${key}.autorange`]=false;}return Object.keys(patch).length?Promise.resolve(relayout(el,patch)):Promise.resolve(false);}
  function plotHome(el){if(!el?._fullLayout)return Promise.resolve(false);const patch={};for(const key of Object.keys(el._fullLayout))if(/^[xy]axis\d*$/.test(key)){patch[`${key}.autorange`]=true;patch[`${key}.range`]=null;}return Object.keys(patch).length?Promise.resolve(relayout(el,patch)):Promise.resolve(false);}
  function revealPlotNavigation(nav,delay=1600){
    if(!nav?.tools)return;nav.tools.classList.add('is-touch-visible');clearTimeout(nav.hideTimer);
    nav.hideTimer=setTimeout(()=>{if(!nav?.tools?.classList.contains('is-dragging'))nav.tools?.classList.remove('is-touch-visible');},Math.max(500,Number(delay)||1600));
  }
  function removePlotNavigation(el){
    const nav=plotNavigationStates.get(el);if(!nav)return;
    clearTimeout(nav.hideTimer);if(nav.dragFrame)cancelAnimationFrame(nav.dragFrame);
    if(nav.revealHandler)try{el.removeEventListener('pointerdown',nav.revealHandler,true);}catch{}
    try{nav.touchDragCleanup?.();}catch{}
    nav.tools?.remove?.();plotNavigationStates.delete(el);
  }
  function installPlotNavigation(el,state){
    ensurePlotPresentationHost(el);
    if(!el||typeof document==='undefined'||typeof document.createElement!=='function'||typeof el.appendChild!=='function'||!el.classList?.add)return;
    let nav=plotNavigationStates.get(el);const enabled=state?.sourceConfig?.__dkdsNavigationTools!==false;
    if(!enabled){removePlotNavigation(el);return;}
    if(nav?.tools?.isConnected){requestAnimationFrame(()=>positionPlotNavigation(el,state));return;}
    el.classList.add('dkds-scientific-chart-host','dkds-chart-surface-host','dkds-d3-surface-host');
    const tools=document.createElement('div');tools.className='dkds-scientific-nav-tools dkds-chart-nav-tools dkds-integrated-action-group dkds-material-role-floating';tools.setAttribute('aria-label','图形操作');
    const drag=document.createElement('button');drag.type='button';drag.className='dkds-scientific-nav-drag';drag.dataset.dkdsComponentIdentity='toolbarAction';drag.dataset.dkdsComponentIdentityOwner='core-scientific-navigation';drag.dataset.dkdsComponentVariant='quiet';drag.dataset.dkdsComponentVariantOwner='core-scientific-navigation';drag.textContent='⋮';drag.setAttribute('aria-label','拖动工具条；双击恢复默认位置');tools.appendChild(drag);
    for(const [action,label,title] of [['zoom-in','＋','放大'],['zoom-out','−','缩小'],['home','⌂','恢复全部数据']]){
      const button=document.createElement('button');button.type='button';button.dataset.action=action;button.dataset.dkdsComponentIdentity='toolbarAction';button.dataset.dkdsComponentIdentityOwner='core-scientific-navigation';button.dataset.dkdsComponentVariant='quiet';button.dataset.dkdsComponentVariantOwner='core-scientific-navigation';button.textContent=label;button.setAttribute('aria-label',title);
      button.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();if(action==='home')void plotHome(el);else void plotZoom(el,action==='zoom-in'?.72:1.38);revealPlotNavigation(nav);});tools.appendChild(button);
    }
    el.appendChild(tools);nav={tools,drag,hideTimer:null,dragFrame:0,latest:null,revealHandler:null};plotNavigationStates.set(el,nav);
    nav.revealHandler=event=>{if(event.pointerType&&event.pointerType!=='mouse')revealPlotNavigation(nav);};el.addEventListener('pointerdown',nav.revealHandler,true);
    if(document.documentElement?.classList?.contains('react-native-client'))revealPlotNavigation(nav,1100);
    let ds=null;
    const rawPoint=event=>{const clientX=Number(event?.clientX),clientY=Number(event?.clientY);return Number.isFinite(clientX)&&Number.isFinite(clientY)?{clientX,clientY}:null;};
    const nativeClient=document.documentElement?.classList?.contains('react-native-client')===true;
    const dragPoint=event=>{
      if(!nativeClient){const rows=event.getCoalescedEvents?.(),point=rows?.length?rows[rows.length-1]:event;return rawPoint(point)||rawPoint(event);}
      const point=rawPoint(event);if(!point)return null;
      if(point.clientX<=1&&point.clientY<=1&&ds&&(ds.startClientX>12||ds.startClientY>12))return null;
      return point;
    };
    const startDrag=point=>{if(!point)return false;const r=tools.getBoundingClientRect(),host=el.getBoundingClientRect();ds={id:null,startClientX:point.clientX,startClientY:point.clientY,startX:r.left-host.left,startY:r.top-host.top};nav.latest=point;tools.classList.add('is-dragging','is-touch-visible');clearTimeout(nav.hideTimer);return true;};
    const applyDrag=()=>{nav.dragFrame=0;if(!ds||!nav.latest)return;const x=ds.startX+(nav.latest.clientX-ds.startClientX),y=ds.startY+(nav.latest.clientY-ds.startClientY);setPlotNavigationPosition(el,tools,x,y);};
    const queueDragPoint=point=>{if(!ds||!point)return;if(nativeClient&&point.clientX<=1&&point.clientY<=1&&(ds.startClientX>12||ds.startClientY>12))return;nav.latest=point;if(!nav.dragFrame)nav.dragFrame=requestAnimationFrame(applyDrag);};
    const persistDrag=()=>{const x=parseFloat(tools.style.left),y=parseFloat(tools.style.top);if(Number.isFinite(x)&&Number.isFinite(y))setPlotNavigationPosition(el,tools,x,y,{persist:true});revealPlotNavigation(nav,1200);};
    const completeDrag=point=>{if(!ds)return;if(point)nav.latest=point;if(nav.dragFrame){cancelAnimationFrame(nav.dragFrame);nav.dragFrame=0;}applyDrag();ds=null;nav.latest=null;tools.classList.remove('is-dragging');persistDrag();};
    const track=event=>{if(!ds||event.pointerId!==ds.id)return;const point=dragPoint(event);if(!point)return;if(event.cancelable)event.preventDefault();queueDragPoint(point);};
    const finish=event=>{if(!ds||event.pointerId!==ds.id)return;const point=dragPoint(event),pointerId=ds.id;completeDrag(point);try{drag.releasePointerCapture(pointerId);}catch{}};
    drag.addEventListener('pointerdown',event=>{if(event.button!==0)return;if(nativeClient&&event.pointerType==='touch')return;const point=rawPoint(event);if(!point||!startDrag(point))return;ds.id=event.pointerId;event.preventDefault();event.stopPropagation();try{drag.setPointerCapture(event.pointerId);}catch{}});
    drag.addEventListener('pointermove',track);drag.addEventListener('pointerup',finish);drag.addEventListener('pointercancel',finish);
    nav.touchDragCleanup=nativeClient?nativeTouchDrag()?.bind?.(drag,{
      onStart(point){return startDrag(point)?{}:false;},
      onMove(point){queueDragPoint(point);},
      onEnd(point){completeDrag(point);},
      onCancel(point){completeDrag(point);}
    }):null;
    drag.addEventListener('dblclick',event=>{event.preventDefault();event.stopPropagation();const key=navigationStorageKey(el);if(key)try{localStorage.removeItem(key);}catch{}for(const prop of ['left','top','right'])navStyleRemove(tools,prop);delete tools.dataset.moved;requestAnimationFrame(()=>positionPlotNavigation(el,state));revealPlotNavigation(nav);});
    drag.addEventListener('keydown',event=>{if(event.key==='Home'||event.key==='Escape'){event.preventDefault();const key=navigationStorageKey(el);if(key)try{localStorage.removeItem(key);}catch{}delete tools.dataset.moved;requestAnimationFrame(()=>positionPlotNavigation(el,state));}});
    const key=navigationStorageKey(el);if(key)try{const saved=JSON.parse(localStorage.getItem(key)||'null');if(saved)requestAnimationFrame(()=>setPlotNavigationPosition(el,tools,saved.x,saved.y));else requestAnimationFrame(()=>positionPlotNavigation(el,state));}catch{requestAnimationFrame(()=>positionPlotNavigation(el,state));}else requestAnimationFrame(()=>positionPlotNavigation(el,state));
  }
  async function renderDisplay(el,state){const mode=String(state.mode||state.baseType||'linear').toLowerCase(),axis=String(state.axis||'y'),rows=legendFocusedRows(state,(state.sourceData||[]).map(trace=>displayTrace(trace,mode,axis))),logicalLayout=displayLayout(state.sourceLayout,mode,axis),layout=rendererLayout(el,logicalLayout),config=rendererConfig(state.sourceConfig||{});ensurePlotPresentationHost(el);if(el?.dataset){el.dataset.dkdsDisplayAxis=axis;el.dataset[axis==='z'?'dkdsZScale':'dkdsYScale']=mode;}const selected=chooseRenderer(rows,state.sourceConfig||{});state.renderer=selected;const previous=rendererFor(el);if(previous&&previous!==selected)try{d3Renderer()?.purge?.(el);}catch{}const renderer=await ensureRenderer(selected);rendererStates.set(el,selected);if(el?.dataset)el.dataset.dkdsChartRenderer=selected;const result=await Promise.resolve(renderer.react(el,rows,layout,config));installPlotNavigation(el,state);installPlotLegendSelection(el,state);renderPlotLegend(el,state);await applyPlotLegendFocus(el,state);return result;}
  function installDisplayScale(el){
    if(!el)return;const state=displayState(el);if(state.handler)return;
    state.handler=event=>{const axis=String(state.axis||'y'),hit=axis==='z'?isColorScaleInteraction(el,event):isYAxisInteraction(el,event);if(!hit||!toggleableAxisType(state.baseType))return;event.preventDefault?.();event.stopPropagation?.();event.stopImmediatePropagation?.();state.mode=(String(state.mode||state.baseType).toLowerCase()==='log')?'linear':'log';Promise.resolve(renderDisplay(el,state)).then(()=>{try{el.dispatchEvent(new CustomEvent('dkds:display-scale-changed',{detail:{axis,type:state.mode}}));}catch{}}).catch(()=>{});};
    el.addEventListener?.('dblclick',state.handler,true);
  }
  function displayScaleState(target){const el=element(target)||target,state=el?displayScaleStates.get(el):null;return state?{axis:String(state.axis||'y'),type:String(state.mode||state.baseType||'linear'),baseType:String(state.baseType||'linear')}:null;}
  function adoptDisplayScale(target,data=null,layout=null,config=null){const el=element(target)||target;if(!el)return null;const state=displayState(el);state.sourceData=themeData(data||el.data||[]);ChartExport.adopt(el,state.sourceData);state.legendBaselineVisibility=state.sourceData.map(trace=>trace?.visible===false?false:(trace?.visible==='legendonly'?'legendonly':true));state.sourceLayout=themeLayout(layout||el.layout||{});state.sourceConfig=normalizeConfig(config||el._context||{});const nextAxis=displayAxisFor(state.sourceData,state.sourceLayout)||'y';if(state.axis!==nextAxis)state.mode=null;state.axis=nextAxis;state.baseType=state.axis==='z'?'linear':axisType(state.sourceLayout);if(state.mode&&!toggleableAxisType(state.baseType))state.mode=null;installDisplayScale(el);if(el?.dataset){el.dataset.dkdsDisplayAxis=state.axis;el.dataset[state.axis==='z'?'dkdsZScale':'dkdsYScale']=String(state.mode||state.baseType||'linear');}return displayScaleState(el);}
  function toggleDisplayScale(target,requestedAxis=''){const el=element(target)||target;if(!el)return Promise.resolve(false);const state=displayState(el),axis=String(requestedAxis||state.axis||'y');if(requestedAxis&&axis!==String(state.axis||'y'))return Promise.resolve(false);if(!toggleableAxisType(state.baseType))return Promise.resolve(false);state.mode=(String(state.mode||state.baseType).toLowerCase()==='log')?'linear':'log';return Promise.resolve(renderDisplay(el,state)).then(()=>{try{el.dispatchEvent(new CustomEvent('dkds:display-scale-changed',{detail:{axis,type:state.mode}}));}catch{}return state.mode;});}
  function toggleYAxisDisplay(target){return toggleDisplayScale(target,'y');}
  function react(target,data=[],layout={},config={}){const el=element(target)||target,rows=themeData(data),cfg=normalizeConfig(config);ensurePlotPresentationHost(el);if(el)legendBaseLayouts.set(el,cloneLayout(layout||{}));const smartLayout=smartLegendLayout(el,rows,layout),themedLayout=themeLayout(smartLayout),state=displayState(el);state.sourceData=rows;ChartExport.adopt(el,rows);state.legendBaselineVisibility=rows.map(trace=>trace?.visible===false?false:(trace?.visible==='legendonly'?'legendonly':true));state.sourceLayout=themedLayout;state.sourceConfig=cfg;const nextAxis=displayAxisFor(rows,themedLayout)||'y';if(state.axis!==nextAxis)state.mode=null;state.axis=nextAxis;state.baseType=state.axis==='z'?'linear':axisType(themedLayout);if(state.mode&&!toggleableAxisType(state.baseType))state.mode=null;installDisplayScale(el);return renderDisplay(el,state);}
  const sourceData=target=>ChartExport.sourceData(element(target)||target);
  function restyle(target,update,traces,_options={}){const el=element(target)||target;if(!el)return Promise.resolve(false);chooseRenderer(el.data||[],el._context||{});const out=d3Renderer()?.restyle?.(el,update,traces)??false,state=displayScaleStates.get(el);if(state&&el.data){state.sourceData=el.data;ChartExport.adopt(el,state.sourceData);}return Promise.resolve(out);}
  function selectionOverlay(target,update,traces){const el=element(target)||target;if(!el)return Promise.resolve(false);return Promise.resolve(d3Renderer()?.selectionOverlay?.(el,update,traces)??false);}
  function themePaint(target){const el=element(target)||target;if(!el)return false;return !!d3Renderer()?.themePaint?.(el);}
  function relayout(target,update){const el=element(target)||target;if(!el)return Promise.resolve(false);const out=d3Renderer()?.relayout?.(el,update)??false,state=displayScaleStates.get(el);if(state&&el.layout)state.sourceLayout=el.layout;return Promise.resolve(out);}
  function resize(target){const el=element(target);if(!el||el.offsetParent===null)return false;try{ensurePlotPresentationHost(el);const state=displayScaleStates.get(el),base=legendBaseLayouts.get(el);if(state?.sourceData?.length&&base){const previous=legendLayoutStates.get(el)||{},smart=smartLegendLayout(el,state.sourceData,base),next=themeLayout(smart),current=legendLayoutStates.get(el)||{},changed=previous.placement!==current.placement||Math.abs((previous.reserve||0)-(current.reserve||0))>2||previous.rows!==current.rows||previous.signature!==current.signature;state.sourceLayout=next;if(changed){const pending=legendResizeFrames.get(el);if(pending){const cancel=globalThis.cancelAnimationFrame||clearTimeout;try{cancel(pending);}catch{}}const raf=globalThis.requestAnimationFrame||((fn)=>setTimeout(fn,16));legendResizeFrames.set(el,raf(()=>{legendResizeFrames.delete(el);if(!el.isConnected)return;void renderDisplay(el,state).catch(()=>{});}));}else{d3Renderer()?.resize?.(el);renderPlotLegend(el,state);positionPlotNavigation(el,state);}return true;}return !!d3Renderer()?.resize?.(el);}catch{return false;}}
  function purge(target){const el=element(target);if(!el)return false;const state=displayScaleStates.get(el);if(state?.handler)try{el.removeEventListener?.('dblclick',state.handler,true);}catch{}removePlotNavigation(el);plotLegendStates.get(el)?.controller?.dispose?.();plotLegendStates.delete(el);uninstallPlotLegendSelection(el);displayScaleStates.delete(el);legendLayoutStates.delete(el);legendBaseLayouts.delete(el);const legendFrame=legendResizeFrames.get(el);if(legendFrame){const cancel=globalThis.cancelAnimationFrame||clearTimeout;try{cancel(legendFrame);}catch{}legendResizeFrames.delete(el);}rendererStates.delete(el);ChartExport.purge(el);return !!d3Renderer()?.purge?.(el);}
  function bind(owner,target,event,handler,{replace=false}={}){
    const el=element(target),name=String(event||'');if(!el||typeof handler!=='function')return()=>{};
    if(name.startsWith('dkds_chart_')&&el.addEventListener){
      let byEvent=neutralBindings.get(el);if(!byEvent){byEvent=new Map();neutralBindings.set(el,byEvent);}let rows=byEvent.get(name);if(!rows){rows=new Set();byEvent.set(name,rows);}
      if(replace){for(const row of [...rows]){try{el.removeEventListener(name,row);}catch{}rows.delete(row);}}
      const wrapper=eventObject=>handler(eventObject?.detail??eventObject);rows.add(wrapper);el.addEventListener(name,wrapper);
      return track(owner,()=>{try{el.removeEventListener(name,wrapper);}catch{}rows.delete(wrapper);if(!rows.size)byEvent.delete(name);});
    }
    if(typeof el.on!=='function')return()=>{};if(replace){try{el.removeAllListeners?.(name);}catch{}}el.on(name,handler);return track(owner,()=>{try{el.removeListener?.(name,handler);}catch{}});
  }
  const toImage=(target,options)=>ChartExport.toImage(target,options);
  const saveImage=(target,baseName,format)=>ChartExport.saveImage(target,baseName,format);
  function d3Symbol(name='circle'){
    const d3=window.d3;if(!d3)return null;
    const map={circle:d3.symbolCircle,diamond:d3.symbolDiamond,triangle:d3.symbolTriangle,square:d3.symbolSquare,cross:d3.symbolCross,star:d3.symbolStar,'triangle-down':d3.symbolTriangle,kite:d3.symbolDiamond,hexagon:d3.symbolCircle};
    return map[String(name||'').toLowerCase()]||d3.symbolCircle;
  }
  function symbolPath(name='circle',size=105){const d3=window.d3;const type=d3Symbol(name);return d3?.symbol&&type?d3.symbol().type(type).size(Number(size)||105)():'';}

  function selectLegendForTrace(target,index){const el=element(target)||target,state=el?displayScaleStates.get(el):null;if(!el||!state)return false;const entry=legendEntriesFor(state.sourceData||[],el).find(row=>row.indices.includes(Number(index)));state.legendSelectedKey=entry?.key||'';renderPlotLegend(el,state);return !!entry;}
  function clearLegendSelection(target){const el=element(target)||target,state=el?displayScaleStates.get(el):null;if(!state)return false;state.legendSelectedKey='';renderPlotLegend(el,state);return true;}
  function setLegendVisibility(target,indices=[]){const el=element(target)||target,state=el?displayScaleStates.get(el):null;if(!el||!state)return Promise.resolve(false);const wanted=new Set((indices||[]).map(Number).filter(Number.isInteger)),entry=wanted.size?legendEntriesFor(state.sourceData||[],el).find(row=>[...wanted].every(i=>row.indices.includes(i))):null;if(wanted.size&&!entry)return Promise.resolve(false);state.legendSoloKey=entry?.key||'';state.legendSelectedKey=state.legendSoloKey;return applyPlotLegendFocus(el,state).then(()=>{renderPlotLegend(el,state);return true;}).catch(()=>false);}
  function createScope(owner){
    const id=String(owner||'plugin');
    return Object.freeze({
      version:VERSION,owner:id,element,runtimeState,rendererFor,
      react,restyle,selectionOverlay,themePaint,relayout,resize,purge,toImage,saveImage,sourceData,themeLayout,themeData,normalizeConfig,legendMetrics,selectLegendForTrace,clearLegendSelection,setLegendVisibility,displayScaleState,adoptDisplayScale,toggleDisplayScale,toggleYAxisDisplay,get tooltipTheme(){return currentTooltipTheme();},
      bind:(target,event,handler,options)=>bind(id,target,event,handler,options),
      symbols:Object.freeze({type:d3Symbol,path:symbolPath}),
      raw:Object.freeze({get d3(){return window.d3;}})
    });
  }
  function refreshRenderedTheme(){if(typeof document==='undefined')return;document.querySelectorAll('[data-dkds-chart-renderer="d3"]').forEach(el=>{try{themePaint(el);const state=displayScaleStates.get(el);if(state){renderPlotLegend(el,state);positionPlotNavigation(el,state);}}catch{}});}
  const ThemeRuntime=globalThis.DKDSTheme;if(!ThemeRuntime?.subscribeRevision)throw new Error('Scientific Chart Runtime requires selective Theme revision support.');ThemeRuntime.subscribeRevision('core.scientific-chart',refreshRenderedTheme,{consumer:'computed-style'});
  function disposeOwner(owner){const id=String(owner||'');for(const off of [...(ownerBindings.get(id)||[])])try{off();}catch{}ownerBindings.delete(id);}
  window.DKDSCharts=Object.freeze({VERSION,configureRuntime,runtimeState,rendererFor,createScope,disposeOwner,element,react,restyle,selectionOverlay,themePaint,relayout,resize,purge,bind,toImage,saveImage,sourceData,themeLayout,themeData,normalizeConfig,legendMetrics,selectLegendForTrace,clearLegendSelection,setLegendVisibility,displayScaleState,adoptDisplayScale,toggleDisplayScale,toggleYAxisDisplay,get tooltipTheme(){return currentTooltipTheme();},symbols:Object.freeze({type:d3Symbol,path:symbolPath})});
})();
