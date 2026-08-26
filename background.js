/**
 * Claude Usage Tracker - background.js
 *
 * MV3 service worker. Every five minutes (chrome.alarms) it reads the
 * organization id from the claude.ai `lastActiveOrg` cookie, fetches the
 * usage API with the user's existing session cookies, and stores a
 * normalized snapshot in chrome.storage.local. It
 * also drives the toolbar badge and fires one desktop notification per
 * threshold per reset window (unless the user turns alerts off in the
 * popup - `settings.notificationsEnabled`, on by default).
 *
 * Privacy: the only host contacted is claude.ai, the only cookie read is
 * `lastActiveOrg` (its value is used for the request URL and never
 * logged or stored), and nothing leaves the machine.
 *
 * The worker keeps no in-memory state - everything needed across wakeups
 * lives in chrome.storage.local, so alarm-driven restarts are safe.
 */

"use strict";

// Chrome runs this file as a service worker and needs shared.js pulled in
// here; Firefox runs it as an event page where the manifest's
// background.scripts array has already loaded shared.js.
if (typeof importScripts === "function") {
  importScripts("shared.js");
}

const API_ORIGIN = "https://claude.ai";
const ORG_COOKIE_NAME = "lastActiveOrg";
const REFRESH_ALARM = "refresh-usage";
const REFRESH_PERIOD_MINUTES = 5;
const NOTIFY_THRESHOLDS = [70, 80, 90, 95];
// User preferences, editable from the popup. Kept in storage under
// `settings` so future options slot in without a migration.
const DEFAULT_SETTINGS = { notificationsEnabled: true };
const BADGE_COLORS = {
  ok: "#15803d",
  warn: "#b45309",
  critical: "#b91c1c",
  stale: "#6b7280",
};

/**
 * Read the organization id from the claude.ai cookie, or null. Also
 * returns null when cookie access itself fails - e.g. on Firefox, where
 * the claude.ai host permission is user-grantable and may be off.
 */
const getOrgId = async () => {
  let cookie;
  try {
    cookie = await chrome.cookies.get({
      url: API_ORIGIN,
      name: ORG_COOKIE_NAME,
    });
  } catch (_err) {
    return null;
  }
  if (!cookie || !cookie.value) return null;
  try {
    return decodeURIComponent(cookie.value);
  } catch (_err) {
    return cookie.value;
  }
};

/**
 * Fetch the usage API directly from the worker. Session cookies are
 * attached automatically thanks to the claude.ai host permission.
 *
 * @returns {Promise<{ok: boolean, status: number, json: object|null}>}
 */
const fetchFromWorker = async (orgId) => {
  const response = await fetch(
    `${API_ORIGIN}/api/organizations/${encodeURIComponent(orgId)}/usage`,
    { credentials: "include", headers: { Accept: "application/json" } }
  );
  const json = response.ok ? await response.json() : null;
  return { ok: response.ok, status: response.status, json };
};

/**
 * Fallback: ask the content script in an open claude.ai tab to perform
 * the same fetch from page context (real Origin/Referer), for when the
 * worker request is rejected by anti-bot checks.
 *
 * @returns {Promise<{ok: boolean, status: number, json: object|null}|null>}
 *   null when no claude.ai tab is available to ask.
 */
const fetchViaTab = async (orgId) => {
  const tabs = await chrome.tabs.query({ url: `${API_ORIGIN}/*` });
  for (const tab of tabs) {
    try {
      const reply = await chrome.tabs.sendMessage(tab.id, {
        type: "FETCH_USAGE",
        orgId,
      });
      if (reply) return reply;
    } catch (_err) {
      // Tab may be discarded or mid-navigation - try the next one.
    }
  }
  return null;
};

/**
 * Whitelist known metric keys and clamp values; unknown/extra fields
 * are ignored so drift in this unversioned API degrades gracefully.
 *
 * @param {object} json raw usage API response
 * @returns {object} metrics keyed by API field, {} when nothing matched
 */
