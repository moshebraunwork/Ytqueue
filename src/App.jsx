import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api, asArray } from './api.js'
import {
  isUnlocked, lockDevice, getLastAccount, setLastAccount,
  getWatched, markWatched, unmarkWatched,
  getProgressMap, saveProgress, takeLastSeen,
} from './storage.js'
import { ACCOUNTS } from './accounts.js'
import LockScreen from './components/LockScreen.jsx'
import Header from './components/Header.jsx'
import Player from './components/Player.jsx'
import { HomePage, ChannelsPage } from './components/Pages.jsx'
import { ChannelsIcon, HomeIcon, PlusIcon } from './components/Icons.jsx'

export default function App() {
  const [unlocked, setUnlocked] = useState(isUnlocked())
  const [account, setAccount] = useState(() => {
    const last = getLastAccount()
    return ACCOUNTS.includes(last) ? last : ACCOUNTS[0]
  })

  const [page, setPage] = useState('home')
  const [kind, setKind] = useState('all')
  const [search, setSearch] = useState('')

  const [videos, setVideos] = useState([])
  const [channels, setChannels] = useState([])
  const [videosLoading, setVideosLoading] = useState(true)
  const [channelsLoading, setChannelsLoading] = useState(true)
  const [videosError, setVideosError] = useState(null)
  const [channelsError, setChannelsError] = useState(null)
  const [refreshing, setRefreshing] = useState(false)

  const [watched, setWatched] = useState(() => getWatched(account))
  const [progress, setProgress] = useState(() => getProgressMap(account))
  const [newIds, setNewIds] = useState(new Set())
  const lastSeenRef = useRef(0)

  const [playing, setPlaying] = useState(null)
  const [playlistCtx, setPlaylistCtx] = useState([])
  const [addOpen, setAddOpen] = useState(false)
  const [confirm, setConfirm] = useState(null)
  const [toast, setToast] = useState(null)
  const [addingChannel, setAddingChannel] = useState(false)
  const [savingVideo, setSavingVideo] = useState(false)
  const [addVideoNote, setAddVideoNote] = useState(null)
  const toastTimer = useRef(null)

  const showToast = useCallback((msg) => {
    setToast(msg)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 2800)
  }, [])

  /* ---------- Data loading ---------- */
  const loadVideos = useCallback(async (acct = account) => {
    setVideosError(null)
    try {
      const data = asArray(await api.listVideos(acct)).filter((v) => v && v.video_id)
      setVideos(data)
      const prev = lastSeenRef.current
      setNewIds(new Set(
        data.filter((v) => prev > 0 && new Date(v.added_at).getTime() > prev).map((v) => v.video_id),
      ))
    } catch (e) {
      setVideosError(e.message)
    }
    setVideosLoading(false)
  }, [account])

  const loadChannels = useCallback(async (acct = account) => {
    setChannelsError(null)
    try {
      setChannels(asArray(await api.listChannels(acct)).filter((c) => c && c.channel_id))
    } catch (e) {
      setChannelsError(e.message)
    }
    setChannelsLoading(false)
  }, [account])

  useEffect(() => {
    if (!unlocked) return
    setVideosLoading(true)
    setChannelsLoading(true)
    lastSeenRef.current = takeLastSeen(account)
    setWatched(getWatched(account))
    setProgress(getProgressMap(account))
    loadVideos(account)
    loadChannels(account)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account, unlocked])

  /* ---------- Channel logo map (channel_id -> thumbnail_url) ---------- */
  const channelLogos = useMemo(() => {
    const m = {}
    channels.forEach((c) => {
      const logo = c.channel_thumbnail_url || c.thumbnail_url
      if (logo) m[c.channel_id] = logo
    })
    return m
  }, [channels])

  /* ---------- Pull-to-refresh (mobile) ---------- */
  const pull = useRef({ startY: 0, active: false })
  useEffect(() => {
    const onStart = (e) => {
      if (window.scrollY <= 0 && !playing && !addOpen && !confirm) {
        pull.current = { startY: e.touches[0].clientY, active: true }
      } else pull.current.active = false
    }
    const onMove = (e) => {
      if (!pull.current.active || refreshing) return
      const dy = e.touches[0].clientY - pull.current.startY
      if (dy > 90 && window.scrollY <= 0) {
        pull.current.active = false
        setRefreshing(true)
        Promise.all([loadVideos(), loadChannels()]).finally(() => {
          setRefreshing(false)
          showToast('Refreshed')
        })
      }
    }
    window.addEventListener('touchstart', onStart, { passive: true })
    window.addEventListener('touchmove', onMove, { passive: true })
    return () => {
      window.removeEventListener('touchstart', onStart)
      window.removeEventListener('touchmove', onMove)
    }
  }, [loadVideos, loadChannels, playing, addOpen, confirm, refreshing, showToast])

  /* ---------- Account ---------- */
  const switchAccount = (name) => {
    setAccount(name)
    setLastAccount(name)
    setPage('home')
    setSearch('')
    setPlaying(null)
    showToast(`Watching as ${name}`)
  }

  const lockNow = () => {
    lockDevice()
    setUnlocked(false)
    setPlaying(null)
  }

  /* ---------- Watched / progress ---------- */
  const handleWatched = useCallback((video) => {
    setWatched((prev) => {
      if (prev.has(video.video_id)) return prev
      return new Set(markWatched(account, video.video_id))
    })
  }, [account])

  const handleToggleWatched = useCallback((video) => {
    setWatched((prev) => (
      prev.has(video.video_id)
        ? new Set(unmarkWatched(account, video.video_id))
        : new Set(markWatched(account, video.video_id))
    ))
  }, [account])

  const handleProgress = useCallback((video, seconds, duration) => {
    saveProgress(account, video.video_id, seconds, duration)
    setProgress(getProgressMap(account))
  }, [account])

  /* ---------- Play ---------- */
  const playFromList = useCallback((video, list) => {
    setPlaylistCtx(list && list.length ? list : videos)
    setPlaying(video)
  }, [videos])

  /* ---------- Save video ---------- */
  const saveVideo = async (url) => {
    setSavingVideo(true)
    setAddVideoNote(null)
    try {
      const res = await api.saveVideo(url, account)
      setSavingVideo(false)
      if (res && res.note === 'already existed') {
        setAddVideoNote('Already in your queue.')
        return
      }
      setAddOpen(false)
      showToast('Saved to your queue')
      loadVideos()
    } catch (e) {
      setSavingVideo(false)
      setAddVideoNote(`Save failed: ${e.message}`)
    }
  }

  /* ---------- Delete video ---------- */
  const requestDeleteVideo = (video) => setConfirm({
    title: `Remove “${video.title || video.video_id}”?`,
    note: 'It comes off your queue only — nothing changes on YouTube.',
    action: async () => {
      try {
        await api.deleteVideo(video.video_id, account)
        showToast('Removed from queue')
        setPlaying((p) => (p?.video_id === video.video_id ? null : p))
        loadVideos()
      } catch (e) { showToast(`Remove failed: ${e.message}`) }
    },
  })

  /* ---------- Channels ---------- */
  const addChannel = async (url) => {
    setAddingChannel(true)
    try {
      const res = await api.addChannel(url, account)
      setAddingChannel(false)
      if (res && res.note === 'already watching this channel') showToast('Already watching that channel')
      else showToast('Watching — new uploads arrive within 30 minutes')
      loadChannels()
      return true
    } catch (e) {
      setAddingChannel(false)
      showToast(`Couldn't add channel: ${e.message}`)
      return false
    }
  }

  const requestDeleteChannel = (channel, after) => setConfirm({
    title: `Stop watching ${channel.channel_title || channel.channel_id}?`,
    note: 'Videos already saved from this channel stay in your queue.',
    action: async () => {
      try {
        await api.deleteChannel(channel.channel_id, account)
        showToast('Stopped watching')
        after?.()
        loadChannels()
      } catch (e) { showToast(`Failed: ${e.message}`) }
    },
  })

  const cardHandlers = useMemo(() => ({
    onDelete: requestDeleteVideo,
    onToggleWatched: handleToggleWatched,
    onToast: showToast,
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [handleToggleWatched, showToast, account])

  if (!unlocked) return <LockScreen onUnlock={() => setUnlocked(true)} />

  return (
    <div className="app">
      <Header
        account={account}
        onSwitchAccount={switchAccount}
        onLock={lockNow}
        search={search}
        onSearch={(v) => { setSearch(v); setPage('home') }}
        onLogoClick={() => { setPage('home'); setKind('all'); window.scrollTo(0, 0) }}
      />

      {refreshing && <div className="refresh-bar"><span className="spinner sm" /></div>}

      {/* Desktop sidebar */}
      <nav className="sidebar">
        <button className={`side-item ${page === 'home' ? 'active' : ''}`} onClick={() => setPage('home')}>
          <HomeIcon size={22} /><span>Home</span>
        </button>
        <button className={`side-item ${page === 'channels' ? 'active' : ''}`} onClick={() => setPage('channels')}>
          <ChannelsIcon size={22} /><span>Channels</span>
        </button>
        <button className="side-item add" onClick={() => { setAddVideoNote(null); setAddOpen(true) }}>
          <PlusIcon size={22} /><span>Save</span>
        </button>
      </nav>

      <main className="main">
        {page === 'home' && (
          <HomePage
            videos={videos}
            loading={videosLoading}
            error={videosError}
            onRetry={() => { setVideosLoading(true); loadVideos() }}
            search={search}
            watched={watched}
            newIds={newIds}
            progress={progress}
            channelLogos={channelLogos}
            cardHandlers={cardHandlers}
            onAddVideo={() => setAddOpen(true)}
            kind={kind}
            setKind={setKind}
            onPlayList={playFromList}
          />
        )}
        {page === 'channels' && (
          <ChannelsPage
            channels={channels}
            videos={videos}
            loading={channelsLoading || videosLoading}
            error={channelsError}
            onRetry={() => { setChannelsLoading(true); loadChannels(); loadVideos() }}
            watched={watched}
            newIds={newIds}
            progress={progress}
            channelLogos={channelLogos}
            cardHandlers={cardHandlers}
            onAddChannel={addChannel}
            onDeleteChannel={requestDeleteChannel}
            adding={addingChannel}
            onPlayList={playFromList}
          />
        )}
      </main>

      {/* Mobile bottom nav */}
      <nav className="bottomnav">
        <button className={page === 'home' ? 'active' : ''} onClick={() => { setPage('home'); window.scrollTo(0, 0) }}>
          <span className="nav-pill"><HomeIcon size={28} /></span>
          <span>Home</span>
        </button>
        <button onClick={() => { setAddVideoNote(null); setAddOpen(true) }}>
          <span className="nav-pill accent"><PlusIcon size={28} /></span>
          <span>Save</span>
        </button>
        <button className={page === 'channels' ? 'active' : ''} onClick={() => { setPage('channels'); window.scrollTo(0, 0) }}>
          <span className="nav-pill"><ChannelsIcon size={28} /></span>
          <span>Channels</span>
        </button>
      </nav>

      {/* Player */}
      {playing && (
        <Player
          video={playing}
          playlist={playlistCtx}
          startAt={progress[playing.video_id] || 0}
          channelLogo={channelLogos[playing.channel_id]}
          watched={watched}
          onToggleWatched={handleToggleWatched}
          onClose={() => setPlaying(null)}
          onNavigate={(v) => setPlaying(v)}
          onProgress={handleProgress}
          onWatched={handleWatched}
          onDelete={requestDeleteVideo}
          onToast={showToast}
        />
      )}

      {/* Add video modal */}
      {addOpen && (
        <AddVideoModal
          saving={savingVideo}
          note={addVideoNote}
          onSave={saveVideo}
          onClose={() => setAddOpen(false)}
        />
      )}

      {/* Confirm modal */}
      {confirm && (
        <div className="overlay" onClick={(e) => e.target === e.currentTarget && setConfirm(null)}>
          <div className="dialog">
            <h3>{confirm.title}</h3>
            <p className="dialog-note">{confirm.note}</p>
            <div className="dialog-actions">
              <button className="flat" onClick={() => setConfirm(null)}>Cancel</button>
              <button className="flat destructive" onClick={() => { const a = confirm.action; setConfirm(null); a() }}>Remove</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}

function AddVideoModal({ saving, note, onSave, onClose }) {
  const [url, setUrl] = useState('')
  const inputRef = useRef(null)
  useEffect(() => { inputRef.current?.focus() }, [])
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dialog">
        <h3>Save a video</h3>
        <input
          ref={inputRef}
          className="dialog-input"
          placeholder="Paste a YouTube link"
          value={url}
          autoComplete="off"
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && url.trim() && onSave(url.trim())}
        />
        <p className={`dialog-note ${note?.startsWith('Save failed') ? 'err' : ''}`}>{saving ? 'Saving…' : note}</p>
        <div className="dialog-actions">
          <button className="flat" onClick={onClose}>Cancel</button>
          <button className="flat primary" disabled={saving || !url.trim()} onClick={() => onSave(url.trim())}>Save</button>
        </div>
      </div>
    </div>
  )
}
