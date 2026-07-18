// Web Audio API로 효과음을 실시간 합성합니다. (외부 오디오 파일 없음)
// 어몽어스 우주선 테마 및 기존 미니게임 오디오 에셋 통합 및 고도화형 (sounds.js)

let ctx = null
let masterGain = null
let sfxGain = null
let bgmGain = null
let bgmFilter = null

// 오디오 볼륨 설정 상태 (0.0 ~ 1.0)
let masterVolume = 1.0
let bgmVolume = 0.6
let sfxVolume = 0.8

function getCtx() {
  if (typeof window === 'undefined') return null
  try {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext
      if (AC) {
        ctx = new AC()
        setupAudioGraph()
      }
    }
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {})
    }
  } catch (e) {
    console.warn('Failed to initialize AudioContext:', e)
  }
  return ctx
}

function setupAudioGraph() {
  const ac = ctx
  if (!ac) return
  // 마스터 게인
  masterGain = ac.createGain()
  masterGain.gain.value = masterVolume
  masterGain.connect(ac.destination)

  // SFX 게인
  sfxGain = ac.createGain()
  sfxGain.gain.value = sfxVolume
  sfxGain.connect(masterGain)

  // BGM 필터 (사보타지 시 웅웅거리는 LPF용)
  bgmFilter = ac.createBiquadFilter()
  bgmFilter.type = 'lowpass'
  bgmFilter.frequency.value = 20000 // 평상시 최대치 (모든 소리 통과)
  bgmFilter.Q.value = 1.0
  bgmFilter.connect(masterGain)

  // BGM 게인
  bgmGain = ac.createGain()
  bgmGain.gain.value = bgmVolume
  bgmGain.connect(bgmFilter)
}

export function unlockAudio() {
  try {
    getCtx()
  } catch (e) {
    console.warn('Failed to unlock audio:', e)
  }
}

// 실시간 볼륨 설정 API
export function setMasterVolume(vol) {
  masterVolume = Math.max(0, Math.min(1, vol))
  if (ctx && masterGain) {
    masterGain.gain.setValueAtTime(masterVolume, ctx.currentTime)
  }
}

export function setBgmVolume(vol) {
  bgmVolume = Math.max(0, Math.min(1, vol))
  if (ctx && bgmGain) {
    bgmGain.gain.setValueAtTime(bgmVolume, ctx.currentTime)
  }
}

export function setSfxVolume(vol) {
  sfxVolume = Math.max(0, Math.min(1, vol))
  if (ctx && sfxGain) {
    sfxGain.gain.setValueAtTime(sfxVolume, ctx.currentTime)
  }
}

// 🚨 사보타지 필터 활성화 (BGM을 먹먹하게 웅웅거리도록)
export function setSabotageFilter(active) {
  try {
    if (!ctx || !bgmFilter) return
    const t = ctx.currentTime

    if (active) {
      // 350Hz 저역 통과 필터로 고역대 완전 컷 (사보타지 긴박감 연출)
      bgmFilter.frequency.exponentialRampToValueAtTime(320, t + 0.8)
      bgmFilter.Q.setValueAtTime(4.5, t + 0.8) // 공명 피크를 줘서 더욱 위협적인 웅웅거림 연출
    } else {
      // 원복
      bgmFilter.frequency.exponentialRampToValueAtTime(20000, t + 0.5)
      bgmFilter.Q.setValueAtTime(1.0, t + 0.5)
    }
  } catch (e) {}
}

