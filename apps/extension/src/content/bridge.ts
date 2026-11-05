import { BridgeRequest, BridgeResponse } from '@koda/bridge-types';

console.log('[Koda Extension Bridge] Content script injected.');

// Announce presence immediately
window.postMessage(
  {
    channel: 'KODA_BRIDGE_READY',
    version: '1.0.0',
    timestamp: Date.now()
  },
  '*'
);

// Relay messages from Web App -> Extension Background
window.addEventListener('message', (event) => {
  if (event.source !== window || !event.data || event.data.channel !== 'KODA_BRIDGE_REQ') {
    return;
  }

  const req = event.data as BridgeRequest;

  chrome.runtime.sendMessage(req, (res: BridgeResponse) => {
    if (chrome.runtime.lastError) {
      window.postMessage(
        {
          channel: 'KODA_BRIDGE_RES',
          id: req.id,
          type: req.type,
          success: false,
          error: chrome.runtime.lastError.message
        } as BridgeResponse,
        '*'
      );
      return;
    }

    window.postMessage(res, '*');
  });
});
