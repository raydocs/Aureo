# Aureo UI/UX parity and certification plan

This document defines how Aureo will be redesigned and objectively evaluated against Screen Studio's publicly documented workflow. It is not a claim of affiliation and does not permit copying Screen Studio branding, assets, wording, or pixel-level trade dress.

## Product promise

A new user should be able to:

1. select a source and start a reliable recording without configuring the editor;
2. stop recording and immediately receive a polished, editable result;
3. understand the canvas, timeline, and inspector without documentation;
4. remove unwanted content, adjust emphasis, and export without losing work;
5. reveal advanced controls progressively without making the primary workflow feel like a full NLE.

Aureo may expose more power than Screen Studio, but the default path must remain at least as clear and efficient.

## Design principles

### Content first

The recorded video is the primary surface. Persistent chrome must not compete with the canvas.

### Functional glass only

Liquid Glass-inspired materials are reserved for floating navigation and control surfaces: transport controls, compact toolbars, popovers, command palette, HUD controls, and modal chrome. The canvas, timeline rows, waveform, lists, and form content remain stable content surfaces.

### Context over inventory

The inspector shows controls for the current selection. Scene controls appear with no selection; clip, zoom, annotation, caption, audio, and webcam controls appear contextually.

### Automatic quality, reversible edits

A fresh recording should look good before manual editing. Automatic zoom, cursor polish, framing, audio routing, and export defaults remain editable and undoable.

### Cross-platform honesty

macOS may use higher-fidelity native material behind a feature flag. Windows and Linux use the same hierarchy and tokens with CSS blur or solid fallbacks. Core editing never depends on native glass.

### Accessible by construction

Every control must support keyboard focus, visible focus state, accessible naming, reduced motion, reduced transparency/solid fallback, high contrast, and non-color-only state communication.

## Target information architecture

### Launch and capture

- Recent projects and `New recording` are the primary choices.
- Source, microphone, system audio, camera, and quality are visible before recording.
- Advanced capture settings are progressively disclosed.
- Live microphone activity is visible before and during recording.
- The recording HUD captures pointer input only inside real controls and draggable regions.
- Stop/finalizing/recovery states are explicit and cannot appear frozen.

### Editor shell

- Top-left: project identity and project-level actions.
- Floating center transport: previous/next, play/pause, current time, split, zoom-to-playhead.
- Top-right: quick export as the primary completion action; full export settings remain available.
- Center: content-first preview canvas with contextual on-canvas controls.
- Right: contextual inspector, not a permanent inventory of all features.
- Bottom: unified timeline with primary video, audio, webcam, captions, zoom/effects, and annotation lanes.
- Command palette: searchable access to primary editing, view, project, and export actions.

### Timeline

- Split, trim, delete, move, speed, mute, and selection behavior must be visually unambiguous.
- A delete operation must communicate whether it is ripple or leaves a gap.
- Selected items receive one consistent selection treatment across lanes.
- Handles appear on hover/selection rather than creating permanent visual noise.
- Keyboard operations show short-lived, non-blocking feedback.
- Zoom centers on the pointer or playhead according to the initiating action.
- Timeline content surfaces remain opaque enough for reliable waveform and text contrast.

### Inspector

- Scene: frame, background, crop, cursor, general audio, captions defaults.
- Clip: speed, mute, cursor overrides, delete.
- Zoom: focus, depth, transition, connection behavior.
- Annotation/mask: geometry, style, timing, delete.
- Audio: gain, fades, normalization/cleanup, timing, delete.
- Webcam: layout, crop, mirror, shape, timing, director behavior.
- Advanced controls are grouped and collapsible; destructive actions are separated.

### Export

- Quick export uses the last successful settings and presents destination/result clearly.
- Full export exposes format, codec, quality, resolution, frame rate, and advanced backend choices progressively.
- Export progress is monotonic and cancelable.
- Completion validates the produced media before reporting success.
- Failures preserve the project and explain recovery/fallback.

## Design-system contract

### Semantic surfaces

