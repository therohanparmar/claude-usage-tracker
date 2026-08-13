<p align="center">
  <img src="icons/icon128.png" width="96" height="96" alt="Claude Usage Tracker icon" />
</p>

<h1 align="center">Claude Usage Tracker</h1>

<p align="center">Your Claude usage limits, always one click away - live in your browser toolbar.</p>

<!-- TODO: replace # with the real store listing URLs after publishing. -->
<p align="center">
  <a href="https://chromewebstore.google.com/detail/fmjhglncijcinacolmmaepghmgcloljf" title="Chrome Web Store">
    <img src="https://raw.githubusercontent.com/alrra/browser-logos/90fdf03c/src/chrome/chrome.svg" width="56" alt="Add to Chrome" valign="middle" />
  </a>
  &nbsp;&nbsp;&nbsp;&nbsp;
  <a href="https://chromewebstore.google.com/detail/fmjhglncijcinacolmmaepghmgcloljf" title="Brave Web Store">
    <img src="https://raw.githubusercontent.com/alrra/browser-logos/90fdf03c/src/brave/brave.svg" width="56" alt="Add to Brave" valign="middle" />
  </a>
    &nbsp;&nbsp;&nbsp;&nbsp;
  <a href="https://addons.mozilla.org/en-US/firefox/addon/read-on-freedium/" title="Mozilla Add-ons">
    <img src="https://raw.githubusercontent.com/alrra/browser-logos/90fdf03c/src/firefox/firefox.svg" width="56" alt="Add to Firefox" valign="middle" />
  </a>
  &nbsp;&nbsp;&nbsp;&nbsp;
  <a href="https://chromewebstore.google.com/detail/fmjhglncijcinacolmmaepghmgcloljf" title="Microsoft Edge Add-ons">
    <img src="https://raw.githubusercontent.com/alrra/browser-logos/90fdf03c/src/edge/edge.svg" width="56" alt="Add to Edge" valign="middle" />
  </a>
  &nbsp;&nbsp;&nbsp;&nbsp;
  <a href="https://chromewebstore.google.com/detail/fmjhglncijcinacolmmaepghmgcloljf" title="Opera Add-ons">
    <img src="https://raw.githubusercontent.com/alrra/browser-logos/90fdf03c/src/opera/opera.svg" width="56" alt="Add to Opera" valign="middle" />
  </a>
  &nbsp;&nbsp;&nbsp;&nbsp;
  <a href="https://chromewebstore.google.com/detail/fmjhglncijcinacolmmaepghmgcloljf" title="Vivaldi Add-ons">
    <img src="https://raw.githubusercontent.com/alrra/browser-logos/90fdf03c/src/vivaldi/vivaldi.svg" width="56" alt="Add to Vivaldi" valign="middle" />
  </a>
</p>

## What is this?

Tired of opening [claude.ai/settings/usage](https://claude.ai/settings/usage)
to check how close you are to a limit? **Claude Usage Tracker** puts that
data in your browser toolbar: a badge with your current session usage, a
popup with progress bars and reset times, and desktop alerts before you hit
a wall.

It reads the usage data through the claude.ai session you are already
signed in with. No API keys. No accounts. No tracking.

## How to use

1. Install the extension using a button above.
2. Sign in to [claude.ai](https://claude.ai) in the same browser profile.
3. Watch the badge, or click the icon for the breakdown - current session
   and weekly all-models usage, each with its reset time.

That's it - data refreshes automatically every 5 minutes, and the popup
fetches fresh numbers every time you open it.

## Features

- 📊 **Limits at a glance** - your current 5-hour session and weekly
  all-models usage, matching the claude.ai usage page.
- 🔢 **Live toolbar badge** - your session percentage, colored green,
  amber, or red as you approach the limit.
- 🔄 **Auto-refresh** - background updates every 5 minutes, plus a fresh
  fetch on every popup open.
- 🔔 **Smart alerts** - desktop notifications at 70%, 80%, 90%, and 95%,
  each sent exactly once per reset window.
- ⏳ **Reset times** - a countdown for the session ("Resets in 2h 15m")
  and an absolute time for the week ("Resets Mon 2:29 PM").
- 🌗 **Dark mode** - matches your browser's light/dark theme automatically.
- 🦊 **Cross-browser** - works on Chrome, Brave, Edge, and Firefox from
  one codebase.
- 🔒 **Private & lightweight** - everything stays on your machine; the
  only site contacted is claude.ai.

## Permissions

| Permission | Why it's needed |
| --- | --- |
| `storage` | Keep the latest snapshot and notification state locally. Nothing leaves your machine. |
| `alarms` | Wake the background worker every 5 minutes to refresh. |
| `cookies` | Read a single claude.ai cookie (`lastActiveOrg`) to learn which organization's usage to fetch. No other cookies are read. |
| `notifications` | Show the 70% / 80% / 90% / 95% desktop alerts. |
| Host access to `claude.ai` | Send your existing session with the usage request. This is the only site the extension talks to. |

## Privacy

No data is collected or transmitted anywhere except claude.ai itself. Read
the full [privacy policy](PRIVACY.md).

---

## Contributing

Want to run it locally or contribute? See **[CONTRIBUTING.md](CONTRIBUTING.md)**
for developer setup, how it works, and the project structure.

## License

[MIT](LICENSE) - free to use, modify, and distribute.

## Author

**Rohan Parmar** - [LinkedIn](https://www.linkedin.com/in/rohanrparmar) · [X / Twitter](https://x.com/rohan__parmar)

---

## Disclaimer

This is an independent tool and is not affiliated with, endorsed by, or
sponsored by Anthropic. "Claude" and "Claude Code" are trademarks of
Anthropic, PBC. The extension reads an internal claude.ai endpoint that
Anthropic may change at any time; if data stops loading, check for an
update or open an issue.

<p align="center"><sub><strong>Claude Usage Tracker</strong> · v1.0.0 · by <a href="https://www.linkedin.com/in/rohanrparmar">Rohan Parmar</a></sub></p>
