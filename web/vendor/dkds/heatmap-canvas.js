(() => {
  if (window.DKDSScientificHeatmapCanvas) return;

  const VERSION='1.0.0';
  const states=new WeakMap();
  const matrixAnalysis=new WeakMap();
  const finite=value=>value!==null&&value!==undefined&&!(typeof value==='string'&&!value.trim())&&Number.isFinite(Number(value));
  const clampDpr=value=>Math.max(1,Math.min(2,Number(value)||1));

  function analyzeMatrix(z=[]){
    if(z&&typeof z==='object'&&matrixAnalysis.has(z))return matrixAnalysis.get(z);
    const rows=Array.isArray(z)?z:[];let zMin=Infinity,zMax=-Infinity,finiteCells=0,totalCells=0,maxColumns=0;
    for(const row of rows){if(!Array.isArray(row))continue;maxColumns=Math.max(maxColumns,row.length);totalCells+=row.length;for(const raw of row){if(!finite(raw))continue;const value=Number(raw);zMin=Math.min(zMin,value);zMax=Math.max(zMax,value);finiteCells++;}}
    const result=Object.freeze({rows:rows.length,columns:maxColumns,totalCells,finiteCells,zExtent:Object.freeze(Number.isFinite(zMin)?[zMin,zMax]:[])});
    if(z&&typeof z==='object')matrixAnalysis.set(z,result);return result;
  }

  function normalizedDomain(z=[],zminValue,zmaxValue){
    const analysis=analyzeMatrix(z),extent=analysis.zExtent.length>=2?analysis.zExtent:[0,1];let lo=finite(zminValue)?Number(zminValue):extent[0],hi=finite(zmaxValue)?Number(zmaxValue):extent[1];
    if(!Number.isFinite(lo)||!Number.isFinite(hi)){lo=extent[0];hi=extent[1];}
    if(lo>hi)[lo,hi]=[hi,lo];
    if(lo===hi){const pad=Math.abs(lo||1)*.05||1;lo-=pad;hi+=pad;}
    return Object.freeze([lo,hi]);
  }

  function ensureCanvas(host){
    let canvas=host?.querySelector?.(':scope > canvas.dkds-scientific-heatmap-canvas')||null;
    if(canvas)return canvas;
    if(!host?.appendChild||typeof document==='undefined')throw new Error('Heatmap Canvas host is unavailable.');
    canvas=document.createElement('canvas');canvas.className='dkds-scientific-heatmap-canvas';canvas.setAttribute('aria-hidden','true');host.appendChild(canvas);return canvas;
  }

  function normalizeBands(rows=[]){
    const out=[];for(const row of rows||[]){const lo=Math.min(Number(row?.lo),Number(row?.hi)),hi=Math.max(Number(row?.lo),Number(row?.hi)),index=Number(row?.index);if(!Number.isFinite(lo)||!Number.isFinite(hi)||!Number.isInteger(index)||hi<lo)continue;out.push(Object.freeze({lo,hi,index}));}
    return Object.freeze(out);
  }
  function sortedBands(rows=[]){return Object.freeze([...rows].sort((a,b)=>a.lo-b.lo||a.hi-b.hi||a.index-b.index));}
  function bandAt(rows,value){
    const point=Number(value);if(!Number.isFinite(point)||!rows?.length)return null;let lo=0,hi=rows.length-1,best=-1;
    while(lo<=hi){const mid=(lo+hi)>>1,row=rows[mid];if(point<row.lo)hi=mid-1;else{best=mid;lo=mid+1;}}
    if(best<0)return null;for(let i=best;i>=0&&rows[i].hi>=point;i--)if(point>=rows[i].lo&&point<=rows[i].hi)return rows[i];return null;
  }

  function parseColor(value){
    const text=String(value||'').trim().toLowerCase();let match;
    if((match=text.match(/^#([0-9a-f]{3,8})$/i))){const hex=match[1];if(hex.length===3||hex.length===4){const parts=[...hex].map(ch=>parseInt(ch+ch,16));return [parts[0],parts[1],parts[2],hex.length===4?parts[3]:255];}if(hex.length===6||hex.length===8)return [parseInt(hex.slice(0,2),16),parseInt(hex.slice(2,4),16),parseInt(hex.slice(4,6),16),hex.length===8?parseInt(hex.slice(6,8),16):255];}
    if((match=text.match(/^rgba?\(\s*([-+\d.]+)\s*[, ]\s*([-+\d.]+)\s*[, ]\s*([-+\d.]+)(?:\s*[,/]\s*([-+\d.]+%?))?\s*\)$/i))){const alpha=match[4]===undefined?1:(String(match[4]).endsWith('%')?Number(match[4].slice(0,-1))/100:Number(match[4]));return [Math.max(0,Math.min(255,Math.round(Number(match[1])))),Math.max(0,Math.min(255,Math.round(Number(match[2])))),Math.max(0,Math.min(255,Math.round(Number(match[3])))),Math.max(0,Math.min(255,Math.round((Number.isFinite(alpha)?alpha:1)*255)))];}
    return null;
  }

  function regularBands(bands=[]){
    if(!bands.length)return null;const sorted=[...bands].sort((a,b)=>a.lo-b.lo||a.hi-b.hi||a.index-b.index),widths=sorted.map(row=>Math.abs(row.hi-row.lo));if(widths.some(value=>!Number.isFinite(value)||value<=0))return null;const mean=widths.reduce((sum,value)=>sum+value,0)/widths.length,tolerance=Math.max(.04,Math.abs(mean)*.03);
    if(widths.some(value=>Math.abs(value-mean)>tolerance))return null;for(let i=1;i<sorted.length;i++)if(Math.abs(sorted[i].lo-sorted[i-1].hi)>Math.max(.5,tolerance*2))return null;
    const indices=new Set(sorted.map(row=>row.index));if(indices.size!==sorted.length)return null;return {sorted,lo:sorted[0].lo,hi:sorted.at(-1).hi};
  }

  function rasterOrderKey(xPlan,yPlan){return `${xPlan.sorted.map(row=>row.index).join(',')}|${yPlan.sorted.map(row=>row.index).join(',')}`;}
  function drawRaster(state,ctx,xPlan,yPlan){if(!state.rasterCanvas||typeof ctx.drawImage!=='function')return false;ctx.drawImage(state.rasterCanvas,xPlan.lo,yPlan.lo,Math.max(.5,xPlan.hi-xPlan.lo),Math.max(.5,yPlan.hi-yPlan.lo));return true;}
  function rasterPaint(state,ctx){
    const xPlan=regularBands(state.xBands),yPlan=regularBands(state.yBands);if(!xPlan||!yPlan||typeof document==='undefined'||typeof document.createElement!=='function')return null;
    const columns=xPlan.sorted.length,rows=yPlan.sorted.length;if(!columns||!rows||columns*rows>4_000_000)return null;const orderKey=rasterOrderKey(xPlan,yPlan);
    if(state.rasterValid&&state.rasterOrderKey===orderKey&&state.rasterCanvas?.width===columns&&state.rasterCanvas?.height===rows&&drawRaster(state,ctx,xPlan,yPlan))return {painted:state.rasterPaintedCells||0,reused:true};
    let scratch=state.rasterCanvas;if(!scratch){scratch=document.createElement('canvas');state.rasterCanvas=scratch;}scratch.width=columns;scratch.height=rows;const rasterCtx=scratch.getContext?.('2d');if(!rasterCtx||typeof rasterCtx.createImageData!=='function'||typeof rasterCtx.putImageData!=='function'||typeof ctx.drawImage!=='function')return null;
    const image=rasterCtx.createImageData(columns,rows),pixels=image.data,colorCache=new Map();let painted=0,offset=0;
    for(const yBand of yPlan.sorted){const row=state.z?.[yBand.index];for(const xBand of xPlan.sorted){const raw=row?.[xBand.index];if(!finite(raw)){offset+=4;continue;}const css=String(state.color(Number(raw))||''),cached=colorCache.get(css),rgba=cached||parseColor(css);if(!rgba)return null;if(!cached)colorCache.set(css,rgba);pixels[offset++]=rgba[0];pixels[offset++]=rgba[1];pixels[offset++]=rgba[2];pixels[offset++]=rgba[3];painted++;}}
    rasterCtx.putImageData(image,0,0);state.rasterValid=true;state.rasterOrderKey=orderKey;state.rasterPaintedCells=painted;drawRaster(state,ctx,xPlan,yPlan);return {painted,reused:false};
  }

  function paintState(state){
    const {canvas,width,height,dpr,plot,z,xBands,yBands,color,background}=state,ctx=canvas.getContext?.('2d');if(!ctx)throw new Error('2D Canvas context unavailable.');
    const pixelWidth=Math.max(1,Math.ceil(width*dpr)),pixelHeight=Math.max(1,Math.ceil(height*dpr));if(canvas.width!==pixelWidth)canvas.width=pixelWidth;if(canvas.height!==pixelHeight)canvas.height=pixelHeight;
    ctx.setTransform?.(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,width,height);ctx.imageSmoothingEnabled=false;
    if(background){ctx.fillStyle=background;ctx.fillRect(plot.x,plot.y,plot.width,plot.height);}
    const raster=rasterPaint(state,ctx);let painted=raster?.painted??null,mode=raster?(raster.reused?'imageData-reuse':'imageData'):'fillRect';
    if(painted===null){mode='fillRect';painted=0;for(const yBand of yBands){const row=z?.[yBand.index];if(!Array.isArray(row))continue;const y=Math.min(yBand.lo,yBand.hi),h=Math.max(.5,Math.abs(yBand.hi-yBand.lo)+.35);for(const xBand of xBands){const raw=row?.[xBand.index];if(!finite(raw))continue;ctx.fillStyle=color(Number(raw));ctx.fillRect(Math.min(xBand.lo,xBand.hi),y,Math.max(.5,Math.abs(xBand.hi-xBand.lo)+.35),h);painted++;}}}
    state.paintMode=mode;state.paintCount=(Number(state.paintCount)||0)+1;state.paintedCells=painted;state.analysis=analyzeMatrix(z);return state;
  }

  function render(host,spec={}){
    if(!host)throw new Error('Heatmap Canvas host is required.');const previous=states.get(host)||null,canvas=ensureCanvas(host),width=Math.max(1,Number(spec.width)||1),height=Math.max(1,Number(spec.height)||1),plot={x:Number(spec?.plot?.x)||0,y:Number(spec?.plot?.y)||0,width:Math.max(0,Number(spec?.plot?.width)||0),height:Math.max(0,Number(spec?.plot?.height)||0)},z=Array.isArray(spec.z)?spec.z:[],colorKey=String(spec.colorKey||''),xBands=normalizeBands(spec.xBands),yBands=normalizeBands(spec.yBands),dpr=clampDpr(spec.dpr??globalThis.devicePixelRatio),reuse=!!(previous&&previous.z===z&&colorKey&&previous.colorKey===colorKey),state={host,canvas,width,height,dpr,plot,z,colorKey,xBands,yBands,hitX:sortedBands(xBands),hitY:sortedBands(yBands),color:typeof spec.color==='function'?spec.color:()=>String(spec.color||'#000'),background:String(spec.background||''),paintCount:Number(previous?.paintCount)||0,paintedCells:0,analysis:null,rasterCanvas:reuse?previous.rasterCanvas:null,rasterValid:reuse&&!!previous.rasterValid,rasterOrderKey:reuse?previous.rasterOrderKey:'',rasterPaintedCells:reuse?previous.rasterPaintedCells:0};
    states.set(host,state);paintState(state);return snapshot(host);
  }

  function repaint(host,patch={}){const state=states.get(host);if(!state)return false;if(typeof patch.color==='function'){state.color=patch.color;state.rasterValid=false;}if(Object.prototype.hasOwnProperty.call(patch,'background'))state.background=String(patch.background||'');paintState(state);return true;}
  function hitTest(host,x,y){const state=states.get(host);if(!state)return null;const xb=bandAt(state.hitX,x),yb=bandAt(state.hitY,y);if(!xb||!yb)return null;const value=state.z?.[yb.index]?.[xb.index];return {xi:xb.index,yi:yb.index,value:finite(value)?Number(value):value,finite:finite(value)};}
  function dataURL(host){const state=states.get(host);if(!state?.canvas?.toDataURL)return '';try{return String(state.canvas.toDataURL('image/png')||'');}catch{return '';}}
  function snapshot(host){const state=states.get(host);if(!state)return null;return Object.freeze({renderer:'canvas2d',width:state.width,height:state.height,dpr:state.dpr,rows:state.analysis?.rows||0,columns:state.analysis?.columns||0,totalCells:state.analysis?.totalCells||0,finiteCells:state.analysis?.finiteCells||0,paintedCells:state.paintedCells,paintCount:state.paintCount,paintMode:state.paintMode||'fillRect',canvasCount:1,svgCellCount:0});}
  function exportLayer(host){const state=states.get(host),href=dataURL(host);return state&&href?Object.freeze({href,width:state.width,height:state.height}):null;}
  function purge(host){const state=states.get(host);if(!state)return false;state.canvas?.remove?.();states.delete(host);return true;}
  function clearAnalysis(z){if(z&&typeof z==='object')matrixAnalysis.delete(z);}

  window.DKDSScientificHeatmapCanvas=Object.freeze({VERSION,analyzeMatrix,normalizedDomain,render,repaint,hitTest,dataURL,exportLayer,snapshot,purge,clearAnalysis});
})();
