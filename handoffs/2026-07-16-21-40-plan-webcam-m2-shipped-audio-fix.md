# Handoff: webcam-m2-shipped-audio-fix   (plan)

## Purpose

把 Aureo 录制前悬浮摄像头体验做到 Screen Studio 水平。M2(直接操纵:边缘缩放、预设、squircle、Alt 取景)已完成并推送;期间发现并修掉了一个与 M2 无关的真实音频 bug(mac 仅麦克风录制人声双份)。本 capsule 供下一会话在不依赖聊天记录的情况下接续。

## Contract Snapshot

- Contract: `/Users/ruirui/.claude/plans/aureo-handoff-zazzy-sphinx.md`(M1/M2/M3 完整路线图)
- Objective vs Current State:摄像头预览全面对齐 Screen Studio ↔ M1 + M2 已落地并推送;M3 未动
- Work-item statuses:M1 全部 [done] · M2 的 WP1-WP5 [done] · **M2 的样式桥接(原 WP6)[deferred,有技术阻塞,见 Known Risks]** · M3(编辑器圆角相对化、双向同步)[pending]
- Blockers:样式桥接被 M3 阻塞(编辑器最大圆角 ≠ 正圆,详见下)
- Escape hatch: not triggered

## 项目状态

- 仓库 `/Users/ruirui/Documents/aureo`,分支 `codex/build-v1.3.5-beta.2` @ `9ab103e`
- 已推送 `personal`(personal remote);**origin 上无此分支**
- 已安装 `/Applications/Aureo.app` = 本分支 arm64 签名构建
- 备份:`~/Aureo Backups/20260716-181426-before-webcam-framing-m2/`(改动前)与 `20260716-184507-webcam-framing-m2-signed/`(改动后)
- 测试基线:`npm test` **1132 项全过**(M1 基线 1103);tsc 干净

## Summary

两个提交:

**`15bc494` M2 摄像头气泡** —— 协作模式:Fable 写冻结简报,Codex(WP1/2/3)与 Grok(WP4/5)当 worker,Fable 逐包亲自 diff 审查 + 复跑验证(worker 自检一律不采信)。

- **缩放引擎** `webcamPreviewResize.ts`(纯函数 + 20 测试):对角锚定、Option 中心缩放、Shift 8px 量化、预设磁吸、按固定点的视口夹取
- **shell/clip 双层**:圆角会裁掉把手命中区,故把交互层(shell,无裁切)与裁切层(clip,overflow hidden + 圆角)分开;4 个 24px 隐形把手按 `computeResizeCornerInset` 贴到视觉圆缘;手势期间 `data-resizing` 关过渡 + rAF 直写 + pointerup 单次落盘
- **预设**:S/M/L(160/208/288)与 圆/圆角/方(roundness 100/30/0)分段控件 + 10 语言
- **squircle 所见即所得** `webcamPreviewShape.ts`:**实测 Electron 43 / Chromium 150 原生支持 CSS `corner-shape`**,故 roundness 0<r<100 直接用 `corner-shape: superellipse(2.1699)`(= 编辑器 `squircle.ts` 的指数 4.5,`log2(4.5)`),**不需要计划里的 clip-path 双层方案**;roundness 100 保持 `border-radius:50%` 正圆(用户硬性约束)
- **Alt+拖拽取景**:Alt 时在 pointerdown/move/up 三处先于 move-drag 拦截,走 `applyWebcamFramingDrag`;不可平移时回落为移动手势

**`9ab103e` 修复人声双份(用户报为"回音")** —— 与 M2 无关的既有 bug,详见下节。

### 音频 bug 的根因与修法(下一个人必须理解这段)

macOS **仅麦克风** ScreenCaptureKit 会话把麦克风**内联存进 mp4**;finalize 时 `mac.ts` 的 catch 分支从 mp4 提取麦克风、经 RNNoise + `loudnorm=I=-16` 生成 `<base>.mic.m4a`,**但不移除 mp4 原音轨**。预览与导出把两份都播 → 同一句话响两遍(一份原始、一份加工)→ 用户听成回音。**不是声学回授,与外放/耳机/设置无关。**

修法(纯路由,零文件改写):主进程**早已表达了意图** —— mac 仅麦克风分支返回 `paths=[micPath]`(**故意不含 videoPath**),Windows 分支返回 `[videoPath, micPath]`。渲染端 `audioRoutingEngine.ts` 从不读这个信号,把容器音轨又加了回来。现在判据:`hasResolvedCompanions && !hasEmbeddedSourceAudio` ⟹ 调用方主动排除内嵌音 ⟹ mute + 不导出。**必须保留"完全没有边车 ⟹ 仍播内嵌音"**,否则普通视频导出丢音(已有测试锁定)。同时删除 `audioEncoder.ts` 的 `requiresLegacyMacMicSidecarMix` —— 它对该形态强制 offline mix,正是导出端混入第二份的元凶。

