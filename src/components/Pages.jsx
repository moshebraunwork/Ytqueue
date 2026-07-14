import { useMemo, useState } from 'react'
import VideoCard from './VideoCard.jsx'
import ShortsFeed from './ShortsFeed.jsx'
import { isShort, timeAgo, formatSeconds, parseDuration } from '../api.js'
import { PlusIcon } from './Icons.jsx'

/* =================== HOME =================== */

const KIND_TABS = [
  { id: 'all', label: 'All' },
  { id: 'videos', label: 'Videos' },
  { id: 'shorts', label: 'Shorts' },
]
const STATUS_OPTS = [
  { id: 'any', label: 'Everything' },
  { id: 'new', label: 'New' },
  { id: 'unwatched', label: 'Unwatched' },
  { id: 'watched', label: 'Watched' },
]

export function HomePage({
  videos, loading, error, onRetry, search,
  watched, newIds, progress, channelLogos, cardHandlers,
  onAddVideo, kind, setKind, onPlayList, onProgress, onWatched,
}) {
  const [status, setStatus] = useState('any')

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const list = videos.filter((v) => {
      if (kind === 'shorts' && !isShort(v)) return false
      if (kind === 'videos' && isShort(v)) return false
      if (status === 'new' && !newIds.has(v.video_id)) return false
      if (status === 'watched' && !watched.has(v.video_id)) return false
      if (status === 'unwatched' && watched.has(v.video_id)) return false
      if (q && !`${v.title} ${v.channel_title}`.toLowerCase().includes(q)) return false
      return true
    })
    // In "Everything", watched videos sink to the bottom (stable within groups).
    if (status === 'any') {
      const fresh = list.filter((v) => !watched.has(v.video_id))
      const seen = list.filter((v) => watched.has(v.video_id))
      return [...fresh, ...seen]
    }
    return list
  }, [videos, kind, status, search, watched, newIds])

  const continueWatching = useMemo(() => {
    if (search.trim() || status !== 'any' || kind !== 'all') return []
    return videos.filter((v) => progress[v.video_id] > 10 && !watched.has(v.video_id))
  }, [videos, progress, watched, search, status, kind])

  const newCount = useMemo(
    () => videos.filter((v) => newIds.has(v.video_id) && !watched.has(v.video_id)).length,
    [videos, newIds, watched],
  )

  if (loading) return <div className="center-state"><span className="spinner" /></div>
  if (error) return (
    <div className="empty-state">
      <h2>Couldn't load your queue</h2>
      <p>{error} — check that n8n is up and CORS is allowed.</p>
      <button className="cta" onClick={onRetry}>Retry</button>
    </div>
  )
  if (!videos.length) return (
    <div className="empty-state">
      <h2>Your queue is empty</h2>
      <p>Paste a YouTube link to save your first video, or watch a channel and new uploads will arrive on their own.</p>
      <button className="cta" onClick={onAddVideo}><PlusIcon size={18} /> Save a video</button>
    </div>
  )

  const tabsBar = (
    <div className="tabs-bar">
      <div className="tabs">
        {KIND_TABS.map((t) => (
          <button key={t.id} className={`tab ${kind === t.id ? 'active' : ''}`} onClick={() => setKind(t.id)}>
            {t.label}
          </button>
        ))}
      </div>
      <div className="status-select-wrap">
        <select className="status-select" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter by status">
          {STATUS_OPTS.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}{o.id === 'new' && newCount > 0 ? ` (${newCount})` : ''}
            </option>
          ))}
        </select>
      </div>
    </div>
  )

  // Shorts tab is an immersive, full-screen vertical feed rather than a grid.
  if (kind === 'shorts') {
    if (filtered.length === 0) {
      return (
        <>
          {tabsBar}
          <div className="empty-state slim"><h2>No shorts yet</h2><p>Nothing under 60 seconds in your queue right now.</p></div>
        </>
      )
    }
    return (
      <ShortsFeed
        shorts={filtered}
        watched={watched}
        channelLogos={channelLogos}
        onProgress={onProgress}
        onWatched={onWatched}
        onToggleWatched={cardHandlers.onToggleWatched}
        onDelete={cardHandlers.onDelete}
        onToast={cardHandlers.onToast}
        onClose={() => setKind('all')}
      />
    )
  }

  return (
    <>
      {tabsBar}

      {continueWatching.length > 0 && (
        <section className="cw">
          <h3 className="cw-title">Continue watching</h3>
          <div className="cw-row">
            {continueWatching.map((v) => {
              const d = parseDuration(v.duration).seconds
              const pct = d ? Math.min(100, (progress[v.video_id] / d) * 100) : 0
              return (
                <button key={v.video_id} className="cw-card" onClick={() => onPlayList(v, continueWatching)}>
                  <span className="cw-thumb">
                    <img loading="lazy" src={v.thumbnail_url} alt="" />
                    <span className="badge-dur">{formatSeconds(progress[v.video_id])} / {formatSeconds(d)}</span>
                    <span className="thumb-progress"><span style={{ width: pct + '%' }} /></span>
                  </span>
                  <span className="cw-name">{v.title}</span>
                </button>
              )
            })}
          </div>
        </section>
      )}

      {filtered.length === 0
        ? <div className="empty-state slim"><h2>No matches</h2><p>Nothing fits this filter right now.</p></div>
        : (
          <div className={`grid ${kind === 'shorts' ? 'grid-shorts' : ''}`}>
            {filtered.map((v) => (
              <VideoCard
                key={v.video_id}
                video={v}
                watched={watched.has(v.video_id)}
                isNew={newIds.has(v.video_id)}
                progress={progress[v.video_id]}
                channelLogo={channelLogos[v.channel_id]}
                {...cardHandlers}
                onPlay={(vid) => onPlayList(vid, filtered)}
              />
            ))}
          </div>
        )}
    </>
  )
}

