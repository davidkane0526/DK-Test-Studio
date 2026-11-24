'use strict';
function exact(s,a,b){if(s.split(a).length!==2)throw Error("Pinned source anchor absent or repeated: "+a.slice(0,100));return s.replace(a,()=>b);}
function patchDesktopKxci(source){
 let s=source.replace(/\r\n?/g,'\n');
 const patch=(a,b)=>{s=exact(s,a,b);};
 patch("    const noReply=payload.noReply===true;","    const noReply=payload.noReply===true;\n    const framed=payload.responseTerminator==='nul';\n    if(framed&&(noReply||write.length===0||write[write.length-1]!==0||write.indexOf(0)!==write.length-1))throw Error('KXCI exchange requires one NUL-terminated request and a response.');");
 patch("        chunks.push(data);total+=data.length;armIdle();",`        chunks.push(data);total+=data.length;
        if(framed){
          const end=data.indexOf(0);
          if(end>=0){
            if(end!==data.length-1)return finishError(new Error('KXCI received extra bytes after the response terminator; session closed.'));
            return finishOk();
          }
          return; // Wait for the complete protocol frame, not TCP idle.
        }
        armIdle();`);
 patch("      const onClose=()=>{if(total>0)finishOk();else finishError(new Error('TCP session closed before a response was received.'));};","      const onClose=()=>{if(!framed&&total>0)finishOk();else finishError(new Error('TCP session closed before a complete response was received.'));};");
 patch("          if(total>0)return finishOk();","          if(!framed&&total>0)return finishOk();");
 return s;
}
function patchAndroidKxci(source){
 let s=source.replace(/\r\n?/g,'\n');
 const patch=(a,b)=>{s=exact(s,a,b);};
 patch('      val noReply=p.optBoolean("noReply",false)',`      val noReply=p.optBoolean("noReply",false)
      val framed=p.optString("responseTerminator","")=="nul"
      if(framed && (noReply || bytes.isEmpty() || bytes.last()!=0.toByte() || bytes.indexOf(0.toByte())!=bytes.lastIndex))
        throw IllegalArgumentException("KXCI exchange requires one NUL-terminated request and a response.")`);
 patch("      row.socket.soTimeout=readTimeout\n      while(output.size()<maxBytes){\n        try{",`      row.socket.soTimeout=readTimeout
      val deadline=System.nanoTime()+readTimeout.toLong()*1000000L
      var frameComplete=false
      while(output.size()<maxBytes){
        try{
          if(framed){
            val remaining=deadline-System.nanoTime()
            if(remaining<=0L)throw SocketTimeoutException("KXCI frame deadline expired")
            row.socket.soTimeout=((remaining+999999L)/1000000L).coerceIn(1L,readTimeout.toLong()).toInt()
          }`);
 patch("          output.write(buffer,0,count)\n          row.socket.soTimeout=idleTimeout",`          output.write(buffer,0,count)
          if(framed){
            val end=(0 until count).firstOrNull{buffer[it]==0.toByte()}
            if(end!=null){
              if(end!=count-1)throw IllegalStateException("KXCI received extra bytes after the response terminator.")
              frameComplete=true
              break
            }
          }else row.socket.soTimeout=idleTimeout`);
 patch('          if(output.size()==0)throw IllegalStateException("TCP read timed out before any response; session closed to prevent stale replies.",error)','          if(framed || output.size()==0)throw IllegalStateException("TCP read timed out before a complete response; session closed to prevent stale replies.",error)');
 patch('      if(output.size()>=maxBytes)throw IllegalStateException("TCP response reached the configured byte limit. Session closed.")','      if(framed && !frameComplete)throw IllegalStateException("KXCI response is missing its NUL terminator.")\n      if(output.size()>=maxBytes && !frameComplete)throw IllegalStateException("TCP response reached the configured byte limit. Session closed.")');
 return s;
}
module.exports={patchDesktopKxci,patchAndroidKxci};
