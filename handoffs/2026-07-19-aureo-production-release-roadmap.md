# Handoff: Aureo Production and Distribution Readiness

Date: 2026-07-19T04:43:02Z

Status: plan; implementation has not started

Canonical thread: `T-019f77dc-0eae-76ea-b95a-93261d490c06`

Canonical checkout: `/Users/ruirui/Downloads/recordlyx-recovery`

## Purpose

This is the authoritative handoff for taking Aureo from a development build with validated Capture HUD/UI/accessibility slices to a production-quality macOS product that can be distributed publicly. Capture finalization, interruption recovery, physical hardware coverage, and long-recording reliability remain uncertified. This handoff combines the existing Aureo UI/UX parity contract with repository-specific release, reliability, security, packaging, privacy, licensing, and certification work.

“Ready to list” does not mean that TypeScript compiles or that a DMG exists. It means that the exact shipped artifact survives a clean-machine capture → edit → save → reopen → export journey, carries valid signatures and distribution evidence, meets the selected channel’s policy constraints, and has no unresolved release blocker.

## Start Here

Read, in order:

1. `.agent/runs/aureo-uiux-parity-2026-07/GOAL.md`
2. `.agent/runs/aureo-uiux-parity-2026-07/implementation-notes.html`
3. This handoff
4. `RELEASING.md`
5. `electron-builder.json5`

Then verify the baseline without touching the damaged checkout:

```bash
cd /Users/ruirui/Downloads/recordlyx-recovery
git status --short --branch
git rev-parse HEAD
git log --oneline origin/feat/launch-menu-bar-upgrade..HEAD
git diff --check
```

Expected at handoff creation:

```text
branch: feat/launch-menu-bar-upgrade
HEAD: 0a2e35cf0c88b0788883e6427ba61f689e3c1a50
origin/feat/launch-menu-bar-upgrade: 3f413681f105341cf2fcf5bc922b585c73a34921
local commits: 3
worktree: clean before this planning checkpoint
push: not performed
```

## Repository and Recovery Contract

### Canonical checkout

Use only:

```text
/Users/ruirui/Downloads/recordlyx-recovery
```

The former checkout:

```text
/Users/ruirui/Documents/recordlyx
```

is APFS-damaged historical evidence. Its Git object database contains unreadable local objects and has previously hung in `unpack_trees`. Do not develop there, run Git maintenance there, delete it, or treat it as the source of truth.

### Recovered commits

The readable state of seven inaccessible local commits was reconstructed as `cfbb73a`; subsequent Capture accessibility and visual certification are separate commits:

```text
0a2e35c Certify capture HUD responsiveness
6905579 Improve capture keyboard accessibility
cfbb73a Recover Aureo capture parity work
```

The old seven hashes are historical metadata only; their full object closure could not be read reliably. Do not attempt to rewrite the healthy branch to recreate those hashes.

### Non-negotiable safeguards

- Never push without explicit user approval.
- Never modify, delete, stage, commit, archive, or upload a `* 2.*` path.
- Use explicit `git add -- <paths>`; never `git add .` or `git add -A`.
- Keep the main thread as the sole writer unless the user explicitly grants a named subordinate a dedicated writer checkout and path scope.
- Do not run `postinstall`, `build:whisper-runtime`, `build:platform-native-helpers`, or `build:mac` before the Whisper/release-packaging gate.
- Use only the lockfile-backed `npm ci --ignore-scripts` when dependencies must be restored. It already installs the declared Electron dependency; do not run a direct package install that mutates `package.json` or `package-lock.json`.
- Do not copy Screen Studio branding, source, assets, exact colors, or pixel geometry. Match interaction clarity and platform fit only.
- Do not execute the certificate-export example in the current `RELEASING.md` from the repository. Before signing work, replace it with a human-controlled flow that selects one specific Developer ID identity, writes private-key material only to a restricted temporary location outside the checkout, cleans it up, and never exposes secrets to agent threads or logs.

