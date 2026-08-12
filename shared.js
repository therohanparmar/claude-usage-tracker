/**
 * Claude Usage Tracker - shared.js
 *
 * Pure constants and helpers shared by the background service worker
 * (via importScripts) and the popup (via a plain <script> tag). Nothing
 * here may touch chrome.* APIs or the DOM so it runs in both contexts.
 */

"use strict";

/**
 * Usage metrics shown by the extension, in display order. `key` is the
 * API field, `msgKey` the i18n label. The weekly metric shows its reset
 * as an absolute day/time ("Mon 2:29 PM"); the short-lived session
 * window shows a countdown instead.
 *
 * Entries may be null/absent in the API response depending on the
 * user's plan tier - consumers must treat every metric as optional.
 *
 * @type {Array<{key: string, msgKey: string, weekly: boolean}>}
 */
const METRICS = [
  { key: "five_hour", msgKey: "metricFiveHour", weekly: false },
  { key: "seven_day", msgKey: "metricSevenDay", weekly: true },
];

/** Utilization thresholds shared by badge colors, bar colors, and alerts. */
const LEVEL_WARN_PCT = 75;
const LEVEL_CRITICAL_PCT = 90;

/**
 * Map a utilization percentage to a severity level.
 *
 * @param {number} pct 0–100
 * @returns {"ok"|"warn"|"critical"}
 */
const levelForUtilization = (pct) => {
  if (pct >= LEVEL_CRITICAL_PCT) return "critical";
  if (pct >= LEVEL_WARN_PCT) return "warn";
  return "ok";
};

/**
 * Format the time remaining until an ISO timestamp as "2h 15m" / "45m".
 * Returns null when the timestamp is missing/invalid, and "" when the
 * moment has already passed (callers show a localized "resets soon").
 *
 * @param {string|null|undefined} iso
 * @param {number} [now] epoch ms, defaults to Date.now()
 * @returns {string|null}
 */
/**
 * Format an ISO timestamp as an absolute "Mon 2:29 PM" in the user's
 * locale. Returns null when missing/invalid, "" when already passed
 * (callers show a localized "resets soon").
 *
 * @param {string|null|undefined} iso
 * @param {number} [now] epoch ms, defaults to Date.now()
 * @returns {string|null}
 */
const formatResetDay = (iso, now = Date.now()) => {
  if (!iso) return null;
  const target = Date.parse(iso);
  if (Number.isNaN(target)) return null;
  if (target - now <= 0) return "";
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  })
    .format(new Date(target))
    .replace(",", "");
};

const formatRemaining = (iso, now = Date.now()) => {
  if (!iso) return null;
  const target = Date.parse(iso);
  if (Number.isNaN(target)) return null;
  const ms = target - now;
  if (ms <= 0) return "";
  const totalMinutes = Math.ceil(ms / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
  if (hours > 0) return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  return `${minutes}m`;
};
