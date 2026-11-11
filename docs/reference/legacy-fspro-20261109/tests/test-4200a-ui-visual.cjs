'use strict';
/* Browser-based, instrument-free visual acceptance.
 * Run with NODE_PATH pointing to a temporary playwright installation.
 * Captures evidence and rejects structural regressions; no instrument output.
 */
const assert=require('node:assert/strict');
const path=require('node:path');
const fs=require('node:fs');
const {pathToFileURL}=require('node:url');
const {chromium}=require('playwright');
const file=pathToFileURL(path.resolve(process.env.DK4200_UI_ENTRY_FILE||path.join(__dirname,'../src/4200a-fspro/index.html'))).href;
const out=path.resolve(process.env.DK4200_QA_OUT||path.join(__dirname,'../artifacts/4200a-ui'));
fs.mkdirSync(out,{recursive:true});
const report=[];
function check(id,condition,details=''){report.push({id,pass:!!condition,details});assert.ok(condition,`${id}: ${details}`);}
async function seedVisualSMUs(page){
 await page.evaluate(()=>window.DK4200FSPro.setVerifiedInventory(['SMU1','SMU2','SMU3','SMU4']));
 const plan=await page.evaluate(()=>{
   const p=window.DK4200FSPro.getDraft();p.terminals.forEach((t,i)=>{t.resource='SMU'+(i+1)});return p;
 });
 await page.locator('#fs-open-input').setInputFiles({
  name:'offline-qa-four-smu-plan.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(plan))
 });
 await page.waitForFunction(()=>window.DK4200FSPro.getDraft().terminals[0].resource==='SMU1');
}
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--allow-file-access-from-files']});
 try{
  const desktop=await browser.newPage({viewport:{width:1200,height:850},deviceScaleFactor:1,acceptDownloads:true});
  await desktop.goto(file);
  check('SHELL-DEFAULT-ZH',await desktop.evaluate(()=>
    window.DKTSLocale?.getLanguage()==='zh'&&document.documentElement.lang==='zh-CN'&&
    document.querySelector('.fs-title-actions [data-command="open"]')?.getAttribute('title')==='打开工程'&&
    document.querySelector('#fs-version-badge')?.textContent==='V0.3.13'),
    'default Chinese and original V0.3.13 identity');
  if(process.env.DK4200_UI_ENTRY_FILE)await desktop.waitForFunction(
    ()=>document.querySelector('#fs-brand-mark')?.dataset.brand==='legacy-native-icon',
    {timeout:4000});
  check('SHELL-BRAND',await desktop.evaluate(()=>{
    const logo=document.getElementById('fs-brand-mark');
    return logo?.textContent==='DK'||logo?.dataset.brand==='legacy-native-icon';
  }),'original DK brand mark or exact packaged PNG exists');
  check('SHELL-PACKAGED-NATIVE-ICON',!process.env.DK4200_UI_ENTRY_FILE||
    await desktop.locator('#fs-brand-mark').getAttribute('data-brand')==='legacy-native-icon',
    'Android staged UI uses original generated PNG rather than a generic logo');
  const brandedFit=await desktop.evaluate(()=>{
    const icon=document.getElementById('fs-brand-mark'),style=getComputedStyle(icon);
    return {native:icon.dataset.brand==='legacy-native-icon',size:style.backgroundSize,
      position:style.backgroundPosition,image:style.backgroundImage};
  });
  check('SHELL-PACKAGED-ICON-FIT',!process.env.DK4200_UI_ENTRY_FILE||
    (brandedFit.native&&brandedFit.size==='cover'&&brandedFit.image.includes('brand-icon.png')),
    'Old 256px PNG must fit entire 27px header box without cropping: '+JSON.stringify(brandedFit));
  check('SHELL-TITLEBAR',await desktop.evaluate(()=>{
    const title=document.querySelector('.fs-titlebar'),buttons=[...title.querySelectorAll('.fs-title-actions button')];
    const b=title.getBoundingClientRect();
    const foot=document.querySelector('.fs-status').getBoundingClientRect();
    const lang=document.querySelector('#fs-language-switch').getBoundingClientRect();
    return !document.querySelector('#fs-main-menu,#fs-mobile-menu-toggle')&&buttons.length===4&&
      buttons.every(x=>x.getBoundingClientRect().bottom<=b.bottom+1)&&
      b.height<=46&&lang.bottom<=foot.bottom+1;
  }),'No grouped menus; four direct actions and locale in bottom status bar');
  const pageErrors=[];
  desktop.on('pageerror',err=>pageErrors.push(String(err.message||err)));
  await desktop.screenshot({path:path.join(out,'01-main-workspace.png'),fullPage:true});
  // A separate Chromium renderer simulates ONLY the narrow Electron window
  // bridge to validate button layout and dispatch; this is not an OS test.
  const windowPreview=await browser.newPage({viewport:{width:1200,height:850}});
  await windowPreview.addInitScript(()=>{
    window.__windowPreviewOps=[];
    window.DKTSWindow={
      control:operation=>{
        window.__windowPreviewOps.push(operation);
        return Promise.resolve(operation==='toggleMaximize'?true:operation==='isMaximized'?false:true);
      },
      onMaximize:callback=>{window.__windowPreviewMaximize=callback;}
    };
  });
  await windowPreview.goto(file);
  check('WINDOW-FRAMELESS-BUTTONS',await windowPreview.locator('#fs-window-actions').isVisible()&&
    await windowPreview.locator('.fs-window-button').count()===3,
    'minimize/maximize/close render only when Electron bridge exists');
  await windowPreview.locator('#fs-window-minimize').click();
  await windowPreview.locator('#fs-window-maximize').click();
  await windowPreview.waitForFunction(()=>document.querySelector('#fs-window-maximize')?.dataset.maximized==='true');
  check('WINDOW-RESTORE-GLYPH',await windowPreview.locator('#fs-window-maximize').getAttribute('aria-label')==='还原',
    'restore icon/label tracks native maximize state');
  await windowPreview.locator('#fs-window-close').click();
  check('WINDOW-DISPATCH-ALLOWLIST',await windowPreview.evaluate(()=>
    JSON.stringify(window.__windowPreviewOps)==='["isMaximized","minimize","toggleMaximize","close"]'),
    'exact read-only window bridge operation list and order');
  await windowPreview.screenshot({path:path.join(out,'13-desktop-frameless-window-controls.png'),fullPage:true});
  await windowPreview.close();
  await desktop.locator('#fs-language-switch').click();
  check('SHELL-SWITCH-EN',await desktop.evaluate(()=>
    window.DKTSLocale?.getLanguage()==='en'&&
    document.querySelector('.fs-title-actions [data-command="open"]')?.getAttribute('title')==='Open Project'&&
    document.querySelector('#fs-language-switch')?.textContent==='中文'),
    'language changes without a page reload');
  await desktop.locator('#fs-plot-layout').evaluate(select=>{select.value='3';select.dispatchEvent(new Event('change',{bubbles:true}));});
  check('UI-PLOT-DROPDOWN',await desktop.evaluate(()=>
    document.querySelector('.fs-frames')?.dataset.layout==='single'&&
    getComputedStyle(document.querySelector('#fs-frame-4')).display!=='none'),
    'scientific subwindow is selected in Visual Area heading');
  await desktop.locator('#fs-plot-layout').evaluate(select=>{select.value='grid';select.dispatchEvent(new Event('change',{bubbles:true}));});
  await desktop.locator('#fs-instrument-settings').click();
  check('UI-CONNECTION-SETTINGS',await desktop.locator('#fs-instrument-host .fs-device-dialog').isVisible(),'Instrument connection settings');
  check('SAFE-CONNECTION-OFFLINE',await desktop.evaluate(()=>window.DK4200ConnectionStatus?.snapshot?.().executionAuthorized===false),'no native output privilege');
  await desktop.screenshot({path:path.join(out,'08-instrument-settings.png'),fullPage:true});
  await desktop.locator('#fs-instrument-host [data-fs-device-action="close"]').first().click();

  check('UI-001',await desktop.locator('.fs-title-actions').isVisible()&&
    await desktop.locator('.fs-toolbar').isVisible()&&await desktop.locator('.fs-menu').count()===0,
    'direct title actions and one testing toolbar without redundant grouped menus');
  check('UI-002',await desktop.locator('.fs-project [role=treeitem]').count()>=4,'nested project tree');
  check('UI-003',await desktop.locator('.fs-frame').count()===4,'2x2 Visual Area');
  check('UI-004',await desktop.locator('.fs-bottom-cell').count()===2,'messages and strategy');
  check('UI-HEADER-CONNECT',await desktop.locator('.fs-titlebar #fs-instrument-link').count()===1&&
    await desktop.locator('.fs-toolbar #fs-instrument-link').count()===0,'Connect pinned in titlebar, not scrolled toolbar');
  check('SAFE-001',await desktop.locator('#fs-measure').isDisabled()&&await desktop.locator('#fs-repeat').isDisabled(),'no hardware output enabled');
  await desktop.locator('.fs-toolbar button[data-command="edit"]').click();
  check('NONE-HIDDEN',await desktop.locator('.fs-terminal').count()===0&&
    await desktop.locator('.fs-no-ports').isVisible(),
    'Unassigned None terminals are not in the Page parameter UI');
  await desktop.locator('button[data-action="cancel"]').last().click();
  await seedVisualSMUs(desktop);
  await desktop.locator('.fs-toolbar button[data-command="edit"]').click();
  await desktop.screenshot({path:path.join(out,'02-edit-page-sweep.png'),fullPage:true});
  const editor=desktop.locator('.fs-editor');
  check('UI-007',JSON.stringify(await editor.locator('.fs-info label').allTextContents())===JSON.stringify(['Type:','Polarity:','Group:','Test Type:','Name:']),'Info field order');
  const buttons=await editor.locator('.fs-editor-controls button').allTextContents();
  check('UI-008',JSON.stringify(buttons)===JSON.stringify(['Lock','Reset','Set Connection','AutoScale','UnScale']),'command order');
  check('UI-009',JSON.stringify(await editor.locator('.fs-tabs button').allTextContents())===JSON.stringify(['Sweep','Target','Strategy']),'tab order');
  check('UI-010',await editor.locator('.fs-sweep-head').isVisible()&&await editor.locator('.fs-terminal-list').isVisible(),'RefNode/Outputs above terminals');
  const fieldTrace=await desktop.evaluate(()=>({
    total:document.querySelectorAll('.fs-editor [data-bind]').length,
    missing:[...document.querySelectorAll('.fs-editor [data-bind]')].filter(el=>!/^(18|19|20|21)$/.test(el.dataset.fsProManualPage||'')).map(el=>el.dataset.bind)
  }));
  check('UI-034-TRACE',fieldTrace.total>=35&&fieldTrace.missing.length===0,'field traceability: '+JSON.stringify(fieldTrace));
  check('UI-011',await editor.locator('.fs-terminal').count()===4,'stacked terminals');
  check('FS-PRO-TWO-ROW-GROUPS',await desktop.evaluate(()=>{
   const cards=[...document.querySelectorAll('.fs-terminal')];
   return cards.length===4&&cards.every(card=>{
    const ref=card.querySelector('.fs-terminal-reference')?.getBoundingClientRect();
    const range=card.querySelector('.fs-terminal-range')?.getBoundingClientRect();
    const outer=card.getBoundingClientRect();
    return ref&&range&&Math.abs(ref.top-range.top)<3&&
      ref.left>=outer.left-2&&range.right<=outer.right+2;
   });
  }),'desktop reference/scan role and measurement range share an aligned second row');
  check('FS-PRO-NO-CLICK-SHADOW',await desktop.evaluate(()=>{
   const button=document.querySelector('.fs-editor-controls [data-action="lock"]');
   button.focus();
   return getComputedStyle(button).boxShadow==='none';
  }),'button focus is not rendered as a click-shadow halo');
  check('RANGE-PER-TERMINAL',await editor.locator('.fs-terminal-range').count()===4&&
    await editor.locator('select[data-bind$=".measureRange.mode"]').count()===4&&
    await editor.locator('input[data-bind$=".measureRange.value"]').count()===4&&
    await editor.locator('select[data-range-preset]').count()===4,
    'all four D/G/S/B terminals expose mode, preset and custom scientific measurement range');
  check('RANGE-DEFAULT-AUTO',await editor.locator('input[data-bind$=".measureRange.value"]:disabled').count()===4,
    'auto mode does not expose misleading editable fixed current range');
  const sweepGeometry=await desktop.evaluate(()=>{
   const list=document.querySelector('.fs-terminal-list');
   const last=list?.querySelector('.fs-terminal:last-child');
   const ref=document.querySelector('.fs-sweep-head select[data-bind="refNode"]');
   const triptych=document.querySelector('.fs-triptych');
   const listRect=list?.getBoundingClientRect(),lastRect=last?.getBoundingClientRect(),bottom=triptych?.getBoundingClientRect();
   return {listClient:list?.clientHeight,listScroll:list?.scrollHeight,
     listBottom:listRect?.bottom,lastBottom:lastRect?.bottom,triptychTop:bottom?.top,refWidth:ref?.getBoundingClientRect().width};
  });
  check('UI-011-VISIBLE',sweepGeometry.listClient>150&&
    sweepGeometry.listBottom<=sweepGeometry.triptychTop-2&&
    sweepGeometry.listScroll>=sweepGeometry.listClient,
    'terminal parameters form a bounded, independently scrollable FS-Pro list: '+JSON.stringify(sweepGeometry));
  check('UI-010-REFNODE',sweepGeometry.refWidth>=68,'RefNode selection not collapsed: '+JSON.stringify(sweepGeometry));
  check('UI-012',await desktop.evaluate(()=>{const x=window.DK4200FSPro.getDraft().terminals.filter(t=>t.role==='X');const p=window.DK4200FSPro.getDraft().terminals.filter(t=>t.role==='P');return x.length===1&&p.length===1;}),'one X one P');
  const triptych=await editor.locator('.fs-triptych > .fs-triptych-panel h3').allTextContents();
  check('UI-014',JSON.stringify(triptych)===JSON.stringify(['Limits','Page Var','Associate Spec']),'bottom three panels');
  check('UI-015',await editor.locator('input[aria-label="D current compliance"]').count()===1,'voltage source current compliance');
  check('SAFE-002',await desktop.evaluate(()=>window.DK4200FSPro.validate().executionAuthorized===false),'offline cannot authorize instrument');
  check('UI-008-UNLOCK',await editor.locator('button[data-action="lock"]').innerText().then(x=>x==='Lock')&&
    await editor.locator('input[data-bind="terminals[0].bias"]').isEnabled(),
    'Page is editable by default, without unlocking');
  await editor.locator('select[data-bind="terminals[0].measureRange.mode"]').selectOption('fixed');
  check('RANGE-MODE-FIXED',await editor.locator('input[data-bind="terminals[0].measureRange.value"]').isEnabled(),
    'per-terminal fixed range unlocks user-entered numeric control');
  await editor.locator('select[data-range-preset="0"]').selectOption('1e-9');
  check('RANGE-PRESET-SCIENTIFIC',await desktop.evaluate(()=>
    window.DK4200FSPro.getDraft().terminals[0].measureRange.value==='1e-9'),
    '1e-9 preset stores exact scientific notation');
  await editor.locator('input[data-bind="terminals[0].measureRange.value"]').fill('2e-9');
  check('RANGE-CUSTOM-INPUT',await desktop.evaluate(()=>
    window.DK4200FSPro.getDraft().terminals[0].measureRange.value==='2e-9'&&
    window.DK4200FSPro.validate().executionAuthorized===false),
    'software custom range is saved offline without claiming hardware execution');
  check('RANGE-MODE-OPTIONS',await editor.locator('select[data-bind="terminals[0].measureRange.mode"] option').evaluateAll(nodes=>
    nodes.map(n=>n.value).join(',')==='auto,minimum,fixed'),
    'auto / current autorange floor / immediate range remain distinct');
  await editor.locator('select[data-bind="terminals[0].measureRange.mode"]').selectOption('minimum');
  check('RANGE-FLOOR-EDITABLE',await editor.locator('input[data-bind="terminals[0].measureRange.value"]').isEnabled(),
    'current autorange floor allows a software-defined range');
  await editor.locator('select[data-range-preset="0"]').selectOption('1e-8');
  check('RANGE-FLOOR-PRESET-MODE',await desktop.evaluate(()=>{
    const r=window.DK4200FSPro.getDraft().terminals[0].measureRange;
    return r.mode==='minimum'&&r.value==='1e-8';
  }),'preset must not silently switch the current autorange floor to fixed');
  await editor.locator('select[data-bind="terminals[0].measureRange.mode"]').selectOption('fixed');
  await desktop.screenshot({path:path.join(out,'17-terminal-fixed-range-config.png'),fullPage:true});
  await editor.locator('select[data-bind="terminals[0].sourceMode"]').selectOption('current');
  const voltageChoices=await editor.locator('select[data-range-preset="0"] option').evaluateAll(items=>items.map(x=>x.value));
  check('CURRENT-SOURCE-VOLTAGE-PRESETS',voltageChoices.join(',')===",2e-1,2e0,2e1,2e2",
    'current-sourced terminals must offer voltage rather than 1 pA current presets');
  check('CURRENT-SOURCE-AUTO-FLOOR-DISABLED',await editor.locator('select[data-bind="terminals[0].measureRange.mode"] option[value="minimum"]').isDisabled(),
    'KXCI RG current autorange floor must not be offered for voltage measurement');
  check('CURRENT-SOURCE-UNIT-RESET',await desktop.evaluate(()=>{
    const v=window.DK4200FSPro.getDraft().terminals[0];
    return v.sourceMode==='current'&&v.measureRange.mode==='auto'&&v.measureRange.value==='2e0';
  }),'source-mode change revokes stale ampere ranges');
  await editor.locator('select[data-bind="terminals[0].sourceMode"]').selectOption('voltage');
  check('VOLTAGE-SOURCE-UNIT-RESET',await desktop.evaluate(()=>{
    const v=window.DK4200FSPro.getDraft().terminals[0];
    return v.sourceMode==='voltage'&&v.measureRange.mode==='auto'&&v.measureRange.value==='1e-6';
  }),'returning to voltage sourcing restores automatic current measurement range');

  await editor.locator('button[data-action="add-segment"]').first().click();
  check('UI-013',await editor.locator('.fs-terminal').first().locator('.fs-segment-row').count()===1,'segment stays under terminal');
  await editor.locator('button[data-action="remove-segment"]').first().click();
  check('UI-013b',await editor.locator('.fs-terminal').first().locator('.fs-segment-row').count()===0,'delete segment');
  await editor.locator('button[data-action="tab"][data-tab="Target"]').click();
  await desktop.screenshot({path:path.join(out,'03-edit-page-target.png'),fullPage:true});
  const targetGeometry=await desktop.evaluate(()=>{
   const area=document.querySelector('.fs-tab-content')?.getBoundingClientRect();
   const triptych=document.querySelector('.fs-target .fs-triptych')?.getBoundingClientRect();
   return {areaBottom:area?.bottom,triptychBottom:triptych?.bottom};
  });
  check('UI-016-BOTTOM',Math.abs(targetGeometry.areaBottom-targetGeometry.triptychBottom)<17,'Target lower panels align to bottom: '+JSON.stringify(targetGeometry));
  check('UI-016',await editor.locator('.fs-target textarea').isVisible()&&await editor.locator('.fs-target .fs-triptych').isVisible(),'equation and lower panels');
  check('UI-017',await editor.locator('.fs-function-info').isVisible()&&await editor.locator('.fs-plot-options input').count()===4,'function info, X/Y/H/P');
  await editor.locator('button[data-action="tab"][data-tab="Strategy"]').click();
  await desktop.screenshot({path:path.join(out,'04-edit-page-strategy.png'),fullPage:true});
  check('UI-018',await editor.locator('select[data-bind="strategy.scope"]').isVisible(),'global/local strategy');
  await editor.locator('button[data-action="connection"]').click();
  await desktop.screenshot({path:path.join(out,'05-set-connection.png'),fullPage:true});
  check('UI-019',await desktop.locator('.fs-connection-table tr').count()===5,'separate connection mapping dialog');
  check('UI-020',await desktop.locator('.fs-connection-footer').innerText().then(x=>/共享|shared/i.test(x)),'shared preset warning preserved in either locale');
  check('UI-031',await desktop.locator('select[data-bind="terminals[0].resource"] option').allTextContents().then(xs=>xs.length===5&&xs[0]==='None'),'no fictitious unverified modules');
  await desktop.locator('button[data-action="close-connection"]').last().click();
  check('CONNECTION-PAGE-RETURN',await desktop.locator('.fs-editor[aria-label="Edit Page"]').count()===1,
    'Connection opened from Page returns to Page');
  await desktop.locator('button[data-action="cancel"]').last().click();
  await desktop.locator('.fs-toolbar [data-command="connection"]').click();
  check('CONNECTION-TOOLBAR',await desktop.locator('.fs-connection-dialog').isVisible(),
    'toolbar opens standalone Connection dialog');
  await desktop.locator('button[data-action="close-connection"]').last().click();
  check('CONNECTION-TOOLBAR-CLOSE',await desktop.locator('#fs-modal-host .fs-editor').count()===0,
    'standalone Connection close must not open Edit Page');
  check('SAFE-003',await desktop.locator('.fs-editor').count()===0,'cancel closes and reverts draft');
  await desktop.locator('#fs-add-test').click();
  check('PROJECT-TEST-PICKER',await desktop.locator('.fs-test-picker [data-action="create-test"]').count()===5,
    'Project navigation exposes five explicit test types');
  await desktop.locator('.fs-test-picker [data-test-type="pulse"]').click();
  check('PROJECT-ADD-PULSE',await desktop.evaluate(()=>
    document.querySelectorAll('#fs-page-list [data-command="select-page"]').length===2&&
    window.DK4200FSPro.getDraft().info.testType==='Pulse'&&
    document.querySelector('#fs-toolbar-page-name').textContent==='Pulse Sweep'),
    'adding Pulse creates a selectable offline Page, not fake live measurement');
  await desktop.locator('#fs-page-list [data-page-id="page-1"]').click();
  check('PROJECT-SELECT-DC',await desktop.evaluate(()=>
    window.DK4200FSPro.getDraft().info.testType==='DC'&&
    document.querySelector('#fs-toolbar-page-name').textContent==='IV Sweep'),
    'selecting Page 1 changes the active parameters');
  await desktop.locator('#fs-page-list [data-page-id="page-2"]').click();
  const projectDownload=desktop.waitForEvent('download');
  await desktop.locator('.fs-title-actions [data-command="save"]').click();
  const savedProject=await projectDownload;
  const savedProjectData=fs.readFileSync(await savedProject.path(),'utf8');
  const savedProjectJSON=JSON.parse(savedProjectData);
  check('PROJECT-MULTI-SAVE',savedProjectJSON.schema==='dkts.fspro.project.v1'&&
    savedProject.suggestedFilename()==='4200A-project.json'&&
    savedProjectJSON.pages.length===2&&savedProjectJSON.activePageId==='page-2',
    'project JSON persists multiple tests and active selection');
  await desktop.locator('.fs-title-actions [data-command="new"]').click();
  check('PROJECT-RESET',await desktop.locator('#fs-page-list [data-command="select-page"]').count()===1,
    'New Project resets the Page list');
  await desktop.locator('#fs-open-input').setInputFiles({
    name:'persisted-offline-project.json',mimeType:'application/json',buffer:Buffer.from(savedProjectData)
  });
  await desktop.waitForFunction(()=>
    document.querySelectorAll('#fs-page-list [data-command="select-page"]').length===2&&
    window.DK4200FSPro.getDraft().info.testType==='Pulse'&&
    document.querySelector('#fs-toolbar-page-name')?.textContent==='Pulse Sweep',{timeout:10000});
  check('PROJECT-RESTORE',await desktop.evaluate(()=>
    document.querySelectorAll('#fs-page-list [data-command="select-page"]').length===2&&
    window.DK4200FSPro.getDraft().info.testType==='Pulse'&&
    document.querySelector('#fs-toolbar-page-name')?.textContent==='Pulse Sweep'),
    'project restore is asynchronous and must preserve the selected offline Pulse Page');
  const tampered=structuredClone(savedProjectJSON);
  tampered.pages[0].data.terminals[1].compliance='1000';
  await desktop.locator('#fs-open-input').setInputFiles({
    name:'unsafe-hidden-page.json',mimeType:'application/json',
    buffer:Buffer.from(JSON.stringify(tampered))
  });
  await desktop.waitForFunction(()=>
    document.querySelector('#fs-messages')?.textContent?.includes('导入失败'));
  check('PROJECT-REJECT-HIDDEN-OVERRANGE',await desktop.evaluate(()=>
    document.querySelectorAll('#fs-page-list [data-command="select-page"]').length===2&&
    window.DK4200FSPro.getDraft().info.testType==='Pulse'),
    'reject an unsafe inactive test Page without replacing the previous valid project');
  await desktop.close();
  const manual=await browser.newPage({viewport:{width:1080,height:770},deviceScaleFactor:1});
  await manual.goto(file+'?open=edit');
  await seedVisualSMUs(manual);
  await manual.evaluate(()=>window.DK4200FSPro.openEdit());
  await manual.screenshot({path:path.join(out,'07-edit-page-manual-1080x770.png'),fullPage:true});
  const manualGeometry=await manual.evaluate(()=>{
   const list=document.querySelector('.fs-terminal-list');
   const last=list?.querySelector('.fs-terminal:last-child');
   const lower=document.querySelector('.fs-triptych');
   return {listBottom:list?.getBoundingClientRect().bottom,lastBottom:last?.getBoundingClientRect().bottom,
    lowerTop:lower?.getBoundingClientRect().top,scrollHeight:list?.scrollHeight,clientHeight:list?.clientHeight};
  });
  check('UI-033-REFERENCE-VIEWPORT',manualGeometry.listBottom<manualGeometry.lowerTop&&manualGeometry.clientHeight>200&&manualGeometry.scrollHeight>=manualGeometry.clientHeight,
    '1080×770 viewport keeps terminal list separately scrollable above lower panels: '+JSON.stringify(manualGeometry));
  await manual.close();
  const rawPreview=await browser.newPage({viewport:{width:1200,height:850},deviceScaleFactor:1});
  const rawPageErrors=[];
  rawPreview.on('pageerror',err=>rawPageErrors.push(String(err.message||err)));
  await rawPreview.goto(file);
  const fixture={
   schema:'dkts.4200a.native.raw.v1',source:'keithley-4200a-kxci',
   instrumentId:'KEITHLEY INSTRUMENTS,KI4200A,OFFLINE-TEST,V0',
   captureId:'OFFLINE-IMPORT-QA',planHash:'b'.repeat(64),
   startedAt:'2026-11-08T00:00:00.000Z',status:'fault',
   columns:[{id:'voltage',label:'Voltage',unit:'V'},{id:'current',label:'Current',unit:'A'},
      {id:'time',label:'Instrument Time',unit:'s'}],
   samples:[
    {index:0,sweepId:'P0',voltage:'0.000000',current:'1.234567890123e-9',time:'0.0000000'},
    {index:1,sweepId:'P0',status:0,voltage:'0.100000',current:'1.240000000000e-9',time:'0.0100000',
     channelStatuses:{current:'N'},instrumentStatuses:{current:'0'}},
    {index:2,sweepId:'P0',status:1,voltage:'0.200000',current:'2.500000000000e-7',time:'0.0200000',
     channelStatuses:{current:'C'},instrumentStatuses:{current:'1'}}
   ],
   rawFrames:[{command:"DO 'I1'",readOrder:0,payloadBase64:Buffer.from('1,2,3').toString('base64')}]
  };
  await rawPreview.locator('#fs-raw-input').setInputFiles({
    name:'offline-4200a-capture-fixture.json',mimeType:'application/json',
    buffer:Buffer.from(JSON.stringify(fixture))
  });
  await rawPreview.waitForFunction(()=>document.getElementById('fs-messages').textContent.includes('OFFLINE-IMPORT-QA'),{timeout:10000});
  await rawPreview.locator('#fs-frame-4 [data-command="data-viewer"]').click();
  const viewer=rawPreview.locator('#fs-data-host');
  check('RAW-UI-OPEN',await viewer.locator('.fs-data-dialog').isVisible(),
    'offline imported native raw capture renders in Data Viewer');
  const cells=await viewer.locator('tbody tr').allTextContents();
  check('RAW-UI-STATUS-UNKNOWN',cells[0].includes('未知')&&!cells[0].includes('null'),
    'unprovided native status remains explicitly unknown');
  check('RAW-UI-STATUS-COMPLIANCE',cells[2].includes('限流 (C)'),'actual C compliance shown');
  check('RAW-UI-STATUS-COLUMNS',await viewer.locator('thead').textContent().then(x=>x.includes('N/C')&&x.includes('仪器状态')),
    'raw channel statuses visible');
  const dialogBounds=await rawPreview.evaluate(()=>{
    const d=document.querySelector('#fs-data-host .fs-data-dialog').getBoundingClientRect();
    const last=document.querySelector('#fs-data-host .fs-data-table tbody tr:last-child').getBoundingClientRect();
    const pane=document.querySelector('#fs-data-host .fs-data-table-wrap').getBoundingClientRect();
    return {height:d.height,rowBottom:last.bottom,paneBottom:pane.bottom};
  });
  check('RAW-UI-COMPACT',dialogBounds.height>=225&&dialogBounds.height<=360&&
    dialogBounds.rowBottom<=dialogBounds.paneBottom+2,'3 rows should not create giant empty modal: '+JSON.stringify(dialogBounds));
  check('RAW-UI-PRECISION',cells[0].includes('1.234567890123e-9'),'original instrument numeric text preserved');
  const nativeDownloadEvent=rawPreview.waitForEvent('download');
  await viewer.locator('[data-raw-action="export-native"]').click();
  const nativeDownload=await nativeDownloadEvent;
  const downloadedRaw=JSON.parse(fs.readFileSync(await nativeDownload.path(),'utf8'));
  check('RAW-EXPORT-ORIGINAL-FRAMES',
    nativeDownload.suggestedFilename()==='OFFLINE-IMPORT-QA.raw.json'&&
    downloadedRaw.rawFrames[0].payloadBase64===fixture.rawFrames[0].payloadBase64&&
    downloadedRaw.samples[0].current===fixture.samples[0].current,
    'downloaded JSON must retain original KXCI reply bytes and exact scientific numeric text');
  const csvDownloadEvent=rawPreview.waitForEvent('download');
  await viewer.locator('[data-raw-action="export"]').click();
  const csvDownload=await csvDownloadEvent;
  const downloadedCsv=fs.readFileSync(await csvDownload.path(),'utf8');
  check('RAW-EXPORT-COMPLETE-CSV',
    csvDownload.suggestedFilename()==='OFFLINE-IMPORT-QA.csv'&&
    downloadedCsv.includes('1.234567890123e-9')&&
    downloadedCsv.includes('2.500000000000e-7'),
    'CSV keeps the original source numeric strings and all offline-fixture samples');
  check('RAW-UI-NO-ERRORS',rawPageErrors.length===0,'raw import page errors: '+rawPageErrors.join('; '));
  await rawPreview.screenshot({path:path.join(out,'11-raw-data-viewer-offline-fixture.png'),fullPage:true});
  await rawPreview.setViewportSize({width:430,height:900});
  const mobileRawFooter=await rawPreview.evaluate(()=>{
    const buttons=[...document.querySelectorAll('#fs-data-host .fs-editor-footer button')];
    const dialog=document.querySelector('#fs-data-host .fs-data-dialog').getBoundingClientRect();
    const boxes=buttons.map(x=>x.getBoundingClientRect());
    return {count:buttons.length,dialogWidth:dialog.width,
      allInside:boxes.every(b=>b.left>=dialog.left-2&&b.right<=dialog.right+2),
      sameHeight:Math.max(...boxes.map(b=>b.height))-Math.min(...boxes.map(b=>b.height))<2};
  });
  check('RAW-EXPORT-MOBILE-BUTTONS',
    mobileRawFooter.count===3&&mobileRawFooter.allInside&&mobileRawFooter.sameHeight,
    'CSV, raw JSON, close must remain visible in the mobile Data Viewer: '+JSON.stringify(mobileRawFooter));
  await rawPreview.screenshot({path:path.join(out,'19-mobile-raw-data-export.png'),fullPage:true});

  await rawPreview.close();
  const mobile=await browser.newPage({viewport:{width:430,height:900},deviceScaleFactor:1,isMobile:true,hasTouch:true});
  await mobile.goto(file);
  const mobileFrameLayout=await mobile.evaluate(()=>{
    const grid=document.querySelector('.fs-frames'),select=document.querySelector('#fs-plot-layout');
    return {layout:grid.dataset.layout,selection:select.value,
      visible:[...grid.querySelectorAll('.fs-frame')].filter(x=>getComputedStyle(x).display!=='none').length,
      width:document.documentElement.clientWidth,
      hasRedundantTabs:!!document.querySelector('#fs-mobile-plot-tabs')};
  });
  check('MOBILE-PLOT-SINGLE',mobileFrameLayout.layout==='single'&&mobileFrameLayout.selection==='0'&&
    mobileFrameLayout.visible===1&&!mobileFrameLayout.hasRedundantTabs,
    'Mobile portrait uses titlebar dropdown and one original Frame: '+JSON.stringify(mobileFrameLayout));
  await mobile.screenshot({path:path.join(out,'14-mobile-single-frame-zh.png'),fullPage:true});
  await mobile.evaluate(()=>window.DK4200MobileFrames.select(3));
  const dataTab=await mobile.evaluate(()=>({
    selection:document.querySelector('#fs-plot-layout').value,
    visible:[...document.querySelectorAll('.fs-frame')].filter(x=>getComputedStyle(x).display!=='none').map(x=>x.id)
  }));
  check('MOBILE-PLOT-DATA-TAB',dataTab.selection==='3'&&dataTab.visible.join(',')==='fs-frame-4',
    'Data view selected via Visual Area subwindow dropdown');
  await mobile.screenshot({path:path.join(out,'15-mobile-data-tab.png'),fullPage:true});
  const rotated=await browser.newPage({viewport:{width:430,height:900},hasTouch:true});
  await rotated.goto(file);
  await rotated.evaluate(()=>window.DK4200MobileFrames.select(3));
  await rotated.setViewportSize({width:920,height:560});
  const landscape=await rotated.evaluate(()=>({
    layout:document.querySelector('.fs-frames').dataset.layout,
    visible:[...document.querySelectorAll('.fs-frame')].filter(x=>getComputedStyle(x).display!=='none').length
  }));
  check('MOBILE-LANDSCAPE-2X2',landscape.visible===1,
    'Manually selected subwindow remains selected across orientation: '+JSON.stringify(landscape));
  await rotated.evaluate(()=>window.DK4200MobileFrames.setLayout('grid'));
  check('MOBILE-LANDSCAPE-GRID',await rotated.evaluate(()=>
    [...document.querySelectorAll('.fs-frame')].filter(x=>getComputedStyle(x).display!=='none').length===4),
    'Choose 2x2 explicitly using the same heading layout selector');
  await rotated.setViewportSize({width:430,height:900});
  await rotated.evaluate(()=>window.DK4200MobileFrames.select(2));
  check('MOBILE-ROTATION-PRESERVES-SELECTED',await rotated.evaluate(()=>
    document.querySelector('#fs-plot-layout').value==='2'&&document.querySelector('.fs-frames').dataset.layout==='single'),
    'user can restore I–t after orientation change');
  const trigger=rotated.locator('.fs-plot-layout-wrap .fs-select-trigger');
  await trigger.click();
  check('MOBILE-PLOT-DROPDOWN-ANCHORED',await rotated.evaluate(()=>{
    const anchor=document.querySelector('.fs-plot-layout-wrap .fs-select-trigger').getBoundingClientRect();
    const popup=document.querySelector('.fs-select-popover')?.getBoundingClientRect();
    return !!popup&&popup.top>=6&&popup.bottom<=window.innerHeight+1&&popup.left>=6&&
      popup.right<=window.innerWidth+1&&
      (Math.abs(popup.top-anchor.bottom)<14||Math.abs(popup.bottom-anchor.top)<14);
  }),'custom dropdown opens near actual heading trigger, not at screen bottom');
  await rotated.keyboard.press('Escape');
  await rotated.close();
  await mobile.evaluate(()=>window.DK4200MobileFrames.select(0));
  const mobileRaw=await browser.newPage({viewport:{width:430,height:900},deviceScaleFactor:1,isMobile:true,hasTouch:true});
  const mobileFrameErrors=[];mobileRaw.on('pageerror',err=>mobileFrameErrors.push(String(err.message||err)));
  await mobileRaw.goto(file);
  await mobileRaw.locator('#fs-raw-input').setInputFiles({
    name:'offline-native-plot-fixture.json',mimeType:'application/json',
    buffer:Buffer.from(JSON.stringify(fixture))
  });
  await mobileRaw.waitForFunction(()=>document.querySelector('#fs-messages')?.textContent.includes('OFFLINE-IMPORT-QA'),{timeout:10000});
  await mobileRaw.evaluate(()=>window.DK4200MobileFrames.select(2));
  await mobileRaw.waitForTimeout(500);
  const timeFrame=await mobileRaw.evaluate(()=>{
    const card=document.getElementById('fs-frame-3');
    return {active:card?.dataset.mobileActive,
      visualCount:card?.querySelectorAll('svg,canvas').length||0,
      data:document.querySelector('#fs-messages')?.textContent};
  });
  check('MOBILE-PLOT-REFRESH',timeFrame.active==='true'&&timeFrame.visualCount>0,
    'selecting hidden I–t frame must redraw original native time/current trace: '+JSON.stringify(timeFrame));
  const axisTicks=await mobileRaw.evaluate(()=>{
    const card=document.getElementById('fs-frame-3');
    const labels=[...card.querySelectorAll('.dkds-d3-y-axis .tick text')];
    const bounds=card.getBoundingClientRect();
    return {labels:labels.map(x=>x.textContent),
      minimumLeft:Math.min(...labels.map(x=>x.getBoundingClientRect().left)),
      plotLeft:bounds.left};
  });
  check('MOBILE-PLOT-SCIENTIFIC-TICKS',
    axisTicks.labels.some(x=>/e-[0-9]+/.test(x))&&
    !axisTicks.labels.some(x=>/0\\.0{5,}[1-9]/.test(x))&&
    axisTicks.minimumLeft>=axisTicks.plotLeft-1,
    'nanoamp current ticks must use scientific notation and remain visible: '+JSON.stringify(axisTicks));
  check('MOBILE-STATUS-NO-DUPLICATE',await mobileRaw.evaluate(()=>{
    const status=document.querySelector('#fs-bottom-status');
    const log=document.querySelector('#fs-messages');
    return !status.textContent.includes('OFFLINE-IMPORT-QA')&&
      log.textContent.includes('OFFLINE-IMPORT-QA')&&
      status.getBoundingClientRect().height<=28;
   }), 'raw import details belong to the log, not repeated in one-line bottom connection status');
  await mobileRaw.setViewportSize({width:920,height:560});
  await mobileRaw.evaluate(()=>window.DK4200MobileFrames.setLayout('grid'));
  await mobileRaw.waitForTimeout(550);
  const rotatedRaw=await mobileRaw.evaluate(()=>({
    first:document.querySelectorAll('#fs-frame-1 svg').length,
    third:document.querySelectorAll('#fs-frame-3 svg').length,
    visible:[...document.querySelectorAll('.fs-frame')].filter(x=>getComputedStyle(x).display!=='none').length
  }));
  check('MOBILE-ROTATION-REPLOTS-RAW',rotatedRaw.first>0&&rotatedRaw.third>0&&rotatedRaw.visible===4,
    'landscape restores hidden original I–V and I–t plots: '+JSON.stringify(rotatedRaw));
  await mobileRaw.setViewportSize({width:430,height:900});
  await mobileRaw.waitForTimeout(250);
  check('MOBILE-PLOT-NO-SYNTHETIC',mobileFrameErrors.length===0,
    'raw-data responsive plotting JS errors: '+mobileFrameErrors.join(' | '));
  await mobileRaw.screenshot({path:path.join(out,'16-mobile-original-time-plot.png'),fullPage:true});
  // The next capture may have no time channel; clear the previous I-t SVG.
  await mobileRaw.evaluate(()=>window.DK4200MobileFrames.select(2));
  const noTime={
    ...fixture,captureId:'OFFLINE-IMPORT-NOTIME',
    columns:fixture.columns.filter(column=>column.id!=='time'),
    samples:fixture.samples.map(({time,...sample})=>sample)
  };
  await mobileRaw.locator('#fs-raw-input').setInputFiles({
    name:'offline-native-without-time.json',mimeType:'application/json',
    buffer:Buffer.from(JSON.stringify(noTime))
  });
  await mobileRaw.waitForFunction(()=>
    document.querySelector('#fs-messages')?.textContent.includes('OFFLINE-IMPORT-NOTIME'),{timeout:10000});
  check('MOBILE-PLOT-STALE-CLEARED',await mobileRaw.evaluate(()=>{
    const card=document.querySelector('#fs-frame-3');
    return card?.querySelectorAll('svg,canvas').length===0&&
      card?.querySelector('.fs-empty-hint')?.textContent.includes('没有此图所需的通道');
  }),'when the new raw capture has no time channel, clear the old I-t trace');
  const restored={...fixture,captureId:'OFFLINE-IMPORT-RESTORED'};
  await mobileRaw.locator('#fs-raw-input').setInputFiles({
    name:'offline-native-time-restored.json',mimeType:'application/json',
    buffer:Buffer.from(JSON.stringify(restored))
  });
  await mobileRaw.waitForFunction(()=>
    document.querySelector('#fs-messages')?.textContent.includes('OFFLINE-IMPORT-RESTORED'),{timeout:10000});
  check('MOBILE-PLOT-RECOVERS',await mobileRaw.evaluate(()=>
    document.querySelector('#fs-frame-3 svg')!==null),
    'restoring time channel redraws original instrument I-t without reopening');
  await mobileRaw.close();
  check('MOBILE-DEFAULT-ZH',await mobile.evaluate(()=>
    document.documentElement.lang==='zh-CN'&&!document.querySelector('#fs-mobile-menu-toggle')&&
    document.querySelector('#fs-language-switch')?.closest('footer')!==null),
    'one Chinese mobile shell with language control in bottom status');
  check('MOBILE-COMPACT-MENU',await mobile.evaluate(()=>
    document.querySelector('.fs-title-actions')!==null&&document.querySelector('.fs-menu')===null),
    'no menu collection or obsolete Help/Window buttons');
  const toolbarCompact=await mobile.evaluate(()=>{
    const bar=document.querySelector('.fs-toolbar');
    return {client:bar.clientWidth,scroll:bar.scrollWidth,
      buttons:[...bar.querySelectorAll('button')].filter(x=>getComputedStyle(x).display!=='none')
        .map(x=>x.dataset.command||x.id)};
  });
  check('MOBILE-COMPACT-TOOLBAR',toolbarCompact.scroll<=toolbarCompact.client+2&&
    toolbarCompact.buttons.includes('edit')&&toolbarCompact.buttons.includes('connection')&&
    !toolbarCompact.buttons.includes('new'),
    'no duplicate file operations and terminal settings accessible: '+JSON.stringify(toolbarCompact));
  const mobilePageName=await mobile.evaluate(()=>{
    const caption=document.querySelector('.fs-toolbar-caption');
    const name=document.querySelector('#fs-toolbar-page-name');
    const prefix=document.querySelector('.fs-toolbar-page-prefix');
    return {page:name?.textContent?.trim(),shown:name?.getBoundingClientRect().width,
      available:caption?.getBoundingClientRect().width,
      prefixHidden:prefix?getComputedStyle(prefix).display==='none':false};
  });
  check('MOBILE-FULL-PAGE-NAME',mobilePageName.page==='IV Sweep'&&mobilePageName.prefixHidden&&
    mobilePageName.shown<=mobilePageName.available+1,
    'show complete selected test name without clipped current-page prefix: '+JSON.stringify(mobilePageName));
  await mobile.screenshot({path:path.join(out,'12-mobile-title-actions-zh.png'),fullPage:true});
  await mobile.goto(file+'?open=edit');
  await seedVisualSMUs(mobile);
  await mobile.evaluate(()=>window.DK4200FSPro.openEdit());
  check('MOBILE-MODAL-ZH',await mobile.locator('.fs-editor-title').textContent().then(x=>x.includes('编辑页面')),
    'editor title localized by default');
  check('MOBILE-MODAL-LANGUAGE',await mobile.locator('.fs-editor [data-fs-locale-switch]').count()===0,
    'no duplicated modal language button');
  check('MOBILE-EDITOR-ACTIONS-ONE-ROW',await mobile.evaluate(()=>{
    const buttons=[...document.querySelectorAll('.fs-editor-controls button')];
    const bounds=buttons.map(button=>button.getBoundingClientRect());
    const viewport=document.documentElement.clientWidth;
    return buttons.length===5&&bounds.every(b=>Math.abs(b.top-bounds[0].top)<2)&&
      bounds.every(b=>b.width>=48&&b.right<=viewport+1)&&
      Math.max(...bounds.map(b=>b.height))-Math.min(...bounds.map(b=>b.height))<2;
  }),'all five page actions have equal height and remain in one row on mobile');
  await mobile.screenshot({path:path.join(out,'06-edit-page-narrow.png'),fullPage:true});
  await mobile.evaluate(()=>window.DKTSLocale.setLanguage('en'));
  check('MOBILE-EN',await mobile.evaluate(()=>
    window.DKTSLocale.getLanguage()==='en'&&
    document.querySelector('.fs-tabs button')?.textContent==='Sweep'),
    'full form translation changes no data-bind values');
  check('UI-030',await mobile.locator('.fs-info').isVisible()&&await mobile.locator('.fs-triptych-panel').count()===3,'mobile preserves three panels and original order');
  const connectPin=await mobile.evaluate(()=>{
    const button=document.querySelector('.fs-titlebar #fs-instrument-link'),title=document.querySelector('.fs-titlebar');
    const b=button?.getBoundingClientRect(),t=title?.getBoundingClientRect();
    return {visible:!!b&&b.width>=42&&b.right<=t.right+1,bottom:b?.bottom,titleBottom:t?.bottom};
  });
  check('UI-MOBILE-CONNECT-PIN',connectPin.visible&&connectPin.bottom<=connectPin.titleBottom+1,
    'Connect control must stay visible without toolbar scrolling: '+JSON.stringify(connectPin));
  const metrics=await mobile.evaluate(()=>({
   width:document.documentElement.clientWidth,
   bodyScroll:document.documentElement.scrollWidth,
   terminalCount:document.querySelectorAll('.fs-terminal').length,
   tabs:Array.from(document.querySelectorAll('.fs-tabs button')).map(x=>x.textContent)
  }));
  check('UI-035',metrics.terminalCount===4&&metrics.tabs.join(',')==='Sweep,Target,Strategy','same terminal and tab composition');
  const mobileShape=await mobile.evaluate(()=>{
    const viewport=document.documentElement.clientWidth;
    const list=document.querySelector('.fs-terminal-list');
    const fields=[...document.querySelectorAll('.fs-terminal .fs-generator-values input,.fs-sweep-head input,.fs-sweep-head select')];
    const box=list.getBoundingClientRect();
    return {
      viewport,
      pageWidth:document.documentElement.scrollWidth,
      listWidth:box.width,
      overflowFields:fields.map(el=>({name:el.getAttribute('data-bind'),right:Math.round(el.getBoundingClientRect().right)}))
        .filter(el=>el.right>viewport+2),
      panelScroll:document.querySelector('.fs-triptych').scrollWidth-document.querySelector('.fs-triptych').clientWidth
    };
  });
  const sweepHead=await mobile.evaluate(()=>{
    const kids=[...document.querySelector('.fs-sweep-head').children];
    return kids.map(el=>{const r=el.getBoundingClientRect();return {text:el.textContent?.slice(0,30),left:r.left,right:r.right,top:r.top,bottom:r.bottom};});
  });
  check('UI-MOBILE-OUTPUT-LAYOUT',sweepHead.length===4&&
    sweepHead[2].top>=sweepHead[0].bottom-1&&
    sweepHead.every(el=>el.right<=mobileShape.viewport+2),
    'Outputs must appear in a readable second row: '+JSON.stringify(sweepHead));
  check('UI-MOBILE-FIELD-FIT',mobileShape.overflowFields.length===0,
    'No mobile Sweep inputs may be cut off: '+JSON.stringify(mobileShape));
  check('UI-MOBILE-TRIPTYCH-SCROLL',mobileShape.panelScroll>50,
    'All 3 lower panes must be horizontally scrollable: '+JSON.stringify(mobileShape));
  await mobile.locator('.fs-terminal').last().scrollIntoViewIfNeeded();
  const bVisible=await mobile.evaluate(()=>{
    const last=document.querySelector('.fs-terminal:last-child').getBoundingClientRect();
    const list=document.querySelector('.fs-terminal-list').getBoundingClientRect();
    return {top:last.top,bottom:last.bottom,listTop:list.top,listBottom:list.bottom,left:last.left,right:last.right,
      viewport:document.documentElement.clientWidth};
  });
  check('UI-MOBILE-LAST-TERMINAL',
    bVisible.top>=bVisible.listTop-3&&bVisible.bottom<=bVisible.listBottom+3&&
    bVisible.left>=-2&&bVisible.right<=bVisible.viewport+2,
    'Final B terminal must be visible and within viewport after scroll: '+JSON.stringify(bVisible));
  await mobile.screenshot({path:path.join(out,'09-mobile-last-terminal.png'),fullPage:true});
  await mobile.evaluate(()=>{
    const strip=document.querySelector('.fs-triptych');
    strip.scrollLeft=strip.scrollWidth;
    strip.dispatchEvent(new Event('scroll',{bubbles:true}));
  });
  await mobile.waitForTimeout(220);
  const lastPanel=await mobile.evaluate(()=>{
    const strip=document.querySelector('.fs-triptych').getBoundingClientRect();
    const last=document.querySelector('.fs-triptych-panel:last-child').getBoundingClientRect();
    return {stripLeft:strip.left,stripRight:strip.right,lastLeft:last.left,lastRight:last.right};
  });
  check('UI-MOBILE-SPEC-REACHABLE',
    lastPanel.lastLeft>=lastPanel.stripLeft-5&&lastPanel.lastRight<=lastPanel.stripRight+6,
    'Associate Spec panel must be reachable by swipe: '+JSON.stringify(lastPanel));
  await mobile.screenshot({path:path.join(out,'10-mobile-associate-spec.png'),fullPage:true});
  // Android-like browser UA runs the same original floating nine-grid keypad
  // without introducing a second numeric editor on desktop.
  const androidInput=await browser.newPage({
    viewport:{width:430,height:900},deviceScaleFactor:1,isMobile:true,hasTouch:true,
    userAgent:'Mozilla/5.0 (Linux; Android 16; OPD2515) AppleWebKit/537.36 Chrome/156.0 Mobile Safari/537.36'
  });
  const androidErrors=[];
  androidInput.on('pageerror',err=>androidErrors.push(String(err.message||err)));
  await androidInput.goto(file+'?open=edit');
  await seedVisualSMUs(androidInput);
  await androidInput.evaluate(()=>window.DK4200FSPro.openEdit());
  check('ANDROID-DEFAULT-EDITABLE',await androidInput.locator('input[data-bind="terminals[0].bias"]').isEnabled(),
    'Android Page defaults to unlocked');
  const bias=androidInput.locator('input[data-bind="terminals[0].bias"]');
  check('ANDROID-NUMERIC-BIND',await bias.isVisible()&&await bias.getAttribute('inputmode')==='none'&&
    await bias.getAttribute('readonly')!==null,
    'Android numeric PagePlan fields use the in-app keypad; OEM keyboard suppressed');
  await bias.click();
  check('ANDROID-KEYPAD-OPEN',await androidInput.locator('#dkts-numeric-keypad').isVisible()&&
    await androidInput.locator('.dkts-keypad-grid button').count()===12,
    'original 12-button numeric grid appears above editor');
  await androidInput.locator('#dkts-numeric-keypad [data-key="1"]').click();
  await androidInput.locator('#dkts-numeric-keypad [data-key="exp"]').click();
  await androidInput.locator('#dkts-numeric-keypad [data-key="sign"]').click();
  await androidInput.locator('#dkts-numeric-keypad [data-key="6"]').click();
  await androidInput.screenshot({path:path.join(out,'18-android-scientific-keypad.png'),fullPage:true});
  await androidInput.locator('#dkts-numeric-keypad [data-key="done"]').click();
  check('ANDROID-KEYPAD-EXPONENT',await androidInput.evaluate(()=>
    window.DK4200FSPro.getDraft().terminals[0].bias==='1e-6'),
    'keypad scientific exponent edits actual guarded PagePlan field, not a fake overlay');
  check('ANDROID-KEYPAD-CLOSE',await androidInput.locator('#dkts-numeric-keypad').isHidden()&&
    androidErrors.length===0,'numeric keyboard closes without JS errors: '+androidErrors.join(' | '));
  await androidInput.locator('.fs-terminal').first().locator('button[data-action="add-segment"]').click();
  const segmentedStart=androidInput.locator('input[data-bind="terminals[0].segments[0].start"]');
  check('ANDROID-SEGMENT-NUMERIC',await segmentedStart.getAttribute('inputmode')==='none'&&
    await segmentedStart.getAttribute('readonly')!==null,
    'dynamic segment numeric fields must reuse the built-in Android nine-grid keypad');
  await segmentedStart.click();
  await androidInput.locator('#dkts-numeric-keypad [data-key="1"]').click();
  await androidInput.locator('#dkts-numeric-keypad [data-key="done"]').click();
  check('ANDROID-SEGMENT-KEYPAD-PERSISTS',await androidInput.evaluate(()=>
    window.DK4200FSPro.getDraft().terminals[0].segments[0].start==='1'),
    'segment keypad input writes the actual draft rather than a transient overlay');
  await androidInput.close();

  // Simulate a native reconnect error with an old verified KCon slot.
  // Both the visible connection list and execution gate must revoke it.
  const failedReconnect=await browser.newPage({viewport:{width:430,height:900}});
  await failedReconnect.addInitScript(()=>{
    window.DK4200Native={
      connect:async()=>{throw new Error('ETIMEDOUT');},
      disconnect:async()=>({connected:false})
    };
  });
  await failedReconnect.goto(file);
  await failedReconnect.waitForFunction(()=>
    window.DK4200ConnectionStatus?.snapshot()?.pending===false);
  await failedReconnect.evaluate(()=>window.DK4200FSPro.setVerifiedInventory(['SMU1']));
  await failedReconnect.evaluate(()=>window.DK4200ConnectionStatus.connect());
  await failedReconnect.evaluate(()=>window.DK4200FSPro.openEdit());
  await failedReconnect.locator('button[data-action="connection"]').first().click();
  check('FAILED-RECONNECT-REVOKES-SMU',await failedReconnect.evaluate(()=>{
    const select=document.querySelector('select[data-bind="terminals[0].resource"]');
    return !window.DK4200ConnectionStatus.snapshot().connected&&
      [...select.options].map(o=>o.value).join(',')==='None';
  }),'failed native reconnect invalidates previously detected KCon resources');
  await failedReconnect.close();
  check('UI-NO-PAGEERROR',pageErrors.length===0,'Page errors: '+pageErrors.join('; '));
  fs.writeFileSync(path.join(out,'acceptance-report.json'),JSON.stringify({reference:'FS-Pro V6',kind:'offline UI',checks:report,metrics,pageErrors},null,2));
  console.log(JSON.stringify({checks:report.length,passed:report.filter(x=>x.pass).length,output:out,metrics}));
 }finally{await browser.close();}
})().catch(err=>{fs.writeFileSync(path.join(out,'failure.txt'),String(err.stack||err));console.error(err);process.exitCode=1;});
