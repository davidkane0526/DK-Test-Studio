(() => {
  if (window.DKDSScientificHeatmapSelection) return;

  const StyleGate=globalThis.DKDSStyleGate;
  if(!StyleGate)throw new Error('DKDSStyleGate must initialize before Scientific Heatmap Selection Overlay.');
  const STYLE_OWNER='core.scientific-heatmap-selection-overlay';
  const STYLE_SOURCE='src/core/scientific/heatmap-selection-overlay-runtime.js';
  const DEFAULT_COLORS=Object.freeze(['#2563eb','#0f9f9a','#dc2626','#f97316','#6d28d9','#db2777','#16a34a','#ca8a04','#0891b2','#7c3aed']);
  const defaultColors=()=>{const themed=window.DKDSTheme?.scientific?.()?.seriesPalette;return Array.isArray(themed)&&themed.length>=2?themed:DEFAULT_COLORS;};
  function selectionPaint(selection,attribute,value,component='scientific-heatmap-selection'){
    selection?.each?.(function(d,i,nodes){
      const next=typeof value==='function'?value.call(this,d,i,nodes):value;
      if(next===null||next===undefined||next==='')StyleGate.removePaint(this,attribute,{owner:STYLE_OWNER,component,scope:'scientific-render',source:STYLE_SOURCE});
      else StyleGate.setPaint(this,attribute,next,{owner:STYLE_OWNER,component,scope:'scientific-render',source:STYLE_SOURCE});
    });
    return selection;
  }
  function selectionPresentation(selection,attribute,value,component='scientific-heatmap-selection'){
    selection?.each?.(function(d,i,nodes){
      const next=typeof value==='function'?value.call(this,d,i,nodes):value;
      if(next===null||next===undefined||next==='')StyleGate.removePresentation(this,attribute,{owner:STYLE_OWNER,component,scope:'scientific-render',source:STYLE_SOURCE});
      else StyleGate.setPresentation(this,attribute,next,{owner:STYLE_OWNER,component,scope:'scientific-render',source:STYLE_SOURCE});
    });
    return selection;
  }
  function eventPoint(state,trace,xi,yi,event){
    const x=trace?.x?.[xi],y=trace?.y?.[yi],z=trace?.z?.[yi]?.[xi],pointNumber=yi*(trace?.x?.length||0)+xi;
    const customdata=Array.isArray(trace?.customdata?.[yi])?trace.customdata[yi][xi]:undefined;
    return {curveNumber:state?.data?.indexOf?.(trace)??-1,pointNumber,xIndex:xi,yIndex:yi,x,y,z,customdata,data:trace,fullData:trace,event};
  }
  function mount(state){
    const svg=state?.svg;if(!svg?.append)return false;
    svg.append('g').attr('class','dkds-d3-heatmap-selection-layer').call(selectionPresentation,'pointer-events','none');
    return true;
  }
  function apply(state,index,patch){
    const geometry=state?.heatmapGeometry,layer=state?.svg?.select?.('.dkds-d3-heatmap-selection-layer');
    if(!geometry||geometry.traceIndex!==Number(index)||!layer||layer.empty?.())return false;
    const rows=Array.isArray(patch?.['heatmap.rows'])?patch['heatmap.rows'].map(Number).filter(Number.isInteger):[];
    const unique=[...new Set(rows)].filter(row=>row>=0&&row<geometry.yBands.length);
    const bands=unique.map(row=>geometry.yBands[row]).filter(Boolean),stroke=defaultColors()[0];
    layer.selectAll('rect.dkds-d3-heatmap-selection').data(bands,row=>String(row.index)).join(
      enter=>enter.append('rect').attr('class','dkds-d3-heatmap-selection'),
      update=>update,
      exit=>exit.remove()
    ).attr('x',state.margin.l+1).attr('y',row=>Math.min(row.lo,row.hi)+1).attr('width',Math.max(0,state.innerW-2)).attr('height',row=>Math.max(0,Math.abs(row.hi-row.lo)-2)).call(selectionPaint,'fill','none').call(selectionPaint,'stroke',stroke).call(selectionPaint,'stroke-width',2).call(selectionPaint,'opacity',.96);
    return true;
  }
  function repaint(state){
    const selection=state?.svg?.selectAll?.('.dkds-d3-heatmap-selection');
    if(!selection)return false;
    selection.call(selectionPaint,'stroke',defaultColors()[0]);
    return true;
  }

  window.DKDSScientificHeatmapSelection=Object.freeze({VERSION:'1.0.0',eventPoint,mount,apply,repaint});
})();
