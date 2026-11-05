'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const js=fs.readFileSync(path.join(root,'web/app.js'),'utf8');
const html=fs.readFileSync(path.join(root,'web/index.html'),'utf8');
const css=fs.readFileSync(path.join(root,'web/styles.css'),'utf8');
const from=js.indexOf('function numericKeyEdit(value,start,end,key,real=true){');
const until=js.indexOf('\nfunction installAndroidNumericKeypad(){',from);
assert(from>=0&&until>from);
const edit=vm.runInNewContext('('+js.slice(from,until)+')');
const asPlain=result=>JSON.parse(JSON.stringify(result));
const clampStart=js.indexOf('function clampNumericKeypad(');
const clampEnd=js.indexOf('\nfunction installAndroidNumericKeypad(){',clampStart);
assert(clampStart>=0&&clampEnd>clampStart,'pure keypad clamping helper is required');
const clamp=vm.runInNewContext('('+js.slice(clampStart,clampEnd).trim()+')');


test('nine-grid digits replace the initial selection and preserve a caret',()=>{
  assert.deepEqual(asPlain(edit('101',0,3,'7',false)),
    {value:'7',start:1,end:1,changed:true});
  assert.deepEqual(asPlain(edit('123',1,2,'8',false)),
    {value:'183',start:2,end:2,changed:true});
  assert.deepEqual(asPlain(edit('101',1,1,'backspace',false)),
    {value:'01',start:0,end:0,changed:true});
  assert.deepEqual(asPlain(edit('123',1,2,'backspace',false)),
    {value:'13',start:1,end:1,changed:true});
  assert.deepEqual(asPlain(edit('123',1,1,'clear',false)),
    {value:'',start:0,end:0,changed:true});
});

test('minus, decimal, exponent are available to voltages and currents',()=>{
  assert.equal(edit('0.1',3,3,'sign',true).value,'-0.1');
  assert.equal(edit('-0.1',4,4,'sign',true).value,'0.1');
  assert.equal(edit('1',1,1,'exp',true).value,'1e');
  assert.equal(edit('1e',2,2,'sign',true).value,'1e-');
  assert.equal(edit('1e-',3,3,'6',true).value,'1e-6');
  assert.equal(edit('2',1,1,'dot',true).value,'2.');
  assert.equal(edit('2.5',3,3,'dot',true).changed,false);
  assert.equal(edit('2e3',3,3,'exp',true).changed,false);
  assert.equal(edit('2e3',3,3,'dot',true).changed,false);
  assert.equal(edit('2',1,1,'dot',false).changed,false);
  assert.equal(edit('2',1,1,'exp',false).changed,false);
  assert.equal(edit('',0,0,'exp',true).changed,false);
});

test('selection movement and safety cap handle long data without malformed edits',()=>{
  assert.equal(edit('123',3,3,'left',false).start,2);
  assert.equal(edit('123',2,2,'right',false).start,3);
  assert.equal(edit('4'.repeat(48),48,48,'7',true).changed,false);
  assert.equal(edit('12',0,2,'5',false).value,'5');
  assert.equal(edit('12',0,0,'unknown',true).changed,false);
});

