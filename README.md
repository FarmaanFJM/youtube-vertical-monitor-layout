# YouTube Vertical Monitor Layout

A small Manifest V3 browser extension that makes **YouTube comfortable on a portrait (vertical) monitor**. It does not recreate YouTube — it *reorganizes* the real YouTube page with CSS so the video can use the full width of your window, and everything else is arranged underneath it.

| Regular video | Livestream |
|---|---|
| native header | native header |
| **video, edge to edge** | **video, edge to edge** |
| title, channel, like/share/save, description | **native live chat** (fills the remaining height) |
| comments (left half) \| recommendations (right half) | title, channel, viewer count, description |
| | comments \| recommendations |

No custom buttons, search boxes, chat inputs, players, panels or settings are added. There is no toggle: the layout switches on by itself when the browser viewport is taller than it is wide and switches off again when it is not.

## Why portrait monitors need this

YouTube's desktop layout assumes a wide screen: a player capped to a centered column next to a 400px sidebar. Rotate the monitor and the player shrinks to a narrow strip, with large unused margins, a chat panel squeezed beside or below it, and recommendations that cannot fit. On a 1080 × 1920 viewport this extension gives a 16:9 video the full 1080px width (1080 × 607.5), and uses the remaining ~1300px of height for chat, comments and recommendations.

## Supported browsers

| Browser | Status |
|---|---|
| Google Chrome, Microsoft Edge, Brave, other Chromium (MV3) | Primary target. Automated tests run in Chromium. |
| Firefox 121+ | Packaged (`-firefox.zip` adds `browser_specific_settings`). The code uses only standard DOM/CSS APIs, but **it has not been tested in Firefox**. `:has()` (used to find the comments column) needs Firefox 121+. |
| Safari | Not supported / not tested. |

## What is supported

| Page | Behavior |
|---|---|
| **Watch (regular video)** | Header on top, player edge to edge, video info, then comments (left) and recommendations (right), each ~50% of the width. |
| **Watch (livestream / premiere / chat replay)** | Player edge to edge, native chat directly under it taking the remaining viewport height (minimum 480px, scrolls on its own), then info and the rest. |
| **Playlist playback** | The native playlist panel sits under the player at full width; the player stays full width. |
| **Home, Subscriptions, channel pages** | YouTube's own grid at 2 columns (1 column below 600px). Mini-guide column removed; guide opens as an overlay. |
| **Search results** | 2 columns of cards, thumbnail above text (1 column below 600px); shelves, channels and playlists span the row. |
| **Playlist pages, History** | Info sidebar stacks above the video list; no reserved side column. |
| **Shorts** | Left native. Shorts are already vertical; the extension only removes the reserved guide width and never forces a 16:9 box. |
| Other pages (settings, premium, …) | Only the guide-overlay rule applies. |

## Normal browsing vs. browser fullscreen vs. YouTube fullscreen

* **Normal browsing** — YouTube's header stays at the top (hamburger, logo, search, create, notifications, avatar), the player sits directly under it at the full viewport width, and everything else is below.
* **Browser fullscreen (F11)** — the extension looks only at the viewport size, so F11 on a vertical monitor keeps the same layout with more room. The native header is unchanged; there is no custom "hide header" control.
* **YouTube's native fullscreen button** — every watch-page rule is disabled while `ytd-watch-flexy` has YouTube's own `fullscreen` attribute, so the video fullscreens exactly as it does without the extension, uncropped and at its own aspect ratio. The portrait page is never turned into an enlarged fullscreen layout.

## Automatic portrait activation

