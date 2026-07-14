const API = import.meta.env.VITE_API_BASE || 'https://n8n.mobrauntech.com/webhook'

async function request(method, path, body) {
  const opts = { method, headers: {} }
  if (body) {
    opts.headers['Content-Type'] = 'application/json'
    opts.body = JSON.stringify(body)
  }
  const res = await fetch(API + path, opts)
  if (!res.ok) throw new Error(`Server error ${res.status}`)
  const text = await res.text()
  if (!text) return null
  try { return JSON.parse(text) } catch { return text }
}

export const api = {
  listVideos: (account) =>
    request('GET', `/videos?account=${encodeURIComponent(account)}`),
  listChannels: (account) =>
    request('GET', `/channels?account=${encodeURIComponent(account)}`),
  saveVideo: (url, account) =>
    request('POST', '/save-video', { url, account_name: account }),
  addChannel: (channelUrl, account) =>
    request('POST', '/add-channel', { channelUrl, account_name: account }),
  deleteVideo: (videoId, account) =>
    request('DELETE', '/delete-video', { video_id: videoId, account_name: account }),
  deleteChannel: (channelId, account) =>
    request('DELETE', '/delete-channel', { channel_id: channelId, account_name: account }),
}

export function asArray(data) {
  if (Array.isArray(data)) return data
  if (data && typeof data === 'object' && Object.keys(data).length) return [data]
  return []
}

/* ---------- Queue ordering ----------
 * One rule everywhere: newest-added first, with watched videos pushed to
 * the back of the line. Shared by every list (Home, Channels, Shorts) so
 * the order is identical across pages and filters.
 */
export function sortQueue(list, watched) {
  const byAdded = (a, b) => new Date(b.added_at || 0) - new Date(a.added_at || 0)
  const fresh = [], seen = []
  for (const v of list) (watched.has(v.video_id) ? seen : fresh).push(v)
  fresh.sort(byAdded)
  seen.sort(byAdded)
  return [...fresh, ...seen]
}

/* ---------- Duration ---------- */
export function parseDuration(iso) {
  if (!iso) return { text: '', seconds: 0 }
  const m = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?$/.exec(iso)
  if (!m) return { text: '', seconds: 0 }
  const h = +(m[1] || 0), mi = +(m[2] || 0), s = Math.round(+(m[3] || 0))
  const seconds = h * 3600 + mi * 60 + s
  return { text: formatSeconds(seconds), seconds }
}

export function formatSeconds(total) {
  if (!isFinite(total) || total < 0) total = 0
  total = Math.floor(total)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const pad = (n) => String(n).padStart(2, '0')
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`
}

export const isShort = (v) => {
  const d = parseDuration(v.duration)
  return d.seconds > 0 && d.seconds <= 60
}

/* ---------- Relative time ---------- */
export function timeAgo(dateStr) {
  if (!dateStr) return ''
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000
  if (diff < 60) return 'just now'
  const units = [
    [31536000, 'year'], [2592000, 'month'], [604800, 'week'],
    [86400, 'day'], [3600, 'hour'], [60, 'minute'],
  ]
  for (const [secs, name] of units) {
    if (diff >= secs) {
      const n = Math.floor(diff / secs)
      return `${n} ${name}${n > 1 ? 's' : ''} ago`
    }
  }
  return 'just now'
}

/* ---------- Download via YTDLnis (com.deniscerri.ytdl) ---------- */
export function downloadVideo(url) {
  const isAndroid = /Android/i.test(navigator.userAgent)
  if (isAndroid) {
    // Fire an Android intent scoped to YTDLnis. Falls back to the share
    // sheet if the intent can't launch (app missing / non-Chrome browser).
    const intentUrl =
      `intent:${url.replace(/^https?:/, '')}` +
      `#Intent;scheme=https;package=com.deniscerri.ytdl;` +
      `S.browser_fallback_url=${encodeURIComponent(url)};end`
    try {
      window.location.href = intentUrl
      return 'intent'
    } catch { /* fall through */ }
  }
  if (navigator.share) {
    navigator.share({ url }).catch(() => {})
    return 'share'
  }
  navigator.clipboard?.writeText(url)
  return 'copied'
}
