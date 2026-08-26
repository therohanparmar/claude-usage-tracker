/**
 * Claude Usage Tracker - popup.js
 *
 * Renders the stored usage snapshot as progress-bar cards plus a
 * freshness line. Data comes exclusively from chrome.storage.local
 * (written by the background worker); the Refresh button just asks the
 * worker to fetch again.
 *
 * Depends on shared.js (METRICS, levelForUtilization, formatRemaining)
 * loaded via a preceding <script> tag.
 */

"use strict";

/** Localize static text via an explicit element-id → message-key map. */
const localize = () => {
  document.documentElement.lang = chrome.i18n.getUILanguage();
  document.title = chrome.i18n.getMessage("extensionTitle");
  const textIds = {
    "popup-title": "extensionTitle",
    "version-label": "versionLabel",
    "refresh-btn": "refreshNow",
    "whats-new": "whatsNew",
    "usage-page-link": "openUsagePage",
    "contribute-link": "contributeGithub",
    "privacy-link": "privacyPolicy",
    "notify-label": "notifyToggleLabel",
  };
  for (const [id, messageName] of Object.entries(textIds)) {
    const el = document.getElementById(id);
    if (el) el.textContent = chrome.i18n.getMessage(messageName);
  }
  for (const { key, msgKey } of METRICS) {
    const label = document.querySelector(
      `.usage-card[data-metric="${key}"] .usage-card__label`
    );
    if (label) label.textContent = chrome.i18n.getMessage(msgKey);
  }
};

/** "Updated just now" / "Updated 3m ago" from an epoch timestamp. */
const formatUpdated = (fetchedAt) => {
  const minutes = Math.floor((Date.now() - fetchedAt) / 60000);
  if (minutes < 1) return chrome.i18n.getMessage("updatedJustNow");
  const text =
    minutes < 60 ? `${minutes}m` : `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
  return chrome.i18n.getMessage("updatedAgo", [text]);
};

const ERROR_MESSAGES = {
  signed_out: "errSignedOut",
  fetch_blocked: "errBlocked",
  network: "errNetwork",
  bad_shape: "errBadShape",
};

const renderStatus = (snapshot) => {
  const updated = document.getElementById("status-updated");
  const banner = document.getElementById("error-banner");
  if (updated) {
    updated.textContent = snapshot.fetchedAt ? formatUpdated(snapshot.fetchedAt) : "";
  }
  if (!banner) return;
  if (snapshot.error) {
    const msgKey = ERROR_MESSAGES[snapshot.error.code] || "errNetwork";
    // With stale data present, soften the hard error into a staleness note.
    const hasData = Object.keys(snapshot.metrics || {}).length > 0;
    banner.textContent =
      hasData && snapshot.error.code !== "signed_out"
        ? chrome.i18n.getMessage("staleData")
        : chrome.i18n.getMessage(msgKey);
    // The signed-out fix is one click away, so put the link in the banner.
    if (snapshot.error.code === "signed_out") {
      banner.appendChild(document.createTextNode(" "));
      const link = document.createElement("a");
      link.className = "banner__link";
      link.href = "https://claude.ai/";
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = chrome.i18n.getMessage("signInLink");
      banner.appendChild(link);
    }
    banner.hidden = false;
  } else {
    banner.hidden = true;
  }
};

/** Fill one card's percentage, bar, and reset line from a metric entry. */
const fillCard = (card, entry, weekly) => {
  const level = levelForUtilization(entry.utilization);
  const pct = card.querySelector(".usage-card__pct");
  const fill = card.querySelector(".usage-card__fill");
  const reset = card.querySelector(".usage-card__reset");
  if (pct) {
    pct.textContent = `${entry.utilization}%`;
    pct.dataset.level = level;
  }
  if (fill) {
    fill.style.width = `${entry.utilization}%`;
    fill.dataset.level = level;
  }
  if (reset) {
    // Weekly limits read better as an absolute time; the 5-hour
    // session as a countdown.
    const time = weekly
      ? formatResetDay(entry.resetsAt)
      : formatRemaining(entry.resetsAt);
    reset.textContent =
      time === null
        ? ""
        : time === ""
          ? chrome.i18n.getMessage("resetsSoon")
          : chrome.i18n.getMessage(weekly ? "resetsAt" : "resetsIn", [time]);
  }
};

const renderCards = (metrics) => {
  for (const { key, weekly } of METRICS) {
    const card = document.querySelector(`.usage-card[data-metric="${key}"]`);
    if (!card) continue;
    const entry = metrics[key];
    card.hidden = !entry;
    if (entry) fillCard(card, entry, weekly);
  }
};

const render = (snapshot) => {
  renderStatus(snapshot);
  renderCards(snapshot.metrics || {});
  const banner = document.getElementById("error-banner");
  if (
    banner &&
    !snapshot.fetchedAt &&
    !snapshot.error &&
    Object.keys(snapshot.metrics || {}).length === 0
  ) {
    banner.textContent = chrome.i18n.getMessage("noData");
    banner.hidden = false;
  }
};

const loadAndRender = () => {
  chrome.storage.local.get(
    { usageSnapshot: { fetchedAt: 0, ok: false, error: null, metrics: {} } },
    ({ usageSnapshot }) => render(usageSnapshot)
  );
};

/**
 * Wire the notification on/off switch: reflect the stored setting
 * (default on) and persist flips. The background worker reads the
 * setting on every refresh, so no message round-trip is needed.
 */
const initNotifyToggle = () => {
  const toggle = document.getElementById("notify-toggle");
  if (!toggle) return;
  chrome.storage.local.get(
    { settings: { notificationsEnabled: true } },
    ({ settings }) => {
      toggle.checked = settings.notificationsEnabled !== false;
    }
  );
  toggle.addEventListener("change", () => {
    chrome.storage.local.get(
      { settings: { notificationsEnabled: true } },
      ({ settings }) => {
        chrome.storage.local.set({
          settings: { ...settings, notificationsEnabled: toggle.checked },
        });
      }
    );
  });
};

const init = () => {
  localize();
  initNotifyToggle();

  const version = document.getElementById("version");
  if (version) version.textContent = chrome.runtime.getManifest().version;

  const refreshBtn = document.getElementById("refresh-btn");
  if (refreshBtn) {
    refreshBtn.addEventListener("click", () => {
      refreshBtn.disabled = true;
      chrome.runtime.sendMessage({ type: "REFRESH_NOW" }, () => {
        // Swallow "receiving end does not exist" - storage.onChanged
        // still repaints if the worker completed before responding.
        void chrome.runtime.lastError;
        refreshBtn.disabled = false;
        loadAndRender();
      });
    });
  }

  // Repaint live if a background refresh lands while the popup is open.
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.usageSnapshot) loadAndRender();
  });

  // Paint the cached snapshot immediately, then fetch fresh data in the
  // background so every popup open shows live numbers without a click.
  loadAndRender();
  chrome.runtime.sendMessage({ type: "REFRESH_NOW" }, () => {
    void chrome.runtime.lastError;
    loadAndRender();
  });
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init, { once: true });
} else {
  init();
}
