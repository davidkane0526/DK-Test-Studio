(() => {
  'use strict';
  function mount(ctx,page,actions={}){
    const units=ctx.ui.unitTemplates,dom=ctx.ui.dom;
    const controls=new Map(),buttons=new Map(),fieldRows=new Map();
    const body=units.page.create(page,{variant:'tool',className:'dkts-plugin-page'}).element;
    const pageHeader=units.pageHeader.create(body,{variant:'page-owned',activity:'dkts-keithley-4200',
      title:'DK Test Studio',subtitle:'4200A 共用测试引擎 · 仪器只读连接'});
    // The page header is owned by DKDS Core; only our status control is placed in it.
    const statusHost=units.layout.create(pageHeader.element||body,{
      variant:'row-between',className:'dkts-header-connection'});
    let modal=null;
    const statusAction=units.action.create(statusHost,{
      id:'dkts-connection-status',label:'未连接',variant:'secondary',direct:true,
      onInvoke:()=>{if(modal&&!modal.open)modal.showModal();}
    });
    const statusButton=statusAction.button||statusAction.element;
    buttons.set('status',statusButton);
    const workspaceHost=units.layout.create(body,{variant:'identity',className:'dkts-workspace-host'});
    const workbench=units.workspace.create(workspaceHost,{
      variant:'standard',header:false,activity:'dkts-keithley-4200',primaryScroll:'safe'});
    const main=units.layout.create(null,{variant:'stack-comfortable',className:'dkts-workbench'});
    const cards=units.layout.create(main,{variant:'stack-comfortable',className:'dkts-cards'});
    const makeCard=className=>units.surface.create(cards,{tagName:'section',variant:'elevated',
      className:className||'dkts-card'});
    const textNode=(host,tag,classname,value)=>{
      const item=dom.create(tag);item.className=classname;item.textContent=value;host.appendChild(item);return item;
    };
    const field=(host,id,label,value,opts={})=>{
      const kind=opts.kind||'input';
      const item=units.field.create(host,{
        kind,variant:kind==='select'?'select':'input',label,value,
        inputType:opts.inputType||'number',options:opts.options||[],
        step:opts.step||'any',onChange:()=>actions.onPlanChanged?.()
      });
      controls.set(id,item.control);fieldRows.set(id,item.element||item.control?.parentElement);return item.control;
    };
    // Hidden by default: one status button opens the entire diagnostic/settings modal.
    modal=dom.create('dialog');
    modal.className='dkts-connection-dialog';
    modal.setAttribute?.('aria-label','仪器连接设置');
    body.appendChild(modal);
    const modalHeader=units.layout.create(modal,{variant:'row-between',className:'dkts-modal-header'});
    textNode(modalHeader,'h3','dkts-modal-title','仪器连接');
    units.action.create(modalHeader,{
      id:'dkts-close-connection',label:'关闭',direct:true,
      onInvoke:()=>{if(modal.open)modal.close();}
    });
    textNode(modal,'div','dkts-device','Keithley 4200A-SCS');
    const status=units.note.create(modal,{variant:'meta',text:'尚未连接'});
    const route=units.note.create(modal,{variant:'meta',text:'169.254.111.118:1225'});
    const identityNote=units.note.create(modal,{variant:'meta',text:'仪器尚未识别'});
    const modulesNote=units.note.create(modal,{variant:'meta',text:'模块尚未读取'});
    const diagnostics=dom.create('details');
    diagnostics.hidden=true;
    const summary=dom.create('summary');summary.textContent='详细连接诊断';diagnostics.appendChild(summary);
    const diagnostic=textNode(diagnostics,'pre','dkts-diagnostics','');
    modal.appendChild(diagnostics);
    const advanced=dom.create('details');
    const advancedTitle=dom.create('summary');
    advancedTitle.textContent='详细连接设置（仅本次会话）';
    advanced.appendChild(advancedTitle);
    const connectionFields=units.layout.create(advanced,{variant:'form-grid-2',className:'dkts-field-grid'});
    field(connectionFields,'host','仪器 IP / 主机名','169.254.111.118',{inputType:'text'});
    field(connectionFields,'port','端口',1225);
    field(connectionFields,'expectedSerial','预期序列号','1498377',{inputType:'text'});
    field(connectionFields,'networkMode','连接方式','auto',{kind:'select',options:[
      {value:'auto',label:'自动（推荐）'},{value:'ethernet',label:'网线'},
      {value:'wifi',label:'Wi-Fi'},{value:'interface',label:'指定网卡'}
    ]});
    field(connectionFields,'interfaceName','指定网卡名称','',{inputType:'text'});
    field(connectionFields,'localAddress','本地 IPv4 地址','',{inputType:'text'});
    field(connectionFields,'timeoutMs','连接超时（毫秒）',5000);
    modal.appendChild(advanced);
    const modalActions=units.layout.create(modal,{variant:'row-between',className:'dkts-connection-actions'});
    units.action.create(modalActions,{
      id:'dkts-disconnect',label:'断开连接',direct:true,
      onInvoke:()=>actions.onDisconnect?.()
    });
    units.action.create(modalActions,{
      id:'dkts-reconnect',label:'重新连接',variant:'primary',direct:true,
      onInvoke:()=>actions.onReconnect?.()
    });
    const modeCard=makeCard('dkts-card dkts-library-stage');
    textNode(modeCard,'div','dkts-heading','选择测试方式 · 点击进入独立工作区');
    // Host-native UI primitives; never embed a second measurement implementation in the plugin.
    // Grid is explicitly two columns even in the narrow DKDS/mobile workspace.
    const modeGrid=units.layout.create(modeCard,{variant:'two-card-grid',className:'dkts-mode-grid'});
    const modeStyles=dom.create('style');
    modeStyles.textContent=`
      .dkts-mode-grid{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:10px}
      .dkts-mode-item{min-width:0;border:1px solid var(--border-color,rgba(125,140,160,.26));border-radius:10px;padding:10px;background:var(--surface-color,transparent)}
      .dkts-mode-item.is-selected{border:2px solid var(--accent-color,#4776cf);padding:9px;background:var(--surface-secondary,rgba(72,117,196,.07))}
      .dkts-mode-item.is-disabled{opacity:.55}
      .dkts-mode-item .dkts-mode-subtitle{font-size:11px;opacity:.75;line-height:1.4}
      .dkts-mode-item button{width:100%;text-align:left}
      .dkts-library-stage[hidden],.dkts-workspace-stage[hidden]{display:none!important}
      .dkts-workspace-stage{min-height:calc(100dvh - 170px)}
      .dkts-inline-detail{display:block;opacity:1;visibility:visible}
      .dkts-inline-detail.is-open{animation:dkts-stage-enter .2s ease-out}
      @keyframes dkts-stage-enter{from{opacity:.65;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
      .dkts-inline-inner{min-height:0;overflow:visible;display:grid;grid-template-columns:minmax(290px,340px) minmax(0,1fr);gap:12px}
      .dkts-parameters-panel,.dkts-acquisition-panel{min-width:0}
      .dkts-acquisition-panel{display:grid;gap:10px;align-content:start}
      .dkts-measure-readouts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
      .dkts-measure-readout{border:1px solid var(--border-color,rgba(125,140,160,.2));border-radius:8px;padding:10px}
      .dkts-placeholder-chart{position:relative;height:clamp(300px,43dvh,560px);border:1px solid var(--border-color,rgba(125,140,160,.25));border-radius:10px;background:repeating-linear-gradient(0deg,transparent 0px,transparent 53px,rgba(128,145,166,.12) 54px,transparent 55px)}
      .dkts-placeholder-chart-label{position:absolute;left:18px;bottom:12px;font-size:11px;opacity:.65}
      .dkts-placeholder-chart-empty{position:absolute;left:15%;right:15%;top:42%;text-align:center;font-size:12px;opacity:.65}
      .dkts-pending-config{border:1px dashed var(--border-color,rgba(125,140,160,.24));border-radius:8px;padding:14px}
      .dkts-raw-rows{font-size:12px;opacity:.75}
      @media(max-width:950px){.dkts-inline-inner{grid-template-columns:minmax(0,1fr)}}
      @media(prefers-reduced-motion:reduce){.dkts-inline-detail.is-open{animation:none}}
    `;
    main.appendChild(modeStyles);
    let selectedKind='iv',openedKind=null;
    const modeTiles=new Map();
    const modes=[
      {kind:'iv',title:'SMU I–V 扫描',subtitle:'正反向与循环扫描',enabled:true},
      {kind:'it',title:'SMU I–t 恒压读出',subtitle:'恒压时间扫描',enabled:true},
      {kind:'transfer',title:'转移特性',subtitle:'栅压扫描 · 开发中'},
      {kind:'output',title:'输出特性',subtitle:'漏压扫描 · 开发中'},
      {kind:'pund',title:'PMU / PUND',subtitle:'脉冲测试 · 开发中'},
      {kind:'retention',title:'Retention',subtitle:'状态保持 · 开发中'},
      {kind:'endurance',title:'Endurance',subtitle:'循环耐久 · 开发中'},
      {kind:'arbitrary',title:'任意波形测量',subtitle:'真实输出与采集 · 开发中'}
    ];
    function selectMode(kind){
      const tile=kind===null?null:modeTiles.get(kind);
      if(kind!==null&&!tile)return;
      openedKind=kind;
      modeCard.hidden=Boolean(openedKind);
      detailCard.hidden=!openedKind;
      const current=modes.find(mode=>mode.kind===openedKind);
      const ready=!!current?.enabled;
      if(ready)selectedKind=openedKind;
      detailFrame.className='dkts-inline-detail'+(openedKind?' is-open':'');
      detailTitle.textContent=current?current.title+' · 测试工作区':'测试工作区';
      detailFrame.inert=!openedKind;
      detailFrame.setAttribute?.('aria-hidden',String(!openedKind));
      card2.hidden=!ready;
      pendingPanel.hidden=!openedKind||ready;
      arbitraryEditor.hidden=openedKind!=='arbitrary';
      plotLabel.textContent=current?.kind==='iv'?'Voltage (V)':current?.kind==='endurance'?'Cycle':'Time (s)';
      plotEmpty.textContent=openedKind
        ?'尚无 '+current.title+' 的仪器实测数据':'尚未选择测试';
      if(ready){
        planHeading.textContent=current.title+' · 测试参数（仅规划）';
        const it=openedKind==='it';
        for(const key of ['startV','stopV','direction','delayMs']){
          const row=fieldRows.get(key);if(row)row.hidden=it;
        }
        for(const key of ['fixedV','intervalMs']){
          const row=fieldRows.get(key);if(row)row.hidden=!it;
        }
      }else if(current){
        pendingTitle.textContent=current.title+' · 开发中';
        pendingNote.textContent=current.kind==='arbitrary'
          ?'可在下方编辑时间—电压点并校验方案，尚不支持向仪器输出。'
          :'该测试的仪器命令和参数配置尚未接入；实际数据区保持空白。';
      }
      for(const [key,item] of modeTiles){
        const isOpen=key===openedKind;
        item.host.className='dkts-mode-item'+(isOpen?' is-selected':(!item.enabled?' is-disabled':''));
        if(item.button){
          item.button.setAttribute?.('aria-pressed',String(isOpen));
          item.button.setAttribute?.('aria-expanded',String(isOpen));
        }
      }
      if(ready)actions.onPlanChanged?.();
    }
    for(const mode of modes){
      const host=units.surface.create(modeGrid,{tagName:'section',variant:'elevated',
        className:'dkts-mode-item'+(!mode.enabled?' is-disabled':'')});
      const action=units.action.create(host,{
        id:'dkts-mode-'+mode.kind,label:mode.title,variant:'secondary',direct:true,
        onInvoke:()=>selectMode(mode.kind)
      });
      textNode(host,'div','dkts-mode-subtitle',mode.subtitle);
      modeTiles.set(mode.kind,{host,button:action?.button||action?.element||null,enabled:!!mode.enabled});
    }
    // Two distinct pages: the library disappears completely on selecting a mode.
    const detailCard=makeCard('dkts-card dkts-workspace-stage');
    detailCard.hidden=true;
    const detailToolbar=units.layout.create(detailCard,{
      variant:'row-between',className:'dkts-secondary-toolbar'});
    units.action.create(detailToolbar,{
      id:'dkts-back-to-tests',label:'← 返回测试选择',variant:'secondary',direct:true,
      onInvoke:()=>selectMode(null)
    });
    const detailTitle=textNode(detailToolbar,'h3','dkts-secondary-title','测试工作区');
    const detailFrame=units.layout.create(detailCard,{variant:'stack-comfortable',className:'dkts-inline-detail'});
    detailFrame.inert=true;
    detailFrame.setAttribute?.('aria-hidden','true');
    const detailInner=units.layout.create(detailFrame,{variant:'stack-comfortable',className:'dkts-inline-inner'});
    const card2=units.surface.create(detailInner,{tagName:'section',variant:'elevated',
      className:'dkts-parameters-panel'});
    card2.hidden=true;
    const planHeading=textNode(card2,'div','dkts-heading','SMU I–V 扫描 · 测试参数（仅规划）');
    const planFields=units.layout.create(card2,{variant:'form-grid-2',className:'dkts-plan-grid'});
    field(planFields,'loops','循环次数',1);
    field(planFields,'points','单程点数',101);
    field(planFields,'complianceA','规划电流限值 (A)',0.0001);
    const planAdvanced=dom.create('details');
    const planSummary=dom.create('summary');planSummary.textContent='高级测试参数';planAdvanced.appendChild(planSummary);
    const more=units.layout.create(planAdvanced,{variant:'form-grid-2',className:'dkts-field-grid'});
    field(more,'startV','扫描起始电压 (V)',-1);
    field(more,'stopV','扫描终止电压 (V)',1);
    field(more,'fixedV','I–t 固定偏置 (V)',0.1);
    field(more,'direction','扫描方向','roundtrip',{kind:'select',options:[
      {value:'forward',label:'正向'},{value:'reverse',label:'反向'},
      {value:'roundtrip',label:'往返'}
    ]});
    field(more,'sourceSmU','源 SMU',1);
    field(more,'measureSmU','测量 SMU',1);
    field(more,'gateSmU','Gate SMU (0 = 无)',0);
    field(more,'gateBiasV','栅极偏置 (V)',0);
    field(more,'delayMs','扫描点间延迟 (ms)',20);
    field(more,'intervalMs','I–t 采样间隔 (ms)',100);
    card2.appendChild(planAdvanced);
    const planNote=units.note.create(card2,{variant:'meta',
      text:'仅生成测试方案，不会输出电压或电流'});
    const pendingPanel=units.surface.create(detailInner,{tagName:'section',variant:'elevated',
      className:'dkts-pending-config'});
    pendingPanel.hidden=true;
    const pendingTitle=textNode(pendingPanel,'strong','dkts-pending-title','功能开发中');
    const pendingNote=textNode(pendingPanel,'p','dkts-pending-note','尚未接入实机测试协议');
    const arbitraryEditor=dom.create('div');
    pendingPanel.appendChild(arbitraryEditor);
    arbitraryEditor.hidden=true;
    textNode(arbitraryEditor,'p','dkts-waveform-label','时间 (s)、电压 (V)，每行一组');
    const arbitraryText=dom.create('textarea');
    arbitraryText.value='0,0\n0.001,1\n0.002,-1\n0.003,0';
    arbitraryEditor.appendChild(arbitraryText);
    const waveStatus=textNode(arbitraryEditor,'p','dkts-waveform-status',
      '仅作波形输入规划；不会触发仪器输出');
    const waveformApi=ctx.modules.require('dkts-waveform');
    const checkWave=()=>{
      try{
        const wave=waveformApi.parseWaveformText(arbitraryText.value);
        waveStatus.textContent=wave.points.length+' 个规划点 · '+wave.durationS+' 秒 · 不执行硬件输出';
      }catch(e){waveStatus.textContent='校验失败：'+String(e.message||e).slice(0,100);}
    };
    arbitraryText.addEventListener?.('input',checkWave);
    const dataPanel=units.surface.create(detailInner,{tagName:'section',variant:'elevated',
      className:'dkts-acquisition-panel'});
    textNode(dataPanel,'h3','dkts-acquisition-title','数据读取与绘图');
    const readouts=units.layout.create(dataPanel,{variant:'two-card-grid',className:'dkts-measure-readouts'});
    for(const item of ['电压：— V','电流：— A','采样点：—','采集时间：— s']){
      const readout=units.layout.create(readouts,{variant:'stack-compact',className:'dkts-measure-readout'});
      textNode(readout,'span','dkts-readout-value',item);
    }
    const chart=dom.create('div');
    chart.className='dkts-placeholder-chart';
    dataPanel.appendChild(chart);
    const plotEmpty=textNode(chart,'div','dkts-placeholder-chart-empty','尚无仪器采集数据');
    const plotLabel=textNode(chart,'div','dkts-placeholder-chart-label','Voltage (V) / Current (A)');
    textNode(dataPanel,'strong','dkts-raw-heading','原始数据 · 0 点');
    textNode(dataPanel,'div','dkts-raw-rows','等待仪器返回原始数据');
    textNode(dataPanel,'p','dkts-acquisition-note',
      '当前不执行测量；这里不会绘制模拟电流曲线。');

    workbench.compose({primary:{id:'main',label:'4200A',
      presentationRole:'utility-primary',scroll:'safe',titlePolicy:'host-only',mainNode:main},
      primes:[],subs:[]});
    const get=id=>id==='kind'?selectedKind:controls.get(id)?.value;
    const set=(id,value)=>{
      if(id==='kind'){selectMode(String(value));return;}
      const c=controls.get(id);if(c)c.value=String(value??'');
    };
    function readConnection(){
      return {host:get('host'),port:get('port'),expectedSerial:get('expectedSerial'),
        networkMode:get('networkMode'),interfaceName:get('interfaceName'),
        localAddress:get('localAddress'),timeoutMs:get('timeoutMs')};
    }
    function readPlan(){
      const names=['kind','loops','points','complianceA','startV','stopV','fixedV',
        'direction','sourceSmU','measureSmU','gateSmU','gateBiasV','delayMs','intervalMs'];
      return Object.fromEntries(names.map(name=>[name,get(name)]));
    }
    function restorePlan(value){
      const old={...value,kind:value.kind||(value.mode==='timed'?'it':value.mode||'iv')};
      for(const [key,v] of Object.entries(old)){
        if(key==='kind'||controls.has(key))set(key,v);
      }
    }
    function renderConnection(s){
      const label=s.phase==='connected'?'连接成功':s.phase==='connecting'?'正在连接…':
        s.phase==='error'?'连接失败':'未连接';
      statusButton.textContent=label;
      status.textContent=String(s.summary||label);
      identityNote.textContent=s.identity
        ?[s.identity.model,s.identity.serial?'序列号 '+s.identity.serial:'',
          s.identity.version||''].filter(Boolean).join(' · '):'仪器尚未识别';
      route.textContent=s.route
        ?[s.route.remoteAddress+':'+s.route.remotePort,s.route.interfaceName||'系统路由'].join(' · ')
        :get('host')+':'+get('port');
      modulesNote.textContent=s.inventory
        ?'装机模块：'+(s.inventory.knownModules.map(x=>x.raw).join(' · ')||'未识别')+'（电气量程未核验）'
        :s.inventoryError?'模块读取失败：'+String(s.inventoryError).slice(0,100):'模块尚未读取';
      diagnostic.textContent=String(s.diagnostic||'').slice(0,6000);
      diagnostics.hidden=!s.diagnostic;diagnostics.open=false;
    }
    function renderPlan(value){
      const p=value.plan;
      planNote.textContent='方案有效：'+p.kind+' · '+p.loops+' 循环 · '+p.totalPoints+
        ' 点 · 尚未核验实际仪器模块，硬件执行禁用';
    }
    function renderPlanError(s){planNote.textContent='方案无效：'+s.slice(0,110);}
    return Object.freeze({readConnection,readPlan,restorePlan,
      renderConnection,renderPlan,renderPlanError,
      dispose(){workbench?.dispose?.();}});
  }
  window.DKDSPluginModules.define('com.dkts.keithley-4200','presentation',Object.freeze({mount}));
})();