## Current Product State

### Validated

- Capture HUD interaction architecture and responsive behavior.
- Native tray/application menu Pause, Resume, Stop, Restart, and Delete actions.
- Parented native warning sheets, duplicate-confirmation suppression, stale-session generation guard, and typed renderer commands.
- Renderer-owned Restart/Delete transitions with browser/webcam/mic/native stop barriers and delete-success gating.
- Project Browser modal focus safety, countdown live semantics, focusable Cancel, and Area Selection keyboard coordinates.
- Real Electron Capture certification at 1440, 1280, 960, and 880 DIP.
- Capture targeted tests, TypeScript, Biome, Vite build, and real macOS runtime evidence are recorded in the ledger.

### Not yet proven release-ready

- Editor Shell and Inspector parity.
- Timeline thumbnails, explicit semantic lanes, unified selection semantics, and long-project performance.
- Project schema migration, missing-media relinking, and recovery for never-saved projects.
- Purpose-based Export UX, bounded/validated GIF, packaged FFprobe, and end-to-end packaged export.
- Capture finalization/recovery across hardware, permissions, interruption, sleep/wake, storage pressure, and long recordings.
- Whisper runtime/model integrity, cancellation, dual-architecture packaging, privacy, and licensing.
- Renderer/IPC/extension security boundary.
- Final notarization/stapling/Gatekeeper evidence for the exact public artifacts.
- App Sandbox/Mac App Store feasibility.
- Privacy policy, app privacy disclosures, third-party notices/SBOM, and App Store metadata.

## Distribution Decision: Two Tracks, Not One Build Toggle

### Track A — Developer ID direct distribution

This is the recommended first release track: signed x64 and arm64 DMG/ZIP artifacts, Apple notarization, stapling, Gatekeeper validation, and optional signed auto-update.

Track A is currently **NO-GO** until the release blockers below are closed, but it is the shortest path to a public product.

### Track B — Mac App Store

Treat this as a separate feasibility project. The current app is not a MAS build:

- App Sandbox is absent.
- Current entitlements include JIT, unsigned executable memory, and disabled library validation.
- Project/media authority is based on raw paths rather than security-scoped bookmarks.
- FFmpeg/FFprobe/uiohook/Swift helpers need sandbox-compatible signing and behavior.
- Downloaded executable extensions are incompatible with a defensible MAS feature set.
- Global hooks/Accessibility cursor features are technically and review-sensitive.
- The AGPL app plus GPL FFmpeg distribution model requires a written legal decision before submission.

Do not block Track A product work on Track B. Start MAS only after the user chooses it and accepts a potentially reduced feature set.

## Critical Dependency Graph

```text
Release contract + fixture baseline
              │
              ▼
        Editor Shell
              │
              ▼
Unified selection → Inspector → Timeline semantics/performance
              │
              ▼
Project migration, relinking, and crash recovery
              │
      ┌───────┴────────┐
      ▼                ▼
Export hardening   Capture reliability
      └───────┬────────┘
              │
              ▼
        Whisper last
              │
              ▼
Security/privacy/package closure
              │
              ▼
Signed RC → notarization → clean-machine certification
```

Security work may be audited in parallel from day one, but privileged-boundary changes must be integrated as bounded main-writer slices and must be complete before an RC.

## Phase 0 — Release Contract and Baseline

### Decisions

Record before implementation:

- First channel: Track A recommended; Track B feasibility later.
- Minimum supported macOS: current native helper targets imply macOS 14 unless deliberately changed and tested. The choice must become an enforced build/runtime invariant, not documentation only.
- Architectures: Apple Silicon and Intel are both built in release CI while committed local packaging defaults to arm64. Certify both or explicitly reduce support, then make CI and local configuration agree.
- Whether Windows/Linux belong to the first RC or a later release.
- Whether direct release ships with auto-update or explicitly without it.
- Whether extensions are disabled for v1 or moved to a real isolated process.