const normalizeUsage = (json) => {
  const metrics = {};
  if (!json || typeof json !== "object") return metrics;
  for (const { key } of METRICS) {
    const entry = json[key];
    if (!entry || typeof entry !== "object") continue;
    const utilization = Number(entry.utilization);
    if (!Number.isFinite(utilization)) continue;
    metrics[key] = {
      utilization: Math.min(100, Math.max(0, Math.round(utilization))),
      resetsAt: typeof entry.resets_at === "string" ? entry.resets_at : null,
    };
  }
  return metrics;
};

/** Localized label for a known metric key. */
const metricLabel = (key) => {
  const known = METRICS.find((metric) => metric.key === key);
  return known ? chrome.i18n.getMessage(known.msgKey) : key;
};

/** The metric with the highest utilization - drives badge and alerts UI. */
const maxMetric = (metrics) => {
  let top = null;
  for (const [key, entry] of Object.entries(metrics)) {
    if (entry && (!top || entry.utilization > top.utilization)) {
      top = { key, ...entry };
    }
  }
  return top;
};

/** Paint the toolbar badge from the snapshot (or an error state). */
const updateBadge = async (snapshot) => {
  let text = "!";
  let color = BADGE_COLORS.stale;
  let title = chrome.i18n.getMessage("extensionTitle");

  const metrics = snapshot.metrics || {};
  // Badge shows the current session; weekly limits appear in the hover
  // title and popup. Fall back to the busiest metric when no session
  // window is active.
  const top = metrics.five_hour || maxMetric(metrics);
  if (top) {
    text = `${top.utilization}%`;
    color = snapshot.error
      ? BADGE_COLORS.stale
      : BADGE_COLORS[levelForUtilization(top.utilization)];
    const summary = Object.entries(metrics)
      .map(([key, entry]) => `${metricLabel(key)} ${entry.utilization}%`)
      .join(" · ");
    title = chrome.i18n.getMessage("badgeTitleSummary", [summary]);
  } else if (snapshot.error && snapshot.error.code === "signed_out") {
    text = "?";
  }

  await chrome.action.setBadgeText({ text });
  await chrome.action.setBadgeBackgroundColor({ color });
  await chrome.action.setBadgeTextColor({ color: "#ffffff" });
  await chrome.action.setTitle({ title });
};

/**
 * Fire at most one notification per metric per refresh, for the highest
 * newly crossed threshold. The dedupe map stores the highest threshold
 * already notified per metric key. It is deliberately NOT keyed on
 * `resets_at`: that value can shift between fetches for rolling windows,
 * which would wipe the dedupe state and re-notify on every refresh. The
 * entry is cleared only when utilization drops back below every
 * threshold - i.e. the window really did reset - so notifications fire
 * again in the next window.
 *
 * When `enabled` is false no notification is created, but the dedupe
 * map is still advanced - thresholds crossed while muted stay recorded,
 * so re-enabling alerts doesn't replay them.
 *
 * @returns {object} the updated dedupe map to persist
 */
const checkNotifications = (metrics, notifiedMap, now, enabled) => {
  const next = {};
  for (const [key, entry] of Object.entries(metrics)) {
    if (!entry) continue;
    const crossed = NOTIFY_THRESHOLDS.filter(
      (threshold) => entry.utilization >= threshold
    );
    // Below all thresholds: the window reset - drop the record so the
    // next climb notifies again.
    if (crossed.length === 0) continue;
    const highest = Math.max(...crossed);
    const already = Number(notifiedMap[key]) || 0;
    if (enabled && highest > already) {
      const remaining = formatRemaining(entry.resetsAt, now);
      chrome.notifications.create(`usage-${key}-${highest}`, {
        type: "basic",
        iconUrl: "icons/icon128.png",
        title: chrome.i18n.getMessage("notifTitle"),
        message: chrome.i18n.getMessage("notifBody", [
          metricLabel(key),
          String(entry.utilization),
          remaining || chrome.i18n.getMessage("resetsSoon"),
        ]),
      });
    }
    // Math.max keeps the record sticky through small downward jitter
    // (e.g. 90% -> 89%) so a re-climb over 90 doesn't re-notify.
    next[key] = Math.max(already, highest);
  }
  return next;
};

