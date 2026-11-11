/* Android native bridge adapter. Reuses the same page/plot implementation as Windows.
 * Never exposes arbitrary KXCI commands or a network socket to JavaScript.
 */
(() => {
  'use strict';
  const native=window.DKTSReadOnlyNative;
  if(!native||typeof native.request!=='function')return;
  const jobs=new Map();
  let nextId=0;
  function send(op,payload={}){
    if(!['connect','disconnect','status'].includes(op))
      return Promise.reject(new Error('Android operation not allowed'));
    const id=++nextId;
    if(jobs.size>4)return Promise.reject(new Error('Too many pending Android bridge requests'));
    return new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{jobs.delete(id);reject(new Error('Android bridge timeout'))},45000);
      jobs.set(id,{resolve,reject,timer});
      try{native.request(JSON.stringify({id,op,payload}));}
      catch(err){clearTimeout(timer);jobs.delete(id);reject(err);}
    });
  }
  window.DK4200AndroidReceive=serialized=>{
    let response;
    try{response=JSON.parse(serialized)}catch{return;}
    const id=Number(response?.id),job=jobs.get(id);
    if(!job)return;
    jobs.delete(id);clearTimeout(job.timer);
    if(response.ok!==true){job.reject(new Error(String(response.error||'Android bridge failure').slice(0,300)));return;}
    job.resolve(response.value||{});
  };
  async function connect(opts={}){
    const result=await send('connect',opts);
    if(result.verifiedIdentity!==true||result.connected!==true)
      throw new Error('Android bridge did not verify the 4200A identity');
    const parsed=window.DK4200OptionInventory?.parseOptReply?.(result.options||'');
    if(!parsed)throw new Error('Hardware module parser is not available');
    return {...result,inventory:parsed,executionAuthorized:false};
  }
  window.DK4200Native=Object.freeze({
    connect,
    disconnect:()=>send('disconnect'),
    status:()=>send('status')
  });
})();
