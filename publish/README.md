# Publish

Everything needed to ship Offshelf: the Chrome Web Store kit, the showreel, and the site.

## Site

`site/` is live at https://offshelf.zainzafar.net (Cloudflare Workers static assets, config in `wrangler.jsonc`). The privacy policy for the store listing is https://offshelf.zainzafar.net/privacy/.

- Deploy: `pnpm site:deploy`
- Preview locally: `pnpm site:preview`

## chrome-web-store/

| Path | What |
|---|---|
| `listing.md` | Every dashboard field, ready to paste: description, category, single purpose, permission justifications, remote-code and data-usage answers, reviewer steps |
| `privacy-policy.md` | Add your contact email, host it publicly, paste the URL in the dashboard |
| `assets.md`, `assets/` | Store icon, 5 screenshots (1280×800), small and marquee promo tiles |

Regenerate:

- **ZIP**: run `pnpm zip` on `main` and upload `.output/offshelf-<version>-chrome.zip`. Bump `version` in `wxt.config.ts` before every new upload.
- **Screenshots 1, 2, 4, 5**: see the header of `chrome-web-store/tools/store-screenshots.pw.ts`.
- **Screenshot 3 and promo tiles**: `node publish/reel/source/tools/shot.mjs "store/save.html" <out.png> 1280 800`, and `"store/promo.html?kind=small"` (440×280) or `"store/promo.html?kind=marquee&shot=file://<abs path to screenshot-1-library.png>"` (1400×560).
- **Store icon**: `ffmpeg -i public/icons/128.png -vf "scale=96:96:flags=lanczos,format=rgba,pad=128:128:16:16:color=0x00000000" store-icon-128.png`

## reel/

| Path | What |
|---|---|
| `offshelf-showreel.mp4` | 30s, 1080p60, with the original score |
| `site/assets/reel.mp4` | Lighter encode for sharing (also used on the site) |
| `source/` | The reel as a page: open `source/index.html` in Chrome to watch it live (`?t=14` jumps to a second) |

The library, reader and popup in the reel are the extension's own React components rendered with its built CSS, so they match the product exactly.

Regenerate:

1. UI snapshots (after UI changes): `pnpm build`, copy `ui/app.css` from `.output/chrome-mv3/assets/globals-*.css` (rewrite `url(/assets/` to `url(assets/`) with its `inter-latin`/`instrument-serif-latin` fonts into `source/ui/`, then `cp publish/reel/source/tools/reel-snapshots.tsx tests/zz-reel-snapshots.test.tsx && pnpm vitest run tests/zz-reel-snapshots.test.tsx && rm tests/zz-reel-snapshots.test.tsx && node publish/reel/source/tools/pack-snapshots.mjs`
2. Frames: `node publish/reel/source/render.mjs frames` (1800 JPEGs in `source/frames/`, git-ignored)
3. Music: `node publish/reel/source/audio.mjs` (writes `source/reel.wav`)
4. Encode:
   ```
   cd publish/reel/source
   ffmpeg -framerate 60 -i frames/f%04d.jpg -i reel.wav -c:v libx264 -preset slow -crf 16 -pix_fmt yuv420p -c:a aac -b:a 256k -shortest -movflags +faststart ../offshelf-showreel.mp4
   ```