### Deterministic fixtures

Create a small, non-user-data fixture set with checksums:

- MP4 with mixed audio.
- MP4 with separate microphone/system sidecars and webcam.
- Long timeline with many clips, effects, captions, waveforms, and annotations.
- Valid v1 project, future-version project, corrupt primary + valid backup, and missing/moved-media project.
- GIF boundary fixture.
- Speech, silence, and non-English fixtures for the final Whisper phase.

### Baseline gate

- Full Vitest result and duration recorded.
- Production TypeScript and Biome result recorded.
- i18n result with pre-existing failures classified.
- Vite/Electron main build smoke without Whisper staging.
- Dependency/security/license inventory.
- Release blocker matrix with owner, prerequisite, evidence, and proposed commit slice.
- Selected minimum macOS and architecture matrix enforced in native deployment targets, Electron Builder, final `Info.plist`, nested Mach-O inspection, product documentation, and oldest-supported-OS clean-machine coverage.
- One authoritative artifact source selected: either CI is the sole RC producer or the local packaging command/config must produce the identical matrix and pass the same gates.

## Phase 1 — Editor Shell

### Slice 1.1: one derived shell state

Drive project name, dirty/saving/saved/error text, Save availability, close confirmation, and Export availability from one discriminated shell state. Preserve the current serialized save/autosave and atomic main-process contract.

### Slice 1.2: responsive Inspector ownership

Keep one Inspector mount across the 1280px breakpoint. Make the narrow overlay a real modal sheet with initial focus, Tab containment, Escape/backdrop dismissal, inert background, and exact return focus. Retain the docked mode at larger widths.

### Slice 1.3: intentional shell states

Add explicit loading, empty, recoverable load-error, and save-error states. Keep one stable Export entry and no critical control overlap.

### Gate

- Screenshots at 1279×720, 1280×720, and 1440×900.
- Light/dark, reduced transparency, high contrast, and long localized labels.
- Real Electron focus loop and focus restoration.
- Dirty → close → Save/Discard/Cancel; save failure → visible retry.
- Header drag/no-drag regions remain functional.

## Phase 2 — Unified Selection, Inspector, and Timeline

### Slice 2.1: one selection contract

Replace parallel selection IDs with a discriminated `EditorSelection`. Route pointer, DnD, preview, keyboard delete, Inspector lookup, and clear-selection through it. Selection is transient UI state and must not create undo history entries.

Resolve existing user-visible keyframe behavior before release: either define and persist its actual editing property with migration or hide the lossy UI.

### Slice 2.2: selection-driven Inspector

Separate:

- selected-object settings;
- project/global settings;
- Advanced/developer controls.

No selection should display “Nothing selected”, not silently expose unrelated global effects. Avoid a framework rewrite; extract object sections around the current `SettingsPanel` contract.

### Slice 2.3: semantic lanes

Make Video, Speed, Microphone, System Audio, Zoom, Camera, Captions, Sensitive Data, Annotation, and imported Audio visually distinguishable. Surface existing mic/system waveforms. Keep canonical clip regions as the visible video lane rather than adding a duplicate legacy trim lane.

Correct the current misleading select-all behavior: implement truthful multi-selection or remove the shortcut for this release.

### Slice 2.4: bounded clip filmstrips

Decode only the visible clip range plus overscan, in source-time order. Downscale immediately, use epoch/cancellation, cap decoder concurrency, and bound cached pixels. Never seek the live preview to generate thumbnails.

### Slice 2.5: performance gate

Use the frozen long-project fixture and measure scrub-to-seek latency, RAF intervals, React commits, stale filmstrip cancellation, and memory after repeated zooming.

### Gate

- Exactly one selection kind or none.
- Pointer, keyboard, DnD, preview, and Inspector agree.
- Selection changes create no undo entry; every model mutation creates one coherent entry.
- Delete/undo/redo works for each supported item kind.
- Semantic lanes, source waveforms, and filmstrips pass visual review.
- No repeated frame above the recorded 50 ms scrub threshold.

