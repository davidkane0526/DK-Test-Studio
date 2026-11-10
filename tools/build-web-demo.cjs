#!/usr/bin/env node
'use strict';
/* Build a static, instrument-disconnected preview from the actual DKTS web UI. */
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
function buildWebDemo(out=path.join(root,'dist','web-ui-demo')){
  const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
  const web=path.join(root,'web');
  const vendor=path.join(web,'vendor');
  if(!fs.existsSync(path.join(vendor,'d3.min.js')))
    throw Error('Pinned D3 vendor missing. Run npm install and node tools/prepare-dkds-plot-vendor.cjs');
  fs.rmSync(out,{recursive:true,force:true});
  fs.mkdirSync(out,{recursive:true});
  fs.cpSync(vendor,path.join(out,'vendor'),{recursive:true});
  for(const file of ['app.js','styles.css'])
    fs.copyFileSync(path.join(web,file),path.join(out,file));
  const adapter=fs.readFileSync(path.join(web,'demo-adapter.js'),'utf8')
    .replace('__DKTS_PACKAGE_VERSION__',pkg.version);
  fs.writeFileSync(path.join(out,'demo-adapter.js'),adapter);
  fs.copyFileSync(path.join(web,'demo.css'),path.join(out,'demo.css'));
  const source=fs.readFileSync(path.join(web,'index.html'),'utf8');
  const html=source
    .replace(/(src|href)="\/(styles\.css|app\.js|vendor\/[^"]+)"/g,'$1="./$2"')
    .replace('<script src="./app.js" defer></script>',
      '<script src="./demo-adapter.js" defer></script>\n<script src="./app.js" defer></script>')
    .replace('</head>','<link rel="stylesheet" href="./demo.css">\n</head>')
    .replace('<body>','<body data-dkts-demo="true"><div id="dkts-demo-banner" role="status">UI DEMO · OFFLINE</div>');
  if(!html.includes('src="./demo-adapter.js"')||html.includes('src="/app.js"')||
    html.includes('href="/styles.css"'))throw Error('Demo must load the safe adapter and relative assets');
  fs.writeFileSync(path.join(out,'index.html'),html);
  fs.writeFileSync(path.join(out,'.nojekyll'),'');
  return {out,version:pkg.version};
}
if(require.main===module){
  const result=buildWebDemo();
  process.stdout.write('Static DKTS UI demo ready: '+result.out+' · V'+result.version+'\n');
}
module.exports={buildWebDemo};