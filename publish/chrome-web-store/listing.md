# Chrome Web Store listing

Everything the developer dashboard asks for, in the order it asks. Copy each block as-is.

## Package

- Upload a fresh `.output/offshelf-<version>-chrome.zip` from `pnpm zip` on `main`.
- Each new upload must have a higher `version` in `wxt.config.ts` than the last one.

## Store listing tab

**Name** (from the manifest)

```
Offshelf — save it, read it
```

**Summary** (from the manifest, max 132 characters)

```
Save articles and X threads with images. Read offline. Export HTML, Markdown and print-ready PDF.
```

**Description**

```
Offshelf saves the things you want to keep: articles, X posts and threads, with their images. Everything is stored on your device, so you can read it later, even offline.

SAVE IN ONE CLICK
• Click the toolbar icon, press Alt+Shift+S, or right-click and choose Save page to Offshelf.
• Auto picks the right capture for the page. You can also choose Article, Thread, Selection or Area.
• X threads are saved in order: the author's own posts, avatars and quoted posts. Other people's replies are left out.
• Images are downloaded and kept with the text.

A CALM LIBRARY
• One clean grid for everything you saved, with search, Posts and Articles filters, tags, stars and an archive.
• See at a glance what's unread and how far you got.

A READER THAT GETS OUT OF THE WAY
• Serif or sans, text size, reading width, light or dark.
• An outline for long articles, reading progress and focus mode.
• Read threads as one continuous piece or as cards.

EXPORT WHENEVER YOU WANT
• HTML with images inside, a Markdown ZIP with an assets folder, or a print-ready PDF.
• Back up and restore your whole library as one file.

PRIVATE BY DESIGN
• No account, no cloud, no analytics, no tracking, no AI.
• Your library lives in your browser's storage on this device.
• Offshelf reads a page only when you ask it to save it. Image downloads contact only the original image hosts.

Save it. Read it. Keep it.
```

**Category**: Workflow & Planning (Tools also fits)

**Language**: English

**Graphic assets**: see `assets.md` (files in `assets/`).

## Privacy practices tab

**Single purpose**

```
Offshelf saves web pages the user chooses (articles, X posts and threads, or a selection) with their images into a library on the user's device, so they can read them later, offline, and export them.
```

**Permission justifications**

| Permission | Justification |
|---|---|
| activeTab | Used only when the user clicks the toolbar button, presses the save shortcut or picks the right-click menu item, to read the page they asked to save. |
| scripting | After that user action, injects the capture script bundled in the package into the current tab to extract the article or thread text and its image references. |
| storage | Keeps settings and a small change signal so open Offshelf pages refresh when a save finishes. Saved pages are kept in IndexedDB on the device. |
| unlimitedStorage | Saved pages keep their images for offline reading, so a library can outgrow the default storage quota. |
| contextMenus | Adds "Save page to Offshelf" and "Save selection to Offshelf" to the right-click menu. |
| alarms | A check once a minute recovers or cleans up a save that was interrupted when Chrome suspended the background service worker. |
| Host permissions (optional http/https) | Not granted at install. Requested for one image host at a time, only when the user clicks "Fix missing images" for images that host won't serve without permission. Users can revoke them in Settings → Permissions. |

**Remote code**: No, I am not using remote code. All JavaScript ships in the package and the extension CSP is `script-src 'self'`.

**Data usage**

- Leave every data type unchecked. Saved pages, settings and progress stay on the user's device and are never sent to the developer or anyone else.
- Certify all three statements: not sold to third parties, not used for purposes unrelated to the single purpose, not used for creditworthiness or lending.

**Privacy policy URL**: host `privacy-policy.md` somewhere public and paste the link.

## Distribution tab

- Payments: free
- Visibility: Public (or Unlisted for a quiet first release)
- Regions: all

## Test instructions for reviewers (optional)

```
1. Open any article page, for example a blog post.
2. Click the Offshelf toolbar icon, then Save this page.
3. Click Read it now to open the saved copy in the library.
For X: open a post on x.com while signed in and save it the same way. No account or login to Offshelf is needed.
```
