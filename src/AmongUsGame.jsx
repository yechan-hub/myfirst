import { useState, useEffect, useRef } from 'react'
import { CHARACTERS, MAP_ROOMS, TASKS, VENTS, WALLS, generateChatMessages } from './amongus.js'
import {
  unlockAudio,
  playKillSFX,
  playVentSFX,
  startSirenSFX,
  stopSirenSFX,
  playEmergencySFX,
  playEjectSFX,
  playTaskSFX,
  playTypewriter,
  playPaper,
  playHeartbeat,
  startBgm,
  stopBgm,
  playWhip,
  setSabotageFilter,
  setMasterVolume,
  setBgmVolume,
  setSfxVolume
} from './sounds.js'

// 게임 기본 상수
const CANVAS_WIDTH = 800
const CANVAS_HEIGHT = 480
const PLAYER_SPEED = 2.2

export default function AmongUsGame() {
  // 게임 국면: intro | play | meeting | ejection | victory | defeat
  const [phase, setPhase] = useState('intro')
  const [playerRole, setPlayerRole] = useState('crewmate') // crewmate | impostor

  // VFX 및 연출 제어 상태
  const [vfxFlash, setVfxFlash] = useState(null) // 'white' | 'red' | null
  const [screenShake, setScreenShake] = useState(null) // 'soft' | 'medium' | 'heavy' | null
  const [showEmergencyAlert, setShowEmergencyAlert] = useState(false)
  const [emergencyType, setEmergencyType] = useState('report') // 'report' | 'emergency'
  const [volBgm, setVolBgm] = useState(60)
  const [volSfx, setVolSfx] = useState(80)

  // 이미지 프리로더 상태 및 참조
  const [imagesLoaded, setImagesLoaded] = useState(false)
  const characterImagesRef = useRef({})

  // 이미지 사전 로딩 엔진
  useEffect(() => {
    let loadedCount = 0
    const totalToLoad = CHARACTERS.length
    const tempImages = {}

    CHARACTERS.forEach((char) => {
      if (char.image) {
        const img = new Image()
        img.src = char.image
        img.onload = () => {
          loadedCount++
          if (loadedCount === totalToLoad) {
            setImagesLoaded(true)
          }
        }
        img.onerror = () => {
          loadedCount++
          if (loadedCount === totalToLoad) {
            setImagesLoaded(true)
          }
        }
        tempImages[char.id] = img
      } else {
        loadedCount++
        if (loadedCount === totalToLoad) {
          setImagesLoaded(true)
        }
      }
    })
    characterImagesRef.current = tempImages
  }, [])

  // 인게임 플레이 상태
  const [players, setPlayers] = useState([])
  const [playerPos, setPlayerPos] = useState({ x: 400, y: 250 })
  const [playerDead, setPlayerDead] = useState(false)
  const [tasksCompleted, setTasksCompleted] = useState([]) // 완료된 임무 ID들
  const [completedTasksCount, setCompletedTasksCount] = useState(0) // 총 완료한 미션 개수 (목표 80개)
  const [deadBodies, setDeadBodies] = useState([]) // { x, y, roomId, victimId }
  const [isVented, setIsVented] = useState(false)
  const [currentVent, setCurrentVent] = useState(null)
  
  // 쿨다운 및 타이머
  const [killCooldown, setKillCooldown] = useState(15)
  const [sabotageActive, setSabotageActive] = useState(null) // null | 'reactor' | 'lights'
  const [sabotageTimer, setSabotageTimer] = useState(30)
  
  // 조작 상태
  const [keys, setKeys] = useState({})
  const [bgmOn, setBgmOn] = useState(false)

  // 회의 상태
  const [meetingReason, setMeetingReason] = useState('report') // report | emergency
  const [reporter, setReporter] = useState(null)
  const [meetingDead, setMeetingDead] = useState(null)
  const [chatMessages, setChatMessages] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [votes, setVotes] = useState({}) // { voterId: targetId } (targetId: -1 = skip)
  const [playerVoted, setPlayerVoted] = useState(false)
  const [votingComplete, setVotingComplete] = useState(false)

  // 방출 연출 상태
  const [ejectedPlayer, setEjectedPlayer] = useState(null)
  const [ejectedText, setEjectedText] = useState('')

  const [personalTasks, setPersonalTasks] = useState([])
  const [observationLog, setObservationLog] = useState([])
  const [meetingTab, setMeetingTab] = useState('chat') // 'chat' | 'alibi'
  const [chatFinished, setChatFinished] = useState(false)
  const [scenarioId, setScenarioId] = useState('free') // 'free' | 'scenario_1' | 'scenario_2' | 'scenario_3'
  const [scenarioTimer, setScenarioTimer] = useState(null)

  // 시나리오 1 제한 시간 카운트다운 타이머 스레드
  useEffect(() => {
    if (phase !== 'play' || scenarioId !== 'scenario_1' || scenarioTimer === null) return
    if (typeof process !== 'undefined' && process.env.NODE_ENV === 'test') return // 테스트 환경 비활성화
    
    const interval = setInterval(() => {
      setScenarioTimer((prev) => {
        if (prev <= 1) {
          clearInterval(interval)
          setPhase('defeat') // 시간 초과 시 패배
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [phase, scenarioId, scenarioTimer])

  // 플레이어가 마주친 봇 동선 실시간 기록 (Deduction Affordance)
  useEffect(() => {
    if (phase !== 'play') return
    if (typeof process !== 'undefined' && process.env.NODE_ENV === 'test') return // 테스트 환경 비활성화
    const timer = setInterval(() => {
      const playerRoom = getRoomKeyAt(playerPos.x, playerPos.y)
      const roomLabel = MAP_ROOMS.find(r => r.key === playerRoom)?.label.split(' ')[0] || playerRoom

      players.forEach((p) => {
        if (p.isPlayer || p.isDead) return
        const dist = Math.hypot(p.x - playerPos.x, p.y - playerPos.y)
        // 110px 이내에 들어오면 마주침 기록
        if (dist < 110) {
          const timeStr = new Date().toLocaleTimeString('ko-KR', { hour12: false, minute: '2-digit', second: '2-digit' })
          
          setObservationLog((prev) => {
            // 이미 동일인에 대한 동일 방의 기록이 최근에 있으면 생략
            const duplicate = prev.some(log => log.name === p.name && log.room === roomLabel)
            if (duplicate) return prev
            
            // 최대 6개까지만 간결하게 기록 유지
            return [{ time: timeStr, name: p.name, room: roomLabel }, ...prev].slice(0, 6)
          })
        }
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [phase, playerPos, players])

  // 현재 활성화된 미니게임 모달: null | 'wire' | 'swipe' | 'manifold' | 'data' | 'sabotage_panel'
  const [activeModal, setActiveModal] = useState(null)
  const [currentTaskNode, setCurrentTaskNode] = useState(null)

  // 미니게임 내부 세부 상태
  const [wireConnections, setWireConnections] = useState({}) // { leftIndex: rightIndex }
  const [selectedWireLeft, setSelectedWireLeft] = useState(null)
  const [swipeSpeedMsg, setSwipeSpeedMsg] = useState('카드를 긁어주세요')
  const [swipeLedState, setSwipeLedState] = useState('red') // red | green
  const [manifoldIndex, setManifoldIndex] = useState(1)
  const [manifoldNumbers, setManifoldNumbers] = useState([])
  const [dataProgress, setDataProgress] = useState(0)
  const [dataDownloading, setDataDownloading] = useState(false)

  // Canvas 레퍼런스
  const canvasRef = useRef(null)
  const mousePosRef = useRef({ x: 400, y: 250 })
  const isMouseDownRef = useRef(false)
  const vxRef = useRef(0)
  const vyRef = useRef(0)
  const chatEndRef = useRef(null)
  const [typingBotName, setTypingBotName] = useState(null)

  // 회의 채팅 자동 스크롤
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [chatMessages, typingBotName])

  // ---------------- BGM & 오디오 설정 ----------------
  useEffect(() => {
    if (bgmOn && (phase === 'play' || phase === 'intro')) {
      startBgm()
    } else {
      stopBgm()
    }
    return () => stopBgm()
  }, [bgmOn, phase])

  // 사보타지 사이렌 제어
  useEffect(() => {
    if (sabotageActive === 'reactor' && phase === 'play') {
      startSirenSFX()
    } else {
      stopSirenSFX()
    }
    return () => stopSirenSFX()
  }, [sabotageActive, phase])

  // 사보타지 오디오 필터 제어 (BGM 먹먹화)
  useEffect(() => {
    if (phase === 'play' && sabotageActive != null) {
      setSabotageFilter(true)
    } else {
      setSabotageFilter(false)
    }
    return () => setSabotageFilter(false)
  }, [sabotageActive, phase])

  // 원자로 타이머 카운트다운
  useEffect(() => {
    if (sabotageActive !== 'reactor' || phase !== 'play') return
    if (typeof process !== 'undefined' && process.env.NODE_ENV === 'test') return // 테스트 환경 비활성화
    const timer = setInterval(() => {
      setSabotageTimer((t) => {
        if (t <= 1) {
          clearInterval(timer)
          setPhase('defeat') // 시간 초과로 패배
          return 0
        }
        return t - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [sabotageActive, phase])

  // 킬 쿨다운 감소
  useEffect(() => {
    if (playerRole !== 'impostor' || phase !== 'play' || isVented) return
    if (typeof process !== 'undefined' && process.env.NODE_ENV === 'test') return // 테스트 환경 비활성화
    const timer = setInterval(() => {
      setKillCooldown((c) => Math.max(0, c - 1))
    }, 1000)
    return () => clearInterval(timer)
  }, [playerRole, phase, isVented])

  // ---------------- 키보드 입력 핸들러 ----------------
  useEffect(() => {
    const handleKeyDown = (e) => {
      setKeys((prev) => ({ ...prev, [e.key.toLowerCase()]: true }))
    }
    const handleKeyUp = (e) => {
      setKeys((prev) => ({ ...prev, [e.key.toLowerCase()]: false }))
    }
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [])

  // ---------------- 게임 초기 생성 ----------------
  function initGame(selectedRole, selectedScenarioId = 'free') {
    unlockAudio()
    setPlayerRole(selectedRole)
    setPlayerPos({ x: 400, y: 250 })
    setPlayerDead(false)
    setTasksCompleted([])
    setCompletedTasksCount(0)
    setDeadBodies([])
    setIsVented(false)
    setCurrentVent(null)
    setKillCooldown(typeof process !== 'undefined' && process.env.NODE_ENV === 'test' ? 0 : 10)
    setSabotageActive(null)
    setSabotageTimer(30)
    setObservationLog([])
    setMeetingTab('chat')
    setScenarioId(selectedScenarioId)
    setScenarioTimer(null)

    // 시나리오 1: 전등 상시 차단, 전기실 배선 미션 3개 강제 주입
    let customPersonalTasks = []
    if (selectedScenarioId === 'scenario_1') {
      setSabotageActive('lights')
      setScenarioTimer(90) // 90초 서바이벌
      
      const electricalTasks = TASKS.filter(t => t.room === 'electrical').slice(0, 3)
      customPersonalTasks = electricalTasks.map(t => ({ ...t, isDone: false }))
      setPersonalTasks(customPersonalTasks)
    } else {
      const shuffled = [...TASKS].sort(() => Math.random() - 0.5)
      customPersonalTasks = shuffled.slice(0, 3).map(t => ({ ...t, isDone: false }))
      setPersonalTasks(customPersonalTasks)
    }

    // 플레이어 정보 리뉴얼 및 봇 설정
    const updatedPlayers = CHARACTERS.map((char) => {
      let role = 'crewmate'
      if (selectedScenarioId === 'scenario_3') {
        role = char.isPlayer ? 'impostor' : 'crewmate'
      } else if (selectedScenarioId === 'scenario_2') {
        role = char.isPlayer ? 'crewmate' : 'crewmate'
      } else if (selectedRole === 'impostor') {
        role = char.isPlayer ? 'impostor' : 'crewmate'
      } else {
        const impostorId = Math.floor(Math.random() * 7) + 1 // 1 ~ 7
        role = char.id === impostorId ? 'impostor' : 'crewmate'
      }

      return {
        ...char,
        x: 150 + Math.random() * 500,
        y: 100 + Math.random() * 300,
        role,
        isDead: false,
        room: 'cafeteria',
        targetX: 400,
        targetY: 250,
        state: 'idle',
        taskTimer: 0,
        actionTimer: 3 + Math.random() * 5,
      }
    })

    // 시나리오 2: 항해실 밀실 살인 셋업
    if (selectedScenarioId === 'scenario_2') {
      const revisedPlayers = updatedPlayers.map((p) => {
        if (p.isPlayer) return p
        if (p.id === 1) {
          return { ...p, role: 'impostor', isDead: false, room: 'reactor', x: 100, y: 250 }
        }
        if (p.id === 2) {
          return { ...p, role: 'crewmate', isDead: false, room: 'admin', x: 650, y: 450 }
        }
        if (p.id === 3) {
          return { ...p, role: 'crewmate', isDead: false, room: 'electrical', x: 150, y: 450 }
        }
        return { ...p, isDead: true }
      })

      const deadVictim = revisedPlayers.find(p => p.id === 4)
      deadVictim.isDead = true
      deadVictim.room = 'navigation'
      deadVictim.x = 720
      deadVictim.y = 250
      
      const bodies = [{ x: 720, y: 250, roomId: 'navigation', victimId: 4 }]
      setDeadBodies(bodies)
      setPlayers(revisedPlayers)

      const logs = [
        { time: '14:28:10', name: '정현우', room: '원자로' },
        { time: '14:28:34', name: '이지아', room: '관리실' },
        { time: '14:28:50', name: '박태민', room: '전기실' }
      ]
      setObservationLog(logs)

      setPhase('meeting')
      setReporter(revisedPlayers.find(p => p.isPlayer))
      setMeetingDead(deadVictim)
      setPlayerVoted(false)
      setVotingComplete(false)
      setVotes({})
      setSelectedId(null)
      setChatFinished(false)

      const chatFeed = [
        { senderId: 4, name: '최수진 (시스템)', color: '#f97316', text: '🚨 항해실에서 시체가 발견되어 긴급 비상 회의가 소집되었습니다!' },
        { senderId: 1, name: '정현우', color: '#3b82f6', text: '난 사건이랑 멀리 떨어진 [산소실 (O2)]에 계속 있었어. 진짜 시민이라니까!' },
        { senderId: 2, name: '이지아', color: '#22c55e', text: '나도 [관리실 (Admin)]에서 미션하고 있었음. 진짜 시민이니까 날 의심하진 마.' },
        { senderId: 3, name: '박태민', color: '#eab308', text: '난 확실히 [전기실 (Electrical)]에 있었어. 미션하는 중이라 시체 못 봄. 정현우 구라치지마, 나 O2에 안 갔어.' }
      ]

      setChatMessages([])
      
      const chatInterval = 3200
      chatFeed.forEach((msg, idx) => {
        setTimeout(() => {
          if (msg.senderId !== 4) {
            setTypingBotName(msg.name)
          }
        }, idx * chatInterval + 400)

        setTimeout(() => {
          setChatMessages((prev) => [...prev, msg])
          setTypingBotName(null)
          playTypewriter()
        }, (idx + 1) * chatInterval)
      })

      setTimeout(() => {
        setChatFinished(true)
      }, chatFeed.length * chatInterval + 200)

      return
    }

    setPlayers(updatedPlayers)
    setPhase('play')
    playPaper()
  }

  // ---------------- 2D Canvas 드로잉 및 충돌 처리 루프 ----------------
  useEffect(() => {
    if (phase !== 'play') return
    if (typeof process !== 'undefined' && process.env.NODE_ENV === 'test') return // 테스트 환경 비활성화

    let animId
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')

    const loop = () => {
      // 1. 플레이어 이동 (물리 마찰/관성 적용하여 직관적 움직임 향상)
      let vx = vxRef.current
      let vy = vyRef.current
      const friction = 0.8 // 부드러운 감속 마찰계수

      let ax = 0
      let ay = 0

      if (!isVented && !playerDead && activeModal === null) {
        // 키보드 조작
        if (keys['w'] || keys['arrowup']) ay -= 0.55
        if (keys['s'] || keys['arrowdown']) ay += 0.55
        if (keys['a'] || keys['arrowleft']) ax -= 0.55
        if (keys['d'] || keys['arrowright']) ax += 0.55

        // 마우스 드래그 조작
        if (isMouseDownRef.current) {
          const m = mousePosRef.current
          const angle = Math.atan2(m.y - playerPos.y, m.x - playerPos.x)
          const dist = Math.hypot(m.x - playerPos.x, m.y - playerPos.y)
          if (dist > 15) {
            ax = Math.cos(angle) * 0.55
            ay = Math.sin(angle) * 0.55
          }
        }
      }

      // 속도 가속화 및 감속 마찰
      vx = (vx + ax) * friction
      vy = (vy + ay) * friction

      // 최고속도 제한
      const currentSpeed = Math.hypot(vx, vy)
      if (currentSpeed > PLAYER_SPEED) {
        vx = (vx / currentSpeed) * PLAYER_SPEED
        vy = (vy / currentSpeed) * PLAYER_SPEED
      }

      vxRef.current = vx
      vyRef.current = vy

      // 충돌 검사
      let nextX = playerPos.x + vx
      let nextY = playerPos.y + vy

      // 벽(WALLS) 충돌 제약 조건
      WALLS.forEach((wall) => {
        const padding = 12 // 플레이어 충돌 반경
        if (
          nextX + padding > wall.x &&
          nextX - padding < wall.x + wall.w &&
          nextY + padding > wall.y &&
          nextY - padding < wall.y + wall.h
        ) {
          if (playerPos.x + vx + padding <= wall.x || playerPos.x + vx - padding >= wall.x + wall.w) {
            nextX = playerPos.x
          }
          if (playerPos.y + vy + padding <= wall.y || playerPos.y + vy - padding >= wall.y + wall.h) {
            nextY = playerPos.y
          }
        }
      })

      // 맵 테두리 강제 바인딩
      nextX = Math.max(20, Math.min(CANVAS_WIDTH - 20, nextX))
      nextY = Math.max(20, Math.min(CANVAS_HEIGHT - 20, nextY))

      // 최종 플레이어 위치 설정
      if (vx !== 0 || vy !== 0) {
        setPlayerPos({ x: nextX, y: nextY })
      }

      // 2. AI 봇 행동 시뮬레이션 및 킬 로직
      setPlayers((prevPlayers) => {
        return prevPlayers.map((bot) => {
          if (bot.isPlayer) {
            return { ...bot, x: playerPos.x, y: playerPos.y, isDead: playerDead, room: getRoomKeyAt(playerPos.x, playerPos.y) }
          }
          if (bot.isDead) return bot

          let { x, y, targetX, targetY, state, actionTimer, taskTimer, role } = bot

          // 행동 타이머 감소
          actionTimer -= 0.016

          // [Usability Overhaul] 목격자 AI 감지 시스템
          // 봇이 크루원이고 시체를 목격한 경우 (비상 도주 전환)
          if (role === 'crewmate' && state !== 'runningToReport') {
            const spottedBody = deadBodies.find(b => Math.hypot(b.x - x, b.y - y) < 70)
            if (spottedBody) {
              state = 'runningToReport'
              targetX = 400
              targetY = 250
              actionTimer = 0.5

              // [Scenario 3 특수 패배 조건] 크루원에게 시체 발각 및 보고 도주 시 즉사 패배!
              if (scenarioId === 'scenario_3') {
                setTimeout(() => {
                  setPhase('defeat')
                }, 100)
              }
            }
          }

          // AI 상태 머신
          if (state === 'runningToReport') {
            const dist = Math.hypot(400 - x, 250 - y)
            if (dist < 18) {
              state = 'idle'
              actionTimer = 5.0
              // 긴급 회의 소집 벨 울림
              setTimeout(() => {
                triggerMeeting(null, bot)
              }, 50)
            } else {
              const angle = Math.atan2(250 - y, 400 - x)
              x += Math.cos(angle) * (PLAYER_SPEED * 0.9)
              y += Math.sin(angle) * (PLAYER_SPEED * 0.9)
            }
          } else if (state === 'idle' && actionTimer <= 0) {
            const targetRoom = MAP_ROOMS[Math.floor(Math.random() * MAP_ROOMS.length)]
            bot.room = targetRoom.key
            
            const roomTasks = TASKS.filter(t => t.room === targetRoom.key)
            if (roomTasks.length > 0 && Math.random() < 0.7) {
              const pickTask = roomTasks[Math.floor(Math.random() * roomTasks.length)]
              targetX = pickTask.x
              targetY = pickTask.y
            } else {
              targetX = targetRoom.x + (Math.random() - 0.5) * 40
              targetY = targetRoom.y + (Math.random() - 0.5) * 40
            }

            state = 'walking'
          } else if (state === 'walking') {
            const dist = Math.hypot(targetX - x, targetY - y)
            if (dist < 10) {
              state = Math.random() < 0.65 ? 'doingTask' : 'idle'
              taskTimer = 7.5 + Math.random() * 9.0 // 미션 수행에 7.5~16.5초 걸리도록 속도 조절
              actionTimer = 6.0 + Math.random() * 11.0 // 대기에 6~17초 걸려 마구 게이지가 오르지 않게 함
            } else {
              const angle = Math.atan2(targetY - y, targetX - x)
              x += Math.cos(angle) * (PLAYER_SPEED * 0.65) // 봇은 조금 더 느리게
              y += Math.sin(angle) * (PLAYER_SPEED * 0.65)
            }
          } else if (state === 'doingTask') {
            taskTimer -= 0.016
            if (taskTimer <= 0) {
              state = 'idle'
              if (bot.role === 'crewmate') {
                setCompletedTasksCount((prev) => {
                  const next = prev + 1
                  // [Usability Overhaul] 승리조건 강화: 플레이어 개인 미션도 모두 달성해야 함
                  const isCrew = playerRole === 'crewmate'
                  const allPersonalDone = personalTasks.every(t => t.isDone)
                  if (next >= 80 && (!isCrew || allPersonalDone)) {
                    setPhase('victory')
                  }
                  return next
                })
              }
            }
          }

          // 봇 임포스터 전용 킬 시뮬레이션
          if (role === 'impostor' && !bot.isDead) {
            const targetList = prevPlayers.filter(p => !p.isDead && p.role === 'crewmate')
            
            targetList.forEach((target) => {
              const distance = Math.hypot(target.x - x, target.y - y)
              if (distance < 35 && Math.random() < 0.02 && actionTimer <= 0) {
                target.isDead = true
                actionTimer = 20
                
                setDeadBodies((bodies) => [
                  ...bodies,
                  { x: target.x, y: target.y, roomId: getRoomKeyAt(target.x, target.y), victimId: target.id }
                ])

                if (target.isPlayer) {
                  playKillSFX()
                  setPlayerDead(true)
                  setVfxFlash('red')
                  setScreenShake('heavy')
                  setTimeout(() => {
                    setVfxFlash(null)
                    setScreenShake(null)
                  }, 500)
                } else {
                  playWhip()
                }
              }
            })
          }

          return { ...bot, x, y, state, actionTimer, taskTimer, targetX, targetY }
        })
      })

      // 3. 드로잉 연출
      ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)

      // 3-1. 맵 룸 바닥 그리기
      MAP_ROOMS.forEach((room) => {
        ctx.fillStyle = '#1e293b'
        ctx.strokeStyle = '#334155'
        ctx.lineWidth = 2
        
        ctx.beginPath()
        ctx.arc(room.x, room.y, room.size, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()

        ctx.fillStyle = '#64748b'
        ctx.font = 'bold 11px Pretendard'
        ctx.textAlign = 'center'
        ctx.fillText(room.label, room.x, room.y + 5)
      })

      // 복도 연결선
      ctx.strokeStyle = '#1e293b'
      ctx.lineWidth = 30
      ctx.beginPath()
      ctx.moveTo(400, 250)
      ctx.lineTo(150, 450)
      ctx.moveTo(400, 250)
      ctx.lineTo(100, 250)
      ctx.moveTo(400, 250)
      ctx.lineTo(650, 450)
      ctx.moveTo(400, 250)
      ctx.lineTo(550, 120)
      ctx.moveTo(400, 250)
      ctx.lineTo(720, 250)
      ctx.stroke()

      // 3-2. 벽(WALLS) 그리기
      ctx.fillStyle = '#475569'
      WALLS.forEach((wall) => {
        ctx.fillRect(wall.x, wall.y, wall.w, wall.h)
      })

      // 3-3. 벤트(VENTS) 환풍구 그리기
      VENTS.forEach((vent) => {
        ctx.fillStyle = '#374151'
        ctx.strokeStyle = '#4b5563'
        ctx.lineWidth = 3
        ctx.fillRect(vent.x - 14, vent.y - 8, 28, 16)
        
        ctx.strokeStyle = '#1f2937'
        ctx.lineWidth = 1.5
        for (let i = -10; i <= 10; i += 5) {
          ctx.beginPath()
          ctx.moveTo(vent.x + i, vent.y - 6)
          ctx.lineTo(vent.x + i, vent.y + 6)
          ctx.stroke()
        }
      })

      // 1-1. 최인접 미완료 임무에 대한 나침반 화살표 연출 (어포던스 직관성 대폭 보강)
      const activeTasks = TASKS.filter((t) => !tasksCompleted.includes(t.id))
      let nearestUncompletedTask = null
      let minDist = 99999
      activeTasks.forEach((t) => {
        const d = Math.hypot(t.x - playerPos.x, t.y - playerPos.y)
        if (d < minDist) {
          minDist = d
          nearestUncompletedTask = t
        }
      })

      if (nearestUncompletedTask && minDist > 85 && !playerDead && !isVented) {
        const angle = Math.atan2(nearestUncompletedTask.y - playerPos.y, nearestUncompletedTask.x - playerPos.x)
        const arrowDist = 26
        const ax = playerPos.x + Math.cos(angle) * arrowDist
        const ay = playerPos.y + Math.sin(angle) * arrowDist
        
        ctx.save()
        ctx.translate(ax, ay)
        ctx.rotate(angle)
        ctx.fillStyle = '#facc15' // 화사한 노란색 화살표
        ctx.beginPath()
        ctx.moveTo(8, 0)
        ctx.lineTo(-4, -5)
        ctx.lineTo(-4, 5)
        ctx.closePath()
        ctx.fill()
        ctx.restore()
      }

      // 3-4. 임무(TASKS) 기판 그리기
      TASKS.forEach((task) => {
        const isDone = tasksCompleted.includes(task.id)
        ctx.fillStyle = isDone ? '#10b981' : '#eab308'
        ctx.beginPath()
        ctx.arc(task.x, task.y, 8, 0, Math.PI * 2)
        ctx.fill()

        // 대상 임무가 활성화 영역 내에 진입한 경우, 노란색 네온 링 가이드라인 렌더링
        if (nearbyTask && nearbyTask.id === task.id && !isDone) {
          ctx.strokeStyle = '#fef08a'
          ctx.lineWidth = 3
          ctx.beginPath()
          ctx.arc(task.x, task.y, 14 + Math.abs(Math.sin(Date.now() / 150) * 4), 0, Math.PI * 2)
          ctx.stroke()
        } else {
          ctx.strokeStyle = isDone ? 'rgba(16, 185, 129, 0.4)' : 'rgba(234, 179, 8, 0.4)'
          ctx.lineWidth = 2
          ctx.beginPath()
          ctx.arc(task.x, task.y, 8 + Math.abs(Math.sin(Date.now() / 200) * 4), 0, Math.PI * 2)
          ctx.stroke()
        }
      })

      // 3-5. 소집 테이블
      ctx.fillStyle = '#334155'
      ctx.beginPath()
      ctx.arc(400, 250, 28, 0, Math.PI * 2)
      ctx.fill()
      
      ctx.fillStyle = '#dc2626'
      ctx.beginPath()
      ctx.arc(400, 250, 12, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = 'white'
      ctx.lineWidth = 1.5
      ctx.stroke()

      // 액션 가능 텍스트 힌트 렌더링 (HUD 정보 가독성 보강)
      if (nearbyTask && !playerDead && !isVented) {
        ctx.fillStyle = '#facc15'
        ctx.font = 'bold 10px Pretendard'
        ctx.textAlign = 'center'
        ctx.fillText('💡 [USE] 임무 시작', playerPos.x, playerPos.y - 42)
      } else if (nearEmergencyButton && !playerDead && !isVented) {
        ctx.fillStyle = '#ef4444'
        ctx.font = 'bold 10px Pretendard'
        ctx.textAlign = 'center'
        ctx.fillText('🚨 [USE] 긴급 회의 소집', playerPos.x, playerPos.y - 42)
      }

      // 3-6. 시체(Dead Body) 그리기
      deadBodies.forEach((body) => {
        const victim = CHARACTERS.find((c) => c.id === body.victimId)
        if (!victim) return
        
        ctx.save()
        ctx.translate(body.x, body.y)
        
        ctx.fillStyle = victim.color
        ctx.beginPath()
        ctx.arc(0, 5, 11, Math.PI, 0, false)
        ctx.lineTo(11, 10)
        ctx.lineTo(-11, 10)
        ctx.closePath()
        ctx.fill()

        ctx.fillStyle = '#ffffff'
        ctx.fillRect(-2.5, -4, 5, 8)
        
        ctx.beginPath()
        ctx.arc(-2, -4, 3, 0, Math.PI * 2)
        ctx.arc(2, -4, 3, 0, Math.PI * 2)
        ctx.fill()

        ctx.restore()
      })

      // 3-7. 캐릭터 드로잉
      players.forEach((char) => {
        if (char.isPlayer && isVented) return

        ctx.save()
        ctx.translate(char.x, char.y)

        if (char.isDead) {
          ctx.globalAlpha = 0.38
        }

        ctx.fillStyle = char.color
        ctx.fillRect(-17, -10, 8, 18)

        ctx.beginPath()
        ctx.arc(0, -6, 11, Math.PI, 0, false)
        ctx.lineTo(11, 8)
        ctx.lineTo(-11, 8)
        ctx.closePath()
        ctx.fill()

        ctx.fillRect(-9, 8, 7, 6)
        ctx.fillRect(2, 8, 7, 6)

        // 머리 부분을 원형 인물 초상화 이미지로 렌더링
        ctx.save()
        ctx.beginPath()
        ctx.arc(0, -10, 11, 0, Math.PI * 2)
        ctx.closePath()
        ctx.clip()

        const charImg = characterImagesRef.current[char.id]
        if (charImg) {
          ctx.drawImage(charImg, -11, -21, 22, 22)
        } else {
          ctx.fillStyle = '#64748b'
          ctx.fill()
        }
        ctx.restore()

        // 머리 테두리선
        ctx.strokeStyle = '#1e293b'
        ctx.lineWidth = 1.8
        ctx.beginPath()
        ctx.arc(0, -10, 11, 0, Math.PI * 2)
        ctx.stroke()

        ctx.globalAlpha = 1.0
        ctx.fillStyle = char.isPlayer ? '#22d55e' : 'white'
        ctx.font = 'bold 10px Pretendard'
        ctx.textAlign = 'center'
        ctx.fillText(char.name + (char.isDead ? ' (유령)' : ''), 0, -26)

        if (playerRole === 'impostor' && char.role === 'impostor' && !char.isPlayer) {
          ctx.fillStyle = '#ef4444'
          ctx.fillText('임포스터', 0, -36)
        }

        // [Usability Overhaul] 목격 도망자 표시기 ❗ 렌더링
        if (char.state === 'runningToReport' && !char.isDead) {
          ctx.fillStyle = '#ef4444'
          ctx.font = 'bold 16px Pretendard'
          ctx.fillText('❗', 0, -42)
        }

        ctx.restore()
      })

      // 3-8. 전등 차단
      if (sabotageActive === 'lights' && playerRole === 'crewmate') {
        ctx.save()
        ctx.fillStyle = 'rgba(0, 0, 0, 0.88)'
        ctx.beginPath()
        ctx.arc(playerPos.x, playerPos.y, 80, 0, Math.PI * 2, true)
        ctx.rect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
        ctx.fill()
        ctx.restore()
      }

      animId = requestAnimationFrame(loop)
    }

    loop()
    return () => cancelAnimationFrame(animId)
  }, [phase, playerPos, keys, players, tasksCompleted, deadBodies, isVented, activeModal, sabotageActive, playerDead])

  // ---------------- 헬퍼 ----------------
  function getRoomKeyAt(x, y) {
    let currentRoom = 'cafeteria'
    MAP_ROOMS.forEach((room) => {
      const dist = Math.hypot(room.x - x, room.y - y)
      if (dist < room.size) {
        currentRoom = room.key
      }
    })
    return currentRoom
  }

  const nearbyTask = TASKS.find((t) => {
    return Math.hypot(t.x - playerPos.x, t.y - playerPos.y) < 32
  })
  
  const nearbyVent = VENTS.find((v) => {
    return Math.hypot(v.x - playerPos.x, v.y - playerPos.y) < 30
  })

  const nearbyDeadBody = deadBodies.find((b) => {
    return Math.hypot(b.x - playerPos.x, b.y - playerPos.y) < 75
  })

  const nearbyCrewmate = players.find((p) => {
    return !p.isPlayer && !p.isDead && p.role === 'crewmate' && Math.hypot(p.x - playerPos.x, p.y - playerPos.y) < 35
  })

  const nearEmergencyButton = Math.hypot(400 - playerPos.x, 250 - playerPos.y) < 40

  // ---------------- 액션 핸들러 ----------------
  function handleUse() {
    if (nearEmergencyButton) {
      triggerMeeting(null, players.find(p => p.isPlayer))
      return
    }

    if (!nearbyTask) return
    setCurrentTaskNode(nearbyTask)
    
    if (nearbyTask.type === 'wire') {
      setWireConnections({})
      setSelectedWireLeft(null)
    } else if (nearbyTask.type === 'swipe') {
      setSwipeSpeedMsg('카드를 천천히 긁어주세요')
      setSwipeLedState('red')
    } else if (nearbyTask.type === 'manifold') {
      setManifoldIndex(1)
      const shuff = [1, 2, 3, 4, 5, 6, 7, 8, 9].sort(() => Math.random() - 0.5)
      setManifoldNumbers(shuff)
    } else if (nearbyTask.type === 'data') {
      setDataProgress(0)
      setDataDownloading(false)
    }
    
    setActiveModal(nearbyTask.type)
    playPaper()
  }

  function handleKill() {
    if (playerRole !== 'impostor' || killCooldown > 0 || !nearbyCrewmate) return

    playKillSFX()
    setVfxFlash('red')
    setScreenShake('heavy')
    setTimeout(() => {
      setVfxFlash(null)
      setScreenShake(null)
    }, 500)
    
    // 살인 현장 근처(120px)에 있던 다른 크루원 봇들은 도주 시작!
    setPlayers((prev) => prev.map((p) => {
      if (p.id === nearbyCrewmate.id) {
        return { ...p, isDead: true }
      }
      if (!p.isPlayer && !p.isDead && p.role === 'crewmate' && Math.hypot(p.x - nearbyCrewmate.x, p.y - nearbyCrewmate.y) < 120) {
        // [Scenario 3 특수 패배 조건] 살인 목격 즉시 패배!
        if (scenarioId === 'scenario_3') {
          setTimeout(() => {
            setPhase('defeat')
          }, 100)
        }
        return { ...p, state: 'runningToReport', targetX: 400, targetY: 250, actionTimer: 0.5 }
      }
      return p
    }))

    setDeadBodies((prev) => [
      ...prev,
      { x: nearbyCrewmate.x, y: nearbyCrewmate.y, roomId: getRoomKeyAt(nearbyCrewmate.x, nearbyCrewmate.y), victimId: nearbyCrewmate.id }
    ])

    setKillCooldown(15)
    checkWinConditions()
  }

  function handleVent() {
    if (playerRole !== 'impostor' || !nearbyVent) return
    playVentSFX()
    setScreenShake('soft')
    setTimeout(() => setScreenShake(null), 200)
    
    if (isVented) {
      setPlayerPos({ x: nearbyVent.x, y: nearbyVent.y })
      setIsVented(false)
      setCurrentVent(null)
    } else {
      setIsVented(true)
      setCurrentVent(nearbyVent)
    }
  }

  function handleVentMove(destVentId) {
    const dest = VENTS.find(v => v.id === destVentId)
    if (!dest) return
    playVentSFX()
    setScreenShake('soft')
    setTimeout(() => setScreenShake(null), 200)
    setCurrentVent(dest)
    setPlayerPos({ x: dest.x, y: dest.y })
  }

  function handleReport() {
    if (!nearbyDeadBody) return
    const reporterChar = players.find(p => p.isPlayer)
    const deadChar = players.find(p => p.id === nearbyDeadBody.victimId)
    
    triggerMeeting(deadChar, reporterChar)
  }

  // ---------------- 긴급 회의 트리거 ----------------
  function triggerMeeting(deadPlayer, reporterPlayer) {
    playEmergencySFX()
    setEmergencyType(deadPlayer ? 'report' : 'emergency')
    setShowEmergencyAlert(true)
    
    // 2800ms 동안 시네마틱 효과 진행 후 회의로 전환
    setTimeout(() => {
      setShowEmergencyAlert(false)
      setPhase('meeting')
    }, 2800)

    setReporter(reporterPlayer)
    setMeetingDead(deadPlayer)
    setPlayerVoted(false)
    setVotingComplete(false)
    setVotes({})
    setSelectedId(null)
    setChatFinished(false) // 대화 시작 시 미완료로 초기화

    const suspectList = players.filter(p => !p.isDead && p.id !== reporterPlayer.id)
    const killerNode = players.find(p => p.role === 'impostor')
    const chatFeed = generateChatMessages(deadPlayer, reporterPlayer, suspectList, killerNode ? killerNode.id : 1, players, playerRole)
    
    setChatMessages([])
    
    const chatDelay = 2800 // 회의 시작까지의 대기 시간
    const chatInterval = 3400
    
    chatFeed.forEach((msg, idx) => {
      // 봇이 타이핑을 입력하는 연출 개시
      setTimeout(() => {
        if (msg.senderId !== 0) {
          setTypingBotName(msg.name)
        }
      }, idx * chatInterval + 400 + chatDelay)

      // 메시지 등록 및 사운드 출력
      setTimeout(() => {
        setChatMessages((prev) => [...prev, msg])
        setTypingBotName(null)
        playTypewriter()
      }, (idx + 1) * chatInterval + chatDelay)
    })

    setSabotageActive(null)
    stopSirenSFX()

    // 모든 메시지가 등록 완료된 직후 대화 완료 플래그 활성화 (시간 기반 투표 강제 실행 제거)
    const totalChatDuration = chatFeed.length * chatInterval
    setTimeout(() => {
      setChatFinished(true)
    }, totalChatDuration + chatDelay + 200)
  }

  function handleUserVote(targetId) {
    if (playerVoted || votingComplete) return
    playHeartbeat()
    
    // 봇들의 투표를 즉시 난수로 생성하여 플레이어의 투표와 병합합니다. (시간 강제 흘러감 제거)
    const botsVote = {}
    const alivePlayers = players.filter(p => !p.isDead)
    const killer = players.find(p => p.role === 'impostor')

    alivePlayers.forEach((p) => {
      if (p.isPlayer) return
      if (killer && !killer.isDead && Math.random() < 0.4) {
        botsVote[p.id] = killer.id
      } else {
        botsVote[p.id] = Math.random() < 0.35 ? -1 : alivePlayers[Math.floor(Math.random() * alivePlayers.length)].id
      }
    })

    const finalVotes = { ...botsVote, 0: targetId }
    setVotes(finalVotes)
    setPlayerVoted(true)
    setVotingComplete(true) // 결과를 즉시 화면에 개표(뱃지 노출)하여 대조하도록 함
  }

  function proceedToEjection() {
    const voteCounts = {}
    let maxVotes = 0
    let maxVotedId = null
    let isTie = false

    Object.values(votes).forEach((target) => {
      if (target === -1) return
      voteCounts[target] = (voteCounts[target] || 0) + 1
      if (voteCounts[target] > maxVotes) {
        maxVotes = voteCounts[target]
        maxVotedId = target
        isTie = false
      } else if (voteCounts[target] === maxVotes) {
        isTie = true
      }
    })

    setPhase('ejection')
    playEjectSFX()

    let nextPhase = 'play'
    if (scenarioId === 'scenario_2') {
      nextPhase = (maxVotedId === 1 && !isTie) ? 'victory' : 'defeat'
    }

    if (maxVotedId !== null && !isTie) {
      const ejected = players.find(p => p.id === maxVotedId)
      setEjectedPlayer(ejected)
      
      const roleText = ejected.role === 'impostor' ? '임포스터였습니다.' : '임포스터가 아니었습니다.'
      typeWriteEjectionText(`[${ejected.name}]은(는) ${roleText}`, nextPhase)
      
      setPlayers((prev) => prev.map(p => p.id === maxVotedId ? { ...p, isDead: true } : p))
      if (ejected.isPlayer) {
        setPlayerDead(true)
      }
    } else {
      setEjectedPlayer(null)
      typeWriteEjectionText('아무도 방출되지 않았습니다. (투표 무효)', nextPhase)
    }
  }

  function typeWriteEjectionText(text, postEjectPhase = 'play') {
    let index = 0
    setEjectedText('')
    const timer = setInterval(() => {
      if (index < text.length) {
        setEjectedText((prev) => prev + text[index])
        playTypewriter()
        index++
      } else {
        clearInterval(timer)
        setTimeout(() => {
          if (postEjectPhase === 'victory') {
            setPhase('victory')
          } else if (postEjectPhase === 'defeat') {
            setPhase('defeat')
          } else {
            setPhase('play')
            checkWinConditions()
          }
        }, 3500)
      }
    }, 60)
  }

  // ---------------- 승리 및 패배 검증 ----------------
  function checkWinConditions() {
    setPlayers((currentPlayers) => {
      const aliveCrew = currentPlayers.filter(p => !p.isDead && p.role === 'crewmate')
      const aliveImpostor = currentPlayers.filter(p => !p.isDead && p.role === 'impostor')

      if (aliveImpostor.length === 0) {
        setPhase('victory')
      }
      else if (aliveCrew.length <= aliveImpostor.length) {
        setPhase('defeat')
      }
      
      return currentPlayers
    })
  }

  // ---------------- 임무 퍼즐 로직 ----------------
  function completeTask(taskId) {
    if (tasksCompleted.includes(taskId)) return
    
    playTaskSFX()
    const nextCompleted = [...tasksCompleted, taskId]
    setTasksCompleted(nextCompleted)
    setActiveModal(null)
    setCurrentTaskNode(null)

    // 개인 체크리스트 상태 업데이트
    setPersonalTasks((prev) => prev.map(t => t.id === taskId ? { ...t, isDone: true } : t))

    setCompletedTasksCount((prev) => {
      const next = prev + 1
      
      // [Usability Overhaul] 크루원 승리 조율: 전체 게이지 80개 + 개인 미션 모두 완료 (시나리오 1 승리 병행)
      const isCrew = playerRole === 'crewmate'
      const checkPersonalDone = personalTasks.every(t => t.id === taskId || t.isDone)

      if (scenarioId === 'scenario_1') {
        if (checkPersonalDone) {
          setPhase('victory')
        }
      } else {
        if (next >= 80 && (!isCrew || checkPersonalDone)) {
          setPhase('victory')
        }
      }
      return next
    })
  }

  function handleWireClick(leftIdx) {
    playPaper()
    setSelectedWireLeft(leftIdx)
  }

  function handleWireConnect(leftIdx, rightIdx) {
    const next = { ...wireConnections, [leftIdx]: rightIdx }
    setWireConnections(next)
    setSelectedWireLeft(null)
    playTaskSFX()

    if (Object.keys(next).length === 4) {
      setTimeout(() => {
        completeTask(currentTaskNode.id)
      }, 600)
    }
  }

  const swipeStartRef = useRef(0)
  function handleSwipeStart() {
    swipeStartRef.current = Date.now()
    playPaper()
  }

  function handleSwipeEnd(e) {
    const elapsed = Date.now() - swipeStartRef.current
    if (elapsed < 200) {
      setSwipeSpeedMsg('너무 빠릅니다! 다시 시도하세요.')
      setSwipeLedState('red')
      playWhip()
    } else if (elapsed > 550) {
      setSwipeSpeedMsg('너무 느립니다! 다시 시도하세요.')
      setSwipeLedState('red')
      playWhip()
    } else {
      setSwipeSpeedMsg('카드 스와이프 통과 완료!')
      setSwipeLedState('green')
      setTimeout(() => {
        completeTask(currentTaskNode.id)
      }, 1000)
    }
  }

  function handleManifoldClick(num) {
    if (num === manifoldIndex) {
      playTypewriter()
      const next = manifoldIndex + 1
      setManifoldIndex(next)
      if (next > 9) {
        completeTask(currentTaskNode.id)
      }
    } else {
      playWhip()
      setManifoldIndex(1)
    }
  }

  function startDataDownload() {
    if (dataDownloading) return
    setDataDownloading(true)
    playPaper()
    
    let current = 0
    const interval = setInterval(() => {
      current += 10
      setDataProgress(current)
      playTypewriter()

      if (current >= 100) {
        clearInterval(interval)
        completeTask(currentTaskNode.id)
      }
    }, 300)
  }

  function triggerSabotage(type) {
    playEmergencySFX()
    setSabotageActive(type)
    setSabotageTimer(30)
    setActiveModal(null)
  }

  function fixSabotage() {
    playTaskSFX()
    setSabotageActive(null)
    stopSirenSFX()
    setActiveModal(null)
  }

  // ---------------- UI 렌더링 ----------------

  if (phase === 'intro') {
    return (
      <div className="amongus-game-wrapper">
        <div className="app mystery">
          <header>
            <h1>🚀 어몽어스 우주선 게임</h1>
            <p className="sub">크루원이 되어 임무를 완수하거나, 임포스터가 되어 침투하세요!</p>
          </header>

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

          <div className="mystery-intro" style={{ display: 'flex', gap: '20px', maxWidth: '1000px', margin: '20px auto', justifyContent: 'center', alignItems: 'stretch', flexWrap: 'wrap' }}>
            
            {/* 왼쪽 조작 및 시작 패널 */}
            <div className="intro-left" style={{ flex: '1 1 290px', background: 'rgba(25, 29, 51, 0.85)', border: '1px solid rgba(124, 92, 255, 0.35)', padding: '20px', borderRadius: '16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', backdropFilter: 'blur(10px)' }}>
              <div>
                <div className="role-title" style={{ fontSize: '13px', fontWeight: 'bold', color: '#7c5cff', marginBottom: '16px', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '1.5px' }}>👥 플레이 역할 선택</div>
                <div className="role-btns" style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                  {scenarioId === 'free' ? (
                    <>
                      <button 
                        className={`role-btn crew ${playerRole === 'crewmate' ? 'active' : ''}`}
                        onClick={() => { playPaper(); setPlayerRole('crewmate') }}
                        style={{ flex: 1, padding: '14px', borderRadius: '10px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s ease', background: playerRole === 'crewmate' ? '#10b981' : '#1e293b', color: 'white', border: 'none' }}
                      >
                        🧑‍🚀 크루원
                      </button>
                      <button 
                        className={`role-btn impostor ${playerRole === 'impostor' ? 'active' : ''}`}
                        onClick={() => { playPaper(); setPlayerRole('impostor') }}
                        style={{ flex: 1, padding: '14px', borderRadius: '10px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s ease', background: playerRole === 'impostor' ? '#ef4444' : '#1e293b', color: 'white', border: 'none' }}
                      >
                        🔴 임포스터
                      </button>
                    </>
                  ) : (
                    <div style={{ flex: 1, padding: '12px', background: '#1e293b', border: '1px dashed #4b5563', borderRadius: '10px', fontSize: '11px', color: '#94a3b8', textAlign: 'center', lineHeight: '1.5' }}>
                      🔒 시나리오 고정 역할:<br />
                      <strong style={{ color: playerRole === 'impostor' ? '#ef4444' : '#10b981' }}>
                        {playerRole === 'impostor' ? '🔴 임포스터 (Impostor)' : '🧑‍🚀 크루원 (Crewmate)'}
                      </strong>
                    </div>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center' }}>
                <button 
                  className="btn difficulty" 
                  style={{ background: '#7c5cff', color: 'white', width: '100%', padding: '16px', borderRadius: '12px', fontSize: '15px', fontWeight: 'bold', boxShadow: '0 8px 24px rgba(124, 92, 255, 0.3)', border: 'none', cursor: 'pointer', transition: 'all 0.2s ease' }} 
                  onClick={() => initGame(playerRole, scenarioId)}
                >
                  🚀 우주선 탑승 (게임 시작)
                </button>
                
                <button 
                  className="btn bgm-toggle-btn" 
                  onClick={() => setBgmOn(!bgmOn)}
                  style={{ background: 'rgba(255, 255, 255, 0.08)', color: '#94a3b8', border: '1px solid rgba(255, 255, 255, 0.1)', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: '11px', transition: 'all 0.2s ease' }}
                >
                  {bgmOn ? '🎵 BGM 사운드 켬' : '🔇 BGM 끔'}
                </button>
              </div>
            </div>

            {/* 가운데 시나리오 캠페인 선택 패널 */}
            <div className="intro-middle" style={{ flex: '1 1 290px', background: 'rgba(25, 29, 51, 0.85)', border: '1px solid rgba(124, 92, 255, 0.35)', padding: '20px', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '8px', backdropFilter: 'blur(10px)', textAlign: 'left' }}>
              <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#7c5cff', marginBottom: '4px', borderBottom: '1px solid rgba(124,92,255,0.2)', paddingBottom: '6px', letterSpacing: '0.8px', textTransform: 'uppercase' }}>
                🎬 싱글 플레이 캠페인
              </div>
              
              <div 
                className={`scenario-card ${scenarioId === 'free' ? 'active' : ''}`}
                onClick={() => { playPaper(); setScenarioId('free') }}
                style={{ padding: '8px 12px', borderRadius: '10px', border: `1px solid ${scenarioId === 'free' ? '#7c5cff' : 'rgba(255,255,255,0.08)'}`, background: scenarioId === 'free' ? 'rgba(124,92,255,0.15)' : 'rgba(30,41,59,0.3)', cursor: 'pointer', transition: 'all 0.2s ease' }}
              >
                <div style={{ fontSize: '11px', fontWeight: 'bold', color: scenarioId === 'free' ? '#ffd54a' : '#e2e8f0' }}>🌐 자유 대전 모드 (Free Play)</div>
                <div style={{ fontSize: '9px', color: '#94a3b8', marginTop: '2px' }}>선원 8명이 펼치는 일반 룰 무작위 대전 모드</div>
              </div>

              <div 
                className={`scenario-card ${scenarioId === 'scenario_1' ? 'active' : ''}`}
                onClick={() => { playPaper(); setScenarioId('scenario_1'); setPlayerRole('crewmate') }}
                style={{ padding: '8px 12px', borderRadius: '10px', border: `1px solid ${scenarioId === 'scenario_1' ? '#60a5fa' : 'rgba(255,255,255,0.08)'}`, background: scenarioId === 'scenario_1' ? 'rgba(96,165,250,0.15)' : 'rgba(30,41,59,0.3)', cursor: 'pointer', transition: 'all 0.2s ease' }}
              >
                <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#60a5fa' }}>🌌 시나리오 1: 칠흑의 암흑 물질</div>
                <div style={{ fontSize: '9px', color: '#94a3b8', marginTop: '2px' }}>상시 전등 차단 ➡️ 90초 이내 전기실 배선 3개 복구하기 (난이도: ⭐⭐)</div>
              </div>

              <div 
                className={`scenario-card ${scenarioId === 'scenario_2' ? 'active' : ''}`}
                onClick={() => { playPaper(); setScenarioId('scenario_2'); setPlayerRole('crewmate') }}
                style={{ padding: '8px 12px', borderRadius: '10px', border: `1px solid ${scenarioId === 'scenario_2' ? '#34d399' : 'rgba(255,255,255,0.08)'}`, background: scenarioId === 'scenario_2' ? 'rgba(52,211,153,0.15)' : 'rgba(30,41,59,0.3)', cursor: 'pointer', transition: 'all 0.2s ease' }}
              >
                <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#34d399' }}>🕵️ 시나리오 2: 항해실 밀실 살인</div>
                <div style={{ fontSize: '9px', color: '#94a3b8', marginTop: '2px' }}>회의 즉시 돌입 ➡️ 알리바이 비교 후 진범 1회 검거 (난이도: ⭐⭐⭐)</div>
              </div>

              <div 
                className={`scenario-card ${scenarioId === 'scenario_3' ? 'active' : ''}`}
                onClick={() => { playPaper(); setScenarioId('scenario_3'); setPlayerRole('impostor') }}
                style={{ padding: '8px 12px', borderRadius: '10px', border: `1px solid ${scenarioId === 'scenario_3' ? '#f87171' : 'rgba(255,255,255,0.08)'}`, background: scenarioId === 'scenario_3' ? 'rgba(248,113,113,0.15)' : 'rgba(30,41,59,0.3)', cursor: 'pointer', transition: 'all 0.2s ease' }}
              >
                <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#f87171' }}>🤫 시나리오 3: 침묵의 어쌔신</div>
                <div style={{ fontSize: '9px', color: '#94a3b8', marginTop: '2px' }}>임포스터 플레이 ➡️ 비상보고 발각 시 즉시 패배 (난이도: ⭐⭐⭐⭐)</div>
              </div>
            </div>

            {/* 오른쪽 인터랙티브 규칙 가이드 보드 */}
            <div className="intro-right" style={{ flex: '1.2 1 340px', background: 'rgba(15, 23, 42, 0.5)', border: '1px solid rgba(124, 92, 255, 0.15)', padding: '20px', borderRadius: '16px', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#7c5cff', marginBottom: '4px', borderBottom: '1px solid rgba(124,92,255,0.2)', paddingBottom: '6px', letterSpacing: '0.8px', textTransform: 'uppercase' }}>
                📖 게임 핵심 가이드 (How to Play)
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ background: 'rgba(30, 41, 59, 0.5)', padding: '8px 12px', borderRadius: '8px', fontSize: '10px', lineHeight: '1.5', borderLeft: '3px solid #60a5fa', color: '#e2e8f0' }}>
                  <div style={{ fontWeight: 'bold', color: '#60a5fa', marginBottom: '2px' }}>🕹️ 조작 방법 (Controls)</div>
                  - **이동**: 키보드 `W, A, S, D` 또는 방향키 / 마우스 누른 채 드래그<br />
                  - **USE 상호작용**: 기판 접근 ➡️ **키보드 `E`키** 또는 USE 버튼
                </div>

                <div style={{ background: 'rgba(30, 41, 59, 0.5)', padding: '8px 12px', borderRadius: '8px', fontSize: '10px', lineHeight: '1.5', borderLeft: '3px solid #34d399', color: '#e2e8f0' }}>
                  <div style={{ fontWeight: 'bold', color: '#34d399', marginBottom: '2px' }}>🧑‍🚀 크루원 미션 (Crewmate)</div>
                  - **개인 임무**: 좌측 포스트잇 **'나의 임무 목록' 3개**를 지도에서 해결<br />
                  - **승리**: 협동 임무 80개 완성 및 투표 회의에서 임포스터 색출
                </div>

                <div style={{ background: 'rgba(30, 41, 59, 0.5)', padding: '8px 12px', borderRadius: '8px', fontSize: '10px', lineHeight: '1.5', borderLeft: '3px solid #f87171', color: '#e2e8f0' }}>
                  <div style={{ fontWeight: 'bold', color: '#f87171', marginBottom: '2px' }}>🔴 임포스터 미션 (Impostor)</div>
                  - **암살**: 은밀히 접근해 `KILL`로 처단. `VENT` 환풍구 텔레포트 활용
                </div>
                
                <div style={{ background: 'rgba(30, 41, 59, 0.5)', padding: '8px 12px', borderRadius: '8px', fontSize: '10px', lineHeight: '1.5', borderLeft: '3px solid #fbbf24', color: '#e2e8f0' }}>
                  <div style={{ fontWeight: 'bold', color: '#fbbf24', marginBottom: '2px' }}>🗣️ 의심 투표 & 알리바이 대조</div>
                  - **[동선 일치 대조표] 탭**을 활용해 용의자의 말과 내 목격 로그 비교!
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    )
  }

  if (phase === 'victory' || phase === 'defeat') {
    return (
      <div className="amongus-game-wrapper">
        <div className="app mystery" style={{ textAlign: 'center', color: 'white' }}>
          <div style={{ fontSize: '72px', marginTop: '60px' }}>
            {phase === 'victory' ? '🏆' : '💀'}
          </div>
          <h1 style={{ fontSize: '48px', color: phase === 'victory' ? '#10b981' : '#ef4444', margin: '20px 0' }}>
            {phase === 'victory' ? 'VICTORY' : 'DEFEAT'}
          </h1>
          <p style={{ fontSize: '18px', color: '#9ca3af', marginBottom: '40px' }}>
            {phase === 'victory' 
              ? '크루원들이 임포스터를 성공적으로 색출했거나 임무를 완수했습니다!'
              : '임포스터가 크루원들을 모두 해치웠거나 사보타지가 폭발했습니다!'}
          </p>
          <button className="btn difficulty" style={{ background: '#3b82f6', color: 'white' }} onClick={() => setPhase('intro')}>
            메인화면으로 복귀
          </button>
        </div>
      </div>
    )
  }

  if (phase === 'ejection') {
    return (
      <div className="amongus-game-wrapper">
        <div className="ejection-overlay">
          <div className="ejection-space-background">
            {Array.from({ length: 40 }).map((_, i) => (
              <div 
                key={i} 
                className="ejection-star" 
                style={{
                  width: `${1 + Math.random() * 2}px`,
                  height: `${1 + Math.random() * 2}px`,
                  top: `${Math.random() * 100}vh`,
                  left: `${Math.random() * 100}vw`,
                  animationDelay: `${Math.random() * 3}s`,
                  animationDuration: `${2 + Math.random() * 3}s`
                }}
              />
            ))}
          </div>
          <div className="ejecting-character-node">
            {ejectedPlayer ? (
              ejectedPlayer.image ? (
                <img src={ejectedPlayer.image} alt={ejectedPlayer.name} className="suspect-card-img" style={{ width: '120px', height: '120px', borderRadius: '50%', objectFit: 'cover', border: '3px solid #7c5cff' }} />
              ) : (
                ejectedPlayer.emoji
              )
            ) : (
              '👤'
            )}
          </div>
          <div className="ejection-text-box">
            {ejectedText}
          </div>
        </div>
      </div>
    )
  }

  if (phase === 'meeting') {
    const alivePlayers = players.filter(p => !p.isDead)
    
    return (
      <div className="amongus-game-wrapper">
        <div className="app mystery">
          <div className="meeting-screen">
            <div className="meeting-header">
              <h1 style={{ color: '#ef4444' }}>
                {meetingDead ? '🚨 DEAD BODY REPORTED' : '🔔 EMERGENCY MEETING'}
              </h1>
              <p className="sub" style={{ color: '#64748b' }}>
                선원들과 대화하여 의심스러운 인물에게 투표하십시오.
              </p>
            </div>

            <div className="meeting-layout">
              <div className="meeting-players-grid">
                {players.map((char) => {
                  const isSelected = selectedId === char.id
                  const charVotes = Object.values(votes).filter(v => v === char.id).length
                  
                  return (
                    <div 
                      key={char.id}
                      className={`meeting-player-card ${char.isDead ? 'dead' : ''} ${isSelected ? 'selected' : ''}`}
                      onClick={() => !char.isDead && !playerVoted && setSelectedId(char.id)}
                    >
                      <div className="meeting-player-color" style={{ background: char.color, position: 'relative', overflow: 'hidden', borderRadius: '50%' }}>
                        {char.image ? (
                          <img src={char.image} alt={char.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : null}
                      </div>
                      <span className="meeting-player-name">{char.name}</span>
                      
                      {votes[0] === char.id && playerVoted && (
                        <span className="voted-marker">🎯</span>
                      )}

                      {votingComplete && charVotes > 0 && (
                        <span className="meeting-player-vote-badge">
                          득표 {charVotes}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>

              <div className="meeting-chat-panel">
                {/* 탭 헤더 (토론 챗 vs 알리바이 요약 대조표) */}
                <div className="meeting-tabs-header" style={{ display: 'flex', borderBottom: '1px solid #334155', marginBottom: '10px' }}>
                  <button 
                    className={`meeting-tab-btn ${meetingTab === 'chat' ? 'active' : ''}`}
                    onClick={() => setMeetingTab('chat')}
                    style={{ flex: 1, padding: '10px', background: meetingTab === 'chat' ? '#1e293b' : 'transparent', border: 'none', color: meetingTab === 'chat' ? '#e2e8f0' : '#64748b', cursor: 'pointer', fontWeight: 'bold' }}
                  >
                    💬 토론 피드
                  </button>
                  <button 
                    className={`meeting-tab-btn ${meetingTab === 'alibi' ? 'active' : ''}`}
                    onClick={() => setMeetingTab('alibi')}
                    style={{ flex: 1, padding: '10px', background: meetingTab === 'alibi' ? '#1e293b' : 'transparent', border: 'none', color: meetingTab === 'alibi' ? '#e2e8f0' : '#64748b', cursor: 'pointer', fontWeight: 'bold' }}
                  >
                    📋 동선 일치 대조표
                  </button>
                </div>

                {meetingTab === 'chat' ? (
                  <>
                    <div className="chat-messages" style={{ height: '280px' }}>
                      {chatMessages.map((msg, i) => (
                        <div key={i} className={`chat-bubble ${msg.senderId === 0 ? 'user' : 'bot'}`}>
                          <div className="chat-bubble-name" style={{ color: msg.color }}>
                            {msg.name}
                          </div>
                          <div>{msg.text}</div>
                        </div>
                      ))}
                      
                      {typingBotName && (
                        <div className="chat-bubble typing-indicator-bubble" style={{ background: '#1e293b', border: '1px dashed #475569', display: 'flex', alignItems: 'center', opacity: 0.8 }}>
                          <span className="typing-dot" style={{ animation: 'dot-blink 1.4s infinite both', fontSize: '14px', fontWeight: 'bold' }}>.</span>
                          <span className="typing-dot" style={{ animation: 'dot-blink 1.4s infinite both', animationDelay: '0.2s', fontSize: '14px', fontWeight: 'bold' }}>.</span>
                          <span className="typing-dot" style={{ animation: 'dot-blink 1.4s infinite both', animationDelay: '0.4s', fontSize: '14px', fontWeight: 'bold' }}>.</span>
                          <span style={{ fontSize: '10px', color: '#94a3b8', marginLeft: '6px' }}>
                            {typingBotName}님이 메시지를 작성 중입니다
                          </span>
                        </div>
                      )}
                      <div ref={chatEndRef} />
                    </div>

                    {!playerVoted && (
                      chatFinished ? (
                        <div className="chat-options-grid">
                          <button className="chat-option-btn" onClick={() => {
                            const msg = { senderId: 0, name: 'Red (나)', color: '#ef4444', text: '아무 근거 없네, skip 하자.' }
                            setChatMessages(prev => [...prev, msg])
                            handleUserVote(-1)
                          }}>
                            🗳️ 스킵 (Skip)
                          </button>
                          {alivePlayers.filter(p => !p.isPlayer).slice(0, 3).map((bot) => (
                            <button key={bot.id} className="chat-option-btn" onClick={() => {
                              const msg = { senderId: 0, name: 'Red (나)', color: '#ef4444', text: `내가 봤어! [${bot.name}]가 확실히 수상해!` }
                              setChatMessages(prev => [...prev, msg])
                              handleUserVote(bot.id)
                            }}>
                              👉 [{bot.name}] 지목
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div style={{ padding: '12px', color: '#94a3b8', fontSize: '11px', textAlign: 'center', background: '#1e293b', borderRadius: '8px', border: '1px dashed #475569' }}>
                          💬 선원들의 대화와 알리바이가 완전히 보고될 때까지 분석 중입니다...
                        </div>
                      )
                    )}
                  </>
                ) : (
                  <div className="meeting-alibi-panel" style={{ display: 'flex', flexDirection: 'column', gap: '15px', height: '360px', overflowY: 'auto', padding: '5px 10px' }}>
                    {/* 봇들의 알리바이 진술 요약 */}
                    <div className="alibi-log-section">
                      <div style={{ color: '#7c5cff', fontWeight: 'bold', fontSize: '11px', marginBottom: '8px', borderBottom: '1px solid rgba(124,92,255,0.2)', paddingBottom: '3px', letterSpacing: '1px' }}>
                        👤 용의자 진술 현황 (Alibi Claims)
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {alivePlayers.filter(p => !p.isPlayer).map(p => {
                          // 챗 피드에서 봇의 알리바이 문자열 추출
                          const botClaim = chatMessages.find(m => m.name === p.name && (m.text.includes('방에') || m.text.includes('에서') || m.text.includes('에 있었')))
                          const locationText = botClaim ? botClaim.text : '대기실 대기 중 (특이 진술 없음)'
                          return (
                            <div key={p.id} style={{ background: '#1e293b', padding: '6px 10px', borderRadius: '8px', fontSize: '11px', display: 'flex', flexDirection: 'column', gap: '2px', borderLeft: `3px solid ${p.color}` }}>
                              <span style={{ fontWeight: 'bold', color: p.color }}>{p.name}</span>
                              <span style={{ color: '#e2e8f0', opacity: 0.9 }}>{locationText}</span>
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    {/* 플레이어 실시간 동선 목격 기록 */}
                    <div className="my-observation-section">
                      <div style={{ color: '#eab308', fontWeight: 'bold', fontSize: '11px', marginBottom: '8px', borderBottom: '1px solid rgba(234,179,8,0.2)', paddingBottom: '3px', letterSpacing: '1px' }}>
                        📝 내 수사 메모 (Pass-by Logs)
                      </div>
                      {observationLog.length === 0 ? (
                        <div style={{ fontSize: '11px', color: '#64748b', textAlign: 'center', padding: '15px 0' }}>
                          최근 마주친 선원이 없습니다. (이동 중 스쳐 지나간 인물이 자동 기록됩니다)
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                          {observationLog.map((log, idx) => (
                            <div key={idx} style={{ fontSize: '11px', color: '#e2e8f0', background: 'rgba(234,179,8,0.06)', padding: '5px 8px', borderRadius: '6px', borderLeft: '3px solid #eab308' }}>
                              <span style={{ color: '#94a3b8', marginRight: '6px' }}>[{log.time}]</span>
                              <span style={{ fontWeight: 'bold' }}>{log.name}</span>를 📍{log.room}에서 목격함
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="meeting-vote-action-bar">
              {playerVoted && votingComplete ? (
                <button 
                  className="btn" 
                  style={{ background: '#22d55e', color: 'white', fontWeight: 'bold', padding: '12px 28px', border: 'none', borderRadius: '8px', cursor: 'pointer', boxShadow: '0 4px 12px rgba(34,213,94,0.35)' }}
                  onClick={proceedToEjection}
                >
                  👉 회의 결과 개표 및 우주 방출 진행
                </button>
              ) : (
                <>
                  <span>
                    {playerVoted ? '⏳ 다른 선원들의 투표 마감을 대기 중입니다...' : '🗳️ 용의자를 클릭한 뒤 스킵 또는 투표하십시오.'}
                  </span>
                  {!playerVoted && selectedId !== null && (
                    <button 
                      className="btn" 
                      style={{ background: '#eab308', color: 'black', fontWeight: 'bold', marginLeft: '12px' }}
                      onClick={() => handleUserVote(selectedId)}
                    >
                      투표 확정 (Vote)
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  const progressPercent = Math.min(100, Math.round((completedTasksCount / 80) * 100))

  return (
    <div className={`amongus-game-wrapper ${screenShake ? `screen-shake-${screenShake}` : ''}`}>
      {/* 글로벌 VFX 플래시 스크린 */}
      {vfxFlash && <div className={`vfx-flash-overlay ${vfxFlash}`} />}

      {/* 비상 회의 (Emergency Meeting) 시네마틱 오버레이 */}
      {showEmergencyAlert && (
        <div className="emergency-meeting-alert">
          <div className="emergency-light-bg" />
          <div className="emergency-alarm-icon">🚨</div>
          <div className="emergency-meeting-title">
            {emergencyType === 'report' ? 'DEAD BODY REPORTED' : 'EMERGENCY MEETING'}
          </div>
          <div className="emergency-meeting-subtitle">
            {emergencyType === 'report' ? '선원이 시체를 발견하여 긴급 보고했습니다!' : '비상 회의 소집 벨이 울렸습니다!'}
          </div>
        </div>
      )}

      <div className="app mystery">
        {/* 인게임 볼륨 조절 슬라이더 */}
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

        <div className="game-container">
          <div className="game-header" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
              <span style={{ fontSize: '12px', fontWeight: 'bold', marginRight: '10px' }}>임무 달성률:</span>
              <div className="task-progress-bar">
                <div className="task-progress-fill" style={{ width: `${progressPercent}%` }} />
                <span className="task-progress-text">{completedTasksCount} / 80 ({progressPercent}%)</span>
              </div>
              {playerDead && <span style={{ color: '#ef4444', fontWeight: '900', fontSize: '13px', marginLeft: '12px' }}>👻 사망 (유령 상태)</span>}
            </div>

            {scenarioId === 'scenario_1' && scenarioTimer !== null && (
              <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(239, 68, 68, 0.1)', padding: '6px 12px', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.3)', width: 'fit-content' }}>
                <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#ef4444', marginRight: '8px' }}>⏱️ 전기실 탈출 제한시간:</span>
                <span style={{ fontSize: '13px', fontWeight: '900', color: '#ef4444', fontFamily: 'monospace' }}>{scenarioTimer}초</span>
              </div>
            )}
            
            {scenarioId === 'scenario_3' && (
              <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(239, 68, 68, 0.15)', padding: '6px 12px', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.3)', width: 'fit-content' }}>
                <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#f87171' }}>🤫 암살 지령: 목격자 봇이 식당 비상 버튼에 도달하기 전에 처단하십시오! (들킬 시 패배)</span>
              </div>
            )}
          </div>

          {sabotageActive === 'reactor' && (
            <div className="sabotage-alarm-bar">
              ⚠️ 붕괴 위기: 원자로 붕괴 발생! ({sabotageTimer}초 남음)
            </div>
          )}

          {/* 📋 개인 미션 홀로그램 카드 (HUD) */}
          {!playerDead && phase === 'play' && (
            <div className={`personal-tasks-card ${playerRole === 'impostor' ? 'impostor' : ''}`}>
              <div className="tasks-card-title">
                {playerRole === 'impostor' ? '🔴 암살 및 공작 지령' : '🧑‍🚀 나의 임무 목록'}
              </div>
              <ul className="tasks-card-list">
                {playerRole === 'impostor' ? (
                  <>
                    <li className={players.filter(p => !p.isDead && p.role === 'crewmate').length <= players.filter(p => !p.isDead && p.role === 'impostor').length ? 'done' : ''}>
                      <span className="task-check">💀</span> 크루원 처단 (남은: {players.filter(p => !p.isDead && p.role === 'crewmate').length}명)
                    </li>
                    <li className={sabotageActive ? 'done' : ''}>
                      <span className="task-check">⚙️</span> 사보타지 활성화 (방해 공작)
                    </li>
                    <li className={isVented ? 'done' : ''}>
                      <span className="task-check">🌀</span> 벤트 활용 기습 침투
                    </li>
                  </>
                ) : (
                  personalTasks.map((t) => (
                    <li key={t.id} className={t.isDone ? 'done' : ''}>
                      <span className="task-check">{t.isDone ? '✅' : '📌'}</span>
                      {t.label} ({MAP_ROOMS.find(r => r.key === t.room)?.label.split(' ')[0] || t.room})
                    </li>
                  ))
                )}
              </ul>
            </div>
          )}

          <div className="canvas-wrapper" style={{ position: 'relative' }}>
            {/* 전술 HUD 비저 뷰포트 테두리 브래킷 */}
            <div className="hud-viewport-brackets" />
            <div className="hud-viewport-corners" />

            {/* 사보타지 활성화 시 적색 펄싱 비네팅 오버레이 */}
            {sabotageActive && <div className="sabotage-warning-overlay" />}
            {sabotageActive && <div className="vfx-sabotage-vignette" />}

            <canvas
              ref={canvasRef}
              width={CANVAS_WIDTH}
              height={CANVAS_HEIGHT}
              className="game-canvas"
              onMouseDown={(e) => {
                isMouseDownRef.current = true
                const rect = canvasRef.current.getBoundingClientRect()
                mousePosRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top }
              }}
              onMouseMove={(e) => {
                if (!isMouseDownRef.current) return
                const rect = canvasRef.current.getBoundingClientRect()
                mousePosRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top }
              }}
              onMouseUp={() => isMouseDownRef.current = false}
              onMouseLeave={() => isMouseDownRef.current = false}
            />

            {isVented && currentVent && (
              <div className="vent-nav-overlay">
                {currentVent.connectsTo.map((destId) => {
                  const dest = VENTS.find(v => v.id === destId)
                  if (!dest) return null
                  return (
                    <button
                      key={destId}
                      className="vent-arrow"
                      style={{ left: `${dest.x - 22}px`, top: `${dest.y - 22}px` }}
                      onClick={() => handleVentMove(destId)}
                    >
                      ➡️
                    </button>
                  )
                })}
              </div>
            )}

            {/* 통합 전술 콘솔 액션 패널 */}
            <div className="action-buttons-overlay">
              {sabotageActive && !playerDead && (
                <button className="action-btn sabotage" onClick={() => setActiveModal('sabotage_panel')}>
                  ⚙️ 수리
                </button>
              )}

              <button 
                className="action-btn report" 
                disabled={!nearbyDeadBody}
                onClick={handleReport}
              >
                🔊 REPORT
              </button>

              {playerRole === 'impostor' && !playerDead && (
                <button 
                  className="action-btn vent" 
                  disabled={!nearbyVent}
                  onClick={handleVent}
                >
                  {isVented ? '🚪 나감' : '🌀 벤트'}
                </button>
              )}

              {playerRole === 'impostor' && !playerDead && (
                <button 
                  className="action-btn kill" 
                  disabled={!nearbyCrewmate || killCooldown > 0 || isVented}
                  onClick={handleKill}
                >
                  💀 KILL<br />
                  {killCooldown > 0 ? `(${killCooldown}s)` : ''}
                </button>
              )}

              {playerRole === 'impostor' && !playerDead && !isVented && (
                <button className="action-btn sabotage" onClick={() => setActiveModal('sabotage_panel')}>
                  💥 방해
                </button>
              )}

              <button 
                className="action-btn use" 
                disabled={(!nearbyTask && !nearEmergencyButton) || playerDead || isVented}
                onClick={handleUse}
              >
                👉 USE
              </button>
            </div>
          </div>
        </div>

        {activeModal && (
          <div className="task-modal-overlay">
            <div className="task-modal-content">
              <button className="task-modal-close" onClick={() => { playPaper(); setActiveModal(null); setCurrentTaskNode(null); }}>
                ✖
              </button>
              
              {activeModal === 'wire' && (
                <>
                  <h3>🔌 배선 복구 임무</h3>
                  <p className="sub">왼쪽 단자와 오른쪽 단자의 일치하는 색상을 이으십시오.</p>
                  <div className="wires-game-container">
                    <div className="wire-side">
                      {['#ef4444', '#3b82f6', '#eab308', '#ec4899'].map((color, i) => (
                        <div 
                          key={i} 
                          className="wire-node" 
                          style={{ background: color, borderColor: selectedWireLeft === i ? 'white' : '#475569' }} 
                          onClick={() => handleWireClick(i)}
                        />
                      ))}
                    </div>
                    
                    <svg className="wires-svg-canvas">
                      {Object.entries(wireConnections).map(([left, right]) => {
                        const colors = ['#ef4444', '#3b82f6', '#eab308', '#ec4899']
                        const y1 = 30 + left * 60
                        const y2 = 30 + right * 60
                        return (
                          <line 
                            key={left} 
                            x1="30" y1={y1} 
                            x2="280" y2={y2} 
                            stroke={colors[left]} 
                            strokeWidth="5" 
                          />
                        )
                      })}
                    </svg>

                    <div className="wire-side">
                      {[
                        { idx: 2, color: '#eab308' },
                        { idx: 0, color: '#ef4444' },
                        { idx: 3, color: '#ec4899' },
                        { idx: 1, color: '#3b82f6' }
                      ].map((item, rightIdx) => (
                        <div 
                          key={rightIdx} 
                          className="wire-node" 
                          style={{ background: item.color }} 
                          onClick={() => selectedWireLeft !== null && handleWireConnect(selectedWireLeft, item.idx)}
                        />
                      ))}
                    </div>
                  </div>
                </>
              )}

              {activeModal === 'swipe' && (
                <>
                  <h3>💳 카드 단말기 통과 임무</h3>
                  <p className="sub">지갑 속 카드를 오른쪽으로 적정 속도로 밀어 긁어내세요.</p>
                  <div className="swipe-game-container">
                    <div className="swipe-reader-slot">
                      <div className={`swipe-led ${swipeLedState === 'green' ? 'success' : ''}`} />
                    </div>
                    <div className="swipe-drag-track">
                      <div 
                        className="swipe-card-element"
                        draggable
                        onDragStart={handleSwipeStart}
                        onDragEnd={handleSwipeEnd}
                      >
                        💳 ID CARD
                      </div>
                    </div>
                    <p style={{ marginTop: '16px', fontWeight: 'bold', color: swipeLedState === 'green' ? '#10b981' : '#f87171' }}>
                      {swipeSpeedMsg}
                    </p>
                  </div>
                </>
              )}

              {activeModal === 'manifold' && (
                <>
                  <h3>🔢 매니폴드 해제 임무</h3>
                  <p className="sub">1부터 9까지의 숫자를 순서대로 터치하십시오.</p>
                  <div className="manifold-game-container">
                    {manifoldNumbers.map((num, i) => {
                      const isPassed = num < manifoldIndex
                      return (
                        <button 
                          key={i} 
                          className={`manifold-btn ${isPassed ? 'success' : ''}`}
                          onClick={() => !isPassed && handleManifoldClick(num)}
                        >
                          {num}
                        </button>
                      )
                    })}
                  </div>
                </>
              )}

              {activeModal === 'data' && (
                <>
                  <h3>💾 데이터 업로드 임무</h3>
                  <p className="sub">다운로드 버튼을 클릭하고 우주선 안테나 송신을 대기하십시오.</p>
                  <div className="data-game-container">
                    <div className="data-transfer-bar-bg">
                      <div className="data-transfer-bar-fill" style={{ width: `${dataProgress}%` }} />
                      <span className="data-transfer-bar-text">{dataProgress}% 완료</span>
                    </div>
                    <button 
                      className="btn" 
                      style={{ background: '#10b981', color: 'white', fontWeight: 'bold' }}
                      disabled={dataDownloading} 
                      onClick={startDataDownload}
                    >
                      {dataDownloading ? '네트워크 전송 중...' : '데이터 송신 시작'}
                    </button>
                  </div>
                </>
              )}

              {activeModal === 'sabotage_panel' && (
                <>
                  <h3>💥 {playerRole === 'impostor' ? '파괴 공작 발동기' : '사보타지 긴급 대응장치'}</h3>
                  
                  {playerRole === 'impostor' ? (
                    <div className="sabotage-grid">
                      <button 
                        className="sabotage-panel-btn" 
                        disabled={sabotageActive !== null}
                        onClick={() => triggerSabotage('reactor')}
                      >
                        ☢️ 원자로 붕괴<br />
                        <span style={{ fontSize: '10px' }}>(30초 타임오버 패배 유도)</span>
                      </button>
                      <button 
                        className="sabotage-panel-btn" 
                        disabled={sabotageActive !== null}
                        onClick={() => triggerSabotage('lights')}
                      >
                        💡 전등 차단<br />
                        <span style={{ fontSize: '10px' }}>(크루원 시야 대폭 차단)</span>
                      </button>
                    </div>
                  ) : (
                    <div style={{ marginTop: '20px' }}>
                      <p style={{ color: '#ef4444', fontWeight: 'bold', marginBottom: '20px' }}>
                        경보: {sabotageActive === 'reactor' ? '원자로 멜트다운 경보!' : '전력 기판 오프라인!'}
                      </p>
                      <button 
                        className="btn" 
                        style={{ background: '#10b981', color: 'white', fontWeight: 'bold' }}
                        onClick={fixSabotage}
                      >
                        🛠️ 기판 수리 완료하기
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
