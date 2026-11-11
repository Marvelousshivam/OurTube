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
| Read SAPISID cookies, SAPISIDHASH auth | Not ported yet - see below |
| Discord Rich Presence | Not wired up yet - see below |

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

- [x] Tauri 2 shell around the existing Vite build (NSIS setup.exe)
- [x] Bridge transport swap: `bridgeClient` -> native commands on desktop
- [x] InnerTube/API proxy in Rust (anonymous, authuser=0)
- [x] In-webview stream resolution (VISIONOS + decipher fallback)
- [x] Localhost media stream server with Range support
- [x] CI workflow producing the Windows installer
- [ ] Signed-in session support: port the extension's SAPISID/SAPISIDHASH
      auth (`apps/extension/src/background/auth.ts`) - the app will hold its
      own YouTube login in its own window
- [ ] Discord Rich Presence (can connect directly from the app, no extension)
- [ ] Code signing + auto-updater

Phase 2 (bit-perfect audio):

- The DAC-perfect goal needs a native audio engine (WASAPI exclusive mode).
  Chrome-style webviews always go through the Windows mixer, which resamples.
  The Rust stream server is the seam: media bytes already flow through Rust,
  so decoding them and pushing PCM to a WASAPI-exclusive output is additive.
- It also needs a genuinely lossless source - YouTube Music tops out around
  256 kbps, so this pairs with a lossless-source extension.

## Notes

- `src-tauri` was scaffolded without a Rust toolchain at hand; the first CI
  run on this branch is the real compile check. Fix-forward on the branch.
- Bundle identifier: `app.ourtube.desktop`. Installer installs per-machine
  (NSIS); switch `installMode` to `currentUser` if admin prompts are unwanted.
