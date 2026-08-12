/**
 * Claude Usage Tracker - content.js
 *
 * Fallback fetcher injected on claude.ai. Completely inert until the
 * background worker asks it to fetch the usage API; the page-context
 * request carries the real Origin/Referer, which succeeds when the
 * worker's own fetch is rejected by anti-bot checks.
 *
 * Privacy: no DOM access, no page listeners, no data collection - it
 * only relays the usage API response back to the extension.
 */

(() => {
  "use strict";

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || message.type !== "FETCH_USAGE" || !message.orgId) {
      return false;
    }
    const url = `${location.origin}/api/organizations/${encodeURIComponent(
      message.orgId
    )}/usage`;
    fetch(url, {
      credentials: "include",
      headers: { Accept: "application/json" },
    })
      .then(async (response) => {
        const json = response.ok ? await response.json() : null;
        sendResponse({ ok: response.ok, status: response.status, json });
      })
      .catch(() => sendResponse({ ok: false, status: 0, json: null }));
    return true; // keep the channel open for the async response
  });
})();