test('Android-only in-app keyboard covers numeric connection and test fields without replacing text IME',()=>{
  assert.match(html,/id="dkts-numeric-keypad"[\s\S]*class="dkts-keypad-grid"/);
  assert.equal((html.match(/class="dkts-keypad-grid"/g)||[]).length,1);
  assert.equal((html.match(/data-key="[1-9]"/g)||[]).length,9);
  for(const k of ['sign','exp','clear','dot','backspace','left','right','done'])
    assert(html.includes('data-key="'+k+'"'));
  assert.match(js,/if\(!document\.body\.classList\.contains\('dkts-android-shell'\)\)return;/);
  assert.match(js,/querySelectorAll\('input\[type="number"\]'\)/);
  assert.match(js,/control\.inputMode='none';/);
  assert.match(js,/control\.readOnly=true;/);
  assert.match(js,/control\.type='text';/);
  assert.match(js,/control\.dispatchEvent\(new Event\('input',\{bubbles:true\}\)\)/);
  assert.match(js,/control\.dispatchEvent\(new Event\('change',\{bubbles:true\}\)\)/);
  assert.match(js,/const low=control\.getAttribute\('min'\),high=control\.getAttribute\('max'\)/);
  assert.match(js,/if\(commit&&!isValid\(active\)\)/);
  assert.match(js,/const numeric=Array\.from\(document\.querySelectorAll/);
  assert.match(html,/id="waveform-text"[^>]*>/);
  assert.match(html,/name="expectedSerial"[^>]*>/);
  assert.doesNotMatch(js,/querySelectorAll\('textarea'/);
});

test('keyboard overlays only Android content, stays above native status and respects safe areas',()=>{
  assert.match(css,/\.dkts-numeric-keypad\[hidden\]\{display:none!important\}/);
  assert.match(css,/body\.dkts-android-shell \.dkts-numeric-keypad\{/);
  assert.match(css,/bottom:calc\(var\(--dkts-status-height\) \+ var\(--dkts-safe-bottom\) \+ 5px\)/);
  assert.match(css,/body\.dkts-android-shell\.dkts-keypad-open \.workspace\{padding-bottom:350px\}/);
  const native=fs.readFileSync(path.join(root,'android/app/src/main/java/studio/dk/test/MainActivity.java'),'utf8');
  assert.match(native,/keypad:!!document\.querySelector/);
  assert.match(native,/numericField:document\.querySelector/);
});


test('numeric editor selection is virtual; Android never selects native input text',()=>{
  const start=js.indexOf('function installAndroidNumericKeypad(){');
  const end=js.indexOf('\ninstallAndroidNumericKeypad();',start);
  assert(start>=0&&end>start);
  const implementation=js.slice(start,end);
  assert.match(implementation,/selection=\{start:0,end:control\.value\.length\}/);
  assert.match(implementation,/numericKeyEdit\(before,selection\.start,selection\.end,key/);
  assert.doesNotMatch(implementation,/\bcontrol\.setSelectionRange\(/);
  assert.doesNotMatch(implementation,/\bcontrol\.focus\(/);
  assert.doesNotMatch(implementation,/\bcontrol\.select\(/);
  assert.match(implementation,/control\.classList\.add\('dkts-numeric-active'\)/);
  assert.match(implementation,/control\.classList\.remove\('dkts-numeric-active'\)/);
  assert.match(implementation,/control\.addEventListener\('touchstart'/);
  assert.match(implementation,/event\.cancelable\)event\.preventDefault\(\)/);
  assert.match(implementation,/control\.addEventListener\('contextmenu',event=>event\.preventDefault\(\)\)/);
  assert.match(implementation,/control\.addEventListener\('selectstart',event=>event\.preventDefault\(\)\)/);
  assert.match(css,/\.dkts-numeric-input\[readonly\]\{[\s\S]*?-webkit-user-select:none!important/);
  assert.match(css,/\.dkts-numeric-input\.dkts-numeric-active\{[\s\S]*?box-shadow:/);
  assert.match(css,/caret-color:transparent!important/);
});

test('floating keypad drag handle uses pointer capture and persists its position',()=>{
  assert.match(html,/id="dkts-keypad-drag-handle"/);
  assert.match(html,/class="dkts-keypad-grip"/);
  assert.match(css,/\.dkts-keypad-head\{[\s\S]*?touch-action:none/);
  assert.match(css,/\.dkts-keypad-head\.is-dragging/);
  assert.match(js,/dragHandle\.setPointerCapture\?\.\(event\.pointerId\)/);
  assert.match(js,/dragHandle\.addEventListener\('pointermove'/);
  assert.match(js,/dragHandle\.addEventListener\('pointercancel',endDrag\)/);
  assert.match(js,/dragHandle\.addEventListener\('lostpointercapture',endDrag\)/);
  assert.match(js,/rememberedPosition=position/);
  assert.match(js,/if\(rememberedPosition\)placeKeypad\(/);
  assert.match(js,/window\.addEventListener\('resize'/);
});

test('drag bounds honor viewport, title bar, navigation bar and a small screen',()=>{
  const p=asPlain(clamp(-500,-200,320,280,400,800,44,42));
  assert.deepEqual(p,{left:6,top:50});
  const q=asPlain(clamp(999,999,320,280,400,800,44,42));
  assert.deepEqual(q,{left:74,top:472});
  const tiny=asPlain(clamp(40,500,400,320,350,420,44,42));
  assert(tiny.left>=6&&Number.isFinite(tiny.top));
  assert(tiny.top>=6);
  assert(tiny.top<=420);
  const allowed=asPlain(clamp(10,160,320,280,400,800,44,42));
  assert.deepEqual(allowed,{left:10,top:160});
});
