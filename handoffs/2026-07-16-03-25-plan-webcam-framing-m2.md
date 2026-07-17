# Handoff: webcam-framing-m2   (plan)

# Aureo 摄像头预览 M1 完成 → M2 接续 Handoff

## Purpose

Aureo 录制前悬浮摄像头体验向 Screen Studio 看齐。M1(裁切式取景引擎 + 状态持久化 + 取景桥接进编辑器)已完成、验证并推送;本 capsule 供下一会话在不依赖聊天记录的情况下接续 M2(直接操纵与样式桥接)。

## Contract Snapshot

- Contract: `/Users/ruirui/.claude/plans/aureo-handoff-zazzy-sphinx.md`(完整 M1/M2/M3 计划,经 fusion 面板评审修订)
- Objective vs Current State:摄像头预览全面对齐 Screen Studio ↔ M1 已落地(取景/持久化/桥接),M2/M3 未动
- Work-item statuses:M1 全部 [done] · M2(边缘缩放、S/M/L 与形状预设、尺寸 HUD、squircle 形状 WYSIWYG、Alt 拖拽取景、样式桥接)[pending,等用户信号] · M3(编辑器圆角相对化、双向同步)[pending]
- Blockers:none(M2 明确要等用户实际用几天后的反馈再启动)
- Escape hatch: not triggered

## 项目状态

- 仓库 `/Users/ruirui/Documents/aureo`,分支 `codex/build-v1.3.5-beta.2` @ `43074d5`,工作树干净
- 已推送 `personal`(personal remote);**origin 上无此分支**
- 已安装 `/Applications/Aureo.app` = 本分支 arm64 签名构建(codesign --deep --strict 通过)
- 备份:`~/Aureo Backups/` 有改动前(`*before-webcam-framing-m1*`)与改动后(`*webcam-framing-m1-signed*`)两份 app zip
- 测试基线:`npm test` 1103 项全过;tsc / Biome / i18n:check 干净(zh-TW settings.json 缺键与 format 错误为改动前遗留,勿动)

## Summary

本次会话协作模式:Grok CLI 当实施 worker(冻结简报派工)、Fable 逐包验收;计划经 fusion 面板(Opus 4.8 + GPT-5.6 Sol + Gemini 3.1 Pro)评审后执行。四个提交:`d4caef5`(Electron 桥接)、`35b2038`(编辑器消费)、`5848dc2`(取景引擎+渲染+UI+持久化)、`43074d5`(按用户反馈修正)。

**用户拍板的硬性产品约束(不可回退):**
1. 悬浮圆内必须**始终被清晰视频完全填满**——不接受 Fit 模式 / letterbox / 模糊背景 /"圆里有方"(曾实现后被否决并移除)
2. zoom 下限锁 cover 基线(100%),取景调整**只在录制前**做("前期调就行,不用后期调")
3. 容器保持 1:1;桥接只带取景(cropRegion+mirror),样式(大小/圆角)不带

