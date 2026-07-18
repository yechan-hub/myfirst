import { useState, useEffect } from 'react'
import LadderGame from './LadderGame.jsx'
import MysteryGame from './MysteryGame.jsx'
import AmongUsGame from './AmongUsGame.jsx'
import React from 'react'

const GAMES = [
  { 
    id: 'mystery', 
    emoji: '🕵️', 
    title: '[MODULE 01] DEDUCTION SIM', 
    desc: '수사 메모Pass-by 로그와 용의자 알리바이를 교차 대조하여 지능범 모순 검거',
    sector: 'SOLAR / EARTH',
    threat: 'STABLE'
  },
  { 
    id: 'amongus', 
    emoji: '🚀', 
    title: '[MODULE 02] SPACECRAFT SCANNER', 
    desc: '시나리오 캠페인 모드 탑재: 시야 차단 생존, 밀실 살인 검거 및 은밀 임포스터 잠입',
    sector: 'ORION ARM',
    threat: 'CRITICAL'
  },
  { 
    id: 'ladder', 
    emoji: '🪜', 
    title: '[MODULE 03] LADDER ROUTER', 
    desc: '운명의 분기 경로 무작위 추적 및 동선 매핑 가동 시뮬레이터',
    sector: 'ALPHA CENTAURI',
    threat: 'LOW'
  },
]

export default function App() {
  const [game, setGame] = useState(null)
  const [timeStr, setTimeStr] = useState('')

  useEffect(() => {
    setTimeStr(new Date().toLocaleTimeString())
    const timer = setInterval(() => {
      setTimeStr(new Date().toLocaleTimeString())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  if (game) {
    return (
      <>
        <button className="hologram-back-btn" onClick={() => setGame(null)}>
          ← SYSTEMS RETURN
        </button>
        {game === 'ladder' ? (
          <LadderGame />
        ) : game === 'amongus' ? (
          <AmongUsGame />
        ) : (
          <MysteryGame />
        )}
      </>
    )
  }

  return (
    <div className="terminal-frame">
      {/* 🌌 Space Starfield Background */}
      <div className="terminal-stars" />
      <div className="terminal-nebula" />

      {/* 📺 Top Status Bar */}
      <div className="terminal-top-bar">
        <div className="top-bar-left">🛰️ SEC-7 // SHUTTLE CONTROL</div>
        <div className="top-bar-center">STARSHIP SYSTEMS CONSOLE</div>
        <div className="top-bar-right">SYSTEM ACTIVE: 99.8%</div>
      </div>

      {/* 🛸 Left/Right Panels for widescreen desktop, but responsive */}
      <div className="terminal-content-layout">
        {/* Left Radar HUD */}
        <div className="terminal-side-panel left">
          <div className="hud-panel-title">🛰️ RADAR DECK</div>
          <div className="hud-radar-circle">
            <div className="hud-radar-sweep" />
            <div className="hud-radar-blip" style={{ top: '30%', left: '40%' }} />
            <div className="hud-radar-blip critical" style={{ top: '65%', left: '75%' }} />
          </div>
          <div className="hud-panel-title" style={{ marginTop: '20px' }}>📟 SYSTEM LOGS</div>
          <div className="hud-system-logs">
            <div className="log-line">&gt; CORE BOOT SEQUENCE...</div>
            <div className="log-line">&gt; SCANNING FOR COLLISION...</div>
            <div className="log-line">&gt; LIFE SUPPORT: NOMINAL</div>
            <div className="log-line">&gt; ANTIGRAVITY CODES LOADED</div>
          </div>
        </div>

        {/* Center Main Console (Original Game Launcher Grid) */}
        <div className="terminal-main-deck">
          <header className="terminal-header">
            <h1>🛸 STARSHIP CONSOLE</h1>
            <p className="sub-label">SELECT TERMINAL MODULE TO EXECUTE</p>
          </header>

          <div className="game-menu">
            {GAMES.map((g) => (
              <button key={g.id} className={`game-card ${g.id}`} onClick={() => setGame(g.id)} style={{ borderStyle: 'solid', borderWidth: '1px' }}>
                <span className="game-emoji">{g.emoji}</span>
                <span className="game-title">{g.title}</span>
                <span className="game-desc">{g.desc}</span>
                <div className="game-card-meta">
                  <span>
                    <span>SECTOR:</span>
                    <strong>{g.sector}</strong>
                  </span>
                  <span>
                    <span>STATUS:</span>
                    <strong style={{ color: '#22c55e' }}>ONLINE</strong>
                  </span>
                  <span>
                    <span>THREAT LEVEL:</span>
                    <strong className="threat-val">{g.threat}</strong>
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Right Info HUD */}
        <div className="terminal-side-panel right">
          <div className="hud-panel-title">🛡️ SHIELD HARMONY</div>
          <div className="hud-gauge-container">
            <div className="hud-gauge-bar shield" />
            <span className="hud-gauge-label">SHIELD POWER: 92%</span>
          </div>
          <div className="hud-gauge-container">
            <div className="hud-gauge-bar hull" />
            <span className="hud-gauge-label">HULL INTEGRITY: 88%</span>
          </div>
          <div className="hud-gauge-container">
            <div className="hud-gauge-bar energy" />
            <span className="hud-gauge-label">REACTOR CORE: 64%</span>
          </div>

          <div className="hud-panel-title" style={{ marginTop: '20px' }}>🚀 SHIP ATTRIBUTES</div>
          <div className="hud-ship-attributes">
            <div>SHIP VELOCITY: 2,400 KPH</div>
            <div>SECTOR MAP: ORION ARM</div>
            <div>PRIMARY: PLASMA BLANCA II</div>
          </div>
        </div>
      </div>

      {/* 💳 Bottom Footer Bar */}
      <div className="terminal-footer-bar">
        <div className="footer-left">👤 CMDR. YECHAN // RANK: VETERAN</div>
        <div className="footer-center">💰 CREDITS: 75,340 ₵</div>
        <div className="footer-right">🕒 SHIP TIME: {timeStr}</div>
      </div>
    </div>
  )
}