- `content`: canvas-adjacent and timeline content surfaces.
- `shell`: application background.
- `panel`: inspector and sidebar content.
- `elevated`: menus and dialogs.
- `floating`: transport and compact control chrome.
- `glass-regular`: default floating material.
- `glass-clear`: rare use over controlled, low-noise media.
- `solid-fallback`: reduced-transparency and unsupported-platform fallback.

### Interaction tokens

- consistent control heights and icon sizes;
- visible focus ring independent of hover;
- restrained spring motion for spatial transitions;
- no continuous decorative animation while video plays or timeline scrubs;
- destructive red reserved for destructive actions;
- selection and accent states must remain distinguishable in grayscale/high contrast.

## Certification gates

The redesign is not complete until all gates pass.

### 1. Functional regression

- Full automated test suite passes.
- TypeScript passes with no errors.
- Focused editor/timeline/export/recording tests pass.
- Project save/reopen preserves every supported editor state.
- Preview and export agree for trim, speed, zoom, background, crop, cursor, webcam, captions, annotations, and audio.

### 2. Primary workflow efficiency

Measured from a fresh launch with permissions already granted:

| Task | Target |
| --- | --- |
| Start a default screen recording | no more than 3 intentional clicks after source choice |
| Stop and reach an editable result | one action; finalizing state always visible |
| Remove a middle mistake | two splits plus one selection/delete, with keyboard path available |
| Add or adjust a manual zoom | discoverable from canvas/timeline and command palette |
| Quick export using prior settings | no more than 2 intentional actions |
| Open full export settings | one action from the editor |
| Find any primary editor command | command palette search plus one confirmation |

### 3. Learnability

- A first-time user can identify Record, Play/Pause, Split, Delete, Undo, and Export without documentation.
- Selection always explains why the inspector changed.
- Empty, loading, permission, finalizing, recovery, and error states provide a next action.
- Advanced backend and diagnostic controls do not dominate the default workflow.

### 4. Accessibility

- All interactive controls are keyboard reachable in a logical order.
- Icon-only controls have accessible names and tooltips where meaning is not universal.
- Focus never becomes trapped outside an intentional modal.
- Reduced motion disables non-essential spring/displacement effects.
- Reduced transparency or an application override uses solid readable surfaces.
- Forced-colors/high-contrast mode retains boundaries, focus, selection, and destructive states.
- Text and essential icons meet WCAG AA contrast against tested bright, dark, and busy video frames.

### 5. Performance

Measured in a packaged development candidate on representative hardware:

- Preview remains responsive while the inspector and floating transport are visible.
- Timeline scrubbing does not trigger full-window backdrop recomposition.
- Decorative glass is not applied to the timeline viewport or video canvas.
- No sustained animation runs while hidden or when reduced motion is active.
- Long timelines remain interactable; regressions are compared against the pre-redesign baseline.
- Export output and timing are not changed by UI-only work.

### 6. Visual consistency

- All primary surfaces use semantic tokens rather than one-off colors.
- Buttons, fields, sliders, switches, popovers, and cards use shared primitives.
- Radius, shadow, spacing, typography, selection, and focus treatments are consistent.
- Light and dark themes are both intentional.
- macOS, Windows, and Linux share hierarchy even when material fidelity differs.

### 7. Screen Studio competitive review

Use public Screen Studio builds/pages only. For each workflow, record:

- number of required actions;
- whether the next action is visually apparent;
- time to complete;
- error recovery quality;
- keyboard path;
- output quality and preview/export parity.

Aureo passes when it is equal or better on the default record-edit-export path, and any additional complexity is confined behind progressive disclosure. Feature count alone does not count as parity.

## Implementation phases

### Phase 1 — foundations

- semantic design tokens;
- functional glass and solid fallback primitives;
- button/card/input/slider/switch focus and sizing consistency;
- reduced motion/transparency/high-contrast rules;
- design-system tests.

### Phase 2 — editor shell

- content-first canvas hierarchy;
- floating transport;
- simplified project/header actions;
- quick export affordance;
- contextual inspector shell without changing editor business logic.

### Phase 3 — inspector

- consistent section architecture;
- contextual selection states;
- progressive disclosure;
- destructive action placement;
- empty and multi-selection states.

### Phase 4 — timeline

