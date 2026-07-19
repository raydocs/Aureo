# Editor selection audit at aa1150a

Task: AUR-SEL-001, read-only GPT Oracle audit

Exact HEAD: `aa1150a3da6fb2ed5e7ffef7395206a5f9271722`

## Current state inventory

Top-level `VideoEditor` owns parallel selected IDs for zoom, clip, speed, annotation, audio, caption, and webcam layout. Timeline-local state separately owns selected keyframe and zoom-select-all. `activeEffectSection`, keyframe drag state, and DnD live span previews are related but are not selection and should remain separate.

The IDs fan out independently through `TimelineEditor`, runtime hooks, keyboard shortcuts, canvas styling, preview, and `SettingsPanel`. DnD uses raw active IDs and need not be redesigned when selection is unified.

## Contradictions that prevent a mechanical refactor

- Reachable flows can leave clip/speed selected together with audio, caption, webcam, zoom, annotation, or keyframe.
- Keyboard delete resolves collisions by accidental precedence: zoom-all, keyframe, zoom, clip, speed, annotation, audio, caption, webcam.
- History snapshots include six selected IDs, so many selection-only clicks create undo entries; caption, keyframe, zoom-all, and Inspector section do not.
- Project load/source reset/history apply clear or restore inconsistent subsets; caption is omitted from several paths.
- Speed Inspector identity is reduced to a numeric speed. A stale or missing selected speed ID becomes indistinguishable from no speed selection.
- Keyframes and their selection are timeline-local, not persisted, and not undoable; remount behavior is lossy or potentially leaks across sources.
- Keyframe left-click selection can self-clear: marker mouse-down stops propagation, but the later click can reach the outer timeline handler that unconditionally clears the keyframe. Context-menu selection follows a different path.

## Required RED policy tests

1. Exhaustive discriminated `EditorSelection` transitions and clear-to-none.
2. Reachable collision policy: clip then audio, speed then caption/webcam, block versus keyframe/zoom-all.
3. Exhaustive delete routing by one selection kind, replacing multi-ID precedence tests only after policy is explicit.
4. History policy for selection-only changes and legacy conflicting snapshots.
5. Exact Inspector lookup by `{ kind, id }`, especially equal-speed regions and stale IDs.
6. Pointer/DnD integration: select before drag, retain on end/cancel, source-audio selects owning clip, background clears.
7. Keyframe persistence/history characterization before lifting selection ownership.

## Smallest dependency order

Policy tests; add union/pure helpers; adapt seven `VideoEditor` IDs behind one state; migrate history; migrate Inspector/preview; migrate timeline prop fan-out; fold keyframe/zoom-all selection; remove legacy resolver/clear duplication.

## Limitations

Static source audit only; no tests were run. The history implementation, full preview implementation, caption runtime, Whisper, damaged checkout, and all `* 2.*` paths were excluded. Any inspected blob change invalidates matching line advice.

Independent local-runner audit AUR-SEL-002 completed with committed-blob evidence: https://ampcode.com/threads/T-019f78e0-fd47-73c4-88fe-3e022ff30532
