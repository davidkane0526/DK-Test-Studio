#!/usr/bin/env node
'use strict';
const {createIdentityController}=require('../src/controller/identity.cjs');
const HELP=[
  'DK Test Studio — independent read-only Keithley 4200A identity checker',
  'Usage: node cli/identify.cjs --identify --host 169.254.111.118 --port 1225',
  '--identify                 explicitly enable read-only *IDN? identification',
  '--modules                  also query read-only KXCI *OPT? slot inventory',
  '--host IP_OR_HOSTNAME      instrument host (default 169.254.111.118)',
  '--port NUMBER              default 1225',
  '--mode auto|ethernet|wifi|interface',
  '--interface NAME           adapter name for interface mode',
  '--local-ip IP              optional source IPv4',
  '--serial SERIAL            exact serial (use "" to disable check)',
  '--timeout-ms NUMBER        250..30000 (default 5000)',
  '--help                     no instrument connection'
].join('\n');
function parseArgs(args){
  const map={'--host':'host','--port':'port','--mode':'networkMode','--interface':'interfaceName','--local-ip':'localAddress','--serial':'expectedSerial','--timeout-ms':'timeoutMs'};
  const options={};let identify=false,modules=false,help=false;
  for(let i=0;i<args.length;i++){
    const flag=args[i];
    if(flag==='--help'||flag==='-h'){help=true;continue;}
    if(flag==='--identify'){identify=true;continue;}
    if(flag==='--modules'){modules=true;continue;}
    if(!Object.hasOwn(map,flag))throw Error('未知参数 '+flag);
    const value=args[++i];if(value===undefined||value.startsWith('--'))throw Error('缺少 '+flag+' 的参数值');
    if(Object.hasOwn(options,map[flag]))throw Error('重复参数 '+flag);
    options[map[flag]]=value;
  }
  return {options,identify,modules,help};
}
async function main(args=process.argv.slice(2)){
  const parsed=parseArgs(args);
  if(parsed.help||!parsed.identify){process.stdout.write(HELP+'\n');return;}
  const ctl=createIdentityController();
  try{
    const result=await ctl.connect(parsed.options);
    process.stdout.write('Verified: '+result.identity.raw+'\n');
    process.stdout.write('Network: '+result.route.localAddress+' -> '+result.route.remoteAddress+':'+result.route.remotePort+'\n');
    if(parsed.modules){
      const info=await ctl.inspectModules();
      if(info.inventory)process.stdout.write('Modules: '+info.inventory.raw+'\n');
      else process.stdout.write('Module discovery unavailable: '+String(info.inventoryError||info.summary)+'\n');
    }
  }finally{await ctl.dispose();}
}
if(require.main===module)main().catch(error=>{process.stderr.write('识别失败：'+String(error.message||error)+'\n');process.exitCode=1;});
module.exports={main,parseArgs};