**架构骨架:**
- 外观模型 `{size 144-320px, roundness 0-100, zoom 1-1.5, centerX/Y 0-1(未镜像源坐标), mirror}`,key `aureo.hud.webcamPreviewAppearance`,存 app-settings.json;UI 写入即同步内存缓存(`getCurrentWebcamPreviewAppearance`)、磁盘写 200ms 防抖
- 取景引擎 `webcamPreviewFraming.ts` 纯函数:`computeWebcamFramingLayout` 输出显式视频盒(left/top/width/height)+ cropRegion + 按轴 pannable;`applyWebcamFramingDrag` 处理镜像符号与按轴门控。引擎保留 fitMode 参数但**所有调用方固定传 "fill"**
- 渲染:容器(overflow hidden + border-radius)内一个绝对定位 video,`object-fit: cover` + `max-width/max-height: none`(两者都是防拉伸的关键,见风险)
- 持久化:位置/显隐 `aureo.hud.webcamPreviewPlacement`(右下锚点偏移,锚点常量 `WEBCAM_PREVIEW_ANCHOR` inline 应用);设备/开关 `aureo.recording.webcamDevice`;恢复时视口夹取;穿透 fail-safe(blur/hidden/卸载兜底恢复)
- 桥接管线:录制开始 `prepareWebcamRecorder` 用**录制轨道 getSettings() 实际宽高比**算 cropRegion 存 ref → 三个 `setCurrentRecordingSession` 调用点附带(缺省必须传 `undefined`,`null` 语义是"主动清除")→ manifest **保持 version 2** 可选字段 `webcamAppearance` → 两条重写路径都保留字段(resolver 回读 + handler 合并保留,`register/project.ts` 的 `set-current-recording-session` 在入参缺字段时读现存 manifest 合并——编辑器改 timeOffset 走这条,不合并就清字段)→ VideoEditor 两个会话入口**按"webcamPath 变化"门控**应用(防事件回声覆盖用户编辑器内修改);editorPreferences 持久化时剥 cropRegion(防污染偏好);编辑器内修改由项目文件持久化(`projectPersistence.ts:1061`)

## Files Created / Changed

- `src/components/launch/webcamPreviewFraming.ts` + test — 取景引擎(核心,新)
- `src/components/launch/webcamPreviewAppearance.ts` + test — 模型扩展 + 内存缓存
- `src/components/launch/webcamPreviewPlacement.ts` + test — 位置/显隐持久化(新)
- `src/hooks/webcamDeviceSettings.ts` + test、`src/hooks/useVideoDevices.ts` — 设备持久化 + preferredDeviceId
- `src/hooks/recordingWebcamAppearance.ts` + test — 录制快照纯函数(新)
- `src/components/launch/hooks/useWebcamPreviewOverlay.ts` — 多 slot 视频节点注册、videoAspect(轨道 settings 优先)、防抖保存、恢复、fail-safe
- `src/components/launch/LaunchWindow.tsx` / `LaunchWindow.module.css` — 显式盒渲染(:574-608 附近)
- `src/components/launch/popovers/WebcamPopover.tsx` — 缩略图拖拽取景、镜像开关、Reset framing
- `src/hooks/useScreenRecorder.ts` — 快照生命周期 + 三调用点 + `aspectRatio: ideal 16/9` 约束
- `electron/ipc/types.ts`、`electron/ipc/project/session.ts`(+282 行测试)、`electron/ipc/register/project.ts`、`electron/preload.ts`、`electron/electron-env.d.ts` — 桥接类型全链路 + manifest 原子写 + webcamFileName 目录穿越校验
- `src/components/video-editor/webcamOverlay.ts`(`applySessionWebcamAppearance`)、`VideoEditor.tsx`(~:2617/:2705 两入口)、`editorPreferences.ts`(剥 cropRegion)+ tests
- 10× `src/i18n/locales/*/launch.json` — 镜像/重置取景键(Fit 相关键已删)

## Verification Results

- `npx tsc --noEmit`、`npm test`(1103 过)、Biome、`i18n:check` 全绿;生产构建 + 签名 + 安装通过
- 实机(CDP 9226):zoom 100%/130% + 偏移取景圆内恒满、几何与公式精确吻合;重启后设备/开关/位置恢复;**端到端桥接实测通过**(manifest 带 cropRegion+mirror,且按录制流真实 4:3 坐标表达——FaceTime 预览 16:9 / 录制 4:3 的分歧被正确适配);"编辑器改 timeOffset 不清字段"IPC 级实测通过
- 模糊层移除后无额外 WindowServer 开销(此前实测 +3~4%)
- 本 capsule 前置检查:`preflight push ce5fd16` PASS(PREFLIGHT_SECRETSCAN=GITLEAKS,无泄密、无空白问题)
- **未验证/未做**:① 最早一次实录 manifest 缺 `webcamAppearance`,当前构建复测通过、未能复现(若再现,查 `useScreenRecorder` 三调用点的 ref 时序);② Screen Studio 实物并排对照未做(用户方向修正后改为"先实际用、凭体感反馈");③ 编辑器内打开桥接后的录制做最终导出的全流程未跑(cropRegion 语义与导出共用 `getWebcamCropSourceRect`,风险低但未实测)