**存量录制自动修好,无需重录或迁移文件。**

关键判据(代码级证明,可放心依赖):`.mic.m4a` 唯一生产者在 `register/recording.ts:716`(`capturesMicrophone` 门控),`.system.m4a` 在**同一代码块**由 `capturesSystemAudio` 门控 → **有 `.mic.m4a` 且无 `.system.m4a` ⟹ 系统音当时没开 ⟹ mp4 内嵌音只可能是麦克风或静音**。`.mic.webm`/`.system.webm` 是 `constants.ts` 里的**死条目,无任何代码写出**。

## Files Created / Changed

**M2(`15bc494`)**
- `src/components/launch/webcamPreviewResize.ts` + test — 缩放引擎(新,纯函数)
- `src/components/launch/webcamPreviewPresets.ts` — S/M/L 与形状预设常量(新,磁吸值来源)
- `src/components/launch/webcamPreviewShape.ts` + test — roundness → `border-radius` + `corner-shape`(新)
- `src/components/launch/LaunchWindow.tsx` / `.module.css` — shell/clip 分层、4 把手、尺寸药丸、过渡抑制
- `src/components/launch/hooks/useWebcamPreviewOverlay.ts` — 缩放手势 + Alt 取景手势 + 清理路径
- `src/components/launch/hooks/useLaunchHudInteractionState.ts` — 穿透 idle 守卫加 resize ref
- `src/components/launch/popovers/WebcamPopover.tsx` — 预设分段控件 + 缩略图套用 shape
- 10× `src/i18n/locales/*/launch.json` — 预设文案

**音频修复(`9ab103e`)**
- `src/lib/exporter/audioRoutingEngine.ts` — `includeEmbeddedInExport` 改读 `hasEmbeddedSourceAudio`(核心)
- `src/lib/exporter/audioEncoder.ts` — 删 `requiresLegacyMacMicSidecarMix` 及其 clause
- `src/lib/exporter/sourceTrackRoutingPolicy.test.ts` — +4 场景(mac 仅麦克风 / 无边车 / video 自证 / 双边车)
- `src/lib/exporter/audioEncoder.test.ts` — 反转那条把 bug 当规格的测试;`:114` 补 `getMediaDurationSec` 桩(测试桩缺口,非行为回归)

## Verification Results

- `npx tsc --noEmit` 干净;`npm test` **1132/1132**;Biome 对改动文件干净;`i18n:check` 的 launch.json 零错误
- **红/绿证伪**:音频修复的新测试撤掉修复即红、恢复即绿(证明能抓到该 bug,非同义反复)
- **实机(CDP 9227,ad-hoc 重签副本)**:向**运行中的真实 app 主进程**查询用户真实录音 → 返回 `paths=["recording-*.mic.m4a"]`(不含 mp4),喂入修复后路由 → `muteEmbeddedPreview=true` / `includeEmbeddedInExport=false` / **人声播放次数 = 1**
- **实机(M2)**:源 640×360 / 容器 208 → 视频盒 370×208、left −80.89(与引擎公式精确吻合);拖左上角 −30/−30 → 208→238 且 transform 不变(正确锚定右下角);roundness 30 → `border-radius:15%` + `corner-shape:superellipse(2.1699)`;roundness 100 → `round`(正圆);Alt+拖拽 video left −92.56→−52.36 且气泡不动
- **不变量**:`buildRecordingWebcamAppearance` 在 size=160 与 320 输出**相同 cropRegion** → M2 的缩放不可能回归 M1 的桥接
- 生产构建 + 签名(`codesign --verify --deep --strict` 通过)+ 安装
- **preflight push 43074d5**:whitespace clean、`PREFLIGHT_SECRETSCAN=GITLEAKS` 无泄密;`PREFLIGHT_STATE=FAIL` **仅因** worktree 有未跟踪的 `handoffs/`(上个会话遗留 + 本文件),**与已推送代码无关**
- **未验证**:① 录制→编辑器→**导出**全流程未跑(见 Next Steps 2);② 用户报告的"导出不出来"未复现(缺具体现象);③ M2 未与 Screen Studio 实物并排对照

## Known Risks

