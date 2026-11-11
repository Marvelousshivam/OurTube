import { BridgeRequest, BridgeResponse } from '@koda/bridge-types';
import { getAuthState, setSelectedChannelId } from './auth';
import { handleProxyFetch, handleStreamResolution, handleScrapePage } from './proxy';
import { handleLyricsFetch, installMusixmatchCookieRule } from './lyricsProxy';
import { installDynamicRules, installExtensionFetchRule, installDiscordFetchRule, ensureOriginDNRRules } from './rules';
import {
  discordState,
  connectDiscordFromTab,
  disconnectDiscord,
  setDiscordEnabled,
  setPresence
} from './discord';

console.log('[OurTube Companion] Background Service Worker initialized.');

const ALLOWED_PRODUCTION_ORIGINS = new Set([
  'https://ourtube-zeta.vercel.app'
]);

export function isTrustedBridgeOrigin(originOrUrl?: string | null): boolean {
  if (!originOrUrl) return false;
  try {
    const parsed = new URL(originOrUrl);
    if (ALLOWED_PRODUCTION_ORIGINS.has(parsed.origin)) return true;
    if (
      parsed.protocol === 'http:' &&
      (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1')
    ) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

async function autoInjectExistingTabs() {
  try {
    const tabs = await chrome.tabs.query({
      url: [
        'http://localhost/*',
        'http://127.0.0.1/*',
        'https://ourtube-zeta.vercel.app/*'
      ]
    });
    for (const tab of tabs) {
      if (tab.id && isTrustedBridgeOrigin(tab.url)) {
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
  await installDiscordFetchRule();
  await installMusixmatchCookieRule();
  await autoInjectExistingTabs();
});

chrome.runtime.onStartup.addListener(async () => {
  await installDynamicRules();
  await installExtensionFetchRule();
  await installDiscordFetchRule();
  await installMusixmatchCookieRule();
  await autoInjectExistingTabs();
});

chrome.runtime.onMessage.addListener((message: BridgeRequest, _sender, sendResponse) => {
  if (!message || (message.channel !== 'KODA_BRIDGE_REQ' && message.channel !== 'OURTUBE_BRIDGE_REQ')) return;

  const resChannel = message.channel === 'OURTUBE_BRIDGE_REQ' ? 'OURTUBE_BRIDGE_RES' : 'KODA_BRIDGE_RES';

  const senderOrigin = _sender?.origin || (() => {
    try {
      return _sender?.url ? new URL(_sender.url).origin : '';
    } catch {
      return '';
    }
  })();

  if (!isTrustedBridgeOrigin(senderOrigin)) {
    console.warn('[OurTube Companion] Blocked bridge message from untrusted origin:', senderOrigin);
    sendResponse({
      channel: resChannel,
      id: message.id,
      type: message.type,
      success: false,
      error: 'Untrusted sender origin'
    });
    return false;
  }

  ensureOriginDNRRules(senderOrigin).catch(() => {});

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

        case 'OURTUBE_BRIDGE_LYRICS_FETCH' as any:
        case 'KODA_BRIDGE_LYRICS_FETCH': {
          await installMusixmatchCookieRule();
          const lyricsResult = await handleLyricsFetch(message.payload);
          const response: BridgeResponse = {
            channel: resChannel,
            id: message.id,
            type: message.type,
            success: true,
            data: lyricsResult
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

        case 'OURTUBE_BRIDGE_DISCORD_STATE' as any:
        case 'KODA_BRIDGE_DISCORD_STATE' as any: {
          const state = await discordState();
          sendResponse({
            channel: resChannel,
            id: message.id,
            type: message.type,
            success: true,
            data: state
          });
          break;
        }

        case 'OURTUBE_BRIDGE_DISCORD_CONNECT' as any:
        case 'KODA_BRIDGE_DISCORD_CONNECT' as any: {
          const state = await connectDiscordFromTab();
          sendResponse({
            channel: resChannel,
            id: message.id,
            type: message.type,
            success: true,
            data: state
          });
          break;
        }

        case 'OURTUBE_BRIDGE_DISCORD_DISCONNECT' as any:
        case 'KODA_BRIDGE_DISCORD_DISCONNECT' as any: {
          const state = await disconnectDiscord();
          sendResponse({
            channel: resChannel,
            id: message.id,
            type: message.type,
            success: true,
            data: state
          });
          break;
        }

        case 'OURTUBE_BRIDGE_DISCORD_SET_ENABLED' as any:
        case 'KODA_BRIDGE_DISCORD_SET_ENABLED' as any: {
          const state = await setDiscordEnabled(Boolean(message.payload?.enabled));
          sendResponse({
            channel: resChannel,
            id: message.id,
            type: message.type,
            success: true,
            data: state
          });
          break;
        }

        case 'OURTUBE_BRIDGE_DISCORD' as any:
        case 'KODA_BRIDGE_DISCORD': {
          const state = await setPresence(
            message.payload?.track ?? null,
            message.payload?.options ?? {}
          );
          const response: BridgeResponse = {
            channel: resChannel,
            id: message.id,
            type: message.type,
            success: true,
            data: state
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