- unified visual lanes and selection;
- split/trim/delete feedback;
- hover handles and drag states;
- keyboard feedback and shortcuts;
- timeline accessibility and performance.

### Phase 5 — launch and HUD

- recent/new recording hierarchy;
- source and audio confidence states;
- compact floating HUD;
- pointer pass-through verification;
- finalizing and recovery states.

### Phase 6 — export and project completion

- quick export;
- progressive full export settings;
- clearer progress, cancellation, validation, and reveal actions;
- project dirty/save/recovery communication.

### Phase 7 — certification

- automated suite and typecheck;
- platform smoke tests;
- workflow action-count benchmark;
- accessibility audit;
- packaged performance comparison;
- visual review on bright/dark/busy source fixtures;
- documented residual risks.

## Current feature coverage

| Area | Current state | Redesign requirement |
| --- | --- | --- |
| Automatic/manual zoom | Available | contextual, understandable controls and preview/export parity |
| Cursor polish and effects | Available | simplify default controls; retain per-clip overrides |
| Background, frame, crop, aspect ratio | Available | explicit background state and clear scene hierarchy |
| Clips, trim, speed, audio | Available | safe deletion, clear ripple semantics, better lane feedback |
| Masks, highlights, annotations | Available | consistent on-canvas and timeline selection |
| Webcam layouts and director behavior | Available | contextual layout editor and predictable export |
| Captions/transcript | Available | clearer model/download/generation/editing states |
| Voice cleanup and audio routing | Available | confidence states and preview/export agreement |
| MP4/HEVC/GIF export | Available | quick export plus progressively disclosed advanced settings |
| Presets, shortcuts, command menu | Available | make them first-class workflow accelerators |

## Certification evidence — 2026-07-17

### Implemented redesign coverage

- Semantic surface, foreground, border, radius, shadow, motion, and solid-fallback tokens are shared by the editor and launch experience.
- Functional glass is limited to floating chrome, menus, the command surface, transport, and HUD; the canvas, timeline content, and waveform remain stable content surfaces.
- The editor header exposes project identity, dirty/saved state, explicit Save, presets, Command Menu, and quick Export without relying on the centered transport.
- The contextual inspector has a selection-derived heading, semantic panel structure, reduced-motion transitions, keyboard-operable wallpaper choices, independently operable custom-wallpaper removal, and progressively scoped sections.
- Normal editor Tab traversal is no longer globally suppressed; the crop editor uses modal dialog focus/Escape/restore behavior, and source selection follows a roving listbox keyboard model.
- The timeline uses lane-specific semantic surfaces, selected/ghost/empty states, visible playhead hierarchy, waveform resize reactivity, protected final-clip deletion, and a transport action that zooms the timeline around the playhead.
- Recording exposes separate Stop, Cancel/discard, and Hide HUD actions. Browser, webcam, fallback microphone, and native cancellation paths release captured media; canceled recorder chunks are prevented from being saved. Webcam preview sizing is exposed as named keyboard-operable slider handles, while the pointer-only HUD drag grip no longer advertises a false button role.
- Preview and all export renderers share explicit background-enabled behavior, including a black matte when the background is disabled.
- Export completion validates the finalized MP4 before success is reported.

### Automated evidence

