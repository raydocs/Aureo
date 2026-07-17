# Handoff: hud-clarity-autodirector-arm64-recovery   (plan)

## Purpose

对齐 Screen Studio 的录制体验(接上一份 capsule 的路线)。本次:排掉一场"整机卡死"事故(架构装错,非代码 bug)、落地 HUD 直观性两包(P0/P1)、人声响度对齐 -14 LUFS、修好摄像头自动导演乱飞。全部已推送。

## Contract Snapshot

- Contract: `/Users/ruirui/.claude/plans/aureo-handoff-zazzy-sphinx.md`(M1/M2/M3 路线)+ 本次新增的 Screen Studio 对照升级清单(见 Summary)
- Objective vs Current State:录制体验对齐 Screen Studio ↔ M1+M2+HUD P0/P1+自动导演修复已落地;M3(编辑器圆角相对化)与样式桥接仍 pending
- Work-item statuses:HUD P0(设备药丸+电平条)[done] · HUD P1(录前校验+系统声音入口)[done] · 响度 -14 [done] · 自动导演迟滞 [done] · P2(选源大字反馈、区域录制)[pending] · iOS 设备录制 [deferred,用户明确先做熟 mac] · M3 [pending]
- Blockers:none
- Escape hatch: not triggered

## 项目状态

- 分支 `codex/build-v1.3.5-beta.2` @ `acaf388`,已推 `personal`(personal remote)
- `/Applications/Aureo.app` = `acaf388` 的 arm64 签名构建(装前验过 `file`=arm64 + codesign)
- 构建 zip 备份:`~/Aureo Backups/20260717-0110-autodirector-fix-arm64/`;上一个好版本 `20260717-0100-hud-clarity-arm64/`
- 测试基线:launch 域 72/72;video-editor+exporter 域 579/579;tsc 干净;协作模式:Fable 定设计/冻结简报,Codex 实现,Fable 逐包 diff 审查+复跑(worker 自检一律不采信)

## Summary

**架构事故(先读这段,别再踩)**:昨晚 21:33 上个会话最后一次打包产出了 **x86_64** 版并装进 /Applications — `electron-builder.json5` 的 mac target 写死 `"arch": ["x64","arm64"]`,每次 mac 打包**两个架构都出**,`mac/` 目录是 x64、`mac-arm64/` 才是 arm64,拿错目录就装了 Intel 版。在 Apple Silicon 上走 Rosetta,渲染进程被钉满 100% CPU,症状酷似 JS 死循环(整机卡、编辑器加载页转圈、录制时摄像头冻结),排查了半晚。**判据**:采样看到 `com.apple.rosetta.exceptionserver` 线程或 `0x7ff8...` 栈地址 ⟹ 先查架构;安装前必跑 `file <app>/Contents/MacOS/Aureo`。**规避**:打包用 `npx electron-builder --mac zip --arm64`(单目标单架构,实测不触发 x64 轮次)。配置本身没改(用户未拍板),陷阱还在。

**四个提交**:
- `f6843ed` **HUD 直观性 P0+P1**(Screen Studio 实机对照产物):麦克风/摄像头图标升级为带设备名的药丸(样式同构现有 Screen 选择器);麦克风药丸底部 2px 实时电平条 + MicPopover 顶部大条(`useMicrophoneLevel`:getUserMedia→AnalyserNode→rAF 直写 DOM 不走 React state,attack 0.5/decay 0.08,METER_GAIN=3 因为裸语音 RMS 峰值仅 ~0.3);系统声音从麦克风弹窗拆出独立喇叭开关;录前校验(`recordPreflight.ts`:摄像头开+麦克风关 ⟹ 锚定录制按钮的确认气泡 "仍然录制/取消")。i18n 十语言。
- `5d945bd` **响度 -16→-14 LUFS**(`voiceEnhancement.ts` loudnorm)。背景:用户报"声音特别小" — 实测边车已是 -16.4 LUFS 标准响度,真因是修回音 bug 前用户听的是双轨叠加(虚高 4~6dB),基线错位;-14 对齐 YouTube/Spotify 再补 2dB。只影响新录制。
- `acaf388` **自动导演乱飞修复**:原逻辑光标一碰头像区就瞬时改目标到"最远对角"(零迟滞),光标忙时头像永远在斜穿全屏的路上。重构:`getAutoDirectedWebcamLayout` 保持无状态(候选=仅水平翻/仅垂直翻/对角,按行程距离取最近且避开光标者,全撞则回落最远对角);新增 `createWebcamAutoDirectorController`(DODGE_IN_MS=200 驻留才躲、RETURN_HOLD_MS=1200 才回位、回拖>500ms 或前跳>5s 重置)。预览(VideoPlayback)与两个导出渲染器(frameRenderer/modernFrameRenderer)各持一个 controller 实例,行为一致。**注意单位**:VideoPlayback 的 `currentTimeRef` 存毫秒(:1921 赋值处),直接传即可。
- `e1d9268` 之前的 M2+音频修复见上一份 capsule(`handoffs/2026-07-16-21-40-...md`)。

