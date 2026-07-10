import { useCallback, useEffect, useRef, useState } from 'react'
import { timeAgo, downloadVideo } from '../api.js'
import { getPlayerPrefs, savePlayerPrefs } from '../storage.js'
import {
  BackIcon, DownloadIcon, EyeIcon, NextIcon, PrevIcon,
  TrashIcon, YoutubeIcon,
} from './Icons.jsx'

/* ---------- YouTube IFrame API loader ---------- */
let ytApiPromise = null
function loadYouTubeAPI() {
  if (window.YT && window.YT.Player) return Promise.resolve(window.YT)
  if (ytApiPromise) return ytApiPromise
  ytApiPromise = new Promise((resolve) => {
    const prev = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => { prev?.(); resolve(window.YT) }
    const tag = document.createElement('script')
    tag.src = 'https://www.youtube.com/iframe_api'
    document.head.appendChild(tag)
  })
  return ytApiPromise
}

export default function Player({
  video, playlist, startAt = 0, channelLogo,
  onClose, onNavigate, onProgress, onWatched, onDelete, onToast, watched, onToggleWatched,
}) {
  const hostRef = useRef(null)
  const playerRef = useRef(null)
  const hideTimer = useRef(null)

  const [overlay, setOverlay] = useState(true)
  const [landscape, setLandscape] = useState(
    () => window.matchMedia('(orientation: landscape)').matches,
  )
  const [autonext, setAutonext] = useState(() => getPlayerPrefs().autonext)
  const [ended, setEnded] = useState(false)

  const index = playlist.findIndex((v) => v.video_id === video.video_id)
  const prevVideo = index > 0 ? playlist[index - 1] : null
  const nextVideo = index >= 0 && index < playlist.length - 1 ? playlist[index + 1] : null

  const isMobile = window.matchMedia('(max-width: 899px)').matches

  /* ---------- Overlay auto-hide (mobile portrait) ---------- */
  const pokeOverlay = useCallback(() => {
    setOverlay(true)
    clearTimeout(hideTimer.current)
    hideTimer.current = setTimeout(() => setOverlay(false), 4500)
  }, [])

  useEffect(() => {
    pokeOverlay()
    return () => clearTimeout(hideTimer.current)
  }, [pokeOverlay])

  const toggleOverlay = () => {
    if (overlay) {
      clearTimeout(hideTimer.current)
      setOverlay(false)
    } else pokeOverlay()
  }

  /* ---------- Orientation: landscape = fill the screen ---------- */
  useEffect(() => {
    const mq = window.matchMedia('(orientation: landscape)')
    const onChange = (e) => {
      setLandscape(e.matches)
      // Opportunistic real fullscreen; harmless no-op if the browser
      // doesn't count the rotation as a user gesture.
      if (e.matches && isMobile) {
        document.querySelector('.player-page')?.requestFullscreen?.().catch(() => {})
      } else if (!e.matches && document.fullscreenElement) {
        document.exitFullscreen?.().catch(() => {})
      }
    }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [isMobile])

  /* ---------- Lock body scroll while open ---------- */
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  /* ---------- Create player (native YouTube controls) ---------- */
  useEffect(() => {
    let cancelled = false
    setEnded(false)

    loadYouTubeAPI().then((YT) => {
      if (cancelled || !hostRef.current) return
      hostRef.current.innerHTML = '<div id="ytq-player-host"></div>'
      playerRef.current = new YT.Player('ytq-player-host', {
        videoId: video.video_id,
        playerVars: {
          autoplay: 1,
          controls: 1,            // native YouTube controls
          rel: 0,
          playsinline: 1,
          fs: 1,
          start: Math.floor(startAt),
          iv_load_policy: 3,
        },
        events: {
          onStateChange: (e) => {
            if (cancelled) return
            if (e.data === window.YT.PlayerState.ENDED) {
              setEnded(true)
              onWatched(video)
              setOverlay(true)
            } else setEnded(false)
          },
        },
      })
    })

    return () => {
      cancelled = true
      try { playerRef.current?.destroy() } catch { /* noop */ }
      playerRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [video.video_id])

  /* ---------- Progress polling / watched detection ---------- */
  useEffect(() => {
    const iv = setInterval(() => {
      const p = playerRef.current
      if (!p || typeof p.getCurrentTime !== 'function') return
      try {
        const t = p.getCurrentTime() || 0
        const d = p.getDuration() || 0
        if (t > 0) onProgress(video, t, d)
        if (d > 0 && t / d > 0.5) onWatched(video)
      } catch { /* player mid-transition */ }
    }, 2000)
    return () => clearInterval(iv)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [video.video_id])

  /* ---------- Auto-next ---------- */
  useEffect(() => {
    if (ended && autonext && nextVideo) {
      const t = setTimeout(() => onNavigate(nextVideo), 1600)
      return () => clearTimeout(t)
    }
  }, [ended, autonext, nextVideo, onNavigate])

  /* ---------- Esc to close (desktop) ---------- */
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !document.fullscreenElement) onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const handleDownload = () => {
    const mode = downloadVideo(video.url)
    if (mode === 'copied') onToast('Link copied — paste it into YTDLnis')
  }

  const setAuto = (v) => {
    setAutonext(v)
    savePlayerPrefs({ ...getPlayerPrefs(), autonext: v })
  }

  const isWatched = watched.has(video.video_id)

  const chanAvatar = (cls = 'card-avatar') => (
    <div className={cls}>
      {channelLogo
        ? <img className="chan-logo" src={channelLogo} alt="" />
        : (video.channel_title || '?')[0].toUpperCase()}
    </div>
  )

  const actionButtons = (
    <div className="pactions">
      <button className="pill" onClick={handleDownload}><DownloadIcon size={18} /> Download</button>
      <button className="pill" onClick={() => onToggleWatched(video)}>
        <EyeIcon size={18} /> {isWatched ? 'Watched ✓' : 'Mark watched'}
      </button>
      <a className="pill" href={video.url} target="_blank" rel="noopener noreferrer">
        <YoutubeIcon size={18} /> YouTube
      </a>
      <button className="pill danger" onClick={() => onDelete(video)}><TrashIcon size={18} /> Remove</button>
    </div>
  )

  const navRow = (prevVideo || nextVideo) && (
    <div className="pnav">
      <button className="pill" disabled={!prevVideo} onClick={() => prevVideo && onNavigate(prevVideo)}>
        <PrevIcon size={18} /> Previous
      </button>
      <label className="autonext">
        <input type="checkbox" checked={autonext} onChange={(e) => setAuto(e.target.checked)} />
        Autoplay
      </label>
      <button className="pill" disabled={!nextVideo} onClick={() => nextVideo && onNavigate(nextVideo)}>
        Next <NextIcon size={18} />
      </button>
    </div>
  )

  /* ============ Mobile: black page, centered video, tap-reveal overlay ============ */
  if (isMobile) {
    return (
      <div className={`player-page mobile ${landscape ? 'landscape' : ''}`}>
        <div className="void" onClick={toggleOverlay} />
        <div className="stage-native">
          <div className="stage-video" ref={hostRef} />
        </div>
        <div className="void" onClick={toggleOverlay}>
          {ended && autonext && nextVideo && !overlay && (
            <div className="upnext static">
              <span>Up next</span>
              <strong>{nextVideo.title}</strong>
            </div>
          )}
        </div>

        {/* Top bar (portrait, on tap) */}
        <div className={`ptop ${overlay && !landscape ? 'show' : ''}`}>
          <button className="ctl" aria-label="Back" onClick={onClose}><BackIcon size={22} /></button>
          <div className="controls-title">{video.title}</div>
        </div>

        {/* Bottom sheet (portrait, on tap) */}
        <div className={`psheet ${overlay && !landscape ? 'show' : ''}`}>
          <div className="psheet-head">
            {chanAvatar()}
            <div className="player-chan">
              <strong>{video.channel_title}</strong>
              <span>{timeAgo(video.published_at)} · saved {timeAgo(video.added_at)}</span>
            </div>
          </div>
          {navRow}
          {actionButtons}
          {video.description && <div className="psheet-desc">{video.description}</div>}
        </div>

        {/* Corner back button in landscape */}
        {landscape && (
          <button className="ctl fs-back" aria-label="Back" onClick={onClose}><BackIcon size={22} /></button>
        )}
      </div>
    )
  }

  /* ============ Desktop: centered video, info below ============ */
  return (
    <div className="player-page desktop">
      <div className="ptop show">
        <button className="ctl" aria-label="Back" onClick={onClose}><BackIcon size={22} /></button>
        <div className="controls-title">{video.title}</div>
      </div>
      <div className="stage-native desktop">
        <div className="stage-video" ref={hostRef} />
      </div>
      <div className="player-info">
        <h1 className="player-title">{video.title || video.url}</h1>
        <div className="player-row">
          {chanAvatar('card-avatar lg')}
          <div className="player-chan">
            <strong>{video.channel_title}</strong>
            <span>{timeAgo(video.published_at)} · saved {timeAgo(video.added_at)}</span>
          </div>
        </div>
        {navRow}
        {actionButtons}
        {video.description && <div className="psheet-desc open">{video.description}</div>}
      </div>
    </div>
  )
}
