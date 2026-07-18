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
      setRevealed((r) => ({ ...r, [startCol]: endCol }))
      setAnimating(false)
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

  return (
    <div className="app">
      <header>
        <h1>🪜 사다리 게임</h1>
        <p className="sub">
          사다리 칸은 비밀! 캐릭터를 눌러 직접 타보세요 · 🔫 총소리 · 🎇 음속 채찍 · 🎲 찬스 게이트
        </p>
      </header>

      <div className="controls">
        <div className="player-select">
          <span>참가자</span>
          {[2, 3, 4, 5, 6].map((n) => (
            <button
              key={n}
              className={n === numPlayers ? 'chip active' : 'chip'}
              onClick={() => changePlayers(n)}
              disabled={started}
            >
              {n}명
            </button>
          ))}
        </div>
        <div className="actions">
          <button className="btn" onClick={() => reset()} disabled={animating}>
            🔀 새 사다리
          </button>
          <button className="btn" onClick={shuffleResults} disabled={started}>
            🎲 결과 섞기
          </button>
        </div>
      </div>

      <div className="controls">
        <div className="player-select">
          <span>찬스 게이트</span>
          {[
            ['off', '끔'],
            ['auto', '자동'],
            ['ask', '선택(Yes/No)'],
          ].map(([val, label]) => (
            <button
              key={val}
              className={val === chanceMode ? 'chip active' : 'chip'}
              onClick={() => setChanceMode(val)}
              disabled={started}
              title={
                val === 'off'
                  ? '찬스 없이 순수 사다리'
                  : val === 'auto'
                  ? '게이트에서 자동으로 다시 뽑기'
                  : '게이트에서 직접 Yes/No 선택'
              }
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="board">
        <svg viewBox={`0 0 ${W} ${H}`} className="ladder-svg">
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
            return (
              <g key={c} className={`result ${isHit ? 'hit' : ''}`}>
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

      {/* 이름 편집 */}
      <div className="editor">
        <span className="editor-title">이름 편집 {started && <em>(게임 중 잠김)</em>}</span>
        <div className="editor-grid">
          {names.map((nm, i) => (
            <div key={i} className="name-cell">
              <span className="name-emoji">{CHARACTERS[i].emoji}</span>
              <input
                value={nm}
                disabled={started}
                maxLength={8}
                onChange={(e) => setNames((prev) => prev.map((v, idx) => (idx === i ? e.target.value : v)))}
              />
            </div>
          ))}
        </div>
      </div>

      {/* 결과 편집 */}
      <div className="editor">
        <span className="editor-title">결과 편집 {started && <em>(게임 중 잠김)</em>}</span>
        <div className="editor-grid">
          {results.map((r, i) => (
            <input
              key={i}
              value={r}
              disabled={started}
              maxLength={10}
              onChange={(e) => setResults((prev) => prev.map((v, idx) => (idx === i ? e.target.value : v)))}
            />
          ))}
        </div>
      </div>

      {/* 결과 요약 */}
      {Object.keys(revealed).length > 0 && (
        <div className="summary">
          {Object.entries(revealed).map(([sc, ec]) => (
            <div key={sc} className="summary-row">
              <span>
                {CHARACTERS[sc].emoji} {names[sc]}
              </span>
              <span className="arrow">→</span>
              <strong>{results[ec]}</strong>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
