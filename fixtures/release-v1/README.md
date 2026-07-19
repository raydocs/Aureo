# Release fixtures v1

This corpus contains generated, non-user data for Aureo's production-readiness gates.
Run `npm run fixtures:release:verify` before using it. Regenerate it with
`npm run fixtures:release` only when deliberately revising the fixture contract.

Project paths use `__FIXTURE_ROOT__`; a runtime harness must replace that token with
this directory's absolute path before opening a fixture. This keeps project bytes and
checksums stable across machines.

- `media/mixed-audio.mp4`: four-second H.264/AAC source with two mixed sine inputs.
- `media/sidecars/`: ten-minute silent primary video plus automatically discoverable
  `primary.mic.m4a`, `primary.system.m4a`, and `primary-webcam.mp4` companions. The low
  2 fps fixture rate keeps committed bytes bounded while preserving real seek/filmstrip
  coverage across the full long timeline.
- `media/gif-boundary-input.mp4`: 1280×720, 15 fps, ten-second input whose decoded RGBA
  working set is about 527 MiB. This is a provisional safety-boundary fixture until the
  GIF phase records a measured supported envelope.
- `projects/valid-v1.aureo`: minimal current-version project.
- `projects/future-version.aureo`: unsupported future-version project.
- `projects/corrupt-primary.aureo` plus `.bak`: truncated primary and valid backup.
- `projects/missing-media.aureo`: project whose primary media path must be relocated.
- `projects/long-timeline.aureo`: ten-minute model with 120 clips plus zoom, speed,
  caption, annotation, webcam-layout, and imported-audio regions.

Speech, silence, and non-English fixtures remain deferred with Whisper Phase 6.