## Known Risks

- **防拉伸双保险不可拆**:Tailwind preflight 给 `video` 设 `max-width:100%` 会把取景盒压扁——`.webcamPreviewFrame` 的 `max-width:none` + `object-fit:cover` 缺一不可;新增任何 video 元素都要复查
- 引擎里 fitMode/showBackdrop 是**休眠代码**(调用方全传 "fill",zoom≥1 时 showBackdrop 恒 false);M2 重构时别顺手"启用"
- manifest 兼容承诺:旧构建可读媒体/timeOffset,但旧构建重写 manifest 会丢 `webcamAppearance`(可选字段,已知取舍)
- 预览流(640×360@24)与录制流(1280×720@30,实测可能协商成 4:3)宽高比可能不同——crop 必须继续按录制轨道 settings 计算,勿改回预览元数据
- HUD popover 在 agent-browser 两条命令间会自动收起(交互测试易误判);录制是两步:点录制→选源→**再点录制**

## 测试与环境注意事项(实测坑)

- **构建/签名**:仓库在 iCloud 同步目录,FinderInfo xattr 会让 codesign 报 "detritus"。流程:`xattr -dr com.apple.FinderInfo node_modules/electron/dist electron/native/bin dist build` → `npx electron-builder --mac --arm64 --config.directories.output=/tmp/aureo-release-arm64`(输出必须在 iCloud 范围外)。`com.apple.provenance` 无害。iCloud 还会生成 " 2" 后缀重复文件——**提交前查 git status**。构建触发的 `electron/native/bin` 二进制改动是噪声,推送前 `git checkout --` 还原
- **实机验证**:`open -a /Applications/Aureo.app --args --remote-debugging-port=9226` + `npx agent-browser --session aureo connect 9226`;截图前把 `~/Library/Application Support/Aureo/hud-overlay-settings.json` 的 hiddenFromCapture 临时设 false(**备份原文件、测后原样恢复**);勿用屏幕坐标点击;录音产物在 `~/Library/Application Support/Aureo/recordings/`,测试录像记得清理;shell 的 `ls`/`cat` 有别名,脚本里用 `/bin/ls` `/bin/cat`
- **Grok worker 模式**(用户指定):headless `grok --prompt-file <brief> --cwd <repo> --permission-mode auto --disable-web-search --check`;`--worktree` 会被 `--cwd` 覆盖,并行隔离需手动 `git worktree add` 再 `--cwd` 进去;Fable 必须亲自 diff 审查 + 复跑验证,Grok 的 PASS 自检不作数

## Next Steps

1. **等用户实际使用后的反馈**再启动 M2(用户明确表态,勿自行推进):直接边缘拖拽缩放(需 shell/clip 两层解决圆角裁命中区)、S/M/L 与圆/圆角/方预设、尺寸 HUD、悬浮框 Alt+拖拽取景、squircle 形状 WYSIWYG、样式桥接(roundness→cornerRadius px 一次性换算等)——详细设计都在 Contract 的 M2 节
2. 跑一次"录制→编辑器→导出"的全流程,确认桥接的 cropRegion 在最终导出里与录前预览一致(补上未验证项 ③)
3. 若用户报告取景又"糊/拉伸/缺角",先查:video 元素 max-width 是否被夺回、videoAspect 来源(轨道 settings)、以及是否有人把 fitMode 传成了 "fit"
4. 若再现 manifest 缺 `webcamAppearance`:在 `useScreenRecorder` 三个 `setCurrentRecordingSession` 调用点加临时日志,重点看 ref 被清零与调用的先后

---
> Read the handoff capsule at `handoffs/2026-07-16-03-25-plan-webcam-framing-m2.md` before starting; it has the purpose, what's done, what's verified, the risks, and the next steps.
