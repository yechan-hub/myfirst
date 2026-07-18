// 사다리 생성 및 경로 추적 로직

// cols: 세로줄 개수(=참가자 수), levels: 가로 발판이 놓일 수 있는 층 수
// 반환: rungs[level] = Set(col) — col 과 col+1 사이에 발판이 있음
export function makeLadder(cols, levels) {
  const rungs = []
  for (let l = 0; l < levels; l++) {
    const row = new Set()
    // 같은 층에서 한 기둥에 좌/우 발판이 동시에 붙지 않도록 처리
    let c = 0
    while (c < cols - 1) {
      if (Math.random() < 0.42) {
        row.add(c)
        c += 2 // 인접 발판 금지
      } else {
        c += 1
      }
    }
    rungs.push(row)
  }
  // 각 세로줄에 최소 하나의 발판이 연결되도록 보정(너무 밋밋한 사다리 방지)
  ensureConnectivity(rungs, cols, levels)
  return rungs
}

function ensureConnectivity(rungs, cols, levels) {
  const touched = new Array(cols).fill(false)
  rungs.forEach((row) => {
    row.forEach((c) => {
      touched[c] = true
      touched[c + 1] = true
    })
  })
  for (let c = 0; c < cols - 1; c++) {
    if (!touched[c] || !touched[c + 1]) {
      // 이 기둥에 발판을 하나 추가할 층 찾기
      for (let l = 0; l < levels; l++) {
        const row = rungs[l]
        if (!row.has(c) && !row.has(c - 1) && !row.has(c + 1)) {
          row.add(c)
          touched[c] = true
          touched[c + 1] = true
          break
        }
      }
    }
  }
}

// startCol 에서 출발해 아래로 내려가며 경로(격자 좌표)를 계산
// 반환: { endCol, steps: [{col, level, dir}] }  (dir: 'L' | 'R' | null)
export function tracePath(rungs, startCol, cols, levels) {
  let col = startCol
  const steps = [{ col, level: -1, dir: null }] // 출발점(맨 위)
  for (let l = 0; l < levels; l++) {
    const row = rungs[l]
    if (col > 0 && row.has(col - 1)) {
      col = col - 1
      steps.push({ col, level: l, dir: 'L' })
    } else if (col < cols - 1 && row.has(col)) {
      col = col + 1
      steps.push({ col, level: l, dir: 'R' })
    } else {
      steps.push({ col, level: l, dir: null })
    }
  }
  steps.push({ col, level: levels, dir: null }) // 도착점(맨 아래)
  return { endCol: col, steps }
}
