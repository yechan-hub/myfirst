// Web Audio API 로 효과음을 실시간 합성합니다. (외부 오디오 파일 없음)

let ctx = null

function getCtx() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext
    ctx = new AC()
  }
  // 브라우저 자동재생 정책: 사용자 상호작용 후 resume 필요
  if (ctx.state === 'suspended') ctx.resume()
  return ctx
}

// 사용자 첫 클릭 시 오디오 컨텍스트를 깨웁니다.
export function unlockAudio() {
  getCtx()
}

// 짧은 화이트노이즈 버퍼 생성
function noiseBuffer(ac, duration) {
  const len = Math.floor(ac.sampleRate * duration)
  const buf = ac.createBuffer(1, len, ac.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
  return buf
}

// 🔫 총소리: 노이즈 폭발 + 저음 '쿵' 타격음
export function playGun() {
  const ac = getCtx()
  const t = ac.currentTime
  const out = ac.createGain()
  out.gain.value = 0.9
  out.connect(ac.destination)

  // 노이즈 폭발 (총구 화염)
  const noise = ac.createBufferSource()
  noise.buffer = noiseBuffer(ac, 0.25)
  const nf = ac.createBiquadFilter()
  nf.type = 'lowpass'
  nf.frequency.setValueAtTime(3500, t)
  nf.frequency.exponentialRampToValueAtTime(400, t + 0.18)
  const ng = ac.createGain()
  ng.gain.setValueAtTime(1.0, t)
  ng.gain.exponentialRampToValueAtTime(0.001, t + 0.22)
  noise.connect(nf).connect(ng).connect(out)
  noise.start(t)
  noise.stop(t + 0.25)

  // 저음 타격 (반동)
  const osc = ac.createOscillator()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(160, t)
  osc.frequency.exponentialRampToValueAtTime(45, t + 0.15)
  const og = ac.createGain()
  og.gain.setValueAtTime(0.8, t)
  og.gain.exponentialRampToValueAtTime(0.001, t + 0.2)
  osc.connect(og).connect(out)
  osc.start(t)
  osc.stop(t + 0.2)
}

// 🎇 채찍 음속 소리: 빠른 피치 스윕 + 날카로운 '착!' 크랙
export function playWhip() {
  const ac = getCtx()
  const t = ac.currentTime
  const out = ac.createGain()
  out.gain.value = 0.6
  out.connect(ac.destination)

  // 휘두르는 스윕 (음속 돌파 whoosh)
  const swoosh = ac.createBufferSource()
  swoosh.buffer = noiseBuffer(ac, 0.18)
  const bp = ac.createBiquadFilter()
  bp.type = 'bandpass'
  bp.Q.value = 1.2
  bp.frequency.setValueAtTime(600, t)
  bp.frequency.exponentialRampToValueAtTime(5000, t + 0.12)
  const sg = ac.createGain()
  sg.gain.setValueAtTime(0.5, t)
  sg.gain.exponentialRampToValueAtTime(0.001, t + 0.14)
  swoosh.connect(bp).connect(sg).connect(out)
  swoosh.start(t)
  swoosh.stop(t + 0.18)

  // 크랙 (음속 돌파 순간의 '착!')
  const crackT = t + 0.1
  const crack = ac.createBufferSource()
  crack.buffer = noiseBuffer(ac, 0.05)
  const hp = ac.createBiquadFilter()
  hp.type = 'highpass'
  hp.frequency.value = 3000
  const cg = ac.createGain()
  cg.gain.setValueAtTime(0.9, crackT)
  cg.gain.exponentialRampToValueAtTime(0.001, crackT + 0.05)
  crack.connect(hp).connect(cg).connect(out)
  crack.start(crackT)
  crack.stop(crackT + 0.05)
}

// 🎲 찬스 게이트: 룰렛 틱틱틱 + 당첨 '딩'
export function playChance() {
  const ac = getCtx()
  const t0 = ac.currentTime
  // 점점 느려지는 룰렛 틱
  let t = t0
  for (let i = 0; i < 7; i++) {
    const osc = ac.createOscillator()
    osc.type = 'square'
    osc.frequency.value = 820 + i * 30
    const g = ac.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.16, t + 0.004)
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.05)
    osc.connect(g).connect(ac.destination)
    osc.start(t)
    osc.stop(t + 0.06)
    t += 0.05 + i * 0.012 // 점점 간격 벌어짐
  }
  // 결정 '딩'
  const td = t + 0.05
  const osc = ac.createOscillator()
  osc.type = 'triangle'
  osc.frequency.value = 1318.5 // E6
  const g = ac.createGain()
  g.gain.setValueAtTime(0.0001, td)
  g.gain.exponentialRampToValueAtTime(0.32, td + 0.01)
  g.gain.exponentialRampToValueAtTime(0.001, td + 0.45)
  osc.connect(g).connect(ac.destination)
  osc.start(td)
  osc.stop(td + 0.45)
}

// 🎉 도착 팡파레: 밝은 상승 아르페지오
export function playWin() {
  const ac = getCtx()
  const t0 = ac.currentTime
  const notes = [523.25, 659.25, 783.99, 1046.5] // C E G C
  notes.forEach((f, i) => {
    const t = t0 + i * 0.09
    const osc = ac.createOscillator()
    osc.type = 'triangle'
    osc.frequency.value = f
    const g = ac.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.35, t + 0.02)
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.3)
    osc.connect(g).connect(ac.destination)
    osc.start(t)
    osc.stop(t + 0.3)
  })
}
