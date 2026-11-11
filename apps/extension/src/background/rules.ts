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

function buildCorsResponse(origin: string): chrome.declarativeNetRequest.ModifyHeaderInfo[] {
  return [
    { header: 'Access-Control-Allow-Origin', operation: chrome.declarativeNetRequest.HeaderOperation.SET, value: origin },
    { header: 'Access-Control-Allow-Credentials', operation: chrome.declarativeNetRequest.HeaderOperation.SET, value: 'true' },
    { header: 'Access-Control-Expose-Headers', operation: chrome.declarativeNetRequest.HeaderOperation.SET, value: '*' },
    { header: 'Access-Control-Allow-Methods', operation: chrome.declarativeNetRequest.HeaderOperation.SET, value: 'GET, POST, OPTIONS, HEAD' },
    { header: 'Access-Control-Allow-Headers', operation: chrome.declarativeNetRequest.HeaderOperation.SET, value: '*' }
  ];
}

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
export const DISCORD_FETCH_RULE_ID = 400;

/**
 * Discord's REST API, dressed as its own web client (extension background requests only, tabId -1).
 */
export async function installDiscordFetchRule(): Promise<void> {
  try {
    await chrome.declarativeNetRequest.updateSessionRules({
      removeRuleIds: [DISCORD_FETCH_RULE_ID],
      addRules: [
        {
          id: DISCORD_FETCH_RULE_ID,
          priority: 1,
          condition: {
            urlFilter: '||discord.com/api/',
            tabIds: [-1],
            resourceTypes: [
              chrome.declarativeNetRequest.ResourceType.XMLHTTPREQUEST,
              chrome.declarativeNetRequest.ResourceType.OTHER
            ]
          },
          action: {
            type: chrome.declarativeNetRequest.RuleActionType.MODIFY_HEADERS,
            requestHeaders: impersonate('https://discord.com').slice(0, 2)
          }
        }
      ]
    });
  } catch (err) {
    console.warn('[OurTube Companion] Failed to install Discord session rule:', err);
  }
}

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

const LOCAL_DOMAINS = ['localhost', '127.0.0.1'];
const VERCEL_DOMAINS = ['ourtube-zeta.vercel.app'];

