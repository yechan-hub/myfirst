// 어몽어스 게임 상수 및 로직 헬퍼 (Among Us Clone Data & Logic - 독립 파일 버전)

export const CHARACTERS = [
  { id: 0, name: '김정우 (나)', color: '#ef4444', label: '빨강', isPlayer: true, emoji: '🔴', image: './images/suspect_1.png' },
  { id: 1, name: '정현우', color: '#3b82f6', label: '파랑', emoji: '🔵', image: './images/suspect_2.png' },
  { id: 2, name: '이지아', color: '#22c55e', label: '초록', emoji: '🟢', image: './images/suspect_3.png' },
  { id: 3, name: '박태민', color: '#eab308', label: '노랑', emoji: '🟡', image: './images/suspect_4.png' },
  { id: 4, name: '최수진', color: '#f97316', label: '오렌지', emoji: '🟠', image: './images/suspect_5.png' },
  { id: 5, name: '한소희', color: '#a855f7', label: '보라', emoji: '🟣', image: './images/suspect_6.png' },
  { id: 6, name: '강동원', color: '#ec4899', label: '핑크', emoji: '🌸', image: './images/suspect_7.png' },
  { id: 7, name: '윤아름', color: '#1f2937', label: '검정', emoji: '⚫', image: './images/suspect_8.png' },
]

export const MAP_ROOMS = [
  { key: 'cafeteria', label: '식당 (Cafeteria)', x: 400, y: 250, size: 90 },
  { key: 'electrical', label: '전기실 (Electrical)', x: 150, y: 450, size: 70 },
  { key: 'reactor', label: '원자로 (Reactor)', x: 100, y: 250, size: 70 },
  { key: 'admin', label: '관리실 (Admin)', x: 650, y: 450, size: 75 },
  { key: 'o2', label: '산소실 (O2)', x: 550, y: 120, size: 60 },
  { key: 'navigation', label: '항해실 (Navigation)', x: 720, y: 250, size: 65 },
]

// 임무(Task) 노드 목록
export const TASKS = [
  { id: 't_wire_elec', type: 'wire', label: '배선 수리', room: 'electrical', x: 130, y: 430 },
  { id: 't_wire_o2', type: 'wire', label: '배선 수리', room: 'o2', x: 560, y: 110 },
  { id: 't_swipe_admin', type: 'swipe', label: '카드 스와이기', room: 'admin', x: 640, y: 460 },
  { id: 't_data_cafeteria', type: 'data', label: '데이터 전송', room: 'cafeteria', x: 420, y: 200 },
  { id: 't_data_nav', type: 'data', label: '데이터 전송', room: 'navigation', x: 740, y: 230 },
  { id: 't_manifold_reactor', type: 'manifold', label: '매니폴드 해제', room: 'reactor', x: 80, y: 230 },
]

// 벤트(Vent) 환풍구 노드 목록
export const VENTS = [
  { id: 'v_reactor', room: 'reactor', x: 90, y: 270, connectsTo: ['v_elec', 'v_nav'] },
  { id: 'v_elec', room: 'electrical', x: 170, y: 470, connectsTo: ['v_reactor', 'v_admin'] },
  { id: 'v_admin', room: 'admin', x: 670, y: 470, connectsTo: ['v_elec', 'v_nav'] },
  { id: 'v_nav', room: 'navigation', x: 740, y: 270, connectsTo: ['v_reactor', 'v_admin'] },
]

// 단순 사각 장애물 벽 목록
export const WALLS = [
  { x: 0, y: 0, w: 800, h: 20 },
  { x: 0, y: 480, w: 800, h: 20 },
  { x: 0, y: 0, w: 20, h: 500 },
  { x: 780, y: 0, w: 20, h: 500 },
  { x: 260, y: 20, w: 40, h: 200 },
  { x: 500, y: 20, w: 40, h: 180 },
  { x: 200, y: 320, w: 180, h: 40 },
  { x: 440, y: 320, w: 180, h: 40 },
  { x: 80, y: 380, w: 40, h: 100 },
  { x: 680, y: 380, w: 40, h: 100 },
]

