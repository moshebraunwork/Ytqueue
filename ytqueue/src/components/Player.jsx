import { useCallback, useEffect, useRef, useState } from 'react'
import { formatSeconds, parseDuration, timeAgo, downloadVideo } from '../api.js'
import { getPlayerPrefs, savePlayerPrefs } from '../storage.js'
import {
  BackIcon, BrightnessIcon, DownloadIcon, Forward10Icon, FullscreenIcon,
  FullscreenExitIcon, MuteIcon, NextIcon, PauseIcon, PlayIcon, PrevIcon,
  Replay10Icon, SpeedIcon, TrashIcon, VolumeIcon, YoutubeIcon,
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

const RATES = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2]

export default function Player({
  video, playlist, startAt = 0,
  onClose, onNavigate, onProgress, onWatched, onDelete, onToast,
}) {
  const containerRef = useRef(null)
  const hostRef = useRef(null)
  const playerRef = useRef(null)
  const hideTimer = useRef(null)
  const gesture = useRef(null)

  const prefs = useRef(getPlayerPrefs())
  const [ready, setReady] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [ended, setEnded] = useState(false)
  const [current, setCurrent] = useState(0)
  const [duration, setDuration] = useState(parseDuration(video.duration).seconds)
  const [volume, setVolume] = useState(prefs.current.volume)
  const [muted, setMuted] = useState(false)
  const [brightness, setBrightness] = useState(prefs.current.brightness)
  const [rate, setRate] = useState(prefs.current.rate)
  const [autonext, setAutonext] = useState(prefs.current.autonext)
  const [controlsVisible, setControlsVisible] = useState(true)
  const [fullscreen, setFullscreen] = useState(false)
  const [rateMenu, setRateMenu] = useState(false)
  const [gestureHud, setGestureHud] = useState(null) // {kind:'volume'|'brightness', value}
  const [descOpen, setDescOpen] = useState(false)

  const index = playlist.findIndex((v) => v.video_id === video.video_id)
  const prevVideo = index > 0 ? playlist[index - 1] : null
  const nextVideo = index >= 0 && index < playlist.length - 1 ? playlist[index + 1] : null

  const persistPrefs = useCallback((patch) => {
    prefs.current = { ...prefs.current, ...patch }
    savePlayerPrefs(prefs.current)
  }, [])

  /* ---------- Auto-hide controls ---------- */
  const pokeControls = useCallback(() => {
    setControlsVisible(true)
    clearTimeout(hideTimer.current)
    hideTimer.current = setTimeout(() => {
      setControlsVisible(false)
      setRateMenu(false)
    }, 3200)
  }, [])

  /* ---------- Create the player ---------- */
  useEffect(() => {
    let cancelled = false
    setReady(false)
    setEnded(false)
    setCurrent(startAt)
    setDuration(parseDuration(video.duration).seconds)
    setDescOpen(false)
    pokeControls()

    loadYouTubeAPI().then((YT) => {
      if (cancelled || !hostRef.current) return
      hostRef.current.innerHTML = '<div id="ytq-player-host"></div>'
      playerRef.current = new YT.Player('ytq-player-host', {
        videoId: video.video_id,
        playerVars: {
          autoplay: 1,
          controls: 0,
          rel: 0,
          playsinline: 1,
          modestbranding: 1,
          start: Math.floor(startAt),
          iv_load_policy: 3,
        },
        events: {
          onReady: (e) => {
            if (cancelled) return
            e.target.setVolume(prefs.current.volume)
            e.target.setPlaybackRate(prefs.current.rate)
            setReady(true)
            setDuration(e.target.getDuration() || parseDuration(video.duration).seconds)
          },
          onStateChange: (e) => {
            if (cancelled) return
            const S = window.YT.PlayerState
            setPlaying(e.data === S.PLAYING)
            if (e.data === S.PLAYING) setEnded(false)
            if (e.data === S.ENDED) {
              setEnded(true)
              onWatched(video)
              setControlsVisible(true)
            }
          },
          onPlaybackRateChange: (e) => setRate(e.data),
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
        setCurrent(t)
        if (d) setDuration(d)
        if (t > 0) onProgress(video, t, d)
        // Counts as watched at the half-way point.
        if (d > 0 && t / d > 0.5) onWatched(video)
      } catch { /* player mid-transition */ }
    }, 1000)
    return () => clearInterval(iv)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [video.video_id])

  /* ---------- Auto-next ---------- */
  useEffect(() => {
    if (ended && autonext && nextVideo) {
      const t = setTimeout(() => onNavigate(nextVideo), 1400)
      return () => clearTimeout(t)
    }
  }, [ended, autonext, nextVideo, onNavigate])

  /* ---------- Fullscreen ---------- */
  useEffect(() => {
    const onFs = () => setFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onFs)
    return () => document.removeEventListener('fullscreenchange', onFs)
  }, [])

  const toggleFullscreen = () => {
    const el = containerRef.current
    if (!document.fullscreenElement) {
      el?.requestFullscreen?.().then(() => {
        screen.orientation?.lock?.('landscape').catch(() => {})
      }).catch(() => {})
    } else {
      document.exitFullscreen?.()
      screen.orientation?.unlock?.()
    }
  }

  /* ---------- Controls actions ---------- */
  const togglePlay = () => {
    const p = playerRef.current
    if (!p) return
    playing ? p.pauseVideo() : p.playVideo()
    pokeControls()
  }
  const seekBy = (secs) => {
    const p = playerRef.current
    if (!p) return
    p.seekTo(Math.max(0, Math.min(duration, (p.getCurrentTime() || 0) + secs)), true)
    pokeControls()
  }
  const seekTo = (t) => {
    playerRef.current?.seekTo(t, true)
    setCurrent(t)
    pokeControls()
  }
  const changeVolume = (v) => {
    v = Math.round(Math.max(0, Math.min(100, v)))
    setVolume(v)
    setMuted(v === 0)
    const p = playerRef.current
    if (p) { p.setVolume(v); v === 0 ? p.mute() : p.unMute() }
    persistPrefs({ volume: v })
  }
  const toggleMute = () => {
    const p = playerRef.current
    if (!p) return
    if (muted) { p.unMute(); p.setVolume(volume || 50); setMuted(false) }
    else { p.mute(); setMuted(true) }
    pokeControls()
  }
  const changeRate = (r) => {
    setRate(r)
    playerRef.current?.setPlaybackRate(r)
    persistPrefs({ rate: r })
    setRateMenu(false)
    pokeControls()
  }
  const changeBrightness = (b) => {
    b = Math.max(0.15, Math.min(1, b))
    setBrightness(b)
    persistPrefs({ brightness: b })
  }

  /* ---------- Touch gestures: left = brightness, right = volume ---------- */
  const lastTap = useRef({ t: 0, x: 0 })

  const onTouchStart = (e) => {
    if (e.touches.length !== 1) return
    const t = e.touches[0]
    const rect = containerRef.current.getBoundingClientRect()
    gesture.current = {
      x: t.clientX, y: t.clientY,
      side: t.clientX - rect.left < rect.width / 2 ? 'brightness' : 'volume',
      startVolume: muted ? 0 : volume,
      startBrightness: brightness,
      height: rect.height,
      moved: false,
    }
  }

  const onTouchMove = (e) => {
    const g = gesture.current
    if (!g || e.touches.length !== 1) return
    const t = e.touches[0]
    const dy = g.y - t.clientY
    const dx = Math.abs(t.clientX - g.x)
    if (!g.moved && Math.abs(dy) < 14 && dx < 14) return
    if (!g.moved && dx > Math.abs(dy)) { gesture.current = null; return } // horizontal: ignore
    g.moved = true
    e.preventDefault()
    const delta = dy / (g.height * 0.7)
    if (g.side === 'volume') {
      const v = g.startVolume + delta * 100
      changeVolume(v)
      setGestureHud({ kind: 'volume', value: Math.round(Math.max(0, Math.min(100, v))) })
    } else {
      const b = g.startBrightness + delta
      changeBrightness(b)
      setGestureHud({ kind: 'brightness', value: Math.round(Math.max(0.15, Math.min(1, b)) * 100) })
    }
  }

  const onTouchEnd = (e) => {
    lastTouchTs.current = Date.now()
    const g = gesture.current
    gesture.current = null
    if (g && g.moved) {
      setTimeout(() => setGestureHud(null), 500)
      return
    }
    // Tap handling: double-tap seek, single-tap toggle controls.
    const now = Date.now()
    const x = g?.x ?? 0
    const rect = containerRef.current.getBoundingClientRect()
    if (now - lastTap.current.t < 320 && Math.abs(x - lastTap.current.x) < 60) {
      lastTap.current = { t: 0, x: 0 }
      const rel = (x - rect.left) / rect.width
      if (rel < 0.35) seekBy(-10)
      else if (rel > 0.65) seekBy(10)
      else togglePlay()
    } else {
      lastTap.current = { t: now, x }
      setTimeout(() => {
        if (Date.now() - lastTap.current.t >= 320 && lastTap.current.t !== 0) {
          setControlsVisible((v) => {
            if (!v) pokeControls()
            return !v
          })
          lastTap.current = { t: 0, x: 0 }
        }
      }, 330)
    }
  }

  /* ---------- Keyboard (desktop) ---------- */
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName === 'INPUT') return
      switch (e.key) {
        case ' ': case 'k': e.preventDefault(); togglePlay(); break
        case 'ArrowLeft': seekBy(-5); break
        case 'ArrowRight': seekBy(5); break
        case 'ArrowUp': e.preventDefault(); changeVolume(volume + 5); pokeControls(); break
        case 'ArrowDown': e.preventDefault(); changeVolume(volume - 5); pokeControls(); break
        case 'f': toggleFullscreen(); break
        case 'm': toggleMute(); break
        case 'Escape': if (!document.fullscreenElement) onClose(); break
        default: break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  /* ---------- Desktop mouse: click = play/pause, dblclick = fullscreen ---------- */
  const lastTouchTs = useRef(0)
  const clickTimer = useRef(null)
  const onStageClick = () => {
    if (Date.now() - lastTouchTs.current < 600) return // touch already handled it
    clearTimeout(clickTimer.current)
    clickTimer.current = setTimeout(() => togglePlay(), 250)
  }
  const onStageDblClick = () => {
    if (Date.now() - lastTouchTs.current < 600) return
    clearTimeout(clickTimer.current)
    toggleFullscreen()
  }

  const handleDownload = () => {
    const mode = downloadVideo(video.url)
    if (mode === 'copied') onToast('Link copied — paste it into YTDLnis')
  }

  const pct = duration ? (current / duration) * 100 : 0

  return (
    <div className="player-page">
      <div
        ref={containerRef}
        className={`stage ${controlsVisible ? 'show-controls' : ''} ${fullscreen ? 'is-fs' : ''}`}
        onMouseMove={pokeControls}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onClick={onStageClick}
        onDoubleClick={onStageDblClick}
      >
        <div className="stage-video" ref={hostRef} />
        <div className="stage-dim" style={{ opacity: 1 - brightness }} />

        {/* Gesture HUD */}
        {gestureHud && (
          <div className="gesture-hud">
            {gestureHud.kind === 'volume'
              ? (gestureHud.value === 0 ? <MuteIcon size={26} /> : <VolumeIcon size={26} />)
              : <BrightnessIcon size={26} />}
            <div className="gesture-bar"><span style={{ width: gestureHud.value + '%' }} /></div>
            <span className="gesture-val">{gestureHud.value}</span>
          </div>
        )}

        {/* Loading */}
        {!ready && <div className="stage-loading"><span className="spinner" /></div>}

        {/* Ended overlay */}
        {ended && nextVideo && autonext && (
          <div className="upnext">
            <span>Up next</span>
            <strong>{nextVideo.title}</strong>
          </div>
        )}

        {/* Controls */}
        <div className="controls" onTouchStart={(e) => e.stopPropagation()} onTouchEnd={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
          <div className="controls-top">
            <button className="ctl" aria-label="Back" onClick={onClose}><BackIcon size={22} /></button>
            <div className="controls-title">{video.title}</div>
            <button className="ctl" aria-label="Download" onClick={handleDownload}><DownloadIcon size={22} /></button>
          </div>

          <div className="controls-center">
            <button className="ctl big" disabled={!prevVideo} onClick={() => prevVideo && onNavigate(prevVideo)} aria-label="Previous"><PrevIcon size={26} /></button>
            <button className="ctl big" onClick={() => seekBy(-10)} aria-label="Back 10 seconds"><Replay10Icon size={28} /></button>
            <button className="ctl huge" onClick={togglePlay} aria-label={playing ? 'Pause' : 'Play'}>
              {playing ? <PauseIcon size={40} /> : <PlayIcon size={40} />}
            </button>
            <button className="ctl big" onClick={() => seekBy(10)} aria-label="Forward 10 seconds"><Forward10Icon size={28} /></button>
            <button className="ctl big" disabled={!nextVideo} onClick={() => nextVideo && onNavigate(nextVideo)} aria-label="Next"><NextIcon size={26} /></button>
          </div>

          <div className="controls-bottom">
            <div className="scrub-row">
              <span className="time">{formatSeconds(current)}</span>
              <input
                className="scrub"
                type="range" min="0" max={duration || 0} step="0.5"
                value={Math.min(current, duration || 0)}
                style={{ '--pct': pct + '%' }}
                onChange={(e) => seekTo(Number(e.target.value))}
              />
              <span className="time">{formatSeconds(duration)}</span>
            </div>
            <div className="ctl-row">
              <button className="ctl" onClick={toggleMute} aria-label="Mute">
                {muted || volume === 0 ? <MuteIcon size={20} /> : <VolumeIcon size={20} />}
              </button>
              <input
                className="vol desktop-only"
                type="range" min="0" max="100" value={muted ? 0 : volume}
                style={{ '--pct': (muted ? 0 : volume) + '%' }}
                onChange={(e) => changeVolume(Number(e.target.value))}
              />
              <div className="spacer" />
              <label className="autonext">
                <input type="checkbox" checked={autonext} onChange={(e) => { setAutonext(e.target.checked); persistPrefs({ autonext: e.target.checked }) }} />
                Autoplay
              </label>
              <div className="rate-wrap">
                <button className="ctl rate" onClick={() => setRateMenu((o) => !o)} aria-label="Playback speed">
                  <SpeedIcon size={18} /> {rate}×
                </button>
                {rateMenu && (
                  <div className="rate-menu">
                    {RATES.map((r) => (
                      <button key={r} className={r === rate ? 'active' : ''} onClick={() => changeRate(r)}>{r}×</button>
                    ))}
                  </div>
                )}
              </div>
              <button className="ctl" onClick={toggleFullscreen} aria-label="Fullscreen">
                {fullscreen ? <FullscreenExitIcon size={20} /> : <FullscreenIcon size={20} />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Info below the stage */}
      <div className="player-info">
        <h1 className="player-title">{video.title || video.url}</h1>
        <div className="player-row">
          <div className="card-avatar lg">{(video.channel_title || '?')[0].toUpperCase()}</div>
          <div className="player-chan">
            <strong>{video.channel_title}</strong>
            <span>{timeAgo(video.published_at)} · saved {timeAgo(video.added_at)}</span>
          </div>
        </div>
        <div className="player-actions">
          <button className="pill" onClick={handleDownload}><DownloadIcon size={18} /> Download</button>
          <a className="pill" href={video.url} target="_blank" rel="noopener noreferrer"><YoutubeIcon size={18} /> YouTube</a>
          <button className="pill danger" onClick={() => onDelete(video)}><TrashIcon size={18} /> Remove</button>
        </div>
        {video.description && (
          <button className={`player-desc ${descOpen ? 'open' : ''}`} onClick={() => setDescOpen((o) => !o)}>
            {video.description}
          </button>
        )}
      </div>
    </div>
  )
}
