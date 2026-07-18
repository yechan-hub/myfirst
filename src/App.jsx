import { useState } from 'react'
import LadderGame from './LadderGame.jsx'
import MysteryGame from './MysteryGame.jsx'
import AmongUsGame from './AmongUsGame.jsx'

const GAMES = [
  { id: 'mystery', emoji: '🕵️', title: '명탐정 추리 게임', desc: '단서를 모아 범인을 찾아라!' },
  { id: 'amongus', emoji: '🚀', title: '어몽어스 우주선 게임', desc: '선원 속에 숨은 임포스터를 찾아라!' },
  { id: 'ladder', emoji: '🪜', title: '사다리 게임', desc: '운명의 사다리 타기' },
]

export default function App() {
  const [game, setGame] = useState(null)

  if (game) {
    return (
      <>
        <button className="btn back-btn" onClick={() => setGame(null)}>
          ← 게임 목록
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
    <div className="app">
      <header>
        <h1>🎮 미니게임</h1>
        <p className="sub">오늘은 뭐 하고 놀까?</p>
      </header>
      <div className="game-menu">
        {GAMES.map((g) => (
          <button key={g.id} className="game-card" onClick={() => setGame(g.id)}>
            <span className="game-emoji">{g.emoji}</span>
            <span className="game-title">{g.title}</span>
            <span className="game-desc">{g.desc}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