// 화이트노이즈 생성
function noiseBuffer(ac, duration) {
  const len = Math.floor(ac.sampleRate * duration)
  const buf = ac.createBuffer(1, len, ac.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
  return buf
}

function mtohz(m) {
  return 440 * Math.pow(2, (m - 69) / 12)
}

// ================= 기존 게임용 효과음 (사다리 게임 등 호환용) =================

// 🔫 총소리: 노이즈 폭발 + 극적인 저음 '쿵' 타격음 및 잔향
export function playGun() {
  try {
    const ac = getCtx()
    const t = ac.currentTime
    const out = sfxGain || ac.destination

    // 노이즈 폭발 (총구 화염 및 화약 파열음)
    const noise = ac.createBufferSource()
    noise.buffer = noiseBuffer(ac, 0.45)
    const nf = ac.createBiquadFilter()
    nf.type = 'lowpass'
    nf.frequency.setValueAtTime(4000, t)
    nf.frequency.exponentialRampToValueAtTime(150, t + 0.3)
    const ng = ac.createGain()
    ng.gain.setValueAtTime(1.2, t)
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.4)
    
    noise.connect(nf).connect(ng).connect(out)
    noise.start(t)
    noise.stop(t + 0.45)

    // 저음 타격 (반동 몸체 울림)
    const osc = ac.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(220, t)
    osc.frequency.exponentialRampToValueAtTime(30, t + 0.25)
    const og = ac.createGain()
    og.gain.setValueAtTime(1.5, t)
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.3)
    
    osc.connect(og).connect(out)
    osc.start(t)
    osc.stop(t + 0.3)

    // 리얼한 룸 잔향 테일 효과 추가
    const reverbTail = ac.createOscillator()
    reverbTail.type = 'triangle'
    reverbTail.frequency.setValueAtTime(110, t + 0.05)
    reverbTail.frequency.linearRampToValueAtTime(50, t + 0.4)
    const rg = ac.createGain()
    rg.gain.setValueAtTime(0, t)
    rg.gain.linearRampToValueAtTime(0.3, t + 0.08)
    rg.gain.exponentialRampToValueAtTime(0.001, t + 0.4)
    
    reverbTail.connect(rg).connect(out)
    reverbTail.start(t)
    reverbTail.stop(t + 0.45)
  } catch (e) {}
}

// 🎇 채찍 음속 소리: 빠른 피치 스윕 + 날카로운 '착!' 크랙
export function playWhip() {
  try {
    const ac = getCtx()
    const t = ac.currentTime
    const out = sfxGain || ac.destination

    // 휘두르는 스윕 (음속 돌파 whoosh)
    const swoosh = ac.createBufferSource()
    swoosh.buffer = noiseBuffer(ac, 0.18)
    const bp = ac.createBiquadFilter()
    bp.type = 'bandpass'
    bp.Q.value = 1.8
    bp.frequency.setValueAtTime(500, t)
    bp.frequency.exponentialRampToValueAtTime(6000, t + 0.12)
    const sg = ac.createGain()
    sg.gain.setValueAtTime(0.6, t)
    sg.gain.exponentialRampToValueAtTime(0.001, t + 0.14)
    swoosh.connect(bp).connect(sg).connect(out)
    swoosh.start(t)
    swoosh.stop(t + 0.18)

    // 크랙 (음속 돌파 순간의 날카로운 '착!')
    const crackT = t + 0.1
    const crack = ac.createBufferSource()
    crack.buffer = noiseBuffer(ac, 0.06)
    const hp = ac.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = 4500
    const cg = ac.createGain()
    cg.gain.setValueAtTime(1.1, crackT)
    cg.gain.exponentialRampToValueAtTime(0.001, crackT + 0.06)
    crack.connect(hp).connect(cg).connect(out)
    crack.start(crackT)
    crack.stop(crackT + 0.06)
  } catch (e) {}
}

