import { BridgeRequest, BridgeResponse } from '@koda/bridge-types';

const TARGET_ORIGIN = window.location.origin;

function isTrustedPageOrigin(origin: string): boolean {
  if (origin === 'https://ourtube-zeta.vercel.app') return true;
  try {
    const parsed = new URL(origin);
    return (
      parsed.protocol === 'http:' &&
      (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1')
    );
  } catch {
    return false;
  }
}

if (isTrustedPageOrigin(TARGET_ORIGIN)) {
  console.log('[OurTube Companion] Content script injected.');

  // Announce presence immediately to same-origin window only
  window.postMessage(
    {
      channel: 'OURTUBE_BRIDGE_READY',
      version: '1.0.0',
      timestamp: Date.now()
    },
    TARGET_ORIGIN
  );

  // Backward-compatibility announcement
  window.postMessage(
    {
      channel: 'KODA_BRIDGE_READY',
      version: '1.0.0',
      timestamp: Date.now()
    },
    TARGET_ORIGIN
  );

  // Relay messages from Web App -> Extension Background
  window.addEventListener('message', (event) => {
    if (
      event.source !== window ||
      event.origin !== TARGET_ORIGIN ||
      !event.data ||
      (event.data.channel !== 'OURTUBE_BRIDGE_REQ' && event.data.channel !== 'KODA_BRIDGE_REQ')
    ) {
      return;
    }

    const req = event.data as BridgeRequest;
    const resChannel = req.channel === 'OURTUBE_BRIDGE_REQ' ? 'OURTUBE_BRIDGE_RES' : 'KODA_BRIDGE_RES';

    // Guard against orphaned content script when extension is updated/reloaded
    if (!chrome.runtime || !chrome.runtime.id) {
      window.postMessage(
        {
          channel: resChannel,
          id: req.id,
          type: req.type,
          success: false,
          error: 'Extension context invalidated. Please refresh this tab (F5).'
        },
        TARGET_ORIGIN
      );
      return;
    }

    try {
      chrome.runtime.sendMessage(req, (res: BridgeResponse) => {
        if (chrome.runtime.lastError) {
          const errRes: BridgeResponse = {
            channel: resChannel,
            id: req.id,
            type: req.type,
            success: false,
            error: chrome.runtime.lastError.message
          };
          window.postMessage(errRes, TARGET_ORIGIN);
          return;
        }

        if (res) {
          window.postMessage(res, TARGET_ORIGIN);
        }
      });
    } catch (err: any) {
      window.postMessage(
        {
          channel: resChannel,
          id: req.id,
          type: req.type,
          success: false,
          error: err?.message || 'Extension context invalidated. Please refresh this tab (F5).'
        },
        TARGET_ORIGIN
      );
    }
  });
}
