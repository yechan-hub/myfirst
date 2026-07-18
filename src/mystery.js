// 추리 게임 사건 생성기 (고도화 버전)
// 용의자들에게 무작위 특징을 부여하고, 범인을 한 명으로 특정할 수 있는
// 참인 단서 목록을 만들어 낸다.

export const SUSPECT_POOL = [
  { emoji: '👨‍💼', name: '김정우', image: './images/suspect_1.png' },
  { emoji: '👨‍🔬', name: '정현우', image: './images/suspect_2.png' },
  { emoji: '👩‍⚕️', name: '이지아', image: './images/suspect_3.png' },
  { emoji: '👨‍💼', name: '박태민', image: './images/suspect_4.png' },
  { emoji: '👩‍💼', name: '최수진', image: './images/suspect_5.png' },
  { emoji: '👩‍🍳', name: '한소희', image: './images/suspect_6.png' },
  { emoji: '👨‍🎨', name: '강동원', image: './images/suspect_7.png' },
  { emoji: '👩‍🎤', name: '윤아름', image: './images/suspect_8.png' },
]

export const SCENARIOS = [
  { icon: '🍰', title: '사라진 딸기 케이크', desc: '파티에 내놓을 딸기 케이크가 감쪽같이 사라졌다! 부엌에는 포크 자국만 남아 있는데…' },
  { icon: '🏺', title: '깨진 도자기 화분', desc: '저택에서 가장 아끼던 화분이 산산조각 났다. 범인은 이 안에 있다!' },
  { icon: '🗝️', title: '없어진 금색 열쇠', desc: '금고를 여는 유일한 열쇠가 사라졌다. 사건 당시 저택에는 이들뿐이었다.' },
  { icon: '🖼️', title: '낙서된 초상화', desc: '거실에 걸린 초상화에 콧수염 낙서가! 물감이 아직 마르지 않았다.' },
  { icon: '🧦', title: '한 짝만 남은 양말', desc: '빨래통에서 양말 한 짝이 계속 사라진다. 오늘이야말로 범인을 잡는다!' },
  { icon: '🎨', title: '미술관 도난 사건', desc: '유명 화가의 명화가 감쪽같이 위작과 바꿔치기당했다. 물감 냄새가 아직 가시지 않았는데…' },
  { icon: '🧪', title: '연구실 독극물 사건', desc: '새로 개발된 백신 샘플이 일반 증류수로 바뀌어 있었다. 긴급 연구실 봉쇄!' },
  { icon: '💎', title: '은행 강도 사건', desc: 'VIP 대여금고에 보관되어 있던 100캐럿 다이아몬드가 가짜 유리알로 대체되었다.' },
]

export const ALL_CATEGORIES = [
  { key: 'place', label: '목격 장소', icon: '📍', values: ['주방', '거실', '서재', '정원'] },
  { key: 'time', label: '알리바이 시간', icon: '🕒', values: ['14:00', '18:00', '22:00', '02:00'] },
  { key: 'footprint', label: '발자국 크기', icon: '👣', values: ['240mm', '260mm', '280mm'] },
  { key: 'motive', label: '범행 동기', icon: '💡', values: ['돈을 노림', '질투와 원망', '우발적 충동', '복수심'] },
  { key: 'item', label: '소지품', icon: '🎒', values: ['우산', '책', '찻잔', '꽃'] },
  { key: 'color', label: '옷 색깔', icon: '👕', values: ['빨간색', '파란색', '노란색', '초록색'] },
  { key: 'glasses', label: '안경 여부', icon: '👓', values: ['안경 씀', '안경 없음'] },
]

const PLACE_ACTIVITY = {
  주방: '요리를 하고 있었어요',
  거실: '텔레비전을 보고 있었어요',
  서재: '책을 읽고 있었어요',
  정원: '꽃에 물을 주고 있었어요',
}

