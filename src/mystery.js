// 추리 게임 사건 생성기
// 용의자들에게 무작위 특징을 부여하고, 범인을 한 명으로 특정할 수 있는
// 참인 단서 목록을 만들어 낸다 (모든 단서는 진실이며, 조합하면 유일해).

export const SUSPECT_POOL = [
  { emoji: '🦊', name: '여우' },
  { emoji: '🐸', name: '개구리' },
  { emoji: '🐼', name: '판다' },
  { emoji: '🦖', name: '공룡' },
  { emoji: '🐙', name: '문어' },
  { emoji: '🦄', name: '유니콘' },
  { emoji: '🐺', name: '늑대' },
  { emoji: '🐨', name: '코알라' },
]

export const SCENARIOS = [
  { icon: '🍰', title: '사라진 딸기 케이크', desc: '파티에 내놓을 딸기 케이크가 감쪽같이 사라졌다! 부엌에는 포크 자국만 남아 있는데…' },
  { icon: '🏺', title: '깨진 도자기 화분', desc: '저택에서 가장 아끼던 화분이 산산조각 났다. 범인은 이 안에 있다!' },
  { icon: '🗝️', title: '없어진 금색 열쇠', desc: '금고를 여는 유일한 열쇠가 사라졌다. 사건 당시 저택에는 이들뿐이었다.' },
  { icon: '🖼️', title: '낙서된 초상화', desc: '거실에 걸린 초상화에 콧수염 낙서가! 물감이 아직 마르지 않았다.' },
  { icon: '🧦', title: '한 짝만 남은 양말', desc: '빨래통에서 양말 한 짝이 계속 사라진다. 오늘이야말로 범인을 잡는다!' },
]

const CATEGORIES = [
  { key: 'place', label: '목격 장소', icon: '📍', values: ['주방', '거실', '서재', '정원'] },
  { key: 'item', label: '소지품', icon: '🎒', values: ['우산', '책', '찻잔', '꽃'] },
  { key: 'color', label: '옷 색깔', icon: '👕', values: ['빨간색', '파란색', '노란색', '초록색'] },
  { key: 'glasses', label: '안경', icon: '👓', values: ['씀', '안 씀'] },
]

// 심문 시 용의자가 대는 알리바이 문장에 쓰이는 장소별 행동
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
        ? `범인은 사건 직전 ${value}에서 목격됐다.`
        : `${value}에 있던 사람은 범인이 아니다.`
    case 'item':
      return kind === 'pos'
        ? `범인은 ${value}${josa(value, '을', '를')} 들고 있었다.`
        : `${value}${josa(value, '을', '를')} 든 사람은 결백하다.`
    case 'color':
      return kind === 'pos'
        ? `목격자의 증언: "범인은 ${value} 옷을 입고 있었어요!"`
        : `${value} 옷을 입은 사람은 범인이 아니다.`
    case 'glasses':
      return value === '씀' ? '범인은 안경을 쓰고 있었다.' : '범인은 안경을 쓰지 않았다.'
    default:
      return ''
  }
}

// 범인을 유일하게 특정할 때까지 참인 단서를 하나씩 고른다.
function buildClues(suspects, culprit) {
  let remaining = [...suspects]
  const clues = []
  let guard = 0

  while (remaining.length > 1 && guard++ < 60) {
    const options = []
    for (const cat of CATEGORIES) {
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
  // 용의자 수가 적으면 특징 값 종류도 줄여 서로 겹치게 만든다 (추리 재미 보장)
  const numValues = numSuspects <= 4 ? 3 : 4
  const suspects = shuffle(SUSPECT_POOL)
    .slice(0, numSuspects)
    .map((base, i) => {
      const s = { ...base, id: i }
      for (const cat of CATEGORIES) {
        const values = cat.key === 'glasses' ? cat.values : cat.values.slice(0, numValues)
        s[cat.key] = pick(values)
      }
      return s
    })
  const culprit = pick(suspects)

  // 심문용 알리바이: 무고한 이는 실제 목격 장소를 진술(진실),
  // 범인은 목격 장소가 아닌 다른 곳을 댄다(거짓). 증거(카드의 📍장소)와
  // 대조하면 오직 범인만 진술이 어긋난다.
  const placeValues = CATEGORIES[0].values.slice(0, numValues)
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
    clues: buildClues(suspects, culprit),
  }
}

// 용의자를 심문했을 때의 알리바이 진술과 증거 일치 여부
export function interrogate(suspect) {
  const consistent = suspect.claimedPlace === suspect.place
  return {
    claimedPlace: suspect.claimedPlace,
    statement: `"저는 사건 당시 ${suspect.claimedPlace}에서 ${PLACE_ACTIVITY[suspect.claimedPlace]}."`,
    consistent, // true = 진술이 목격 위치와 일치(결백), false = 모순(범인)
  }
}

export function attributeChips(suspect) {
  return CATEGORIES.map((cat) => ({
    icon: cat.icon,
    label: cat.key === 'glasses' ? (suspect.glasses === '씀' ? '안경 씀' : '안경 없음') : suspect[cat.key],
  }))
}