## Phase 3 — Persistence, Relinking, and Recovery

### Slice 3.1: explicit schema policy

- Centralize `PROJECT_VERSION` handling.
- Migrate known versions before normalization.
- Reject newer unsupported projects with a clear, non-mutating error.
- Bump the schema only for a durable model change, never for UI-only selection.

### Slice 3.2: missing/moved media

Return structured missing-media roles. Support Locate File, Locate Folder, continue without optional media, and Cancel. Keep path approval in the main process and persist repaired paths only after confirmation.

### Slice 3.3: untitled recovery draft

Reuse the atomic save mechanism for app-owned recovery drafts before a project has a user path. Offer Restore, Discard, and details after restart; clear only after a successful save or explicit discard.

### Slice 3.4: forced-crash runtime evidence

Terminate during draft write, autosave, and primary replacement. Exercise corrupt primary/backup and moved-media cases.

### Gate

- v1 fixture round-trips without loss.
- Future version is rejected without modifying files.
- Valid backup restores; invalid backup never replaces a primary.
- Relink survives restart and does not approve arbitrary renderer paths.
- A never-saved dirty project restores exactly once after kill/relaunch.
- Manual save/autosave remain serialized.

## Phase 4 — Export Production Readiness

### Slice 4.1: purpose presets

Normal flow uses Share, High Quality, Smaller File, and bounded Animated GIF presets. Codec/backend/CUDA/FPS details live under Advanced. Quick Export uses the last successful preset; failures do not replace it.

### Slice 4.2: MP4/package closure

- Package matching Darwin FFprobe; the current config excludes Darwin FFprobe.
- Execute bundled FFmpeg and FFprobe in packaged smoke on x64 and arm64.
- Centralize validation before final promotion for all MP4 routes.
- Remove successful session directories.
- Cover cancel during render, mux, save dialog, and Save Again.
- Ensure window close/app quit cleans exporter processes and owned temp files.

### Slice 4.3: bounded and validated GIF

- Preflight frame count and estimated RGBA working set.
- Enforce a measured resolution/duration/output envelope.
- Stream to app-owned temp storage.
- Validate signature, dimensions, decodable frames, and positive duration/count before promotion.
- Cover cancellation during decode and GIF finalization.
- Escalate to a process-backed encoder only if product requirements exceed the measured safe envelope.

### Gate

- Every output exists, decodes, matches expected dimensions, and has duration within tolerance.
- MP4 audio tracks and A/V sync are correct.
- GIF frame count/loop and limits are correct.
- Cancel, Save Again, Discard, overwrite, and cross-volume cases leave no orphan process/temp/partial destination.
- Packaged x64/arm64 apps use only bundled architecture-correct FFmpeg/FFprobe.

## Phase 5 — Capture Reliability Hardening

Do not redesign the validated HUD. Follow Stop/Interruption through durable artifacts and the editor.

### Slice 5.1: durable finalization state

Persist `finalizing → ready | failed` with a session/generation ID and expected/available artifacts. The editor may open only with honest readiness state; late results from superseded sessions are ignored. Background failure must survive HUD closure.

### Slice 5.2: startup reconciliation

Discover interrupted finalizations, inspect artifacts, complete or offer recovery, and report missing optional tracks as warnings. Refresh an open editor exactly once at terminal state.

### Slice 5.3: physical matrix

Test internal/external mic and camera, camera disconnect, system audio, multiple displays, Retina/scaling, source window closure, permission deny/revoke, sleep/wake, storage pressure, long recording, Restart/Delete, helper/HUD/app crashes, and relaunch recovery.

### Gate

