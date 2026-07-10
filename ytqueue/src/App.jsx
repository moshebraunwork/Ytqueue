import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api, asArray } from './api.js'
import {
  isUnlocked, lockDevice, getLastAccount, setLastAccount,
  getWatched, markWatched, unmarkWatched,
  getProgressMap, saveProgress, takeLastSeen,
} from './storage.js'
import { ACCOUNTS, accountColor } from './accounts.js'
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

  const [watched, setWatched] = useState(() => getWatched(account))
  const [progress, setProgress] = useState(() => getProgressMap(account))
  const [newIds, setNewIds] = useState(new Set())
  const lastSeenRef = useRef(0)

  const [playing, setPlaying] = useState(null) // video object
  const [playlistCtx, setPlaylistCtx] = useState([])
  const [addOpen, setAddOpen] = useState(false)
  const [confirm, setConfirm] = useState(null) // {title, note, action}
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
    setVideosLoading(true)
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
    setChannelsLoading(true)
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
    lastSeenRef.current = takeLastSeen(account)
    setWatched(getWatched(account))
    setProgress(getProgressMap(account))
    loadVideos(account)
    loadChannels(account)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account, unlocked])

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
    setWatched((prev) => {
      const next = prev.has(video.video_id)
        ? new Set(unmarkWatched(account, video.video_id))
        : new Set(markWatched(account, video.video_id))
      return next
    })
  }, [account])

  const handleProgress = useCallback((video, seconds, duration) => {
    saveProgress(account, video.video_id, seconds, duration)
    setProgress(getProgressMap(account))
  }, [account])

  /* ---------- Play ---------- */
  const playVideo = useCallback((video, list) => {
    setPlaylistCtx(list || videos)
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
        if (playing?.video_id === video.video_id) setPlaying(null)
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
    onPlay: (v) => playVideo(v),
    onDelete: requestDeleteVideo,
    onToggleWatched: handleToggleWatched,
    onToast: showToast,
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [playVideo, handleToggleWatched, showToast, account, playing])

  if (!unlocked) return <LockScreen onUnlock={() => setUnlocked(true)} />

  return (
    <div className="app">
      <Header
        account={account}
        onSwitchAccount={switchAccount}
        onLock={lockNow}
        search={search}
        onSearch={(v) => { setSearch(v); setPage('home') }}
        onAddVideo={() => { setAddVideoNote(null); setAddOpen(true) }}
        onLogoClick={() => { setPage('home'); setKind('all'); window.scrollTo(0, 0) }}
      />

      {/* Desktop sidebar */}
      <nav className="sidebar">
        <button className={`side-item ${page === 'home' ? 'active' : ''}`} onClick={() => setPage('home')}>
          <HomeIcon size={22} /><span>Home</span>
        </button>
        <button className={`side-item ${page === 'channels' ? 'active' : ''}`} onClick={() => setPage('channels')}>
          <ChannelsIcon size={22} /><span>Channels</span>
        </button>
      </nav>

      <main className="main">
        {page === 'home' && (
          <HomePage
            videos={videos}
            loading={videosLoading}
            error={videosError}
            onRetry={() => loadVideos()}
            search={search}
            watched={watched}
            newIds={newIds}
            progress={progress}
            cardHandlers={cardHandlers}
            onAddVideo={() => setAddOpen(true)}
            kind={kind}
            setKind={setKind}
          />
        )}
        {page === 'channels' && (
          <ChannelsPage
            channels={channels}
            videos={videos}
            loading={channelsLoading || videosLoading}
            error={channelsError}
            onRetry={() => { loadChannels(); loadVideos() }}
            watched={watched}
            newIds={newIds}
            progress={progress}
            cardHandlers={cardHandlers}
            onAddChannel={addChannel}
            onDeleteChannel={requestDeleteChannel}
            adding={addingChannel}
          />
        )}
      </main>

      {/* Mobile bottom nav */}
      <nav className="bottomnav">
        <button className={page === 'home' ? 'active' : ''} onClick={() => { setPage('home'); window.scrollTo(0, 0) }}>
          <HomeIcon size={24} /><span>Home</span>
        </button>
        <button className="fab" onClick={() => { setAddVideoNote(null); setAddOpen(true) }} aria-label="Save a video">
          <PlusIcon size={26} />
        </button>
        <button className={page === 'channels' ? 'active' : ''} onClick={() => { setPage('channels'); window.scrollTo(0, 0) }}>
          <ChannelsIcon size={24} /><span>Channels</span>
        </button>
      </nav>

      {/* Player */}
      {playing && (
        <Player
          video={playing}
          playlist={playlistCtx}
          startAt={progress[playing.video_id] || 0}
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
