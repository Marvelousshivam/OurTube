import { BridgeRequest, BridgeResponse } from '@koda/bridge-types';
import { getAuthState, setSelectedChannelId } from './auth';
import { handleProxyFetch, handleStreamResolution, handleScrapePage } from './proxy';
import { installDynamicRules, installExtensionFetchRule, ensureOriginDNRRules } from './rules';

console.log('[OurTube Companion] Background Service Worker initialized.');

async function autoInjectExistingTabs() {
  try {
    const tabs = await chrome.tabs.query({
      url: [
        'http://localhost/*',
        'http://127.0.0.1/*',
        'https://*.vercel.app/*',
        'https://ourtube-zeta.vercel.app/*'
      ]
    });
    for (const tab of tabs) {
      if (tab.id) {
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['bridge.js']
        }).catch((e) => console.warn('[OurTube Companion] Auto-inject skipped tab:', e));
      }
    }
  } catch (err) {
    console.warn('[OurTube Companion] Auto-inject tabs query error:', err);
  }
}

chrome.runtime.onInstalled.addListener(async () => {
  console.log('[OurTube Companion] Installed successfully.');
  await installDynamicRules();
  await installExtensionFetchRule();
  await autoInjectExistingTabs();
});

chrome.runtime.onStartup.addListener(async () => {
  await installDynamicRules();
  await installExtensionFetchRule();
  await autoInjectExistingTabs();
});

chrome.runtime.onMessage.addListener((message: BridgeRequest, _sender, sendResponse) => {
  if (!message || (message.channel !== 'KODA_BRIDGE_REQ' && message.channel !== 'OURTUBE_BRIDGE_REQ')) return;

  const resChannel = message.channel === 'OURTUBE_BRIDGE_REQ' ? 'OURTUBE_BRIDGE_RES' : 'KODA_BRIDGE_RES';

  // Automatically register DNR rules for whichever origin or preview domain is sending requests
  const senderOrigin = _sender?.origin || (() => {
    try {
      return _sender?.url ? new URL(_sender.url).origin : '';
    } catch {
      return '';
    }
  })();
  if (senderOrigin) {
    ensureOriginDNRRules(senderOrigin).catch(() => {});
  }

  (async () => {
    try {
      switch (message.type) {
        case 'OURTUBE_BRIDGE_PING' as any:
        case 'KODA_BRIDGE_PING': {
          await installDynamicRules();
          await installExtensionFetchRule();
          const response: BridgeResponse = {
            channel: resChannel,
            id: message.id,
            type: message.type,
            success: true,
            data: {
              name: 'OurTube Companion Extension',
              version: '1.0.0',
              status: 'ready'
            }
          };
          sendResponse(response);
          break;
        }

        case 'OURTUBE_BRIDGE_GET_AUTH' as any:
        case 'KODA_BRIDGE_GET_AUTH':
        case 'OURTUBE_BRIDGE_GET_ACCOUNTS' as any:
        case 'KODA_BRIDGE_GET_ACCOUNTS': {
          const authState = await getAuthState();
          const response: BridgeResponse = {
            channel: resChannel,
            id: message.id,
            type: message.type,
            success: true,
            data: authState
          };
          sendResponse(response);
          break;
        }

        case 'OURTUBE_BRIDGE_SELECT_ACCOUNT' as any:
        case 'KODA_BRIDGE_SELECT_ACCOUNT': {
          if (message.payload?.channelId) {
            await setSelectedChannelId(message.payload.channelId);
          }
          const authState = await getAuthState();
          const response: BridgeResponse = {
            channel: resChannel,
            id: message.id,
            type: message.type,
            success: true,
            data: authState
          };
          sendResponse(response);
          break;
        }

        case 'OURTUBE_BRIDGE_FETCH' as any:
        case 'KODA_BRIDGE_FETCH': {
          const fetchResult = await handleProxyFetch(message.payload);
          const response: BridgeResponse = {
            channel: resChannel,
            id: message.id,
            type: message.type,
            success: true,
            data: fetchResult
          };
          sendResponse(response);
          break;
        }

        case 'OURTUBE_BRIDGE_STREAM_URL' as any:
        case 'KODA_BRIDGE_STREAM_URL': {
          const streamResult = await handleStreamResolution(message.payload);
          const response: BridgeResponse = {
            channel: resChannel,
            id: message.id,
            type: message.type,
            success: true,
            data: streamResult
          };
          sendResponse(response);
          break;
        }

        case 'OURTUBE_BRIDGE_SCRAPE_HOME' as any:
        case 'KODA_BRIDGE_SCRAPE_HOME': {
          const scrapeResult = await handleScrapePage(message.payload?.url || 'https://www.youtube.com/');
          const response: BridgeResponse = {
            channel: resChannel,
            id: message.id,
            type: message.type,
            success: Boolean(scrapeResult),
            data: scrapeResult
          };
          sendResponse(response);
          break;
        }

        case 'OURTUBE_BRIDGE_DISCORD' as any:
        case 'KODA_BRIDGE_DISCORD': {
          // Acknowledge Discord Rich Presence relay payload cleanly
          const response: BridgeResponse = {
            channel: resChannel,
            id: message.id,
            type: message.type,
            success: true,
            data: { acknowledged: true, activity: message.payload?.activity || null }
          };
          sendResponse(response);
          break;
        }

        default:
          sendResponse({
            channel: resChannel,
            id: message.id,
            type: message.type,
            success: false,
            error: `Unsupported message type: ${message.type}`
          });
      }
    } catch (err: any) {
      console.error('[OurTube Companion] Bridge request failed:', err);
      sendResponse({
        channel: resChannel,
        id: message.id,
        type: message.type,
        success: false,
        error: err?.message || 'Unknown bridge error'
      });
    }
  })();

  return true;
});
