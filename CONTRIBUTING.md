# Contributing

Thanks for your interest in improving **Claude Usage Tracker**! This is a tiny,
zero-dependency Chrome/Firefox extension (plain HTML/CSS/JS, Manifest V3) - no
build step required.

**One codebase, two manifests.** Chrome runs the background as a service
worker; Firefox runs it as an event page. `manifest.json` targets Chromium
browsers, and `manifest.firefox.json` is the identical Firefox variant - only
the `background` section differs. `background.js` itself is shared and detects
which environment it is in.

First, clone the repository:

```bash
git clone https://github.com/therohanparmar/claude-usage-tracker.git
```

### Chrome / Edge / Brave (Chromium)

1. Open `chrome://extensions`.
2. Turn on **Developer mode** (top-right).
3. Click **Load unpacked** and select the project folder (the one with `manifest.json`).
4. Sign in to claude.ai in the same profile - the badge fills in within seconds.

> After editing a source file, click the **↻ reload** icon on the extension
> card, then reopen the popup to see the change.

### Firefox

1. Swap in the Firefox manifest: `cp manifest.firefox.json manifest.json`
   (remember not to commit that swap).
2. Open `about:debugging#/runtime/this-firefox`.
3. Click **Load Temporary Add-on…** and select `manifest.json`.
4. If no data loads, open `about:addons` → Claude Usage Tracker →
   **Permissions** and allow access for claude.ai - Firefox treats host
   access as opt-in.

> Temporary add-ons are removed on restart. For a permanent install, publish
> to [AMO](https://addons.mozilla.org/developers/) (free, no developer fee).

## Project structure

```
claude-usage-tracker/
├── manifest.json          # Manifest V3 configuration (Chromium)
├── manifest.firefox.json  # Firefox variant (event-page background)
├── shared.js              # METRICS table + pure helpers (both contexts)
├── background.js          # Alarm, fetch, normalize, store, badge, alerts
├── content.js             # Fallback fetcher on claude.ai tabs (inert otherwise)
├── popup/                 # popup.html / popup.css / popup.js
├── changelog/             # "What's New" page, opens on install/update
├── icons/                 # icon16 / icon48 / icon128
├── _locales/en/           # i18n strings
├── PRIVACY.md             # Privacy policy
├── LICENSE
├── README.md
└── CONTRIBUTING.md
```

## How it works

| Concern | Approach |
| --- | --- |
| Data source | `GET https://claude.ai/api/organizations/{orgId}/usage` - the same internal JSON endpoint the claude.ai usage page uses. The browser attaches the user's existing session cookies; the extension never reads them. |
| Org discovery | The `lastActiveOrg` cookie on claude.ai holds the organization id. It is the only cookie read, used solely to build the request URL. |
| Refresh cycle | A `chrome.alarms` alarm fires every 5 minutes; the popup also triggers a fetch on open and via its Refresh button. All three paths run the same `refreshUsage()`. |
| Resilience | Known metric keys are whitelisted and clamped; on a failed refresh the last good snapshot is kept and marked stale instead of wiped. A content-script fallback fetches from page context if the worker request is blocked. |
| Notifications | Thresholds (70/80/90/95%) are deduped per reset window via a `metric\|resets_at` key stored in `chrome.storage.local`, so alerts fire exactly once and survive worker restarts. |
| Worker lifetime | No in-memory state - snapshot and notification records live in `chrome.storage.local`; `onStartup`/`onInstalled` re-create the alarm. |
| Security | No `innerHTML`, no remote code, no external assets - built with DOM APIs only. |

## Guidelines

- Keep it **dependency-free** - no frameworks or build tooling.
- Match the existing code style; keep comments minimal and meaningful.
- Test changes in **both light and dark mode**, signed in and signed out.
- Remember the usage endpoint is **internal and unversioned** - code
  defensively around its shape.

## Submitting changes

1. Fork the repo and create a feature branch.
2. Make your change and test it locally as above.
3. Open a pull request describing what changed and why.

Issues and feature requests are welcome too - open one any time.
