import { useState } from 'react'
import { makeCase, attributeChips, interrogate } from './mystery.js'
import { unlockAudio, playGun, playWhip, playChance, playWin } from './sounds.js'

const MAX_MISTAKES = 2

const DIFFICULTIES = [
  { n: 4, label: '쉬움 · 용의자 4명', interrogations: 2 },
  { n: 6, label: '보통 · 용의자 6명', interrogations: 3 },
  { n: 8, label: '어려움 · 용의자 8명', interrogations: 3 },
]

export default function MysteryGame() {
  const [caze, setCaze] = useState(null) // 현재 사건
  const [numSuspects, setNumSuspects] = useState(6)
  const [interrogationBudget, setInterrogationBudget] = useState(3) // 심문 가능 횟수
  const [revealedCount, setRevealedCount] = useState(0)
  const [mistakes, setMistakes] = useState(0)
  const [wrongIds, setWrongIds] = useState([]) // 잘못 지목해서 결백이 밝혀진 용의자
  const [memoIds, setMemoIds] = useState([]) // 플레이어가 메모로 제외 표시한 용의자
  const [interrogatedIds, setInterrogatedIds] = useState([]) // 심문 완료한 용의자
  const [selectedId, setSelectedId] = useState(null)
  const [phase, setPhase] = useState('intro') // intro | play | won | lost

  function start(n, interrogations) {
    unlockAudio()
    setNumSuspects(n)
    setInterrogationBudget(interrogations ?? interrogationBudget)
    setCaze(makeCase(n))
    setRevealedCount(1) // 첫 단서는 공짜로 공개
    setMistakes(0)
    setWrongIds([])
    setMemoIds([])
    setInterrogatedIds([])
    setSelectedId(null)
    setPhase('play')
  }

  function revealClue() {
    playChance()
    setRevealedCount((c) => Math.min(c + 1, caze.clues.length))
  }

  function toggleMemo(id) {
    setMemoIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  function doInterrogate(id) {
    if (interrogatedIds.includes(id)) return
    if (interrogatedIds.length >= interrogationBudget) return
    const suspect = caze.suspects.find((s) => s.id === id)
    const result = interrogate(suspect)
    result.consistent ? playChance() : playWhip()
    setInterrogatedIds((prev) => [...prev, id])
  }

  function accuse() {
    const suspect = caze.suspects.find((s) => s.id === selectedId)
    if (!suspect) return
    if (suspect.id === caze.culpritId) {
      playWin()
      setPhase('won')
    } else {
      const next = mistakes + 1
      setMistakes(next)
      setWrongIds((prev) => [...prev, suspect.id])
      setSelectedId(null)
      if (next >= MAX_MISTAKES) {
        playGun()
        setPhase('lost')
      } else {
        playWhip()
      }
    }
  }

  if (phase === 'intro') {
    return (
      <div className="app mystery">
        <header>
          <h1>🕵️ 명탐정 추리 게임</h1>
          <p className="sub">단서를 모으고 용의자를 심문해 범인을 지목하세요!</p>
        </header>
        <div className="mystery-intro">
          <p className="intro-desc">
            <strong>단서 수첩</strong>의 물증은 모두 진실! 특징을 대조해 용의자를 좁히세요.
            <br />
            <strong>🔍 심문</strong>으로 "사건 당시 어디 있었나?"를 물으면, 무고한 사람은 사실대로
            답하지만 <strong>범인은 거짓 알리바이</strong>를 댑니다. 진술이 목격 장소(📍)와 어긋나면
            바로 그자가 범인!
            <br />
            심문 횟수와 기회({MAX_MISTAKES}번)는 제한되어 있어요. 적게 쓰고 맞힐수록 별점⭐이 올라갑니다.
          </p>
          <div className="difficulty-btns">
            {DIFFICULTIES.map((d) => (
              <button key={d.n} className="btn difficulty" onClick={() => start(d.n, d.interrogations)}>
                {d.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  const { scenario, suspects, clues, culpritId } = caze
  const culprit = suspects.find((s) => s.id === culpritId)
  const done = phase === 'won' || phase === 'lost'
  const allCluesUsed = revealedCount >= clues.length
  const interrogationsLeft = interrogationBudget - interrogatedIds.length
  // 별점: 실수 없이 도움(추가 단서 + 심문)을 적게 쓸수록 높다
  const helpUsed = revealedCount - 1 + interrogatedIds.length
  const stars =
    phase !== 'won' ? 0 : mistakes > 0 ? 1 : helpUsed <= 2 ? 3 : helpUsed <= 4 ? 2 : 1

  return (
    <div className="app mystery">
      <header>
        <h1>
          {scenario.icon} {scenario.title}
        </h1>
        <p className="sub">{scenario.desc}</p>
      </header>

      <div className="mystery-status">
        <span className="status-badges">
          <span className="lives">
            기회{' '}
            {Array.from({ length: MAX_MISTAKES }, (_, i) => (
              <span key={i}>{i < MAX_MISTAKES - mistakes ? '❤️' : '🖤'}</span>
            ))}
          </span>
          <span className="interro-count">
            🔍 심문 {interrogationsLeft}/{interrogationBudget}
          </span>
        </span>
        <button className="btn" onClick={() => setPhase('intro')}>
          🔄 새 사건
        </button>
      </div>

      <section className="clue-panel">
        <div className="clue-head">
          <h2>🔍 단서 수첩</h2>
          {!done && (
            <button className="btn clue-btn" onClick={revealClue} disabled={allCluesUsed}>
              {allCluesUsed ? '단서를 모두 조사했다' : `단서 조사하기 (${clues.length - revealedCount}개 남음)`}
            </button>
          )}
        </div>
        <ul className="clue-list">
          {clues.slice(0, revealedCount).map((clue, i) => (
            <li key={clue.id} className="clue-item">
              <span className="clue-no">단서 {i + 1}</span>
              <span className="clue-icon">{clue.icon}</span>
              {clue.text}
            </li>
          ))}
        </ul>
      </section>

      <section className="suspect-grid">
        {suspects.map((s) => {
          const cleared = wrongIds.includes(s.id)
          const memoOut = memoIds.includes(s.id)
          const interrogated = interrogatedIds.includes(s.id)
          const alibi = interrogated || done ? interrogate(s) : null
          const isCulpritReveal = done && s.id === culpritId
          const canInterrogate =
            !done && !cleared && !interrogated && interrogationsLeft > 0
          return (
            <div
              key={s.id}
              className={[
                'suspect-card',
                selectedId === s.id ? 'selected' : '',
                cleared || memoOut ? 'dimmed' : '',
                isCulpritReveal ? (phase === 'won' ? 'caught' : 'escaped') : '',
              ].join(' ')}
              onClick={() => !done && !cleared && setSelectedId(s.id === selectedId ? null : s.id)}
            >
              {!done && !cleared && (
                <button
                  className="memo-btn"
                  title="용의선상에서 제외 (메모)"
                  onClick={(e) => {
                    e.stopPropagation()
                    toggleMemo(s.id)
                  }}
                >
                  {memoOut ? '↩️' : '❌'}
                </button>
              )}
              <div className="suspect-emoji">{isCulpritReveal ? '😈' : cleared ? '😇' : s.emoji}</div>
              <div className="suspect-name">
                {s.name}
                {cleared && ' (결백)'}
              </div>
              <div className="suspect-chips">
                {attributeChips(s).map((chip, i) => (
                  <span key={i} className="attr-chip">
                    {chip.icon} {chip.label}
                  </span>
                ))}
              </div>

              {alibi && (
                <div className={`alibi-box ${alibi.consistent ? 'match' : 'mismatch'}`}>
                  <div className="alibi-statement">🗣️ {alibi.statement}</div>
                  <div className="alibi-verdict">
                    {alibi.consistent
                      ? '✅ 목격 장소와 진술이 일치'
                      : `🚨 목격 장소(📍${s.place})와 모순!`}
                  </div>
                </div>
              )}

              {canInterrogate && (
                <button
                  className="interrogate-btn"
                  onClick={(e) => {
                    e.stopPropagation()
                    doInterrogate(s.id)
                  }}
                >
                  🔍 심문하기
                </button>
              )}
              {!done && !cleared && !interrogated && interrogationsLeft === 0 && (
                <div className="interro-empty">심문 기회 없음</div>
              )}
            </div>
          )
        })}
      </section>

      {!done && selectedId != null && (
        <div className="accuse-bar">
          <span>
            <strong>{suspects.find((s) => s.id === selectedId)?.name}</strong>
            {'이(가) 범인일까요?'}
          </span>
          <button className="btn accuse-btn" onClick={accuse}>
            🚨 범인으로 지목!
          </button>
        </div>
      )}

      {done && (
        <div className="verdict">
          {phase === 'won' ? (
            <>
              <div className="verdict-emoji">🎉</div>
              <h2>사건 해결!</h2>
              <p>
                범인은 <strong>{culprit.name}</strong>! 단서 {revealedCount}개
                {interrogatedIds.length > 0 && `, 심문 ${interrogatedIds.length}회`}로 해결했어요.
              </p>
              <div className="stars">{'⭐'.repeat(stars)}{'☆'.repeat(3 - stars)}</div>
            </>
          ) : (
            <>
              <div className="verdict-emoji">💨</div>
              <h2>범인이 도망쳤다…</h2>
              <p>
                진짜 범인은 <strong>{culprit.name}</strong>이었어요. 거짓 알리바이(
                {culprit.claimedPlace})를 놓쳤네요!
              </p>
            </>
          )}
          <button className="btn accuse-btn" onClick={() => start(numSuspects, interrogationBudget)}>
            다음 사건 수사하기
          </button>
        </div>
      )}
    </div>
  )
}
