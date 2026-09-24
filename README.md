# Cast Test Sender

A static web app for testing Chromecast / Google Cast playback. It can cast MP4, HLS, DASH, audio or image URLs, test custom receiver app IDs, WebVTT subtitles, queues and live streams, and send custom namespace messages. There is no build step and no backend.

## Project structure

```
.
├── index.html            # Page markup, SEO meta tags, JSON-LD structured data
├── 404.html              # Not-found page (noindex)
├── robots.txt            # Crawl rules + sitemap location
├── sitemap.xml           # Sitemap for Google / Bing
├── site.webmanifest      # PWA manifest (installable, app icons)
├── _headers              # Security & cache headers (Netlify / Cloudflare Pages)
├── favicon.svg           # Logo / favicon (source of all PNG icons)
├── favicon-48.png        # Generated: favicon for Google Search results
├── apple-touch-icon.png  # Generated: iOS home-screen icon
├── og-image.png          # Generated: social / link-preview image (1200×630)
├── assets/
│   ├── css/styles.css    # All styles (light + dark theme tokens)
│   ├── img/              # Generated PWA icons (192, 512)
│   └── js/
│       ├── main.js       # Entry point: wires everything, renders UI state
│       ├── cast.js       # Google Cast Web Sender SDK wrapper (session, load, queue, controls)
│       ├── media.js      # Samples grid, custom form, recent history, share links, preview
│       ├── ui.js         # Event log, toasts, theme, tabs, environment checklist
│       ├── config.js     # Sample media list and constants
│       └── utils.js      # Small shared helpers
├── src/images/og-image.svg  # Source for og-image.png
└── scripts/build-images.sh  # Regenerates all PNGs from the SVG sources
```

## Run locally

The Cast SDK only works on `https://` or `http://localhost`:

```bash
python3 -m http.server 8000
# open http://localhost:8000 in Chrome
```

Your computer and Cast device must be on the same Wi-Fi network.

## Domain

The site is configured for GitHub Pages at **https://devr77.github.io/chromecast-online/**, which is used for the canonical URL, Open Graph / Twitter tags, JSON-LD and `sitemap.xml`. All asset paths are relative, so the site works under a subpath or on its own domain.

**Recommended: a custom domain** (e.g. `casttest.dev`). Google only reads `robots.txt` at the root of a domain, and a dedicated domain is easier to rank and remember. To switch:

```bash
grep -rl 'devr77.github.io/chromecast-online/' --include='*.html' --include='*.xml' --include='*.txt' . \
  | xargs sed -i '' 's#https://devr77.github.io/chromecast-online/#https://casttest.dev/#g'   # Linux: sed -i
echo casttest.dev > CNAME
```

Then point the DNS at GitHub Pages (Settings → Pages → Custom domain) and turn on "Enforce HTTPS". When the page content changes, also update `<lastmod>` in `sitemap.xml`.

## Deploy

The site is plain static files, so upload the folder to any static host. It must be served over HTTPS.

| Host | How |
| --- | --- |
| **Cloudflare Pages** | Connect the repo, or `npx wrangler pages deploy .`. Build command: none. Output dir: `/`. `_headers` is applied automatically. |
| **Netlify** | Drag the folder into app.netlify.com/drop, or connect the repo. `_headers` is applied automatically. |
| **GitHub Pages** | Push to a repo → Settings → Pages → deploy from branch root. `404.html` works; `_headers` is ignored. |
| **Vercel** | `npx vercel --prod` (framework: Other). Move the headers into `vercel.json` if you want them. |

## Get it on Google Search

1. **Deploy** on your final domain with HTTPS.
2. **Google Search Console** → <https://search.google.com/search-console> → *Add property*. On github.io, choose **URL prefix** with `https://devr77.github.io/chromecast-online/` and verify with the HTML-tag method (paste the `<meta name="google-site-verification">` tag into `<head>` of `index.html` and push). With a custom domain, use a **Domain** property and DNS verification.
3. **Submit the sitemap**: *Sitemaps* → enter the full sitemap URL (e.g. `https://devr77.github.io/chromecast-online/sitemap.xml`) → Submit.
4. **Request indexing**: paste your homepage URL into *URL Inspection* → *Request indexing*.
5. **Validate structured data**: <https://search.google.com/test/rich-results> (WebApplication + FAQ).
6. **Bing / DuckDuckGo / Yahoo**: <https://www.bing.com/webmasters> → *Import from Google Search Console*.
7. **Check social previews**: <https://www.opengraph.xyz> or the LinkedIn Post Inspector.

Indexing usually takes a few days to a couple of weeks. Links from relevant places help rankings the most: your GitHub README, dev.to / Medium posts, Stack Overflow answers about Chromecast testing, and Reddit communities such as r/Chromecast and r/androiddev.

## What's included for SEO

- A descriptive `<title>` and meta description targeting "Chromecast test", "Google Cast test sender", "cast video URL", "test Cast receiver"
- Canonical URL, robots meta, Open Graph + Twitter cards with a 1200×630 image
- JSON-LD `WebSite`, `WebApplication` and `FAQPage`, with FAQ text that matches the visible FAQ exactly
- Crawlable content: how-to steps, features, a formats table, a troubleshooting table and the FAQ
- Semantic HTML (one `<h1>`, ordered headings, landmarks, labelled controls, skip link)
- Fast: no framework, system fonts, lazy images, async SDK, deferred ES modules
- Mobile-friendly responsive layout, light/dark theme, installable PWA manifest
- `robots.txt`, `sitemap.xml`, a `noindex` 404 page, favicons at Google-friendly sizes

## Updating images

Edit `favicon.svg` or `src/images/og-image.svg`, then run:

```bash
./scripts/build-images.sh   # needs rsvg-convert (brew install librsvg)
```

## Notes

- Google's old sample bucket (`gtv-videos-bucket`) now returns 403, so the samples use public CORS-enabled test streams from W3C, Mux, Shaka, Akamai, MDN, Video.js and SoundHelix. Edit them in `assets/js/config.js`.
- Not affiliated with Google. Chromecast, Google Cast and Google TV are trademarks of Google LLC.
