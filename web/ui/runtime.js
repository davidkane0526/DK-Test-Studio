(() => {
'use strict';
const VERSION='1.0.0',OWNER='dkts.ui',SOURCE='web/ui/runtime.js';
const TOKEN_MAP=Object.freeze({
canvas:'--dkui-canvas',surface:'--dkui-surface',surfaceSoft:'--dkui-surface-soft',surfaceHover:'--dkui-surface-hover',
surfaceElevated:'--dkui-surface-elevated',surfaceSidebar:'--dkui-surface-sidebar',controlBg:'--dkui-control-bg',
controlHover:'--dkui-control-hover',divider:'--dkui-divider',dividerHover:'--dkui-divider-hover',
controlBorder:'--dkui-control-border',controlBorderHover:'--dkui-control-border-hover',scrollbar:'--dkui-scrollbar',
scrollbarHover:'--dkui-scrollbar-hover',text:'--dkui-text',textSoft:'--dkui-text-soft',muted:'--dkui-muted',
accent:'--dkui-accent',accentHover:'--dkui-accent-hover',accentSoft:'--dkui-accent-soft',accentAlt:'--dkui-accent-alt',
accentAltHover:'--dkui-accent-alt-hover',accentAltSoft:'--dkui-accent-alt-soft',focus:'--dkui-focus',
success:'--dkui-success',successSoft:'--dkui-success-soft',warning:'--dkui-warning',warningSoft:'--dkui-warning-soft',
danger:'--dkui-danger',dangerSoft:'--dkui-danger-soft',info:'--dkui-info',infoSoft:'--dkui-info-soft',
selectionSurface:'--dkui-selection-surface',selectionText:'--dkui-selection-text',selectionBorder:'--dkui-selection-border',
activeSurface:'--dkui-active-surface',activeText:'--dkui-active-text',disabledSurface:'--dkui-disabled-surface',
disabledText:'--dkui-disabled-text',shadow1:'--dkui-shadow-1',shadow2:'--dkui-shadow-2',shadowFloat:'--dkui-shadow-float',
radius:'--dkui-radius',radiusLg:'--dkui-radius-lg',motionFast:'--dkui-motion-fast',motionNormal:'--dkui-motion-normal',
motionSlow:'--dkui-motion-slow',easeStandard:'--dkui-ease-standard',easeEmphasized:'--dkui-ease-emphasized',
hoverLift:'--dkui-hover-lift',pressScale:'--dkui-press-scale'
});
const METRICS=Object.freeze({
typography:Object.freeze({bodyPx:12.5,labelPx:11,metaPx:10.5,headingPx:13}),
control:Object.freeze({desktopHeightPx:32,touchHeightPx:44,radiusPx:8,gapPx:6}),
surface:Object.freeze({panelGapPx:8,pageGapPx:10,radiusPx:10,paddingPx:12}),
layout:Object.freeze({titlebarHeightPx:46,statusbarHeightPx:28,parameterPaneMinPx:320})
});
const COMPONENTS=Object.freeze({field:'field',card:'card',action:'toolbarAction',tab:'tab',chip:'chip',panelHeader:'panelHeader',toolbarGroup:'toolbarGroup',statusBar:'statusBar'});
const localTheme=globalThis.DKDSTheme||null;
let themeMode=String(localTheme?.current?.()||'light').toLowerCase()==='dark'?'dark':'light';
let themeProfile=String(localTheme?.profile?.()||'builtin.default'),themeScientific=null,hostThemeActive=false;
const themeSubscribers=new Set();
function rootElement(){return typeof document!=='undefined'?document.documentElement:null;}
function emitTheme(reason){
 const detail=Object.freeze({theme:themeMode,profile:themeProfile,scientific:themeScientific,reason:String(reason||'update')});
 for(const row of [...themeSubscribers]){try{row.handler(detail);}catch(error){}}
 try{document.dispatchEvent(new CustomEvent('dkts:theme-changed',{detail}));}catch(error){}
 try{document.querySelectorAll('[data-dkds-chart-renderer="d3"]').forEach(el=>globalThis.DKDSCharts?.themePaint?.(el));}catch(error){}
}
function setToken(key,value){
 const cssName=TOKEN_MAP[key],text=typeof value==='string'?value.trim():'';
 if(!cssName||!text||text.length>256||/[;{}<>]/.test(text))return false;
 const root=rootElement();if(!root)return false;
 const gate=globalThis.DKDSStyleGate;
 if(typeof gate?.setToken==='function')gate.setToken(root,cssName,text,{owner:'dkts.theme-bridge',component:'dkts.theme',scope:'runtime-theme-token',source:SOURCE});
 else root.style.setProperty(cssName,text);
 return true;
}
function applyThemeSnapshot(snapshot){
 if(!snapshot||typeof snapshot!=='object')return false;
 const mode=String(snapshot.mode||'').toLowerCase();if(mode!=='light'&&mode!=='dark')return false;
 const tokens=snapshot.tokens&&typeof snapshot.tokens==='object'?snapshot.tokens:{};
 for(const [key,value] of Object.entries(tokens))setToken(key,value);
 themeMode=mode;themeProfile=String(snapshot.profile||'builtin.default');
 themeScientific=snapshot.scientific&&typeof snapshot.scientific==='object'?Object.freeze({...snapshot.scientific}):null;
 hostThemeActive=true;
 const root=rootElement();if(root){root.dataset.dkdsTheme=themeMode;root.dataset.dkdsThemeProfile=themeProfile;}
 emitTheme('host-profile');return true;
}
function onHostMessage(event){
 if(event.source!==window.parent||window.parent===window)return;
 const message=event.data;
 if(!message||message.channel!=='dkts-standalone-workbench-v1'||message.session!==window.DKTSFrameSession||message.type!=='theme')return;
 applyThemeSnapshot(message.snapshot);
}
if(typeof window!=='undefined'){
 window.addEventListener('message',onHostMessage);
 const root=rootElement();if(root)root.dataset.dkdsTheme=themeMode;
}
function subscribeThemeRevision(id,handler){
 if(typeof handler!=='function')return()=>{};
 const row={id:String(id||'dkts-ui'),handler};themeSubscribers.add(row);let releaseLocal=null;
 if(typeof localTheme?.subscribeRevision==='function'){
  try{releaseLocal=localTheme.subscribeRevision(row.id,event=>{
   if(hostThemeActive)return;
   const next=String(event?.theme||localTheme.current?.()||'light').toLowerCase()==='dark'?'dark':'light';
   const root=rootElement();if(root)root.dataset.dkdsTheme=next;
   if(themeMode!==next){themeMode=next;emitTheme('system-mode');}
  });}catch(error){releaseLocal=null;}
 }
 return()=>{themeSubscribers.delete(row);try{releaseLocal?.();}catch(error){}};
}
if(localTheme)globalThis.DKDSTheme=Object.freeze(Object.assign({},localTheme,{
 current:()=>themeMode,isDark:()=>themeMode==='dark',profile:()=>themeProfile,
 scientific:()=>themeScientific||localTheme.scientific?.()||Object.freeze({seriesPalette:[]}),
 subscribeRevision:subscribeThemeRevision
}));
function setIdentity(element,identity,variant){
 if(!element?.dataset)return;
 const owner=element.dataset.dkdsComponentIdentityOwner;
 if(!element.dataset.dkdsComponentIdentity||owner===OWNER){element.dataset.dkdsComponentIdentity=identity;element.dataset.dkdsComponentIdentityOwner=OWNER;}
 if(variant){element.dataset.dkdsComponentVariant=variant;element.dataset.dkdsComponentVariantOwner=OWNER;}
 else if(element.dataset.dkdsComponentVariantOwner===OWNER){delete element.dataset.dkdsComponentVariant;delete element.dataset.dkdsComponentVariantOwner;}
}
function actionVariant(el){
 if(el.id==='start-measurement'||el.classList.contains('primary'))return 'primary';
 if(el.id==='stop-measurement'||el.classList.contains('destructive'))return 'destructive';
 if(['icon-close','detail-icon-action','window-command','workspace-tab-add'].some(c=>el.classList.contains(c)))return 'quiet';
 return 'secondary';
}
function normalizeElement(el){
 if(!el||el.nodeType!==1)return;
 const tab=el.matches('[role="tab"],.workspace-tab,.dkts-host-workspace-tab');
 const card=el.matches('.test-type-card');
 const field=el.matches('input:not([type="hidden"]),select,textarea,.dkts-select-trigger');
 if(tab){setIdentity(el,COMPONENTS.tab,el.getAttribute('aria-selected')==='true'?'selected':'standard');el.dataset.dkdsUnitTemplate='tab-v2';}
 else if(card){setIdentity(el,COMPONENTS.card,'selectable');el.dataset.dkdsMaterialRole='surface';el.dataset.dkdsMaterialContext='interactive-card';}
 else if(field){setIdentity(el,COMPONENTS.field,el.disabled?'quiet':'standard');el.classList.add('dkds-field-control');el.dataset.dkdsUnitControlHeight='field';el.dataset.dkdsUnitTemplate='field-v2';}
 else if(el.matches('button')){setIdentity(el,COMPONENTS.action,actionVariant(el));el.classList.add('dkds-action-button');el.dataset.dkdsUnitControlHeight='field';el.dataset.dkdsUnitTemplate='action-v2';}
 if(el.matches('.card,.detail-panel,.sweep-axis-card,.connection-dialog,.workspace-archive-dialog')){setIdentity(el,COMPONENTS.card,'standard');el.dataset.dkdsMaterialRole='surface';el.dataset.dkdsMaterialContext='panel';}
 if(el.matches('.app-titlebar,.app-statusbar')){el.dataset.dkdsMaterialRole='chrome';el.dataset.dkdsMaterialContext='application-chrome';}
 if(el.matches('.detail-section-heading,.card-heading,.data-list-heading'))setIdentity(el,COMPONENTS.panelHeader,'standard');
 if(el.matches('.state-chip,.test-type-state,.workspace-archive-count,.status-dot'))setIdentity(el,COMPONENTS.chip,'quiet');
}
function enhance(target){
 if(!target)return 0;let count=0;
 if(target.nodeType===1){normalizeElement(target);count++;}
 if(typeof target.querySelectorAll==='function')for(const el of target.querySelectorAll('*')){normalizeElement(el);count++;}
 return count;
}
function setAttributes(el,attributes={}){
 for(const [name,value] of Object.entries(attributes||{})){if(value===undefined||value===null)continue;if(name==='textContent')el.textContent=String(value);else if(name==='className')el.className=String(value);else el.setAttribute(name,String(value));}
}
function createInput(options={}){
 const el=document.createElement('input');el.type=String(options.type||'text');
 for(const key of ['name','value','min','max','step','placeholder'])if(options[key]!==undefined&&options[key]!==null)el[key]=String(options[key]);
 if(options.ariaLabel)el.setAttribute('aria-label',String(options.ariaLabel));if(options.disabled)el.disabled=true;
 setAttributes(el,options.attributes);normalizeElement(el);return el;
}
function createSelect(options={}){
 const el=document.createElement('select');if(options.name)el.name=String(options.name);
 if(options.ariaLabel)el.setAttribute('aria-label',String(options.ariaLabel));if(options.disabled)el.disabled=true;
 for(const row of options.options||[]){const option=document.createElement('option');if(typeof row==='string'){option.value=row;option.textContent=row;}else{option.value=String(row.value??'');option.textContent=String(row.label??row.value??'');if(row.disabled)option.disabled=true;}el.appendChild(option);}
 if(options.value!==undefined&&options.value!==null)el.value=String(options.value);setAttributes(el,options.attributes);normalizeElement(el);return el;
}
function createAction(options={}){
 const el=document.createElement('button');el.type='button';el.textContent=String(options.label??'');
 if(options.className)el.className=String(options.className);if(options.ariaLabel)el.setAttribute('aria-label',String(options.ariaLabel));
 if(options.title)el.title=String(options.title);if(options.disabled)el.disabled=true;
 if(typeof options.onInvoke==='function')el.addEventListener('click',event=>options.onInvoke({event,button:el}));
 normalizeElement(el);return Object.freeze({element:el,button:el});
}
function createField(options={}){
 const el=document.createElement('label');el.className='dkts-field'+(options.className?' '+options.className:'');
 const caption=document.createElement('span');caption.className='dkts-field-label';caption.textContent=String(options.label||'');
 const control=options.control||(options.kind==='select'?createSelect(options):createInput(options));el.append(caption,control);
 if(options.help){const help=document.createElement('small');help.className='dkts-field-help';help.textContent=String(options.help);el.appendChild(help);}
 normalizeElement(control);return Object.freeze({element:el,control});
}
function createSurface(options={}){
 const el=document.createElement(options.tagName||'section');el.className='dkts-surface'+(options.className?' '+options.className:'');
 setIdentity(el,COMPONENTS.card,String(options.variant||'standard'));el.dataset.dkdsMaterialRole=String(options.role||'surface');el.dataset.dkdsMaterialContext=String(options.context||'panel');
 if(options.variant)el.dataset.dktsSurfaceVariant=String(options.variant);
 if(options.title){const title=document.createElement('h3');title.className='dkts-surface-title';title.textContent=String(options.title);el.appendChild(title);}
 for(const child of options.children||[])el.append(child instanceof Node?child:document.createTextNode(String(child)));
 return Object.freeze({element:el});
}
function createLayout(options={}){
 const el=document.createElement(options.tagName||'div'),variant=String(options.variant||'stack');
 el.className='dkts-layout dkts-layout-'+variant+(options.className?' '+options.className:'');
 for(const child of options.children||[])el.append(child instanceof Node?child:document.createTextNode(String(child)));
 return Object.freeze({element:el});
}
function createChip(options={}){
 const el=document.createElement(options.tagName||'span');el.className='dkts-chip'+(options.className?' '+options.className:'');
 el.textContent=String(options.label||'');setIdentity(el,COMPONENTS.chip,String(options.variant||'quiet'));return Object.freeze({element:el});
}
function mount(target=document.body){
 const host=target||document.body;if(!host)return()=>{};enhance(host);let active=true;
 const observer=typeof MutationObserver==='function'?new MutationObserver(records=>{for(const record of records)for(const node of record.addedNodes||[])if(node.nodeType===1)enhance(node);}):null;
 try{observer?.observe(host,{childList:true,subtree:true});}catch(error){}
 return()=>{if(!active)return;active=false;try{observer?.disconnect();}catch(error){}};
}
const api=Object.freeze({
 version:VERSION,contractVersion:VERSION,owner:OWNER,components:COMPONENTS,metrics:METRICS,enhance,mount,
 theme:Object.freeze({current:()=>themeMode,profile:()=>themeProfile,applySnapshot:applyThemeSnapshot,subscribe:subscribeThemeRevision}),
 create:Object.freeze({field:createField,action:createAction,surface:createSurface,layout:createLayout,chip:createChip}),
 controls:Object.freeze({input:createInput,select:createSelect,action:options=>createAction(options).button})
});
globalThis.DKTSUI=api;const release=mount(document.body);window.addEventListener('pagehide',release,{once:true});
})();