# Aureo UI/UX certification runbook

This runbook turns the gates in `docs/screen-studio-parity.md` into a reproducible release check. It is intentionally separate from automated tests because capture hardware, packaged-window behavior, visual contrast over video, and perceived responsiveness require a running desktop build.

## 1. Record the candidate

For every run, capture:

- commit or working-tree identifier;
- Aureo version and packaged artifact name;
- operating system and version;
- display resolution and scale factor;
- CPU, GPU, and memory;
- microphone, camera, and capture source;
- light/dark theme and accessibility settings;
- Screen Studio version or public build date used for comparison.

Do not combine results from different candidates into one certification row.

### Build the macOS candidate

Run `pnpm build:mac` for a caption-enabled release candidate. The command requires CMake so the pinned Whisper runtime can be compiled and staged; do not use `WHISPER_RUNTIME_ALLOW_MISSING=1` for a release-certification candidate.

On macOS, `scripts/package-electron.mjs` intentionally runs Electron Builder in a system temporary directory before atomically copying the final artifacts to `release/`. This prevents Documents, iCloud, or File Provider provenance metadata from invalidating Electron helper signatures. Do not bypass the staging wrapper unless the build workspace is already outside those managed paths.

Before testing the app, mount/extract both published artifacts and require their embedded `Aureo.app` to pass:

```sh
codesign --verify --deep --strict --verbose=2 /path/to/Aureo.app
```

Record signing identity, notarization result, and whether the candidate includes the Whisper runtime. A development-signed, unnotarized, or caption-disabled package can be used for limited smoke evidence but not full release certification.

### Run isolated packaged UI automation

Run `pnpm certify:electron-ui` against the published arm64 ZIP before manual testing. The harness must:

- extract and verify the final archive outside the repository;
- launch exact `hud-overlay` and `editor` targets with separate canonical temporary user-data profiles;
- suppress certification-only permission and hardware side effects;
- report zero duplicate IDs, zero visible DOM controls without usable names, and zero unnamed interactive AX nodes;
- record keyboard traversal, six emulated-media screenshots per surface, and repeated rAF samples;
- exit both packaged processes cleanly without SIGKILL.

The latest limited macOS evidence is `release/ui-ux-certification/2026-07-18T01-34-08-677Z/report.json`. It passed the checks above, and all 12 screenshots were visually reviewed without blocking clipping, overlap, readability, or rendering defects. Launch rAF aggregate p95/max was 9.8/10.8 ms; editor p95/max was 9.8/10.3 ms across three independent 120-frame samples, with no repeated spike at or above 50 ms.

This automation does not replace VoiceOver, real keyboard workflow judgment, camera/microphone/capture hardware, long-project responsiveness, native Windows/Linux candidates, notarization, or the manual Screen Studio comparison.

## 2. Test fixtures

Prepare the same fixtures on every platform:

1. **Bright source** — mostly white browser or document content.
2. **Dark source** — mostly black editor or terminal content.
3. **Busy source** — colorful page with motion and fine text behind floating controls.
4. **Short project** — 30–60 seconds with screen, microphone, system audio, cursor telemetry, and camera when supported.
5. **Long project** — at least 20 minutes with multiple clips, captions, zooms, annotations, audio regions, and webcam layouts.
6. **Middle-mistake project** — a spoken filler or unwanted action surrounded by content that must remain.

Keep source media and project files unchanged between candidates.

## 3. Platform and mode matrix

Run the applicable checks in each row:

| Platform | Theme | Transparency | Motion | Contrast |
| --- | --- | --- | --- | --- |
| macOS | light and dark | normal and reduced | normal and reduced | normal and increased |
| Windows | light and dark | normal and solid fallback | normal and reduced | normal and forced colors |
| Linux | light and dark | solid fallback | normal and reduced | normal and high contrast when available |

A platform does not fail because it uses a solid material instead of native glass. It fails if hierarchy, readability, focus, or core behavior changes.

## 4. Primary workflow worksheet

Count only intentional user actions. Pointer travel and waiting time are recorded separately.

| Workflow | Aureo target | Aureo result | Screen Studio result | Pass |
| --- | ---: | ---: | ---: | --- |
| Start default recording after source choice | ≤3 actions |  |  |  |
| Stop and reach editable result | 1 action |  |  |  |
| Remove a middle mistake | 2 splits plus selection/delete |  |  |  |
| Add or adjust manual zoom | immediately discoverable |  |  |  |
| Quick export with prior settings | ≤2 actions |  |  |  |
| Open full export settings | 1 action |  |  |  |
| Find and run a primary command | search plus confirmation |  |  |  |

For every workflow, also record:

- time to completion;
- whether the next action was apparent without documentation;
- keyboard path;
- error or recovery behavior;
- whether the project remained recoverable after cancellation or failure.

## 5. Recording and launch checks

- Recent projects and new recording are visually distinct.
- Source, microphone, system audio, and camera state are understandable before recording.
- The microphone meter responds to real input.
- Starting with missing permissions gives a next action.
- Active and paused HUD states expose distinct **Stop**, **Cancel**, and **Hide HUD** actions.
- Stop finalizes and opens the editor.
- Cancel returns to idle, opens no editor, leaves no discarded video/webcam file, and releases microphone/camera indicators.
- Hide HUD does not stop or discard the recording.
- Finalizing and recovery states never look frozen.
- Pointer pass-through works outside real controls and draggable regions.

