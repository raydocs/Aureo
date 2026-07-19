# Electron security audit at aa1150a

Task: AUR-SEC-001, read-only GPT Oracle audit

Exact HEAD: `aa1150a3da6fb2ed5e7ffef7395206a5f9271722`

## Prioritized findings

1. **P0: no authoritative IPC caller role.** All BrowserWindows share one preload, while privileged asset, export, recording, project, settings, and extension handlers do not consistently authorize `event.sender`, main-frame status, or a main-owned window role. Native export sessions can also replace their stored sender during writes and finish/cancel do not verify owner identity.
2. **P0: executable extensions share the privileged renderer.** Local/marketplace extension installation and user-over-built-in ID precedence do not provide trust or process isolation. The current renderer-side bridge guard is ineffective because the context-bridge property is normally non-configurable, and its activation-depth proxy would not contain deferred callbacks or retained references even if replacement succeeded.
3. **P1: preload is an application-wide privilege bundle.** Filesystem, export, recording, project, settings, update, and extension administration methods are exposed to low-role windows.
4. **P1: `webSecurity: false` and incomplete CSP coverage.** HUD and Editor disable web security. The packaged loopback server emits no CSP, while multiple windows and fallback paths use `loadFile`.
5. **P1: media authorization is a global path allowlist with wildcard CORS.** URLs expose canonical paths, lack opaque/revocable capabilities and requester identity, and unsupported HTTP methods can fall through to file streaming.

## Smallest dependency order

1. Fail closed on non-built-in executable extension activation and built-in ID shadowing.
2. Add main-owned `webContents.id -> WindowRole` identity plus deny-by-default role/main-frame IPC wrappers.
3. Migrate IPC by bounded domain slices and bind stateful sessions to immutable initiating sender IDs.
4. Split preloads by role as defense in depth after main authorization is authoritative.
5. Replace media paths with opaque revocable capabilities; enforce GET/HEAD, origin policy, expiry, and `no-store`.
6. Enable web security everywhere and enforce strict CSP across loopback and file/fallback load modes.

## Missing negative tests

- Wrong-role, wrong-window, subframe, and untrusted-document IPC denial.
- Native export session ownership across create/write/finish/cancel.
- Role-specific preload API snapshots and forbidden-method absence.
- Non-built-in extension execution disabled and built-in ID shadowing rejected.
- HTTP-level media token, origin, method, preflight, revocation, and path non-disclosure.
- BrowserWindow `webSecurity: true` and packaged CSP across every load path.

## Limitations

Static source audit only; no exploit/runtime test was executed. Exact role allowlists require renderer call-site inventory. Any inspected blob change invalidates matching line advice. Whisper and all `* 2.*` paths were excluded.

Independent local-runner audit AUR-SEC-002 completed with committed-blob evidence: https://ampcode.com/threads/T-019f78e0-f364-75ec-a7ed-6b18f676b061