| Gate | Result | Evidence |
| --- | --- | --- |
| Full automated regression | PASS | `pnpm test`: 145 files, 1256 tests passed |
| TypeScript | PASS | `pnpm tsc --noEmit` completed with no errors |
| Renderer/main/preload production build | PASS | `pnpm exec vite build --config vite.config.ts` completed successfully |
| Focused UI formatting and lint | PASS | Scoped Biome checks passed for the changed editor, inspector, launch, and shell files |
| Patch integrity | PASS | `git diff --check` completed with no errors |
| Localization catalog parity | PASS | `pnpm i18n:check` reports all locale files as structurally consistent; all nine repaired non-English `settings.json` catalogs also pass scoped Biome validation |
| macOS native helper compilation | PASS | `pnpm build` compiled the ScreenCaptureKit, window-list, cursor, and cursor-monitor helpers for `darwin-arm64` and `darwin-x64` |
| Caption-enabled macOS package | BLOCKED | the build host has no CMake, so the Whisper runtime cannot be staged; no system dependency was installed implicitly |
| Signed macOS package | PASS WITH LIMITATION | `WHISPER_RUNTIME_ALLOW_MISSING=1 node scripts/package-electron.mjs --mac` staged Electron Builder outside the Documents/File Provider path, signed `Aureo.app` with the configured Apple Development identity, and atomically copied six release files into `release/`. Both the published DMG and ZIP contain apps that pass `codesign --verify --deep --strict`; the signed app also remained alive for an 8-second startup smoke before terminating cleanly. The candidate omits the Whisper runtime and was not notarized. |
| Documents-path package diagnosis | PASS | Configured-identity and ad-hoc signing fail only when Electron Builder stages the app beneath the repository's Documents path; the same helper and complete app sign successfully in a local `/tmp` output. This isolates the macOS 26 failure to protected provenance/File Provider metadata rather than app entitlements or helper contents. |
| Packaged native-binary smoke | PASS WITH LIMITATION | `PACKAGED_SMOKE_ARCH_TAGS=darwin-arm64 PACKAGED_SMOKE_ALLOW_MISSING_WHISPER=1 pnpm smoke:packaged-binaries` extracts the published ZIP to a system temporary directory, verifies the deep/strict app signature, executes packaged FFmpeg, and checks every non-Whisper arm64 helper. Without the explicit opt-out, the same smoke correctly fails because `whisper-cli` is absent. |
| Isolated packaged UI automation | PASS WITH LIMITATION | `pnpm certify:electron-ui` produced `release/ui-ux-certification/2026-07-18T01-34-08-677Z/report.json` from the final signed ZIP. Exact launch and editor targets used separate canonical temporary user-data profiles; both reported zero duplicate IDs, zero visible DOM controls without usable names, and zero unnamed interactive AX nodes. The run recorded 40 Tab presses per surface, captured and visually reviewed 12 screenshots without blocking clipping/overlap/readability defects, and sampled three independent 120-frame rAF runs per surface (launch p95 9.8 ms/max 10.8 ms; editor p95 9.8 ms/max 10.3 ms; no ≥50 ms repeated spike). Both packaged processes exited cleanly with code 0. This is CDP/static-image evidence, not VoiceOver, hardware, or full manual certification. |
| Unpacked macOS smoke candidate | PASS WITH LIMITATION | `WHISPER_RUNTIME_ALLOW_MISSING=1 pnpm exec electron-builder --dir -c.mac.identity=null` rebuilt native modules and produced `release/mac-arm64/Aureo.app`; the packaged executable remained alive for an 8-second startup smoke and terminated cleanly. It is unsigned and omits the Whisper runtime. |

### Public Screen Studio benchmark — 2026-07-17

The comparison baseline uses Screen Studio's public website, guides, download page, and changelog rather than copied assets or an inferred private implementation. The download page identified build `3.7.3-4475`; the reviewed changelog extended through `3.7.1-4399` dated 2026-05-22.