// 🎲 찬스 게이트: 룰렛 틱틱틱 + 당첨 '딩'
export function playChance() {
  try {
    const ac = getCtx()
    const t0 = ac.currentTime
    const out = sfxGain || ac.destination
    
    // 점점 느려지는 룰렛 틱
    let t = t0
    for (let i = 0; i < 7; i++) {
      const osc = ac.createOscillator()
      osc.type = 'square'
      osc.frequency.value = 820 + i * 40
      const g = ac.createGain()
      g.gain.setValueAtTime(0.0001, t)
      g.gain.exponentialRampToValueAtTime(0.18, t + 0.004)
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.05)
      osc.connect(g).connect(out)
      osc.start(t)
      osc.stop(t + 0.06)
      t += 0.05 + i * 0.015 // 점점 간격 벌어짐
    }
    // 결정 '딩'
    const td = t + 0.05
    const osc = ac.createOscillator()
    osc.type = 'triangle'
    osc.frequency.value = 1318.5 // E6
    const g = ac.createGain()
    g.gain.setValueAtTime(0.0001, td)
    g.gain.exponentialRampToValueAtTime(0.35, td + 0.01)
    g.gain.exponentialRampToValueAtTime(0.001, td + 0.5)
    osc.connect(g).connect(out)
    osc.start(td)
    osc.stop(td + 0.5)
  } catch (e) {}
}

// 🎉 성공/검거 팡파레: 웅장한 아르페지오 + 브라스 풍 콰이어 배음
export function playWin() {
  try {
    const ac = getCtx()
    const t0 = ac.currentTime
    const out = sfxGain || ac.destination
    const notes = [523.25, 659.25, 783.99, 1046.5] // C E G C
    
    notes.forEach((f, i) => {
      const t = t0 + i * 0.08
      
      // 메인 아르페지오 (맑은 벨 톤)
      const osc = ac.createOscillator()
      osc.type = 'sine'
      osc.frequency.value = f
      const g = ac.createGain()
      g.gain.setValueAtTime(0.0001, t)
      g.gain.linearRampToValueAtTime(0.35, t + 0.03)
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.6)
      
      // 브라스/관악기 텍스처 배음 (리얼함 추가)
      const brass = ac.createOscillator()
      brass.type = 'sawtooth'
      brass.frequency.value = f / 2 // 1옥타브 낮게
      const bg = ac.createGain()
      bg.gain.setValueAtTime(0, t)
      bg.gain.linearRampToValueAtTime(0.12, t + 0.05)
      bg.gain.exponentialRampToValueAtTime(0.001, t + 0.55)
      const bf = ac.createBiquadFilter()
      bf.type = 'lowpass'
      bf.frequency.setValueAtTime(400, t)
      bf.frequency.exponentialRampToValueAtTime(1200, t + 0.15)
      
      osc.connect(g).connect(out)
      brass.connect(bf).connect(bg).connect(out)
      
      osc.start(t)
      brass.start(t)
      osc.stop(t + 0.6)
      brass.stop(t + 0.6)
    })
  } catch (e) {}
}

// 📸 카메라 스캔 및 단서 셔터음
export function playCameraScan() {
  try {
    const ac = getCtx()
    const t = ac.currentTime
    const out = sfxGain || ac.destination

    // 1. 하이테크 스캐너 모터음 (지이잉)
    const scanOsc = ac.createOscillator()
    scanOsc.type = 'triangle'
    scanOsc.frequency.setValueAtTime(80, t)
    scanOsc.frequency.linearRampToValueAtTime(320, t + 0.25)
    scanOsc.frequency.linearRampToValueAtTime(150, t + 0.5)

    const scanGain = ac.createGain()
    scanGain.gain.setValueAtTime(0, t)
    scanGain.gain.linearRampToValueAtTime(0.18, t + 0.05)
    scanGain.gain.exponentialRampToValueAtTime(0.001, t + 0.5)

    const scanFilter = ac.createBiquadFilter()
    scanFilter.type = 'bandpass'
    scanFilter.frequency.value = 800
    scanFilter.Q.value = 5.0

    scanOsc.connect(scanFilter).connect(scanGain).connect(out)
    scanOsc.start(t)
    scanOsc.stop(t + 0.5)

    // 2. 카메라 조리개 셔터 철컥음 (Click-Clack)
    const clickT = t + 0.12
    const shutter = ac.createBufferSource()
    shutter.buffer = noiseBuffer(ac, 0.08)
    const sf = ac.createBiquadFilter()
    sf.type = 'highpass'
    sf.frequency.value = 6000
    const sg = ac.createGain()
    sg.gain.setValueAtTime(0.5, clickT)
    sg.gain.exponentialRampToValueAtTime(0.001, clickT + 0.08)

    shutter.connect(sf).connect(sg).connect(out)
    shutter.start(clickT)
    shutter.stop(clickT + 0.08)
  } catch (e) {}
}

