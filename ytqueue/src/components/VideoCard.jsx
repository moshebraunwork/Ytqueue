import { useEffect, useRef, useState } from 'react'
import { parseDuration, timeAgo, isShort, downloadVideo } from '../api.js'
import { DownloadIcon, EyeIcon, KebabIcon, TrashIcon, YoutubeIcon } from './Icons.jsx'

export default function VideoCard({ video, watched, isNew, progress, onPlay, onDelete, onToggleWatched, onToast }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)
  const d = parseDuration(video.duration)
  const short = isShort(video)
  const pct = progress && d.seconds ? Math.min(100, (progress / d.seconds) * 100) : 0

  useEffect(() => {
    if (!menuOpen) return
    const onDown = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [menuOpen])

  const handleDownload = (e) => {
    e.stopPropagation()
    setMenuOpen(false)
    const mode = downloadVideo(video.url)
    if (mode === 'copied') onToast('Link copied — paste it into YTDLnis')
  }

  return (
    <article className={`card ${watched ? 'is-watched' : ''} ${short ? 'is-short' : ''}`}>
      <button className="thumb" onClick={() => onPlay(video)} aria-label={`Play ${video.title || 'video'}`}>
        <img loading="lazy" src={video.thumbnail_url} alt="" />
        {isNew && !watched && <span className="badge badge-new">NEW</span>}
        {watched && <span className="badge badge-watched"><EyeIcon size={12} /> Watched</span>}
        {d.text && <span className={`badge-dur ${short ? 'short' : ''}`}>{short ? 'SHORT' : d.text}</span>}
        {pct > 0 && !watched && <span className="thumb-progress"><span style={{ width: pct + '%' }} /></span>}
      </button>

      <div className="card-meta">
        <div className="card-avatar">{(video.channel_title || '?')[0].toUpperCase()}</div>
        <div className="card-text" onClick={() => onPlay(video)}>
          <h3 className="card-title">{video.title || video.url}</h3>
          <p className="card-sub">
            {video.channel_title}
            <span className="dotsep">·</span>
            {timeAgo(video.published_at)}
          </p>
        </div>
        <div className="card-menu-wrap" ref={menuRef}>
          <button className="icon-btn sm" aria-label="More actions" onClick={(e) => { e.stopPropagation(); setMenuOpen((o) => !o) }}>
            <KebabIcon size={18} />
          </button>
          {menuOpen && (
            <div className="card-menu">
              <button onClick={handleDownload}><DownloadIcon size={18} /> Download</button>
              <button onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onToggleWatched(video) }}>
                <EyeIcon size={18} /> Mark as {watched ? 'unwatched' : 'watched'}
              </button>
              <a href={video.url} target="_blank" rel="noopener noreferrer" onClick={() => setMenuOpen(false)}>
                <YoutubeIcon size={18} /> Open on YouTube
              </a>
              <button className="danger" onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onDelete(video) }}>
                <TrashIcon size={18} /> Remove from queue
              </button>
            </div>
          )}
        </div>
      </div>
    </article>
  )
}
