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
 const plugin=fs.readFileSync(path.join(root,'plugin.js'),'utf8');
 assert.match(plugin,/variant:'identity',className:'dkts-main-grid'/);
 assert.match(css,/grid-template-columns:270px minmax\(0,1fr\)/);
 const priorityRules=[...css.matchAll(/#[^{]+\{[^{}]*!important[^{}]*\}/g)].map(x=>x[0]);
 assert(priorityRules.length>=3,'explicit overrides are required for Core inline display attributes');
 assert(priorityRules.every(rule=>/(?:\[data-dkts-(?:nav-toggle|port-desktop|port-mobile)\]|\.dkts-sweep-segment \.dkds-field-label-row|\.dkts-(?:page-editor|project-plot-area)\[hidden\])/.test(rule)),
  'important is only permitted for DKTS-owned semantic responsive visibility');
 assert.match(css,/\[data-dkts-port-mobile\]\{display:none!important\}/);
 assert.match(css,/@media\(max-width:990px\)[\s\S]*\[data-dkts-port-desktop\]\{display:none!important\}/);

 assert(css.includes('max-width:900px'));
 assert(css.includes('data-dkts-nav-toggle'));
 assert(css.includes('data-dkts-plot-group'));
 assert(css.includes('data-dkts-port-mobile'));
 assert(css.includes('--dkds-grid-auto-rows:minmax(164px,1fr)'));
 const smoke=fs.readFileSync(path.join(__dirname,'../tools/dkts-core-boot-smoke.cjs'),'utf8');
 assert(smoke.includes('core-host-phone-page.png'));
 assert(smoke.includes('core-host-phone-port-popover.png'));
 assert(smoke.includes('threeTerminalRoles:true'));
 const runner=fs.readFileSync(path.join(__dirname,'../tools/run-core-host-smoke.cjs'),'utf8');
 assert(runner.includes('result.phoneEvidence?.popover!==true'));
 assert(runner.includes('core-host-phone-port-popover.png'));
 assert(css.includes('.dkts-sweep-segment'));
 assert(css.includes('.dkts-parameter-content'));
 assert(css.includes('prefers-reduced-motion'));
 assert.doesNotMatch(css,/body\s*\{|\.dkds-plugin-workspace/,'plugin paint must stay scoped to the DKTS workbench');
 assert(!css.includes('height:calc(100dvh'),'viewport/status bar remains DKDS-owned');
});