- **样式桥接(原 WP6)被 M3 阻塞,勿贸然实现**:编辑器用 `getSquircleSvgPath`(superellipse 指数 4.5)渲染摄像头,**最大圆角在对角方向比正圆外扩 21.2%**(实测算得)。HUD 的 roundness=100 是**默认值**且用户硬性要求正圆 → 桥接过去会在最常用档位上渲染成明显膨胀的方圆形,即"会骗人的开关"。正确顺序:先做 M3(编辑器 cornerRadius 相对化 + 真圆对齐,**含导出端 `drawSquircleOnCanvas`**),再桥接。
- **`diagnostics.ts` 潜在丢麦克风(未修)**:`getCompanionAudioFallbackInfo` 在 `hasUsableMacSystemCompanion` 时返回 `paths=[videoPath]`,**丢弃 mic 边车**,依赖"mp4 是系统音+麦克风的混音"这一假设。若假设不成立,麦克风**静默丢失**(比双份更糟,因为听不出来)。值得单开问题核实。
- **别从测试名字推断契约**(本次的教训):`audioEncoder.test.ts` 那条 "legacy mac mic sidecars that still need embedded audio" **只断言** `loadAudioFileDemuxer` 未调用 + `renderAndMuxOfflineAudio` 已调用,**从未断言内嵌音是被需要的**。曾据此误判、错误回滚了正确修复,并把错误前提喂给了评审面板。
- **防拉伸双保险不可拆**:Tailwind preflight 的 `video { max-width:100% }` 会压扁取景盒 —— `.webcamPreviewFrame` 的 `max-width:none` + `object-fit:cover` 缺一不可;新增任何 video 元素都要复查。
- 引擎里 `fitMode`/`showBackdrop` 是**休眠代码**(调用方全传 `"fill"`);M3 重构时别顺手"启用"。
- `corner-shape` 依赖 Chromium 150+;若将来降级 Electron 版本,roundness 0<r<100 会静默回落成普通椭圆圆角(不报错,只是不再是 squircle)。

## 测试与环境注意事项(实测坑)

- **构建/签名**:仓库在 iCloud 目录,FinderInfo xattr 会让 codesign 报 detritus。流程:`xattr -dr com.apple.FinderInfo node_modules/electron/dist electron/native/bin dist build` → `npx electron-builder --mac --arm64 --config.directories.output=/tmp/aureo-release-arm64`(输出**必须**在 iCloud 外;`npm run build` 末尾的 electron-builder 会写 `release/` 而失败,且 `release/` **未被 gitignore**)。构建触发的 `electron/native/bin` 改动是噪声,推送前 `git checkout --` 还原。
- **实机 CDP**:正式签名构建**连不上 CDP**(hardened runtime 缺 `get-task-allow`)。办法:复制产物到 /tmp,用加了 `get-task-allow` 的 entitlements `codesign --force --deep --sign -` 重签再跑;`/Applications` 里的正式版保持不动。**`open -a ... --args` 不会把参数传给 LaunchServices 缓存的实例 —— 必须直接执行 `Contents/MacOS/Aureo`**。ad-hoc 副本与正式 app **共用 user-data 目录**,测试会写用户设置,**测前备份、测后恢复**(`app-settings.json`、`hud-overlay-settings.json`)。
- **音频取证手法**:`ffmpeg ... axcorrelate` 比对 mp4 内嵌音与 `.mic.m4a` —— 相关性高(实测 0.86/0.52)= 同源 = 仅麦克风场景;近 0 才是真·系统音。**容器指纹(`encoder: Lavf`)无法区分**两种场景,因为 legacy 分支同样用 FFmpeg 就地重写边车。`volumedetect` 需去掉 `-v error`(输出在 info 级)。
- shell 的 `ls`/`cat` 有别名,脚本里用 `/bin/ls` `/bin/cat`;录音产物在 `~/Library/Application Support/Aureo/recordings/`,测试录像记得清理。

## Next Steps

1. **等用户对导出问题给出具体现象**(报错弹窗?进度卡住?无文件?)。注意:双份混音本身走导出路径,`9ab103e` 有可能已一并修好 —— 先让用户复测再查。
2. **跑一次"录制→编辑器→导出"全流程**,确认桥接的 cropRegion 在最终导出与录前预览一致(M1 遗留未验证项)。注意正式签名构建无法 CDP,需用上面的 ad-hoc 重签法,且录屏 TCC 授权绑定签名 —— **ad-hoc 副本拿不到录屏权限,这一步可能只能人工跑**。
3. **核实 `diagnostics.ts` 丢麦克风隐患**(见 Known Risks),必要时单开修复。
4. **M3**(编辑器 cornerRadius 相对化 + 真圆对齐,含导出端),完成后再回头做样式桥接。
5. 若用户报告取景"糊/拉伸/缺角",先查:video 的 `max-width` 是否被 Tailwind 夺回、`videoAspect` 来源(必须是录制轨道 `getSettings()`)、以及是否有人把 `fitMode` 传成了 `"fit"`。

---
> Read the handoff capsule at `handoffs/2026-07-16-21-40-plan-webcam-m2-shipped-audio-fix.md` before starting; it has the purpose, what's done, what's verified, the risks, and the next steps.
