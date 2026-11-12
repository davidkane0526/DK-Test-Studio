'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'../integrations/dkds-native');
test('DKTS Core mobile drawer uses SDK Units, scoped stylesheet, and close interactions',()=>{
 let shellModule;
 const nodes=[];
 function el(){
  const attrs={},events={};
  const node={attrs,events,setAttribute:(k,v)=>attrs[k]=v,
   addEventListener:(k,cb)=>events[k]=cb,
   removeEventListener:(k,cb)=>{if(events[k]===cb)delete events[k]},
   remove:()=>{node.removed=true}};
  nodes.push(node);return node;
 }
 const host=el(),nav=el();const layouts=[],actions=[];
 const units={layout:{create:(parent,spec)=>{
  layouts.push(spec.variant);return el();
 }},action:{create:(parent,spec)=>{
  actions.push(spec);return {element:el()};
 }}};
 const sandbox={window:{DKDSPluginModules:{define:(id,name,api)=>{
  assert.equal(id,'com.dkts.keithley-4200');assert.equal(name,'uiShell');shellModule=api;
 }}}};
 vm.runInNewContext(fs.readFileSync(path.join(root,'ui-shell.js'),'utf8'),sandbox);
 assert(shellModule&&typeof shellModule.attach==='function');
 const drawer=shellModule.attach(units,host,nav);
 assert(layouts.includes('identity'),'scrim must be a DKDS Unit layout');
 assert.equal(host.attrs['data-dkts-shell'],'true');
 assert.equal(nav.attrs['data-dkts-nav'],'true');
 assert.equal(host.attrs['data-dkts-nav-open'],'false');
 const scrim=nodes.find(n=>n.attrs['data-dkts-nav-scrim']==='true');
 assert(scrim,'SDK-owned scrim exists');
 drawer.toggle();assert.equal(host.attrs['data-dkts-nav-open'],'true');
 scrim.events.click();assert.equal(host.attrs['data-dkts-nav-open'],'false');
 drawer.setOpen(true);host.events.keydown({key:'Escape'});
 assert.equal(host.attrs['data-dkts-nav-open'],'false');
 drawer.dispose();assert.equal(scrim.removed,true);
 assert.equal(host.events.keydown,undefined);
 const manifest=JSON.parse(fs.readFileSync(path.join(root,'plugin.json'),'utf8'));
 assert.deepEqual(manifest.styles,['ui-shell.css']);
 const css=fs.readFileSync(path.join(root,'ui-shell.css'),'utf8');
 assert(css.includes('#dktsKeithley4200Page [data-dkts-shell]'));
 assert(css.includes('grid-template-columns:252px minmax(0,1fr)'));
 assert(css.includes('max-width:900px'));
 assert(css.includes('data-dkts-nav-toggle'));
 assert(css.includes('data-dkts-plot-group'));
 assert(!css.includes('height:calc(100dvh'),'viewport/status bar remains DKDS-owned');
});
