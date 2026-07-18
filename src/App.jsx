import { useState } from 'react'
import LadderGame from './LadderGame.jsx'
import MysteryGame from './MysteryGame.jsx'
import AmongUsGame from './AmongUsGame.jsx'
import React from 'react'

const GAMES = [
  { 
    id: 'mystery', 
    emoji: '🕵️', 
    title: '명탐정 추리 게임', 
    desc: '용의자의 알리바이 진술과 내 목격 로그를 교차 분석하여 모순을 품은 진짜 범인을 색출하세요.',
    sub: '난이도: ⭐⭐'
  },
  { 
    id: 'amongus', 
    emoji: '🚀', 
    title: '어몽어스 우주선 게임', 
    desc: '싱글 시나리오 미션 탑재! 목격자 봇의 비상벨 도주를 차단하고 회의실 투표에서 승리하세요.',
    sub: '난이도: ⭐⭐⭐'
  },
  { 
    id: 'ladder', 
    emoji: '🪜', 
    title: '사다리 타기 게임', 
    desc: '운명을 결정하는 직관적인 무작위 사다리 경로 타기 시뮬레이터입니다.',
    sub: '난이도: ⭐'
  },
]

export default function App() {
  const [game, setGame] = useState(null)

  if (game) {
    return (
      <>
        <button className="hologram-back-btn" onClick={() => setGame(null)}>
          ← 메인 화면으로 복귀
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

      <div className="terminal-main-deck" style={{ padding: '40px 20px', maxWidth: '800px', width: '100%', margin: '0 auto' }}>
        <header className="terminal-header" style={{ marginBottom: '30px' }}>
          <h1 style={{ fontSize: '28px', fontWeight: '900', letterSpacing: '1px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
            <span>🚀</span> 우주선 제어 단말기
          </h1>
          <p className="sub-label" style={{ color: '#60a5fa', fontWeight: 'bold', fontSize: '12px', marginTop: '8px', letterSpacing: '0.5px' }}>
            가동할 미니게임 시스템 모듈을 가볍게 선택해 주세요.
          </p>
        </header>

        <div className="game-menu">
          {GAMES.map((g) => (
            <button key={g.id} className={`game-card ${g.id}`} onClick={() => setGame(g.id)} style={{ borderStyle: 'solid', borderWidth: '1px' }}>
              <span className="game-emoji">{g.emoji}</span>
              <span className="game-title" style={{ fontSize: '17px', fontWeight: '800', marginTop: '5px' }}>{g.title}</span>
              <span className="game-desc" style={{ color: '#94a3b8', fontSize: '11px', lineHeight: '1.5', marginTop: '8px' }}>{g.desc}</span>
              <div className="game-card-meta">
                <span>
                  <span>시스템 권장:</span>
                  <strong>{g.sub}</strong>
                </span>
                <span>
                  <span>가동 상태:</span>
                  <strong style={{ color: '#22c55e' }}>ONLINE</strong>
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
