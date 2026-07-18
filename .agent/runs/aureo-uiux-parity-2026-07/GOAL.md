# Aureo UI/UX Parity

Goal ID: `aureo-uiux-parity-2026-07`
Started: 2026-07-18T20:59:13Z
Parent goal: none
Mode: full
Ledger path: `.agent/runs/aureo-uiux-parity-2026-07/`

## Objective

建立并逐步实施 Aureo 的 macOS 原生感 UI/UX 体系，使录制 HUD、菜单与 Popover、编辑器 Shell、Inspector、时间线和导出工作流达到接近 Screen Studio 的逻辑性、易用性与完成度。

## Goal Mode Coupling

When creating or updating the matching `/goal`, include this ledger pointer in the goal objective:

`Maintain the agent-owned ledger at /Users/ruirui/Documents/recordlyx/.agent/runs/aureo-uiux-parity-2026-07/ and keep implementation-notes.html current at checkpoints, before compaction, and before final handoff.`

## Finishing Criteria

- [todo] Establish one coherent macOS-oriented interaction language for HUD, menus, compact popovers, inspector/sheets, dialogs, focus, motion, spacing, typography, elevation, and control states.
- [todo] Reduce the idle capture HUD to the primary recording decisions, with consistent Source, Mic, Webcam, Quality, and confirmation flows across supported viewport sizes.
- [todo] Move native-appropriate app, menu-bar, context, file, and confirmation actions to Electron/macOS native surfaces while preserving cross-platform fallbacks.
- [todo] Rework the editor shell and inspector so project/save/export state is clear and the selected object exposes its common properties without exposing implementation details.
- [todo] Make the timeline immediately communicate video, microphone/system audio, zoom, caption, webcam, and other semantic content through thumbnails, waveforms, and consistent selection/manipulation behavior.
- [todo] Simplify export around user-purpose presets and clear preparing, progress, success, failure, retry, and result actions without requiring codec/pipeline/backend knowledge in the normal flow.
- [todo] Preserve existing capture, editing, project, MP4, and GIF behavior through targeted tests, full typecheck/test/format gates, and packaged-app smoke checks proportionate to each slice.
- [todo] Validate critical flows visually at compact laptop, standard laptop, and large desktop sizes, including reduced motion/transparency, keyboard navigation, focus, high contrast, and long localized labels.
- [todo] Maintain a Screen Studio comparison matrix based on interaction principles rather than brand or pixel copying, and mark platform-limited or unverified parity honestly.
- [todo] Keep `implementation-notes.html` current with resume state, decisions, protected user work, tradeoffs, validation evidence, and the next exact action at every checkpoint.

## Definition Of Parity

Parity means Aureo reaches the same level of workflow clarity, platform fit, feedback, and progressive disclosure as Screen Studio for the supported Aureo feature set. It does not mean copying Screen Studio branding, proprietary assets, exact colors, or pixel geometry. A surface is complete only when its visual, interaction, accessibility, automation, and real-Electron checks are all evidenced.

## Phase Deliverables And Gates

1. **Foundation:** shared semantic material/state aliases; typed launch popover/native action IDs; explicit Native Menu, Compact Popover, Inspector/Sheet, and Dialog boundaries; light/dark/HUD/reduced-transparency/high-contrast/focus tests.
2. **Capture:** one-layer idle recording path; consistent Source/Mic/Webcam/Quality triggers and anchored popovers; source browsing never commits until activation; modal preflight; correct passthrough and keyboard resizing; responsive HUD evidence at 1440, 1280, 960, and 880 DIP widths.
3. **Editor shell:** clear project identity, dirty/save/export state, stable drag/no-drag regions, responsive docked/overlay inspector with one mount, selection context made explicit, global settings removed from the normal effect path, and no critical overlap at 1279×720 or 1440×900.
4. **Timeline:** clips have thumbnails; microphone/system-audio have waveforms; Zoom, Caption, Webcam, Annotation, and Audio are distinguishable semantic lanes; keyboard selection/delete and pointer DnD share selection semantics; long-project scrub has no repeated 50 ms frame spike.
5. **Export:** normal flow is purpose-preset based; codec/pipeline/backend/CUDA are absent unless Advanced is deliberately opened; quick export uses the last preset; progress, finalization, saving, success, retry, Save Again, reveal, and cancellation are coherent without changing renderer/IPC/temp-file contracts.
6. **Integrated release:** targeted and full tests, TypeScript, Biome, i18n, Electron smoke, multi-viewport/mode visual matrix, packaged macOS certification, comparison matrix, and explicit residual limitations all recorded.

Each phase must include:

- **Visual:** deterministic screenshots at its required viewport and appearance modes.
- **Interaction:** keyboard, pointer, dismissal, focus restoration, disabled, loading, success, and failure behavior.
- **Accessibility:** usable names/roles, visible focus, reduced motion/transparency, contrast, and localization stress.
- **Automation:** focused tests first, then proportionate type/lint/full-suite and Electron/runtime checks.

## Escape Hatch

Pause, ask the user, or mark a scoped item `[blocked]` / `[incomplete]` if:
- validation contradicts the goal
- the goal requires a scope change
- the agent is looping without measurable progress
- the next step risks deleting or rewriting durable memory
- the PRD and actual repo disagree
- the ledger itself contaminates validation