/* =================== CHANNELS =================== */

export function ChannelsPage({
  channels, videos, loading, error, onRetry,
  watched, newIds, progress, channelLogos, cardHandlers,
  onAddChannel, onDeleteChannel, adding, onPlayList,
}) {
  const [input, setInput] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [selected, setSelected] = useState(null)

  const counts = useMemo(() => {
    const m = {}
    videos.forEach((v) => { m[v.channel_id] = (m[v.channel_id] || 0) + 1 })
    return m
  }, [videos])

  const channelVideos = useMemo(
    () => (selected ? videos.filter((v) => v.channel_id === selected.channel_id) : []),
    [videos, selected],
  )

  const submit = () => {
    const url = input.trim()
    if (!url) return
    onAddChannel(url).then((ok) => { if (ok) { setInput(''); setAddOpen(false) } })
  }

  const logoFor = (c) => c.channel_thumbnail_url || c.thumbnail_url || channelLogos[c.channel_id]

  if (loading) return <div className="center-state"><span className="spinner" /></div>
  if (error) return (
    <div className="empty-state">
      <h2>Couldn't load channels</h2>
      <p>{error}</p>
      <button className="cta" onClick={onRetry}>Retry</button>
    </div>
  )

  if (selected) {
    const logo = logoFor(selected)
    return (
      <div className="channel-detail">
        <button className="linkback" onClick={() => setSelected(null)}>‹ Channels</button>
        <div className="channel-hero">
          <div className="card-avatar xl">
            {logo ? <img className="chan-logo" src={logo} alt="" /> : (selected.channel_title || '?')[0].toUpperCase()}
          </div>
          <div className="channel-hero-info">
            <h2>{selected.channel_title}</h2>
            <p>{channelVideos.length} video{channelVideos.length !== 1 ? 's' : ''} · watching since {new Date(selected.added_at).toLocaleDateString()}</p>
          </div>
          <button className="pill danger" onClick={() => onDeleteChannel(selected, () => setSelected(null))}>Stop watching</button>
        </div>
        {channelVideos.length === 0
          ? <div className="empty-state slim"><h2>Nothing here yet</h2><p>New uploads land within 30 minutes of the next check.</p></div>
          : (
            <div className="grid">
              {channelVideos.map((v) => (
                <VideoCard
                  key={v.video_id}
                  video={v}
                  watched={watched.has(v.video_id)}
                  isNew={newIds.has(v.video_id)}
                  progress={progress[v.video_id]}
                  channelLogo={logo}
                  {...cardHandlers}
                  onPlay={(vid) => onPlayList(vid, channelVideos)}
                />
              ))}
            </div>
          )}
      </div>
    )
  }

  return (
    <div className="channels-page">
      <div className="channels-head">
        <span className="channels-count">{channels.length} channel{channels.length !== 1 ? 's' : ''}</span>
        <button className="cta sm" onClick={() => setAddOpen((o) => !o)}>
          <PlusIcon size={17} /> Add channel
        </button>
      </div>

      {addOpen && (
        <div className="add-channel">
          <input
            placeholder="Channel link or @handle"
            value={input}
            autoFocus
            autoComplete="off"
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
          />
          <button className="cta" disabled={adding || !input.trim()} onClick={submit}>
            {adding ? 'Adding…' : 'Watch'}
          </button>
        </div>
      )}

      {channels.length === 0
        ? <div className="empty-state slim"><h2>Not watching any channels</h2><p>Add one and its new uploads will show up in your queue on their own, checked every 30 minutes.</p></div>
        : (
          <div className="channel-list">
            {channels.map((c) => {
              const logo = logoFor(c)
              return (
                <button key={c.channel_id} className="channel-row" onClick={() => setSelected(c)}>
                  <div className="card-avatar lg">
                    {logo ? <img className="chan-logo" src={logo} alt="" /> : (c.channel_title || '?')[0].toUpperCase()}
                  </div>
                  <div className="channel-row-info">
                    <strong>{c.channel_title || c.channel_id}</strong>
                    <span>{counts[c.channel_id] || 0} video{(counts[c.channel_id] || 0) !== 1 ? 's' : ''} in queue · added {timeAgo(c.added_at)}</span>
                  </div>
                  <span className="chev">›</span>
                </button>
              )
            })}
          </div>
        )}
    </div>
  )
}