// ================= 어몽어스 전용 오디오 에셋 =================

// 🔪 임포스터 킬 효과음
export function playKillSFX() {
  try {
    const ac = getCtx()
    const t = ac.currentTime
    const out = sfxGain || ac.destination

    // 칼날 찌르는 쉭 소리
    const noise = ac.createBufferSource()
    noise.buffer = noiseBuffer(ac, 0.4)
    const nf = ac.createBiquadFilter()
    nf.type = 'highpass'
    nf.frequency.setValueAtTime(3000, t)
    nf.frequency.exponentialRampToValueAtTime(8000, t + 0.15)
    
    const ng = ac.createGain()
    ng.gain.setValueAtTime(0, t)
    ng.gain.linearRampToValueAtTime(0.9, t + 0.02)
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.35)
    
    noise.connect(nf).connect(ng).connect(out)
    noise.start(t)
    noise.stop(t + 0.4)

    // 타격 서브 신디사이저 (뼈 부러지는 리얼 쿵 타격)
    const osc1 = ac.createOscillator()
    const osc2 = ac.createOscillator()
    const og1 = ac.createGain()
    const og2 = ac.createGain()

    osc1.type = 'sawtooth'
    osc1.frequency.setValueAtTime(450, t)
    osc1.frequency.linearRampToValueAtTime(60, t + 0.25)
    
    osc2.type = 'square'
    osc2.frequency.setValueAtTime(465, t)
    osc2.frequency.linearRampToValueAtTime(65, t + 0.25)

    og1.gain.setValueAtTime(0.7, t)
    og1.gain.exponentialRampToValueAtTime(0.001, t + 0.3)
    
    og2.gain.setValueAtTime(0.5, t)
    og2.gain.exponentialRampToValueAtTime(0.001, t + 0.28)

    osc1.connect(og1).connect(out)
    osc2.connect(og2).connect(out)
    
    osc1.start(t)
    osc2.start(t)
    osc1.stop(t + 0.3)
    osc2.stop(t + 0.3)
  } catch (e) {}
}

// 🌀 벤트 환풍구 철창 덜컹 음색
export function playVentSFX() {
  try {
    const ac = getCtx()
    const t = ac.currentTime
    const out = sfxGain || ac.destination

    const noise = ac.createBufferSource()
    noise.buffer = noiseBuffer(ac, 0.25)
    const nf = ac.createBiquadFilter()
    nf.type = 'bandpass'
    nf.frequency.setValueAtTime(800, t)
    nf.frequency.exponentialRampToValueAtTime(180, t + 0.15)
    
    const ng = ac.createGain()
    ng.gain.setValueAtTime(0, t)
    ng.gain.linearRampToValueAtTime(0.6, t + 0.03)
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.22)

    noise.connect(nf).connect(ng).connect(out)
    noise.start(t)
    noise.stop(t + 0.25)

    const osc = ac.createOscillator()
    const og = ac.createGain()
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(110, t)
    osc.frequency.exponentialRampToValueAtTime(30, t + 0.2)

    og.gain.setValueAtTime(0.7, t)
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.22)

    osc.connect(og).connect(out)
    osc.start(t)
    osc.stop(t + 0.25)
  } catch (e) {}
}

