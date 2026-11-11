import {
  LyricsFetchRequestPayload,
  LyricsFetchResponsePayload
} from '@koda/bridge-types';

/**
 * Lyric hosts that do not send browser CORS headers or require non-CORS GETs:
 * KuGou, Musixmatch, Genius, Apple Music catalogue (for PaxSenix), and BetterLyrics/Unison fallback.
 */
export const LYRIC_HOST_PATTERNS: readonly string[] = [
  'https://mobileservice.kugou.com/*',
  'https://lyrics.kugou.com/*',
  'https://apic.musixmatch.com/*',
  'https://www.musixmatch.com/*',
  'https://genius.com/*',
  'https://music.apple.com/*',
  'https://amp-api.music.apple.com/*',
  'https://api.paxsenix.org/*',
  'https://lyrics.paxsenix.org/*',
  'https://lyrics-api.boidu.dev/*',
  'https://unison.boidu.dev/*',
  'https://lyricsplus.prjktla.my.id/*',
  'https://lyricsplus.binimum.org/*',
  'https://lyrics-api.binimum.org/*'
];

const LYRIC_ORIGINS: ReadonlySet<string> = new Set(
  LYRIC_HOST_PATTERNS.map((pattern) => new URL(pattern.replace(/\/\*$/, '/')).origin)
);

export function isAllowedLyricUrl(raw: string): URL | null {
  try {
    const parsed = new URL(raw);
    return parsed.protocol === 'https:' && LYRIC_ORIGINS.has(parsed.origin) ? parsed : null;
  } catch {
    return null;
  }
}

const CALLER_ALLOWED_HEADERS = new Set(['authorization', 'accept', 'accept-language']);
const MAX_REDIRECTS = 5;
const MXM_DNR_RULE_ID = 98;
const mxmTokenGuid = crypto.randomUUID();

/**
 * Scoped session DNR rule that sends Musixmatch's required anonymous A/B cookie
 * ONLY on extension-initiated GETs to https://apic.musixmatch.com/ws/1.1/token.get.
 */
export async function installMusixmatchCookieRule(): Promise<void> {
  try {
    await chrome.declarativeNetRequest.updateSessionRules({
      removeRuleIds: [MXM_DNR_RULE_ID],
      addRules: [
        {
          id: MXM_DNR_RULE_ID,
          priority: 1,
          action: {
            type: chrome.declarativeNetRequest.RuleActionType.MODIFY_HEADERS,
            requestHeaders: [
              {
                header: 'Cookie',
                operation: chrome.declarativeNetRequest.HeaderOperation.SET,
                value: `x-mxm-token-guid=${mxmTokenGuid}; mxm_bab=AB`
              }
            ]
          },
          condition: {
            initiatorDomains: [chrome.runtime.id],
            urlFilter: '||apic.musixmatch.com/ws/1.1/token.get*'
          }
        }
      ]
    });
  } catch (err) {
    console.warn('[OurTube Companion] Failed to install Musixmatch session DNR rule:', err);
  }
}

function sanitizeHeaders(input: Record<string, string> | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!input) return out;
  for (const [rawKey, value] of Object.entries(input)) {
    const key = rawKey.trim().toLowerCase();
    if (CALLER_ALLOWED_HEADERS.has(key) && typeof value === 'string') {
      out[key] = value;
    }
  }
  return out;
}

export async function handleLyricsFetch(
  request: LyricsFetchRequestPayload
): Promise<LyricsFetchResponsePayload> {
  let current = isAllowedLyricUrl(request?.url || '');
  if (!current) {
    throw new Error(`Disallowed lyric host: ${request?.url || 'empty'}`);
  }

  let headers = sanitizeHeaders(request.headers);

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const response = await fetch(current.toString(), {
      method: 'GET',
      headers,
      credentials: 'omit',
      redirect: 'manual'
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location) {
        throw new Error('Redirect without Location header');
      }
      const next = isAllowedLyricUrl(new URL(location, current).toString());
      if (!next) {
        throw new Error(`Disallowed redirect target: ${location}`);
      }
      if (next.origin !== current.origin) {
        const { authorization: _dropped, ...rest } = headers;
        headers = rest;
      }
      current = next;
      continue;
    }

    const bodyText = await response.text();
    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key.toLowerCase()] = value;
    });

    return {
      status: response.status,
      headers: responseHeaders,
      body: bodyText,
      bodyEncoding: 'utf8'
    };
  }

  throw new Error('Too many redirects');
}