// 받침 유무에 따라 조사 선택 (예: 책→을, 우산→을, 꽃→을, 찻잔→을 / 여우→는)
function josa(word, withBatchim, withoutBatchim) {
  const code = word.charCodeAt(word.length - 1)
  if (code < 0xac00 || code > 0xd7a3) return withBatchim
  return (code - 0xac00) % 28 ? withBatchim : withoutBatchim
}

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]

function clueText(kind, cat, value, suspect) {
  if (kind === 'witness')
    return `${suspect.name}${josa(suspect.name, '이는', '는')} 확실한 알리바이가 있다. 범인이 아니다!`
  switch (cat.key) {
    case 'place':
      return kind === 'pos'
        ? `범인은 사건 직전 [${value}]에서 목격됐다.`
        : `[${value}]에 있던 사람은 범인이 아니다.`
    case 'time':
      return kind === 'pos'
        ? `목격자의 증언: "범행 추정 시각인 [${value}] 경에 현장 근처를 지나가는 범인을 봤어요!"`
        : `수사 결과, [${value}]에 확실한 알리바이가 있는 인물은 범인이 아니다.`
    case 'footprint':
      return kind === 'pos'
        ? `현장에서 [${value}] 크기의 발자국이 선명하게 발견되었다.`
        : `피해자의 증언: "범인의 발자국은 [${value}] 크기가 아닌 것 같습니다."`
    case 'motive':
      return kind === 'pos'
        ? `단서 분석: "범인은 이번 일로 [${value}]의 동기를 가졌을 가능성이 높다."`
        : `수사 결과, [${value}]의 동기를 가진 사람은 사건과 무관하다.`
    case 'item':
      return kind === 'pos'
        ? `범인은 [${value}]${josa(value, '을', '를')} 들고 있었다.`
        : `[${value}]${josa(value, '을', '를')} 소지한 사람은 결백하다.`
    case 'color':
      return kind === 'pos'
        ? `목격자의 증언: "범인은 [${value}] 옷을 입고 있었어요!"`
        : `[${value}] 옷을 입은 사람은 범인이 아니다.`
    case 'glasses':
      return value === '안경 씀' ? '범인은 안경을 쓰고 있었다.' : '범인은 안경을 쓰지 않았다.'
    default:
      return ''
  }
}

// 범인을 유일하게 특정할 때까지 참인 단서를 하나씩 고른다.
function buildClues(suspects, culprit, activeCategories) {
  let remaining = [...suspects]
  const clues = []
  let guard = 0

  while (remaining.length > 1 && guard++ < 60) {
    const options = []
    for (const cat of activeCategories) {
      const cv = culprit[cat.key]
      const posElim = remaining.filter((s) => s[cat.key] !== cv).length
      if (posElim > 0)
        options.push({ kind: 'pos', cat, value: cv, remainAfter: remaining.length - posElim })
      if (cat.key !== 'glasses') {
        for (const v of new Set(remaining.map((s) => s[cat.key]))) {
          if (v === cv) continue
          const elim = remaining.filter((s) => s[cat.key] === v).length
          options.push({ kind: 'neg', cat, value: v, remainAfter: remaining.length - elim })
        }
      }
    }

    // 초반 단서는 한 방에 풀리지 않도록 용의자를 2명 이상 남기는 것을 우선
    let pool = options
    if (clues.length < 2) {
      const gentle = options.filter((o) => o.remainAfter >= 2)
      if (gentle.length) pool = gentle
    }

    let choice
    if (pool.length) {
      choice = pick(pool)
    } else {
      // 특징만으로 좁힐 수 없으면 목격자 단서로 무고한 한 명을 제외
      const innocent = pick(remaining.filter((s) => s.id !== culprit.id))
      choice = { kind: 'witness', suspect: innocent }
    }

    let test
    if (choice.kind === 'pos') test = (s) => s[choice.cat.key] === choice.value
    else if (choice.kind === 'neg') test = (s) => s[choice.cat.key] !== choice.value
    else test = (s) => s.id !== choice.suspect.id

    remaining = remaining.filter(test)
    clues.push({
      id: clues.length,
      icon: choice.kind === 'witness' ? '🗣️' : choice.cat.icon,
      text: clueText(choice.kind, choice.cat, choice.value, choice.suspect),
      test,
    })
  }
  return clues
}

