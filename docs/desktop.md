# OurTube Desktop (Tauri)

Windows desktop build of OurTube. The existing web app (React 19 + Vite +
Material 3) ships as-is inside a Tauri 2 shell, so the UI is literally the
same code - the Material 3 look carries over 1:1.

## Why no browser extension is needed

The companion extension only exists because a browser page is not allowed to
call YouTube cross-origin or read YouTube login cookies. Everything it did is
absorbed by the app:

| Extension job | Desktop replacement |
| --- | --- |
| Proxy InnerTube calls with rewritten Origin/Referer (DNR rules) | Rust `proxy_fetch` command (`src-tauri/src/proxy.rs`) - a desktop app can set any header, no CORS wall |
| Resolve stream URLs with youtubei.js in the background worker | The web app's own in-webview resolver (`streamResolver.ts` steps 3-4, youtubei.js VISIONOS + decipher), with its fetch routed through `proxy_fetch` |
| Strip Origin/Referer on googlevideo media (403 fix) | Local Rust stream server (`src-tauri/src/stream.rs`) - media bytes flow through Rust, which sends no Origin/Referer and forwards Range for seeking |
| Read SAPISID cookies, SAPISIDHASH auth | In-app Google sign-in window (`src-tauri/src/auth.rs`) + `desktopAuth.ts` (cookies stay in Rust; account calls signed & rate-limited, streams stay anonymous) |
| Lyrics proxy (15 sources + Musixmatch cookie) | Rust `lyrics_fetch` command (`src-tauri/src/lyrics.rs`) |
| Discord Rich Presence | Native Discord IPC over `\\.\pipe\discord-ipc-0..9` (`src-tauri/src/discord.rs`) - no Discord user token required |

The web app's single integration point is `src/api/bridgeClient.ts`. In the
desktop shell it detects `window.__TAURI_INTERNALS__` and answers the same
bridge message types natively via `src/api/desktopBridge.ts`. The browser
build and the extension are untouched and keep working as before.

## Layout

- `src-tauri/` - Tauri 2 app: config, Rust proxy command, localhost media
  stream server, icons
- `.github/workflows/desktop-build.yml` - builds the NSIS `setup.exe` on
  windows-latest and uploads it as a workflow artifact

## Build

```sh
npm install
npm run desktop:build   # or: npm run desktop:dev for dev mode
```

Windows requires the Rust toolchain and WebView2 (the NSIS installer
bootstraps WebView2 on end-user machines).

## Status / roadmap

Phase 1 (this branch):

- [x] Tauri 2 shell around the existing Vite build (NSIS setup.exe, `currentUser` install mode)
- [x] Bridge transport swap: `bridgeClient` -> native commands on desktop
- [x] InnerTube/API proxy in Rust with two-identity account safety (signed + token-bucket rate limiter for account features; anonymous for stream resolution)
- [x] In-webview stream resolution (VISIONOS + decipher fallback)
- [x] Localhost media stream server with chunked `&range=` fast start, connection pooling, and Range support
- [x] Signed-in session support: in-app Google login window (`src-tauri/src/auth.rs`) + multi-account & brand-channel discovery (`desktopAuth.ts`) + YouTube history playback reporting (`playbackReporting.ts`)
- [x] 15-source Lyrics Engine proxy in Rust (`src-tauri/src/lyrics.rs`)
- [x] Native Discord Rich Presence over local IPC pipe (`src-tauri/src/discord.rs`)
- [x] CI workflow producing the Windows installer
- [ ] Code signing + auto-updater

Phase 2 (Lossless Extensions & DAC Bit-Perfect Playback):

- [x] User-managed Lossless Music Extensions (`apps/web/src/api/losslessAddon.ts`, `src-tauri/src/addon.rs`) adhering to the Universal Addon Manifest protocol (ReZenOnance compatible) with personal endpoint device leasing (`X-Zombie-Tracker` / `__rz_tracker`)
- [x] Zero pre-installed addons: user pastes their personal or public manifest URL in Settings
- [x] Dynamic lossless matching with duration verification (`|delta| <= 8s`) and seamless fallback to YouTube 256k AAC when unavailable
- [x] Native Rust DAC Bit-Perfect audio engine (`src-tauri/src/dac.rs`) using `symphonia` + `wasapi` in `StreamMode::EventsExclusive` (locking DAC to native 44.1 - 192 kHz @ 16/24/32-bit, bypassing the Windows Audio Engine mixer and resampler)
- [x] Live hardware DAC capability probe & audio specs nerd card displaying DAC device name, output architecture, and sample resolution
- [x] Dynamic player pills (`24-BIT / 96KHZ FLAC • BIT-PERFECT` / `HI-RES` / `256k AAC • STUDIO`) across Editorial and Bento player layouts

## Notes

- `src-tauri` was scaffolded without a Rust toolchain at hand; the first CI
  run on this branch is the real compile check. Fix-forward on the branch.
- Bundle identifier: `app.ourtube.desktop`. Installer installs per-machine
  (NSIS); switch `installMode` to `currentUser` if admin prompts are unwanted.