// 🚨 사보타지 사이렌 경보음
let sirenInterval = null
export function startSirenSFX() {
  try {
    const ac = getCtx()
    if (sirenInterval) return

    function playSirenPulse() {
      const t = ac.currentTime
      const osc = ac.createOscillator()
      const gain = ac.createGain()
      const filter = ac.createBiquadFilter()
      const out = sfxGain || ac.destination

      osc.type = 'sawtooth'
      osc.frequency.setValueAtTime(280, t)
      osc.frequency.linearRampToValueAtTime(420, t + 0.5)
      osc.frequency.linearRampToValueAtTime(280, t + 1.0)

      gain.gain.setValueAtTime(0, t)
      gain.gain.linearRampToValueAtTime(0.24, t + 0.1)
      gain.gain.linearRampToValueAtTime(0.24, t + 0.9)
      gain.gain.exponentialRampToValueAtTime(0.001, t + 1.0)

      filter.type = 'lowpass'
      filter.frequency.value = 750

      osc.connect(filter).connect(gain).connect(out)
      osc.start(t)
      osc.stop(t + 1.0)
    }

    playSirenPulse()
    sirenInterval = setInterval(playSirenPulse, 1050)
  } catch (e) {}
}

export function stopSirenSFX() {
  if (sirenInterval) {
    clearInterval(sirenInterval)
    sirenInterval = null
  }
}

// 🔔 긴급 소집 리얼 버저음 + 공압 배기 시스템 효과음
export function playEmergencySFX() {
  try {
    const ac = getCtx()
    const t = ac.currentTime
    const out = sfxGain || ac.destination

    const filter = ac.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 1000

    // 1. 위협적인 금속성 알람 버저
    const osc1 = ac.createOscillator()
    const osc2 = ac.createOscillator()
    const gain1 = ac.createGain()
    const gain2 = ac.createGain()

    osc1.type = 'sawtooth'
    osc1.frequency.value = 175
    osc2.type = 'square'
    osc2.frequency.value = 177

    gain1.gain.setValueAtTime(0, t)
    gain1.gain.linearRampToValueAtTime(0.45, t + 0.02)
    gain1.gain.linearRampToValueAtTime(0.45, t + 0.6)
    gain1.gain.exponentialRampToValueAtTime(0.001, t + 0.7)

    gain2.gain.setValueAtTime(0, t)
    gain2.gain.linearRampToValueAtTime(0.35, t + 0.02)
    gain2.gain.linearRampToValueAtTime(0.35, t + 0.6)
    gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.7)

    osc1.connect(gain1).connect(filter)
    osc2.connect(gain2).connect(filter)

    // 2. 공압 배기음 (슉- 릴리즈 효과로 리얼함 추가)
    const airRelease = ac.createBufferSource()
    airRelease.buffer = noiseBuffer(ac, 1.2)
    const airFilter = ac.createBiquadFilter()
    airFilter.type = 'bandpass'
    airFilter.frequency.setValueAtTime(1200, t + 0.05)
    airFilter.frequency.exponentialRampToValueAtTime(300, t + 0.9)
    airFilter.Q.value = 2.0

    const airGain = ac.createGain()
    airGain.gain.setValueAtTime(0, t)
    airGain.gain.linearRampToValueAtTime(0.7, t + 0.08)
    airGain.gain.exponentialRampToValueAtTime(0.001, t + 1.1)

    airRelease.connect(airFilter).connect(airGain).connect(out)

    filter.connect(out)

    osc1.start(t)
    osc2.start(t)
    airRelease.start(t)

    osc1.stop(t + 0.75)
    osc2.stop(t + 0.75)
    airRelease.stop(t + 1.2)
  } catch (e) {}
}

