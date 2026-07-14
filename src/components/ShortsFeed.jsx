import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { loadYouTubeAPI } from '../youtube.js'
import { downloadVideo } from '../api.js'
import { BackIcon, DownloadIcon, EyeIcon, TrashIcon, YoutubeIcon } from './Icons.jsx'

// How many slides on each side of the centered one keep a live player ready.
const WINDOW = 1

/*
 * Immersive, YouTube-Shorts-style vertical feed. One short per viewport,
 * snap scrolling. The centered slide plays; its immediate neighbours are
 * pre-built and paused so swiping to them starts near-instantly instead of
 * cold-loading a fresh iframe each time. Everything further out is just a
 * thumbnail, so scrolling a long queue stays cheap.
 */
export default function ShortsFeed({
  shorts, watched, channelLogos,
  onProgress, onWatched, onToggleWatched, onDelete, onToast, onClose,
}) {
  // Freeze the order the feed opened with. The queue sort already put
  // newest-first with watched at the back, but re-sorting live (as a short
  // gets auto-marked watched at the 50% point) would yank slides around
  // under the user. Deletions still drop out; new arrivals wait for reopen.
  const [order] = useState(() => shorts)
  const list = useMemo(() => {
    const live = new Set(shorts.map((v) => v.video_id))
    return order.filter((v) => live.has(v.video_id))
  }, [order, shorts])
  // Stable across watched changes (same ids/order) so the player-window
  // effect below doesn't churn every time a short gets marked watched.
  const listSig = useMemo(() => list.map((v) => v.video_id).join('|'), [list])

  const containerRef = useRef(null)
  const slideRefs = useRef([])
  const playersRef = useRef(new Map()) // slide index -> { player, videoId }
  const [active, setActive] = useState(0)

  const activeVideo = list[active]
  const activeId = activeVideo?.video_id

  // Live-value refs so player event callbacks always see the latest.
  const listRef = useRef(list); listRef.current = list
  const activeRef = useRef(active); activeRef.current = active
  const prevActiveRef = useRef(-1)
  const onWatchedRef = useRef(onWatched); onWatchedRef.current = onWatched

  // Drive a player to the role its slide currently has:
  //   active     → unmuted, playing (the short you're watching)
  //   active + 1 → muted, playing off-screen so it *buffers* ahead of time,
  //                which is what actually makes the next swipe start instantly
  //   otherwise  → muted + paused, but kept in the window ready to go
  const applyState = (idx, p) => {
    try {
      if (idx === activeRef.current) { p.unMute?.(); p.playVideo?.() }
      else if (idx === activeRef.current + 1) { p.mute?.(); p.playVideo?.() }
      else { p.mute?.(); p.pauseVideo?.() }
    } catch { /* player mid-transition */ }
  }

  // Which slide indices should hold a live player right now.
  const windowIdx = useMemo(() => {
    const s = new Set()
    for (let d = -WINDOW; d <= WINDOW; d++) {
      const i = active + d
      if (i >= 0 && i < list.length) s.add(i)
    }
    return s
  }, [active, list.length])

  /* Lock the page behind the feed while it's open; tear down every player. */
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    const players = playersRef.current
    return () => {
      document.body.style.overflow = ''
      players.forEach((e) => { try { e.player.destroy() } catch { /* noop */ } })
      players.clear()
    }
  }, [])

  /* Which slide is centered right now → becomes the active (playing) short. */
  useEffect(() => {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting && e.intersectionRatio >= 0.6) {
          const idx = Number(e.target.dataset.idx)
          if (!Number.isNaN(idx)) setActive(idx)
        }
      })
    }, { threshold: [0.6], root: containerRef.current })
    slideRefs.current.forEach((el) => el && io.observe(el))
    return () => io.disconnect()
  }, [list])

  /* Keep a small window of players mounted, play the centered one and pause
     the rest. Neighbours are built ahead of time, so a swipe just resumes an
     already-loaded player instead of creating one from scratch. */
  useEffect(() => {
    let cancelled = false
    loadYouTubeAPI().then((YT) => {
      if (cancelled) return
      const cur = listRef.current
      const players = playersRef.current

      // Drop players that scrolled out of the window (or whose slot changed).
      for (const [idx, entry] of players) {
        if (!windowIdx.has(idx) || cur[idx]?.video_id !== entry.videoId) {
          try { entry.player.destroy() } catch { /* noop */ }
          players.delete(idx)
        }
      }

      // Build any missing players in the window.
      windowIdx.forEach((idx) => {
        if (players.has(idx)) return
        const host = slideRefs.current[idx]?.querySelector('.short-host')
        if (!host) return
        host.innerHTML = '<div></div>'
        const video = cur[idx]
        const player = new YT.Player(host.firstChild, {
          videoId: video.video_id,
          playerVars: {
            // Start muted so buffering the neighbours is allowed to autoplay;
            // applyState unmutes the one you're actually watching.
            autoplay: 1, mute: 1,
            controls: 1, rel: 0, playsinline: 1, fs: 0,
            modestbranding: 1, iv_load_policy: 3,
          },
          events: {
            onReady: (e) => applyState(idx, e.target),
            onStateChange: (e) => {
              if (e.data === window.YT.PlayerState.ENDED) {
                // Only the short you're actually watching counts as watched.
                if (idx === activeRef.current) onWatchedRef.current(video)
                // Loop in place (keeps the warming neighbour buffered too).
                try { e.target.seekTo(0); e.target.playVideo() } catch { /* noop */ }
              }
            },
          },
        })
        players.set(idx, { player, videoId: video.video_id })
      })

      // Apply roles. When the centered short actually changed, restart it from
      // the top — a neighbour that was warming is buffered at 0, so it starts
      // immediately instead of picking up wherever the muted warm-up reached.
      const activeChanged = prevActiveRef.current !== activeRef.current
      prevActiveRef.current = activeRef.current
      players.forEach((entry, idx) => {
        if (idx === activeRef.current && activeChanged) {
          try { entry.player.seekTo?.(0, true) } catch { /* not ready yet */ }
        }
        applyState(idx, entry.player)
      })
    })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, listSig])

  /* Save resume position + mark watched past the halfway point. */
  useEffect(() => {
    const video = activeVideo
    if (!video) return
    const iv = setInterval(() => {
      const p = playersRef.current.get(activeRef.current)?.player
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
  }, [activeId])

  const goTo = useCallback((idx) => {
    slideRefs.current[idx]?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  /* Desktop keyboard nav. */
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowDown') { e.preventDefault(); goTo(Math.min(active + 1, list.length - 1)) }
      else if (e.key === 'ArrowUp') { e.preventDefault(); goTo(Math.max(active - 1, 0)) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active, list.length, goTo, onClose])

  const handleDownload = (video) => {
    const mode = downloadVideo(video.url)
    if (mode === 'copied') onToast('Link copied — paste it into YTDLnis')
  }

  return (
    <div className="shorts-feed" ref={containerRef}>
      <button className="ctl shorts-back" aria-label="Back" onClick={onClose}>
        <BackIcon size={22} />
      </button>

      {list.map((v, i) => {
        const isMounted = windowIdx.has(i)
        const isWatched = watched.has(v.video_id)
        const logo = channelLogos[v.channel_id]
        return (
          <section
            key={v.video_id}
            className="short-slide"
            data-idx={i}
            ref={(el) => { slideRefs.current[i] = el }}
          >
            <div className="short-stage">
              {isMounted
                ? <div className="short-host" />
                : (
                  <button className="short-thumb" onClick={() => goTo(i)} aria-label={`Play ${v.title || 'short'}`}>
                    <img loading="lazy" src={v.thumbnail_url} alt="" />
                    <span className="short-play">▶</span>
                  </button>
                )}
            </div>

            <div className="short-info">
              <div className="short-chan">
                <div className="card-avatar">
                  {logo
                    ? <img className="chan-logo" src={logo} alt="" />
                    : (v.channel_title || '?')[0].toUpperCase()}
                </div>
                <strong>{v.channel_title}</strong>
              </div>
              {v.title && <p className="short-title">{v.title}</p>}
            </div>

            <div className="short-rail">
              <button className={`rail-btn ${isWatched ? 'on' : ''}`} onClick={() => onToggleWatched(v)}>
                <EyeIcon size={24} /><span>{isWatched ? 'Watched' : 'Watch'}</span>
              </button>
              <button className="rail-btn" onClick={() => handleDownload(v)}>
                <DownloadIcon size={24} /><span>Save</span>
              </button>
              <a className="rail-btn" href={v.url} target="_blank" rel="noopener noreferrer">
                <YoutubeIcon size={24} /><span>YouTube</span>
              </a>
              <button className="rail-btn danger" onClick={() => onDelete(v)}>
                <TrashIcon size={24} /><span>Remove</span>
              </button>
            </div>
          </section>
        )
      })}
    </div>
  )
}
