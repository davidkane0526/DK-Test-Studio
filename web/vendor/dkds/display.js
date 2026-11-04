(() => {
  if (window.DKDSScientificDisplay) return;
  const VERSION='1.0.0';
  const analysisCache=new WeakMap();
  const finite=value=>value!==null&&value!==undefined&&!(typeof value==='string'&&!value.trim())&&Number.isFinite(Number(value));
  const numeric=value=>finite(value)?Number(value):NaN;
  const stableSeriesId=trace=>{const value=trace?.seriesId??trace?.meta?.seriesId??trace?.columnId??trace?.meta?.columnId;return value===null||value===undefined||String(value).trim()===''?'':String(value);};
  const seriesKey=(trace,index=0)=>String(stableSeriesId(trace)||(trace?.uid??trace?.meta?.id??trace?.id??`${trace?.name||'series'}#${index}`));
  const sourceRowId=(trace,index)=>{const i=Math.max(0,Math.trunc(Number(index)||0));for(const rows of [trace?.rowIds,trace?.meta?.rowIds])if(Array.isArray(rows)&&rows[i]!==undefined&&rows[i]!==null&&String(rows[i]).trim()!=='')return String(rows[i]);for(const resolver of [trace?.rowIdAt,trace?.meta?.rowIdAt])if(typeof resolver==='function'){try{const value=resolver(i,trace);if(value!==undefined&&value!==null&&String(value).trim()!=='')return String(value);}catch{}}const custom=Array.isArray(trace?.customdata)?trace.customdata[i]:null;for(const value of [custom?.rowId,custom?.sourceRowId])if(value!==undefined&&value!==null&&String(value).trim()!=='')return String(value);const artifactId=trace?.artifactId??trace?.meta?.artifactId;if(artifactId!==undefined&&artifactId!==null&&String(artifactId).trim()!=='')return `row:${i}`;return '';};
  const displayBudget=(pixelWidth,trace={})=>{
    const explicit=Number(trace?.meta?.displayPointBudget??trace?.displayPointBudget);
    if(Number.isFinite(explicit)&&explicit>=64)return Math.max(64,Math.min(16384,Math.trunc(explicit)));
    const width=Math.max(120,Number(pixelWidth)||640);
    return Math.max(384,Math.min(8192,Math.ceil(width*3)));
  };
  function explicitSegmentSource(trace){
    for(const value of [trace?.scanSegment,trace?.segment,trace?.meta?.scanSegment,trace?.meta?.segmentIds,trace?.meta?.scanSegments])if(Array.isArray(value))return value;
    return null;
  }
  function analyzeTrace(trace={}){
    const segmentSource=explicitSegmentSource(trace),cached=trace&&typeof trace==='object'?analysisCache.get(trace):null;if(cached&&cached.x===trace.x&&cached.y===trace.y&&cached.segmentSource===segmentSource)return cached.result;
    const xs=Array.isArray(trace?.x)?trace.x:[],ys=Array.isArray(trace?.y)?trace.y:[],n=Math.min(xs.length,ys.length),segments=[];let runStart=-1,previous=-1,previousX=NaN,direction=0,segmentToken='',gapBefore=false,xMin=Infinity,xMax=-Infinity,yMin=Infinity,yMax=-Infinity,xPositiveMin=Infinity,xPositiveMax=-Infinity,yPositiveMin=Infinity,yPositiveMax=-Infinity;
    const close=end=>{if(runStart<0||end<runStart)return;const firstX=numeric(xs[runStart]),lastX=numeric(xs[end]);segments.push({start:runStart,end,direction:direction||Math.sign(lastX-firstX)||0,gapBefore});runStart=-1;previous=-1;previousX=NaN;direction=0;segmentToken='';gapBefore=false;};
    for(let i=0;i<n;i++){
      const x=numeric(xs[i]),validX=Number.isFinite(x),validY=finite(ys[i]);
      if(validX){xMin=Math.min(xMin,x);xMax=Math.max(xMax,x);const ax=Math.abs(x);if(ax>0){xPositiveMin=Math.min(xPositiveMin,ax);xPositiveMax=Math.max(xPositiveMax,ax);}}
      if(validY){const y=Number(ys[i]);yMin=Math.min(yMin,y);yMax=Math.max(yMax,y);const ay=Math.abs(y);if(ay>0){yPositiveMin=Math.min(yPositiveMin,ay);yPositiveMax=Math.max(yPositiveMax,ay);}}
      if(!validX||!validY){if(runStart>=0)close(previous);gapBefore=true;continue;}
      const token=segmentSource?String(segmentSource[i]??''):'';
      if(runStart<0){runStart=i;previous=i;previousX=x;segmentToken=token;continue;}
      if(segmentSource&&token!==segmentToken){close(previous);runStart=i;previous=i;previousX=x;segmentToken=token;continue;}
      const step=Math.sign(x-previousX);
      if(step&&direction&&step!==direction){const turn=previous;close(turn);runStart=turn;previous=i;previousX=x;direction=step;segmentToken=token;continue;}
      if(step&&!direction)direction=step;
      previous=i;previousX=x;
    }
    if(runStart>=0)close(previous);
    if(!segmentSource&&segments.length>Math.max(32,Math.ceil(Math.sqrt(Math.max(1,n))/8))){segments.length=0;let start=-1,gap=false;for(let i=0;i<n;i++){const valid=finite(xs[i])&&finite(ys[i]);if(valid&&start<0)start=i;if(!valid&&start>=0){segments.push({start,end:i-1,direction:0,gapBefore:gap,nonMonotonic:true});start=-1;gap=true;}}if(start>=0)segments.push({start,end:n-1,direction:0,gapBefore:gap,nonMonotonic:true});}
    const result=Object.freeze({n,segments:Object.freeze(segments.map(row=>Object.freeze(row))),xExtent:Object.freeze(Number.isFinite(xMin)?[xMin,xMax]:[]),yExtent:Object.freeze(Number.isFinite(yMin)?[yMin,yMax]:[]),xPositiveExtent:Object.freeze(Number.isFinite(xPositiveMin)?[xPositiveMin,xPositiveMax]:[]),yPositiveExtent:Object.freeze(Number.isFinite(yPositiveMin)?[yPositiveMin,yPositiveMax]:[])});
    if(trace&&typeof trace==='object')analysisCache.set(trace,{x:trace.x,y:trace.y,segmentSource,result});return result;
  }
  function lowerBoundAscending(xs,start,end,value){let lo=start,hi=end+1;while(lo<hi){const mid=(lo+hi)>>1;if(Number(xs[mid])<value)lo=mid+1;else hi=mid;}return lo;}
  function upperBoundAscending(xs,start,end,value){let lo=start,hi=end+1;while(lo<hi){const mid=(lo+hi)>>1;if(Number(xs[mid])<=value)lo=mid+1;else hi=mid;}return lo-1;}
  function lowerBoundDescending(xs,start,end,value){let lo=start,hi=end+1;while(lo<hi){const mid=(lo+hi)>>1;if(Number(xs[mid])>value)lo=mid+1;else hi=mid;}return lo;}
  function upperBoundDescending(xs,start,end,value){let lo=start,hi=end+1;while(lo<hi){const mid=(lo+hi)>>1;if(Number(xs[mid])>=value)lo=mid+1;else hi=mid;}return lo-1;}
  function viewportSlice(xs,segment,range){
    if(segment?.nonMonotonic)return [segment.start,segment.end];
    if(!Array.isArray(range)||range.length<2||!range.every(finite))return [segment.start,segment.end];
    const lo=Math.min(Number(range[0]),Number(range[1])),hi=Math.max(Number(range[0]),Number(range[1]));
    if(segment.direction<0){let a=lowerBoundDescending(xs,segment.start,segment.end,hi),b=upperBoundDescending(xs,segment.start,segment.end,lo);if(a>segment.end||b<segment.start||a>b)return null;a=Math.max(segment.start,a-1);b=Math.min(segment.end,b+1);return[a,b];}
    if(segment.direction>0){let a=lowerBoundAscending(xs,segment.start,segment.end,lo),b=upperBoundAscending(xs,segment.start,segment.end,hi);if(a>segment.end||b<segment.start||a>b)return null;a=Math.max(segment.start,a-1);b=Math.min(segment.end,b+1);return[a,b];}
    const x=Number(xs[segment.start]);return x>=lo&&x<=hi?[segment.start,segment.end]:null;
  }
  function sampledIndices(ys,start,end,budget){
    const count=end-start+1;if(count<=Math.max(4,budget))return Array.from({length:count},(_,i)=>start+i);
    const maxPoints=Math.max(4,Math.trunc(budget)),bucketCount=Math.max(1,Math.floor((maxPoints-2)/2)),span=Math.max(1,end-start-1),out=[start];
    for(let bucket=0;bucket<bucketCount;bucket++){
      const a=Math.max(start+1,Math.floor(start+1+(span*bucket)/bucketCount)),b=Math.min(end-1,Math.ceil(start+1+(span*(bucket+1))/bucketCount)-1);if(b<a)continue;
      let minIndex=a,maxIndex=a,minValue=Number(ys[a]),maxValue=minValue;
      for(let i=a+1;i<=b;i++){const value=Number(ys[i]);if(value<minValue){minValue=value;minIndex=i;}if(value>maxValue){maxValue=value;maxIndex=i;}}
      if(minIndex<=maxIndex){out.push(minIndex);if(maxIndex!==minIndex)out.push(maxIndex);}else{out.push(maxIndex,minIndex);}
    }
    out.push(end);return [...new Set(out)].sort((a,b)=>a-b);
  }
  function normalizeViewportRange(layout={}){
    const axis=layout?.xaxis||{},range=Array.isArray(axis.range)?axis.range:null;if(!range||range.length<2||!range.every(finite))return null;
    if(String(axis.type||'linear').toLowerCase()==='log')return range.map(value=>Math.pow(10,Number(value)));
    if(String(axis.type||'linear').toLowerCase()==='category')return null;
    return range.map(Number);
  }
  function sampleTrace(trace={},options={}){
    const xs=Array.isArray(trace?.x)?trace.x:[],ys=Array.isArray(trace?.y)?trace.y:[],analysis=analyzeTrace(trace),range=options.xRange??normalizeViewportRange(options.layout||{}),budget=displayBudget(options.pixelWidth,trace),visible=[];
    for(const segment of analysis.segments){const slice=viewportSlice(xs,segment,range);if(slice)visible.push({segment,start:slice[0],end:slice[1]});}
    const totalVisible=visible.reduce((sum,row)=>sum+row.end-row.start+1,0),points=[];let displayed=0;
    for(let s=0;s<visible.length;s++){
      const row=visible[s],share=Math.max(4,Math.round(budget*((row.end-row.start+1)/Math.max(1,totalVisible)))),indices=sampledIndices(ys,row.start,row.end,share);
      if(points.length&&row.segment.gapBefore){const prior=points.at(-1);points.push({x:prior?.x??xs[row.start],y:NaN,i:Math.max(0,row.start-1),rowId:sourceRowId(trace,Math.max(0,row.start-1)),valid:false,gap:true});}
      for(const i of indices){const next={x:xs[i],y:Number(ys[i]),i,rowId:sourceRowId(trace,i),valid:true,gap:false};if(points.at(-1)?.valid&&points.at(-1)?.i===i)continue;points.push(next);displayed+=1;}
    }
    return {points,rawCount:analysis.n,visibleCount:totalVisible,displayCount:displayed,segmentCount:analysis.segments.length,budget,range:range?range.slice():null};
  }

  function axisSummary(traces=[],coordinate='x'){
    const key=String(coordinate||'x').toLowerCase()==='y'?'y':'x',extentKey=key==='y'?'yExtent':'xExtent',positiveKey=key==='y'?'yPositiveExtent':'xPositiveExtent';let lo=Infinity,hi=-Infinity,plo=Infinity,phi=-Infinity,count=0;
    for(const trace of traces||[]){const analysis=analyzeTrace(trace),extent=analysis?.[extentKey]||[],positive=analysis?.[positiveKey]||[];if(extent.length>=2){lo=Math.min(lo,Number(extent[0]));hi=Math.max(hi,Number(extent[1]));count+=Number(analysis?.n)||0;}if(positive.length>=2){plo=Math.min(plo,Number(positive[0]));phi=Math.max(phi,Number(positive[1]));}}
    return Object.freeze({__dkdsAxisSummary:true,extent:Object.freeze(Number.isFinite(lo)?[lo,hi]:[]),positiveExtent:Object.freeze(Number.isFinite(plo)?[plo,phi]:[]),count});
  }
  function clearAnalysis(trace){if(trace&&typeof trace==='object')analysisCache.delete(trace);}
  window.DKDSScientificDisplay=Object.freeze({VERSION,stableSeriesId,seriesKey,sourceRowId,displayBudget,analyzeTrace,axisSummary,sampleTrace,normalizeViewportRange,clearAnalysis});
})();
