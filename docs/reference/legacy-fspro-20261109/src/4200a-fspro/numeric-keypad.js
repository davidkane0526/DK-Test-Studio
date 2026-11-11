(() => {
 'use strict';
 // Original DKTS numeric-keypad interaction: digits, sign, exponent, cursor,
 // clear, drag and commit. Only numeric 4200A parameter fields on Android
 // suppress the OEM IME; free-text fields retain the regular keyboard.
 const onAndroid=Boolean(window.DKTSReadOnlyNative)||/\bAndroid\b/i.test(navigator.userAgent);
 let active=null,original='',left=0,right=0,remembered=null,drag=null;
 function edit(value,a,b,key){
  const src=String(value??''),l=Math.max(0,Math.min(src.length,Number(a)||0)),
   r=Math.max(l,Math.min(src.length,Number(b)||0));
  const replace=(str,start=l,end=r)=>{
   const next=src.slice(0,start)+str+src.slice(end);
   return {value:next,start:start+str.length};
  };
  if(key==='left')return {value:src,start:Math.max(0,l-1)};
  if(key==='right')return {value:src,start:Math.min(src.length,r+1)};
  if(key==='clear')return replace('',0,src.length);
  if(key==='backspace')return l!==r?replace(''):l>0?replace('',l-1,l):{value:src,start:l};
  if(key==='sign'){
   const exponent=src.toLowerCase().indexOf('e');
   if(exponent>=0&&l>exponent)
    return src[exponent+1]==='-'?replace('',exponent+1,exponent+2):replace('-',exponent+1,exponent+1);
   return src.startsWith('-')?replace('',0,1):replace('-',0,0);
  }
  const base=src.slice(0,l)+src.slice(r);
  if(key==='exp')return /[eE]/.test(base)||!/\d/.test(base)?{value:src,start:l}:replace('e');
  if(key==='dot')return base.toLowerCase().includes('e')||base.split('e')[0].includes('.')?
   {value:src,start:l}:replace('.');
  if(!/^\d$/.test(key)||src.length>=48)return {value:src,start:l};
  return replace(key);
 }
 const panel=document.createElement('section');
 panel.id='dkts-numeric-keypad';panel.className='dkts-numeric-keypad';
 panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','false');
 panel.setAttribute('aria-label','内置九宫格数字输入');
 panel.hidden=true;
 panel.innerHTML=[
  '<div class="dkts-keypad-head" data-drag-handle title="拖动数字键盘">',
    '<span class="dkts-keypad-grip" aria-hidden="true">⠿</span>',
    '<span class="dkts-keypad-label">数字输入</span>',
    '<strong class="dkts-keypad-value" aria-live="off">—</strong></div>',
  '<div class="dkts-keypad-functions">',
    '<button type="button" data-key="sign" aria-label="切换正负">±</button>',
    '<button type="button" data-key="exp" aria-label="科学计数法">×10ⁿ</button>',
    '<button type="button" data-key="clear" aria-label="清空">清空</button></div>',
  '<div class="dkts-keypad-grid">',
    ...['7','8','9','4','5','6','1','2','3','.','0','⌫'].map((txt,i)=>
     '<button type="button" data-key="'+(i===9?'dot':i===11?'backspace':txt)+
     '" aria-label="'+(i===11?'退格':txt)+'">'+txt+'</button>'),
  '</div><div class="dkts-keypad-foot">',
    '<button type="button" data-key="left" aria-label="光标左移">‹</button>',
    '<button type="button" data-key="right" aria-label="光标右移">›</button>',
    '<button type="button" class="dkts-keypad-done" data-key="done">完成</button>',
  '</div><p class="dkts-keypad-feedback" role="status" aria-live="polite"></p>'
 ].join('');
 document.body.appendChild(panel);
 const view=panel.querySelector('.dkts-keypad-value');
 const label=panel.querySelector('.dkts-keypad-label');
 const feedback=panel.querySelector('.dkts-keypad-feedback');
 const valid=value=>/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(value)&&
   Number.isFinite(Number(value));
 const update=()=>{
  view.textContent=active?.value||'—';
  if(active)active.setAttribute('aria-invalid',String(!valid(active.value)));
 };
 function close(commit=false){
  if(!active)return;
  const control=active;
  if(commit&&!valid(control.value)){feedback.textContent='请输入有效数值';update();return false;}
  if(!valid(control.value)&&control.value!==original){
   control.value=original;control.dispatchEvent(new Event('input',{bubbles:true}));
  }
  control.removeAttribute('aria-invalid');control.setAttribute('aria-expanded','false');
  control.classList.remove('dkts-numeric-active');
  control.dispatchEvent(new Event('change',{bubbles:true}));
  active=null;panel.hidden=true;feedback.textContent='';
  return true;
 }
 function clamp(x,y){
  const width=panel.offsetWidth,height=panel.offsetHeight,pad=7;
  const W=window.innerWidth,H=window.innerHeight;
  return {x:Math.max(pad,Math.min(Math.max(pad,W-width-pad),x)),
    y:Math.max(pad,Math.min(Math.max(pad,H-height-pad),y))};
 }
 function position(x,y){
  const p=clamp(x,y);
  const spec={component:'dkts.fspro.numeric-keypad',owner:'dkts.fspro.numeric-keypad',source:'src/4200a-fspro/numeric-keypad.js'};
  window.DKDSStyleGate.set(panel,'left',p.x+'px',spec);
  window.DKDSStyleGate.set(panel,'top',p.y+'px',spec);
  remembered=p;
 }
 function open(control){
  if(control.disabled)return;
  if(active&&active!==control)close();
  if(active===control)return;
  active=control;original=control.value;left=0;right=original.length;
  control.setAttribute('aria-expanded','true');control.classList.add('dkts-numeric-active');
  const key=control.dataset.bind||control.getAttribute('aria-label')||'数字';
  label.textContent=key.replace(/^terminals\[\d+\]\./,'').replace(/measureRange\.value/,'测量量程');
  feedback.textContent='';panel.hidden=false;
  const box=control.getBoundingClientRect();
  if(remembered)position(remembered.x,remembered.y);
  else{
   const x=Math.max(7,Math.min(window.innerWidth-panel.offsetWidth-7,box.right-panel.offsetWidth));
   const below=box.bottom+8,above=box.top-panel.offsetHeight-8;
   position(x,below+panel.offsetHeight<=window.innerHeight-7?below:above);
  }
  update();
 }
 function press(key){
  if(!active)return;
  if(key==='done'){close(true);return;}
  const next=edit(active.value,left,right,key);left=right=next.start;
  if(next.value!==active.value){
   active.value=next.value;active.dispatchEvent(new Event('input',{bubbles:true}));
  }
  feedback.textContent='';update();
 }
 function isNumeric(control){
  const key=control?.dataset?.bind||'';
  return (/^(?:refValue|terminals\[\d+\]\.(?:start|stop|step|points|bias|compliance|measureRange\.value|segments\[\d+\]\.(?:start|stop|step|points|bias))|strategy\.(?:integrationTime|delayTime))$/.test(key) ||
    control?.getAttribute?.('data-device-field')==='port');
 }
 const seen=new WeakSet();
 function bindNew(root=document){
  if(!onAndroid)return;
  const controls=[];
  if(root.matches?.('input'))controls.push(root);
  controls.push(...(root.querySelectorAll?.('input')||[]));
  for(const control of controls){
   if(seen.has(control)||!isNumeric(control)||control.type==='hidden')continue;
   seen.add(control);control.type='text';control.inputMode='none';
   control.readOnly=true;control.autocomplete='off';
   control.classList.add('dkts-numeric-input');
   control.setAttribute('aria-controls','dkts-numeric-keypad');
   control.addEventListener('pointerdown',event=>{
    if(event.pointerType==='mouse'&&event.button!==0)return;
    event.preventDefault();open(control);
   });
   control.addEventListener('touchstart',event=>{
    if(event.cancelable)event.preventDefault();open(control);
   },{passive:false});
   control.addEventListener('click',event=>{event.preventDefault();open(control);});
   control.addEventListener('contextmenu',event=>event.preventDefault());
  }
 }
 panel.addEventListener('click',event=>{
  const button=event.target.closest('button[data-key]');
  if(button&&!button.disabled)press(button.dataset.key);
 });
 const handle=panel.querySelector('[data-drag-handle]');
 handle.addEventListener('pointerdown',event=>{
  event.preventDefault();const rect=panel.getBoundingClientRect();
  drag={id:event.pointerId,dx:event.clientX-rect.left,dy:event.clientY-rect.top};
  handle.setPointerCapture?.(event.pointerId);
 });
 handle.addEventListener('pointermove',event=>{
  if(drag&&drag.id===event.pointerId)position(event.clientX-drag.dx,event.clientY-drag.dy);
 });
 const finish=event=>{if(drag?.id===event.pointerId)drag=null;};
 handle.addEventListener('pointerup',finish);handle.addEventListener('pointercancel',finish);
 document.addEventListener('pointerdown',event=>{
  if(active&&!panel.contains(event.target)&&event.target!==active&&
   !event.target.closest?.('.dkts-numeric-input'))close();
 },true);
 document.addEventListener('keydown',event=>{
  if(!active)return;
  if(event.key==='Escape'){event.preventDefault();close();return;}
  if(event.key==='Enter'){event.preventDefault();close(true);return;}
  if(/^\d$/.test(event.key)||event.key==='.'||event.key==='-'||
     event.key.toLowerCase()==='e'||event.key==='Backspace'){
   event.preventDefault();
   press(event.key==='.'?'dot':event.key==='-'?'sign':
     event.key==='Backspace'?'backspace':event.key.toLowerCase()==='e'?'exp':event.key);
  }
 },true);
 const observer=new MutationObserver(records=>{
  if(records.some(entry=>[...entry.addedNodes].some(node=>
    node.nodeType===1&&(node.matches?.('input')||node.querySelector?.('input')))))bindNew(document);
 });
 observer.observe(document.body,{subtree:true,childList:true});
 window.addEventListener('resize',()=>{if(active&&remembered)position(remembered.x,remembered.y);});
 bindNew(document);
 window.DKTSNumericKeypad=Object.freeze({bindNew,isOpen:()=>Boolean(active),close:()=>close(true),edit});
})();