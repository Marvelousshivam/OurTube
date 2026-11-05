# Koda Web 🎵🎬

A modern, high-performance web client bringing the design language and dual-mode player architecture of [Ivorisnoob/Koda](https://github.com/Ivorisnoob/Koda) to browsers. Powered by **Google Material Web** (`@material/web`), **Material Color Utilities** (`@material/material-color-utilities`), and a **Manifest V3 Companion Extension** inspired by [BitChord](https://github.com/kushagrasinghx/BitChord) for zero-API-key YouTube streaming and CORS bypass.

---

## Key Features

* **Dual-Mode Playback Engine**:
  * **Music Mode**: Ambient album artwork, dynamic color glow, continuous seekbar, sleep controls, and queue drawer.
  * **Video Mode**: High-definition video canvas, Picture-in-Picture (PiP), quality selector (`1080p`, `720p`, `480p`, `360p`), aspect ratio toggle, and fullscreen support.
* **Material 3 Expressive (M3E) Design**:
  * Built using Google's official `@material/web` components.
  * Dynamic tonal palette extraction: Extract colors in real-time from album art / thumbnails to dynamically re-theme the entire application.
* **BitChord-Style Companion Extension Bridge**:
  * Strips CORS restrictions seamlessly on YouTube InnerTube endpoints.
  * Injects `SAPISIDHASH` authentication headers using your active browser session.
  * Enables zero-API-key streaming directly from YouTube Music infrastructure.
* **Synchronized Lyrics**:
  * Integrated with [LRCLIB](https://lrclib.net/) for word-by-word and line-by-line karaoke lyrics with smooth auto-scroll and tap-to-seek.
* **On-Device Taste Profile & Storage**:
  * Built-in IndexedDB engine storing local playback history, completions, and liked songs with 100% privacy and zero tracking.

---

## Project Structure

```
koda-web/
├── apps/
│   ├── web/                     # React 19 + Vite + Material Web SPA & PWA
│   │   ├── src/
│   │   │   ├── api/             # InnerTube service, bridge client & LRCLIB lyrics
│   │   │   ├── components/      # Material 3 UI, Player (Mini, Expanded, Video), Lyrics, Queue
│   │   │   ├── pages/           # Home, Search, Library
│   │   │   ├── store/           # Zustand player & IndexedDB taste profile store
│   │   │   └── theme/           # Dynamic M3 theme engine via Material Color Utilities
│   │   └── package.json
│   │
│   └── extension/               # Chromium MV3 Companion Extension
│       ├── manifest.json        # MV3 manifest with YouTube permissions & DNR rules
│       ├── src/
│       │   ├── background/      # Service worker handling auth, SAPISIDHASH & CORS fetch
│       │   └── content/         # Bridge script relaying window.postMessage to background
│       └── dist/                # Unpacked extension build ready to load in Chrome
│
└── packages/
    └── bridge-types/            # Shared TypeScript contracts & models
```

---

## Getting Started

### 1. Build the Monorepo
```bash
npm run build
```

### 2. Load Companion Extension in Chrome / Edge / Brave
1. Open your browser and navigate to `chrome://extensions` (or `edge://extensions`).
2. Toggle on **Developer mode** (top-right corner).
3. Click **Load unpacked**.
4. Select the build directory:
   ```
   d:\YOUTUBE\apps\extension\dist
   ```
5. You should see **Koda Web Bridge Extension** active.

### 3. Run Development Server
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser. The bridge will detect the companion extension automatically, or operate gracefully in Guest Mode!