- Editor never represents an absent artifact as ready.
- Recovery is idempotent across launches.
- Optional-track failure preserves playable primary video with a visible warning.
- No orphan helper, stream, temp file, or unfinished manifest.
- Long recording A/V sync is within an explicitly accepted tolerance.
- Unsupported OS/platform behavior is declared, not implied to pass.

## Phase 6 — Whisper Last

Whisper begins only after project captions, Timeline, Export, Capture artifacts, and signing foundations are stable.

### Slice 6.1: supply chain

- Pin whisper.cpp to an immutable commit/archive plus expected SHA-256; fail closed before extraction on mismatch. Record source hash, build flags, architecture, and licenses with each runtime artifact.
- Sign every nested runtime binary/library.
- Pin model URL, expected size, and SHA-256.
- Download to temp, verify, fsync/rename, and expose storage/delete controls.

### Slice 6.2: user-purpose flow

Explain local processing, model size/storage, offline behavior, progress, Cancel, Retry, and Delete Model. Runtime/model path selectors belong under Advanced/developer UI.

### Slice 6.3: caption journey

Generate from mixed/mic/system fixtures; edit, retime, save/reopen, export burned-in captions and sidecars; cover silence, non-English, offline, low disk, cancellation, CPU/memory/thermal behavior.

### Gate

- Packaged x64/arm64 resolve only bundled signed runtime by default.
- Corrupt/truncated/wrong-hash model never becomes active.
- Cancel terminates process trees and removes partial files.
- Caption edit/save/reopen/export is lossless on fixtures.
- Privacy and third-party notices match actual local/network behavior.

## Phase 7 — Security, Privacy, and Legal Closure

This is release-blocking even if every feature test passes.

### Direct-release security blockers

1. Remove `webSecurity: false` from privileged HUD/editor windows.
2. Add production CSP to every renderer load path.
3. Add centralized main-frame + BrowserWindow role authorization for IPC, then narrow preload capabilities per window.
4. Disable executable user/marketplace extensions for the first release, or isolate them in a process/frame with no preload, Node, filesystem, shell, or arbitrary network access.
5. Replace raw-path/wildcard-CORS media URLs with revocable capability tokens; enforce GET/HEAD, origin policy, expiry, and `no-store`.
6. Minimize JIT/unsigned-memory/library-validation entitlements through actual failure-driven evidence.
7. Prohibit runtime compilation, repair, download, or mutation of packaged executables.

### Privacy and legal artifacts

- Public privacy-policy URL and in-app link.
- Accurate disclosure of screen/system audio/mic/camera capture, cursor/click/key timestamps, Accessibility use, local files, model downloads, updates, diagnostics, and deletion/retention.
- Persistent visible recording indicator and explicit initiation.
- Canonical AGPL license available in the distribution and in-app Legal/About.
- Exact shipped source link/tag and build scripts.
- FFmpeg/FFprobe and all third-party notices/SBOM; legal review of GPL obligations.
- App Store privacy labels/manifest diagnostics if Track B proceeds.

### Gate

- Negative tests prove wrong-window, subframe, and untrusted documents cannot invoke privileged IPC.
- Cross-origin pages cannot read approved local media even if path/port is known.
- Extension code is absent or genuinely isolated.
- Actual network capture matches published privacy statements.
- Final bundle contains required legal/source notices.

## Phase 8 — Packaging, Signing, and Distribution

### Track A gate

- Every Mach-O is inventoried, architecture-correct, signed inside-out with the same team, timestamped, and hardened.
- The selected minimum macOS and architecture matrix is consistent across Swift/native deployment targets, Electron Builder, final `Info.plist`, nested Mach-O load commands, documentation, and oldest-supported-OS tests.
- App, Electron helpers, Swift helpers, FFmpeg, FFprobe, uiohook, and final Whisper runtime all pass signature execution checks.
- Notarization result is Accepted and the submission ID/log is archived.
- Stapled tickets validate inside the final ZIP and mounted DMG.
- `codesign --verify --deep --strict`, `spctl --assess --type exec`, and `syspolicy_check distribution` pass.
- The exact downloaded/quarantined artifact passes Gatekeeper on clean x64 and arm64 machines.
- Auto-update either upgrades from the prior signed release with rollback evidence or is explicitly disabled/documented.

