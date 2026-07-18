import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import AmongUsGame from './AmongUsGame.jsx'
import React from 'react'

// sounds.js 모듈 Mocking (JSDOM Web Audio API 미지원 우회)
vi.mock('./sounds.js', () => ({
  unlockAudio: vi.fn(),
  playKillSFX: vi.fn(),
  playVentSFX: vi.fn(),
  startSirenSFX: vi.fn(),
  stopSirenSFX: vi.fn(),
  playEmergencySFX: vi.fn(),
  playEjectSFX: vi.fn(),
  playTaskSFX: vi.fn(),
  playTypewriter: vi.fn(),
  playPaper: vi.fn(),
  playHeartbeat: vi.fn(),
  startBgm: vi.fn(),
  stopBgm: vi.fn(),
  playWhip: vi.fn(),
  setSabotageFilter: vi.fn(),
  setMasterVolume: vi.fn(),
  setBgmVolume: vi.fn(),
  setSfxVolume: vi.fn(),
}))

// Canvas context, HTMLElement scrollIntoView 및 requestAnimationFrame Mocking (JSDOM OOM 방지)
beforeEach(() => {
  window.HTMLElement.prototype.scrollIntoView = vi.fn()
  window.requestAnimationFrame = vi.fn()
  window.cancelAnimationFrame = vi.fn()
  
  // 프록시를 이용해 캔버스의 모든 드로잉 컨텍스트 메서드 동적 모킹 (TypeError 방지)
  const mockCtx = {
    measureText: vi.fn(() => ({ width: 10 })),
    createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
  }
  
  const ctxProxy = new Proxy(mockCtx, {
    get(target, prop) {
      if (prop in target) {
        return target[prop]
      }
      return vi.fn()
    }
  })
  
  HTMLCanvasElement.prototype.getContext = () => ctxProxy
})

afterEach(() => {
  vi.useRealTimers()
})

