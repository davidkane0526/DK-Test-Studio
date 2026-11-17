<PARSED TEXT FOR PAGE: 1 / 7>
1. 首先把 4200 的 typec 线连接到电脑上。



2. 4200 仪器桌面上有个 Keithley Configuration Utility (KCon)的应用，打开后界面如下，然后

  点击右上角红圈中的 settings：




在设置界面中，选择“Communications”部分下的“Ethernet”。记下 port number，因为

Python 脚本使用该端口号与 4200A-SCS 进行通信。将“字符串终止符”选为“读数分隔符”，

然后点击窗口底部的“确定”。接下来，在 KCon 中保存并退出。通过以太网发送的每个 KXCI

命令都必须以 NULL 终止符（也称为字符串终止符）结尾。图 3 显示了配置为以太网连接的

KXCI 设置界面。
<PARSED TEXT FOR PAGE: 2 / 7>
3. 之后打开 NIMAX,左侧设备和接口有个网络设备，右键新建 VISA TCP/IP Resource




  选第三个 Raw Socket.
<PARSED TEXT FOR PAGE: 3 / 7>
Port number 与一开始记录的 port number 相同。Ip address 看下一步获取。
<PARSED TEXT FOR PAGE: 4 / 7>
把下一步获取的地址输入并按 validate 并完成
<PARSED TEXT FOR PAGE: 5 / 7>
4. 在 4200 的 桌 面 用 cmd 搜 索 ， 输 入 ipconfig /all ， 然 后 回 车 ， 出 现 的 列 表 里 面 找 IPv4

   address。




5. 之后打开 4200 桌面上的 KXCI 软件进行连接控制

连接成功的界面如下所示：
<PARSED TEXT FOR PAGE: 6 / 7>
6. Vscode 验证