## 6. Editor checks

### Header and command surface

- Project identity remains readable without colliding with leading or trailing actions.
- Dirty/saved state is visible without relying only on color.
- Save, Undo, Redo, Command Menu, presets, and Export are keyboard reachable and named.
- Native window drag works on unused header space; controls remain non-draggable.
- Narrow windows disclose lower-priority controls without hiding Save or Export.

### Canvas and transport

- Video remains the dominant surface.
- Floating transport does not cover essential content at normal window sizes.
- Play/Pause, previous/next, Split, time, and preview volume have visible focus and accessible names.
- Reduced motion removes displacement and spring animation without removing state feedback.
- Glass is not applied to the video canvas.

### Inspector

- The heading matches the current scene, clip, zoom, caption, annotation, audio, webcam, or extension context.
- Selection explains why the inspector changed.
- Wallpaper, color, and gradient choices work with keyboard only and expose selected state.
- Advanced controls do not dominate the default section.
- Destructive actions are visually separated and cannot be triggered by accidental row selection.
- Scrolling preserves heading and control readability.

### Timeline

- Video, audio, webcam, captions, zoom/effects, annotation, speed, and mask lanes remain distinguishable.
- Selection treatment is consistent across lanes and still visible in grayscale/high contrast.
- Split, trim, resize, drag, ghost, and empty states are unambiguous.
- Deleting the final remaining clip is refused with feedback.
- A middle segment can be isolated with two splits and deleted without altering surrounding content.
- Waveforms redraw after resize and remain readable.
- Timeline content and waveform surfaces are not glass-backed.

## 7. Accessibility checks

Perform one complete keyboard-only pass before using a pointer:

1. Launch Aureo and select a source.
2. Configure microphone/camera controls and start recording.
3. Pause, resume, hide/show HUD when supported, and stop or cancel.
4. Open a project, rename it, save it, open Command Menu, and reach Export.
5. Play, split, select timeline items, delete a non-final clip, and change inspector sections.
6. Open and close every dialog/popover used in the path.

Verify:

- focus order follows visual order;
- focus is always visible;
- Escape closes only the active transient surface;
- focus returns to the invoking control;
- no non-modal surface traps focus;
- icon-only controls have meaningful names;
- radio/checkbox/menu semantics match behavior;
- forced-colors mode retains boundaries, selected state, focus, and destructive state;
- a screen reader announces recording state, elapsed time, project status, inspector context, and export status.

## 8. Visual checks

Capture screenshots for bright, dark, and busy fixtures in both themes at wide and narrow window widths.

Pass only when:

- text and essential icons remain readable over each fixture;
- semantic surfaces form a clear shell/canvas/inspector/timeline hierarchy;
- primary accent, selection, focus, warning, and destructive colors are not interchangeable;
- reduced transparency uses solid readable surfaces;
- no glass or backdrop blur appears on canvas, timeline rows, waveform, or long-form settings content;
- radii, control heights, icon sizes, spacing, and shadows are consistent;
- Aureo retains original branding and does not reproduce Screen Studio trade dress.

## 9. Performance checks

Use the same packaged candidate and hardware for baseline and redesigned runs.

Record:

- idle CPU and memory with a project open;
- playback CPU/GPU and dropped-frame behavior on the short project;
- scrub responsiveness on the long project;
- time from Stop to editable result;
- time to open inspector sections, Command Menu, and Export settings;
- export time and output duration/size for the same project and settings.

Pass when:

- the redesigned candidate has no sustained hidden/decorative animation;
- reduced motion removes continuous UI animation;
- timeline scrubbing does not trigger full-window backdrop recomposition;
- interaction remains responsive on the long project;
- UI-only changes do not materially change export output or timing;
- any regression outside normal measurement variance is explained and accepted before release.

Keep the renderer bundle-size warning and mixed `extensionHost.ts` import warning in the release notes until they are resolved or measured as harmless.

## 10. Export and persistence checks

For MP4, HEVC where available, and GIF:

- preview/export agree for trim, speed, zoom, background on/off, crop, cursor, webcam, captions, annotations, and audio;
- black matte is used when background is disabled;
- progress is understandable and cancellation preserves the project;
- success is shown only after the produced media validates;
- completion reveals the actual destination;
- a save failure can be retried without rerendering when supported;
- save, close, reopen, and migration preserve all editor state.

## 11. Final decision

A release certification must include:

- automated command output;
- completed platform/mode matrix;
- workflow worksheet;
- screenshot set;
- performance measurements;
- current Screen Studio comparison sources;
- accepted residual risks with an owner or follow-up issue.

Use one of these outcomes:

- **PASS** — every required gate passed.
- **CONDITIONAL PASS** — only explicitly accepted, non-core residual risks remain.
- **FAIL** — a core recording, editing, persistence, accessibility, export, or default-workflow gate failed.

Do not label an automated-only run as a full UI/UX certification.
