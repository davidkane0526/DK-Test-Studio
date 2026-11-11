(() => {
 'use strict';
 // One visible select appearance and one portal menu owner for both native
 // Electron and Android WebView. Underlying HTMLSelectElement remains the
 // source of truth for DKDS component contracts and PagePlan bindings.
 const seen=new WeakSet();
 let open=null,portal=null,highlight=-1;
 function close({focus=false}={}){
  if(!open)return;
  const button=open.button;
  if(portal){portal.remove();portal=null;}
  button.setAttribute('aria-expanded','false');
  open=null;highlight=-1;
  if(focus&&button.isConnected)button.focus({preventScroll:true});
 }
 function sync(select){
  const button=select.parentElement?.querySelector(':scope > .fs-select-trigger');
  if(!button)return;
  const option=select.selectedOptions?.[0];
  button.querySelector('.fs-select-label').textContent=option?.textContent?.trim()||'—';
  button.disabled=select.disabled;
  button.title=select.title||option?.textContent?.trim()||'';
  button.setAttribute('aria-label',select.getAttribute('aria-label')||option?.textContent?.trim()||'选项');
 }
 function position(){
  if(!open||!portal)return;
  if(!open.button.isConnected||!open.select.isConnected){close();return;}
  const box=open.button.getBoundingClientRect();
  const W=window.innerWidth,H=window.innerHeight,pad=7;
  const width=Math.min(Math.max(box.width,165),W-2*pad);
  const height=Math.min(288,portal.scrollHeight,H-2*pad);
  const spaceBelow=H-box.bottom-pad,spaceAbove=box.top-pad;
  const below=spaceBelow>=Math.min(height,156)||spaceBelow>=spaceAbove;
  const spec={component:'dkts.fspro.select-popover',owner:'dkts.fspro.ui-controls',source:'src/4200a-fspro/ui-controls.js'};
  window.DKDSStyleGate.set(portal,'width',width+'px',spec);
  window.DKDSStyleGate.set(portal,'left',Math.max(pad,Math.min(W-pad-width,box.left))+'px',spec);
  window.DKDSStyleGate.set(portal,'top',(below?Math.max(pad,Math.min(H-pad-height,box.bottom+4))
    :Math.max(pad,box.top-height-4))+'px',spec);
  window.DKDSStyleGate.set(portal,'max-height',Math.max(44,Math.min(height,below?spaceBelow-4:spaceAbove-4))+'px',spec);
 }
 function paint(){
  if(!portal)return;
  const rows=[...portal.querySelectorAll('[role="option"]')];
  rows.forEach((el,i)=>{
   el.setAttribute('aria-selected',String(i===open.select.selectedIndex));
   el.dataset.highlight=String(i===highlight);
  });
  rows[highlight]?.scrollIntoView?.({block:'nearest'});
 }
 function choose(index){
  if(!open||index<0)return;
  const option=open.select.options[index];
  if(!option||option.disabled)return;
  const select=open.select,changed=select.value!==option.value;
  select.selectedIndex=index;
  sync(select);
  close({focus:true});
  if(changed)select.dispatchEvent(new Event('change',{bubbles:true}));
 }
 function show(select,button){
  if(open?.select===select){close({focus:true});return;}
  close();
  if(select.disabled)return;
  const menu=document.createElement('div');
  menu.className='fs-select-popover';
  menu.setAttribute('role','listbox');
  menu.setAttribute('aria-label',select.getAttribute('aria-label')||'选项');
  const rows=[...select.options];
  for(let i=0;i<rows.length;i++){
   const option=rows[i],item=document.createElement('button');
   item.type='button';item.className='fs-select-option';
   item.setAttribute('role','option');item.setAttribute('data-index',String(i));
   item.disabled=option.disabled;item.textContent=option.textContent;
   item.addEventListener('click',event=>{event.stopPropagation();choose(i);});
   menu.appendChild(item);
  }
  document.body.appendChild(menu);
  portal=menu;open={select,button};
  highlight=Math.max(0,select.selectedIndex);
  button.setAttribute('aria-expanded','true');paint();position();
 }
 function enhance(root=document){
  const all=[];
  if(root.matches?.('select'))all.push(root);
  all.push(...(root.querySelectorAll?.('select')||[]));
  for(const select of all){
   if(seen.has(select)||select.closest('[data-no-fs-select]'))continue;
   seen.add(select);
   const parent=select.parentElement;
   if(!parent)continue;
   const shell=document.createElement('span');
   shell.className='fs-select-shell';
   parent.insertBefore(shell,select);
   shell.appendChild(select);
   select.classList.add('fs-select-native');
   const btn=document.createElement('button');
   btn.type='button';btn.className='fs-select-trigger';
   btn.setAttribute('aria-haspopup','listbox');btn.setAttribute('aria-expanded','false');
   btn.innerHTML='<span class="fs-select-label"></span><span class="fs-select-chevron" aria-hidden="true"></span>';
   shell.appendChild(btn);sync(select);
   btn.addEventListener('click',()=>show(select,btn));
   btn.addEventListener('keydown',event=>{
    if(['ArrowDown','ArrowUp',' ','Enter'].includes(event.key)){
     event.preventDefault();
     if(!open||open.select!==select)show(select,btn);
     else if(event.key==='ArrowDown'||event.key==='ArrowUp')move(event.key==='ArrowDown'?1:-1);
     else choose(highlight);
    }
   });
   select.addEventListener('change',()=>{sync(select);if(open?.select===select)close();});
   new MutationObserver(()=>{
    if(!select.isConnected){if(open?.select===select)close();return;}
    sync(select);
   }).observe(select,{attributes:true,childList:true,characterData:true,subtree:true});
  }
 }
 function move(delta){
  if(!open)return;
  const opts=open.select.options;
  let idx=highlight;
  for(let i=0;i<opts.length;i++){
   idx=(idx+delta+opts.length)%opts.length;
   if(!opts[idx].disabled){highlight=idx;break;}
  }
  paint();
 }
 document.addEventListener('pointerdown',event=>{
  if(open&&!portal?.contains(event.target)&&!open.button.contains(event.target))close();
 },true);
 document.addEventListener('keydown',event=>{
  if(!open)return;
  if(event.key==='Escape'){event.preventDefault();close({focus:true});}
  else if(event.key==='ArrowDown'||event.key==='ArrowUp'){
   event.preventDefault();move(event.key==='ArrowDown'?1:-1);
  }else if(event.key==='Enter'||event.key===' '){event.preventDefault();choose(highlight);}
  else if(event.key==='Home'){event.preventDefault();highlight=0;paint();}
  else if(event.key==='End'){event.preventDefault();highlight=open.select.options.length-1;paint();}
 },true);
 document.addEventListener('scroll',()=>{if(open)position();},true);
 window.addEventListener('resize',()=>{if(open)position();});
 document.addEventListener('dkts:language-changed',()=>{if(open)close();});
 const observer=new MutationObserver(records=>{
  let need=false;
  for(const entry of records)if([...entry.addedNodes].some(node=>
   node.nodeType===1&&(node.matches?.('select')||node.querySelector?.('select')))){need=true;break;}
  if(need)queueMicrotask(()=>enhance(document));
 });
 observer.observe(document.body,{subtree:true,childList:true});
 enhance(document);
 window.DK4200UIControls=Object.freeze({enhance,close});
})();