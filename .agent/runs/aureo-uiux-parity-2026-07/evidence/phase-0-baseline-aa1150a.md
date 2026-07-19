# Phase 0 baseline at aa1150a

Recorded: 2026-07-19T05:36:37Z

## Identity

- Checkout: `/Users/ruirui/Downloads/recordlyx-recovery`
- Branch: `feat/launch-menu-bar-upgrade`
- HEAD: `aa1150a3da6fb2ed5e7ffef7395206a5f9271722`
- Baseline status: clean before fixture work; four commits ahead of origin; no push.
- Host: macOS 26.5.2 (25F84), arm64, Node 26.5.0, npm 11.17.0.
- Protected-path check: no `* 2.*` path exists in the healthy clone and no protected path was changed.

## Provisional release contract

- First channel: Track A, Developer ID direct distribution.
- Minimum macOS: 14.0, matching the existing arm64 and x86_64 native-helper targets.
- Architectures: arm64 and x64 must both be certified; current local Electron Builder defaults remain arm64-only and are a recorded mismatch, not a passed gate.
- First RC platform, auto-update policy, extension policy, and sole artifact producer remain release decisions. Recommended defaults are macOS-only, updater disabled until immutable publication exists, executable extensions disabled for v1, and CI as sole RC producer.
- Whisper remains deferred to Phase 6; no Whisper source, model, build, or staging command ran.

## Automated baseline

| Gate | Command | Result | Duration / limitation |
| --- | --- | --- | --- |
| Full Vitest | `npm test -- --reporter=dot` | PASS: 163 files, 1422 tests | 23.74 s wall; existing warning output classified, no failed tests |
| Production TypeScript | `npx tsc --noEmit` | PASS | 26.59 s wall |
| i18n | `npm run i18n:check` | PASS | 0.36 s; locale files structurally consistent |
| Full Biome | `npx biome check .` | FAIL baseline: 111 errors, 18 warnings across 613 files | Existing repository-wide formatting/import drift; no broad auto-fix performed |
| Non-Whisper build smoke | `npx vite build --config vite.config.ts && npm run normalize:electron-main-cjs && npm run smoke:electron-main-cjs` | PASS | 17.18 s; chunk-size and stale browser-data warnings remain |
| Production dependency audit | `npm audit --omit=dev --json` | FAIL baseline: one moderate advisory | Transitive `js-yaml` GHSA-h67p-54hq-rp68; fix available |
| Lockfile license inventory | package-lock package metadata scan | 742 packages inventoried | 611 MIT; 54 ISC; 15 Apache-2.0; 13 MPL-2.0; one GPL-3.0-or-later; two unknown (`parse-cache-control`, `web-demuxer`) require notice review |

The fixture generator's touched files pass targeted Biome. The repository-wide Biome failure is retained as honest baseline evidence and is not attributed to the fixture slice.

## Deterministic fixture corpus

Location: `fixtures/release-v1/`

- Mixed-audio MP4: H.264 640x360 at 30 fps plus mono 48 kHz AAC, 4 seconds.
- Sidecar bundle: ten-minute silent H.264 primary, 48 kHz AAC `primary.mic/system` companions, and H.264 `primary-webcam` video. The names match Aureo's automatic discovery contract and cover the full long timeline.
- GIF boundary input: H.264 1280x720 at 15 fps, 10 seconds; about 527 MiB decoded RGBA working set.
- Projects: valid v1, future v2, truncated primary plus valid backup, missing-media placeholder, and a ten-minute long-timeline model.
- Long timeline: 120 clips, 60 zooms, 40 speed regions, 30 annotations, 80 captions, 20 imported-audio regions, 24 webcam layouts, and source-audio settings.
- Speech, silence, and non-English fixtures are intentionally deferred to Whisper Phase 6.

Verification:

```text
npm run fixtures:release:verify
Verified 12 release fixtures.

manifest SHA-256:
f1fd36e118372bf800b7d81a9782ce1d259c4cd865339b2092c810d8af6ae5bf
```

Regeneration with the locked `ffmpeg-static` dependency produced the same checksum manifest. Because dependencies were installed with scripts disabled, only `node_modules/ffmpeg-static/install.js` was run to restore that declared package's missing binary; the project postinstall, native-helper build, and Whisper staging were not run.

## Release blocker matrix

| Blocker | Owner / phase | Prerequisite | Evidence / proposed slice |
| --- | --- | --- | --- |
| Editor shell state is fragmented | Editor 1.1 | This baseline | One discriminated derived shell state; preserve queued renderer save and atomic main save |
| Selection and history are contradictory | Phase 2 | Editor shell | AUR-SEL-001/002 inventory; policy tests before one `EditorSelection` |
| Migration, relink, untitled recovery absent | Phase 3 | Unified editor state | Frozen project fixtures now exist |
| Packaged MP4/GIF closure absent | Phase 4 | Persistence | Media/GIF fixtures now exist; Darwin FFprobe packaging remains excluded |
| Capture interruption/hardware matrix uncertified | Phase 5 | Durable project/artifact state | Physical local-runner matrix required |
| Privileged Electron boundary open | Phase 7 | Bounded role/capability design | AUR-SEC-001/002; role authorization before preload split/CSP closure |
| Local/CI architecture and artifact policy disagree | Phase 8 | Release-channel decisions | Native targets are macOS 14 dual-arch; local Builder is arm64-only; current release flow rebuilds published bytes |
| Full Biome and dependency inventory not green | Cross-cutting | Scoped cleanup/dependency decision | 111/18 full Biome baseline; one moderate production advisory; two unknown licenses |

## Limitations

- This is a source/build baseline, not packaged, signed, notarized, hardware, clean-machine, x64, or oldest-supported-OS certification.
- The fixed project fixtures establish bytes and scenarios; migration/relink/recovery harnesses do not exist yet.
- No release configuration was changed in this checkpoint; contract mismatches remain visible blockers rather than false passes.
