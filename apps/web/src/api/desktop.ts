/**
 * True when running inside the Tauri desktop shell instead of a browser.
 * Tauri injects __TAURI_INTERNALS__ into every webview window.
 */
export function isDesktopApp(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}
