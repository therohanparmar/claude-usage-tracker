# Privacy Policy - Claude Usage Tracker

**Last updated: August 15, 2026**

Claude Usage Tracker is built to be private by design.

## What the extension does

It fetches your usage-limit percentages from claude.ai's usage API using
the browser session you are already signed in with, and shows them in the
extension popup, toolbar badge, and optional desktop notifications.

## Data collection

- **No analytics, no tracking, no external servers.** The only host the
  extension ever contacts is `claude.ai`.
- **No credentials are read or stored.** The extension reads exactly one
  cookie, `lastActiveOrg`, to learn which organization's usage to
  request. Its value is used only to build the request URL and is never
  logged, stored, or transmitted anywhere other than claude.ai itself.
  Your session cookies are attached to the request by the browser, not
  read by the extension.
- **Everything stays on your machine.** Usage percentages and reset
  times are stored in `chrome.storage.local` and never leave your
  browser. Uninstalling the extension deletes them.
- **No remote code.** The extension is plain, bundled JavaScript with no
  external scripts, fonts, or assets.

## Data shared with third parties

None.

## Contact

Questions or concerns: open an issue at
<https://github.com/therohanparmar/claude-usage-tracker/issues>.
