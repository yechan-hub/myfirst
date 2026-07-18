import { useEffect, useMemo, useRef, useState } from 'react'
import { makeLadder, tracePath } from './ladder.js'
import { unlockAudio, playGun, playWhip, playChance, playWin } from './sounds.js'

const CHARACTERS = [
  { emoji: '🦊', name: '여우', color: '#ff7a45' },
  { emoji: '🐸', name: '개구리', color: '#52c41a' },
  { emoji: '🐼', name: '판다', color: '#5c6b7a' },
  { emoji: '🦖', name: '공룡', color: '#13c2c2' },
  { emoji: '🐙', name: '문어', color: '#eb2f96' },
  { emoji: '🦄', name: '유니콘', color: '#9254de' },
]

const DEFAULT_NAMES = CHARACTERS.map((c) => c.name)
const DEFAULT_RESULTS = ['꽝', '당첨 🎁', '꽝', '커피 ☕', '꽝', '청소 🧹']

const LEVELS = 9 // 가로 발판 층 수
const W = 720
const H = 520
const PAD_X = 70
const LADDER_TOP = 120
const LADDER_BOTTOM = 400
const SPEED = 250 // px/초

export default function LadderGame() {
  const [numPlayers, setNumPlayers] = useState(4)
  const [names, setNames] = useState(DEFAULT_NAMES.slice(0, 4))
  const [results, setResults] = useState(DEFAULT_RESULTS.slice(0, 4))
  const [rungs, setRungs] = useState(() => makeLadder(4, LEVELS))
  const [chanceMode, setChanceMode] = useState('ask') // 'off' | 'auto' | 'ask'
  const [revealed, setRevealed] = useState({}) // startCol -> endCol
  const [traces, setTraces] = useState([]) // [{points, color}] 완료된 경로만 표시
  const [animating, setAnimating] = useState(false)
  const [token, setToken] = useState(null) // 움직이는 토큰
  const [drawn, setDrawn] = useState(null) // 진행 중 경로 {pts, color}
  const [chanceMark, setChanceMark] = useState(null) // {x, y}
  const [prompt, setPrompt] = useState(null) // {decide, remainingCount}
  const [viewBox, setViewBox] = useState({ x: 0, y: 0, w: W, h: H })
  const [activeCol, setActiveCol] = useState(null)
  const [screenMode, setScreenMode] = useState('playing') // 'playing' | 'result'
  const [copied, setCopied] = useState(false)
  const rafRef = useRef(0)

  // 게임 시작 여부: 시작되면 이름/결과/설정 잠금 (공정성)
  const started = animating || Object.keys(revealed).length > 0

  // 좌표 헬퍼
  const colGap = (W - 2 * PAD_X) / (numPlayers - 1)
  const x = (c) => PAD_X + c * colGap
  const levelY = (l) =>
    LADDER_TOP + ((l + 1) * (LADDER_BOTTOM - LADDER_TOP)) / (LEVELS + 1)

  function reset(n = numPlayers) {
    cancelAnimationFrame(rafRef.current)
    setRungs(makeLadder(n, LEVELS))
    setRevealed({})
    setTraces([])
    setToken(null)
    setDrawn(null)
    setChanceMark(null)
    setPrompt(null)
    setAnimating(false)
    setViewBox({ x: 0, y: 0, w: W, h: H })
    setActiveCol(null)
    setScreenMode('playing')
  }

  function changePlayers(n) {
    setNumPlayers(n)
    setNames((prev) => {
      const next = prev.slice(0, n)
      while (next.length < n) next.push(DEFAULT_NAMES[next.length] ?? `참가자${next.length + 1}`)
      return next
    })
    setResults((prev) => {
      const next = prev.slice(0, n)
      while (next.length < n) next.push(DEFAULT_RESULTS[next.length] ?? '꽝')
      return next
    })
    reset(n)
  }

  function shuffleResults() {
    setResults((prev) => {
      const a = [...prev]
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[a[i], a[j]] = [a[j], a[i]]
      }
      return a
    })
  }

  // ---- 경로(픽셀 폴리라인) 빌더들 ----
  function buildFull(steps) {
    const pts = [{ x: x(steps[0].col), y: LADDER_TOP }]
    let prevCol = steps[0].col
    for (let i = 1; i < steps.length; i++) {
      const s = steps[i]
      if (s.level === LEVELS) {
        pts.push({ x: x(s.col), y: LADDER_BOTTOM })
      } else {
        const ly = levelY(s.level)
        if (s.dir) {
          pts.push({ x: x(prevCol), y: ly })
          pts.push({ x: x(s.col), y: ly })
        } else {
          pts.push({ x: x(s.col), y: ly })
        }
      }
      prevCol = s.col
    }
    return { pts, endCol: steps[steps.length - 1].col }
  }

  function buildPhase1(steps, gate) {
    const pts = [{ x: x(steps[0].col), y: LADDER_TOP }]
    let prevCol = steps[0].col
    for (let i = 1; i <= gate + 1; i++) {
      const s = steps[i]
      const ly = levelY(s.level)
      if (s.dir) {
        pts.push({ x: x(prevCol), y: ly })
        pts.push({ x: x(s.col), y: ly })
      } else {
        pts.push({ x: x(s.col), y: ly })
      }
      prevCol = s.col
    }
    return { pts, colAtGate: prevCol }
  }

  // 게이트에서 그대로 사다리를 따라 끝까지
  function buildTail(steps, gate) {
    const gateCol = steps[gate + 1].col
    const pts = [{ x: x(gateCol), y: levelY(gate) }]
    let prevCol = gateCol
    for (let i = gate + 2; i <= LEVELS; i++) {
      const s = steps[i]
      const ly = levelY(s.level)
      if (s.dir) {
        pts.push({ x: x(prevCol), y: ly })
        pts.push({ x: x(s.col), y: ly })
      } else {
        pts.push({ x: x(s.col), y: ly })
      }
      prevCol = s.col
    }
    pts.push({ x: x(prevCol), y: LADDER_BOTTOM })
    return { pts, endCol: prevCol }
  }

  // 게이트에서 target 칸으로 슬라이드 후 낙하
  function buildSlideDrop(colAtGate, gate, target) {
    const pts = [{ x: x(colAtGate), y: levelY(gate) }]
    if (target !== colAtGate) pts.push({ x: x(target), y: levelY(gate) })
    pts.push({ x: x(target), y: LADDER_BOTTOM })
    return pts
  }

  // startCol 참가자가 사다리를 탐
  function play(startCol) {
    if (animating || revealed[startCol] !== undefined) return
    unlockAudio()
    const char = CHARACTERS[startCol]
    const { steps } = tracePath(rungs, startCol, numPlayers, LEVELS)
    const claimed = new Set(Object.values(revealed))
    const mode = chanceMode

    let committed = [] // 지금까지 확정된 경로 점들

    setAnimating(true)
    setChanceMark(null)
    setPrompt(null)
    setToken({ x: x(startCol), y: LADDER_TOP, emoji: char.emoji, color: char.color })
    playGun() // 🔫 출발

    // 한 구간(phase)을 애니메이션. opts.chanceSlide=true면 첫 세그먼트는 채찍음 생략
    const animatePhase = (pts, opts, onDone) => {
      if (pts.length < 2) {
        onDone()
        return
      }
      const seg = []
      let total = 0
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1]
        const b = pts[i]
        const len = Math.hypot(b.x - a.x, b.y - a.y)
        const horizontal = Math.abs(b.y - a.y) < 0.5 && Math.abs(b.x - a.x) > 0.5
        seg.push({ start: total, len, horizontal, from: a, to: b, isSlide: opts.chanceSlide && i === 1 })
        total += len
      }
      const duration = Math.max((total / SPEED) * 1000, 60)
      const t0 = performance.now()
      let lastSeg = -1

      const frame = (now) => {
        const p = Math.min(1, (now - t0) / duration)
        const dist = p * total
        let si = seg.length - 1
        for (let i = 0; i < seg.length; i++) {
          if (dist <= seg[i].start + seg[i].len) {
            si = i
            break
          }
        }
        const s = seg[si]
        const local = Math.max(0, Math.min(1, (dist - s.start) / (s.len || 1)))
        const cx = s.from.x + (s.to.x - s.from.x) * local
        const cy = s.from.y + (s.to.y - s.from.y) * local
        let passed = 0
        for (let k = 0; k < seg.length; k++) {
          if (seg[k].start + seg[k].len <= dist) passed = k + 1
          else break
        }
        if (si !== lastSeg) {
          if (s.horizontal && !s.isSlide) playWhip() // 🎇
          lastSeg = si
        }
        setToken({ x: cx, y: cy, emoji: char.emoji, color: char.color })
        setDrawn({ pts: committed.concat(pts.slice(0, passed + 1), [{ x: cx, y: cy }]), color: char.color })

        // 🎥 Smoothly pan and zoom camera viewBox centered on the active token
        const targetW = 360
        const targetH = 360
        const targetX = Math.max(0, Math.min(W - targetW, cx - targetW / 2))
        const targetY = Math.max(0, Math.min(H - targetH, cy - targetH / 2))
        setViewBox((prev) => ({
          x: prev.x + (targetX - prev.x) * 0.1,
          y: prev.y + (targetY - prev.y) * 0.1,
          w: prev.w + (targetW - prev.w) * 0.1,
          h: prev.h + (targetH - prev.h) * 0.1,
        }))

        // 📊 Predict and update the active column index in real-time
        const colIndex = Math.round((cx - PAD_X) / colGap)
        setActiveCol((prev) => (prev !== colIndex ? colIndex : prev))

        if (p < 1) rafRef.current = requestAnimationFrame(frame)
        else onDone()
      }
      rafRef.current = requestAnimationFrame(frame)
    }

    const finishRun = (endCol, fullPts) => {
      setToken(null)
      setDrawn(null)
      setChanceMark(null)
      setTraces((t) => [...t, { points: fullPts, color: char.color }])
      setRevealed((r) => {
        const next = { ...r, [startCol]: endCol }
        if (Object.keys(next).length === numPlayers) {
          setTimeout(() => {
            setScreenMode('result')
          }, 1000)
        }
        return next
      })
      setAnimating(false)
      setViewBox({ x: 0, y: 0, w: W, h: H })
      setActiveCol(null)
      playWin() // 🎉
    }

    // 고전 모드: 사다리 전체
    if (mode === 'off') {
      const { pts, endCol } = buildFull(steps)
      animatePhase(pts, {}, () => {
        committed = committed.concat(pts)
        finishRun(endCol, committed)
      })
      return
    }

    // 찬스 모드: 게이트까지 내려간 뒤 결정
    const lo = Math.max(1, Math.floor(LEVELS * 0.35))
    const hi = Math.min(LEVELS - 1, Math.floor(LEVELS * 0.72))
    const gate = lo + Math.floor(Math.random() * (hi - lo + 1))
    const { pts: p1, colAtGate } = buildPhase1(steps, gate)

    animatePhase(p1, {}, () => {
      committed = committed.concat(p1)
      const gp = p1[p1.length - 1]
      setChanceMark({ x: gp.x, y: gp.y })
      const remaining = []
      for (let c = 0; c < numPlayers; c++) if (!claimed.has(c)) remaining.push(c)

      const decide = (take) => {
        setPrompt(null)
        let phase2
        let endCol
        let chanceSlide = false
        if (take) {
          const target = remaining[Math.floor(Math.random() * remaining.length)]
          phase2 = buildSlideDrop(colAtGate, gate, target)
          endCol = target
          chanceSlide = target !== colAtGate
          playChance() // 🎲
          setChanceMark(null)
        } else {
          const laddered = steps[steps.length - 1].col
          if (!claimed.has(laddered)) {
            const tail = buildTail(steps, gate)
            phase2 = tail.pts
            endCol = tail.endCol
            setChanceMark(null)
          } else {
            // 원래 칸을 앞사람이 이미 가져감 → 남은 것 중 랜덤 (겹침 방지)
            const target = remaining[Math.floor(Math.random() * remaining.length)]
            phase2 = buildSlideDrop(colAtGate, gate, target)
            endCol = target
            chanceSlide = target !== colAtGate
            playChance()
            setChanceMark(null)
          }
        }
        animatePhase(phase2, { chanceSlide }, () => {
          committed = committed.concat(phase2)
          finishRun(endCol, committed)
        })
      }

      // 남은 결과가 하나뿐이면 물어볼 필요 없이 자동 진행
      if (remaining.length <= 1) decide(false)
      else if (mode === 'auto') decide(true)
      else setPrompt({ decide, remainingCount: remaining.length }) // 'ask'
    })
  }

  const copyToClipboard = () => {
    const text = Object.entries(revealed)
      .map(([sc, ec]) => `${CHARACTERS[sc].emoji} ${names[sc]} → ${results[ec]}`)
      .join('\n')
    const fullText = `🪜 사다리 게임 결과 🪜\n\n${text}`
    navigator.clipboard.writeText(fullText).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }).catch(() => {
      const textArea = document.createElement("textarea")
      textArea.value = fullText
      textArea.style.position = "fixed"
      textArea.style.left = "-999999px"
      textArea.style.top = "-999999px"
      document.body.appendChild(textArea)
      textArea.focus()
      textArea.select()
      try {
        document.execCommand('copy')
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      } catch (err) {
        console.error("Fallback: Copying failed", err)
      }
      document.body.removeChild(textArea)
    })
  }

  useEffect(() => () => cancelAnimationFrame(rafRef.current), [])

  // 세로줄(레인) — 사다리 칸은 숨김
  const rails = useMemo(
    () =>
      Array.from({ length: numPlayers }, (_, c) => (
        <line key={c} x1={x(c)} y1={LADDER_TOP} x2={x(c)} y2={LADDER_BOTTOM} className="rail" />
      )),
    [numPlayers, colGap]
  )

  const ptStr = (pts) => pts.map((p) => `${p.x},${p.y}`).join(' ')

  // Celebrating results overlay screen view
  const resultOverlay = screenMode === 'result' && (
    <div className="prompt-overlay">
      <div className="confetti-container">
        {Array.from({ length: 30 }).map((_, i) => (
          <div key={i} className={`confetti-piece p${i}`} />
        ))}
      </div>

      <div className="result-card">
        <div className="result-icon-main">🏆</div>
        <h2>FINAL RESULTS</h2>
        <div className="result-list">
          {Object.entries(revealed).map(([sc, ec]) => (
            <div key={sc} className="result-item">
              <div className="result-player">
                <span className="res-emoji">{CHARACTERS[sc].emoji}</span>
                <span className="res-name">{names[sc]}</span>
              </div>
              <div className="res-arrow">→</div>
              <div className="result-outcome">
                <span className="res-text">{results[ec]}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="result-actions">
          <button className="btn copy-results-btn" onClick={copyToClipboard}>
            {copied ? '✅ 복사 완료!' : '📋 결과 복사'}
          </button>
          <button className="btn play-again-btn" onClick={() => { reset(); setScreenMode('playing'); }}>
            CLOSE
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="app unified-dashboard">
      <header className="dashboard-header">
        <div className="logo-area">
          <div className="logo-icon">L</div>
          <div className="logo-text">
            <span className="logo-main">LADDER</span>
            <span className="logo-sub">GAME</span>
          </div>
        </div>

        {/* Hero Avatars Section */}
        <div className="hero-avatars-row">
          {Array.from({ length: numPlayers }).map((_, c) => {
            const char = CHARACTERS[c]
            return (
              <div key={c} className="hero-avatar-chip">
                <div className="avatar-circle" style={{ borderColor: char.color, boxShadow: `0 0 15px ${char.color}33` }}>
                  <span className="avatar-emoji">{char.emoji}</span>
                </div>
                <span className="avatar-name" style={{ color: char.color }}>{names[c]}</span>
              </div>
            )
          })}
        </div>
      </header>

      {/* GAME SETUP TITLE */}
      <h2 className="setup-title-main">GAME SETUP</h2>

      {/* PLAYER CONFIGURATION CARD */}
      <div className="setup-card-unified">
        <div className="setup-header-row">
          <span className="setup-section-cyan">PLAYER NAMES</span>
          <div className="setup-controls-inline">
            <div className="control-group">
              <span className="control-label">Players:</span>
              <div className="mini-chip-group">
                {[2, 3, 4, 5, 6].map((n) => (
                  <button
                    key={n}
                    className={n === numPlayers ? 'mini-chip active' : 'mini-chip'}
                    onClick={() => changePlayers(n)}
                    disabled={started}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
            <div className="control-group">
              <span className="control-label">Gate:</span>
              <div className="mini-chip-group">
                {[
                  ['off', '끔'],
                  ['auto', '자동'],
                  ['ask', '선택'],
                ].map(([val, label]) => (
                  <button
                    key={val}
                    className={val === chanceMode ? 'mini-chip active' : 'mini-chip'}
                    onClick={() => setChanceMode(val)}
                    disabled={started}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Card-style inputs matching design note exactly */}
        <div className="editor-grid-cards">
          {names.map((nm, i) => (
            <div key={i} className="player-name-card">
              <span className="card-player-label">Player {i + 1} {i === 0 ? "(You)" : ""}</span>
              <div className="card-input-box">
                <span className="name-emoji">{CHARACTERS[i].emoji}</span>
                <input
                  value={nm}
                  disabled={started}
                  maxLength={8}
                  onChange={(e) => setNames((prev) => prev.map((v, idx) => (idx === i ? e.target.value : v)))}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Results input fields */}
        <div className="editor-results-section">
          <span className="setup-section-cyan">PRIZES / OUTCOMES</span>
          <div className="editor-grid-results">
            {results.map((r, i) => (
              <div key={i} className="result-input-card">
                <span className="card-player-label">Slot {i + 1}</span>
                <input
                  value={r}
                  disabled={started}
                  maxLength={10}
                  onChange={(e) => setResults((prev) => prev.map((v, idx) => (idx === i ? e.target.value : v)))}
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* LADDER & RESULTS TITLE */}
      <h2 className="setup-title-main">LADDER & RESULTS</h2>

      <div className="board-and-results-grid">
        {/* Left: Ladder Board */}
        <div className="board-card-unified">
          <svg viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`} className={`ladder-svg ${animating ? 'focus-active' : ''}`}>
            {/* 상단 캐릭터 */}
            {Array.from({ length: numPlayers }, (_, c) => {
              const char = CHARACTERS[c]
              const done = revealed[c] !== undefined
              return (
                <g
                  key={c}
                  className={`char-top ${animating ? 'locked' : ''} ${done ? 'done' : ''}`}
                  onClick={() => play(c)}
                >
                  <circle cx={x(c)} cy={LADDER_TOP - 52} r={26} style={{ fill: char.color }} />
                  <text x={x(c)} y={LADDER_TOP - 52} className="emoji" fontSize="30">
                    {char.emoji}
                  </text>
                  <text x={x(c)} y={LADDER_TOP - 14} className="label">
                    {names[c]}
                  </text>
                </g>
              )
            })}

            {rails}

            {/* 완료된 경로(=탄 사람들 것만) */}
            {traces.map((tr, i) => (
              <polyline key={i} points={ptStr(tr.points)} className="trace done-trace" style={{ stroke: tr.color }} />
            ))}

            {/* 진행 중 경로 */}
            {drawn && <polyline points={ptStr(drawn.pts)} className="trace" style={{ stroke: drawn.color }} />}

            {/* 찬스 게이트 마커 */}
            {chanceMark && (
              <g className="chance-mark">
                <circle cx={chanceMark.x} cy={chanceMark.y} r={20} className="chance-ring" />
                <text x={chanceMark.x} y={chanceMark.y} className="emoji" fontSize="22">
                  🎲
                </text>
                <text x={chanceMark.x} y={chanceMark.y - 32} className="chance-label">
                  찬스!
                </text>
              </g>
            )}

            {/* 도착한 캐릭터 표시 */}
            {Object.entries(revealed).map(([sc, ec]) => (
              <g key={sc} className="landed">
                <circle cx={x(ec)} cy={LADDER_BOTTOM} r={16} style={{ fill: CHARACTERS[sc].color }} />
                <text x={x(ec)} y={LADDER_BOTTOM} className="emoji" fontSize="20">
                  {CHARACTERS[sc].emoji}
                </text>
              </g>
            ))}

            {/* 움직이는 토큰 */}
            {token && (
              <g className="token">
                <circle cx={token.x} cy={token.y} r={20} style={{ fill: token.color }} />
                <text x={token.x} y={token.y} className="emoji" fontSize="24">
                  {token.emoji}
                </text>
              </g>
            )}

            {/* 하단 결과 */}
            {Array.from({ length: numPlayers }, (_, c) => {
              const isHit = Object.values(revealed).includes(c)
              const isHighlighted = activeCol === c
              return (
                <g key={c} className={`result ${isHit ? 'hit' : ''} ${isHighlighted ? 'glowing-card' : ''}`}>
                  <rect x={x(c) - 44} y={LADDER_BOTTOM + 16} width={88} height={40} rx={10} className="result-box" />
                  <text x={x(c)} y={LADDER_BOTTOM + 36} className="result-text">
                    {results[c]}
                  </text>
                </g>
              )
            })}
          </svg>

          {/* Yes/No 찬스 프롬프트 */}
          {prompt && (
            <div className="prompt-overlay">
              <div className="prompt-card">
                <div className="prompt-emoji">🎲</div>
                <p className="prompt-title">찬스 게이트!</p>
                <p className="prompt-desc">
                  남은 결과 {prompt.remainingCount}개 중 하나로 다시 뽑을까요?
                  <br />
                  <span className="prompt-hint">(결과는 아직 비밀 — 블라인드!)</span>
                </p>
                <div className="prompt-btns">
                  <button className="btn yes" onClick={() => prompt.decide(true)}>
                    🎲 다시 뽑기!
                  </button>
                  <button className="btn no" onClick={() => prompt.decide(false)}>
                    🚶 그대로 가기
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right: Results list view */}
        <div className="results-list-unified">
          <h3 className="results-header-text">RESULTS</h3>
          <div className="results-items-container">
            {Object.keys(revealed).length === 0 ? (
              <div className="results-empty-placeholder">
                <span className="placeholder-icon">🪜</span>
                <p>캐릭터를 눌러 사다리를 타보세요!</p>
              </div>
            ) : (
              Object.entries(revealed).map(([sc, ec], i) => (
                <div key={sc} className="result-item-mock">
                  <div className="result-item-left">
                    <span className="res-prefix">START →</span>
                    <span className="res-name-highlight" style={{ color: CHARACTERS[sc].color }}>
                      {names[sc]}
                    </span>
                    <span className="res-suffix">→ {results[ec]}</span>
                  </div>
                  <span className="res-rank-badge">{i + 1}st</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Bottom Action Bar matching design mockup */}
      <div className="bottom-action-bar-unified">
        <button className="btn nav-btn-purple" onClick={() => reset()}>
          BACK (RESET)
        </button>
        <button className="btn start-game-btn-unified" onClick={() => { if (!started) { alert('캐릭터를 눌러서 한 명씩 사다리를 타보세요! 🪜'); } else { reset(); } }} disabled={animating}>
          {started ? '🔄 RESET GAME' : 'START GAME ▶'}
        </button>
        <button className="btn nav-btn-purple" onClick={shuffleResults} disabled={started}>
          🎲 SHUFFLE
        </button>
      </div>

      {/* Celebrate overlay */}
      {resultOverlay}
    </div>
  )
}