describe('AmongUsGame - Onboarding & Single-Player Scenario Campaign QA Tests', () => {
  it('renders the lobby with three columns correctly', () => {
    render(<AmongUsGame />)
    
    // 로비 헤더 검증
    expect(screen.getByText('🚀 어몽어스 우주선 게임')).toBeDefined()
    
    // 3개 단락(조작, 캠페인, 가이드)의 핵심 텍스트 검증
    expect(screen.getByText('👥 플레이 역할 선택')).toBeDefined()
    expect(screen.getByText('🎬 싱글 플레이 캠페인')).toBeDefined()
    expect(screen.getByText('📖 게임 핵심 가이드 (How to Play)')).toBeDefined()
  })

  it('locks the player role to crewmate when Scenario 1 is selected', () => {
    render(<AmongUsGame />)
    
    const scenario1Card = screen.getByText('🌌 시나리오 1: 칠흑의 암흑 물질')
    fireEvent.click(scenario1Card)
    
    // 역할이 크루원으로 잠기는지 확인
    expect(screen.queryAllByText(/시나리오 고정 역할/).length).toBeGreaterThan(0)
    expect(screen.queryAllByText(/크루원/).length).toBeGreaterThan(0)
  })

  it('locks the player role to impostor when Scenario 3 is selected', () => {
    render(<AmongUsGame />)
    
    const scenario3Card = screen.getByText('🤫 시나리오 3: 침묵의 어쌔신')
    fireEvent.click(scenario3Card)
    
    // 역할이 임포스터로 잠기는지 확인
    expect(screen.queryAllByText(/시나리오 고정 역할/).length).toBeGreaterThan(0)
    expect(screen.queryAllByText(/임포스터/).length).toBeGreaterThan(0)
  })

  it('launches Scenario 1 and displays the 90s countdown timer', () => {
    render(<AmongUsGame />)
    
    // 시나리오 1 클릭 및 시작
    fireEvent.click(screen.getByText('🌌 시나리오 1: 칠흑의 암흑 물질'))
    fireEvent.click(screen.getByText('🚀 우주선 탑승 (게임 시작)'))
    
    // 인게임 진입 및 시나리오 1 특수 UI(타이머) 검증
    expect(screen.queryAllByText(/⏱/)[0]).toBeDefined()
    expect(screen.queryAllByText(/90초/).length).toBeGreaterThan(0)
  })

  it('launches Scenario 2 and enters the meeting phase immediately with alibi claims and observation logs', () => {
    vi.useFakeTimers()
    render(<AmongUsGame />)
    
    // 시나리오 2 클릭 및 시작
    fireEvent.click(screen.getByText('🕵️ 시나리오 2: 항해실 밀실 살인'))
    fireEvent.click(screen.getByText('🚀 우주선 탑승 (게임 시작)'))
    
    // 15초 앞으로 감아서 봇 대화 완료 처리
    act(() => {
      vi.advanceTimersByTime(15000)
    })
    
    expect(screen.queryAllByText(/항해실에서 시체가 발견되어/).length).toBeGreaterThan(0)
    
    // 회의 내 동선 탭 클릭 확인
    const alibiTabBtn = screen.getByText('📋 동선 일치 대조표')
    fireEvent.click(alibiTabBtn)
    
    // 용의자 정보 및 내 목격 기록 검증
    expect(screen.getByText('👤 용의자 진술 현황 (Alibi Claims)')).toBeDefined()
    expect(screen.getByText('📝 내 수사 메모 (Pass-by Logs)')).toBeDefined()
    
    // 주입된 모순 정보 검증
    expect(screen.queryAllByText(/정현우/).length).toBeGreaterThan(0)
    expect(screen.queryAllByText(/원자로/).length).toBeGreaterThan(0)
  })

  it('launches Scenario 3 and displays the silent assassin warning banner', () => {
    render(<AmongUsGame />)
    
    // 시나리오 3 클릭 및 시작
    fireEvent.click(screen.getByText('🤫 시나리오 3: 침묵의 어쌔신'))
    fireEvent.click(screen.getByText('🚀 우주선 탑승 (게임 시작)'))
    
    // 인게임 진입 및 암살 지령 배너 검증
    expect(screen.queryAllByText(/암살 지령/).length).toBeGreaterThan(0)
  })

  it('handles player kill and report button correctly in Free Play', () => {
    vi.useFakeTimers()
    
    // Math.random Mocking
    const originalRandom = Math.random
    Math.random = () => 0.5
    
    render(<AmongUsGame />)
    
    // 임포스터 역할 클릭 선택
    fireEvent.click(screen.getByText('🔴 임포스터'))
    
    // 역할 비동기 업데이트 완료 유도
    act(() => {
      vi.advanceTimersByTime(500)
    })
    
    // 게임 시작 클릭 (자유 대전 모드)
    fireEvent.click(screen.getByText('🚀 우주선 탑승 (게임 시작)'))
    
    // 인게임 초기 상태 적용 유도 (테스트 환경에서는 킬 쿨다운이 0으로 초기화됨)
    act(() => {
      vi.advanceTimersByTime(500)
    })
    
    // 킬 버튼 클릭
    const killBtn = screen.getByRole('button', { name: /KILL/ })
    expect(killBtn.disabled).toBe(false)
    fireEvent.click(killBtn)
    
    // 킬 상태 적용 유도
    act(() => {
      vi.advanceTimersByTime(500)
    })
    
    // 이제 리포트 버튼이 활성화되어야 함
    const reportBtn = screen.getByRole('button', { name: /REPORT/ })
    expect(reportBtn.disabled).toBe(false)
    
    // 리포트 버튼 클릭
    fireEvent.click(reportBtn)
    
    // 2800ms 회의 알림 노출 진행 유도
    act(() => {
      vi.advanceTimersByTime(3000)
    })
    
    // 회의 알림 노출 검증 (DEAD BODY REPORTED)
    expect(screen.queryAllByText(/DEAD BODY REPORTED/).length).toBeGreaterThan(0)
    
    // Restore Math.random
    Math.random = originalRandom
  })
})
