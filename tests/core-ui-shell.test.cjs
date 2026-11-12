'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'../integrations/dkds-native');
test('DKTS Core project drawer is scoped, keyboard dismissible and restores full plot width',()=>{
 let shellModule,style=null,scrim=null,keyHandler=null;
 function element(){
  const attrs={};return {attrs,setAttribute:(key,value)=>attrs[key]=value,
   addEventListener(kind,cb){this['on'+kind]=cb;},remove(){this.removed=true;}};
 }
 const document={
  head:{appendChild:node=>{style=node;}},
  createElement:tag=>{const result=element();result.tag=tag;return result;},
  addEventListener:(kind,cb)=>{if(kind==='keydown')keyHandler=cb;},
  removeEventListener:(kind,cb)=>{if(kind==='keydown'&&keyHandler===cb)keyHandler=null;}
 };
 const sandbox={window:{DKDSPluginModules:{define:(id,name,api)=>{
  assert.equal(id,'com.dkts.keithley-4200');assert.equal(name,'uiShell');shellModule=api;
 }}},document};
 vm.runInNewContext(fs.readFileSync(path.join(root,'ui-shell.js'),'utf8'),sandbox);
 assert(shellModule&&typeof shellModule.attach==='function');
 const main=element(),nav=element();main.insertBefore=(child,before)=>{
  assert.equal(before,nav);scrim=child;
 };
 const drawer=shellModule.attach(main,nav);
 assert.equal(main.attrs['data-dkts-shell'],'true');
 assert.equal(nav.attrs['data-dkts-nav'],'true');
 assert.equal(main.attrs['data-dkts-nav-open'],'false');
 assert.equal(style.tag,'style');
 assert(style.textContent.includes('#dktsKeithley4200Page [data-dkts-shell]'));
 assert(style.textContent.includes('grid-template-columns:252px minmax(0,1fr)'));
 assert(style.textContent.includes('max-width:900px'));
 assert(style.textContent.includes('data-dkts-nav-toggle'));
 assert(style.textContent.includes('data-dkts-plot-frame'));
 assert(!style.textContent.includes('body button'));
 drawer.toggle();assert.equal(main.attrs['data-dkts-nav-open'],'true');
 scrim.onclick();assert.equal(main.attrs['data-dkts-nav-open'],'false');
 drawer.setOpen(true);keyHandler({key:'Escape'});
 assert.equal(main.attrs['data-dkts-nav-open'],'false');
 drawer.dispose();assert.equal(style.removed,true);
 assert.equal(scrim.removed,true);assert.equal(keyHandler,null);
});
