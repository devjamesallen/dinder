# GrubSwipe Web — grubswipe.com

Marketing landing page and future web app for GrubSwipe.

## Quick Start

```bash
cd web
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the site.

## Build & Deploy

```bash
npm run build    # outputs static files to /out
```

### Vercel (recommended)

1. Push the `web/` directory to a GitHub repo (or use a monorepo)
2. Import in [vercel.com](https://vercel.com) → set root directory to `web/`
3. Add custom domain `grubswipe.com` in project settings
4. Vercel auto-provisions HTTPS via Let's Encrypt

### NIPR / Government Network Compatibility

This site is built with NIPR access in mind:

- **Zero external requests** — no Google Fonts, no CDN scripts, no third-party analytics. All assets are bundled into the static build.
- **System font stack** — uses the OS default fonts, so nothing needs to download.
- **Static export** — the `next.config.mjs` uses `output: 'export'`, producing plain HTML/CSS/JS files that can be hosted anywhere (S3, Apache, IIS, etc.).
- **HTTPS** — Vercel handles this automatically. If self-hosting, use certbot/Let's Encrypt.

**IMPORTANT: Domain Categorization**

Newly registered domains are often blocked on NIPR because they're "uncategorized" by web content filters. Submit grubswipe.com for categorization ASAP:

1. **Blue Coat / Symantec** — https://sitereview.bluecoat.com/ → submit as "Computers/Internet"
2. **Palo Alto Networks** — https://urlfiltering.paloaltonetworks.com/ → submit for review
3. **Forcepoint / Websense** — https://csi.forcepoint.com/ → suggest category
4. **McAfee / Trellix** — https://trustedsource.org/ → check and submit
5. **Zscaler** — https://sitereview.zscaler.com/ → submit for review

It can take 24-72 hours for categorization to propagate. The sooner you submit, the sooner NIPR users can access it.

## Architecture

- **Next.js 15** with App Router
- **Tailwind CSS 4** (compiled at build time, not CDN)
- **Static export** — no server required
- All logos/assets served from `/public/`

## Phase 2 (Future)

The web app will add authenticated routes under `/app/` that replicate the mobile swiping experience. Firebase JS SDK is already web-compatible.

## Tech Stack Decisions

| Decision | Choice | Why |
|----------|--------|-----|
| Framework | Next.js | SSG for landing, App Router for future web app |
| Styling | Tailwind CSS | Compiled to static CSS, no runtime or CDN |
| Fonts | System stack | Zero network requests, NIPR-safe |
| Icons | Inline SVG | No icon font CDN (Font Awesome, etc.) |
| Hosting | Vercel | Free tier, auto-HTTPS, instant deploys |
| Export | Static | Can be hosted literally anywhere if Vercel isn't an option |
