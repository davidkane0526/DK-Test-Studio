/* KXCI TCP command/response wire framing (4200A KCon String Terminator).
 * A frame uses ASCII bytes and the NUL terminator, never newline substitution.
 * Decoding preserves raw response bytes before string interpretation.
 */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.DK4200KXCIWire=api;
})(typeof globalThis!=='undefined'?globalThis:undefined,function(){
 'use strict';
 const VERSION='0.1.0',MAX_REPLY_BYTES=4*1024*1024;
 const safeCommand=value=>typeof value==='string'&&value.length>=2&&value.length<=4096&&
  /^[\x20-\x7E]+$/.test(value)&&!/[\x00\r\n]/.test(value);
 function encode(command){
  if(!safeCommand(command))throw new TypeError('Invalid KXCI ASCII command');
  const bytes=new Uint8Array(command.length+1);
  for(let i=0;i<command.length;i++)bytes[i]=command.charCodeAt(i);
  bytes[command.length]=0;
  return bytes;
 }
 function createDecoder({maxBytes=MAX_REPLY_BYTES}={}){
  if(!Number.isSafeInteger(maxBytes)||maxBytes<=0||maxBytes>MAX_REPLY_BYTES)throw new RangeError('Invalid reply byte limit');
  let parts=[],total=0;
  function push(chunk){
   const bytes=chunk instanceof Uint8Array?chunk:new Uint8Array(chunk);
   const ready=[];
   let start=0;
   for(let i=0;i<bytes.length;i++){
    if(bytes[i]!==0&&bytes[i]!==10)continue;
    const end=bytes[i]===10&&i>start&&bytes[i-1]===13?i-1:i;
    if(end>start){const part=bytes.subarray(start,end);parts.push(part.slice());total+=part.length;}
    if(total>maxBytes)throw new RangeError('KXCI response exceeds byte limit');
    const payload=new Uint8Array(total);let offset=0;
    for(const p of parts){payload.set(p,offset);offset+=p.length;}
    if(payload.length&&!(payload.length===1&&payload[0]===13))ready.push(Object.freeze({bytes:payload,text:new TextDecoder('utf-8',{fatal:true}).decode(payload)}));
    parts=[];total=0;start=i+1;
   }
   if(start<bytes.length){const part=bytes.subarray(start);parts.push(part.slice());total+=part.length;}
   if(total>maxBytes)throw new RangeError('KXCI response exceeds byte limit');
   return ready;
  }
  function reset(){parts=[];total=0;}
  return Object.freeze({push,reset,pendingBytes:()=>total});
 }
 return Object.freeze({VERSION,MAX_REPLY_BYTES,safeCommand,encode,createDecoder});
});