A tiny content script sets `ytvm-portrait` on `<html>` when `viewport height > viewport width` (the real browser viewport, not the monitor's orientation — a portrait-shaped window on a landscape monitor qualifies; a landscape window on a portrait monitor does not). **Every** CSS rule in the extension starts with `html.ytvm-portrait`, so when the window returns to landscape the class is removed and YouTube's own desktop layout comes back with nothing left over. The video is not reloaded, seeked or paused, and the chat iframe keeps its session. Browser zoom works the same way: zooming changes the viewport in CSS pixels, which is what the check uses.

## Install (unpacked)

### Chrome / Edge / Brave

1. Clone or download this repository: `git clone https://github.com/FarmaanFJM/youtube-vertical-monitor-layout`
2. Open `chrome://extensions` (Edge: `edge://extensions`) and turn on **Developer mode**.
3. Click **Load unpacked** and select the repository folder (the one containing `manifest.json`).
4. Open YouTube in a portrait-shaped window (or rotate the monitor).

### Firefox (temporary add-on)

1. Run `npm install && npm run package`.
2. Open `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on…** and pick `dist/…-firefox.zip` (or the `manifest.json` of an unzipped copy). Temporary add-ons are removed when Firefox restarts; permanent installation requires signing through AMO.

### From a release

Tagged releases (`v*`) publish `…-chromium.zip` and `…-firefox.zip` built by CI. Unzip the Chromium archive and use **Load unpacked** on the folder.

## Develop and test

```bash
npm install
npx playwright install chromium   # once; not needed if Playwright's Chromium is already present

npm run lint        # ESLint
npm run validate    # manifest + invariants (see below)
npm run test:unit   # node:test, pure logic + content-script wiring (no browser)
npm run test:e2e    # Playwright: real Chromium + the real unpacked extension vs. a fixture page
npm run test:live   # smoke tests against real youtube.com (not run in CI)
npm test            # lint + validate + unit + e2e
npm run package     # dist/*.zip, byte-reproducible
```

### Layout of the repository

```
manifest.json
src/content/   portrait.js (viewport detection) · pages.js (URL → page kind)
               navigation.js (YouTube SPA events) · index.js (wires them up)
src/styles/    base.css · watch.css · live.css · browse.css
tests/unit/    pure-logic tests
tests/e2e/     Playwright against tests/fixtures/youtube.html
tests/live/    smoke tests against real YouTube
scripts/       validate.mjs · package.mjs
```

### Three kinds of tests, and what each proves

1. **Unit tests** — portrait detection, URL classification, event wiring, idempotent start / full cleanup.
2. **Fixture browser tests** (`tests/e2e`, run in CI) — a real Chromium loads the real unpacked extension, and `tests/fixtures/youtube.html` stands in for YouTube. The fixture is *not* a copy of YouTube: it reproduces the ids, wrappers, attributes, native width/min/max rules and SPA navigation events that the extension depends on, taken from inspecting real pages, so that results are deterministic. It proves the CSS does what it claims against that structure; it cannot prove YouTube's current DOM still matches. Includes a no-extension control that must fail the edge-to-edge assertion.
3. **Live smoke tests** (`tests/live`, manual: `npm run test:live` or the manual CI input) — the same checks on the real site, logged out. They depend on the network and on YouTube not showing an anti-bot page to automated browsers; if it does, the test is **skipped with a reason**, never reported as passed, and nothing tries to get around it.

`npm run validate` also enforces design rules statically: no permissions, a single `https://www.youtube.com/*` match, every CSS selector gated on `html.ytvm-portrait`, no z-index above 10, no network calls, no `createElement`/`innerHTML`/DOM insertion, no `MutationObserver`/`setInterval`.

## How native components are kept intact

* **CSS-only relocation.** Nothing is cloned, re-parented or recreated. On the watch page YouTube's wrappers (`#primary`, `#primary-inner`, `#below`, `#secondary`, `#secondary-inner`) are set to `display: contents`, which makes the *mounted* player, metadata, chat, comments and recommendations direct children of the `#columns` grid. They are then placed with `grid-column`/`order`. The `<video>`, the chat `<iframe>`, and all of Polymer's internal state never move, so playback and the chat session survive layout changes.
* **The player's height is still YouTube's.** YouTube sizes the player with `padding-top: height-ratio / width-ratio × 100%`. The extension only removes the width limits (`max-width`, `min-width`, side margins), so the height always follows the video's own aspect ratio. No cropping, stretching or forced 50%-height.
* **No observers or polling.** The only dynamic state is two kinds of class on `<html>`: portrait/landscape (resize events coalesced to one check per frame) and the page family (from the URL on YouTube's `yt-navigate-*` events and `popstate`). Late-loading comments, recommendations and chat need no JavaScript at all because CSS applies to them whenever they appear. After the orientation flips, one synthetic `resize` event is dispatched so YouTube's own responsive code re-measures; it does not touch the video.
* **Overlays are not clipped.** No `overflow: hidden` is added to containers; the guide (hamburger) is YouTube's own overlay and no longer reserves width.
* **Native fullscreen** is excluded by `:not([fullscreen])` on all watch-page rules.
* **`!important` is used on structural properties only** (display, widths, margins) because YouTube sets them with long attribute selectors that vary between experiments.

## YouTube DOM assumptions (maintenance checklist)

When YouTube changes its UI, these are the things to re-check first. Source: `src/styles/*.css`.

| Assumption | Used for |
|---|---|
| `ytd-watch-flexy` with `#columns`, `#primary`, `#primary-inner`, `#below`, `#secondary`, `#secondary-inner` | watch grid |
| `#player`, `#player-container-outer`, `#player-container-inner` with the padding-top ratio rule; `--ytd-watch-flexy-width-ratio` / `-height-ratio` custom properties | edge-to-edge player, chat height |
| `#below > .box` (two of them); the comments one is found with `:has(#comments)` | comments column |
| `#related`, `#playlist`, `#panels`, `#chat-container`, `#donation-shelf` | placement of recommendations, playlist, panels, chat |
| `ytd-live-chat-frame` (+ `[collapsed]`) containing `iframe#chatframe` | chat height |
| `ytd-watch-flexy[fullscreen]`, `[theater]`, `#full-bleed-container`, `#player-full-bleed-container` | fullscreen exclusion, theater |
| `--ytd-watch-compact-thumbnail-width` | recommendation thumbnail size |
| `ytd-rich-grid-renderer` and its `--ytd-rich-grid-*` properties | home / subscriptions / channel grid |
| `ytd-search #container`, `ytd-item-section-renderer > #contents > ytd-video-renderer #dismissible`, `ytd-thumbnail` | search layout |
| `ytd-two-column-browse-results-renderer` with `#primary`/`#secondary`; `ytd-playlist-sidebar-renderer` | playlist, history |
| `ytd-page-manager`, `ytd-mini-guide-renderer`, `ytd-app[guide-persistent-and-visible]` | guide overlay |
| `yt-navigate-start`, `yt-navigate-finish`, `yt-page-data-updated`, `yt-page-type-changed` events | page-kind updates |

If an expected element is absent, the corresponding rules simply match nothing and YouTube's own layout shows through; the worst case of a YouTube change is a page that looks like stock YouTube or a cosmetic issue, not a broken page.

## Privacy and permissions

* **Permissions requested: none.** The manifest has no `permissions` and no `host_permissions`; the only declaration is a content script on `https://www.youtube.com/*` (excluding embeds and the chat iframe documents).
* The extension makes **no network requests**, has no background page, loads **no remote code or assets**, has no analytics or telemetry, and never reads, stores or transmits comments, chat messages, history or account data. It does not read page content at all: JavaScript only looks at the viewport size and the URL path. `npm run validate` enforces these properties on every CI run.

## Known limitations

* **Authenticated behavior is untested.** All tests ran logged out. Logged-in variations (comment posting, chat input, subscription feed contents, notifications contents, Studio, moderation tools) rely on being native elements that are only repositioned, but this has not been exercised on a signed-in session.
* **Live-site coverage is partial** — see the verification table below. Anything marked "fixture only" matches YouTube's DOM as inspected, but was not confirmed on the live site.
* **Vertical (non-Shorts) videos and unusual aspect ratios:** the player keeps YouTube's own ratio logic. A 9:16 video on `/watch` gets a very tall player; its handling is YouTube's, not changed here, and is untested.
* **Videos with black bars baked in** keep them; the extension never crops.
* **Firefox** is packaged but untested.
* Engagement panels (transcript, chapters) stay full-width rows under the video info rather than a side panel.
* The 2-column search and home layouts, and the playlist/history stacking, are best-effort overrides of YouTube's internal CSS custom properties, which YouTube can rename at any time.
* Mobile (`m.youtube.com`), YouTube Music, YouTube Kids, embeds and the standalone chat popout are out of scope.
* Browser zoom was verified by equivalence (the viewports below in CSS pixels), not by driving the zoom UI.

## Verification status

See the final section of the delivery notes in the repository's release/PR description for the exact counts of the most recent run; CI runs everything except the live tests on every push.

## License

MIT