// 🌌 우주 방출음: 바람소리 노이즈 스윕
export function playEjectSFX() {
  try {
    const ac = getCtx()
    const t = ac.currentTime
    const out = sfxGain || ac.destination

    const noise = ac.createBufferSource()
    noise.buffer = noiseBuffer(ac, 2.5)

    const filter = ac.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(100, t)
    filter.frequency.exponentialRampToValueAtTime(450, t + 1.2)
    filter.frequency.exponentialRampToValueAtTime(60, t + 2.5)

    const gain = ac.createGain()
    gain.gain.setValueAtTime(0, t)
    gain.gain.linearRampToValueAtTime(0.6, t + 0.3)
    gain.gain.linearRampToValueAtTime(0.6, t + 1.8)
    gain.gain.exponentialRampToValueAtTime(0.001, t + 2.5)

    noise.connect(filter).connect(gain).connect(out)
    noise.start(t)
    noise.stop(t + 2.5)
  } catch (e) {}
}

// 🎯 미션 성공 피드백 딩-소리
export function playTaskSFX() {
  try {
    const ac = getCtx()
    const t = ac.currentTime
    const notes = [523.25, 659.25, 783.99] // C5 E5 G5
    const out = sfxGain || ac.destination
    
    notes.forEach((f, i) => {
      const osc = ac.createOscillator()
      const gain = ac.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(f, t + i * 0.1)

      gain.gain.setValueAtTime(0, t + i * 0.1)
      gain.gain.linearRampToValueAtTime(0.2, t + i * 0.1 + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.1 + 0.3)

      osc.connect(gain).connect(out)
      osc.start(t + i * 0.1)
      osc.stop(t + i * 0.1 + 0.4)
    })
  } catch (e) {}
}

// ⌨️ 타자기 효과음 (자음/모음 지연 연동용 단발음)
export function playTypewriter() {
  try {
    const ac = getCtx()
    const t = ac.currentTime
    const osc = ac.createOscillator()
    const gain = ac.createGain()
    const filter = ac.createBiquadFilter()
    const out = sfxGain || ac.destination

    osc.type = 'sine'
    osc.frequency.setValueAtTime(600 + Math.random() * 300, t)

    gain.gain.setValueAtTime(0.05, t)
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.02)

    filter.type = 'bandpass'
    filter.frequency.value = 1500

    osc.connect(filter).connect(gain).connect(out)
    osc.start(t)
    osc.stop(t + 0.03)
  } catch (e) {}
}

// 📄 종이/수첩 효과음
export function playPaper() {
  try {
    const ac = getCtx()
    const t = ac.currentTime
    const osc = ac.createOscillator()
    const gain = ac.createGain()
    const out = sfxGain || ac.destination

    osc.type = 'triangle'
    osc.frequency.setValueAtTime(220, t)
    osc.frequency.exponentialRampToValueAtTime(80, t + 0.08)

    gain.gain.setValueAtTime(0.12, t)
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08)

    osc.connect(gain).connect(out)
    osc.start(t)
    osc.stop(t + 0.08)
  } catch (e) {}
}

// 💓 실시간 가변 심장 박동음 엔진
let heartbeatIntervalId = null

export function playHeartbeat() {
  // 수동 1회 타격 (기존 코드와의 하위 호환성 유지)
  try {
    const ac = getCtx()
    const t = ac.currentTime
    const out = sfxGain || ac.destination
    const delay = 0.2
    
    const playThump = (time) => {
      const osc = ac.createOscillator()
      const gain = ac.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(50, time)
      osc.frequency.exponentialRampToValueAtTime(20, time + 0.1)

      gain.gain.setValueAtTime(0.38, time)
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.12)

      osc.connect(gain).connect(out)
      osc.start(time)
      osc.stop(time + 0.15)
    }

    playThump(t)
    playThump(t + delay)
  } catch (e) {}
}

// 가변 주기를 이용한 웅장한 백그라운드 심장박동 루프 시작
export function startHeartbeatLoop(bpm = 70) {
  try {
    stopHeartbeatLoop()
    const intervalMs = (60 / bpm) * 1000
    
    // 첫 박자 즉시 실행
    playHeartbeat()
    
    heartbeatIntervalId = setInterval(() => {
      playHeartbeat()
    }, intervalMs)
  } catch (e) {}
}

