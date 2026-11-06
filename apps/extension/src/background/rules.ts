const CORS_RESPONSE: chrome.declarativeNetRequest.ModifyHeaderInfo[] = [
  { header: 'Access-Control-Allow-Origin', operation: chrome.declarativeNetRequest.HeaderOperation.SET, value: 'http://localhost:5173' },
  { header: 'Access-Control-Allow-Credentials', operation: chrome.declarativeNetRequest.HeaderOperation.SET, value: 'true' },
  { header: 'Access-Control-Expose-Headers', operation: chrome.declarativeNetRequest.HeaderOperation.SET, value: '*' },
  { header: 'Access-Control-Allow-Methods', operation: chrome.declarativeNetRequest.HeaderOperation.SET, value: 'GET, POST, OPTIONS, HEAD' },
  { header: 'Access-Control-Allow-Headers', operation: chrome.declarativeNetRequest.HeaderOperation.SET, value: '*' }
];

const VERCEL_CORS_RESPONSE: chrome.declarativeNetRequest.ModifyHeaderInfo[] = [
  { header: 'Access-Control-Allow-Origin', operation: chrome.declarativeNetRequest.HeaderOperation.SET, value: 'https://ourtube-zeta.vercel.app' },
  { header: 'Access-Control-Allow-Credentials', operation: chrome.declarativeNetRequest.HeaderOperation.SET, value: 'true' },
  { header: 'Access-Control-Expose-Headers', operation: chrome.declarativeNetRequest.HeaderOperation.SET, value: '*' },
  { header: 'Access-Control-Allow-Methods', operation: chrome.declarativeNetRequest.HeaderOperation.SET, value: 'GET, POST, OPTIONS, HEAD' },
  { header: 'Access-Control-Allow-Headers', operation: chrome.declarativeNetRequest.HeaderOperation.SET, value: '*' }
];

function impersonate(origin: string): chrome.declarativeNetRequest.ModifyHeaderInfo[] {
  return [
    { header: 'Origin', operation: chrome.declarativeNetRequest.HeaderOperation.SET, value: origin },
    { header: 'Referer', operation: chrome.declarativeNetRequest.HeaderOperation.SET, value: `${origin}/` },
    { header: 'X-Origin', operation: chrome.declarativeNetRequest.HeaderOperation.SET, value: origin }
  ];
}

export const EXTENSION_FETCH_RULE_ID = 100;
export const EXTENSION_MUSIC_FETCH_RULE_ID = 101;
export const EXTENSION_STATS_FETCH_RULE_ID = 102;

/**
 * Scoped to non-tab requests (tabId -1) initiated directly by the extension.
 * Notice: BotGuard (www.youtube.com/api/jnn) already allows any origin and REFUSES
 * a rewritten YouTube Origin, so we scope this strictly to youtubei endpoints.
 */
export async function installExtensionFetchRule(): Promise<void> {
  const own = (id: number, hostPath: string, origin: string): chrome.declarativeNetRequest.Rule => ({
    id,
    priority: 1,
    condition: {
      urlFilter: `||${hostPath}/`,
      tabIds: [-1],
      resourceTypes: [
        chrome.declarativeNetRequest.ResourceType.XMLHTTPREQUEST,
        chrome.declarativeNetRequest.ResourceType.OTHER
      ]
    },
    action: {
      type: chrome.declarativeNetRequest.RuleActionType.MODIFY_HEADERS,
      requestHeaders: [
        { header: 'Origin', operation: chrome.declarativeNetRequest.HeaderOperation.SET, value: origin },
        { header: 'Referer', operation: chrome.declarativeNetRequest.HeaderOperation.SET, value: `${origin}/` },
        { header: 'X-Origin', operation: chrome.declarativeNetRequest.HeaderOperation.SET, value: origin }
      ]
    }
  });

  try {
    await chrome.declarativeNetRequest.updateSessionRules({
      removeRuleIds: [EXTENSION_FETCH_RULE_ID, EXTENSION_MUSIC_FETCH_RULE_ID, EXTENSION_STATS_FETCH_RULE_ID],
      addRules: [
        own(EXTENSION_FETCH_RULE_ID, 'www.youtube.com/youtubei', 'https://www.youtube.com'),
        own(EXTENSION_MUSIC_FETCH_RULE_ID, 'music.youtube.com', 'https://music.youtube.com'),
        own(EXTENSION_STATS_FETCH_RULE_ID, 's.youtube.com', 'https://music.youtube.com')
      ]
    });
    console.log('[OurTube Companion] Session fetch rules installed for background requests.');
  } catch (err) {
    console.warn('[OurTube Companion] Failed to update session rules:', err);
  }
}

const INITIATOR_DOMAINS = [
  'localhost',
  '127.0.0.1',
  'vercel.app',
  'ourtube-zeta.vercel.app'
];