// 봇들의 회의 대화 내용 생성기 (시민은 사실대로, 임포스터는 거짓말로 변론하여 난이도 상향)
export function generateChatMessages(deadPlayer, reporter, suspects, culpritId, players, playerRole) {
  const messages = []
  const addMsg = (sender, text) => {
    messages.push({
      senderId: sender.id,
      name: sender.name,
      color: sender.color,
      text,
    })
  }

  // 임포스터 캐릭터 객체 확보
  const impostor = players.find(p => p.role === 'impostor')
  const isImpostorAlive = impostor && !impostor.isDead

  // 1. 소집/리포트 최초 제보
  if (deadPlayer) {
    const deadName = deadPlayer.name
    const foundRoom = deadPlayer.room ? MAP_ROOMS.find(r => r.key === deadPlayer.room)?.label || deadPlayer.room : '전기실'
    addMsg(reporter, `🚨 [${deadName}]의 시체를 [${foundRoom}]에서 리포트합니다!`)
  } else {
    addMsg(reporter, `🔔 긴급 회의! 수상한 동선이 감지되어 버튼을 눌렀습니다.`)
  }

  // 2. 다른 선원들의 반응
  const remainingBots = players.filter(p => p.id !== reporter.id && !p.isDead && !p.isPlayer)
  const shuffBots = [...remainingBots].sort(() => Math.random() - 0.5)

  if (shuffBots.length > 0) {
    addMsg(shuffBots[0], deadPlayer ? "어디서 나온 거지? 다들 동선 불어봐." : "누구 의심되는 동선 있어?")
  }

  // 3. 시민들의 사실 근거 진술
  // 살아있는 시민 봇들은 자신의 실제 방 위치를 사실대로 진술함
  const aliveCrewBots = players.filter(p => !p.isDead && p.role === 'crewmate' && p.id !== reporter.id && !p.isPlayer)
  const shuffCrews = [...aliveCrewBots].sort(() => Math.random() - 0.5)

  if (shuffCrews.length > 0) {
    const rLabel = MAP_ROOMS.find(r => r.key === shuffCrews[0].room)?.label || '식당'
    addMsg(shuffCrews[0], `난 확실히 [${rLabel}]에 있었어. 미션하는 중이라 시체 못 봄.`)
  }
  if (shuffCrews.length > 1) {
    const rLabel2 = MAP_ROOMS.find(r => r.key === shuffCrews[1].room)?.label || '관리실'
    addMsg(shuffCrews[1], `나도 [${rLabel2}]에서 미션하고 있었음. 진짜 시민이니까 날 의심하진 마.`)
  }

  // 4. 임포스터의 지능적 거짓말 진술 (알리바이 날조)
  if (isImpostorAlive) {
    if (impostor.isPlayer) {
      // 플레이어가 임포스터인 경우 사용자가 선택할 것이므로 자동 대사 제외
    } else {
      // 봇 임포스터: 자신이 가지 않았던 룸들 중 하나를 골라 거짓말
      const bodyRoom = deadPlayer ? deadPlayer.room : 'electrical'
      const fakeRooms = MAP_ROOMS.filter(r => r.key !== bodyRoom && r.key !== impostor.room)
      const fakeRoomLabel = fakeRooms.length > 0 ? fakeRooms[Math.floor(Math.random() * fakeRooms.length)].label : '산소실'
      
      // 무고한 다른 시민 한 명을 지칭해 알리바이 동조 거짓말
      const targetInnocent = players.find(p => !p.isDead && p.role === 'crewmate' && !p.isPlayer)
      const companionText = targetInnocent ? ` 아까 가면서 [${targetInnocent.name}]를 살짝 마주쳤던 것 같아.` : ''

      const lies = [
        `나? 난 사건이랑 멀리 떨어진 [${fakeRoomLabel}]에 계속 있었어. 진짜 시민이라니까!${companionText}`,
        `난 [${fakeRoomLabel}]에서 전선 배선 수리 중이었어. 거기가 내 동선이었음. 난 결백해!`,
        `시체 위치랑 완전히 반대인 [${fakeRoomLabel}]에서 데이터 미션 중이었음. 내 알리바이는 확실함.`
      ]
      addMsg(impostor, lies[Math.floor(Math.random() * lies.length)])
    }
  }

  // 5. 목격 증언 및 교차 의심 (추리의 고도화)
  // 시민이 범인 혹은 벤트 목격을 했는지 체크 (50% 확률로 임포스터 고발 또는 변론 분기)
  const witnessChance = Math.random() < 0.5
  if (isImpostorAlive && witnessChance && shuffBots.length > 1) {
    const witness = shuffBots[Math.floor(Math.random() * shuffBots.length)]
    if (witness.id !== impostor.id) {
      const accuses = [
        `난 [${impostor.name}]가 너무 의심스러워. 킬각 재려고 내 주위를 맴돌던데?`,
        `아까 원자로 근처 지나갈 때 [${impostor.name}] 동선이 되게 묘하게 꼬여 있었어.`,
        `아무래도 [${impostor.name}]가 범인 같아. 시체 근처에서 본 것 같음.`
      ]
      addMsg(witness, accuses[Math.floor(Math.random() * accuses.length)])

      // 임포스터의 강렬한 반박 거짓말
      if (!impostor.isPlayer) {
        const rebuttals = [
          `말도 안 돼! [${witness.name}]가 나한테 독단적으로 프레임 씌우는 거야. 네가 진짜 킬러지?`,
          `참나, 나 진짜 시민이야! 왜 가만히 조용히 있던 나를 몰고 가는 거야? 억울해!`,
          `난 내 동선대로 미션 다 끝냈어! [${witness.name}]가 억까하는 거 보니까 임포스터인 게 확실하네.`
        ]
        addMsg(impostor, rebuttals[Math.floor(Math.random() * rebuttals.length)])
      }
    }
  } else {
    // 벤트 타거나 처단하는 목격담 제보
    if (isImpostorAlive && shuffBots.length > 2) {
      const witness = shuffBots[2]
      if (witness.id !== impostor.id && Math.random() < 0.4) {
        addMsg(witness, `잠깐, 나 원자로에서 [${impostor.name}]가 벤트로 순간이동 하는 거 목격함! 진짜로!`)
        if (!impostor.isPlayer) {
          addMsg(impostor, `무슨 소리야? 난 벤트 탄 적도 없어! 날 모함해서 방출시키려는 속셈이네.`)
        }
      }
    }
  }

  return messages
}