export function stopHeartbeatLoop() {
  if (heartbeatIntervalId) {
    clearInterval(heartbeatIntervalId)
    heartbeatIntervalId = null
  }
}

// ================= BGM SYNTHESIZER (Space Sci-fi Ambient) =================

let isBgmPlaying = false
let bgmTimer = null
let bgmSequenceIndex = 0
let bgmNextEventTime = 0

const spacePitches = [
  { bass: 36, drone: [60, 67, 74] }, // C2 bass, high C4, G4, D5 (ethereal space stack)
  { bass: 32, drone: [56, 63, 70] }, // Ab1 bass, Eb4, Bb4, F5
  { bass: 29, drone: [53, 60, 67] }, // F1 bass, C4, G4, D5
  { bass: 31, drone: [55, 62, 69] }, // G1 bass, D4, A4, E5
]

function playBgmStep(ac, time) {
  if (!isBgmPlaying) return

  const step = spacePitches[bgmSequenceIndex]
  bgmSequenceIndex = (bgmSequenceIndex + 1) % spacePitches.length

  const out = bgmGain || ac.destination

  // 1. 우주적인 초저음 베이스 (Deep Sub-bass pulse)
  const oscB = ac.createOscillator()
  const gainB = ac.createGain()
  const filterB = ac.createBiquadFilter()

  oscB.type = 'sine'
  oscB.frequency.setValueAtTime(mtohz(step.bass), time)

  gainB.gain.setValueAtTime(0, time)
  gainB.gain.linearRampToValueAtTime(0.24, time + 0.4) // 부드러운 하부 잔향
  gainB.gain.exponentialRampToValueAtTime(0.001, time + 3.0)

  filterB.type = 'lowpass'
  filterB.frequency.setValueAtTime(90, time)

  oscB.connect(filterB).connect(gainB).connect(out)
  oscB.start(time)
  oscB.stop(time + 3.1)

  // 2. High Ethereal Resonance Pads (우주 엠비언스 공명 패드)
  step.drone.forEach((note, i) => {
    const oscP = ac.createOscillator()
    const gainP = ac.createGain()
    const filterP = ac.createBiquadFilter()

    oscP.type = 'triangle'
    oscP.frequency.setValueAtTime(mtohz(note), time + i * 0.1)

    gainP.gain.setValueAtTime(0, time + i * 0.1)
    gainP.gain.linearRampToValueAtTime(0.025, time + i * 0.1 + 0.8) // 느리게 스며드는 패드
    gainP.gain.exponentialRampToValueAtTime(0.001, time + i * 0.1 + 2.8) // 긴 릴리즈

    filterP.type = 'lowpass'
    filterP.frequency.setValueAtTime(500, time) // 부드러운 하이컷
    filterP.Q.value = 3.0 // 몽환적인 Resonance 필터링

    oscP.connect(filterP).connect(gainP).connect(out)
    oscP.start(time + i * 0.1)
    oscP.stop(time + i * 0.1 + 3.0)
  })
}

export function startBgm() {
  try {
    const ac = getCtx()
    if (isBgmPlaying) return

    isBgmPlaying = true
    bgmSequenceIndex = 0
    bgmNextEventTime = ac.currentTime + 0.1

    function scheduler() {
      if (!isBgmPlaying) return
      while (bgmNextEventTime < ac.currentTime + 0.4) {
        playBgmStep(ac, bgmNextEventTime)
        bgmNextEventTime += 3.2 // 3.2초 주기 드론 루프
      }
      bgmTimer = setTimeout(scheduler, 50)
    }

    scheduler()
  } catch (e) {}
}

export function stopBgm() {
  isBgmPlaying = false
  if (bgmTimer) {
    clearTimeout(bgmTimer)
    bgmTimer = null
  }
}