### Immutable release pipeline blocker

The current documented flow publishes a GitHub Release and then lets the publish-triggered workflow rebuild and upload assets with replacement semantics. It also launches platform jobs beyond a macOS-only decision, and Windows can fall back to an unsigned installer when signing secrets are absent. That flow must not be used for a public RC.

Before Track A can pass:

- Revise `RELEASING.md` and CI to use immutable tag → private/draft build → artifact download/quarantine → exact-hash certification → publication of those same bytes.
- Publication must never rebuild, replace, or `--clobber` a certified asset.
- The selected platform allowlist must control build jobs and uploaded assets.
- Every selected public platform must fail closed when signing, packaging, or its certification matrix is unavailable; no unsigned fallback may publish.
- Archive artifact checksums, CI provenance, notarization result, and clean-machine evidence under the same candidate identity.

### Track B feasibility gate

- Written AGPL/GPL/App Store legal decision.
- Dedicated Electron `mas-dev` and `mas` configurations, certificates, profiles, app groups, and minimal entitlements.
- App Sandbox with security-scoped bookmarks for user files.
- No executable extensions and no self-updater.
- Native helpers and capture flows pass under `mas-dev` with no unexplained sandbox denial.
- Global input/Accessibility-dependent features pass and are review-justified, or are removed from the MAS flavor.
- App Store Connect accepts the package and Apple-resigned TestFlight passes the full clean-machine journey.

## Phase 9 — Release Candidate Certification

Freeze the candidate. No feature work belongs in this phase; any behavior change invalidates the affected gates.

### Automated matrix

- Targeted tests for every phase.
- Full Vitest, production TypeScript, Biome, i18n, Vite/Electron main smoke.
- Native helper builds and packaged-binary smoke.
- Packaged x64/arm64 MP4/GIF export smoke.
- Timeline long-project benchmark.
- Project/capture kill-and-restart harness.
- Signed Electron UI certification.

### Clean-machine journey

```text
install quarantined artifact
→ permission onboarding
→ display/window/area capture with mic/system/webcam
→ stop and durable finalization
→ edit clips/zoom/audio/captions
→ save
→ quit/relaunch/reopen
→ MP4 export
→ GIF export
→ reveal result
```

Repeat with denied/revoked permissions, crash before first save, backup recovery, moved media, Export Cancel/Save Again, offline Whisper, sleep/wake, reduced motion/transparency, keyboard-only navigation, VoiceOver spot checks, and long localized labels.

### Final definition of done

- Clean worktree and immutable candidate commit/tag policy.
- All automated and runtime gates green on the exact shipped artifacts.
- Signed, notarized, stapled Track A artifacts or accepted/TestFlight-certified Track B package.
- Fresh-machine capture → edit → save → reopen → export succeeds.
- Crash/recovery and permission flows succeed.
- No orphan process, temp directory, recovery draft, partial destination, or unfinished recording session.
- Privacy policy, legal/source notices, metadata, support/contact, release notes, rollback plan, and accepted residual limitations are published.
- No release-blocking known defect remains.

## Agent-to-Agent Operating Model

Use the Amp agent-to-agent capabilities described in `https://ampcode.com/news/from-agent-to-agent`, but keep source integration centralized.

### Topology

```text
                           ┌─ Editor auditor
                           ├─ Timeline/Inspector auditor
User ←→ Coordinator/writer ├─ Persistence/Export auditor
                           ├─ Capture reliability auditor
                           ├─ Security/release reviewer
                           └─ Validator / policy sentinel
```

### Roles