**Screen Studio 对照升级清单(剩余)**:P2 选源时屏幕大字反馈(名称+分辨率+帧率)[小-中]、区域(Area)录制 [大];iOS 设备录制 [用户明确暂缓]。

## Files Created / Changed

- `src/components/launch/LaunchWindow.tsx` — 药丸化 mic/cam 触发器、喇叭开关、`handleRecordClick` 守卫链(未选源→选源;摄像头开+麦克风关→确认;否则录)
- `src/components/launch/hooks/useMicrophoneLevel.ts` + test — 电平表 hook(流生命周期+纯平滑函数 `advanceMeterLevel`)
- `src/components/launch/hudDevicePillLabels.ts` + test — 设备药丸标签解析(选中→配置→首个→通用)
- `src/components/launch/recordPreflight.ts` + test — 录前校验纯函数
- `src/components/launch/popovers/RecordConfirmPopover.tsx` — 确认气泡(受控打开,id "record-confirm")
- `src/components/launch/popovers/MicPopover.tsx` — 顶部电平条行(与药丸共享同一 hook 实例)
- 10× `src/i18n/locales/*/launch.json` — 6 个新键
- `electron/ipc/recording/voiceEnhancement.ts:33` — loudnorm I=-14
- `src/components/video-editor/webcamOverlay.ts` + test — 最小躲避 + `createWebcamAutoDirectorController`
- `src/components/video-editor/VideoPlayback.tsx` / `src/lib/exporter/frameRenderer.ts` / `modernFrameRenderer.ts` — 三处接入 controller

## Verification Results

- `npx tsc --noEmit` 干净;launch 域 72/72;video-editor+exporter 579/579;Biome 对改动文件干净(VideoPlayback 15 条 useExhaustiveDependencies 警告为既有、不在改动区)
- i18n:launch.json 十语言零错误;`i18n:check` 整体仍 FAIL(311 项,全部是**既有的** settings.json 缺键,与本次无关)
- 实机(dev + CDP):药丸显示真实设备名与激活态;电平条静音 0.018 / 语音峰值 >0.3 且药丸+弹窗双条同步;喇叭开关 title/状态翻转正确;确认气泡 Cancel 路径不启动录制
- 装机验证:arm64 + codesign 通过;启动采样零 Rosetta 痕迹;CPU 正常(GPU ~36% 为摄像头预览常态)
- **preflight push(e1d9268..acaf388)**:whitespace clean、gitleaks 无泄密、worktree clean,`PREFLIGHT_STATE=PASS`
- **未验证**:① 确认气泡在真机的**视觉呈现**(合成驱动选源三次失败后止损;逻辑有单测锁定 — 请用户实测:麦克风关+摄像头开+点录制);② 自动导演修复的**手感**(单测覆盖时序,真实播放的观感待用户确认);③ -14 响度的听感;④ 上份 capsule 的"录制→编辑→导出"全流程仍未跑

## Known Risks

- **x86 陷阱仍在**:`electron-builder.json5` mac target 仍是 `["x64","arm64"]`,任何人跑 `npm run build:mac` 都会再产出 x64 到 `mac/`。改成只留 arm64 需用户拍板(发 Intel 版时再临时加回)。隔离的坏版本在 `~/Aureo Backups/20260716-2335-BAD-x86-do-not-install/`。
- **自动更新器**:app 启动会查 GitHub releases(现因 `ERR_UPDATER_CHANNEL_FILE_NOT_FOUND` 失败而无害)。若将来 release 通道配好且发的是 x64/universal,可能再次把本地 arm64 构建替换掉 — 装本地构建的工作流和自动更新天然冲突,值得专门处理。
- **HUD 电平表持流**:麦克风开启时 HUD 常驻一条 getUserMedia 音频流(橙点常亮)。与 Screen Studio 行为一致,但用户若问"为什么没录制也占麦克风"这就是答案。
- **上份 capsule 的遗留风险仍有效**:diagnostics.ts 可能静默丢麦克风;样式桥接被 M3 阻塞勿贸然做;`corner-shape` 依赖 Chromium 150+。
- dev 的 userData 在 `~/Library/Application Support/Aureo-dev/`(与正式版隔离),里面残留测试录制,可清。

## Next Steps

1. **用户实测三件套**:确认气泡视觉、自动导演手感(重开原工程播放)、新录一段听 -14 响度。
2. 拍板 `electron-builder.json5` 是否改为 arm64-only(一行,防复发)。
3. P2:选源大字反馈 [小-中];区域录制 [大,需要选区 UI+捕获管线]。
4. M3(编辑器 cornerRadius 相对化+真圆对齐,含导出端 `drawSquircleOnCanvas`),完成后再做 HUD→编辑器样式桥接。
5. 上份 capsule 未清项:录制→编辑→导出全流程验证;diagnostics.ts 丢麦克风核实。

---
> Read the handoff capsule at `handoffs/2026-07-17-00-59-plan-hud-clarity-autodirector-arm64-recovery.md` before starting; it has the purpose, what's done, what's verified, the risks, and the next steps.
