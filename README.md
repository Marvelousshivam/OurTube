# OurTube 🎵🎬

A modern, high-performance web client bringing the dual-mode player architecture and Material 3 Expressive design to browsers. Powered by **Google Material Web** (`@material/web`), **Material Color Utilities** (`@material/material-color-utilities`), and a **Chromium MV3 Companion Extension** inspired by [BitChord](https://github.com/kushagrasinghx/BitChord) for zero-API-key YouTube streaming, CORS bypass, and Google session authentication.

---

## Key Features

* **Dual-Mode Playback Engine**:
  * **Music Mode**: Ambient album artwork, dynamic tonal glow, continuous seekbar, sleep controls, and queue drawer.
  * **Video Mode**: High-definition video canvas, Picture-in-Picture (PiP), quality selector (`1080p`, `720p`, `480p`, `360p`), aspect ratio toggle, and fullscreen support.
* **Material 3 Expressive (M3E) Design**:
  * Built using Google's official `@material/web` components and tokens.
  * Dynamic tonal palette extraction: Extracts colors in real-time from album art / thumbnails to dynamically re-theme the entire application.
* **OurTube Companion Extension**:
  * Strips CORS restrictions seamlessly on YouTube InnerTube endpoints.
  * Injects `SAPISIDHASH` authentication headers using your active browser session.
  * Enables zero-API-key streaming directly from YouTube Music infrastructure.
* **BitChord-Style Hard Gate**:
  * When the extension is missing, the web app presents an interactive installation tutorial and one-click zip download.
  * Features live active detection that unlocks the application immediately once loaded.
* **Synchronized Lyrics**:
  * Integrated with [LRCLIB](https://lrclib.net/) for word-by-word and line-by-line karaoke lyrics with smooth auto-scroll and tap-to-seek.
* **On-Device Taste Profile & Storage**:
  * Built-in IndexedDB engine storing local playback history, completions, and liked songs with 100% privacy and zero tracking.

---

## Project Structure

```
ourtube/
├── apps/
│   ├── web/                     # React 19 + Vite + Material Web SPA & PWA
│   │   ├── public/
│   │   │   └── downloads/       # Packaged ourtube-companion.zip for web distribution
│   │   ├── src/
│   │   │   ├── api/             # InnerTube service, bridge client & LRCLIB lyrics
│   │   │   ├── components/      # Material 3 UI, Player, Extension Gate, Queue
│   │   │   ├── pages/           # Home, Search, Library, Settings
│   │   │   ├── store/           # Zustand player & IndexedDB taste profile store
│   │   │   └── theme/           # Dynamic M3 theme engine via Material Color Utilities
│   │   └── package.json
│   │
│   └── extension/               # Chromium MV3 Companion Extension
│       ├── manifest.json        # MV3 manifest with YouTube permissions & DNR rules
│       ├── icons/               # 16, 32, 48, 128px official OurTube extension icons
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

### 1. Build & Package
```bash
npm run build
```
This builds the companion extension, packages `apps/web/public/downloads/ourtube-companion.zip`, and compiles the web application.

### 2. Install Companion Extension
1. Open your browser and navigate to `chrome://extensions` (or `edge://extensions`, `brave://extensions`).
2. Toggle on **Developer mode** (top-right corner).
3. Click **Load unpacked**.
4. Select the build directory:
   ```
   d:\YOUTUBE\apps\extension\dist
   ```
   *(Or download and extract `ourtube-companion.zip` directly from the web app)*.
5. You should see **OurTube Companion Extension** active with the official red icon.

### 3. Run Development Server
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser. The bridge will detect the companion extension automatically and unlock the full OurTube client!
