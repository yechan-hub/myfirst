import { useState, useEffect } from 'react'
import { makeCase, attributeChips, interrogate } from './mystery.js'
import { 
  unlockAudio, 
  playGun, 
  playWhip, 
  playChance, 
  playWin,
  playTypewriter,
  playPaper,
  playHeartbeat,
  playCameraScan,
  startBgm,
  stopBgm,
  setMasterVolume,
  setBgmVolume,
  setSfxVolume
} from './sounds.js'

const MAX_MISTAKES = 2

const DIFFICULTIES = [
  { n: 4, label: '쉬움 · 용의자 4명', interrogations: 2 },
  { n: 6, label: '보통 · 용의자 6명', interrogations: 3 },
  { n: 8, label: '어려움 · 용의자 8명', interrogations: 3 },
]

const RANKS = [
  { name: '👶 수습 형사', min: 0, max: 100 },
  { name: '🕵️ 초임 수사관', min: 101, max: 300 },
  { name: '🔍 베테랑 반장', min: 301, max: 600 },
  { name: '🧠 엘리트 경정', min: 601, max: 1000 },
  { name: '🏆 전설의 명탐정', min: 1001, max: 999999 },
]

function getRankInfo(score) {
  return RANKS.find(r => score >= r.min && score <= r.max) || RANKS[0]
}

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

  // 오케스트레이션 연출 및 VFX 상태
  const [vfxFlash, setVfxFlash] = useState(null) // 'white' | 'red' | null
  const [screenShake, setScreenShake] = useState(null) // 'soft' | 'medium' | 'heavy' | null
  const [showCinematic, setShowCinematic] = useState(null) // 'won' | 'lost' | null
  const [spotlightPos, setSpotlightPos] = useState({ x: 50, y: 50 })
  const [mismatchTextId, setMismatchTextId] = useState(null) // 모순 발생 시 텍스트 셰이크 대상 ID

  // 오디오 볼륨 설정 상태
  const [volBgm, setVolBgm] = useState(60)
  const [volSfx, setVolSfx] = useState(80)

  // 심문 대화 애니메이션 상태
  const [interrogatingSuspect, setInterrogatingSuspect] = useState(null)
  const [typedDialogue, setTypedDialogue] = useState('')
  const [isDialogueTyping, setIsDialogueTyping] = useState(false)

  // BGM 상태
  const [bgmOn, setBgmOn] = useState(false)

  // 수사 기록실(통계) 상태
  const [statsModalOpen, setStatsModalOpen] = useState(false)
  const [stats, setStats] = useState(() => {
    const saved = localStorage.getItem('agy_detective_stats')
    if (saved) {
      try {
        return JSON.parse(saved)
      } catch (e) {}
    }
    return { solved: 0, failed: 0, totalScore: 0, highScore: 0 }
  })
  const [lastScore, setLastScore] = useState(0)

  // BGM 재생 관리
  useEffect(() => {
    if (bgmOn && (phase === 'play' || phase === 'intro')) {
      startBgm()
    } else {
      stopBgm()
    }
    return () => stopBgm()
  }, [bgmOn, phase])

  // 심문 대화 타이핑 효과 (문장 부호 템포 믹스)
  useEffect(() => {
    if (!interrogatingSuspect) return

    const alibi = interrogate(interrogatingSuspect)
    const text = alibi.statement
    let currentIndex = 0
    setTypedDialogue('')
    setIsDialogueTyping(true)

    let timer = null
    const typeNextChar = () => {
      if (currentIndex < text.length) {
        const char = text[currentIndex]
        setTypedDialogue((prev) => prev + char)
        playTypewriter()
        currentIndex++

        // 문장부호에 따른 리얼한 대화 호흡(Pause) 가동
        let delay = 35
        if (char === '.' || char === '!' || char === '?') delay = 400
        else if (char === ',') delay = 160

        timer = setTimeout(typeNextChar, delay)
      } else {
        setIsDialogueTyping(false)
      }
    }

    timer = setTimeout(typeNextChar, 40)

    return () => clearTimeout(timer)
  }, [interrogatingSuspect])

  function start(n, interrogations) {
    unlockAudio()
    playPaper()
    setNumSuspects(n)
    setInterrogationBudget(interrogations ?? interrogationBudget)
    setCaze(makeCase(n))
    setRevealedCount(1) // 첫 단서는 공짜로 공개
    setMistakes(0)
    setWrongIds([])
    setMemoIds([])
    setInterrogatedIds([])
    setSelectedId(null)
    setShowCinematic(null)
    setPhase('play')
  }

  function updateStats(won, score = 0) {
    setStats((prev) => {
      const next = {
        solved: prev.solved + (won ? 1 : 0),
        failed: prev.failed + (won ? 0 : 1),
        totalScore: prev.totalScore + score,
        highScore: won ? Math.max(prev.highScore, score) : prev.highScore,
      }
      localStorage.setItem('agy_detective_stats', JSON.stringify(next))
      return next
    })
  }

  function resetStats() {
    if (window.confirm('모든 수사 기록과 점수를 초기화하시겠습니까?')) {
      const empty = { solved: 0, failed: 0, totalScore: 0, highScore: 0 }
      setStats(empty)
      localStorage.setItem('agy_detective_stats', JSON.stringify(empty))
    }
  }

  function revealClue() {
    playCameraScan()
    setVfxFlash('white')
    setScreenShake('soft')
    setRevealedCount((c) => Math.min(c + 1, caze.clues.length))
    setTimeout(() => {
      setVfxFlash(null)
      setScreenShake(null)
    }, 450)
  }

  function toggleMemo(id) {
    playPaper()
    setMemoIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  function doInterrogate(id) {
    if (interrogatedIds.includes(id)) return
    if (interrogatedIds.length >= interrogationBudget) return
    const suspect = caze.suspects.find((s) => s.id === id)
    if (!suspect) return

    const result = interrogate(suspect)
    
    // 모순(거짓말) 발견 시 강렬한 연출
    if (!result.consistent) {
      playWhip()
      setScreenShake('medium')
      setVfxFlash('red')
      setMismatchTextId(id)
      setTimeout(() => {
        setScreenShake(null)
        setVfxFlash(null)
      }, 450)
    } else {
      playChance()
    }
    
    setInterrogatedIds((prev) => [...prev, id])
    setInterrogatingSuspect(suspect)
  }

  function accuse() {
    const suspect = caze.suspects.find((s) => s.id === selectedId)
    if (!suspect) return
    if (suspect.id === caze.culpritId) {
      playWin()
      setShowCinematic('won')
      setPhase('won')
      
      // 수사 점수 계산
      const baseScore = 100
      const mistakeBonus = mistakes === 0 ? 50 : mistakes === 1 ? 20 : 0
      const clueDeduction = (revealedCount - 1) * 8
      const interrogationDeduction = interrogatedIds.length * 10
      const roundScore = Math.max(25, baseScore + mistakeBonus - clueDeduction - interrogationDeduction)
      
      setLastScore(roundScore)
      updateStats(true, roundScore)
    } else {
      const next = mistakes + 1
      setMistakes(next)
      setWrongIds((prev) => [...prev, suspect.id])
      setSelectedId(null)
      if (next >= MAX_MISTAKES) {
        playGun()
        setShowCinematic('lost')
        setScreenShake('heavy')
        setVfxFlash('red')
        setPhase('lost')
        setLastScore(0)
        updateStats(false, 0)
        setTimeout(() => {
          setScreenShake(null)
          setVfxFlash(null)
        }, 1000)
      } else {
        playWhip()
        setScreenShake('medium')
        setVfxFlash('red')
        setTimeout(() => {
          setScreenShake(null)
          setVfxFlash(null)
        }, 450)
      }
    }
  }

  function handleSelectSuspect(id) {
    if (done) return
    if (wrongIds.includes(id)) return
    
    // 심장박동 효과음으로 긴장감 부여
    playHeartbeat()
    setSelectedId(id === selectedId ? null : id)
  }

  // 스포트라이트 마우스 움직임 동조 연출
  function handleSpotlightMove(e) {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    setSpotlightPos({ x, y })
  }

  const currentRank = getRankInfo(stats.totalScore)

  if (phase === 'intro') {
    return (
      <div className="app mystery">
        <header>
          <h1>🕵️ 명탐정 사건 보드</h1>
          <p className="sub">단서를 대조하고 범인의 거짓 진술을 파헤쳐 체포하세요!</p>
        </header>
        
        {/* 글로벌 실시간 볼륨 믹서 */}
        <div className="audio-mixer-panel">
          <span className="audio-mixer-title">🎛️ 사운드 믹서</span>
          <div className="audio-mixer-control">
            <span>BGM</span>
            <input 
              type="range" 
              min="0" 
              max="100" 
              value={volBgm} 
              onChange={(e) => {
                const val = parseInt(e.target.value)
                setVolBgm(val)
                setBgmVolume(val / 100)
              }} 
            />
          </div>
          <div className="audio-mixer-control">
            <span>효과음</span>
            <input 
              type="range" 
              min="0" 
              max="100" 
              value={volSfx} 
              onChange={(e) => {
                const val = parseInt(e.target.value)
                setVolSfx(val)
                setSfxVolume(val / 100)
              }} 
            />
          </div>
        </div>

        <div className="mystery-intro">
          <div className="intro-action-bar">
            <button className="btn" onClick={() => setStatsModalOpen(true)}>
              📊 수사 기록실
            </button>
            <button className="btn bgm-toggle-btn" onClick={() => setBgmOn(!bgmOn)}>
              {bgmOn ? '🎵 BGM: 켬' : '🔇 BGM: 끔'}
            </button>
          </div>

          <p className="intro-desc">
            <strong>🔍 수사 수첩</strong>의 현장 물증은 100% 진실입니다. 범행 보드에 적힌 특징을 바탕으로 용의자를 좁히세요.
            <br /><br />
            <strong>💡 심문</strong>을 진행하면 용의자들은 알리바이를 진술합니다.
            <br />
            무고한 용의자는 실제 목격 장소(📍)를 진술하지만, <strong>진짜 범인은 거짓 장소</strong>를 댑니다.
            진술한 장소와 실제 목격 장소가 어긋나는 자를 잡아야 합니다!
            <br /><br />
            잘못된 지목 기회는 단 {MAX_MISTAKES}번. 최소한의 단서와 심문으로 맞혀 형사 랭킹을 올리세요!
          </p>

          <div className="difficulty-btns">
            {DIFFICULTIES.map((d) => (
              <button key={d.n} className="btn difficulty" onClick={() => start(d.n, d.interrogations)}>
                {d.label}
              </button>
            ))}
          </div>
        </div>

        {/* 수사 기록실 모달 */}
        {statsModalOpen && (
          <div className="modal-overlay" onClick={() => setStatsModalOpen(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <h2 className="modal-title">🕵️ 형사 수사 기록실</h2>
              
              <div className="rank-display">
                <div className="rank-badge">{currentRank.name}</div>
                <div className="rank-score">누적 수사 점수: {stats.totalScore}점</div>
                <div className="rank-bar-bg">
                  <div 
                    className="rank-bar-fill" 
                    style={{ width: `${Math.min(100, (stats.totalScore / currentRank.max) * 100)}%` }} 
                  />
                </div>
              </div>
              
              <div className="stats-grid">
                <div className="stats-card">
                  <div className="stats-value">{stats.solved}건</div>
                  <div className="stats-label">해결한 사건</div>
                </div>
                <div className="stats-card">
                  <div className="stats-value">{stats.failed}건</div>
                  <div className="stats-label">실패한 사건</div>
                </div>
                <div className="stats-card">
                  <div className="stats-value">{stats.highScore}점</div>
                  <div className="stats-label">최고 수사 점수</div>
                </div>
                <div className="stats-card">
                  <div className="stats-value">
                    {stats.solved + stats.failed > 0 
                      ? Math.round((stats.solved / (stats.solved + stats.failed)) * 100) 
                      : 0}%
                  </div>
                  <div className="stats-label">사건 해결 확률</div>
                </div>
              </div>
              
              <div className="modal-actions">
                <button className="btn modal-close-btn" onClick={() => setStatsModalOpen(false)}>
                  기록실 나가기
                </button>
                <button className="btn reset-btn" onClick={resetStats}>
                  기록 초기화
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  const { scenario, suspects, clues, culpritId, activeCategories } = caze
  const culprit = suspects.find((s) => s.id === culpritId)
  const done = phase === 'won' || phase === 'lost'
  const allCluesUsed = revealedCount >= clues.length
  const interrogationsLeft = interrogationBudget - interrogatedIds.length
  const helpUsed = revealedCount - 1 + interrogatedIds.length
  const stars =
    phase !== 'won' ? 0 : mistakes > 0 ? 1 : helpUsed <= 2 ? 3 : helpUsed <= 4 ? 2 : 1

  const alibiResult = interrogatingSuspect ? interrogate(interrogatingSuspect) : null

  return (
    <div className={`app mystery ${screenShake ? `screen-shake-${screenShake}` : ''}`}>
      {/* 1. 글로벌 VFX 플래시 스크린 */}
      {vfxFlash && <div className={`vfx-flash-overlay ${vfxFlash}`} />}

      <header>
        <h1>
          {scenario.icon} {scenario.title}
        </h1>
        <p className="sub">{scenario.desc}</p>
      </header>

      {/* 실시간 볼륨 믹서 (인게임 버전) */}
      <div className="audio-mixer-panel" style={{ margin: '5px auto 15px' }}>
        <span className="audio-mixer-title">🎛️ 볼륨</span>
        <div className="audio-mixer-control">
          <span>BGM</span>
          <input 
            type="range" 
            min="0" 
            max="100" 
            value={volBgm} 
            onChange={(e) => {
              const val = parseInt(e.target.value)
              setVolBgm(val)
              setBgmVolume(val / 100)
            }} 
          />
        </div>
        <div className="audio-mixer-control">
          <span>효과음</span>
          <input 
            type="range" 
            min="0" 
            max="100" 
            value={volSfx} 
            onChange={(e) => {
              const val = parseInt(e.target.value)
              setVolSfx(val)
              setSfxVolume(val / 100)
            }} 
          />
        </div>
      </div>

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
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn bgm-toggle-btn" onClick={() => setBgmOn(!bgmOn)}>
            {bgmOn ? '🎵 BGM ON' : '🔇 BGM OFF'}
          </button>
          <button className="btn" onClick={() => setPhase('intro')}>
            🔄 새 사건
          </button>
        </div>
      </div>

      <section className="clue-panel" style={{ position: 'relative' }}>
        {/* 카메라 스캔라인 비주얼 적용 */}
        {vfxFlash === 'white' && <div className="noir-clue-scanner" />}
        
        <div className="clue-head">
          <h2>🔍 단서 수첩</h2>
          {!done && (
            <button className="btn clue-btn" onClick={revealClue} disabled={allCluesUsed}>
              {allCluesUsed ? '단서 전부 확인 완료' : `현장 조사하기 (${clues.length - revealedCount}개 남음)`}
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

      {/* 2. 느와르 수사 코르크 사건 보드 (스포트라이트 빔 조명 효과 적용) */}
      <section 
        className="crime-board noir-spotlight-bg"
        onMouseMove={handleSpotlightMove}
        style={{
          '--spotlight-x': `${spotlightPos.x}%`,
          '--spotlight-y': `${spotlightPos.y}%`,
        }}
      >
        <div className="suspect-grid" style={{ position: 'relative', zIndex: 6 }}>
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
                onClick={() => handleSelectSuspect(s.id)}
              >
                {!done && !cleared && (
                  <button
                    className="memo-btn"
                    title="용의선상 제외 (메모)"
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleMemo(s.id)
                    }}
                  >
                    {memoOut ? '↩️' : '❌'}
                  </button>
                )}

                {cleared && <span className="stamp-overlay stamp-alibi">결백 확보</span>}
                {memoOut && !cleared && !done && <span className="stamp-overlay stamp-excluded">수사 제외</span>}
                {done && s.id === culpritId && (
                  <span className={`stamp-overlay ${phase === 'won' ? 'stamp-caught' : 'stamp-escaped'}`}>
                    {phase === 'won' ? '주범 체포' : '용의자 도주'}
                  </span>
                )}
                {done && s.id !== culpritId && interrogated && (
                  <span className="stamp-overlay stamp-alibi">결백 확보</span>
                )}

                <div className="suspect-emoji">
                  {isCulpritReveal ? (
                    '😈'
                  ) : cleared ? (
                    '😇'
                  ) : s.image ? (
                    <img src={s.image} alt={s.name} className="suspect-card-img" />
                  ) : (
                    s.emoji
                  )}
                </div>
                <div className="suspect-name">
                  {s.name}
                  {cleared && ' (무고)'}
                </div>
                
                <div className="suspect-chips">
                  {attributeChips(s, activeCategories).map((chip, i) => (
                    <span key={i} className="attr-chip" title={chip.label}>
                      {chip.icon} {chip.label}
                    </span>
                  ))}
                </div>

                {alibi && (
                  <div className={`alibi-box ${alibi.consistent ? 'match' : 'mismatch'}`}>
                    <div className="alibi-statement">🗣️ {alibi.statement}</div>
                    <div className={`alibi-verdict ${!alibi.consistent && mismatchTextId === s.id ? 'text-shake' : ''}`}>
                      {alibi.consistent
                        ? '✅ 진술 일치 (결백)'
                        : `🚨 진술 모순(📍${s.place}과 모순!)`}
                    </div>
                  </div>
                )}

                {canInterrogate && (
                  <button
                    className="action-btn interrogate-btn"
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
        </div>
      </section>

      {!done && selectedId != null && (
        <div className="accuse-bar">
          <span>
            수사 보고서: <strong>{suspects.find((s) => s.id === selectedId)?.name}</strong>
            {'을(를) 본 사건의 진짜 주범으로 지목하시겠습니까?'}
          </span>
          <button className="btn accuse-btn" onClick={accuse}>
            🚨 체포영장 발부!
          </button>
        </div>
      )}

      {done && (
        <div className="verdict">
          {phase === 'won' ? (
            <>
              <div className="verdict-emoji">🎉</div>
              <h2>사건 해결 완료!</h2>
              <p>
                범인은 <strong>{culprit.name}</strong>이었습니다!
                <br />
                단서 {revealedCount}개 확인, 심문 {interrogatedIds.length}회를 사용해 범인을 완벽히 검거해 냈습니다.
              </p>
              <div className="stars">{'⭐'.repeat(stars)}{'☆'.repeat(3 - stars)}</div>
              <p style={{ fontSize: '16px', fontWeight: 'bold', color: '#ffd54a' }}>
                이번 사건 획득 점수: +{lastScore}점
              </p>
            </>
          ) : (
            <>
              <div className="verdict-emoji">💨</div>
              <h2>범인 도주! 수사 실패…</h2>
              <p>
                진짜 범인은 <strong>{culprit.name}</strong>이었습니다.
                <br />
                목격된 진짜 장소는 [📍{culprit.place}]였으나, 심문에서 [📍{culprit.claimedPlace}]라고 댄 거짓말을 간파하지 못했습니다.
              </p>
            </>
          )}
          <button className="btn accuse-btn" onClick={() => start(numSuspects, interrogationBudget)}>
            다음 사건 수사 착수
          </button>
        </div>
      )}

      {/* 심층 취조실 오버레이 모달 */}
      {interrogatingSuspect && alibiResult && (
        <div className="interrogation-room" onClick={() => {
          if (!isDialogueTyping) setInterrogatingSuspect(null)
        }}>
          <div className="interrogation-spotlight" onClick={(e) => e.stopPropagation()}>
            <div className="interrogated-suspect-profile">
              <div className="interrogated-emoji">
                {isDialogueTyping ? (
                  interrogatingSuspect.image ? (
                    <img src={interrogatingSuspect.image} alt={interrogatingSuspect.name} className="suspect-card-img" />
                  ) : (
                    interrogatingSuspect.emoji
                  )
                ) : (
                  alibiResult.expression
                )}
              </div>
              <div className="interrogated-name">{interrogatingSuspect.name}</div>
              <div className="interrogated-status">
                {isDialogueTyping ? '취조 중 · 진술 녹취록 작성...' : alibiResult.statusText}
              </div>
            </div>
            
            <div className="dialogue-box">
              <div className="dialogue-text">
                {typedDialogue}
                {isDialogueTyping && <span className="dialogue-typing-cursor" />}
              </div>
            </div>
            
            {!isDialogueTyping && (
              <>
                <div className="interrogation-comparison">
                  <div className="interrogation-comparison-title">현장 물리 증거 대조 검증</div>
                  <div className="comparison-item">
                    <span>📍 실제 현장 목격 장소:</span>
                    <strong>{interrogatingSuspect.place}</strong>
                  </div>
                  <div className="comparison-item">
                    <span>🗣️ 용의자의 진술 알리바이 장소:</span>
                    <strong>{alibiResult.claimedPlace}</strong>
                  </div>
                  <div className={`comparison-verdict ${alibiResult.consistent ? 'match' : 'mismatch'}`}>
                    {alibiResult.consistent 
                      ? '✅ 진술이 목격 정보와 일치합니다. (무혐의 대상)' 
                      : '🚨 목격 정보와 진술이 완벽히 모순됩니다! (체포 대상)'}
                  </div>
                </div>
                
                <button className="btn clue-btn" onClick={() => setInterrogatingSuspect(null)}>
                  취조 완료 후 기록 저장
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* 3. 극적 시네마틱 종막 오버레이 */}
      {showCinematic && (
        <div 
          className={`cinematic-overlay ${showCinematic}`}
          onClick={() => setShowCinematic(null)}
        >
          {showCinematic === 'won' ? (
            <>
              <div className="cinematic-handcuffs">🔗</div>
              <div className="emergency-meeting-title" style={{ color: '#ffd54a', textShadow: '0 0 15px rgba(255, 213, 74, 0.8)' }}>
                체포 성공 (ARRESTED)
              </div>
              <div className="emergency-meeting-subtitle">
                범인 {culprit.name}을(를) 현장에서 현행범으로 검거하였습니다!
              </div>
            </>
          ) : (
            <>
              <div className="cinematic-bullethole"></div>
              <div className="cinematic-blood-drips"></div>
              <div className="emergency-meeting-title">
                수사패배 (MISSION FAILED)
              </div>
              <div className="emergency-meeting-subtitle">
                진범 {culprit.name}은(는) 삼엄한 포위망을 뚫고 도주하였습니다.
              </div>
            </>
          )}
          <p style={{ marginTop: '30px', color: '#9ca3af', fontSize: '12px' }}>
            화면을 클릭하면 사건 수사 결과서로 넘어갑니다.
          </p>
        </div>
      )}
    </div>
  )
}
