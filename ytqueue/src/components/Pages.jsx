import { useMemo, useState } from 'react'
import VideoCard from './VideoCard.jsx'
import { isShort, timeAgo } from '../api.js'
import { ChannelsIcon, PlusIcon } from './Icons.jsx'

/* =================== HOME =================== */

const KIND_TABS = [
  { id: 'all', label: 'All' },
  { id: 'videos', label: 'Videos' },
  { id: 'shorts', label: 'Shorts' },
]
const STATUS_TABS = [
  { id: 'any', label: 'Everything' },
  { id: 'new', label: 'New' },
  { id: 'unwatched', label: 'Unwatched' },
  { id: 'watched', label: 'Watched' },
]

export function HomePage({ videos, loading, error, onRetry, search, watched, newIds, progress, cardHandlers, onAddVideo, kind, setKind }) {
  const [status, setStatus] = useState('any')

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return videos.filter((v) => {
      if (kind === 'shorts' && !isShort(v)) return false
      if (kind === 'videos' && isShort(v)) return false
      if (status === 'new' && !newIds.has(v.video_id)) return false
      if (status === 'watched' && !watched.has(v.video_id)) return false
      if (status === 'unwatched' && watched.has(v.video_id)) return false
      if (q && !`${v.title} ${v.channel_title}`.toLowerCase().includes(q)) return false
      return true
    })
  }, [videos, kind, status, search, watched, newIds])

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

  return (
    <>
      <div className="tabs-bar">
        <div className="tabs">
          {KIND_TABS.map((t) => (
            <button key={t.id} className={`tab ${kind === t.id ? 'active' : ''}`} onClick={() => setKind(t.id)}>{t.label}</button>
          ))}
        </div>
        <div className="tabs sub">
          {STATUS_TABS.map((t) => (
            <button key={t.id} className={`tab pill-tab ${status === t.id ? 'active' : ''}`} onClick={() => setStatus(t.id)}>
              {t.label}{t.id === 'new' && newCount > 0 && <span className="count">{newCount}</span>}
            </button>
          ))}
        </div>
      </div>
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
                {...cardHandlers}
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
  watched, newIds, progress, cardHandlers,
  onAddChannel, onDeleteChannel, adding,
}) {
  const [input, setInput] = useState('')
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
    onAddChannel(url).then((ok) => { if (ok) setInput('') })
  }

  if (loading) return <div className="center-state"><span className="spinner" /></div>
  if (error) return (
    <div className="empty-state">
      <h2>Couldn't load channels</h2>
      <p>{error}</p>
      <button className="cta" onClick={onRetry}>Retry</button>
    </div>
  )

  if (selected) {
    return (
      <div className="channel-detail">
        <div className="channel-detail-head">
          <button className="linkback" onClick={() => setSelected(null)}>‹ All channels</button>
          <div className="channel-hero">
            <div className="card-avatar xl">{(selected.channel_title || '?')[0].toUpperCase()}</div>
            <div>
              <h2>{selected.channel_title}</h2>
              <p>{channelVideos.length} video{channelVideos.length !== 1 ? 's' : ''} in your queue · watching since {new Date(selected.added_at).toLocaleDateString()}</p>
            </div>
            <button className="pill danger" onClick={() => onDeleteChannel(selected, () => setSelected(null))}>Stop watching</button>
          </div>
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
                  {...cardHandlers}
                />
              ))}
            </div>
          )}
      </div>
    )
  }

  return (
    <div className="channels-page">
      <h2 className="page-title"><ChannelsIcon size={22} /> Watched channels</h2>
      <div className="add-channel">
        <input
          placeholder="Channel link or @handle"
          value={input}
          autoComplete="off"
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
        />
        <button className="cta" disabled={adding || !input.trim()} onClick={submit}>
          {adding ? 'Adding…' : 'Watch'}
        </button>
      </div>
      <p className="page-hint">New uploads from watched channels land in your queue automatically, checked every 30 minutes.</p>
      {channels.length === 0
        ? <div className="empty-state slim"><h2>Not watching any channels</h2><p>Add one above and its uploads will show up on their own.</p></div>
        : (
          <div className="channel-list">
            {channels.map((c) => (
              <button key={c.channel_id} className="channel-row" onClick={() => setSelected(c)}>
                <div className="card-avatar lg">{(c.channel_title || '?')[0].toUpperCase()}</div>
                <div className="channel-row-info">
                  <strong>{c.channel_title || c.channel_id}</strong>
                  <span>{counts[c.channel_id] || 0} video{(counts[c.channel_id] || 0) !== 1 ? 's' : ''} in queue · added {timeAgo(c.added_at)}</span>
                </div>
                <span className="chev">›</span>
              </button>
            ))}
          </div>
        )}
    </div>
  )
}
