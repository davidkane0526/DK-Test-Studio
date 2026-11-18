(()=>{
 'use strict';
 // SDK 1.19 Unit-only navigation. DKDS loads ui-shell.css from manifest.styles.
 // No document queries, private host bridge, scheduler or replacement renderer.
 const translations=Object.freeze({
 "C–V 扫描": ["C–V 扫描", "C–V Sweep"],
 "Info": [
  "信息",
  "Info"
 ],
 "Sweep": [
  "扫描",
  "Sweep"
 ],
 "Target": [
  "目标",
  "Target"
 ],
 "Strategy": [
  "策略",
  "Strategy"
 ],
 "Limits": [
  "限值",
  "Limits"
 ],
 "Page Var": [
  "变量",
  "Page Variables"
 ],
 "Associate Spec": [
  "关联规格",
  "Associate Spec"
 ],
 "Page Information": [
  "页面信息",
  "Page Information"
 ],
 "Page Name": [
  "页面名称",
  "Page Name"
 ],
 "Test Type": [
  "测试类型",
  "Test Type"
 ],
 "Device Name": [
  "器件名称",
  "Device Name"
 ],
 "Notes": [
  "备注",
  "Notes"
 ],
 "Measurement Target": [
  "测量目标",
  "Measurement Target"
 ],
 "Measurement Strategy": [
  "测量策略",
  "Measurement Strategy"
 ],
 "Start (V)": [
  "起始 (V)",
  "Start (V)"
 ],
 "Stop (V)": [
  "终止 (V)",
  "Stop (V)"
 ],
 "Step (V)": [
  "步进 (V)",
  "Step (V)"
 ],
 "Range (A)": [
  "本段电流量程 (A)",
  "Segment Range (A)"
 ],
 "Speed": [
  "速度",
  "Speed"
 ],
 "Inner Sweep": [
  "内层扫描",
  "Inner Sweep"
 ],
 "Outer Sweep": [
  "外层扫描",
  "Outer Sweep"
 ],
 "Terminal": [
  "端子映射",
  "Terminal"
 ],
 "Terminal Settings": [
  "端子量程与保护",
  "Terminal Range & Protection"
 ],
 "Fixed Bias": [
  "固定偏置",
  "Fixed Bias"
 ],
 "Range Mode": [
  "量程模式",
  "Range Mode"
 ],
 "Current Range (A)": [
  "电流量程 (A)",
  "Current Range (A)"
 ],
 "Compliance Mode": [
  "电流保护模式",
  "Compliance Mode"
 ],
 "Compliance (A)": [
  "电流保护值 (A)",
  "Compliance (A)"
 ],
 "Auto": [
  "自动",
  "Auto"
 ],
 "Fixed": [
  "固定",
  "Fixed"
 ],
 "Limited Auto": [
  "限制自动",
  "Limited Auto"
 ],
 "Follow range": [
  "随量程",
  "Follow range"
 ],
 "Custom": [
  "自定义",
  "Custom"
 ],
 "Source": [
  "源极",
  "Source"
 ],
 "Drain": [
  "漏极",
  "Drain"
 ],
 "Gate": [
  "栅极",
  "Gate"
 ],
 "Body": [
  "体端",
  "Body"
 ],
 "None": [
  "未分配",
  "None"
 ],
 "Fast": [
  "快速",
  "Fast"
 ],
 "Normal": [
  "标准",
  "Normal"
 ],
 "Quiet": [
  "低噪",
  "Quiet"
 ],
 "Current": [
  "电流",
  "Current"
 ],
 "Voltage": [
  "电压",
  "Voltage"
 ],
 "Name": [
  "名称",
  "Name"
 ],
 "Channel": [
  "通道",
  "Channel"
 ],
 "Parameter": [
  "测量量",
  "Parameter"
 ],
 "Measurement Range": [
  "测量量程",
  "Measurement Range"
 ],
 "Linear": [
  "线性",
  "Linear"
 ],
 "Forward / Reverse": [
  "正向／反向",
  "Forward / Reverse"
 ],
 "Hysteresis": [
  "回滞",
  "Hysteresis"
 ],
 "Value": [
  "数值",
  "Value"
 ],
 "Unit": [
  "单位",
  "Unit"
 ],
 "Device": [
  "器件",
  "Device"
 ],
 "Project Explorer": [
  "工程导航",
  "Project Explorer"
 ],
 "TEST LIBRARY": [
  "测试模板",
  "TEST LIBRARY"
 ],
 "+ Device": [
  "+ 器件",
  "+ Device"
 ],
 "+ Routine": [
  "+ 流程",
  "+ Routine"
 ],
 "+ Page": [
  "+ 页面",
  "+ Page"
 ],
 "+ Spec": [
  "+ 规格",
  "+ Spec"
 ],
 "＋ Spec": [
  "＋ 规格",
  "＋ Spec"
 ],
 "＋ Target": [
  "＋ 目标",
  "＋ Target"
 ],
 "测试工程": [
  "测试工程",
  "Test Project"
 ],
 "绘图区": [
  "绘图区",
  "Plots"
 ],
 "← 绘图区": [
  "← 绘图区",
  "← Plots"
 ],
 "导航": [
  "导航",
  "Navigator"
 ],
 "打开或收起工程导航": [
  "打开或收起工程导航",
  "Toggle project navigator"
 ],
 "收起工程导航": [
  "收起工程导航",
  "Close project navigator"
 ],
 "校验规划": [
  "校验规划",
  "Validate Plan"
 ],
 "校验当前 Page 的 Xsweep/Psweep 离线规划": [
  "校验扫描规划",
  "Validate the offline sweep plan"
 ],
 "测试": [
  "测试",
  "Run"
 ],
 "停止": [
  "停止",
  "Stop"
 ],
 "开始真实 KXCI 测量；执行中再次点击将请求安全停止": [
  "运行测试；运行中可请求安全停止",
  "Run the KXCI test or request a safe stop"
 ],
 "扫描端口": [
  "扫描端口",
  "Sweep terminal"
 ],
 "重复": [
  "重复",
  "Repeats"
 ],
 "启用": [
  "启用",
  "Enable"
 ],
 "固定偏置 · Psweep 未启用": [
  "未启用外层扫描，非扫描端子使用固定偏置。",
  "Outer sweep is off. Non-swept terminals use fixed bias."
 ],
 "循环次数": [
  "循环次数",
  "Loops"
 ],
 "扫描模式": [
  "扫描模式",
  "Sweep mode"
 ],
 "测试速度": [
  "测试速度",
  "Sweep speed"
 ],
 "点间延迟 (ms)": [
  "点间延迟 (ms)",
  "Point delay (ms)"
 ],
 "扫描循环": [
  "扫描循环",
  "Sweep loops"
 ],
 "仪器输出": [
  "仪器输出",
  "Instrument output"
 ],
 "电压软件输入预检上界 (V)": [
  "软件预检电压上限 (V)",
  "Software voltage limit (V)"
 ],
 "未连接，禁止输出": [
  "未连接，禁止输出",
  "Offline · output disabled"
 ],
 "新增页面变量": [
  "新增页面变量",
  "Add page variable"
 ],
 "删除变量": [
  "删除变量",
  "Remove variable"
 ],
 "删除测量目标": [
  "删除测量目标",
  "Remove target"
 ],
 "删除此扫描段": [
  "删除此扫描段",
  "Remove sweep segment"
 ],
 "尚未定义页面变量。": [
  "尚未定义页面变量。",
  "No page variables."
 ],
 "关联规格": [
  "关联规格",
  "Linked Specs"
 ],
 "新建并关联规格": [
  "新建并关联规格",
  "Create and link spec"
 ],
 "将当前 Page 关联至器件 Spec": [
  "关联此页面到器件规格",
  "Link this page to a device spec"
 ],
 "关联 Spec": [
  "关联规格",
  "Linked spec"
 ],
 "未关联": [
  "未关联",
  "Unlinked"
 ],
 "当前器件尚无规格，可使用标题栏的＋ Spec 新建。": [
  "当前器件暂无规格。",
  "This device has no specs."
 ],
 "端口": [
  "端口",
  "Ports"
 ],
 "隐藏": [
  "收起",
  "Collapse"
 ],
 "显示": [
  "展开",
  "Expand"
 ],
 "连接": [
  "连接",
  "Connect"
 ],
 "已连接": [
  "已连接",
  "Connected"
 ],
 "连接中": [
  "连接中",
  "Connecting"
 ],
 "断开仪器": [
  "断开仪器",
  "Disconnect"
 ],
 "连接仪器": [
  "连接仪器",
  "Connect instrument"
 ],
 "连接设置": [
  "连接设置",
  "Connection settings"
 ],
 "4200A 连接设置": [
  "4200A 连接设置",
  "4200A Connection Settings"
 ],
 "仪器 IP / 主机名": [
  "仪器 IP / 主机名",
  "Instrument IP / hostname"
 ],
 "KXCI TCP 端口": [
  "KXCI TCP 端口",
  "KXCI TCP port"
 ],
 "预期序列号": [
  "预期序列号",
  "Expected serial number"
 ],
 "连接/读取超时 (ms)": [
  "连接／读取超时 (ms)",
  "Connection / read timeout (ms)"
 ],
 "网络接口模式": [
  "网络接口模式",
  "Network interface mode"
 ],
 "指定网卡名称": [
  "指定网卡名称",
  "Network interface name"
 ],
 "自动": [
  "自动",
  "Automatic"
 ],
 "以太网": [
  "以太网",
  "Ethernet"
 ],
 "指定网卡": [
  "指定网卡",
  "Specific interface"
 ],
 "Terminal 端口映射": [
  "端子映射",
  "Terminal mapping"
 ],
 "配置 Source、Drain、Gate 端口": [
  "配置源极、漏极、栅极端口",
  "Map Source, Drain and Gate"
 ],
 "Source、Drain、Gate 端口映射": [
  "源极、漏极、栅极端口映射",
  "Source, Drain and Gate mapping"
 ],
 "None 仅表示未分配端口；不会出现在参数设置和测量目标中。": [
  "未分配的端子不参与配置或测量。",
  "Unassigned terminals do not appear in settings or measurement targets."
 ],
 "折叠或展开 Terminal 端口映射": [
  "折叠或展开端子映射",
  "Collapse or expand terminal mapping"
 ],
 "4200A 连接状态、连接/断开与网络设置": [
  "4200A 连接和网络设置",
  "4200A connection and network settings"
 ],
 "应用": [
  "应用",
  "Apply"
 ],
 "取消": [
  "取消",
  "Cancel"
 ],
 "图窗布局": [
  "图窗布局",
  "Plot layout"
 ],
 "单窗口": [
  "单窗口",
  "Single"
 ],
 "双窗口": [
  "双窗口",
  "Dual"
 ],
 "四宫格": [
  "四宫格",
  "Four"
 ],
 "数据": [
  "数据",
  "Data"
 ],
 "数据表": [
  "数据表",
  "Data Table"
 ],
 "转移特性": [
  "转移特性",
  "Transfer"
 ],
 "选择数据中心数据源或导出原始 CSV": [
  "选择数据源或导出原始 CSV",
  "Choose a Data Center source or export raw CSV"
 ],
 "导出完整原始 CSV": [
  "导出完整原始 CSV",
  "Export full raw CSV"
 ],
 "全部已分配数据": [
  "全部已分配数据",
  "All assigned data"
 ],
 "当前数值": [
  "当前数值",
  "Current value"
 ],
 "没有需要设置固定偏置的已分配 SMU。": [
  "已分配端子无需固定偏置。",
  "No assigned terminal needs fixed bias."
 ],
 "DC 测试": [
  "DC 测试",
  "DC Test"
 ],
 "I–V 扫描": [
  "I–V 扫描",
  "I–V Sweep"
 ],
 "输出特性": [
  "输出特性",
  "Output"
 ],
 "耐久性": [
  "耐久性",
  "Endurance"
 ],
 "保持特性": [
  "保持特性",
  "Retention"
 ],
 "任意波形": [
  "任意波形",
  "Arbitrary Waveform"
 ],
 "时间扫描": [
  "时间扫描",
  "Time Sweep"
 ],
 "脉冲扫描": [
  "脉冲扫描",
  "Pulse Sweep"
 ],
 "直流": [
  "直流",
  "DC"
 ],
 "脉冲": [
  "脉冲",
  "Pulse"
 ],
 "循环": [
  "循环",
  "Cycle"
 ],
 "时间": [
  "时间",
  "Time"
 ]
});
 function translate(key,language){
  const row=Object.hasOwn(translations,key)?translations[key]:null;
  return row?row[language==='en'?1:0]:key;
 }
 function attach(units,root,nav){
  let open=false;
  const setOpen=value=>{
   open=Boolean(value);
   root?.setAttribute?.('data-dkts-nav-open',open?'true':'false');
  };
  const close=()=>setOpen(false),toggle=()=>setOpen(!open);
  root?.setAttribute?.('data-dkts-shell','true');
  nav?.setAttribute?.('data-dkts-nav','true');
  // Overlay is a DKDS Unit-owned layout, never custom HTML inserted into Core.
  const scrim=units.layout.create(root,{variant:'identity'});
  scrim?.setAttribute?.('data-dkts-nav-scrim','true');
  scrim?.addEventListener?.('click',close);
  const onKey=event=>{if(event.key==='Escape')close();};
  root?.addEventListener?.('keydown',onKey);
  setOpen(false);
  return Object.freeze({setOpen,toggle,close,dispose:()=>{
   scrim?.removeEventListener?.('click',close);
   root?.removeEventListener?.('keydown',onKey);
   scrim?.remove?.();
  }});
 }
 window.DKDSPluginModules.define('com.dkts.keithley-4200','uiShell',Object.freeze({attach,translate}),{replace:true});
})();