export async function installDynamicRules() {
  const rules: chrome.declarativeNetRequest.Rule[] = [
    // 1. InnerTube Music endpoints
    {
      id: 1,
      priority: 1,
      condition: {
        urlFilter: '||music.youtube.com/youtubei/',
        initiatorDomains: INITIATOR_DOMAINS,
        resourceTypes: [
          chrome.declarativeNetRequest.ResourceType.XMLHTTPREQUEST,
          chrome.declarativeNetRequest.ResourceType.OTHER
        ]
      },
      action: {
        type: chrome.declarativeNetRequest.RuleActionType.MODIFY_HEADERS,
        requestHeaders: impersonate('https://music.youtube.com'),
        responseHeaders: CORS_RESPONSE
      }
    },
    // 2. InnerTube Web endpoints
    {
      id: 2,
      priority: 1,
      condition: {
        urlFilter: '||www.youtube.com/youtubei/',
        initiatorDomains: INITIATOR_DOMAINS,
        resourceTypes: [
          chrome.declarativeNetRequest.ResourceType.XMLHTTPREQUEST,
          chrome.declarativeNetRequest.ResourceType.OTHER
        ]
      },
      action: {
        type: chrome.declarativeNetRequest.RuleActionType.MODIFY_HEADERS,
        requestHeaders: impersonate('https://www.youtube.com'),
        responseHeaders: CORS_RESPONSE
      }
    },
    // 3. YouTube session bootstrap (sw.js_data)
    {
      id: 3,
      priority: 1,
      condition: {
        urlFilter: '||www.youtube.com/sw.js_data',
        initiatorDomains: INITIATOR_DOMAINS,
        resourceTypes: [
          chrome.declarativeNetRequest.ResourceType.XMLHTTPREQUEST,
          chrome.declarativeNetRequest.ResourceType.OTHER
        ]
      },
      action: {
        type: chrome.declarativeNetRequest.RuleActionType.MODIFY_HEADERS,
        responseHeaders: CORS_RESPONSE
      }
    },
    // 4. googlevideo.com media streams
    {
      id: 4,
      priority: 1,
      condition: {
        urlFilter: '||googlevideo.com/',
        initiatorDomains: INITIATOR_DOMAINS,
        resourceTypes: [
          chrome.declarativeNetRequest.ResourceType.XMLHTTPREQUEST,
          chrome.declarativeNetRequest.ResourceType.MEDIA,
          chrome.declarativeNetRequest.ResourceType.OTHER
        ]
      },
      action: {
        type: chrome.declarativeNetRequest.RuleActionType.MODIFY_HEADERS,
        requestHeaders: impersonate('https://www.youtube.com').slice(0, 2),
        responseHeaders: CORS_RESPONSE
      }
    },
    // 5. BitChord Rule: Direct URLs minted for VISIONOS must strip Origin & Referer to avoid 403
    {
      id: 5,
      priority: 2,
      condition: {
        urlFilter: '||googlevideo.com/*c=VISIONOS',
        initiatorDomains: INITIATOR_DOMAINS,
        resourceTypes: [
          chrome.declarativeNetRequest.ResourceType.XMLHTTPREQUEST,
          chrome.declarativeNetRequest.ResourceType.MEDIA,
          chrome.declarativeNetRequest.ResourceType.OTHER
        ]
      },
      action: {
        type: chrome.declarativeNetRequest.RuleActionType.MODIFY_HEADERS,
        requestHeaders: [
          { header: 'Origin', operation: chrome.declarativeNetRequest.HeaderOperation.REMOVE },
          { header: 'Referer', operation: chrome.declarativeNetRequest.HeaderOperation.REMOVE }
        ],
        responseHeaders: CORS_RESPONSE
      }
    },
    // 6. iframe_api bootstrap
    {
      id: 6,
      priority: 1,
      condition: {
        urlFilter: '||www.youtube.com/iframe_api',
        initiatorDomains: INITIATOR_DOMAINS,
        resourceTypes: [
          chrome.declarativeNetRequest.ResourceType.XMLHTTPREQUEST,
          chrome.declarativeNetRequest.ResourceType.SCRIPT,
          chrome.declarativeNetRequest.ResourceType.OTHER
        ]
      },
      action: {
        type: chrome.declarativeNetRequest.RuleActionType.MODIFY_HEADERS,
        responseHeaders: CORS_RESPONSE
      }
    },
    // 7. Player script (s/player/)
    {
      id: 7,
      priority: 1,
      condition: {
        urlFilter: '||www.youtube.com/s/player/',
        initiatorDomains: INITIATOR_DOMAINS,
        resourceTypes: [
          chrome.declarativeNetRequest.ResourceType.XMLHTTPREQUEST,
          chrome.declarativeNetRequest.ResourceType.SCRIPT,
          chrome.declarativeNetRequest.ResourceType.OTHER
        ]
      },
      action: {
        type: chrome.declarativeNetRequest.RuleActionType.MODIFY_HEADERS,
        responseHeaders: CORS_RESPONSE
      }
    }
  ];

  try {
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: [1, 2, 3, 4, 5, 6, 7, 20, 21],
      addRules: [
        ...rules,
        {
          id: 20,
          priority: 3,
          condition: {
            urlFilter: '||www.youtube.com/youtubei/',
            initiatorDomains: ['ourtube-zeta.vercel.app', 'vercel.app'],
            resourceTypes: [
              chrome.declarativeNetRequest.ResourceType.XMLHTTPREQUEST,
              chrome.declarativeNetRequest.ResourceType.OTHER
            ]
          },
          action: {
            type: chrome.declarativeNetRequest.RuleActionType.MODIFY_HEADERS,
            requestHeaders: impersonate('https://www.youtube.com'),
            responseHeaders: VERCEL_CORS_RESPONSE
          }
        },
        {
          id: 21,
          priority: 3,
          condition: {
            urlFilter: '||music.youtube.com/youtubei/',
            initiatorDomains: ['ourtube-zeta.vercel.app', 'vercel.app'],
            resourceTypes: [
              chrome.declarativeNetRequest.ResourceType.XMLHTTPREQUEST,
              chrome.declarativeNetRequest.ResourceType.OTHER
            ]
          },
          action: {
            type: chrome.declarativeNetRequest.RuleActionType.MODIFY_HEADERS,
            requestHeaders: impersonate('https://music.youtube.com'),
            responseHeaders: VERCEL_CORS_RESPONSE
          }
        }
      ]
    });
    console.log('[OurTube Companion] Dynamic DNR rules installed successfully.');
  } catch (err) {
    console.warn('[OurTube Companion] Could not install DNR rules:', err);
  }

  await installExtensionFetchRule();
}
