(() => {
  if(window.DKDSChartExport)return;
  const snapshots=new WeakMap();
  const element=value=>{
    if(value?.nodeType===1)return value;
    if(typeof value==='string')return document.getElementById(value)||document.querySelector(value);
    return null;
  };
  const cloneArray=value=>{
    if(Array.isArray(value))return value.map(item=>(Array.isArray(item)||(typeof ArrayBuffer!=='undefined'&&ArrayBuffer.isView?.(item)))?cloneArray(item):item);
    if(typeof ArrayBuffer!=='undefined'&&ArrayBuffer.isView?.(value))return Array.from(value);
    return [];
  };
  const cloneTrace=trace=>Object.freeze({
    name:String(trace?.name||''),
    type:String(trace?.type||'scatter'),
    x:cloneArray(trace?.x),
    y:cloneArray(trace?.y),
    z:cloneArray(trace?.z)
  });
  function adopt(target,data=[]){
    const el=element(target)||target;if(!el)return false;
    snapshots.set(el,(Array.isArray(data)?data:[]).map(cloneTrace));
    return true;
  }
  function sourceData(target){
    const el=element(target)||target;if(!el)return [];
    const rows=snapshots.get(el)||(Array.isArray(el.data)?el.data.map(cloneTrace):[]);
    return rows.map(cloneTrace);
  }
  function purge(target){const el=element(target)||target;return el?snapshots.delete(el):false;}
  async function toImage(target,{format='png',width,height,scale=2}={}){
    const el=element(target)||target;if(!el)throw new Error('Plot target not found.');
    const renderer=window.DKDSD3Renderer;if(!renderer?.toImage)throw new Error('D3 scientific renderer unavailable.');
    return renderer.toImage(el,{format,width,height,scale});
  }
  async function saveImage(target,baseName='plot',format='png'){
    if(typeof window.DKDSIO?.saveBase64!=='function'&&typeof window.DKDSIO?.saveText!=='function')throw new Error('Core I/O runtime unavailable.');
    const type=String(format||'png').toLowerCase();
    if(type==='svg'){
      const uri=await toImage(target,{format:'svg',scale:1});
      const content=decodeURIComponent(String(uri).split(',').slice(1).join(','));
      return window.DKDSIO.saveText({defaultName:`${baseName}.svg`,content,filters:[{name:'SVG',extensions:['svg']}],source:'core.scientific-chart.image.svg'});
    }
    const uri=await toImage(target,{format:'png',scale:2});
    return window.DKDSIO.saveBase64({defaultName:`${baseName}.png`,base64:String(uri).split(',')[1]||'',mimeType:'image/png',filters:[{name:'PNG',extensions:['png']}],source:'core.scientific-chart.image.png'});
  }
  window.DKDSChartExport=Object.freeze({adopt,sourceData,purge,toImage,saveImage});
})();
