const WEEK_MS = 7 * 24 * 60 * 60 * 1000

function get(key) {
  try { return localStorage.getItem(key) } catch { return null }
}
function set(key, value) {
  try { localStorage.setItem(key, value) } catch { /* private mode */ }
}
function remove(key) {
  try { localStorage.removeItem(key) } catch { /* noop */ }
}

/* ---------- PIN lock (device remembered for 7 days) ---------- */
export function isUnlocked() {
  const ts = Number(get('ytq_unlock_ts') || 0)
  return ts > 0 && Date.now() - ts < WEEK_MS
}
export function markUnlocked() {
  set('ytq_unlock_ts', String(Date.now()))
}
export function lockDevice() {
  remove('ytq_unlock_ts')
}

/* ---------- Last used account ---------- */
export function getLastAccount() {
  return get('ytq_account')
}
export function setLastAccount(name) {
  set('ytq_account', name)
}

/* ---------- Watched tracking (per account, per device) ---------- */
export function getWatched(account) {
  try { return new Set(JSON.parse(get(`ytq_watched_${account}`) || '[]')) }
  catch { return new Set() }
}
export function markWatched(account, videoId) {
  const s = getWatched(account)
  if (s.has(videoId)) return s
  s.add(videoId)
  set(`ytq_watched_${account}`, JSON.stringify([...s]))
  return s
}
export function unmarkWatched(account, videoId) {
  const s = getWatched(account)
  s.delete(videoId)
  set(`ytq_watched_${account}`, JSON.stringify([...s]))
  return s
}

/* ---------- Resume positions ---------- */
export function getProgressMap(account) {
  try { return JSON.parse(get(`ytq_progress_${account}`) || '{}') }
  catch { return {} }
}
export function saveProgress(account, videoId, seconds, duration) {
  const map = getProgressMap(account)
  // Near the end = finished; clear the resume point.
  if (duration && seconds / duration > 0.95) delete map[videoId]
  else map[videoId] = Math.floor(seconds)
  set(`ytq_progress_${account}`, JSON.stringify(map))
}

/* ---------- "NEW" badge: last time this account opened the app ---------- */
export function takeLastSeen(account) {
  const prev = Number(get(`ytq_lastseen_${account}`) || 0)
  set(`ytq_lastseen_${account}`, String(Date.now()))
  return prev
}

/* ---------- Player prefs ---------- */
export function getPlayerPrefs() {
  try {
    return {
      volume: 100,
      brightness: 1,
      rate: 1,
      autonext: true,
      ...(JSON.parse(get('ytq_player') || '{}')),
    }
  } catch {
    return { volume: 100, brightness: 1, rate: 1, autonext: true }
  }
}
export function savePlayerPrefs(prefs) {
  set('ytq_player', JSON.stringify(prefs))
}
