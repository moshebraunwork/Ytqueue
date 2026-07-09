# YT Queue — Frontend

React (Vite) frontend for the n8n YT Queue backend at `n8n.mobrauntech.com/webhook`.

## Setup

```bash
npm install
cp .env.example .env   # then set your real PIN
npm run dev            # local dev on :5173
npm run build          # production build → dist/
```

`.env`:
```
VITE_APP_PIN=1234                                  # 4-digit lock PIN (both accounts)
VITE_API_BASE=https://n8n.mobrauntech.com/webhook  # backend base URL
```

Note: the PIN is baked into the JS bundle at build time (client-side check). Fine as a household gate; it is not a security boundary — same trust model as the webhooks themselves.

## Deploy (nginx, your usual pattern)

```bash
npm run build
sudo cp -r dist/* /var/www/ytq/
```

```nginx
server {
    server_name ytq.mobrauntech.com;
    root /var/www/ytq;
    index index.html;
    location / { try_files $uri /index.html; }
}
```

Then `certbot --nginx -d ytq.mobrauntech.com` and the usual iptables 80/443 check after any VM reboot.

## Required n8n change — CORS

The frontend runs on a different origin than n8n, so on **each of the 6 Webhook trigger nodes**:
Options → **Allowed Origins (CORS)** → `https://ytq.mobrauntech.com` (or `*` while testing).
n8n then answers preflights itself; no Respond-node changes needed.

## Feature notes

- **PIN lock**: unlock is remembered per device for 7 days (`localStorage`). "Lock this device" in the account menu clears it immediately.
- **Accounts**: last-used account is remembered per device; avatar → dropdown to switch or lock.
- **Watched / NEW / resume**: tracked client-side per account per device (backend has no `watched` column yet). A video is auto-marked watched at the 50% point; you can toggle manually from the card menu. NEW = added since your last visit. Playback position is saved and resumed.
- **Home**: All / Videos / Shorts tabs + Everything / New / Unwatched / Watched filters. Shorts render in a vertical-card grid.
- **Channels**: list with per-channel queue counts → tap in for that channel's videos + stop watching.
- **Player**: custom controls on the YouTube IFrame API — play/pause, double-tap ±10s, prev/next, autoplay-next, speed, fullscreen (locks landscape on mobile), keyboard shortcuts on desktop (space/k, arrows, f, m).
  - **Right-side vertical swipe** = volume (real player volume via the API).
  - **Left-side vertical swipe** = brightness (dimming overlay — web pages can't change hardware brightness).
- **Download**: fires an Android intent targeted at YTDLnis (`com.deniscerri.ytdl`). If the intent can't launch (non-Chrome browser / app missing) it falls back to opening the link, and on desktop to the share sheet or copying the URL.

## Known constraints

- YouTube embeds require a valid referrer → test over `https://`, not `file://` (error 153 otherwise).
- Videos with embedding disabled by the uploader won't play in the custom player — use the YouTube button on those.
- Watched state lives on the device, so your phone and PC each track separately. Say the word and we add a `watched` column + toggle endpoint in n8n to sync it.