- Coordinator/writer: sole source editor, integrator, committer, ledger owner, and user decision owner.
- Domain auditor: returns observed behavior, file/line evidence, gaps, and smallest slice.
- Test designer: returns reproduction, assertions, fixtures, and permitted commands.
- Diff reviewer: reviews an exact commit/range and returns actionable findings only.
- Validator: runs a specified matrix in an orb or disposable local checkout and returns logs/screenshots/hashes.
- Policy sentinel: verifies protected paths, no-push, Whisper phase, signatures, privacy, and evidence completeness.

### Orb and local rules

- Orb threads default to read-only and `agent_mode="medium"`.
- Orbs are suitable for static audits, independent diff review, unit matrices, documentation, and deterministic screenshot analysis.
- Orbs cannot prove macOS Electron behavior, TCC permissions, hardware capture, signing, notarization, VoiceOver, or Apple Silicon/Intel runtime.
- Use a live local runner/disposable healthy checkout for real macOS, native helpers, performance, packaging, signing, and hardware matrices.
- Never point a runner at the damaged Documents repo.
- If the local unpushed commits are required, use a runner or send a protected-path-checked `git archive` snapshot with its SHA-256. An orb created from the remote project cannot see unpushed local state.

### Required handoff packet for every child

```yaml
protocol: aureo-a2a/v1
task_id: AUR-<phase>-<sequence>
role: auditor | test-designer | reviewer | validator | sentinel
objective: <one bounded question>
baseline:
  path: /Users/ruirui/Downloads/recordlyx-recovery
  branch: feat/launch-menu-bar-upgrade
  head: <full SHA>
  comparison: <exact range if reviewing>
authority:
  read_only: true
  stage: false
  commit: false
  push: false
  spawn_children: false
scope:
  inspect: [exact paths/symbols]
  exclude: ["* 2.*", "Whisper until phase 6", "damaged repo"]
questions: [specific uncertainty whose answer changes implementation]
acceptance: [required file/line/runtime evidence]
return: findings + evidence + smallest next change + limitations
staleness: [paths whose blob changes invalidate the result]
```

Reject generic “finish/audit the whole editor” assignments. One thread owns one bounded question.

### Staleness and writer lock

- Every report is tied to full HEAD, comparison range, and scoped blobs.
- If a scoped file changes, rerun or re-review; never apply stale line-number advice blindly.
- Child artifacts are evidence, not workspace synchronization.
- Only the coordinator copies accepted artifacts into `.agent/runs/<goal>/evidence/`.
- A subordinate may write only after explicit user authorization names its thread, dedicated checkout/branch, exact paths, expiry, and integration method.

### Slice cadence

1. Freeze HEAD/status/protected-file inventory and acceptance criteria.
2. Fan out bounded read-only audits/test design.
3. Main writer adds a failing contract/test where practical.
4. Main writer implements the smallest vertical slice.
5. Run targeted checks, then proportionate TypeScript/Biome/build/runtime evidence.
6. Stage explicit paths only.
7. Verify no protected or premature Whisper path is staged.
8. Commit one reviewable behavior slice.
9. Send the exact commit/range to an independent reviewer.
10. Update the ledger and evidence index; remain unpushed.

## Recommended Parallel Thread Board

Run these read-only workstreams while the main writer follows the critical path:

| Thread | Scope | Starts | Returns |
|---|---|---|---|
| A | Editor shell/focus/viewports | Phase 0 | state map, focus matrix, screenshot assertions |
| B | Selection/Inspector/Timeline | Phase 0 | setter inventory, reducer tests, lane/perf plan |
| C | Project migration/relink/recovery | Phase 1 | schema fixtures, crash matrix, path threat model |
| D | Export/media validation | Phase 1 | preset mapping, MP4/GIF fixture matrix, temp ownership |
| E | Capture reliability | Phase 2 | artifact state machine, device/TCC/interruption matrix |
| F | Electron security/privacy | Phase 0 | IPC/window-role matrix, CSP/media/extension threat model |
| G | Packaging/store/legal | Phase 0 | Track A/Track B gate evidence and artifact checklist |
| H | Independent RC sentinel | Feature freeze | requirement-by-requirement go/no-go report |

