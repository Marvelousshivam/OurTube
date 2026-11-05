import { BridgeRequest, BridgeResponse } from '@koda/bridge-types';
import { getAuthState, setSelectedChannelId } from './auth';
import { handleProxyFetch, handleStreamResolution } from './proxy';
import { installDynamicRules } from './rules';

console.log('[Koda Extension] Background Service Worker initialized.');

chrome.runtime.onInstalled.addListener(() => {
  console.log('[Koda Extension] Installed successfully.');
  installDynamicRules();
});

chrome.runtime.onStartup.addListener(() => {
  installDynamicRules();
});

chrome.runtime.onMessage.addListener((message: BridgeRequest, _sender, sendResponse) => {
  if (!message || message.channel !== 'KODA_BRIDGE_REQ') return;

  (async () => {
    try {
      switch (message.type) {
        case 'KODA_BRIDGE_PING': {
          await installDynamicRules();
          const response: BridgeResponse = {
            channel: 'KODA_BRIDGE_RES',
            id: message.id,
            type: 'KODA_BRIDGE_PONG',
            success: true,
            data: {
              version: '1.0.0',
              status: 'ready'
            }
          };
          sendResponse(response);
          break;
        }

        case 'KODA_BRIDGE_GET_AUTH':
        case 'KODA_BRIDGE_GET_ACCOUNTS': {
          const authState = await getAuthState();
          const response: BridgeResponse = {
            channel: 'KODA_BRIDGE_RES',
            id: message.id,
            type: message.type,
            success: true,
            data: authState
          };
          sendResponse(response);
          break;
        }

        case 'KODA_BRIDGE_SELECT_ACCOUNT': {
          if (message.payload?.channelId) {
            await setSelectedChannelId(message.payload.channelId);
          }
          const authState = await getAuthState();
          const response: BridgeResponse = {
            channel: 'KODA_BRIDGE_RES',
            id: message.id,
            type: 'KODA_BRIDGE_SELECT_ACCOUNT',
            success: true,
            data: authState
          };
          sendResponse(response);
          break;
        }

        case 'KODA_BRIDGE_FETCH': {
          const fetchResult = await handleProxyFetch(message.payload);
          const response: BridgeResponse = {
            channel: 'KODA_BRIDGE_RES',
            id: message.id,
            type: 'KODA_BRIDGE_FETCH',
            success: true,
            data: fetchResult
          };
          sendResponse(response);
          break;
        }

        case 'KODA_BRIDGE_STREAM_URL': {
          const streamResult = await handleStreamResolution(message.payload);
          const response: BridgeResponse = {
            channel: 'KODA_BRIDGE_RES',
            id: message.id,
            type: 'KODA_BRIDGE_STREAM_URL',
            success: true,
            data: streamResult
          };
          sendResponse(response);
          break;
        }

        default:
          sendResponse({
            channel: 'KODA_BRIDGE_RES',
            id: message.id,
            type: message.type,
            success: false,
            error: `Unsupported message type: ${message.type}`
          });
      }
    } catch (err: any) {
      console.error('[Koda Extension] Bridge request failed:', err);
      sendResponse({
        channel: 'KODA_BRIDGE_RES',
        id: message.id,
        type: message.type,
        success: false,
        error: err?.message || 'Unknown bridge error'
      });
    }
  })();

  return true;
});
