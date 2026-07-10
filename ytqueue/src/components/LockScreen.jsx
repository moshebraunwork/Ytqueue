import { useEffect, useState } from 'react'
import { LockIcon, LogoIcon } from './Icons.jsx'
import { markUnlocked } from '../storage.js'

const PIN = String(import.meta.env.VITE_APP_PIN || '').trim()

export default function LockScreen({ onUnlock }) {
  const [digits, setDigits] = useState('')
  const [shake, setShake] = useState(false)

  useEffect(() => {
    if (digits.length < 4) return
    if (digits === PIN) {
      markUnlocked()
      onUnlock()
    } else {
      setShake(true)
      if (navigator.vibrate) navigator.vibrate(120)
      setTimeout(() => { setDigits(''); setShake(false) }, 450)
    }
  }, [digits, onUnlock])

  useEffect(() => {
    const onKey = (e) => {
      if (/^\d$/.test(e.key)) setDigits((d) => (d.length < 4 ? d + e.key : d))
      if (e.key === 'Backspace') setDigits((d) => d.slice(0, -1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const press = (n) => setDigits((d) => (d.length < 4 ? d + n : d))

  return (
    <div className="lockscreen">
      <div className="lock-brand"><LogoIcon size={36} /> YT Queue</div>
      <div className="lock-icon"><LockIcon size={26} /></div>
      <p className="lock-title">Enter PIN</p>
      <div className={`pin-dots ${shake ? 'shake' : ''}`}>
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={`pin-dot ${i < digits.length ? 'filled' : ''}`} />
        ))}
      </div>
      <div className="pin-pad">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
          <button key={n} className="pin-key" onClick={() => press(String(n))}>{n}</button>
        ))}
        <span />
        <button className="pin-key" onClick={() => press('0')}>0</button>
        <button className="pin-key pin-del" onClick={() => setDigits((d) => d.slice(0, -1))}>⌫</button>
      </div>
      <p className="lock-hint">This device stays unlocked for a week.</p>
    </div>
  )
}
