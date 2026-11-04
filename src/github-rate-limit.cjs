'use strict';
// Process-wide rate-limit gate for the anonymous public GitHub REST API.
// Both the native portable updater and UI updater share this single gate.
let blockedUntil=0;
function header(headers,name){
  return typeof headers?.get==='function'
    ?headers.get(name)
    :headers?.[name]??headers?.[name.toLowerCase()]??null;
}
function positiveMilliseconds(headers,now){
  const retry=header(headers,'retry-after');
  const retrySeconds=Number(retry);
  if(retry!==null&&retry!==''&&Number.isFinite(retrySeconds)&&retrySeconds>0)
    return Math.ceil(retrySeconds*1000);
  if(retry){
    const date=Date.parse(retry);
    if(Number.isFinite(date)&&date>now)return date-now;
  }
  if(String(header(headers,'x-ratelimit-remaining'))==='0'){
    const reset=Number(header(headers,'x-ratelimit-reset'));
    if(Number.isFinite(reset)&&reset>now/1000)return Math.ceil(reset*1000-now);
  }
  return 5*60*1000; // secondary limit, access restriction, or proxy 403
}
function onHttpError(status,headers={},now=Date.now()){
  const code=Number(status);
  if(code!==403&&code!==429)return 'GitHub HTTP '+status;
  const wait=Math.max(60*1000,Math.min(2*60*60*1000,positiveMilliseconds(headers,now)));
  blockedUntil=Math.max(blockedUntil,now+wait);
  const remaining=String(header(headers,'x-ratelimit-remaining')??'');
  const limit=remaining==='0'||code===429||Boolean(header(headers,'retry-after'));
  return (limit?'GitHub API 请求限额已触发':'GitHub HTTP '+status+'（权限或网络访问受限）')+
    '，暂停检查至 '+new Date(blockedUntil).toLocaleTimeString('zh-CN',{hour12:false});
}
function assertAllowed(now=Date.now()){
  if(now<blockedUntil)throw Error('GitHub API 暂停请求中，请在 '+
    new Date(blockedUntil).toLocaleTimeString('zh-CN',{hour12:false})+' 后重试');
}
function state(){return Object.freeze({blockedUntil});}
module.exports={onHttpError,assertAllowed,state};