export function makeCase(numSuspects) {
  // 1. 목격 장소는 추리/심문의 기준이 되므로 항상 포함
  const placeCat = ALL_CATEGORIES.find((c) => c.key === 'place')
  // 2. 나머지 카테고리 중 무작위로 3개를 골라 이번 판의 단서 특성으로 지정 (총 4개)
  const remainingCats = ALL_CATEGORIES.filter((c) => c.key !== 'place')
  const selectedCats = shuffle(remainingCats).slice(0, 3)
  const activeCategories = [placeCat, ...selectedCats]

  const numValues = numSuspects <= 4 ? 3 : 4
  const suspects = shuffle(SUSPECT_POOL)
    .slice(0, numSuspects)
    .map((base, i) => {
      const s = { ...base, id: i }
      for (const cat of activeCategories) {
        const values = cat.key === 'glasses' ? cat.values : cat.values.slice(0, numValues)
        s[cat.key] = pick(values)
      }
      return s
    })
  const culprit = pick(suspects)

  // 심문용 알리바이: 무고한 이는 실제 목격 장소를 진술(진실),
  // 범인은 목격 장소가 아닌 다른 곳을 댄다(거짓).
  const placeValues = placeCat.values.slice(0, numValues)
  for (const s of suspects) {
    if (s.id === culprit.id) {
      s.claimedPlace = pick(placeValues.filter((v) => v !== s.place))
    } else {
      s.claimedPlace = s.place
    }
  }

  return {
    scenario: pick(SCENARIOS),
    suspects,
    culpritId: culprit.id,
    clues: buildClues(suspects, culprit, activeCategories),
    activeCategories,
  }
}

// 용의자를 심문했을 때의 알리바이 진술과 증거 일치 여부
export function interrogate(suspect) {
  const consistent = suspect.claimedPlace === suspect.place
  
  // 무고한 사람: 평온하고 자연스러운 진술
  const innocentStatements = [
    `저는 사건 당일에 ${suspect.claimedPlace}에서 ${PLACE_ACTIVITY[suspect.claimedPlace]}. 진짜예요!`,
    `그땐 확실히 ${suspect.claimedPlace}에 있었고, ${PLACE_ACTIVITY[suspect.claimedPlace]}. 다른 목격자도 있을 겁니다.`,
    `아, 당시에는 제가 ${suspect.claimedPlace}에 있었는데요. 거기서 ${PLACE_ACTIVITY[suspect.claimedPlace]}느라 정신이 없었죠.`
  ]

  // 범인: 말을 더듬고 식은땀을 흘림
  const culpritStatements = [
    `저, 저는... 그 당시에는... 어... ${suspect.claimedPlace}에서... ${PLACE_ACTIVITY[suspect.claimedPlace]}...요. 지, 진짜입니다!`,
    `그게... 사실은 당시 ${suspect.claimedPlace}에 있었습니다... 거기서 ${PLACE_ACTIVITY[suspect.claimedPlace]}... 믿어주세요!`,
    `에이, 설마 저를...? 전 그 시간에 ${suspect.claimedPlace}에 가서... ${PLACE_ACTIVITY[suspect.claimedPlace]}. 결백합니다!`
  ]

  const rawStatement = consistent 
    ? innocentStatements[suspect.id % innocentStatements.length]
    : culpritStatements[suspect.id % culpritStatements.length]

  return {
    claimedPlace: suspect.claimedPlace,
    statement: `"${rawStatement}"`,
    expression: consistent ? '🙂' : '😰', // 취조실 묘사용 표정
    statusText: consistent ? '비교적 침착함' : '식은땀을 흘리며 눈치를 봄',
    consistent, // true = 진술이 목격 위치와 일치(결백), false = 모순(범인)
  }
}

export function attributeChips(suspect, activeCategories) {
  return activeCategories.map((cat) => ({
    icon: cat.icon,
    label: suspect[cat.key],
    key: cat.key
  }))
}
