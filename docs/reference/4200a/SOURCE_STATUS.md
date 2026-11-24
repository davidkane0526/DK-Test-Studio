# 4200A reference source status

Checked: 2026-11-24

| Source | Retrieved? | Repository treatment | Private bundle |
|---|---|---|---|
| LabExpress User Manual(SC).pdf, product 2022.01, June 2022, 106 pages | Yes, user upload in this conversation | Bibliographic record only; no public full-text or PDF redistribution | Original PDF included |
| FSPro_LabExpress_4200A_Development_Guide_V2.pdf / .docx | Yes, recovered from Library | PDF text extraction committed | Both originals included |
| FSPro_4200A_Reference_Research_V3.pdf / .docx | Yes, recovered from Library | PDF text extraction committed | Both originals included |
| FSPro_LabExpress_to_DKTS_Implementation_V5.pdf / .docx | Yes, recovered from Library | PDF text extraction committed | Both originals included |
| DKTS_FSPro_V6_UI_spec_retry.pdf | Yes, recovered from Library | PDF text extraction committed | Original PDF included |
| FSPro_UI_Replica_Implementation_V6.docx | Yes, recovered from Library | Text extraction committed | Original DOCX included |
| Keithley_4200A_OPPO_Pad_Mini_DKDS_Handoff.md | Yes, recovered from Library | Original Markdown committed | Original Markdown included |
| 4200 control.docx | Yes, recovered from Library | Text extraction committed; screenshots remain in DOCX only | Original DOCX included |
| FSPro_4200A_Agent_Dev_Pack_V5.zip | Not recoverable as a file in the current Library | Not recreated or represented as original | Not included |
| DKTS_FSPro_V6_full_retry.zip | Not recoverable as a file in the current Library | Not recreated or represented as original | Not included |
| keithley-main.zip | Not recoverable as a file in the current Library | Official public examples repository linked below | Not included |
| Tektronix 4200A-KXCI-907-01F Rev F PDF | Retrieved official September 2026 PDF | SMU IN, NR and IT plus PMU timing, sample rate and ranges reviewed | Not included |
| Tektronix 4200A-PMU-900-01D Rev D PDF | Retrieved official September 2026 PDF | PMU sample-rate and point-limit sections reviewed | Not included |

## Official manufacturer references

1. KXCI Remote Control Programming, **4200A-KXCI-907-01F, Rev F**, release date **2026-10-09**:  
   https://www.tek.com/tw/manual/parametric-analyzer/model-4200a-scs-kxci-remote-control-programming-keithley-4200a-scs-parameter-analyzer
2. Pulse Card (PGU and PMU) User Manual, **4200A-PMU-900-01D, Rev D**, release date **2026-10-22**:  
   https://www.tek.com/en/manual/parametric-analyzer/model-4200a-scs-pulse-card-pgu-and-pmu-users-manual-4200a-scs-parameter-analyzer
3. Tektronix official 4200A-SCS manuals and downloads index:  
   https://www.tek.com/en/support/datasheets-manuals-software-downloads?model=4200A-SCS
4. Previous KXCI programming reference, **4200A-KXCI-907-01E, Rev E (March 2025)**:  
   https://download.tek.com/manual/4200A-KXCI-907-01E_March2025.pdf
5. Tektronix-maintained Keithley examples, 4200A KXCI examples:  
   https://github.com/tektronix/keithley/tree/main/Instrument_Examples/Model_4200A/KXCI_Examples

## Notes

- V2/V3/V5 documents reference Rev E in places. Rev F was reviewed for the timing editor. Instrument execution still requires command-by-command verification against the installed model and firmware.
- A public manual listing is not proof that its downloadable PDF was retrieved.
- The private companion ZIP preserves user-provided and recovered original files for the user's internal project use. Do not redistribute the LabExpress manual.
- No real SMU/PMU source output or measurement was performed as part of this reference recovery.


## Private handoff archive

- File: `DKTS-4200A-Reference-Bundle-2026-11-17.zip`
- Size: 13,782,750 bytes
- SHA-256: `f8b37d42220e68a186827a3cc02fa687bf88551549094f6357c1206cb6ed9349`
- ZIP integrity check: PASS; 27 files; 16,041,043 uncompressed bytes.

## 2026-11-24 timing editor verification

- KXCI Rev F sections 5 and 7 distinguish the SMU post-reading interval (IN) from a periodic host plan. IN accepts 0–10 seconds in 4200A mode and 0.01–10 seconds in 4145 emulation. NR supports up to 4096 SMU readings in 4200A mode. IT lists 0.1, 1 and 10 PLC as the three presets.
- PMU sample rate accepts an integer from 1,000 to 200,000,000 Sa/s. Rev F preserves the ambiguous boundary at 65,536 generated points. DKTS leaves that boundary out of ready presets and flags it for review. DKTS preserves the requested rate. Pulse period, transition limits and off time are checked against the selected voltage range.
- PMU Rev D confirms 200 MSa/s and the Clarius waveform sample/point limits. The timing fields reviewed here do not certify the full KXCI or PMU capability database or an installed chassis.
- PDFs: [KXCI Rev F](https://download.tek.com/manual/4200A-KXCI-907-01F_Sept2026.pdf) · [Pulse Card Rev D](https://download.tek.com/manual/4200A-PMU-900-01D_Sept_2026.pdf).


## 本次复核补记

2026-11-24：当前会话重新访问 Rev F 官方 PDF 链接失败，繁中官方页面返回 403。此前 11 月 24 日开发日志记录已取得 PDF 并核对局部字段，但原件不在 Git 树中，不能据此声称本会话完成全文复核。Rev E PDF 正文可读。具体 SMU 指令、固件与实测需逐项确认，而非把 Rev F 当成不同协议。


## 2026-11-24 · Rev F 原件恢复

用户上传 4200A-KXCI-907-01F_Sept2026.pdf（211 页）。已读取实际原件，核对 2-2、3-14–15、4-3/6、5-7–10、5-20–30、5-34、5-40–42、5-45–49、5-54–57；不把私有上传 PDF 再分发到公共仓库。新版第 1-1/3-11/3-12 页说明 Clarius 1.15+ HiSLIP 与 legacy KXCI 区别；此前已经建立的 V1.14 raw TCP 路径不擅自改成 HiSLIP。完整命令集和固件实测未完成。
