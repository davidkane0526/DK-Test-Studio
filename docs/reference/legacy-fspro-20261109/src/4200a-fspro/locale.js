(() => {
 'use strict';
 /* DKTS UI localization. Technical identifiers, user-entered data and KXCI
  * protocol values are NEVER translated. Only presentation text is changed. */
 const pairs=[
  ['Open Project','打开工程'],['Save Project','保存工程'],['Import Raw Data','导入原始数据'],
  ['Instrument Network Settings','仪器网络设置'],['Terminal Range','测量档位'],
  ['Unlock required','需要先解锁'],
  ['Current Page','当前页面'],['Subwindow','子窗口'],['Plot Area','绘图区'],
  ['Four Frames','四宫格'],['Transfer Curve','转移特性'],['Raw Data','数据表'],
  ['New','新建'],['Open','打开'],['Save','保存'],['Data','数据'],
  ['Parameter Settings','参数设置'],['Port Setup','端口配置'],['Start Test','开始测试'],
  ['Repeat','重复'],['Measurement Range','测量档位'],['Automatic','自动'],
  ['Fixed','固定'],['Current (A)','电流 (A)'],['Voltage (V)','电压 (V)'],
  ['Preset Range','预设档位'],['Custom','自定义'],
  ['Unverified range does not authorize output','未验证量程不授权输出'],
  ['File','文件'],['Instruments','仪器'],['Measurement','测量'],['Tools','工具'],
  ['Window','窗口'],['Help','帮助'],['New Project','新建工程'],['Open Page','打开页面'],
  ['Save Page','保存页面'],['Export Page Plan','导出页面配置'],
  ['Import Native Raw Capture','导入原始记录'],['Export Raw CSV','导出原始 CSV'],
  ['Data Viewer','数据查看器'],['Arrange 2 × 2','排列 2 × 2'],
  ['About this preview','关于预览版'],['Edit Page','编辑页面'],
  ['Set Connection','端口配置'],['Connection Settings','连接设置'],
  ['Measure','开始测试'],['Repeat','重复测试'],
  ['Project Navigation','项目导航'],['Device','器件'],['Visual Area','绘图区'],
  ['Project','项目'],['Spec','规格'],['Routine 01','测试流程 01'],
  ['Device 01','器件 01'],['Page · IV Sweep','页面 · I–V 扫描'],
  ['Frame 1','图窗 1'],['Frame 2','图窗 2'],['Frame 3','图窗 3'],
  ['Frame 4','图窗 4'],['Frame 1–4','图窗 1–4'],
  ['Transfer','转移特性'],['Data','数据'],['Messages / Test Log','消息 / 测试日志'],
  ['Measurement Settings','测量设置'],['Page','页面'],
  ['Info','基本信息'],['Type:','类型：'],['Polarity:','极性：'],
  ['Group:','分组：'],['Test Type:','测试类型：'],['Name:','名称：'],
  ['Mosfet','MOSFET'],['Diode','二极管'],['2-terminal','两端子'],
  ['Custom','自定义'],['Lock','锁定'],['Unlock','解锁'],
  ['Reset','重置'],['AutoScale','自动缩放'],['UnScale','取消缩放'],
  ['Sweep','扫描'],['Target','目标'],['Strategy','策略'],
  ['OK','确定'],['Cancel','取消'],['Close','关闭'],
  ['RefNode:','参考节点：'],['Outputs:','输出：'],['Input Setting','输入配置'],
  ['Condition','固定偏置'],['Voltage','电压'],['Current','电流'],
  ['Constant','恒定'],['Linear Step','线性步进'],
  ['Linear Points','线性点数'],['Log Points','对数点数'],
  ['List','列表'],['Generator','波形生成器'],
  ['Ref to:','参考：'],['Start:','起始：'],['Stop:','终止：'],
  ['Step:','步长：'],['Points:','点数：'],['Limits','限值'],
  ['Node','节点'],['Page Var','页面变量'],['Quote Var','引用变量'],
  ['Associate Spec','关联规格'],['Name','名称'],['Value','数值'],
  ['Plot','绘图'],['Function Info','函数信息'],['Function editor','函数编辑器'],
  ['Connection List','连接列表'],['Connection preset','连接预设'],
  ['Terminal to Resource','端子与资源分配'],['Terminal','端子'],['Resource','资源'],
  ['Source','源类型'],['Local Setting','当前页面设置'],
  ['Auto','自动'],['X Type','X 类型'],['Y Type','Y 类型'],
  ['Width','宽度'],['Height','高度'],['Time','时间'],
  ['Start','起点'],['Stop','终点'],['Step','步进'],['Points','点数'],
  ['Model','型号'],['Mode','模式'],['Range','档位'],
  ['Speed','速度'],['Delay','延时'],['Integration','积分'],
  ['Unit','单位'],['Current Compliance','电流限制'],
  ['Voltage Compliance','电压限制'],['Parameter','参数'],
  ['Manual','手动'],['Fixed','固定'],['Scope','范围'],
  ['Linear','线性'],['Log','对数'],['Plot X','绘图 X'],['Plot Y','绘图 Y'],
  ['Array','数组'],['Expression','表达式'],['Parameter List','参数列表'],
  ['English','英语'],['Chinese','中文'],['Language','语言'],
  ['Menu','菜单'],['Connect','连接'],['Disconnect','断开'],
  ['Connecting…','连接中…'],['Minimize','最小化'],['Maximize','最大化'],
  ['Restore','还原'],['Close window','关闭窗口'],
  ['Connection failed:','连接失败：'],
  ['Connection mode','网络方式'],['Instrument address','仪器地址'],
  ['Port','端口'],['Interface','网卡'],['Local IP','本地 IP'],
  ['Expected serial','预期序列号'],['Wi-Fi','Wi-Fi'],
  ['Ethernet','以太网'],['Automatic','自动'],['Selected interface','指定网卡'],
  ['Connection Status','连接状态'],['Not connected','未连接'],
  ['Connected (read-only)','已连接（只读）'],
  ['Show source data','显示原始数据'],
  ['Index','序号'],['Status','状态'],['Unknown','未知'],
  ['Normal (N)','正常 (N)'],['Compliance (C)','限流 (C)'],
  ['Export CSV','导出 CSV'],
  ['Input','输入'],['Output','输出'],['Settings','设置'],
  ['Current UI revision. Automatic updates are not enabled for this preview.',
   '当前界面资源版本。预览版尚未启用自动更新。'],
  ['No original measurement data','暂无原始测量数据'],
  ['No original data','暂无原始测量数据'],
  ['No raw measurement data','暂无原始测量数据'],
  ['Offline configuration','离线配置'],
  ['Offline configuration is ready. Instrument not connected.',
   '离线配置已就绪。未连接仪器。'],
  ['Output not authorized','未授权输出'],
  ['Table','表格'],
  ['连接','连接'],['断开','断开'],['连接中…','连接中…'],
  ['未连接','未连接'],['已连接（只读）','已连接（只读）'],
  ['离线配置','离线配置'],['未授权输出','未授权输出'],
  ['暂无原始测量数据','暂无原始测量数据'],
  ['关闭','关闭'],['自动选择时留空','自动选择时留空'],
  ['仪器地址','仪器地址'],['端口','端口'],['网络方式','网络方式'],
  ['指定网卡','指定网卡'],['本地 IP','本地 IP'],
  ['设备序列号','设备序列号'],['仅本次会话','仅本次会话'],
  ['正常 (N)','正常 (N)'],['限流 (C)','限流 (C)'],
  ['未知','未知'],['菜单','菜单'],
  ['连接设置','连接设置'],
  
  ['当前界面资源版本。预览版尚未启用自动更新。',
   '当前界面资源版本。预览版尚未启用自动更新。']
 ];
 const enToZh=new Map(),zhToEn=new Map();
 for(const [en,zh] of pairs){
  if(!enToZh.has(en))enToZh.set(en,zh);
  if(!zhToEn.has(zh))zhToEn.set(zh,en);
 }
 // Canonical Chinese-source messages also receive a valid English view.
 const cnOnly=[
  ['连接失败：','Connection failed:'],['无法使用当前网络访问仪器，请检查网卡 IP 与路由',
   'Cannot reach the instrument through this network. Check IP and routing.'],
  ['连接超时，请检查仪器地址与端口','Connection timed out. Check IP and port.'],
  ['仪器拒绝连接，请检查 KXCI 服务','Instrument refused the connection. Check KXCI service.'],
  ['设备身份或序列号不匹配','Instrument identity or serial mismatch'],
  ['已断开','Disconnected'],['当前没有可查看的仪器原始数据','No raw instrument data available'],
  ['文件超过 48 MiB，请采用分段采集文件','File exceeds 48 MiB; use segmented capture files'],
  ['原始数据表','Raw data table'],
  ['当前采样没有此图所需的通道','Required channel absent from this capture'],
  ['当前界面资源版本。预览版尚未启用自动更新。',
   'Current UI revision. Automatic updates are not enabled for this preview.'],
  ['仅显示经过 4200A 模块识别的资源。修改共享 Connection 预设可能影响其他 Page；本次仅保存当前 Page 的映射。',
   'Only identified 4200A resources are shown. Editing a shared Connection preset may affect other Pages; this operation saves only the current Page mapping.'],
  ['公式仅保存为文本，尚未连接求值引擎。','The expression is saved as text; evaluation is not enabled.'],
  ['变量名','Variable name'],['变量值','Variable value'],['关联规格','Associated specification'],
  ['增加变量','Add variable'],['删除最后一个变量','Remove last variable'],
  ['增加关联规格','Add associated specification'],
  ['删除最后一个规格','Remove last specification'],
  ['在当前端子下方添加分段','Add segment under current terminal'],
  ['删除最后一个分段','Remove last segment'],
  ['删除分段','Remove segment'],
  ['选择 4200A 原始记录','Select a 4200A raw capture'],
  ['手机竖屏使用图窗标签；宽屏自动恢复 2 × 2 绘图布局',
   'Portrait screens use Frame tabs; wide layouts automatically restore the 2 × 2 plot grid.'],
  ['绘图区已使用 2 × 2 布局','The 2 × 2 plot layout is active.'],
  ['数据查看器','Data Viewer'],
  ['转移','Transfer'],['移动端图窗切换','Mobile plot navigation'],
  ['关闭连接设置','Close connection settings'],
  ['本地 4200A — 当前页面','Local 4200A — Current Page'],
  ['Local 4200A — 当前 Page','Local 4200A — Current Page'],
  ['当前 Page','Current Page'],
  ['显示前','Showing first'],
  ['状态未知','Status unknown'],['限流','Compliance'],
  ['导出 CSV 保留全部原始数值与状态文本。',
   'CSV preserves all original numeric and status text.']
 ];
 for(const [zh,en] of cnOnly){
  if(!zhToEn.has(zh))zhToEn.set(zh,en);
  if(!enToZh.has(en))enToZh.set(en,zh);
 }
 let language='zh';
 const switcher=document.getElementById('fs-language-switch');
 const skipped='SCRIPT,STYLE,TEXTAREA,PRE,CODE';
 const regexRules=[
  [/^Segment\s+(\d+)$/,'分段 $1',/^分段\s+(\d+)$/,'Segment $1'],
  [/^▾\s*Device\s+(\d+)$/,'▾ 器件 $1',/^▾\s*器件\s+(\d+)$/,'▾ Device $1'],
  [/^▾\s*Routine\s+(\d+)$/,'▾ 测试流程 $1',/^▾\s*测试流程\s+(\d+)$/,'▾ Routine $1'],
  [/^▾\s*Project$/,'▾ 项目',/^▾\s*项目$/,'▾ Project'],
  [/^原始采样：/,'Raw capture: ',/^Raw capture:\s*/,'原始采样：'],
  [/^原始数据：/,'Raw data: ',/^Raw data:\s*/,'原始数据：']
 ];
 function translated(input){
  const raw=String(input??'');
  const trimmed=raw.trim();
  if(!trimmed)return raw;
  const map=language==='zh'?enToZh:zhToEn;
  let next=map.get(trimmed);
  if(next===undefined){
   for(const rule of regexRules){
    const pattern=language==='zh'?rule[0]:rule[2];
    if(pattern.test(trimmed)){next=trimmed.replace(pattern,language==='zh'?rule[1]:rule[3]);break;}
   }
  }
  if(next===undefined||next===trimmed)return raw;
  const leading=raw.match(/^\s*/)?.[0]||'',trailing=raw.match(/\s*$/)?.[0]||'';
  return leading+next+trailing;
 }
 function ignore(node){
  const parent=node.nodeType===Node.TEXT_NODE?node.parentElement:node;
  if(!parent)return true;
  if(parent.closest?.('script,style,textarea,pre,code,[contenteditable="true"],.fs-brand,#fs-language-switch,#fs-version-badge,#fs-version-ui,#fs-page-name,[data-no-translate]'))return true;
  return skipped.split(',').includes(parent.tagName);
 }
 function walk(root){
  if(!root||ignore(root))return;
  const attrs=['title','aria-label','placeholder'];
  const elements=root.nodeType===Node.ELEMENT_NODE?[root,...root.querySelectorAll('*')]:[];
  for(const el of elements){
   if(ignore(el))continue;
   for(const attr of attrs){
    const before=el.getAttribute(attr);
    if(before===null)continue;
    const after=translated(before);
    if(after!==before)el.setAttribute(attr,after);
   }
  }
  const filter={acceptNode:n=>ignore(n)?NodeFilter.FILTER_REJECT:NodeFilter.FILTER_ACCEPT};
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,filter);
  const nodes=[];
  while(walker.nextNode())nodes.push(walker.currentNode);
  for(const node of nodes){
   const after=translated(node.nodeValue);
   if(after!==node.nodeValue)node.nodeValue=after;
  }
 }
 function updateToggle(){
  const label=language==='zh'?'EN':'中文';
  const caption=language==='zh'?'Switch to English':'切换为中文';
  for(const button of document.querySelectorAll('#fs-language-switch')){
    if(button.textContent!==label)button.textContent=label;
    if(button.getAttribute('title')!==caption)button.setAttribute('title',caption);
    if(button.getAttribute('aria-label')!==caption)button.setAttribute('aria-label',caption);
  }
  document.documentElement.lang=language==='zh'?'zh-CN':'en';
 }
 function setLanguage(next){
  if(!['zh','en'].includes(next))throw new TypeError('Unsupported language');
  language=next;
  updateToggle();
  walk(document.body);
  document.dispatchEvent(new CustomEvent('dkts:language-changed',{detail:{language}}));
  return language;
 }
 document.addEventListener('click',event=>{
  if(event.target.closest?.('#fs-language-switch'))setLanguage(language==='zh'?'en':'zh');
 });
 // The legacy FS-Pro page editor creates entire new forms via innerHTML.
 // Localize after render without altering source-mode, channel or numeric values.
 const observer=new MutationObserver(records=>{
  const nodes=new Set();
  for(const entry of records){
   if(entry.type==='characterData')nodes.add(entry.target.parentElement);
   else for(const item of entry.addedNodes)nodes.add(item.nodeType===Node.TEXT_NODE?item.parentElement:item);
   if(entry.type==='attributes')nodes.add(entry.target);
  }
  for(const root of nodes)if(root)walk(root);
  if([...nodes].some(root=>root?.querySelector?.('#fs-language-switch')))updateToggle();
 });
 observer.observe(document.body,{childList:true,subtree:true,characterData:true,
  attributes:true,attributeFilter:['aria-label','title','placeholder']});
 updateToggle();
 walk(document.body);
 window.DKTSLocale=Object.freeze({
  version:'1.0.0',setLanguage,getLanguage:()=>language,translate:translated
 });
})();