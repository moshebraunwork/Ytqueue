import { useEffect, useRef, useState } from 'react'
import { AddVideoIcon, CheckIcon, LockIcon, LogoIcon, SearchIcon } from './Icons.jsx'
import { ACCOUNTS, accountColor } from '../accounts.js'

export default function Header({ account, onSwitchAccount, onLock, search, onSearch, onAddVideo, onLogoClick }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    if (!menuOpen) return
    const onDown = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [menuOpen])

  return (
    <header className="header">
      <button className="brand" onClick={onLogoClick} aria-label="Home">
        <LogoIcon /> <span className="brand-name">YT&nbsp;Queue</span>
      </button>

      <div className="search">
        <SearchIcon size={18} className="search-icon" />
        <input
          type="search"
          placeholder="Search your queue"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          autoComplete="off"
        />
      </div>

      <button className="icon-btn" aria-label="Save a video" onClick={onAddVideo}>
        <AddVideoIcon size={22} />
      </button>

      <div className="account-wrap" ref={menuRef}>
        <button
          className="avatar"
          style={{ background: accountColor(account) }}
          onClick={() => setMenuOpen((o) => !o)}
          aria-label="Account menu"
        >
          {account[0]}
        </button>
        {menuOpen && (
          <div className="account-menu">
            <div className="account-menu-label">Watching as</div>
            {ACCOUNTS.map((name) => (
              <button
                key={name}
                className="account-item"
                onClick={() => { setMenuOpen(false); if (name !== account) onSwitchAccount(name) }}
              >
                <span className="avatar sm" style={{ background: accountColor(name) }}>{name[0]}</span>
                <span className="account-item-name">{name}</span>
                {name === account && <CheckIcon size={18} className="account-check" />}
              </button>
            ))}
            <div className="account-menu-sep" />
            <button className="account-item" onClick={() => { setMenuOpen(false); onLock() }}>
              <span className="account-item-icon"><LockIcon size={18} /></span>
              <span className="account-item-name">Lock this device</span>
            </button>
          </div>
        )}
      </div>
    </header>
  )
}
