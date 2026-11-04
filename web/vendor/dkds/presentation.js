(() => {
  if (window.DKDSPlotPresentation) return;

  const VERSION='1.1.0';
  const StyleGate=globalThis.DKDSStyleGate;
  if(!StyleGate)throw new Error('DKDSStyleGate must initialize before plot presentation runtime.');
  const STYLE_OWNER='core.plot-presentation';
  const STYLE_SOURCE='src/core/scientific/plot-presentation-runtime.js';
  const styleSet=(el,prop,value,component='plot-presentation')=>StyleGate.set(el,prop,value,{owner:STYLE_OWNER,component,kind:'runtime-inline',source:STYLE_SOURCE});
  const styleRemove=(el,prop,component='plot-presentation')=>StyleGate.remove(el,prop,{owner:STYLE_OWNER,component,kind:'runtime-inline',source:STYLE_SOURCE});
  const DEFAULTS=Object.freeze({
    maxRows:2,
    rowHeight:20,
    rowGap:2,
    edgePadding:6,
    itemGap:4,
    minItemWidth:34,
    maxItemWidth:146,
    minSideWidth:112,
    maxSideFraction:.30,
    minPlotWidth:220
  });

  const clamp=(value,min,max)=>Math.max(min,Math.min(max,Number(value)||0));
  const cleanEntries=entries=>(Array.isArray(entries)?entries:[]).map((entry,index)=>({
    ...entry,
    key:String(entry?.key??entry?.id??`series-${index+1}`),
    label:String(entry?.label??entry?.name??entry?.key??entry?.id??`Series ${index+1}`),
    color:String(entry?.color||''),
    index:Number.isFinite(Number(entry?.index))?Number(entry.index):index
  })).filter(entry=>entry.key&&entry.label);

  function labelWidth(value='',options={}){
    const min=Math.max(24,Number(options.minItemWidth)||DEFAULTS.minItemWidth),max=Math.max(min,Number(options.maxItemWidth)||DEFAULTS.maxItemWidth);
    let width=25;
    for(const ch of String(value||''))width+=/[\u2E80-\u9FFF\uF900-\uFAFF]/.test(ch)?9.6:5.75;
    return clamp(width,min,max);
  }

  function packedRowCount(entries=[],available=640,options={}){
    const rows=cleanEntries(entries),gap=Math.max(0,Number(options.itemGap)||DEFAULTS.itemGap),width=Math.max(80,Number(available)||640);
    if(!rows.length)return 0;
    let count=1,used=0;
    for(const entry of rows){
      const w=Math.min(width,labelWidth(entry.label,options));
      if(used>0&&used+gap+w>width){count+=1;used=w;}else used+=(used?gap:0)+w;
    }
    return count;
  }

  function splitRows(entries=[],available=640,rowCount=1,options={}){
    const rows=cleanEntries(entries),count=Math.max(1,Math.min(Math.max(1,Number(rowCount)||1),rows.length||1));
    if(!rows.length)return [];
    if(count===1)return [rows];
    const widths=rows.map(row=>labelWidth(row.label,options)),prefix=[0];
    for(const width of widths)prefix.push(prefix.at(-1)+width);
    const gap=Math.max(0,Number(options.itemGap)||DEFAULTS.itemGap);
    if(count===2){
      let best=1,bestCost=Infinity;
      for(let i=1;i<rows.length;i++){
        const left=(prefix[i]-prefix[0])+Math.max(0,i-1)*gap;
        const right=(prefix[rows.length]-prefix[i])+Math.max(0,rows.length-i-1)*gap;
        const overflow=Math.max(0,left-available)+Math.max(0,right-available);
        const cost=overflow*5+Math.max(left,right)+Math.abs(left-right)*.12;
        if(cost<bestCost){best=i;bestCost=cost;}
      }
      return [rows.slice(0,best),rows.slice(best)];
    }
    const out=[];let start=0;
    for(let line=0;line<count;line++){
      const remaining=rows.length-start,remainingLines=count-line,take=Math.max(1,Math.ceil(remaining/remainingLines));
      out.push(rows.slice(start,start+take));start+=take;
    }
    return out.filter(Boolean);
  }

  function solveLegend(input={}){
    const options={...DEFAULTS,...(input.options||{})},entries=cleanEntries(input.entries),count=entries.length;
    const width=Math.max(120,Number(input.width)||640),height=Math.max(100,Number(input.height)||360),margin={top:0,right:0,bottom:0,left:0,...(input.margin||{})};
    const requested=String(input.placement||'auto').toLowerCase(),maxRows=Math.max(1,Math.min(2,Number(input.maxRows)||options.maxRows));
    const previous=input.previous&&typeof input.previous==='object'?input.previous:null;
    const signature=entries.map(entry=>entry.key).join('|');
    if(input.enabled===false)return {enabled:false,placement:'none',count,rows:0,rawRows:count?1:0,width:0,height:0,reserve:0,overflow:false,entries,rowGroups:count?[entries]:[],signature,reason:'disabled'};
    if(count<2){
      const keepSlot=input.stabilize!==false&&previous&&Number(previous.reserve)>0&&Number(previous.count)>=2&&['top','bottom','right','left'].includes(String(previous.placement||''));
      return keepSlot
        ? {enabled:false,placement:String(previous.placement),count,rows:Number(previous.rows)||1,rawRows:count?1:0,width:Number(previous.width)||0,height:Number(previous.height)||0,reserve:Number(previous.reserve)||0,overflow:false,entries,rowGroups:count?[entries]:[],signature,stableSlot:true,reason:'stable-single-series-slot'}
        : {enabled:false,placement:'none',count,rows:0,rawRows:count?1:0,width:0,height:0,reserve:0,overflow:false,entries,rowGroups:count?[entries]:[],signature,reason:'single-series'};
    }

    // HTML legends live in the surface chrome, not inside the data rectangle. Use
    // the full surface width instead of subtracting axis margins. This is the key
    // difference between presentation geometry and plotting geometry.
    const availableW=Math.max(96,width-options.edgePadding*2);
    const rawRows=packedRowCount(entries,availableW,options);
    let rows=Math.min(maxRows,Math.max(1,rawRows));
    if(previous&&previous.signature===signature&&['top','bottom'].includes(String(previous.placement||''))&&Math.abs((Number(previous.containerWidth)||width)-width)<24){
      rows=Math.max(1,Math.min(maxRows,Number(previous.rows)||rows));
    }
    const maxEntry=Math.max(72,...entries.map(entry=>labelWidth(entry.label,options)));
    const sideWidth=Math.min(Math.max(maxEntry+12,options.minSideWidth),Math.max(options.minSideWidth,width*options.maxSideFraction));
    const sideFits=width-sideWidth-Math.max(0,margin.left)-Math.max(0,margin.right)>=options.minPlotWidth;
    let placement=['top','bottom','right','left'].includes(requested)?requested:'top';
    if(requested==='auto'){
      if(rawRows<=maxRows)placement='top';
      else if(sideFits&&width>=620)placement='right';
      else placement='top';
    }
    const horizontal=placement==='top'||placement==='bottom';
    const rowGroups=horizontal?splitRows(entries,availableW,rows,options):entries.map(entry=>[entry]);
    const reserve=horizontal?(rows*options.rowHeight+Math.max(0,rows-1)*options.rowGap+options.edgePadding):sideWidth+options.edgePadding;
    return {
      enabled:true,placement,count,rows:horizontal?rows:count,rawRows,width:horizontal?availableW:sideWidth,
      height:horizontal?reserve:Math.min(Math.max(72,height-margin.top-margin.bottom),count*(options.rowHeight+2)+options.edgePadding),reserve,
      overflow:horizontal&&rawRows>maxRows,entries,rowGroups,availableW,containerWidth:width,containerHeight:height,signature,
      reason:requested==='auto'?'core-presentation-solver':'requested-placement'
    };
  }

  function applyHostPlacement(host,metrics={}){
    if(!host)return;
    host.classList.remove('hidden','is-top','is-bottom','is-right','is-left','is-overflowing');
    if(!metrics.enabled){host.classList.add('hidden');return;}
    host.classList.add(`is-${metrics.placement}`);host.classList.toggle('is-overflowing',!!metrics.overflow);
    for(const name of ['left','right','top','bottom','width','max-height'])styleRemove(host,name,'scientific-legend');
    if(metrics.placement==='right'||metrics.placement==='left'){
      styleSet(host,metrics.placement,'6px','scientific-legend');styleSet(host,'top','6px','scientific-legend');styleSet(host,'width',`${Math.max(96,(Number(metrics.width)||112)-10)}px`,'scientific-legend');styleSet(host,'max-height',`${Math.max(64,Number(metrics.height)||64)}px`,'scientific-legend');
    }else{
      styleSet(host,'left','6px','scientific-legend');styleSet(host,'right','6px','scientific-legend');styleSet(host,metrics.placement,'3px','scientific-legend');
    }
  }

  class LegendController {
    constructor(container,spec={}){
      this.container=container;this.spec={engine:'core',ariaLabel:'图例',...spec};this.host=null;this.entries=[];this.metrics={enabled:false,placement:'none'};this.state={soloKey:'',selectedKey:''};this.structureSignature='';this.buttonMap=new Map();this.ensure();
    }
    ensure(){
      if(this.host?.isConnected)return this.host;
      if(!this.container||typeof document==='undefined')return null;
      const host=document.createElement('div');host.className='dkds-plot-legend dkds-scientific-auto-legend hidden';host.dataset.dkdsLegend='auto';host.dataset.dkdsLegendEngine=String(this.spec.engine||'core');host.setAttribute('aria-label',String(this.spec.ariaLabel||'图例'));
      host.addEventListener('click',event=>{
        const button=event.target?.closest?.('button[data-legend-key]');if(!button||!host.contains(button)||button.disabled)return;
        event.preventDefault();event.stopPropagation();const key=String(button.dataset.legendKey||'');if(!key)return;
        try{this.spec.onActivate?.({key,entry:this.entries.find(row=>row.key===key)||null,event,controller:this});}catch(err){console.warn('[DKDS LegendController]',err);}
      });
      this.container.appendChild(host);this.host=host;return host;
    }
    update(entries=[],metrics={},state={}){
      const host=this.ensure();if(!host)return null;if(!(this.buttonMap instanceof Map))this.buttonMap=new Map();this.entries=cleanEntries(entries);this.metrics={...metrics};this.state={soloKey:String(state.soloKey||''),selectedKey:String(state.selectedKey||'')};
      if(!metrics?.enabled||this.entries.length<2){host.classList.add('hidden');host.replaceChildren();this.structureSignature='';this.buttonMap.clear();return host;}
      applyHostPlacement(host,metrics);styleSet(host,'--dkds-legend-rows',String(Math.max(1,Number(metrics.rows)||1)),'scientific-legend');
      const groups=(metrics.placement==='top'||metrics.placement==='bottom')?(Array.isArray(metrics.rowGroups)&&metrics.rowGroups.length?metrics.rowGroups:splitRows(this.entries,Number(metrics.width)||640,Math.max(1,Number(metrics.rows)||1))):this.entries.map(row=>[row]);
      const byKey=new Map(this.entries.map(entry=>[entry.key,entry])),activeKey=document.activeElement?.closest?.('button[data-legend-key]')?.dataset?.legendKey||'';
      const nextKeys=new Set(this.entries.map(entry=>entry.key));for(const key of [...this.buttonMap.keys()])if(!nextKeys.has(key))this.buttonMap.delete(key);
      const fragment=document.createDocumentFragment();
      for(const group of groups){
        const line=document.createElement('div');line.className='dkds-plot-legend-row';
        for(const entry of group){
          let button=this.buttonMap.get(entry.key);
          if(!button){button=document.createElement('button');button.type='button';button.className='dkds-plot-legend-item';button.dataset.legendKey=entry.key;const swatch=document.createElement('span');swatch.className='dkds-plot-legend-swatch';const label=document.createElement('span');label.className='dkds-plot-legend-label';button.append(swatch,label);this.buttonMap.set(entry.key,button);}
          line.appendChild(button);
        }
        fragment.appendChild(line);
      }
      // Row wrappers may change as the solver responds to width, but legend buttons
      // are stable nodes keyed by semantic series/group identity. Reparenting them
      // preserves focus, pointer identity and double-toggle semantics without letting
      // layout recalculation invalidate an in-progress legend interaction.
      host.replaceChildren(fragment);this.structureSignature=[String(metrics.placement||'none'),...groups.map(group=>group.map(entry=>entry.key).join('\u001e'))].join('\u001d');
      const solo=this.state.soloKey,selected=this.state.selectedKey;
      for(const [key,button] of this.buttonMap){
        const entry=byKey.get(key);if(!entry)continue;const active=!solo||solo===key;
        button.classList.toggle('is-muted',!active);button.classList.toggle('is-selected',selected===key||solo===key);button.classList.toggle('is-solo',solo===key);button.setAttribute('aria-pressed',String(solo?solo===key:selected===key));button.dataset.dkdsTooltip=solo===key?'再次点击恢复全部曲线':`只显示 ${entry.label}`;
        const swatch=button.querySelector('.dkds-plot-legend-swatch');if(swatch)styleSet(swatch,'background',entry.color||'currentColor','scientific-legend-swatch');const label=button.querySelector('.dkds-plot-legend-label');if(label&&label.textContent!==entry.label)label.textContent=entry.label;
      }
      if(activeKey&&this.buttonMap.has(activeKey)&&document.activeElement!==this.buttonMap.get(activeKey))queueMicrotask(()=>this.buttonMap.get(activeKey)?.focus?.({preventScroll:true}));
      return host;
    }
    hide(){if(this.host){this.host.classList.add('hidden');this.host.replaceChildren();this.structureSignature='';this.buttonMap?.clear?.();}}
    dispose(){this.host?.remove?.();this.host=null;this.entries=[];this.structureSignature='';this.buttonMap?.clear?.();}
  }

  window.DKDSPlotPresentation=Object.freeze({VERSION,DEFAULTS,labelWidth,packedRowCount,splitRows,solveLegend,applyHostPlacement,LegendController});
})();