/**
 * Single orchestrator: fetch, normalize, persist, badge, notify.
 * On failure the previous good snapshot is kept and only `error` is set,
 * so the popup can show stale data instead of nothing.
 *
 * Concurrent callers (popup open racing the alarm) share one in-flight
 * run: overlapping runs would both read the pre-update dedupe map and
 * double-notify. The guard is in-memory only, which is safe - a worker
 * restart mid-run just means the next trigger starts a fresh run.
 *
 * @param {"startup"|"alarm"|"manual"} trigger
 * @returns {Promise<object>} the stored snapshot
 */
let refreshInFlight = null;
const refreshUsage = (trigger) => {
  if (!refreshInFlight) {
    refreshInFlight = doRefreshUsage(trigger).finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
};

const doRefreshUsage = async (trigger) => {
  const stored = await chrome.storage.local.get({
    usageSnapshot: { fetchedAt: 0, ok: false, error: null, metrics: {} },
    notifiedThresholds: {},
    settings: DEFAULT_SETTINGS,
  });
  // Merge so settings added in future versions get their defaults.
  const settings = { ...DEFAULT_SETTINGS, ...stored.settings };
  const now = Date.now();

  /** Persist an error while preserving the last good metrics. */
  const fail = async (code) => {
    const snapshot = {
      ...stored.usageSnapshot,
      ok: false,
      error: { code, at: now },
    };
    await chrome.storage.local.set({ usageSnapshot: snapshot });
    await updateBadge(snapshot);
    return snapshot;
  };

  const orgId = await getOrgId();
  if (!orgId) return fail("signed_out");

  let result;
  try {
    result = await fetchFromWorker(orgId);
  } catch (_err) {
    result = null;
  }

  // 401/403 from the worker can mean auth failure OR anti-bot rejection
  // of the extension origin - a page-context fetch disambiguates.
  if (!result || (!result.ok && result.status >= 400)) {
    const viaTab = await fetchViaTab(orgId);
    if (viaTab) {
      result = viaTab;
    } else if (result && (result.status === 401 || result.status === 403)) {
      return fail("signed_out");
    } else if (result) {
      return fail("fetch_blocked");
    } else {
      return fail("network");
    }
  }

  if (!result.ok) {
    return fail(result.status === 401 || result.status === 403
      ? "signed_out"
      : "network");
  }

  const metrics = normalizeUsage(result.json);
  if (Object.keys(metrics).length === 0) return fail("bad_shape");

  const snapshot = { fetchedAt: now, ok: true, error: null, metrics };
  const notifiedThresholds = checkNotifications(
    metrics,
    stored.notifiedThresholds,
    now,
    settings.notificationsEnabled
  );

  // One write for snapshot + dedupe map keeps storage churn low.
  await chrome.storage.local.set({
    usageSnapshot: snapshot,
    notifiedThresholds,
  });
  await updateBadge(snapshot);
  console.debug(`[claude-usage] refreshed (${trigger})`);
  return snapshot;
};

/** Creating over an existing alarm of the same name is a safe no-op. */
const ensureAlarm = () => {
  chrome.alarms.create(REFRESH_ALARM, {
    periodInMinutes: REFRESH_PERIOD_MINUTES,
  });
};

const CHANGELOG_PATH = "changelog/changelog.html";

/** Open the What's New page; welcome mode adds the install greeting. */
const openChangelog = (welcome) => {
  const url = chrome.runtime.getURL(
    welcome ? `${CHANGELOG_PATH}?welcome=1` : CHANGELOG_PATH
  );
  chrome.tabs.create({ url });
};

chrome.runtime.onInstalled.addListener((details) => {
  // Drop history left behind by versions that had the trend chart.
  chrome.storage.local.remove("usageHistory");
  ensureAlarm();
  refreshUsage("startup");

  if (details.reason === "install") {
    openChangelog(true);
  } else if (
    details.reason === "update" &&
    details.previousVersion !== chrome.runtime.getManifest().version
  ) {
    // Skip unpacked-reload no-ops where the version hasn't changed.
    openChangelog(false);
  }
});

chrome.runtime.onStartup.addListener(() => {
  ensureAlarm();
  refreshUsage("startup");
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === REFRESH_ALARM) refreshUsage("alarm");
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message && message.type === "REFRESH_NOW") {
    refreshUsage("manual").then(sendResponse);
    return true; // keep the channel open for the async response
  }
  return false;
});