export async function installDynamicRules() {
  const localRules: chrome.declarativeNetRequest.Rule[] = [
    // 1. InnerTube Music endpoints (Localhost)
    {
      id: 1,
      priority: 2,
      condition: {
        urlFilter: '||music.youtube.com/youtubei/',
        initiatorDomains: LOCAL_DOMAINS,
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
    // 2. InnerTube Web endpoints (Localhost)
    {
      id: 2,
      priority: 2,
      condition: {
        urlFilter: '||www.youtube.com/youtubei/',
        initiatorDomains: LOCAL_DOMAINS,
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
    // 3. YouTube session bootstrap (Localhost)
    {
      id: 3,
      priority: 2,
      condition: {
        urlFilter: '||www.youtube.com/sw.js_data',
        initiatorDomains: LOCAL_DOMAINS,
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
    // 4. googlevideo.com media streams (Localhost)
    {
      id: 4,
      priority: 2,
      condition: {
        urlFilter: '||googlevideo.com/',
        initiatorDomains: LOCAL_DOMAINS,
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
    // 5. Direct VISIONOS streams: strip Origin & Referer to avoid 403 (Localhost)
    {
      id: 5,
      priority: 3,
      condition: {
        urlFilter: '||googlevideo.com/*c=VISIONOS',
        initiatorDomains: LOCAL_DOMAINS,
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
    // 7. Player script (Localhost)
    {
      id: 7,
      priority: 2,
      condition: {
        urlFilter: '||www.youtube.com/s/player/',
        initiatorDomains: LOCAL_DOMAINS,
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

  const vercelRules: chrome.declarativeNetRequest.Rule[] = [
    // 21. InnerTube Music endpoints (Vercel)
    {
      id: 21,
      priority: 2,
      condition: {
        urlFilter: '||music.youtube.com/youtubei/',
        initiatorDomains: VERCEL_DOMAINS,
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
    },
    // 22. InnerTube Web endpoints (Vercel)
    {
      id: 22,
      priority: 2,
      condition: {
        urlFilter: '||www.youtube.com/youtubei/',
        initiatorDomains: VERCEL_DOMAINS,
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
    // 23. YouTube session bootstrap (Vercel)
    {
      id: 23,
      priority: 2,
      condition: {
        urlFilter: '||www.youtube.com/sw.js_data',
        initiatorDomains: VERCEL_DOMAINS,
        resourceTypes: [
          chrome.declarativeNetRequest.ResourceType.XMLHTTPREQUEST,
          chrome.declarativeNetRequest.ResourceType.OTHER
        ]
      },
      action: {
        type: chrome.declarativeNetRequest.RuleActionType.MODIFY_HEADERS,
        responseHeaders: VERCEL_CORS_RESPONSE
      }
    },
    // 24. googlevideo.com media streams (Vercel)
    {
      id: 24,
      priority: 2,
      condition: {
        urlFilter: '||googlevideo.com/',
        initiatorDomains: VERCEL_DOMAINS,
        resourceTypes: [
          chrome.declarativeNetRequest.ResourceType.XMLHTTPREQUEST,
          chrome.declarativeNetRequest.ResourceType.MEDIA,
          chrome.declarativeNetRequest.ResourceType.OTHER
        ]
      },
      action: {
        type: chrome.declarativeNetRequest.RuleActionType.MODIFY_HEADERS,
        requestHeaders: impersonate('https://www.youtube.com').slice(0, 2),
        responseHeaders: VERCEL_CORS_RESPONSE
      }
    },
    // 25. Direct VISIONOS streams: strip Origin & Referer to avoid 403 (Vercel)
    {
      id: 25,
      priority: 3,
      condition: {
        urlFilter: '||googlevideo.com/*c=VISIONOS',
        initiatorDomains: VERCEL_DOMAINS,
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
        responseHeaders: VERCEL_CORS_RESPONSE
      }
    },
    // 27. Player script (Vercel)
    {
      id: 27,
      priority: 2,
      condition: {
        urlFilter: '||www.youtube.com/s/player/',
        initiatorDomains: VERCEL_DOMAINS,
        resourceTypes: [
          chrome.declarativeNetRequest.ResourceType.XMLHTTPREQUEST,
          chrome.declarativeNetRequest.ResourceType.SCRIPT,
          chrome.declarativeNetRequest.ResourceType.OTHER
        ]
      },
      action: {
        type: chrome.declarativeNetRequest.RuleActionType.MODIFY_HEADERS,
        responseHeaders: VERCEL_CORS_RESPONSE
      }
    }
  ];

  try {
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: [1, 2, 3, 4, 5, 6, 7, 20, 21, 22, 23, 24, 25, 26, 27],
      addRules: [...localRules, ...vercelRules]
    });
    console.log('[OurTube Companion] Dynamic DNR rules installed successfully for Localhost & Vercel.');
  } catch (err) {
    console.warn('[OurTube Companion] Could not install DNR rules:', err);
  }

  await installExtensionFetchRule();
}

/**
 * Dynamically registers DNR rules only for approved local development ports.
 */
export async function ensureOriginDNRRules(origin: string): Promise<void> {
  if (!origin || origin.startsWith('chrome-extension://')) return;
  try {
    const urlObj = new URL(origin);
    const domain = urlObj.hostname;
    const isLocalDev =
      urlObj.protocol === 'http:' && (domain === 'localhost' || domain === '127.0.0.1');
    if (!isLocalDev) {
      return;
    }
    if (origin === 'http://localhost:5173') {
      return;
    }

    const customCors = buildCorsResponse(origin);
    const domainList = [domain];

    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: [31, 32, 33, 34, 35, 36, 37],
      addRules: [
        {
          id: 31,
          priority: 4,
          condition: {
            urlFilter: '||music.youtube.com/youtubei/',
            initiatorDomains: domainList,
            resourceTypes: [
              chrome.declarativeNetRequest.ResourceType.XMLHTTPREQUEST,
              chrome.declarativeNetRequest.ResourceType.OTHER
            ]
          },
          action: {
            type: chrome.declarativeNetRequest.RuleActionType.MODIFY_HEADERS,
            requestHeaders: impersonate('https://music.youtube.com'),
            responseHeaders: customCors
          }
        },
        {
          id: 32,
          priority: 4,
          condition: {
            urlFilter: '||www.youtube.com/youtubei/',
            initiatorDomains: domainList,
            resourceTypes: [
              chrome.declarativeNetRequest.ResourceType.XMLHTTPREQUEST,
              chrome.declarativeNetRequest.ResourceType.OTHER
            ]
          },
          action: {
            type: chrome.declarativeNetRequest.RuleActionType.MODIFY_HEADERS,
            requestHeaders: impersonate('https://www.youtube.com'),
            responseHeaders: customCors
          }
        },
        {
          id: 33,
          priority: 4,
          condition: {
            urlFilter: '||www.youtube.com/sw.js_data',
            initiatorDomains: domainList,
            resourceTypes: [
              chrome.declarativeNetRequest.ResourceType.XMLHTTPREQUEST,
              chrome.declarativeNetRequest.ResourceType.OTHER
            ]
          },
          action: {
            type: chrome.declarativeNetRequest.RuleActionType.MODIFY_HEADERS,
            responseHeaders: customCors
          }
        },
        {
          id: 34,
          priority: 4,
          condition: {
            urlFilter: '||googlevideo.com/',
            initiatorDomains: domainList,
            resourceTypes: [
              chrome.declarativeNetRequest.ResourceType.XMLHTTPREQUEST,
              chrome.declarativeNetRequest.ResourceType.MEDIA,
              chrome.declarativeNetRequest.ResourceType.OTHER
            ]
          },
          action: {
            type: chrome.declarativeNetRequest.RuleActionType.MODIFY_HEADERS,
            requestHeaders: impersonate('https://www.youtube.com').slice(0, 2),
            responseHeaders: customCors
          }
        },
        {
          id: 35,
          priority: 5,
          condition: {
            urlFilter: '||googlevideo.com/*c=VISIONOS',
            initiatorDomains: domainList,
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
            responseHeaders: customCors
          }
        },
        {
          id: 37,
          priority: 4,
          condition: {
            urlFilter: '||www.youtube.com/s/player/',
            initiatorDomains: domainList,
            resourceTypes: [
              chrome.declarativeNetRequest.ResourceType.XMLHTTPREQUEST,
              chrome.declarativeNetRequest.ResourceType.SCRIPT,
              chrome.declarativeNetRequest.ResourceType.OTHER
            ]
          },
          action: {
            type: chrome.declarativeNetRequest.RuleActionType.MODIFY_HEADERS,
            responseHeaders: customCors
          }
        }
      ]
    });
  } catch (err) {
    console.warn('[OurTube Companion] Failed to dynamically register custom origin DNR rules:', err);
  }
}

