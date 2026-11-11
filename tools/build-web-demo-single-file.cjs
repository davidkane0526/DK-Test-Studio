#!/usr/bin/env node
'use strict';
/* Self-contained, safe, offline HTML export of the exact DKTS web UI demo. */
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
function buildSingleHtml(source=path.join(root,'dist','web-ui-demo'),
  output=path.join(root,'dist','DKTS-Web-UI-Demo.html')){
  const htmlPath=path.join(source,'index.html');
  let html=fs.readFileSync(htmlPath,'utf8');
  const scripts=[];
  const safeText=file=>{
    const target=path.resolve(source,file);
    if(!target.startsWith(source+path.sep))throw Error('Unsafe demo path: '+file);
    return fs.readFileSync(target,'utf8');
  };
  html=html.replace(/<link rel="stylesheet" href="\.\/([^"]+)">/g,(_,file)=>
    '<style data-src="'+file+'">\n'+safeText(file)+'\n</style>');
  html=html.replace(/<script src="\.\/([^"]+)" defer><\/script>/g,(_,file)=>{
    const js=safeText(file).replace(/<\/script/gi,'<\\/script');
    scripts.push('<script data-src="'+file+'">\n'+js+'\n</script>');
    return '';
  });
  if(scripts.length<10||/<(?:script|link)\b[^>]*(?:src|href)="\.\//i.test(html))
    throw Error('Standalone demo must embed every local JavaScript and CSS dependency');
  html=html.replace('</body>',scripts.join('\n')+'\n</body>');
  html=html.replace('<title>DK Test Studio | Keithley 4200A</title>',
    '<title>DK Test Studio | Web UI Demo (Offline)</title>');
  fs.mkdirSync(path.dirname(output),{recursive:true});
  fs.writeFileSync(output,html,'utf8');
  return {output,bytes:Buffer.byteLength(html),scripts:scripts.length};
}
if(require.main===module){
  const result=buildSingleHtml();
  console.log('Standalone HTML UI demo: '+result.output+' ('+result.bytes+' bytes)');
}
module.exports={buildSingleHtml};