The main writer should not wait for every thread. Consume only findings relevant to the current slice and invalidate stale results when scoped blobs change.

## Commit and Evidence Policy

Before each commit:

```bash
git diff --check
git status --short
git diff --name-only -- ':(glob)**/* 2.*'
git diff --cached --name-status
git diff --cached --name-only -- ':(glob)**/* 2.*'
```

Stage only named paths:

```bash
git add -- path/to/file path/to/test
```

After commit:

```bash
git diff-tree --no-commit-id --name-only -r HEAD -- ':(glob)**/* 2.*'
git status --short --branch
```

Evidence must record exact commit, command/method, OS/architecture/version, exit code/result, artifact SHA-256, and limitations. A child agent’s self-report is not sufficient for a release gate; the coordinator or an independent validator must reproduce the decisive check.

## User Decisions Required Before They Become Gates

The next agent should not block Editor work waiting for all of these, but must request them before the corresponding release phase:

1. Confirm Track A direct notarized release first, Track B MAS later, or both.
2. Confirm minimum macOS and Intel support policy.
3. Decide whether first release includes Windows/Linux.
4. Decide whether extensions are disabled in v1 or funded for process isolation.
5. Decide whether auto-update ships in v1 and provide a fixed production feed plan.
6. Provide/confirm Apple Developer team, Developer ID certificate, notarization credentials, final bundle/team IDs, and—if MAS—profiles/certificates/app group.
7. Approve privacy-policy facts, support URL/contact, pricing/territories, and EU trader status if applicable.
8. Obtain legal review for AGPL/GPL distribution, especially Mac App Store.

Never request secrets in a thread or write them into the repository. Configure them in the appropriate local keychain or GitHub secret store only when the user authorizes release work.

## Goal Ownership and Exact Next Action

The existing `aureo-uiux-parity-2026-07` file ledger already owns Editor, Timeline, Export, and integrated-release work. Continue it as the single authoritative ledger and extend its checkpoints with the production gates from this handoff. The completed runtime `/goal` represented only the Capture execution slice; do not create a second overlapping production ledger or erase the validated Capture history.

1. Continue the existing parity ledger with a new production-readiness phase/workflow.
2. Record Track A as the provisional first channel unless the user chooses otherwise.
3. Run Phase 0 baseline and produce the fixture/release-gap matrix.
4. Start Editor Shell Slice 1.1 with one derived shell state and tests.
5. In parallel, dispatch read-only security and selection inventories pinned to the current full HEAD.
6. After each slice, validate, independently review, update the one ledger, commit locally, and do not push.

## Authoritative External References

- Amp agent-to-agent workflow: `https://ampcode.com/news/from-agent-to-agent`
- Apple App Sandbox: `https://developer.apple.com/documentation/security/app-sandbox`
- Apple privacy manifest files: `https://developer.apple.com/documentation/bundleresources/privacy-manifest-files`
- Adding privacy manifests to macOS bundles: `https://developer.apple.com/documentation/bundleresources/adding-a-privacy-manifest-to-your-app-or-third-party-sdk`

Apple explicitly requires App Sandbox for Mac App Store distribution. For macOS apps, a privacy manifest—when required—belongs in `Contents/Resources/`. Re-check current Apple Developer and App Review requirements at submission time; this handoff records the 2026-07-19 audit, not an immutable policy guarantee.

---

> Continue only from `/Users/ruirui/Downloads/recordlyx-recovery`. Read the parity goal, implementation ledger, and this production roadmap; verify the full HEAD and clean status; keep the main thread as sole writer; use read-only medium orbs/GPT reviewers for bounded evidence; ship Track A only after the exact signed artifact passes notarization and clean-machine certification; do not push without explicit approval.
