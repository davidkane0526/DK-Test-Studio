(() => {
  'use strict';
  function mount(ctx,page,actions={}){
    const units=ctx.ui.unitTemplates,dom=ctx.ui.dom;
    const controls=new Map(),buttons=new Map();
    const body=units.page.create(page,{variant:'tool',className:'dkts-plugin-page'}).element;
    units.pageHeader.create(body,{variant:'page-owned',activity:'keithley-4200',
      title:'DK Test Studio',subtitle:'4200A 共用测试引擎 · 仪器只读连接'});
    const workspaceHost=units.layout.create(body,{variant:'identity',className:'dkts-workspace-host'});
    const workbench=units.workspace.create(workspaceHost,{
      variant:'standard',header:false,activity:'keithley-4200',primaryScroll:'safe'});
    const main=units.layout.create(null,{variant:'stack-comfortable',className:'dkts-workbench'});
    const cards=units.layout.create(main,{variant:'two-card-grid',className:'dkts-cards'});
    const makeCard=()=>units.surface.create(cards,{tagName:'section',variant:'elevated',
      className:'dkts-card'});
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
      controls.set(id,item.control);return item.control;
    };
    const card1=makeCard();
    const head=units.layout.create(card1,{variant:'row-between',className:'dkts-device-head'});
    const info=units.layout.create(head,{variant:'stack-compact'});
    textNode(info,'div','dkts-heading','仪器连接');
    textNode(info,'div','dkts-device','Keithley 4200A-SCS');
    const button=units.action.create(head,{id:'dkts-toggle',label:'连接',
      variant:'primary',direct:true,onInvoke:()=>actions.onToggle?.()});
    const buttonNode=button.button||button.element;
    buttons.set('toggle',buttonNode);
    const status=units.note.create(card1,{variant:'meta',text:'待连接'});
    const route=units.note.create(card1,{variant:'meta',text:'169.254.111.118:1225'});
    const diagnostics=dom.create('details');
    diagnostics.hidden=true;
    const summary=dom.create('summary');summary.textContent='查看连接诊断';diagnostics.appendChild(summary);
    const diagnostic=textNode(diagnostics,'pre','dkts-diagnostics','');card1.appendChild(diagnostics);
    const advanced=dom.create('details');
    const advancedTitle=dom.create('summary');advancedTitle.textContent='高级连接设置（不保存）';advanced.appendChild(advancedTitle);
    const connectionFields=units.layout.create(advanced,{variant:'form-grid-2',className:'dkts-field-grid'});
    field(connectionFields,'host','仪器 IP / 主机名','169.254.111.118',{inputType:'text'});
    field(connectionFields,'port','端口',1225);
    field(connectionFields,'expectedSerial','序列号（留空不校验）','1498377',{inputType:'text'});
    field(connectionFields,'networkMode','连接路径','auto',{kind:'select',options:[
      {value:'auto',label:'自动'},{value:'ethernet',label:'网线'},
      {value:'wifi',label:'Wi-Fi'},{value:'interface',label:'指定网卡'}
    ]});
    field(connectionFields,'interfaceName','指定网卡名称','',{inputType:'text'});
    card1.appendChild(advanced);
    const card2=makeCard();
    textNode(card2,'div','dkts-heading','SMU 测试方案（仅规划）');
    const planFields=units.layout.create(card2,{variant:'form-grid-2',className:'dkts-plan-grid'});
    field(planFields,'kind','测试方式','iv',{kind:'select',options:[
      {value:'iv',label:'I–V'},{value:'it',label:'I–t'}
    ]});
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
    workbench.compose({primary:{id:'main',label:'4200A',
      presentationRole:'utility-primary',scroll:'safe',titlePolicy:'host-only',mainNode:main},
      primes:[],subs:[]});
    const get=id=>controls.get(id)?.value;
    const set=(id,value)=>{const c=controls.get(id);if(c)c.value=String(value??'');};
    function readConnection(){
      return {host:get('host'),port:get('port'),expectedSerial:get('expectedSerial'),
        networkMode:get('networkMode'),interfaceName:get('interfaceName')};
    }
    function readPlan(){
      const names=['kind','loops','points','complianceA','startV','stopV','fixedV',
        'direction','sourceSmU','measureSmU','gateSmU','gateBiasV','delayMs','intervalMs'];
      return Object.fromEntries(names.map(name=>[name,get(name)]));
    }
    function restorePlan(value){
      const old={...value,kind:value.kind||(value.mode==='timed'?'it':value.mode||'iv')};
      for(const [key,v] of Object.entries(old))if(controls.has(key))set(key,v);
    }
    function renderConnection(s){
      status.textContent=String(s.summary||'未连接');
      route.textContent=s.route
        ?[s.route.remoteAddress+':'+s.route.remotePort,s.route.interfaceName||'系统路由'].join(' · ')
        :get('host')+':'+get('port');
      diagnostic.textContent=String(s.diagnostic||'').slice(0,6000);
      diagnostics.hidden=!s.diagnostic;diagnostics.open=false;
      buttonNode.textContent=s.phase==='connected'?'断开':'连接';
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
  window.DKDSPluginModules.define('com.dkds.keithley-4200','presentation',Object.freeze({mount}));
})();