| Workflow | Public Screen Studio evidence | Aureo comparison status |
| --- | --- | --- |
| Start recording | Launch picker supports display, window, or custom area, then microphone, webcam, system-audio configuration and Record. Public docs do not establish one fixed click count. | The runbook retains Aureo's ≤3-action target after source choice; packaged measurement is still required. |
| Stop to editable result | Stop is one control or shortcut. Public guides describe both direct editor opening and an optional Quick Share widget with an **Edit** action, so the path is setting-dependent. | Aureo targets one Stop action with an explicit finalizing state and direct editor result. Hardware validation remains required. |
| Remove a middle mistake | Public trimming guidance documents two cuts, segment selection, and Remove; reconstructed count is roughly 3–4 interactions, not a vendor-published metric. | Aureo supports two splits plus selection/delete and protects the final clip. Runtime action-count recording remains required. |
| Manual zoom | Add on the zoom timeline, adjust duration/level, choose Manual Zoom, and drag the focus point; automatic click zooms are separately configurable. | Aureo exposes manual/automatic zoom through canvas, timeline, inspector, command access, and a zoom-to-playhead transport action. Discoverability requires the manual run. |
| Command access | `⌘K` opens the Command Menu for editor, settings, and recording actions. | Aureo exposes a searchable Command Menu and keeps it in the editor header. |
| Quick export | The optional post-record widget exposes Share, Save, Copy, and Edit; each direct widget action is one action. | Aureo's editor quick export target remains ≤2 actions using prior settings. |
| Full export | Public guides document MP4/GIF, frame rate, output size, quality, file export, and clipboard output. | Aureo exposes progressive full export settings plus finalized-media validation; packaged parity remains required. |
| In-progress HUD | Public docs identify finish, pause, restart, delete, and hide behavior. | Aureo exposes distinct Stop, Cancel/discard, and Hide HUD actions and adds keyboard-operable webcam sizing. |
| Accessibility | No public Screen Studio app-wide reduced-motion policy was found; per-fragment cursor smoothing controls are documented but are not equivalent. | Aureo has explicit reduced-motion, reduced-transparency, forced-colors/high-contrast, focus, and keyboard contracts; running assistive-technology validation is pending. |
| Platform reach | Screen Studio publicly supports macOS only, recommending macOS 13.1+ and Apple Silicon. | Aureo's hierarchy and fallback contract covers macOS, Windows, and Linux, but all three packaged candidates must be tested. |

Action counts in this table are reconstructions only where the public instructions make the steps observable. Stop-to-editor and autosave behavior remain explicitly uncertain because Screen Studio's public pages describe setting-dependent or mixed paths.

### Manual evidence still required before a release certification claim

The implementation is automated-regression green, but a release must not be described as fully certified until these device- and perception-dependent checks are recorded:

- packaged macOS, Windows, and Linux smoke runs, including native capture and real microphone/camera hardware;
- bright, dark, and busy-frame visual fixtures in light, dark, reduced-transparency, and forced-colors modes;
- manual keyboard-only traversal and VoiceOver/screen-reader checks in a running Electron build; the isolated CDP Tab/AX audit is automated evidence only;
- measured action counts and completion times for the workflows in gate 2;
- packaged preview/timeline frame-time comparison on short and long projects;
- side-by-side review against a current public Screen Studio build using the criteria in gate 7.

Current build warnings are non-fatal but remain performance follow-ups: stale browser-compatibility metadata, the mixed static/dynamic `extensionHost.ts` import, and a renderer bundle above the configured chunk warning threshold.

### Current certification outcome

**FAIL — not release-certified yet.** Automated source, production-build, localization, macOS signing, and isolated packaged launch/editor UI gates pass, but the mandatory release matrix is incomplete. The signed arm64 DMG/ZIP candidate was produced and smoke-tested from a non-File-Provider staging path; it omits the Whisper runtime and was not notarized. The packaged CDP audit is clean for its tested surfaces, including zero unnamed interactive AX nodes, stable repeated rAF samples, visually reviewed static mode screenshots, and clean process exit, but it is not a VoiceOver, hardware, long-project, or manual workflow certification. A caption-enabled package remains blocked by missing CMake on the build host, Windows/Linux packages have not been produced in their native environments, and the hardware/assistive-technology/performance/workflow worksheets remain unrecorded.

The operational procedure and result worksheets are in [`docs/ui-ux-certification-runbook.md`](./ui-ux-certification-runbook.md).

## External references

- https://screen.studio/
- https://screen.studio/download
- https://screen.studio/changelog
- https://screen.studio/guide/new-recording
- https://screen.studio/guide/starting-finishing-the-recording
- https://screen.studio/guide/managing-recording-in-progress
- https://screen.studio/guide/trimming
- https://screen.studio/guide/adding-editing-zooms
- https://screen.studio/guide/manual-zoom
- https://screen.studio/guide/saving-your-project
- https://screen.studio/guide/command-menu
- https://screen.studio/guide/quick-share-widget-
- https://screen.studio/guide/exporting-the-video
- https://screen.studio/guide/system-requirements
- https://developer.apple.com/design/human-interface-guidelines/materials
- https://developer.apple.com/documentation/technologyoverviews/adopting-liquid-glass

References guide hierarchy and workflow only. Aureo must retain an original visual identity and implementation.
