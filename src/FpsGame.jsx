import React, { useState, useRef, useEffect } from 'react';

// === Platform Coordinates for 2D Side-Scroller (640x480 screen space) ===
const GROUND_Y = 410;
const PLATFORMS = [
  { y: 310, xStart: 60, xEnd: 220, label: '좌측 목조 회랑' },
  { y: 310, xStart: 420, xEnd: 580, label: '우측 목조 회랑' },
  { y: 220, xStart: 200, xEnd: 440, label: '공중 신전 제단' }
];

// === Synthesized Web Audio Manager ===
class SoundSynthesizer {
  constructor() {
    this.ctx = null;
    this.bgmOsc = null;
    this.bgmGain = null;
    this.bgmInterval = null;
  }

  init() {
    if (this.ctx) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) this.ctx = new AC();
    } catch (e) {
      console.warn("AudioContext failed:", e);
    }
  }

  playM9Pistol() { this.playShoot(0.12, 1200, 0.2); }
  playDesertEagle() { this.playShoot(0.24, 700, 0.4); }
  playMp5Burst() { this.playShoot(0.08, 1400, 0.15); }
  playM4a1Burst() { this.playShoot(0.1, 1000, 0.2); }
  playAk47Shot() { this.playShoot(0.15, 800, 0.25); }
  playR870Shot() { this.playShoot(0.3, 500, 0.35); }
  playM1014Shot() { this.playShoot(0.25, 600, 0.3); }
  playM24Sniper() { this.playShoot(0.4, 400, 0.5); }
  playBarrett50() { this.playShoot(0.5, 300, 0.6); }
  playFlashbang() { this.playShoot(0.8, 2000, 0.3, true); }
  playPowerup() { this.playSynth(523.25, 0.3, 'sine'); } 
  playLaser() { this.playSynth(880, 0.15, 'sawtooth'); } 
  playRailgun() { this.playShoot(0.6, 1500, 0.5); }
  playExplosion() { this.playShoot(0.5, 180, 0.6); }
  playEnemyHit() { this.playSynth(220, 0.08, 'square'); }
  playPlayerHit() { this.playSynth(110, 0.15, 'sawtooth'); }
  playKatanaSlash() { this.playSynth(1200, 0.1, 'triangle'); }
  playRadioStatic() { this.playShoot(0.2, 3000, 0.05); }

  playShoot(duration, frequency, volume, isFlash = false) {
    this.init();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = isFlash ? 'triangle' : 'sawtooth';
    osc.frequency.setValueAtTime(frequency, t);
    osc.frequency.exponentialRampToValueAtTime(40, t + duration);

    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    osc.connect(gain).connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + duration);
  }

  playSynth(freq, duration, type = 'sine') {
    this.init();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(0.15, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    osc.connect(gain).connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + duration);
  }

  startBgm() {
    this.init();
    if (!this.ctx || this.bgmInterval) return;
    let index = 0;
    const notes = [130.81, 146.83, 164.81, 196.00]; 
    this.bgmInterval = setInterval(() => {
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(notes[index % notes.length], t);
      gain.gain.setValueAtTime(0.04, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
      osc.connect(gain).connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.3);
      index++;
    }, 300);
  }

  stopBgm() {
    if (this.bgmInterval) {
      clearInterval(this.bgmInterval);
      this.bgmInterval = null;
    }
  }
}

const sfx = new SoundSynthesizer();

export default function FpsGame() {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);

  // 게임 상태 제어
  const [gameState, setGameState] = useState('title'); // 'title', 'playing', 'victory', 'defeat'
  const [selectedChar, setSelectedChar] = useState('gojo');
  const [selectedAIChar, setSelectedAIChar] = useState('sukuna');

  // React state for HUD
  const [playerHP, setPlayerHP] = useState(150);
  const [playerHPDecay, setPlayerHPDecay] = useState(150);
  const [playerMaxHP, setPlayerMaxHP] = useState(150);
  const [playerCE, setPlayerCE] = useState(100);
  const [playerShield, setPlayerShield] = useState(50);

  const [aiHP, setAiHP] = useState(180);
  const [aiHPDecay, setAiHPDecay] = useState(180);
  const [aiMaxHP, setAiMaxHP] = useState(180);
  
  const [error, setError] = useState(null);

  const [logs, setLogs] = useState([
    '🎐 고성능 2D 격투 플랫폼 모의 결계 활성화 완료. [A/D] 기동, [W/Space] 더블 점프, [Shift] 대시, [S] 가드 / 플랫폼 통과.',
  ]);

  const stateRef = useRef({
    player: {
      x: 120.0, y: GROUND_Y - 20,
      vx: 0, vy: 0,
      angle: 0,
      health: 150, maxHealth: 150,
      cursedEnergy: 100, maxCursedEnergy: 100,
      shield: 50, maxShield: 100,
      cooldowns: [0, 0, 0, 0],
      domainActive: 0, domainCooldown: 0, domainType: '',
      reverseCursedCooldown: 0,
      comboActive: 0, overtimeActive: 0,
      frozen: 0, isGodModeDisabled: 0, hitFlash: 0,
      doubleJumpAvailable: true, dropThroughTimer: 0,
      dashTrailCooldown: 0, isGuarding: false,
      castingTimer: 0 // Used to check Counter-Hit vulnerability
    },
    ai: {
      x: 520.0, y: GROUND_Y - 20,
      vx: 0, vy: 0,
      angle: 0,
      health: 180, maxHealth: 180,
      cursedEnergy: 100, maxCursedEnergy: 100,
      shield: 50, maxShield: 100,
      cooldowns: [0, 0, 0, 0],
      domainActive: 0, domainCooldown: 0, domainType: '',
      reverseCursedCooldown: 0,
      comboActive: 0, overtimeActive: 0,
      frozen: 0, isGodModeDisabled: 0, hitFlash: 0,
      doubleJumpAvailable: true, dropThroughTimer: 0,
      dashTrailCooldown: 0, isGuarding: false,
      castingTimer: 0
    },
    projectiles: [],
    summons: [],
    particles: [],
    cherryBlossoms: [],
    phantomClones: [], 
    groundWaves: [],    
    floatingTexts: [],  // floating damage numbers
    hitStopFrames: 0,   // Hit-Stop freezes updates
    domainCutIn: { active: 0, charKey: '', domainName: '' }, 
    slowMoActive: 0, 
    spellText: { text: '', life: 0, color: '#fff' }, 
    keys: {},
    mouse: { x: 0, y: 0 },
    screenShake: 0,
    damageFlash: 0,
    healFlash: 0
  });

  const addLog = (msg) => {
    setLogs((prev) => [msg, ...prev.slice(0, 19)]);
  };

  const updateCherryBlossoms = (w, h) => {
    const s = stateRef.current;
    if (s.cherryBlossoms.length < 35) {
      s.cherryBlossoms.push({
        x: Math.random() * w,
        y: -10 - Math.random() * 50,
        size: Math.random() * 3 + 2,
        vx: Math.random() * 0.8 + 0.4,
        vy: Math.random() * 1.2 + 0.8
      });
    }
    s.cherryBlossoms.forEach((p) => {
      p.x += p.vx;
      p.y += p.vy;
      if (p.x > w || p.y > h) {
        p.x = Math.random() * w;
        p.y = -10;
      }
    });
  };

  const checkPlatforms = (entity) => {
    let onPlatform = false;
    const footY = entity.y + 18;
    const prevFootY = footY - entity.vy;

    // Ground check (Absolute bottom clamp to prevent falling out of world)
    if (footY >= GROUND_Y) {
      if (entity.vy > 3.2) spawnLandingShockwave(entity.x, GROUND_Y);
      entity.y = GROUND_Y - 18;
      entity.vy = 0;
      onPlatform = true;
      entity.doubleJumpAvailable = true;
    }

    if (entity.dropThroughTimer > 0) {
      return onPlatform;
    }

    // Floating Platforms
    PLATFORMS.forEach((plat) => {
      if (entity.x >= plat.xStart && entity.x <= plat.xEnd) {
        if (footY >= plat.y && prevFootY <= plat.y + Math.max(1.5, entity.vy)) {
          if (entity.vy >= 0) { 
            if (entity.vy > 3.2) spawnLandingShockwave(entity.x, plat.y);
            entity.y = plat.y - 18;
            entity.vy = 0;
            onPlatform = true;
            entity.doubleJumpAvailable = true;
          }
        }
      }
    });

    return onPlatform;
  };

  const spawnLandingShockwave = (x, y) => {
    const s = stateRef.current;
    s.groundWaves.push({
      x, y, radius: 4, maxRadius: 36, opacity: 0.85
    });
    sfx.playPlayerHit();
  };

  const spawnFloatingText = (x, y, text, color, scale = 1.0, isSpecial = false) => {
    const s = stateRef.current;
    s.floatingTexts.push({
      x, y, text, color,
      scale,
      opacity: 1.0,
      vx: (Math.random() - 0.5) * 3.5,
      vy: -Math.random() * 4 - 3,
      isSpecial
    });
  };

  const useReverseCursed = () => {
    const s = stateRef.current;
    const char = selectedChar;
    
    if (char === 'toji') {
      if (s.player.reverseCursedCooldown > 0) return;
      s.player.reverseCursedCooldown = 180;
      s.player.comboActive = 45;
      sfx.playPowerup();
      addLog('💨 [천여주박 신속] 토우지가 기동 속도를 최고조로 급상승시킵니다!');
      return;
    }

    if (s.player.reverseCursedCooldown > 0) {
      addLog(`🚨 [반전술식 대기] 아직 시전할 수 없습니다! (대기: ${(s.player.reverseCursedCooldown / 60).toFixed(1)}초)`);
      return;
    }
    if (s.player.cursedEnergy < 35) {
      addLog(`🚨 [주력 부족] 반전술식 시전에 주력 35가 필요합니다!`);
      return;
    }
    s.player.cursedEnergy -= 35;
    s.player.reverseCursedCooldown = 240;
    s.player.health = Math.min(s.player.maxHealth, s.player.health + 65);
    setPlayerHP(s.player.health);
    s.healFlash = 0.6;
    sfx.playFlashbang();
    spawnFloatingText(s.player.x, s.player.y - 30, '+65 RCT', '#10b981', 1.3, true);
    addLog('❤️ [반전술식] 부의 주력을 곱하여 긍정 에너지를 가동! 생명력을 65 회복합니다!');
  };

  const useAIReverseCursed = () => {
    const s = stateRef.current;
    const char = selectedAIChar;
    if (char === 'toji') {
      if (s.ai.reverseCursedCooldown > 0) return;
      s.ai.reverseCursedCooldown = 180;
      s.ai.comboActive = 45;
      sfx.playPowerup();
      return;
    }
    if (s.ai.reverseCursedCooldown > 0 || s.ai.cursedEnergy < 35) return;
    s.ai.cursedEnergy -= 35;
    s.ai.reverseCursedCooldown = 240;
    s.ai.health = Math.min(s.ai.maxHealth, s.ai.health + 65);
    setAiHP(s.ai.health);
    sfx.playFlashbang();
    spawnFloatingText(s.ai.x, s.ai.y - 30, '+65 RCT', '#10b981', 1.3, true);
    addLog(`❤️ [반전술식] AI ${CHARACTERS[selectedAIChar].name}이(가) 반전술식으로 체력을 회복했습니다.`);
  };

  const spawnProjectile = (owner, type, x, y, vx, vy) => {
    const s = stateRef.current;
    const isPlayer = owner === 'player';
    const char = isPlayer ? selectedChar : selectedAIChar;
    let dmgMult = 1.0;
    if (char === 'sukuna') dmgMult = 1.8;
    if (char === 'toji') dmgMult = 2.0;
    if (char === 'todo') dmgMult = 2.5;
    if (s[owner].overtimeActive > 0) dmgMult *= 1.5;

    // Apply casting vulnerability window for Counter-Checks
    s[owner].castingTimer = 35;

    switch (type) {
      case 'ao':
        s.projectiles.push({
          x, y, vx: vx * 8, vy: vy * 8,
          owner, type: 'ao', damage: 24 * dmgMult,
          color: '#22d3ee', scale: 17, life: 90, gravityPull: true
        });
        break;
      case 'aka':
        s.projectiles.push({
          x, y, vx: vx * 12.5, vy: vy * 12.5,
          owner, type: 'aka', damage: 38 * dmgMult,
          color: '#ef4444', scale: 20, life: 50, repulsion: true
        });
        break;
      case 'murasaki':
        s.projectiles.push({
          x, y, vx: vx * 5.2, vy: vy * 5.2,
          owner, type: 'murasaki', damage: 95 * dmgMult,
          color: '#c084fc', scale: 38, life: 140, gravityPull: true
        });
        break;
      case 'void':
        s[isPlayer ? 'player' : 'ai'].domainActive = 300;
        s[isPlayer ? 'player' : 'ai'].domainType = 'void';
        sfx.playLaser();
        s.screenShake = 15;
        s[isPlayer ? 'ai' : 'player'].frozen = 300;
        break;
      case 'dismantle':
        for (let angleOff = -0.25; angleOff <= 0.25; angleOff += 0.25) {
          const rx = Math.cos(Math.atan2(vy, vx) + angleOff);
          const ry = Math.sin(Math.atan2(vy, vx) + angleOff);
          s.projectiles.push({
            x, y, vx: rx * 9, vy: ry * 9,
            owner, type: 'dismantle', damage: 15 * dmgMult,
            color: '#fca5a5', scale: 8, life: 45
          });
        }
        break;
      case 'cleave':
        s.projectiles.push({
          x: x + vx * 60, y: y + vy * 60, vx: 0, vy: 0,
          owner, type: 'cleave', damage: 35 * dmgMult,
          color: '#ffffff', scale: 22, life: 8
        });
        break;
      case 'fuga':
        s.projectiles.push({
          x, y, vx: vx * 5, vy: vy * 5,
          owner, type: 'fuga', damage: 60 * dmgMult,
          color: '#f97316', scale: 24, life: 120, explosive: true
        });
        break;
      case 'shrine':
        s[isPlayer ? 'player' : 'ai'].domainActive = 240;
        s[isPlayer ? 'player' : 'ai'].domainType = 'shrine';
        sfx.playExplosion();
        s.screenShake = 20;
        break;
      case 'fist':
        s.projectiles.push({
          x, y, vx: vx * 12, vy: vy * 12,
          owner, type: 'fist', damage: 18,
          color: '#22d3ee', scale: 7, life: 25, isBlackFlash: true
        });
        break;
      case 'divergent':
        s.projectiles.push({
          x, y, vx: vx * 9.5, vy: vy * 9.5,
          owner, type: 'divergent', damage: 32,
          color: '#06b6d4', scale: 10, life: 30, delayedStrike: true
        });
        break;
      case 'homing_blood':
        s.projectiles.push({
          x, y, vx: vx * 12.5, vy: vy * 12.5,
          owner, type: 'blood', damage: 24,
          color: '#ef4444', scale: 6.5, life: 60, homing: true
        });
        break;
      case 'yuji_combo':
        s[isPlayer ? 'player' : 'ai'].comboActive = 240;
        sfx.playPowerup();
        break;
      case 'copy':
        const oppChar = isPlayer ? selectedAIChar : selectedChar;
        const skills = CHARACTERS[oppChar].skills;
        const randomSkill = skills[Math.floor(Math.random() * 3)];
        spawnProjectile(owner, randomSkill.type, x, y, vx, vy);
        break;
      case 'rika':
        s.summons.push({
          owner, type: 'rika', x, y: y - 30,
          vx: vx * 3.2, vy: -3.0,
          health: 250, maxHealth: 250,
          damage: 25, attackCooldown: 0,
          scale: 18, hitFlash: 0
        });
        break;
      case 'love_beam':
        s.projectiles.push({
          x, y, vx: vx * 14.5, vy: vy * 14.5,
          owner, type: 'love_beam', damage: 75,
          color: '#10b981', scale: 24, life: 45
        });
        break;
      case 'yuta_domain':
        s[isPlayer ? 'player' : 'ai'].domainActive = 200;
        s[isPlayer ? 'player' : 'ai'].domainType = 'yuta_domain';
        s.screenShake = 10;
        break;
      case 'divine_dog':
        s.summons.push({
          owner, type: 'dog', x, y: y - 10,
          vx: vx * 3.5, vy: -5.0,
          health: 120, maxHealth: 120,
          damage: 15, attackCooldown: 0,
          scale: 12, hitFlash: 0
        });
        break;
      case 'nue':
        s.summons.push({
          owner, type: 'nue', x, y: y - 30,
          vx: vx * 4.2, vy: -2.0,
          health: 90, maxHealth: 90,
          damage: 8, attackCooldown: 0,
          scale: 13, hitFlash: 0
        });
        break;
      case 'rabbits':
        for (let i = 0; i < 10; i++) {
          const rx = Math.cos(i * (Math.PI * 2 / 10));
          const ry = Math.sin(i * (Math.PI * 2 / 10));
          s.summons.push({
            owner, type: 'rabbit',
            x: x + rx * 20, y: y + ry * 20,
            vx: rx * 2.5, vy: ry * 2.5 - 2,
            health: 15, maxHealth: 15,
            damage: 1, attackCooldown: 0,
            scale: 6, hitFlash: 0
          });
        }
        break;
      case 'shadow_garden':
        s[isPlayer ? 'player' : 'ai'].domainActive = 240;
        s[isPlayer ? 'player' : 'ai'].domainType = 'shadow_garden';
        break;
      case 'flyhead':
        for (let i = -0.25; i <= 0.25; i += 0.25) {
          const rx = Math.cos(Math.atan2(vy, vx) + i);
          const ry = Math.sin(Math.atan2(vy, vx) + i);
          s.summons.push({
            owner, type: 'flyhead',
            x: x + rx * 10, y: y + ry * 10,
            vx: rx * 4.0, vy: ry * 4.0 - 1.0,
            health: 40, maxHealth: 40,
            damage: 4, attackCooldown: 0,
            scale: 9, hitFlash: 0
          });
        }
        break;
      case 'curse_assault':
        s.summons.push({
          owner, type: 'assault_curse', x, y: y - 10,
          vx: vx * 2.8, vy: -3.0,
          health: 180, maxHealth: 180,
          damage: 22, attackCooldown: 0,
          scale: 14, hitFlash: 0
        });
        break;
      case 'rainbow_dragon':
        s.summons.push({
          owner, type: 'rainbow_dragon', x, y: y - 20,
          vx: vx * 3.0, vy: -4.0,
          health: 150, maxHealth: 150,
          damage: 18, attackCooldown: 0,
          scale: 14, hitFlash: 0
        });
        break;
      case 'uzumaki':
        s.projectiles.push({
          x, y, vx: vx * 12, vy: vy * 12,
          owner, type: 'uzumaki', damage: 55,
          color: '#475569', scale: 22, life: 40, isCurse: true
        });
        break;
      case 'curse_swarm':
        s[isPlayer ? 'player' : 'ai'].domainActive = 240;
        s[isPlayer ? 'player' : 'ai'].domainType = 'womb_profusion'; 
        s.screenShake = 18;

        // Spawn 6 flyheads
        for (let i = 0; i < 6; i++) {
          s.summons.push({
            owner, type: 'flyhead',
            x: x + (Math.random() - 0.5) * 40,
            y: y - 20 - Math.random() * 40,
            vx: (owner === 'player' ? 1.0 : -1.0) * (3.0 + Math.random() * 2),
            vy: -Math.random() * 3 - 1,
            health: 40, maxHealth: 40,
            damage: 4, attackCooldown: 0,
            scale: 9, hitFlash: 0
          });
        }
        // Spawn 2 heavy assault curses
        for (let i = 0; i < 2; i++) {
          s.summons.push({
            owner, type: 'assault_curse',
            x: x + (Math.random() - 0.5) * 30,
            y: y - 10,
            vx: (owner === 'player' ? 1.0 : -1.0) * (2.0 + Math.random() * 1.5),
            vy: -3.0 - Math.random() * 2,
            health: 180, maxHealth: 180,
            damage: 22, attackCooldown: 0,
            scale: 14, hitFlash: 0
          });
        }
        addLog(`👻 [백귀야행] 게토가 수많은 주령 군세를 일시에 해방하여 전장을 뒤덮었습니다!`);
        break;
      case 'ratio':
        s.projectiles.push({
          x, y, vx: vx * 12, vy: vy * 12,
          owner, type: 'ratio', damage: 20,
          color: '#fbbf24', scale: 9.5, life: 30, isRatio: true
        });
        break;
      case 'collapse':
        s.projectiles.push({
          x: x + vx * 90, y: y + vy * 90, vx: 0, vy: 0,
          owner, type: 'collapse', damage: 42,
          color: '#b45309', scale: 28, life: 15
        });
        break;
      case 'overtime':
        s[isPlayer ? 'player' : 'ai'].overtimeActive = 480;
        break;
      case 'nanami_ultimate':
        s.projectiles.push({
          x, y, vx: vx * 11, vy: vy * 11,
          owner, type: 'nanami_ult', damage: 73,
          color: '#f59e0b', scale: 14, life: 40, isRatioForce: true
        });
        break;
      case 'spear_of_heaven':
        s.projectiles.push({
          x, y, vx: vx * 12, vy: vy * 12,
          owner, type: 'spear', damage: 18 * dmgMult,
          color: '#cbd5e1', scale: 8, life: 50, isSpear: true
        });
        break;
      case 'soul_split':
        s.projectiles.push({
          x, y, vx: vx * 10, vy: vy * 10,
          owner, type: 'soul', damage: 28 * dmgMult,
          color: '#475569', scale: 12, life: 25, ignoresDefense: true
        });
        break;
      case 'toji_pistol':
        s.projectiles.push({
          x, y, vx: vx * 15, vy: vy * 15,
          owner, type: 'bullet', damage: 10 * dmgMult,
          color: '#e2e8f0', scale: 5, life: 60
        });
        break;
      case 'toji_ultimate':
        s[isPlayer ? 'player' : 'ai'].comboActive = 120;
        break;

      // === NEW SKILLS (SORCERERS) ===
      case 'nail':
        s.projectiles.push({
          x, y, vx: vx * 15, vy: vy * 15,
          owner, type: 'nail', damage: 20,
          color: '#ec4899', scale: 6.5, life: 50
        });
        break;
      case 'hairpin':
        s.projectiles.push({
          x: x + vx * 110, y: y + vy * 110, vx: 0, vy: 0,
          owner, type: 'hairpin', damage: 44,
          color: '#f43f5e', scale: 24, life: 10, explosive: true
        });
        break;
      case 'resonance':
        s.projectiles.push({
          x, y, vx: vx * 14.5, vy: vy * 14.5,
          owner, type: 'resonance', damage: 55,
          color: '#db2777', scale: 11, life: 35, ignoresDefense: true
        });
        break;
      case 'straw_barrage':
        s[isPlayer ? 'player' : 'ai'].comboActive = 220;
        break;

      case 'speech_stop':
        s.projectiles.push({
          x, y, vx: vx * 13.5, vy: vy * 13.5,
          owner, type: 'speech_stop', damage: 18,
          color: '#818cf8', scale: 12, life: 40, paralyzing: true
        });
        break;
      case 'speech_blast':
        s.projectiles.push({
          x, y, vx: vx * 11.5, vy: vy * 11.5,
          owner, type: 'speech_blast', damage: 42,
          color: '#4f46e5', scale: 18, life: 45, explosive: true
        });
        break;
      case 'throat_candy':
        {
          const host = s[isPlayer ? 'player' : 'ai'];
          host.health = Math.min(host.maxHealth, host.health + 48);
          host.cursedEnergy = Math.min(100, host.cursedEnergy + 45);
          host.cooldowns[0] = 0;
          host.cooldowns[1] = 0;
        }
        break;
      case 'speech_crush':
        s[isPlayer ? 'player' : 'ai'].domainActive = 200;
        s[isPlayer ? 'player' : 'ai'].domainType = 'speech_crush';
        break;

      case 'boogie_slap':
        s.projectiles.push({
          x, y, vx: vx * 11, vy: vy * 11,
          owner, type: 'boogie_slap', damage: 26,
          color: '#fb923c', scale: 9.5, life: 25
        });
        break;
      case 'boogie_clap':
        const targetEntity = isPlayer ? s.ai : s.player;
        const selfEntity = isPlayer ? s.player : s.ai;
        const tempX = selfEntity.x;
        const tempY = selfEntity.y;
        selfEntity.x = targetEntity.x;
        selfEntity.y = targetEntity.y;
        targetEntity.x = tempX;
        targetEntity.y = tempY;
        s.projectiles.push({
          x: selfEntity.x, y: selfEntity.y, vx: 0, vy: 0,
          owner, type: 'clap_blast', damage: 60,
          color: '#f97316', scale: 26, life: 10
        });
        sfx.playFlashbang();
        addLog(`👏 [부기우기] 박수와 동시에 위치가 교체됩니다! (폭발 피해 60)`);
        break;
      case 'pebble_swap':
        s.projectiles.push({
          x, y, vx: vx * 13, vy: vy * 13,
          owner, type: 'pebble_swap', damage: 20,
          color: '#a1a1aa', scale: 6, life: 65, homing: true
        });
        break;
      case 'todo_rush':
        {
          const host = s[isPlayer ? 'player' : 'ai'];
          host.comboActive = 300;
          host.vx = vx * 22; // Instant super tackle dash
          s.projectiles.push({
            x: host.x, y: host.y, vx: vx * 12, vy: 0,
            owner, type: 'todo_rush_charge', damage: 80,
            color: '#f97316', scale: 28, life: 18, repulsion: true
          });
          sfx.playExplosion();
          addLog(`👊 [초고속 연수 타격] 토도가 포효하며 돌격해 적을 강타합니다! (피해 80)`);
        }
        break;

      // === NEW SKILLS (CURSE USERS / ANTAGONISTS) ===
      case 'idle_transfigure':
        const attacker = isPlayer ? s.player : s.ai;
        attacker.x += vx * 60;
        attacker.y += vy * 60;
        s.projectiles.push({
          x: attacker.x, y: attacker.y, vx: 0, vy: 0,
          owner, type: 'idle_transfigure', damage: 40,
          color: '#2dd4bf', scale: 14, life: 10, ignoresDefense: true
        });
        break;
      case 'spawn_transfigured':
        s.summons.push({
          x, y: y - 10,
          vx: vx * 3.5, vy: -5.0,
          health: 150, maxHealth: 150,
          damage: 9, attackCooldown: 0,
          owner, type: 'transfigured_human', scale: 12,
          hitFlash: 0
        });
        break;
      case 'soul_multiplicity':
        for (let i = -0.3; i <= 0.3; i += 0.3) {
          const rx = Math.cos(Math.atan2(vy, vx) + i);
          const ry = Math.sin(Math.atan2(vy, vx) + i);
          s.projectiles.push({
            x, y, vx: rx * 9.5, vy: ry * 9.5,
            owner, type: 'soul_mult', damage: 26,
            color: '#14b8a6', scale: 10, life: 50
          });
        }
        break;
      case 'self_embodiment':
        s[isPlayer ? 'player' : 'ai'].domainActive = 240;
        s[isPlayer ? 'player' : 'ai'].domainType = 'self_embodiment';
        break;

      case 'ember_insect':
        s.projectiles.push({
          x, y, vx: vx * 10, vy: vy * 10,
          owner, type: 'ember_insect', damage: 25,
          color: '#f97316', scale: 8, life: 80, homing: true, explosive: true
        });
        break;
      case 'volcano_eruption':
        s.projectiles.push({
          x: x + vx * 90, y: y + vy * 90, vx: 0, vy: 0,
          owner, type: 'volcano', damage: 38,
          color: '#ea580c', scale: 24, life: 12, explosive: true
        });
        break;
      case 'jogo_meteor':
        s.projectiles.push({
          x, y, vx: vx * 7.5, vy: vy * 7.5,
          owner, type: 'meteor', damage: 85,
          color: '#dc2626', scale: 38, life: 90, explosive: true
        });
        break;
      case 'iron_mountain':
        s[isPlayer ? 'player' : 'ai'].domainActive = 250;
        s[isPlayer ? 'player' : 'ai'].domainType = 'iron_mountain';
        break;

      case 'wood_root':
        s.projectiles.push({
          x, y, vx: vx * 11.5, vy: vy * 11.5,
          owner, type: 'wood_root', damage: 22,
          color: '#15803d', scale: 10, life: 45, paralyzing: true
        });
        break;
      case 'cursed_bud':
        s.projectiles.push({
          x, y, vx: vx * 12, vy: vy * 12,
          owner, type: 'cursed_bud', damage: 18,
          color: '#4ade80', scale: 9, life: 55, absorbsEnergy: true
        });
        break;
      case 'flower_field':
        s.projectiles.push({
          x: x + vx * 50, y: y + vy * 50, vx: 0, vy: 0,
          owner, type: 'flower_field', damage: 28,
          color: '#f472b6', scale: 32, life: 120
        });
        break;
      case 'wasteland_domain':
        s[isPlayer ? 'player' : 'ai'].domainActive = 220;
        s[isPlayer ? 'player' : 'ai'].domainType = 'wasteland_domain';
        break;

      case 'blood_slicing':
        s.projectiles.push({
          x, y, vx: vx * 12, vy: vy * 12,
          owner, type: 'blood_slice', damage: 15,
          color: '#b91c1c', scale: 8, life: 40
        });
        break;
      case 'blood_supernova':
        s.projectiles.push({
          x, y, vx: vx * 9, vy: vy * 9,
          owner, type: 'blood_supernova', damage: 20,
          color: '#dc2626', scale: 12, life: 40, splitSupernova: true
        });
        break;
      case 'blood_beam':
        s.projectiles.push({
          x, y, vx: vx * 17, vy: vy * 17,
          owner, type: 'blood_beam', damage: 32,
          color: '#ef4444', scale: 6, life: 30
        });
        break;
      case 'blood_armor':
        s[isPlayer ? 'player' : 'ai'].shield = Math.min(100, s[isPlayer ? 'player' : 'ai'].shield + 45);
        sfx.playPowerup();
        break;

      case 'gravity_push':
        s.projectiles.push({
          x, y, vx: vx * 11, vy: vy * 11,
          owner, type: 'gravity_push', damage: 15,
          color: '#701a75', scale: 14, life: 45, repulsion: true
        });
        break;
      case 'curse_column':
        s.projectiles.push({
          x: x + vx * 90, y: y + vy * 90, vx: 0, vy: 0,
          owner, type: 'curse_column', damage: 28,
          color: '#4a044e', scale: 22, life: 15
        });
        break;
      case 'womb_profusion':
        s[isPlayer ? 'player' : 'ai'].domainActive = 240;
        s[isPlayer ? 'player' : 'ai'].domainType = 'womb_profusion';
        break;
      case 'projection_rail':
        {
          const host = s[isPlayer ? 'player' : 'ai'];
          host.vx = vx * 24.0;
          s.projectiles.push({
            x: host.x, y: host.y, vx: vx * 13, vy: 0,
            owner, type: 'projection_rail', damage: 15 * dmgMult,
            color: '#a3e635', scale: 15, life: 15
          });
          sfx.playPowerup();
        }
        break;
      case 'frame_freeze':
        s.projectiles.push({
          x, y, vx: vx * 12.5, vy: vy * 12.5,
          owner, type: 'frame_freeze', damage: 22 * dmgMult,
          color: '#84cc16', scale: 12, life: 40, frameFreeze: true
        });
        break;
      case 'speed_accumulate':
        s[isPlayer ? 'player' : 'ai'].comboActive = 180;
        sfx.playPowerup();
        break;
      case 'moon_palace':
        s[isPlayer ? 'player' : 'ai'].domainActive = 220;
        s[isPlayer ? 'player' : 'ai'].domainType = 'moon_palace';
        break;
    }

    if (type === 'void' || type === 'shrine' || type === 'yuta_domain' || type === 'shadow_garden' || type === 'self_embodiment' || type === 'iron_mountain' || type === 'wasteland_domain' || type === 'womb_profusion' || type === 'moon_palace') {
      s.domainCutIn = {
        active: 45,
        charKey: char,
        domainName: CHARACTERS[char].skills[3].name
      };
      sfx.playFlashbang();
    }

    s.spellText = {
      text: CHARACTERS[char].name + ` 시전: 「${type}」`,
      life: 60,
      color: CHARACTERS[char].color
    };
  };

  const fireSkill = (index) => {
    const s = stateRef.current;
    const charData = CHARACTERS[selectedChar];
    const skill = charData.skills[index];

    if (s.player.cooldowns[index] > 0) {
      addLog(`🚨 [재사용 대기] ${skill.name} 시전 불가! (${(s.player.cooldowns[index] / 60).toFixed(1)}초 남음)`);
      return;
    }
    if (s.player.cursedEnergy < skill.cost) {
      addLog(`🚨 [주력 부족] ${skill.name} 시전에 주력이 부족합니다! (필요: ${skill.cost})`);
      return;
    }

    s.player.cursedEnergy -= skill.cost;
    s.player.cooldowns[index] = skill.cooldown;
    s.screenShake = 5;
    sfx.playLaser();

    const angle = s.player.angle;
    const vx = Math.cos(angle);
    const vy = Math.sin(angle);

    spawnProjectile('player', skill.type, s.player.x, s.player.y, vx, vy);
    addLog(`✨ [술식 발동] 「${skill.name}」 시전 완료!`);
  };

  const updateAI = () => {
    const s = stateRef.current;
    const p = s.player;
    const ai = s.ai;
    if (ai.health <= 0 || p.health <= 0) return;

    if (ai.frozen > 0) {
      ai.frozen--;
      return;
    }

    // Determine active target for AI (Prioritize player's active summons for aggro)
    let aiTarget = p;
    const playerSummons = s.summons.filter(sum => sum.owner === 'player' && sum.health > 0);
    if (playerSummons.length > 0) {
      let closestSum = playerSummons[0];
      let minDist = Math.hypot(closestSum.x - ai.x, closestSum.y - ai.y);
      playerSummons.forEach((sum) => {
        const d = Math.hypot(sum.x - ai.x, sum.y - ai.y);
        if (d < minDist) {
          minDist = d;
          closestSum = sum;
        }
      });
      aiTarget = closestSum;
    }

    // AI Guard Decision
    let shouldGuard = false;
    const activeProjectiles = s.projectiles.filter(proj => proj.owner === 'player');
    activeProjectiles.forEach((proj) => {
      const dist = Math.hypot(proj.x - ai.x, proj.y - ai.y);
      if (dist < 100 && ai.cursedEnergy > 15) {
        shouldGuard = true;
      }
    });

    if (shouldGuard && Math.random() < 0.7) {
      ai.isGuarding = true;
      ai.cursedEnergy = Math.max(0, ai.cursedEnergy - 0.4);
      ai.vx *= 0.5; 
    } else {
      ai.isGuarding = false;
    }

    if (!ai.isGuarding) {
      const dx = aiTarget.x - ai.x;
      const baseSpeed = CHARACTERS[selectedAIChar].speed * 28;
      let speed = ai.comboActive > 0 ? baseSpeed * 1.8 : baseSpeed;
      if (ai.overtimeActive > 0) speed *= 1.65;
      let targetVx = 0;
      if (Math.abs(dx) > 18) {
        targetVx = Math.sign(dx) * speed;
      }
      ai.vx = ai.vx * 0.82 + targetVx * 0.18;
      ai.x += ai.vx;
    }

    const isAiOnFloor = checkPlatforms(ai);
    if (aiTarget.y < ai.y - 45 && isAiOnFloor && Math.random() < 0.04) {
      ai.vy = -7.8; 
    }

    if (aiTarget.y < ai.y - 80 && !isAiOnFloor && ai.doubleJumpAvailable && Math.random() < 0.02) {
      ai.vy = -7.2;
      ai.doubleJumpAvailable = false;
      s.particles.push({
        x: ai.x, y: ai.y + 18, vx: 0, vy: 0.5, color: 'rgba(255,255,255,0.4)', size: 4, life: 15
      });
    }

    if (ai.dropThroughTimer > 0) ai.dropThroughTimer--;
    if (aiTarget.y > ai.y + 45 && isAiOnFloor && Math.random() < 0.01 && ai.y < GROUND_Y - 40) {
      ai.dropThroughTimer = 15; 
    }

    ai.y += ai.vy;
    ai.vy += 0.3; 
    checkPlatforms(ai);
    if (ai.y > GROUND_Y - 18) {
      ai.y = GROUND_Y - 18;
      ai.vy = 0;
    }

    // Wall bounce logic AI
    if (ai.x <= 20) {
      if (Math.abs(ai.vx) > 5) {
        ai.vx = -ai.vx * 0.65;
        s.screenShake = 8;
        sfx.playPlayerHit();
        spawnFloatingText(ai.x, ai.y, 'Wall Bounce!', '#ef4444', 1.1);
      }
      ai.x = 20;
    }
    if (ai.x >= 620) {
      if (Math.abs(ai.vx) > 5) {
        ai.vx = -ai.vx * 0.65;
        s.screenShake = 8;
        sfx.playPlayerHit();
        spawnFloatingText(ai.x, ai.y, 'Wall Bounce!', '#ef4444', 1.1);
      }
      ai.x = 620;
    }

    ai.angle = Math.atan2(aiTarget.y - ai.y, aiTarget.x - ai.x);

    // Casting timers ticks
    if (ai.castingTimer > 0) ai.castingTimer--;

    for (let i = 0; i < 4; i++) {
      if (ai.cooldowns[i] > 0) ai.cooldowns[i]--;
    }
    if (ai.reverseCursedCooldown > 0) ai.reverseCursedCooldown--;
    if (ai.comboActive > 0) ai.comboActive--;
    if (ai.overtimeActive > 0) ai.overtimeActive--;
    if (ai.isGodModeDisabled > 0) ai.isGodModeDisabled--;

    if (ai.health < ai.maxHealth * 0.4 && ai.reverseCursedCooldown <= 0 && ai.cursedEnergy >= 35) {
      useAIReverseCursed();
    }

    if (Math.random() < 0.022 && Math.hypot(aiTarget.x - ai.x, aiTarget.y - ai.y) < 360 && !ai.isGuarding) {
      const skills = CHARACTERS[selectedAIChar].skills;
      const eligible = [];
      for (let i = 0; i < 4; i++) {
        if (ai.cooldowns[i] <= 0 && ai.cursedEnergy >= skills[i].cost) {
          eligible.push(i);
        }
      }
      if (eligible.length > 0) {
        const skillIdx = eligible[Math.floor(Math.random() * eligible.length)];
        const skill = skills[skillIdx];
        ai.cursedEnergy -= skill.cost;
        ai.cooldowns[skillIdx] = skill.cooldown;
        
        const vx = Math.cos(ai.angle);
        const vy = Math.sin(ai.angle);
        spawnProjectile('ai', skill.type, ai.x, ai.y, vx, vy);
        addLog(`👹 [적 술식] AI가 「${skill.name}」을(를) 방사했습니다!`);
      }
    }

    ai.cursedEnergy = Math.min(100, ai.cursedEnergy + (selectedAIChar === 'toji' ? 2.5 : 0.25));
  };

  const updateGame = () => {
    const s = stateRef.current;
    const p = s.player;
    const ai = s.ai;

    if (gameState !== 'playing') return;

    // --- High-Fidelity 1: Hit-Stop Updates freeze ---
    if (s.hitStopFrames > 0) {
      s.hitStopFrames--;
      // Update damage texts even during hit stop for dynamic visual response
      s.floatingTexts.forEach((ft) => {
        ft.x += ft.vx;
        ft.y += ft.vy;
        ft.vy += 0.15; // float gravity physics
        ft.opacity -= 0.025;
      });
      s.floatingTexts = s.floatingTexts.filter((ft) => ft.opacity > 0);
      render2D();
      return;
    }

    if (s.domainCutIn.active > 0) {
      s.domainCutIn.active--;
      render2D();
      return;
    }

    if (s.slowMoActive > 0) {
      s.slowMoActive--;
      if (s.slowMoActive % 5 !== 0) {
        render2D();
        return;
      }
    }

    try {
      const isPlayerOnFloor = checkPlatforms(p);
      const isPressingGuard = (s.keys['s'] || s.keys['arrowdown']) && isPlayerOnFloor;

      if (isPressingGuard && p.cursedEnergy > 1.0) {
        p.isGuarding = true;
        p.cursedEnergy = Math.max(0, p.cursedEnergy - 0.5); 
        p.vx = p.vx * 0.5; 
      } else {
        p.isGuarding = false;
      }

      if (p.dropThroughTimer > 0) p.dropThroughTimer--;
      if ((s.keys['s'] || s.keys['arrowdown']) && p.y < GROUND_Y - 40 && !isPlayerOnFloor) {
        p.dropThroughTimer = 15;
      }

      const isDashing = s.keys['shift'];
      let maxSpeed = CHARACTERS[selectedChar].speed * 28;
      if (isDashing) maxSpeed *= 1.8;
      if (p.comboActive > 0) maxSpeed *= 1.8;
      if (p.overtimeActive > 0) maxSpeed *= 1.65;
      if (p.frozen > 0) maxSpeed = 0;

      let targetVx = 0;
      if (!p.isGuarding) {
        if (s.keys['a'] || s.keys['arrowleft']) targetVx -= maxSpeed;
        if (s.keys['d'] || s.keys['arrowright']) targetVx += maxSpeed;
      }

      p.vx = p.vx * 0.82 + targetVx * 0.18;
      p.x += p.vx;

      if ((s.keys['w'] || s.keys['arrowup'] || s.keys[' ']) && !p.isGuarding) {
        if (!s.keys['jump_pressed']) {
          s.keys['jump_pressed'] = true;
          if (isPlayerOnFloor && p.frozen <= 0) {
            p.vy = -7.8;
            p.doubleJumpAvailable = true;
          } else if (!isPlayerOnFloor && p.doubleJumpAvailable && p.frozen <= 0) {
            p.vy = -7.2;
            p.doubleJumpAvailable = false;
            for (let i = 0; i < 6; i++) {
              s.particles.push({
                x: p.x, y: p.y + 18,
                vx: (Math.random() - 0.5) * 4,
                vy: Math.random() * 2 + 1,
                color: '#ffffff', size: 3, life: 20
              });
            }
          }
        }
      } else {
        s.keys['jump_pressed'] = false;
      }

      p.y += p.vy;
      p.vy += 0.3; 
      checkPlatforms(p);
      if (p.y > GROUND_Y - 18) {
        p.y = GROUND_Y - 18;
        p.vy = 0;
      }

      // Wall Bounce recoil physics logic
      if (p.x <= 20) {
        if (Math.abs(p.vx) > 5) {
          p.vx = -p.vx * 0.65;
          s.screenShake = 8;
          sfx.playPlayerHit();
          spawnFloatingText(p.x, p.y, 'Wall Bounce!', '#ef4444', 1.1);
        }
        p.x = 20;
      }
      if (p.x >= 620) {
        if (Math.abs(p.vx) > 5) {
          p.vx = -p.vx * 0.65;
          s.screenShake = 8;
          sfx.playPlayerHit();
          spawnFloatingText(p.x, p.y, 'Wall Bounce!', '#ef4444', 1.1);
        }
        p.x = 620;
      }

      const pdx = s.mouse.x - p.x;
      const pdy = s.mouse.y - p.y;
      p.angle = Math.atan2(pdy, pdx);

      if (isDashing && Math.abs(p.vx) > 2) {
        if (p.dashTrailCooldown <= 0) {
          s.phantomClones.push({
            x: p.x, y: p.y, angle: p.angle, charKey: selectedChar, opacity: 0.6
          });
          p.dashTrailCooldown = 4;
        }
        if (Math.random() < 0.3) {
          s.particles.push({
            x: p.x + (Math.random() - 0.5) * 16,
            y: p.y + 18,
            vx: -Math.sign(p.vx) * (Math.random() * 2 + 1),
            vy: -Math.random() * 1.5,
            color: 'rgba(255, 255, 255, 0.25)',
            size: Math.random() * 4 + 2,
            life: 15
          });
        }
      }
      if (p.dashTrailCooldown > 0) p.dashTrailCooldown--;

      // Casting window update
      if (p.castingTimer > 0) p.castingTimer--;

      s.phantomClones = s.phantomClones.filter((clone) => {
        clone.opacity -= 0.05;
        return clone.opacity > 0;
      });

      s.groundWaves = s.groundWaves.filter((wave) => {
        wave.radius += 2.5;
        wave.opacity -= 0.06;
        return wave.opacity > 0;
      });

      // Update floating damage numbers
      s.floatingTexts.forEach((ft) => {
        ft.x += ft.vx;
        ft.y += ft.vy;
        ft.vy += 0.15; // gravity arc
        ft.opacity -= 0.025;
      });
      s.floatingTexts = s.floatingTexts.filter((ft) => ft.opacity > 0);

      if (s.spellText.life > 0) s.spellText.life--;

      for (let i = 0; i < 4; i++) {
        if (p.cooldowns[i] > 0) p.cooldowns[i]--;
      }
      if (p.reverseCursedCooldown > 0) p.reverseCursedCooldown--;
      if (p.comboActive > 0) p.comboActive--;
      if (p.overtimeActive > 0) p.overtimeActive--;
      if (p.frozen > 0) p.frozen--;
      if (p.isGodModeDisabled > 0) p.isGodModeDisabled--;

      p.cursedEnergy = Math.min(100, p.cursedEnergy + (selectedChar === 'toji' ? 2.5 : 0.25));

      if (s.screenShake > 0) s.screenShake -= 0.5;
      if (s.damageFlash > 0) s.damageFlash -= 0.05;
      if (s.healFlash > 0) s.healFlash -= 0.05;

      updateAI();

      p.shield = Math.min(100, p.shield + 0.1);
      ai.shield = Math.min(100, ai.shield + 0.1);

      const handleDomainTick = (oppEntity, domainType) => {
        if (domainType === 'shrine') {
          const isGojoBarrierActive = oppEntity === p && selectedChar === 'gojo' && p.isGodModeDisabled <= 0;
          if (!isGojoBarrierActive) {
            oppEntity.health -= 1.2;
            if (Math.random() < 0.15) sfx.playKatanaSlash();
          }
        } else if (domainType === 'self_embodiment') {
          oppEntity.health -= 2.2;
          if (Math.random() < 0.1) sfx.playRadioStatic();
        } else if (domainType === 'iron_mountain') {
          oppEntity.health -= 2.0;
          if (Math.random() < 0.1) sfx.playExplosion();
        } else if (domainType === 'womb_profusion') {
          oppEntity.health -= 2.0;
          oppEntity.x += (Math.random() - 0.5) * 5;
        } else if (domainType === 'wasteland_domain') {
          oppEntity.health -= 2.2;
          const hostKey = oppEntity === p ? 'ai' : 'player';
          s[hostKey].cursedEnergy = Math.min(100, s[hostKey].cursedEnergy + 0.85);
        } else if (domainType === 'moon_palace') {
          oppEntity.health -= 2.2;
          oppEntity.frozen = Math.max(oppEntity.frozen, 5);
          if (Math.random() < 0.25) {
            s.particles.push({
              x: oppEntity.x + (Math.random() - 0.5) * 35,
              y: oppEntity.y + (Math.random() - 0.5) * 35,
              vx: 0, vy: -1.0, color: '#a3e635', size: 4.5, life: 15
            });
          }
        } else if (domainType === 'void') {
          oppEntity.frozen = Math.max(oppEntity.frozen, 5);
        } else if (domainType === 'speech_crush') {
          oppEntity.health -= 2.2;
          oppEntity.frozen = Math.max(oppEntity.frozen, 7);
          oppEntity.vy = Math.min(oppEntity.vy + 2.5, 9.0);
          if (Math.random() < 0.25) {
            s.screenShake = 6;
            for (let i = 0; i < 4; i++) {
              s.particles.push({
                x: oppEntity.x + (Math.random() - 0.5) * 40,
                y: oppEntity.y + (Math.random() - 0.5) * 40,
                vx: (Math.random() - 0.5) * 6,
                vy: (Math.random() - 0.5) * 6,
                color: '#818cf8', size: 3.5, life: 18
              });
            }
          }
        }
      };

      if (p.domainActive > 0) {
        p.domainActive--;
        handleDomainTick(ai, p.domainType);
      }
      if (ai.domainActive > 0) {
        ai.domainActive--;
        handleDomainTick(p, ai.domainType);
      }

      // --- Update Summons (Necromancer Systems) ---
      s.summons = s.summons.filter((summon) => {
        // Find closest hostile target (either enemy Hero or any enemy Summon)
        const oppHero = summon.owner === 'player' ? ai : p;
        let summonTarget = oppHero;
        let minDist = Math.hypot(oppHero.x - summon.x, oppHero.y - summon.y);

        // Scan for enemy summons
        const hostileSummons = s.summons.filter(sum => sum.owner !== summon.owner && sum.health > 0);
        hostileSummons.forEach((hSum) => {
          const distToHSum = Math.hypot(hSum.x - summon.x, hSum.y - summon.y);
          if (distToHSum < minDist) {
            minDist = distToHSum;
            summonTarget = hSum;
          }
        });

        const dx = summonTarget.x - summon.x;
        const dy = summonTarget.y - summon.y;
        const isFlying = summon.type === 'nue' || summon.type === 'flyhead' || summon.type === 'rainbow_dragon' || summon.type === 'rika';

        if (isFlying) {
          // Flying AI: track 2D coordinates (no gravity)
          const dist = Math.hypot(dx, dy);
          if (dist > 15) {
            let flySpeed = 3.0;
            if (summon.type === 'nue') flySpeed = 2.5;
            if (summon.type === 'rika') flySpeed = 3.6;
            summon.vx = (dx / dist) * flySpeed;
            summon.vy = (dy / dist) * flySpeed;
          } else {
            summon.vx = 0;
            summon.vy = 0;
          }
          summon.x += summon.vx;
          summon.y += summon.vy;
        } else {
          // Ground AI: gravity & platforms check
          summon.vy += 0.3;
          summon.y += summon.vy;
          
          let isSummonOnFloor = checkPlatforms(summon);
          if (summon.y > GROUND_Y - 18) {
            summon.y = GROUND_Y - 18;
            summon.vy = 0;
            isSummonOnFloor = true;
          }

          let speed = 1.8;
          if (summon.type === 'dog') speed = 2.5;
          if (summon.type === 'rabbit') speed = 2.0;
          if (summon.type === 'assault_curse') speed = 1.6;

          if (Math.abs(dx) > 10) {
            summon.vx = Math.sign(dx) * speed;
          } else {
            summon.vx = 0;
          }
          summon.x += summon.vx;
        }

        // Clamp boundaries
        summon.x = Math.max(20, Math.min(620, summon.x));

        // Attack cooldown tick
        if (summon.attackCooldown > 0) summon.attackCooldown--;
        const distToTarget = Math.hypot(summon.x - summonTarget.x, summon.y - summonTarget.y);
        
        if (distToTarget < 28 && summon.attackCooldown <= 0 && summonTarget.health > 0) {
          summonTarget.health -= summon.damage;
          summonTarget.hitFlash = 3;
          sfx.playEnemyHit();

          let popupColor = '#14b8a6'; 
          if (summon.type === 'dog' || summon.type === 'rabbit') popupColor = '#cbd5e1';
          if (summon.type === 'nue') popupColor = '#eab308';
          if (summon.type === 'flyhead' || summon.type === 'assault_curse') popupColor = '#84cc16';
          if (summon.type === 'rainbow_dragon') popupColor = '#e2e8f0';
          if (summon.type === 'rika') popupColor = '#94a3b8';

          spawnFloatingText(summonTarget.x, summonTarget.y - 15, `${summon.damage}`, popupColor, 1.0);
          
          const isHero = summonTarget === p || summonTarget === ai;
          if (isHero) {
            if (summon.type === 'nue') {
              summonTarget.frozen = 45; 
              summon.attackCooldown = 72; 
            } else if (summon.type === 'assault_curse') {
              summonTarget.vx += Math.sign(summon.vx) * 8.5; 
              summon.attackCooldown = 60;
            } else if (summon.type === 'rainbow_dragon') {
              summonTarget.vx += Math.sign(summon.vx) * 6.5; 
              summon.attackCooldown = 55;
            } else if (summon.type === 'rika') {
              summonTarget.vx += Math.sign(summon.vx) * 5.5;
              summon.attackCooldown = 50;
            } else if (summon.type === 'dog') {
              summonTarget.vx += Math.sign(summon.vx) * 4.5;
              summon.attackCooldown = 50;
            } else if (summon.type === 'rabbit') {
              summon.attackCooldown = 30;
            } else {
              summon.attackCooldown = 45;
              summonTarget.vx += Math.sign(summon.vx) * 3.5;
            }
          } else {
            // Attacking enemy summons (simple knockback and 40-frame CD)
            summonTarget.vx += Math.sign(summon.vx) * 3.0;
            summon.attackCooldown = 40;
          }
        }

        if (summon.hitFlash > 0) summon.hitFlash--;

        if (summon.health <= 0) {
          let particleColor = '#14b8a6';
          if (summon.type === 'dog' || summon.type === 'rabbit') particleColor = '#cbd5e1';
          if (summon.type === 'nue') particleColor = '#eab308';
          if (summon.type === 'flyhead' || summon.type === 'assault_curse') particleColor = '#84cc16';
          if (summon.type === 'rainbow_dragon') particleColor = '#e2e8f0';
          if (summon.type === 'rika') particleColor = '#64748b';

          for (let i = 0; i < 8; i++) {
            s.particles.push({
              x: summon.x, y: summon.y,
              vx: (Math.random() - 0.5) * 4,
              vy: (Math.random() - 0.5) * 4,
              color: particleColor, size: 3, life: 15
            });
          }
          return false;
        }

        return true;
      });

      s.projectiles = s.projectiles.filter((proj) => {
        proj.x += proj.vx;
        proj.y += proj.vy;
        proj.life--;

        if (proj.life <= 0) {
          if (proj.splitSupernova) {
            for (let i = 0; i < 8; i++) {
              const rx = Math.cos(i * (Math.PI * 2 / 8));
              const ry = Math.sin(i * (Math.PI * 2 / 8));
              s.projectiles.push({
                x: proj.x, y: proj.y, vx: rx * 6.5, vy: ry * 6.5,
                owner: proj.owner, type: 'blood_drop', damage: 8,
                color: '#b91c1c', scale: 5, life: 30
              });
            }
          }
          return false;
        }

        if (proj.x < 0 || proj.x > 640 || proj.y < 0 || proj.y > GROUND_Y + 10) {
          if (proj.explosive) triggerExplosion(proj.x, proj.y, proj.owner, proj.damage);
          return false;
        }

        if (proj.homing) {
          const target = proj.owner === 'player' ? ai : p;
          const tdx = target.x - proj.x;
          const tdy = target.y - proj.y;
          const tlen = Math.hypot(tdx, tdy);
          if (tlen > 5) {
            proj.vx = proj.vx * 0.88 + (tdx / tlen) * 1.5;
            proj.vy = proj.vy * 0.88 + (tdy / tlen) * 1.5;
          }
        }

        if (proj.gravityPull) {
          const target = proj.owner === 'player' ? ai : p;
          const tdx = proj.x - target.x;
          const tdy = proj.y - target.y;
          const tlen = Math.hypot(tdx, tdy);
          if (tlen < 250 && tlen > 10) {
            target.x += (tdx / tlen) * 1.5;
            target.y += (tdy / tlen) * 1.5;
          }
        }

        if (proj.repulsion) {
          const target = proj.owner === 'player' ? ai : p;
          const tdx = target.x - proj.x;
          const tdy = target.y - proj.y;
          const tlen = Math.hypot(tdx, tdy);
          if (tlen < 200 && tlen > 5) {
            target.x += (tdx / tlen) * 3.5;
            target.y += (tdy / tlen) * 3.5;
          }
        }

        // Check collision with enemy summons
        let hitSummon = false;
        s.summons.forEach((summon) => {
          if (summon.owner !== proj.owner && !hitSummon) {
            const distToSummon = Math.hypot(proj.x - summon.x, proj.y - summon.y);
            if (distToSummon < 22) {
              summon.health -= proj.damage;
              summon.hitFlash = 3;
              sfx.playEnemyHit();
              
              spawnFloatingText(summon.x, summon.y - 12, `${Math.ceil(proj.damage)}`, '#14b8a6', 0.9);
              
              for (let i = 0; i < 4; i++) {
                s.particles.push({
                  x: proj.x, y: proj.y,
                  vx: (Math.random() - 0.5) * 4,
                  vy: (Math.random() - 0.5) * 4,
                  color: proj.color, size: 2.5, life: 15
                });
              }
              hitSummon = true;
            }
          }
        });

        if (hitSummon) {
          if (proj.explosive) triggerExplosion(proj.x, proj.y, proj.owner, proj.damage);
          return false; // destroy projectile
        }

        const target = proj.owner === 'player' ? ai : p;
        const targetChar = proj.owner === 'player' ? selectedAIChar : selectedChar;
        const targetDist = Math.hypot(proj.x - target.x, proj.y - target.y);

        if (targetDist < 22) {
          let finalDmg = proj.damage;
          let isCounter = false;

          // --- High-Fidelity 2: Counter Hit check ---
          if (target.castingTimer > 0) {
            finalDmg *= 1.5;
            isCounter = true;
            s.screenShake = 12;
            s.hitStopFrames = 6; // Counter Hit Stop freeze
            addLog(`⚡ [COUNTER HIT] 술식 캐스팅 상태의 상대를 카운터 강타했습니다! (피해 1.5배)`);
          }
          
          if (target.isGuarding) {
            finalDmg *= 0.15;
            addLog(`🛡️ [가드] 가드로 피해의 85% 차단!`);
          }

          let isRatioCrit = false;
          if (proj.isRatio && Math.random() < 0.48) {
            finalDmg *= 9.0;
            s.screenShake = 16;
            s.hitStopFrames = 7;
            isRatioCrit = true;
            addLog(`⚡ [7:3 급소 강타!] 나나미의 격강이 작렬하여 9배 치명상을 가했습니다!`);
          } else if (proj.isRatioForce) {
            finalDmg *= 9.0;
            s.screenShake = 18;
            s.hitStopFrames = 8;
            isRatioCrit = true;
            addLog(`⚡ [정밀 7:3 격강!] 나나미가 급소선을 강제로 참격하여 9배 치명상을 입혔습니다!`);
          }
          if (proj.frameFreeze) {
            target.frozen = Math.max(target.frozen, 70);
            sfx.playPowerup();
            addLog(`⚡ [프레임 고정] 나오야의 24프레임 주법이 적중하여 상대를 액자 속에 구속했습니다!`);
          }

          const isGojoInvinc = targetChar === 'gojo' && target.isGodModeDisabled <= 0;

          if (isGojoInvinc) {
            if (proj.isSpear) {
              target.isGodModeDisabled = 180;
              target.health -= finalDmg;
              addLog(`🗡️ [무하한 해제!] 토우지의 천역모가 고죠의 무하한 배리어를 관통했습니다!`);
            } else {
              if (proj.owner === 'ai') addLog(`🛡️ [무하한 배리어] 고죠 사토루의 무하한이 대미지를 완벽히 소거합니다.`);
            }
          } else {
            if (target.shield > 0 && !proj.ignoresDefense) {
              const absorb = Math.min(target.shield, finalDmg * 0.5);
              target.shield -= absorb;
              target.health -= (finalDmg - absorb);
            } else {
              target.health -= finalDmg;
            }
          }

          if (proj.paralyzing) target.frozen = 72;

          target.hitFlash = 3;
          sfx.playEnemyHit();

          // --- High-Fidelity 3: Floating Damage Text spawner ---
          let dmgText = Math.ceil(finalDmg).toString();
          let dmgColor = '#ffffff';
          let scaleFactor = 1.0;
          
          if (isCounter) {
            dmgText = `⚔️ ${dmgText} Counter!`;
            dmgColor = '#fbbf24';
            scaleFactor = 1.35;
          } else if (isRatioCrit) {
            dmgText = `💥 ${dmgText} Ratio!`;
            dmgColor = '#fb923c';
            scaleFactor = 1.45;
          } else if (target.isGuarding) {
            dmgText = `🛡️ ${dmgText}`;
            dmgColor = '#94a3b8';
            scaleFactor = 0.8;
          }

          for (let i = 0; i < 8; i++) {
            s.particles.push({
              x: proj.x, y: proj.y,
              vx: (Math.random() - 0.5) * 6,
              vy: (Math.random() - 0.5) * 6,
              color: proj.color,
              size: Math.random() * 3 + 2,
              life: Math.random() * 20 + 10,
              maxLife: 30
            });
          }

          if (proj.isBlackFlash) {
            const chance = (proj.owner === 'player' ? selectedChar : selectedAIChar) === 'yuji' ? 0.55 : 0.35;
            if (Math.random() < chance) {
              const blackFlashDmg = proj.damage * 3.8;
              target.health -= blackFlashDmg;
              s.screenShake = 18;
              s.hitStopFrames = 12; // Massive hit freeze
              dmgText = `💥 ${Math.ceil(blackFlashDmg)} BLACK FLASH!!`;
              dmgColor = '#f43f5e';
              scaleFactor = 1.85;
              addLog(`💥 [흑섬 격발 - BLACK FLASH!] 칠흑빛 번개 타격! (3.8배 대미지!)`);
            }
          }

          // Trigger floating text spawn
          spawnFloatingText(target.x, target.y - 12, dmgText, dmgColor, scaleFactor, isCounter || isRatioCrit);

          // Knockback forces
          const kx = Math.sign(proj.vx) * (finalDmg * 0.35 + 2);
          target.vx = kx;
          if (!checkPlatforms(target)) {
            target.vy = -Math.min(4, finalDmg * 0.1); // pop up
          }

          if (proj.delayedStrike) {
            setTimeout(() => {
              if (target.health > 0) {
                const devDmg = proj.damage * 1.5;
                target.health -= devDmg;
                target.hitFlash = 2;
                sfx.playEnemyHit();
                spawnFloatingText(target.x, target.y - 12, `${Math.ceil(devDmg)} 이중격`, '#06b6d4', 1.2);
                addLog(`🥊 [경정권] 주력 충격파가 이중 도달했습니다!`);
              }
            }, 180);
          }

          if (proj.explosive) triggerExplosion(proj.x, proj.y, proj.owner, proj.damage);

          if (proj.isCurse) {
            const ownerEntity = proj.owner === 'player' ? p : ai;
            ownerEntity.health = Math.min(ownerEntity.maxHealth, ownerEntity.health + finalDmg * 0.05);
          }

          if (proj.absorbsEnergy) {
            const ownerEntity = proj.owner === 'player' ? p : ai;
            target.cursedEnergy = Math.max(0, target.cursedEnergy - 25);
            ownerEntity.cursedEnergy = Math.min(100, ownerEntity.cursedEnergy + 25);
            addLog(`🌱 [주력 흡수] 하나미의 꽃봉오리가 상대의 주력 25를 흡수했습니다!`);
          }

          return false;
        }

        return true;
      });

      s.particles = s.particles.filter((part) => {
        part.x += part.vx;
        part.y += part.vy;
        part.life--;
        return part.life > 0;
      });

      setPlayerHP(Math.max(0, Math.ceil(p.health)));
      setPlayerMaxHP(p.maxHealth);
      setPlayerCE(Math.ceil(p.cursedEnergy));
      setPlayerShield(Math.ceil(p.shield));

      setAiHP(Math.max(0, Math.ceil(ai.health)));
      setAiMaxHP(ai.maxHealth);

      setPlayerHPDecay((prev) => (prev > p.health ? Math.max(p.health, prev - 0.75) : p.health));
      setAiHPDecay((prev) => (prev > ai.health ? Math.max(ai.health, prev - 0.75) : ai.health));

      if (ai.health <= 0 && s.slowMoActive === 0) {
        s.slowMoActive = 180; 
        sfx.playPowerup();
        addLog(`🏆 [결판] 승리의 일격을 작렬시켰습니다!`);
      } else if (p.health <= 0 && s.slowMoActive === 0) {
        s.slowMoActive = 180;
        sfx.playExplosion();
        addLog(`💀 [사망] 패배했습니다.`);
      }

      if (s.slowMoActive === 1) { 
        if (ai.health <= 0) setGameState('victory');
        else if (p.health <= 0) setGameState('defeat');
      }

      render2D();
    } catch (err) {
      console.error(err);
      setError(err);
    }
  };

  const triggerExplosion = (x, y, owner, damage) => {
    const s = stateRef.current;
    const target = owner === 'player' ? s.ai : s.player;
    const dist = Math.hypot(x - target.x, y - target.y);
    if (dist < 120) {
      target.health -= (damage * 0.75) * (1 - dist / 120);
      target.hitFlash = 3;
    }
  };

  // --- Horizontal Side-view Character Drawing ---
  const drawSideHumanBody = (ctx, ex, ey, angle, charKey, hitFlash, vx, vy, cursedEnergy, isGuarding, opacity = 1.0) => {
    const charInfo = CHARACTERS[charKey];
    const flip = Math.cos(angle) < 0;

    ctx.save();
    ctx.translate(ex, ey);
    ctx.globalAlpha = opacity;

    if (isGuarding) {
      ctx.strokeStyle = charInfo.color;
      ctx.lineWidth = 1.5;
      ctx.fillStyle = charInfo.color + '22'; 
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const rad = 25;
        const hx = Math.cos(i * (Math.PI * 2 / 6)) * rad;
        const hy = Math.sin(i * (Math.PI * 2 / 6)) * rad;
        if (i === 0) ctx.moveTo(hx, hy);
        else ctx.lineTo(hx, hy);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.strokeStyle = charInfo.color + '55';
      ctx.lineWidth = 1;
      for (let i = 0; i < 6; i++) {
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(i * (Math.PI * 2 / 6)) * 25, Math.sin(i * (Math.PI * 2 / 6)) * 25);
        ctx.stroke();
      }
    }

    if (hitFlash > 0) {
      ctx.rotate(flip ? 0.22 : -0.22);
      ctx.shadowColor = '#ef4444';
      ctx.shadowBlur = 20;
    } else {
      ctx.shadowColor = charInfo.color;
      ctx.shadowBlur = 8;
    }

    const isMoving = Math.abs(vx) > 0.4;
    const legOffset = isMoving ? Math.sin(Date.now() * 0.015) * 10 : 0;
    const isJumping = vy < -0.5;
    const isFalling = vy > 0.5;

    // Legs
    ctx.fillStyle = charInfo.clothingColor || '#1e293b';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1.5;

    ctx.save();
    ctx.translate(-4, 6);
    if (isJumping) ctx.rotate(-0.4);
    else if (isFalling) ctx.rotate(0.2);
    else ctx.rotate(legOffset * Math.PI / 180);
    ctx.fillRect(-2, 0, 4, 12);
    ctx.strokeRect(-2, 0, 4, 12);
    ctx.restore();

    ctx.save();
    ctx.translate(4, 6);
    if (isJumping) ctx.rotate(0.3);
    else if (isFalling) ctx.rotate(-0.1);
    else ctx.rotate(-legOffset * Math.PI / 180);
    ctx.fillRect(-2, 0, 4, 12);
    ctx.strokeRect(-2, 0, 4, 12);
    ctx.restore();

    // Torso
    ctx.fillStyle = charInfo.clothingColor || '#1e293b';
    ctx.beginPath();
    ctx.roundRect(-8, -12, 16, 18, 4);
    ctx.fill();
    ctx.stroke();

    // Head
    ctx.fillStyle = charInfo.skinColor || '#fbcfe8';
    ctx.beginPath();
    ctx.arc(0, -20, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Hair
    ctx.fillStyle = charInfo.hairColor || '#000000';
    if (charKey === 'gojo') {
      ctx.beginPath();
      if (flip) {
        ctx.moveTo(-4, -28);
        ctx.lineTo(8, -26);
        ctx.lineTo(5, -18);
        ctx.lineTo(-4, -18);
      } else {
        ctx.moveTo(4, -28);
        ctx.lineTo(-8, -26);
        ctx.lineTo(-5, -18);
        ctx.lineTo(4, -18);
      }
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#000000';
      ctx.fillRect(flip ? -8 : 3, -22, 5, 4);
    } else if (charKey === 'sukuna') {
      ctx.beginPath();
      if (flip) {
        ctx.moveTo(-5, -28);
        ctx.lineTo(6, -26);
        ctx.lineTo(4, -18);
      } else {
        ctx.moveTo(5, -28);
        ctx.lineTo(-6, -26);
        ctx.lineTo(-4, -18);
      }
      ctx.closePath();
      ctx.fill();
    } else if (charKey === 'jogo') {
      ctx.fillStyle = '#cbd5e1';
      ctx.beginPath();
      ctx.moveTo(-6, -20);
      ctx.lineTo(6, -20);
      ctx.lineTo(2, -27);
      ctx.lineTo(-2, -27);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#dc2626';
      ctx.fillRect(-2, -29, 4, 3);
    } else if (charKey === 'hanami') {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      if (flip) {
        ctx.moveTo(-2, -24);
        ctx.lineTo(-8, -31);
      } else {
        ctx.moveTo(2, -24);
        ctx.lineTo(8, -31);
      }
      ctx.stroke();
    } else if (charKey === 'kenjaku') {
      ctx.beginPath();
      if (flip) {
        ctx.arc(3, -20, 8, Math.PI * 0.5, Math.PI * 1.5);
      } else {
        ctx.arc(-3, -20, 8, Math.PI * 1.5, Math.PI * 0.5);
      }
      ctx.fill();
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(flip ? -6 : 3, -22);
      ctx.lineTo(flip ? -6 : 3, -17);
      ctx.stroke();
    } else {
      ctx.beginPath();
      if (flip) {
        ctx.arc(3, -20, 8, Math.PI * 0.5, Math.PI * 1.5);
      } else {
        ctx.arc(-3, -20, 8, Math.PI * 1.5, Math.PI * 0.5);
      }
      ctx.fill();
    }

    // Arm
    ctx.save();
    ctx.translate(0, -6);
    if (isGuarding) {
      ctx.fillStyle = charInfo.clothingColor || '#1e293b';
      ctx.fillRect(flip ? -10 : -2, -3, 12, 6);
      ctx.strokeRect(flip ? -10 : -2, -3, 12, 6);
    } else {
      ctx.rotate(angle);
      ctx.fillStyle = charInfo.skinColor || '#fbcfe8';
      ctx.fillRect(0, -3, 16, 6);
      ctx.strokeRect(0, -3, 16, 6);

      const auraRad = (Date.now() % 300) / 300 * 12 + 4;
      ctx.strokeStyle = charInfo.color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(16, 0, auraRad, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();

    if (cursedEnergy > 80 && Math.random() < 0.4) {
      ctx.strokeStyle = '#60a5fa';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo((Math.random() - 0.5) * 20, (Math.random() - 0.5) * 36 - 10);
      ctx.lineTo((Math.random() - 0.5) * 25, (Math.random() - 0.5) * 45 - 10);
      ctx.stroke();
    }

    ctx.restore();
  };

  const render2D = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const s = stateRef.current;
    const p = s.player;
    const ai = s.ai;

    const w = canvas.width;
    const h = canvas.height;

    // Check which Domain is currently active
    const activeDomain = p.domainActive > 0 ? p.domainType : (ai.domainActive > 0 ? ai.domainType : null);

    // --- High-Fidelity 4: Dynamic Domain Arena Background & Platforms Transformation ---
    if (activeDomain === 'void') {
      // Void Cosmic Black Space
      ctx.fillStyle = '#020617';
      ctx.fillRect(0, 0, w, h);
      
      // Floating cyan nebula stars
      ctx.fillStyle = 'rgba(34, 211, 238, 0.45)';
      for (let i = 0; i < 15; i++) {
        const sx = (Math.sin(Date.now() * 0.001 + i) * 0.5 + 0.5) * w;
        const sy = (Math.cos(Date.now() * 0.002 + i) * 0.5 + 0.5) * h;
        ctx.beginPath();
        ctx.arc(sx, sy, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (activeDomain === 'shrine') {
      // Shrine Crimson Blood Sea
      ctx.fillStyle = '#450a0a';
      ctx.fillRect(0, 0, w, h);

      // Rib cage pillars in background
      ctx.fillStyle = '#1c0303';
      ctx.beginPath();
      for (let i = 40; i < w; i += 80) {
        ctx.moveTo(i, GROUND_Y);
        ctx.bezierCurveTo(i - 30, 200, i + 30, 200, i, GROUND_Y);
      }
      ctx.fill();
    } else if (activeDomain === 'iron_mountain') {
      // Magma Cave orange gradient
      const caveGrad = ctx.createLinearGradient(0, 0, 0, h);
      caveGrad.addColorStop(0, '#1c0303');
      caveGrad.addColorStop(0.7, '#7c2d12');
      caveGrad.addColorStop(1, '#ea580c');
      ctx.fillStyle = caveGrad;
      ctx.fillRect(0, 0, w, h);
    } else {
      // Normal Jujutsu High Temple Courtyard (Twilight/Night)
      const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
      bgGrad.addColorStop(0, '#020617');
      bgGrad.addColorStop(0.6, '#0f172a');
      bgGrad.addColorStop(1, '#1e1b4b');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, w, h);

      ctx.fillStyle = 'rgba(15, 23, 42, 0.45)';
      ctx.beginPath();
      ctx.moveTo(100, GROUND_Y);
      ctx.lineTo(100, 200);
      ctx.lineTo(140, 200);
      ctx.lineTo(140, 240);
      ctx.lineTo(500, 240);
      ctx.lineTo(500, 200);
      ctx.lineTo(540, 200);
      ctx.lineTo(540, GROUND_Y);
      ctx.closePath();
      ctx.fill();
    }

    ctx.save();
    if (s.screenShake > 0) {
      const shakeX = (Math.random() - 0.5) * s.screenShake;
      const shakeY = (Math.random() - 0.5) * s.screenShake;
      ctx.translate(shakeX, shakeY);
    }

    // Draw Ground with dynamic textures
    if (activeDomain === 'void') {
      ctx.fillStyle = '#0f172a'; // black metallic floor
      ctx.fillRect(0, GROUND_Y, w, h - GROUND_Y);
      ctx.strokeStyle = '#22d3ee';
      ctx.lineWidth = 2;
      ctx.strokeRect(0, GROUND_Y, w, h - GROUND_Y);
    } else if (activeDomain === 'shrine') {
      ctx.fillStyle = '#7f1d1d'; // Crimson pool
      ctx.fillRect(0, GROUND_Y, w, h - GROUND_Y);
      ctx.fillStyle = '#dc2626'; // Blood ripple waves
      ctx.fillRect(0, GROUND_Y, w, 8);
    } else if (activeDomain === 'iron_mountain') {
      ctx.fillStyle = '#450a0a'; 
      ctx.fillRect(0, GROUND_Y, w, h - GROUND_Y);
      // Bright orange lava veins
      ctx.fillStyle = '#ea580c';
      ctx.fillRect(0, GROUND_Y, w, 8);
    } else {
      ctx.fillStyle = '#334155'; // Grey stone paving
      ctx.fillRect(0, GROUND_Y, w, h - GROUND_Y);
      ctx.fillStyle = '#0f4c3a'; // Grass line
      ctx.fillRect(0, GROUND_Y, w, 6);
    }

    ctx.strokeStyle = activeDomain === 'void' ? '#0891b2' : '#1e293b';
    ctx.lineWidth = 1;
    for (let gx = 0; gx < w; gx += 40) {
      ctx.beginPath();
      ctx.moveTo(gx, GROUND_Y + 6);
      ctx.lineTo(gx, h);
      ctx.stroke();
    }

    // Draw Floating Platforms with domain adaptations
    PLATFORMS.forEach((plat) => {
      if (activeDomain === 'void') {
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(plat.xStart, plat.y, plat.xEnd - plat.xStart, 8);
        ctx.fillStyle = '#06b6d4';
        ctx.fillRect(plat.xStart, plat.y + 8, plat.xEnd - plat.xStart, 3);
      } else if (activeDomain === 'shrine') {
        ctx.fillStyle = '#1c0303';
        ctx.fillRect(plat.xStart, plat.y, plat.xEnd - plat.xStart, 8);
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(plat.xStart, plat.y + 8, plat.xEnd - plat.xStart, 3);
      } else if (activeDomain === 'iron_mountain') {
        ctx.fillStyle = '#7c2d12';
        ctx.fillRect(plat.xStart, plat.y, plat.xEnd - plat.xStart, 8);
        ctx.fillStyle = '#f97316';
        ctx.fillRect(plat.xStart, plat.y + 8, plat.xEnd - plat.xStart, 3);
      } else {
        ctx.fillStyle = '#78350f'; 
        ctx.fillRect(plat.xStart, plat.y, plat.xEnd - plat.xStart, 8);
        ctx.fillStyle = '#7f1d1d'; 
        ctx.fillRect(plat.xStart, plat.y + 8, plat.xEnd - plat.xStart, 3);
      }

      // Pillars
      ctx.fillStyle = activeDomain === 'void' ? '#0891b2' : (activeDomain === 'shrine' ? '#991b1b' : 'rgba(127, 29, 29, 0.85)');
      ctx.fillRect(plat.xStart + 10, plat.y + 11, 4, GROUND_Y - plat.y - 11);
      ctx.fillRect(plat.xEnd - 14, plat.y + 11, 4, GROUND_Y - plat.y - 11);
    });

    // Draw Dash Trail Phantoms
    s.phantomClones.forEach((clone) => {
      drawSideHumanBody(
        ctx, clone.x, clone.y, clone.angle, clone.charKey, 0, 0, 0, 0, false, clone.opacity * 0.4
      );
    });

    // Draw Shockwaves
    s.groundWaves.forEach((wave) => {
      ctx.strokeStyle = `rgba(255, 255, 255, ${wave.opacity})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(wave.x, wave.y, wave.radius, wave.radius * 0.3, 0, 0, Math.PI * 2);
      ctx.stroke();
    });

    // Draw Projectiles
    s.projectiles.forEach((proj) => {
      const type = proj.type;
      
      if (type === 'dog') {
        const angle = Math.atan2(proj.vy, proj.vx);
        ctx.save();
        ctx.translate(proj.x, proj.y);
        ctx.rotate(angle);
        ctx.fillStyle = '#64748b'; 
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(0, 0, proj.scale * 1.5, proj.scale * 0.8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#475569';
        ctx.beginPath();
        ctx.moveTo(proj.scale * 0.8, -proj.scale * 0.6);
        ctx.lineTo(proj.scale * 1.3, -proj.scale * 1.0);
        ctx.lineTo(proj.scale * 0.4, -proj.scale * 0.4);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#64748b';
        ctx.beginPath();
        ctx.ellipse(-proj.scale * 1.5, 0, proj.scale * 0.6, proj.scale * 0.3, -0.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(proj.scale * 0.8, -proj.scale * 0.2, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else if (type === 'nue') {
        const angle = Math.atan2(proj.vy, proj.vx);
        ctx.save();
        ctx.translate(proj.x, proj.y);
        ctx.rotate(angle);
        ctx.fillStyle = '#eab308'; 
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(0, 0, proj.scale * 1.3, proj.scale * 0.7, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        const wingY = Math.sin(Date.now() * 0.035) * proj.scale * 1.3;
        ctx.fillStyle = '#ca8a04';
        ctx.beginPath();
        ctx.moveTo(-proj.scale * 0.5, 0);
        ctx.lineTo(0, -wingY);
        ctx.lineTo(proj.scale * 0.5, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        if (Math.random() < 0.35) {
          ctx.strokeStyle = '#facc15';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(-proj.scale * 1.5, -proj.scale);
          ctx.lineTo(proj.scale * 1.5, proj.scale);
          ctx.stroke();
        }
        ctx.restore();
      } else if (type === 'rabbit') {
        ctx.save();
        const hopY = Math.abs(Math.sin(Date.now() * 0.02 + proj.x * 0.1)) * 6;
        ctx.translate(proj.x, proj.y - hopY);
        ctx.fillStyle = '#ffffff'; 
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(0, 0, proj.scale * 1.1, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#fee2e2'; 
        ctx.beginPath();
        ctx.ellipse(-3, -proj.scale * 1.2, 2.5, 6, -0.2, 0, Math.PI * 2);
        ctx.ellipse(3, -proj.scale * 1.2, 2.5, 6, 0.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#ec4899';
        ctx.beginPath();
        ctx.arc(3, -2, 1.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else if (type === 'flyhead') {
        const angle = Math.atan2(proj.vy, proj.vx);
        ctx.save();
        ctx.translate(proj.x, proj.y);
        ctx.rotate(angle);
        ctx.fillStyle = '#3f6212'; 
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(0, 0, proj.scale, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        const wingX = Math.sin(Date.now() * 0.08) * proj.scale * 0.8;
        ctx.fillStyle = 'rgba(202, 138, 4, 0.5)';
        ctx.beginPath();
        ctx.ellipse(0, -proj.scale * 0.6, proj.scale * 0.5, Math.abs(wingX), 0.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#dc2626';
        ctx.beginPath();
        ctx.arc(proj.scale * 0.5, 0, proj.scale * 0.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else if (type === 'assault_curse') {
        const angle = Math.atan2(proj.vy, proj.vx);
        for (let i = 3; i >= 0; i--) {
          ctx.save();
          const segX = proj.x - proj.vx * i * 3.5;
          const segY = proj.y - proj.vy * i * 3.5;
          ctx.translate(segX, segY);
          ctx.rotate(angle + Math.sin(Date.now() * 0.015 - i) * 0.15); 
          ctx.fillStyle = i === 0 ? '#6b21a8' : '#7e22ce'; 
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(0, 0, proj.scale * (1.0 - i * 0.2), 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          if (i === 0) {
            ctx.fillStyle = '#dc2626';
            ctx.beginPath();
            ctx.arc(proj.scale * 0.4, -proj.scale * 0.3, 3, 0, Math.PI * 2);
            ctx.arc(proj.scale * 0.4, proj.scale * 0.3, 3, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();
        }
      } else if (type === 'uzumaki') {
        ctx.save();
        ctx.translate(proj.x, proj.y);
        ctx.rotate(Date.now() * 0.02); 
        for (let r = proj.scale; r > 4; r -= 5) {
          ctx.fillStyle = r % 10 === 0 ? '#000000' : '#4a044e';
          ctx.beginPath();
          ctx.arc(Math.sin(r) * 3, Math.cos(r) * 3, r, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = '#ec4899';
        ctx.beginPath();
        ctx.arc(-8, -6, 3, 0, Math.PI * 2);
        ctx.arc(8, 6, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else if (type === 'rika') {
        const angle = Math.atan2(proj.vy, proj.vx);
        ctx.save();
        ctx.translate(proj.x, proj.y);
        ctx.rotate(angle);
        ctx.fillStyle = '#e2e8f0'; 
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(0, 0, proj.scale * 1.4, proj.scale * 0.8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#94a3b8';
        ctx.beginPath();
        ctx.rect(0, -proj.scale * 1.1, proj.scale * 1.2, 5);
        ctx.rect(0, proj.scale * 0.9, proj.scale * 1.2, 5);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(proj.scale * 0.5, -4, proj.scale * 0.6, 8);
        ctx.restore();
      } else if (type === 'transfigured_human') {
        ctx.save();
        const crawlOffset = Math.sin(Date.now() * 0.025) * 4;
        ctx.translate(proj.x + crawlOffset, proj.y);
        ctx.fillStyle = '#14b8a6'; 
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(0, 0, proj.scale * 1.2, proj.scale * 0.7, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#0d9488';
        ctx.fillRect(-proj.scale * 0.8, proj.scale * 0.5, 4, 10);
        ctx.fillRect(proj.scale * 0.4, proj.scale * 0.5, 4, 10);
        ctx.strokeRect(-proj.scale * 0.8, proj.scale * 0.5, 4, 10);
        ctx.strokeRect(proj.scale * 0.4, proj.scale * 0.5, 4, 10);
        ctx.restore();
      } else if (type === 'ember_insect') {
        const angle = Math.atan2(proj.vy, proj.vx);
        ctx.save();
        ctx.translate(proj.x, proj.y);
        ctx.rotate(angle);
        ctx.fillStyle = '#f97316'; 
        ctx.shadowColor = '#ea580c';
        ctx.shadowBlur = 15;
        ctx.beginPath();
        ctx.arc(0, 0, proj.scale, 0, Math.PI * 2);
        ctx.fill();
        const bz = Math.sin(Date.now() * 0.1) * proj.scale;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.beginPath();
        ctx.ellipse(0, -proj.scale * 0.7, proj.scale * 0.5, Math.abs(bz), 0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else if (type === 'wood_root') {
        const angle = Math.atan2(proj.vy, proj.vx);
        ctx.save();
        ctx.translate(proj.x, proj.y);
        ctx.rotate(angle);
        ctx.fillStyle = '#7c2d12'; 
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-proj.scale * 1.5, -proj.scale * 0.4);
        ctx.lineTo(proj.scale * 1.5, 0);
        ctx.lineTo(-proj.scale * 1.5, proj.scale * 0.4);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#15803d'; 
        ctx.beginPath();
        ctx.arc(-proj.scale * 0.6, -proj.scale * 0.5, 3, 0, Math.PI * 2);
        ctx.arc(proj.scale * 0.2, proj.scale * 0.5, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else {
        ctx.fillStyle = proj.color;
        ctx.shadowColor = proj.color;
        ctx.shadowBlur = proj.scale > 15 ? 20 : 10;
        ctx.beginPath();
        ctx.arc(proj.x, proj.y, proj.scale, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    });

    // Draw Particles
    s.particles.forEach((part) => {
      ctx.fillStyle = part.color;
      ctx.beginPath();
      ctx.arc(part.x, part.y, part.size, 0, Math.PI * 2);
      ctx.fill();
    });

    // Draw Entities
    const drawCharacter = (entity, charKey, label) => {
      if (entity.health <= 0) return;

      const charInfo = CHARACTERS[charKey];

      // Draw Domain ring
      if (entity.domainActive > 0) {
        ctx.strokeStyle = charInfo.color;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(entity.x, entity.y, (Date.now() % 500) / 500 * 90 + 20, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Draw side human figure
      drawSideHumanBody(
        ctx, entity.x, entity.y, entity.angle, charKey, entity.hitFlash, entity.vx, entity.vy, entity.cursedEnergy, entity.isGuarding
      );

      // Name & Avatar Label
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${charInfo.avatar} ${charInfo.name}`, entity.x, entity.y - 34);

      // HP Bar
      const barW = 40;
      const barH = 5;
      const hpRatio = entity.health / entity.maxHealth;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(entity.x - barW / 2, entity.y - 46, barW, barH);
      ctx.fillStyle = hpRatio > 0.5 ? '#10b981' : hpRatio > 0.2 ? '#f59e0b' : '#ef4444';
      ctx.fillRect(entity.x - barW / 2, entity.y - 46, barW * hpRatio, barH);
    };

    drawCharacter(p, selectedChar, '나');
    drawCharacter(ai, selectedAIChar, '적');

    // Draw Summons (Necromancer minions rendering)
    s.summons.forEach((summon) => {
      const type = summon.type;
      ctx.save();
      
      if (summon.hitFlash > 0) {
        ctx.shadowColor = '#ef4444';
        ctx.shadowBlur = 12;
      }

      if (type === 'dog') {
        const isLeft = summon.vx < 0;
        ctx.translate(summon.x, summon.y);
        if (isLeft) ctx.scale(-1, 1);
        ctx.fillStyle = '#64748b'; 
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1.5;
        
        ctx.beginPath();
        ctx.ellipse(0, 0, summon.scale * 1.5, summon.scale * 0.8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        
        ctx.fillStyle = '#475569';
        ctx.beginPath();
        ctx.moveTo(summon.scale * 0.8, -summon.scale * 0.6);
        ctx.lineTo(summon.scale * 1.3, -summon.scale * 1.0);
        ctx.lineTo(summon.scale * 0.4, -summon.scale * 0.4);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        
        ctx.fillStyle = '#64748b';
        ctx.beginPath();
        ctx.ellipse(-summon.scale * 1.5, 0, summon.scale * 0.6, summon.scale * 0.3, -0.4, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(summon.scale * 0.8, -summon.scale * 0.2, 2.5, 0, Math.PI * 2);
        ctx.fill();
      } else if (type === 'nue') {
        const isLeft = summon.vx < 0;
        ctx.translate(summon.x, summon.y);
        if (isLeft) ctx.scale(-1, 1);
        ctx.fillStyle = '#eab308'; 
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1.5;
        
        ctx.beginPath();
        ctx.ellipse(0, 0, summon.scale * 1.3, summon.scale * 0.7, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        
        const wingY = Math.sin(Date.now() * 0.035) * summon.scale * 1.3;
        ctx.fillStyle = '#ca8a04';
        ctx.beginPath();
        ctx.moveTo(-summon.scale * 0.5, 0);
        ctx.lineTo(0, -wingY);
        ctx.lineTo(summon.scale * 0.5, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        
        if (Math.random() < 0.35) {
          ctx.strokeStyle = '#facc15';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(-summon.scale * 1.5, -summon.scale);
          ctx.lineTo(summon.scale * 1.5, summon.scale);
          ctx.stroke();
        }
      } else if (type === 'rabbit') {
        const isLeft = summon.vx < 0;
        const hopY = Math.abs(Math.sin(Date.now() * 0.02 + summon.x * 0.1)) * 6;
        ctx.translate(summon.x, summon.y - hopY);
        if (isLeft) ctx.scale(-1, 1);
        ctx.fillStyle = '#ffffff'; 
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1;
        
        ctx.beginPath();
        ctx.arc(0, 0, summon.scale * 1.1, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        
        ctx.fillStyle = '#fee2e2'; 
        ctx.beginPath();
        ctx.ellipse(-3, -summon.scale * 1.2, 2.5, 6, -0.2, 0, Math.PI * 2);
        ctx.ellipse(3, -summon.scale * 1.2, 2.5, 6, 0.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        
        ctx.fillStyle = '#ec4899';
        ctx.beginPath();
        ctx.arc(3, -2, 1.5, 0, Math.PI * 2);
        ctx.fill();
      } else if (type === 'flyhead') {
        const isLeft = summon.vx < 0;
        ctx.translate(summon.x, summon.y);
        if (isLeft) ctx.scale(-1, 1);
        ctx.fillStyle = '#3f6212'; 
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1.5;
        
        ctx.beginPath();
        ctx.arc(0, 0, summon.scale, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        
        const wingX = Math.sin(Date.now() * 0.08) * summon.scale * 0.8;
        ctx.fillStyle = 'rgba(202, 138, 4, 0.5)';
        ctx.beginPath();
        ctx.ellipse(0, -summon.scale * 0.6, summon.scale * 0.5, Math.abs(wingX), 0.4, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = '#dc2626';
        ctx.beginPath();
        ctx.arc(summon.scale * 0.5, 0, summon.scale * 0.4, 0, Math.PI * 2);
        ctx.fill();
      } else if (type === 'assault_curse') {
        const isLeft = summon.vx < 0;
        for (let i = 3; i >= 0; i--) {
          ctx.save();
          const segX = summon.x - summon.vx * i * 3.5;
          const segY = summon.y - summon.vy * i * 3.5;
          ctx.translate(segX, segY);
          if (isLeft) ctx.scale(-1, 1);
          ctx.rotate(Math.sin(Date.now() * 0.015 - i) * 0.15); 
          
          ctx.fillStyle = i === 0 ? '#6b21a8' : '#7e22ce'; 
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(0, 0, summon.scale * (1.0 - i * 0.2), 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          
          if (i === 0) {
            ctx.fillStyle = '#dc2626';
            ctx.beginPath();
            ctx.arc(summon.scale * 0.4, -summon.scale * 0.3, 3, 0, Math.PI * 2);
            ctx.arc(summon.scale * 0.4, summon.scale * 0.3, 3, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();
        }
      } else if (type === 'rainbow_dragon') {
        const isLeft = summon.vx < 0;
        for (let i = 4; i >= 0; i--) {
          ctx.save();
          const segX = summon.x - summon.vx * i * 3.2;
          const segY = summon.y - summon.vy * i * 3.2;
          ctx.translate(segX, segY);
          if (isLeft) ctx.scale(-1, 1);
          ctx.rotate(Math.sin(Date.now() * 0.02 - i) * 0.2);

          ctx.fillStyle = i === 0 ? '#f1f5f9' : '#cbd5e1';
          ctx.strokeStyle = '#38bdf8'; 
          ctx.lineWidth = 2.0;
          ctx.shadowColor = '#06b6d4';
          ctx.shadowBlur = 12;

          ctx.beginPath();
          ctx.arc(0, 0, summon.scale * (1.1 - i * 0.15), 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          if (i === 0) {
            ctx.fillStyle = '#eab308';
            ctx.beginPath();
            ctx.arc(summon.scale * 0.4, -summon.scale * 0.3, 3, 0, Math.PI * 2);
            ctx.arc(summon.scale * 0.4, summon.scale * 0.3, 3, 0, Math.PI * 2);
            ctx.fill();

            ctx.strokeStyle = '#06b6d4';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(summon.scale * 0.4, -summon.scale * 0.4);
            ctx.lineTo(summon.scale * 0.9, -summon.scale * 0.8);
            ctx.moveTo(summon.scale * 0.4, summon.scale * 0.4);
            ctx.lineTo(summon.scale * 0.9, summon.scale * 0.8);
            ctx.stroke();
          }
          ctx.restore();
        }
      } else if (type === 'rika') {
        const isLeft = summon.vx < 0;
        ctx.translate(summon.x, summon.y);
        if (isLeft) ctx.scale(-1, 1);
        ctx.fillStyle = '#475569'; 
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2.0;
        ctx.shadowColor = '#64748b';
        ctx.shadowBlur = 15;

        ctx.beginPath();
        ctx.ellipse(0, 0, summon.scale * 1.4, summon.scale * 0.9, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        const waveAngle = Math.sin(Date.now() * 0.03) * 0.2;
        ctx.fillStyle = '#334155';
        
        ctx.save();
        ctx.rotate(waveAngle);
        ctx.beginPath();
        ctx.arc(-summon.scale * 0.8, summon.scale * 0.5, summon.scale * 0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();

        ctx.save();
        ctx.rotate(-waveAngle);
        ctx.beginPath();
        ctx.arc(summon.scale * 0.4, summon.scale * 0.6, summon.scale * 0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();

        ctx.fillStyle = '#dc2626';
        ctx.beginPath();
        ctx.ellipse(summon.scale * 0.3, -2, summon.scale * 0.5, 3, 0, 0, Math.PI * 2);
        ctx.fill();
      } else {
        const crawlOffset = Math.sin(Date.now() * 0.025 + summon.x) * 4;
        ctx.translate(summon.x + crawlOffset, summon.y);
        ctx.fillStyle = '#14b8a6'; 
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1.5;
        
        ctx.beginPath();
        ctx.ellipse(0, 0, summon.scale * 1.2, summon.scale * 0.7, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#0d9488';
        ctx.fillRect(-summon.scale * 0.8, summon.scale * 0.5, 4, 10);
        ctx.fillRect(summon.scale * 0.4, summon.scale * 0.5, 4, 10);
        ctx.strokeRect(-summon.scale * 0.8, summon.scale * 0.5, 4, 10);
        ctx.strokeRect(summon.scale * 0.4, summon.scale * 0.5, 4, 10);

        ctx.fillStyle = '#ec4899';
        ctx.beginPath();
        ctx.arc(summon.scale * 0.6, -2, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();

      if (summon.health > 0) {
        const sBarW = summon.type === 'assault_curse' ? 32 : (summon.type === 'rabbit' ? 14 : 24);
        const sBarH = 3;
        const sHpRatio = Math.max(0, summon.health / summon.maxHealth);
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(summon.x - sBarW / 2, summon.y - 20, sBarW, sBarH);
        ctx.fillStyle = '#10b981';
        ctx.fillRect(summon.x - sBarW / 2, summon.y - 20, sBarW * sHpRatio, sBarH);
      }
    });

    // --- High-Fidelity 5: Draw Floating Damage Numbers with Physics Bounce ---
    s.floatingTexts.forEach((ft) => {
      ctx.save();
      ctx.globalAlpha = ft.opacity;
      ctx.fillStyle = ft.color;
      ctx.shadowColor = '#000000';
      ctx.shadowBlur = 4;
      
      // Scale fonts according to damage size / criticals
      const fontSize = ft.isSpecial ? Math.ceil(24 * ft.scale) : Math.ceil(15 * ft.scale);
      ctx.font = `bold ${fontSize}px "Impact", "Arial Black", sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();
    });

    ctx.restore();

    // Cherry blossoms falling overlay
    updateCherryBlossoms(w, h);
    ctx.fillStyle = 'rgba(244, 114, 182, 0.6)';
    s.cherryBlossoms.forEach((p) => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    });

    // Domain Background overlays
    const applyDomainVisual = (domainType) => {
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      if (domainType === 'void') {
        grad.addColorStop(0, 'rgba(10, 10, 26, 0.55)');
        grad.addColorStop(0.5, 'rgba(15, 23, 42, 0.7)');
        grad.addColorStop(1, 'rgba(88, 28, 135, 0.35)');
      } else if (domainType === 'shrine') {
        grad.addColorStop(0, 'rgba(67, 12, 12, 0.5)');
        grad.addColorStop(0.5, 'rgba(15, 23, 42, 0.7)');
        grad.addColorStop(1, 'rgba(127, 29, 29, 0.3)');
      } else if (domainType === 'self_embodiment') {
        grad.addColorStop(0, 'rgba(20, 184, 166, 0.4)');
        grad.addColorStop(0.5, 'rgba(15, 23, 42, 0.75)');
        grad.addColorStop(1, 'rgba(15, 118, 110, 0.3)');
      } else if (domainType === 'iron_mountain') {
        grad.addColorStop(0, 'rgba(234, 88, 12, 0.5)');
        grad.addColorStop(0.5, 'rgba(120, 53, 4, 0.75)');
        grad.addColorStop(1, 'rgba(249, 115, 22, 0.3)');
      } else if (domainType === 'moon_palace') {
        grad.addColorStop(0, 'rgba(163, 230, 53, 0.45)');
        grad.addColorStop(0.5, 'rgba(15, 23, 42, 0.8)');
        grad.addColorStop(1, 'rgba(63, 98, 18, 0.35)');
      } else {
        grad.addColorStop(0, 'rgba(15, 23, 42, 0.5)');
        grad.addColorStop(1, 'rgba(30, 41, 59, 0.5)');
      }
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
    };

    if (p.domainActive > 0) applyDomainVisual(p.domainType);
    if (ai.domainActive > 0) applyDomainVisual(ai.domainType);

    // --- Domain Expansion Cinematic Banner ---
    if (s.domainCutIn.active > 0) {
      const bannerChar = CHARACTERS[s.domainCutIn.charKey];
      ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
      ctx.fillRect(0, 140, w, 200);

      ctx.strokeStyle = bannerChar.color + '55';
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 30; i++) {
        ctx.beginPath();
        ctx.moveTo(w / 2, 240);
        ctx.lineTo(
          w / 2 + Math.cos(i * Math.PI * 2 / 30) * 450,
          240 + Math.sin(i * Math.PI * 2 / 30) * 450
        );
        ctx.stroke();
      }

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 76px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(bannerChar.avatar, w / 2 - 180, 240);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 28px "Georgia", sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(bannerChar.name, w / 2 - 100, 215);

      ctx.fillStyle = bannerChar.color;
      ctx.font = 'bold 36px "Courier New", monospace';
      ctx.fillText(`영역전개 「${s.domainCutIn.domainName}」`, w / 2 - 100, 270);

      ctx.strokeStyle = bannerChar.color;
      ctx.lineWidth = 4;
      ctx.strokeRect(0, 140, w, 200);
    }

    // --- Spell Cast Text Indicator ---
    if (s.spellText.life > 0) {
      ctx.save();
      ctx.globalAlpha = Math.min(1.0, s.spellText.life / 15);
      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.strokeStyle = s.spellText.color;
      ctx.lineWidth = 2;
      ctx.roundRect(w / 2 - 160, 45, 320, 36, 6);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(s.spellText.text, w / 2, 68);
      ctx.restore();
    }

    // --- Slow-motion victory screen ---
    if (s.slowMoActive > 0) {
      ctx.fillStyle = 'rgba(239, 68, 68, 0.15)'; 
      ctx.fillRect(0, 0, w, h);

      ctx.save();
      ctx.shadowColor = '#000000';
      ctx.shadowBlur = 10;

      ctx.fillStyle = '#f87171';
      ctx.font = 'bold 42px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('⚡ 결판 (DECISIVE FINISH) ⚡', w / 2, h / 2 - 50);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 15px monospace';
      ctx.fillText('대전 결과를 집계 중입니다...', w / 2, h / 2 + 10);
      ctx.restore();
    }

    if (s.damageFlash > 0) {
      ctx.fillStyle = `rgba(239, 68, 68, ${s.damageFlash * 0.45})`;
      ctx.fillRect(0, 0, w, h);
    }
    if (s.healFlash > 0) {
      ctx.fillStyle = `rgba(16, 185, 129, ${s.healFlash * 0.45})`;
      ctx.fillRect(0, 0, w, h);
    }

    ctx.restore();
  };

  const handleMouseMove = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    stateRef.current.mouse.x = e.clientX - rect.left;
    stateRef.current.mouse.y = e.clientY - rect.top;
  };

  const startGame = (playerKey, aiKey) => {
    try {
      sfx.init();
      setSelectedChar(playerKey);
      setSelectedAIChar(aiKey);

      const pData = CHARACTERS[playerKey];
      const aiData = CHARACTERS[aiKey];

      const s = stateRef.current;
      s.player = {
        x: 120.0, y: GROUND_Y - 20,
        vx: 0, vy: 0, angle: 0,
        health: pData.maxHealth, maxHealth: pData.maxHealth,
        cursedEnergy: 100, maxCursedEnergy: 100,
        shield: 50, maxShield: 100,
        cooldowns: [0, 0, 0, 0],
        domainActive: 0, domainCooldown: 0, domainType: '',
        reverseCursedCooldown: 0,
        comboActive: 0, overtimeActive: 0,
        frozen: 0, isGodModeDisabled: 0, hitFlash: 0,
        doubleJumpAvailable: true, dropThroughTimer: 0,
        dashTrailCooldown: 0, isGuarding: false,
        castingTimer: 0
      };
      s.ai = {
        x: 520.0, y: GROUND_Y - 20,
        vx: 0, vy: 0, angle: 0,
        health: aiData.maxHealth, maxHealth: aiData.maxHealth,
        cursedEnergy: 100, maxCursedEnergy: 100,
        shield: 50, maxShield: 100,
        cooldowns: [0, 0, 0, 0],
        domainActive: 0, domainCooldown: 0, domainType: '',
        reverseCursedCooldown: 0,
        comboActive: 0, overtimeActive: 0,
        frozen: 0, isGodModeDisabled: 0, hitFlash: 0,
        doubleJumpAvailable: true, dropThroughTimer: 0,
        dashTrailCooldown: 0, isGuarding: false,
        castingTimer: 0
      };
      s.projectiles = [];
      s.summons = [];
      s.particles = [];
      s.cherryBlossoms = [];
      s.phantomClones = [];
      s.groundWaves = [];
      s.floatingTexts = [];
      s.hitStopFrames = 0;
      s.domainCutIn = { active: 0, charKey: '', domainName: '' };
      s.slowMoActive = 0;
      s.spellText = { text: '', life: 0, color: '#fff' };

      setPlayerHP(pData.maxHealth);
      setPlayerHPDecay(pData.maxHealth);
      setPlayerMaxHP(pData.maxHealth);

      setAiHP(aiData.maxHealth);
      setAiHPDecay(aiData.maxHealth);
      setAiMaxHP(aiData.maxHealth);

      setGameState('playing');
      addLog(`⚔️ 횡스크롤 고성능 주술 결투 개시! ${pData.name} vs ${aiData.name}`);
    } catch (e) {
      console.error(e);
      setError(e);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      const k = e.key.toLowerCase();
      const code = e.code.toLowerCase();
      if (gameState !== 'playing') return;

      if (k === '1' || code === 'digit1') fireSkill(0);
      if (k === '2' || code === 'digit2') fireSkill(1);
      if (k === '3' || code === 'digit3') fireSkill(2);
      if (k === '4' || code === 'digit4') fireSkill(3);
      if (k === 'r' || code === 'keyr') useReverseCursed();

      stateRef.current.keys[k] = true;
      stateRef.current.keys[code] = true;
    };

    const handleKeyUp = (e) => {
      const k = e.key.toLowerCase();
      const code = e.code.toLowerCase();
      stateRef.current.keys[k] = false;
      stateRef.current.keys[code] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [gameState, selectedChar, selectedAIChar]);

  useEffect(() => {
    let animFrameId;
    const loop = () => {
      if (gameState === 'playing') {
        updateGame();
      }
      animFrameId = requestAnimationFrame(loop);
    };
    animFrameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animFrameId);
  }, [gameState, selectedChar, selectedAIChar]);

  const sorcerers = Object.keys(CHARACTERS).filter(k => CHARACTERS[k].side === 'sorcerer');
  const curses = Object.keys(CHARACTERS).filter(k => CHARACTERS[k].side === 'curse');

  return (
    <div className="terminal-frame fps-game-wrapper" ref={containerRef} style={{ background: '#020617', padding: '20px', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'monospace' }}>
      {gameState === 'title' && (
        <div style={{ background: 'rgba(15, 23, 42, 0.95)', border: '2px solid #8b5cf6', borderRadius: '12px', padding: '24px', width: '95%', maxWidth: '900px', boxShadow: '0 0 25px rgba(139, 92, 246, 0.4)' }}>
          <h1 style={{ color: '#a78bfa', fontSize: '32px', textAlign: 'center', margin: '0 0 4px 0', textShadow: '0 0 10px rgba(168,85,247,0.5)' }}>주술대전 (JUJUTSU DAEJEON)</h1>
          <p style={{ color: '#94a3b8', fontSize: '13px', textAlign: 'center', margin: '0 0 20px 0' }}>2D 가로형 횡스크롤 결투 시뮬레이터</p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
            {/* Player Selection Card */}
            <div style={{ background: 'rgba(30, 41, 59, 0.6)', border: '1px solid #38bdf8', borderRadius: '8px', padding: '16px' }}>
              <h3 style={{ color: '#38bdf8', fontSize: '14px', margin: '0 0 12px 0', textAlign: 'center' }}>👤 플레이어 선택</h3>
              
              <div style={{ marginBottom: '10px' }}>
                <div style={{ color: '#60a5fa', fontSize: '11px', marginBottom: '4px', borderBottom: '1px solid #3b82f6' }}>☯️ 아군 주술사 (Jujutsu Sorcerers)</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
                  {sorcerers.map((key) => (
                    <button 
                      key={`p-${key}`}
                      onClick={() => setSelectedChar(key)}
                      style={{
                        background: selectedChar === key ? 'rgba(56, 189, 248, 0.25)' : '#1e293b',
                        border: selectedChar === key ? '2px solid #38bdf8' : '1px solid #475569',
                        color: '#ffffff', padding: '6px 0', borderRadius: '6px', cursor: 'pointer', transition: 'all 0.15s'
                      }}
                    >
                      <span style={{ fontSize: '18px' }}>{CHARACTERS[key].avatar}</span>
                      <div style={{ fontSize: '9px', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{CHARACTERS[key].name.split(' ')[0]}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div style={{ color: '#f87171', fontSize: '11px', marginBottom: '4px', borderBottom: '1px solid #ef4444' }}>👹 아군 주저사 (Curse Users)</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
                  {curses.map((key) => (
                    <button 
                      key={`p-${key}`}
                      onClick={() => setSelectedChar(key)}
                      style={{
                        background: selectedChar === key ? 'rgba(56, 189, 248, 0.25)' : '#1e293b',
                        border: selectedChar === key ? '2px solid #38bdf8' : '1px solid #475569',
                        color: '#ffffff', padding: '6px 0', borderRadius: '6px', cursor: 'pointer', transition: 'all 0.15s'
                      }}
                    >
                      <span style={{ fontSize: '18px' }}>{CHARACTERS[key].avatar}</span>
                      <div style={{ fontSize: '9px', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{CHARACTERS[key].name.split(' ')[0]}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* AI Selection Card */}
            <div style={{ background: 'rgba(30, 41, 59, 0.6)', border: '1px solid #f87171', borderRadius: '8px', padding: '16px' }}>
              <h3 style={{ color: '#f87171', fontSize: '14px', margin: '0 0 12px 0', textAlign: 'center' }}>🤖 상대방 AI 선택</h3>
              
              <div style={{ marginBottom: '10px' }}>
                <div style={{ color: '#60a5fa', fontSize: '11px', marginBottom: '4px', borderBottom: '1px solid #3b82f6' }}>☯️ 상대 주술사 (Jujutsu Sorcerers)</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
                  {sorcerers.map((key) => (
                    <button 
                      key={`ai-${key}`}
                      onClick={() => setSelectedAIChar(key)}
                      style={{
                        background: selectedAIChar === key ? 'rgba(248, 113, 113, 0.25)' : '#1e293b',
                        border: selectedAIChar === key ? '2px solid #f87171' : '1px solid #475569',
                        color: '#ffffff', padding: '6px 0', borderRadius: '6px', cursor: 'pointer', transition: 'all 0.15s'
                      }}
                    >
                      <span style={{ fontSize: '18px' }}>{CHARACTERS[key].avatar}</span>
                      <div style={{ fontSize: '9px', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{CHARACTERS[key].name.split(' ')[0]}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div style={{ color: '#f87171', fontSize: '11px', marginBottom: '4px', borderBottom: '1px solid #ef4444' }}>👹 상대 주저사 (Curse Users)</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
                  {curses.map((key) => (
                    <button 
                      key={`ai-${key}`}
                      onClick={() => setSelectedAIChar(key)}
                      style={{
                        background: selectedAIChar === key ? 'rgba(248, 113, 113, 0.25)' : '#1e293b',
                        border: selectedAIChar === key ? '2px solid #f87171' : '1px solid #475569',
                        color: '#ffffff', padding: '6px 0', borderRadius: '6px', cursor: 'pointer', transition: 'all 0.15s'
                      }}
                    >
                      <span style={{ fontSize: '18px' }}>{CHARACTERS[key].avatar}</span>
                      <div style={{ fontSize: '9px', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{CHARACTERS[key].name.split(' ')[0]}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div style={{ background: 'rgba(15, 23, 42, 0.6)', border: '1px solid #6b21a8', borderRadius: '8px', padding: '16px', marginBottom: '20px' }}>
            <h4 style={{ color: '#c084fc', margin: '0 0 8px 0', fontSize: '12px' }}>📖 선택된 주술사 능력 정보</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', fontSize: '11px', color: '#cbd5e1', lineHeight: '1.5' }}>
              <div>
                <strong style={{ color: '#38bdf8' }}>[플레이어] {CHARACTERS[selectedChar].name} ({CHARACTERS[selectedChar].avatar})</strong><br/>
                • 패시브: {CHARACTERS[selectedChar].passive}<br/>
                • 기술 목록: {CHARACTERS[selectedChar].skills.map(s => s.name).join(', ')}
              </div>
              <div>
                <strong style={{ color: '#f87171' }}>[상대 AI] {CHARACTERS[selectedAIChar].name} ({CHARACTERS[selectedAIChar].avatar})</strong><br/>
                • 패시브: {CHARACTERS[selectedAIChar].passive}<br/>
                • 기술 목록: {CHARACTERS[selectedAIChar].skills.map(s => s.name).join(', ')}
              </div>
            </div>
          </div>

          <button 
            className="hologram-btn" 
            onClick={() => startGame(selectedChar, selectedAIChar)} 
            style={{ width: '100%', borderColor: '#8b5cf6', color: '#c084fc', padding: '12px', fontSize: '16px', textShadow: '0 0 8px rgba(168,85,247,0.5)' }}
          >
            가로 횡스크롤 결계 입장
          </button>
        </div>
      )}

      {gameState === 'playing' && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', width: '100%', maxWidth: '960px' }}>
          
          {/* Tekken-style HP bars */}
          <div style={{ width: '100%', background: '#1e293b', border: '1px solid #475569', borderRadius: '8px', padding: '12px', boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', fontSize: '12px', color: '#cbd5e1' }}>
              <div style={{ minWidth: '200px' }}>👤 {CHARACTERS[selectedChar].name} (나) : <strong style={{ color: '#38bdf8' }}>{playerHP}</strong> / {playerMaxHP} HP</div>
              
              {/* In-game quick menus */}
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span style={{ color: '#8b5cf6', fontWeight: 'bold', marginRight: '6px' }}>주술 격전</span>
                <button 
                  onClick={() => startGame(selectedChar, selectedAIChar)}
                  style={{
                    background: '#1e293b', border: '1px solid #8b5cf6', color: '#c084fc',
                    fontSize: '10px', padding: '2px 8px', borderRadius: '4px', cursor: 'pointer', transition: 'all 0.1s'
                  }}
                >
                  🔄 재시작
                </button>
                <button 
                  onClick={() => setGameState('title')}
                  style={{
                    background: '#1e293b', border: '1px solid #ef4444', color: '#f87171',
                    fontSize: '10px', padding: '2px 8px', borderRadius: '4px', cursor: 'pointer', transition: 'all 0.1s'
                  }}
                >
                  🚪 대기실
                </button>
              </div>
              
              <div style={{ minWidth: '200px', textAlign: 'right' }}>👹 {CHARACTERS[selectedAIChar].name} (적) : <strong style={{ color: '#f87171' }}>{aiHP}</strong> / {aiMaxHP} HP</div>
            </div>
            
            <div style={{ display: 'flex', gap: '10px' }}>
              <div style={{ flex: 1, height: '14px', background: '#000', borderRadius: '4px', overflow: 'hidden', position: 'relative' }}>
                <div style={{ width: `${(playerHPDecay / playerMaxHP) * 100}%`, height: '100%', background: '#f59e0b', position: 'absolute', left: 0, top: 0, transition: 'width 0.12s' }} />
                <div style={{ width: `${(playerHP / playerMaxHP) * 100}%`, height: '100%', background: '#38bdf8', position: 'absolute', left: 0, top: 0, transition: 'width 0.05s' }} />
              </div>
              
              <div style={{ flex: 1, height: '14px', background: '#000', borderRadius: '4px', overflow: 'hidden', position: 'relative', direction: 'rtl' }}>
                <div style={{ width: `${(aiHPDecay / aiMaxHP) * 100}%`, height: '100%', background: '#f59e0b', position: 'absolute', right: 0, top: 0, transition: 'width 0.12s' }} />
                <div style={{ width: `${(aiHP / aiMaxHP) * 100}%`, height: '100%', background: '#f87171', position: 'absolute', right: 0, top: 0, transition: 'width 0.05s' }} />
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '16px', width: '100%' }}>
            <div style={{ border: '2px solid #8b5cf6', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 0 15px rgba(139, 92, 246, 0.3)' }}>
              <canvas
                ref={canvasRef}
                width="640"
                height="480"
                onMouseMove={handleMouseMove}
                onClick={() => fireSkill(0)}
                style={{ display: 'block', cursor: 'crosshair' }}
              />
            </div>

            <div style={{ flex: 1, background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', padding: '12px', display: 'flex', flexDirection: 'column', height: '480px', boxSizing: 'border-box' }}>
              <h3 style={{ color: '#94a3b8', fontSize: '12px', borderBottom: '1px dashed #334155', paddingBottom: '6px', margin: '0 0 8px 0' }}>📜 장막 결투 실시간 Feeds</h3>
              <div style={{ flex: 1, overflowY: 'auto', fontSize: '10px', color: '#cbd5e1', display: 'flex', flexDirection: 'column', gap: '6px', fontFamily: 'monospace' }}>
                {logs.map((log, index) => (
                  <div key={index} style={{ borderBottom: '1px solid #1e293b', paddingBottom: '4px' }}>{log}</div>
                ))}
              </div>
            </div>
          </div>

          <div style={{ width: '100%', background: 'rgba(15, 23, 42, 0.9)', border: '1px solid #8b5cf6', borderRadius: '8px', padding: '16px', display: 'flex', gap: '20px', alignItems: 'center', boxSizing: 'border-box' }}>
            <div style={{ minWidth: '120px' }}>
              <div style={{ fontSize: '11px', color: '#a78bfa', marginBottom: '4px' }}>🌀 잔여 주력 게이지</div>
              <div style={{ fontSize: '20px', color: '#c084fc', fontWeight: 'bold' }}>{playerCE} <span style={{ fontSize: '11px', fontWeight: 'normal', color: '#94a3b8' }}>/ 100</span></div>
              <div style={{ width: '100%', height: '6px', background: '#000', borderRadius: '3px', marginTop: '6px', overflow: 'hidden' }}>
                <div style={{ width: `${playerCE}%`, height: '100%', background: '#c084fc' }} />
              </div>
            </div>

            <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px' }}>
              {CHARACTERS[selectedChar].skills.map((skill, idx) => (
                <button
                  key={idx}
                  onClick={() => fireSkill(idx)}
                  style={{
                    background: '#1e293b', border: '1px solid #475569', borderRadius: '6px', padding: '8px', cursor: 'pointer', textAlign: 'center', transition: 'all 0.15s'
                  }}
                >
                  <div style={{ fontSize: '10px', color: '#94a3b8' }}>[{idx + 1}]</div>
                  <div style={{ fontSize: '11px', color: '#ffffff', fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{skill.name}</div>
                  <div style={{ fontSize: '9px', color: '#c084fc', marginTop: '2px' }}>소모: {skill.cost}</div>
                </button>
              ))}
              <button
                onClick={useReverseCursed}
                style={{
                  background: '#1e293b', border: '1px solid #10b981', borderRadius: '6px', padding: '8px', cursor: 'pointer', textAlign: 'center'
                }}
              >
                <div style={{ fontSize: '10px', color: '#10b981' }}>[R]</div>
                <div style={{ fontSize: '11px', color: '#ffffff', fontWeight: 'bold' }}>{selectedChar === 'toji' ? '기동 회피' : '반전술식'}</div>
                <div style={{ fontSize: '9px', color: '#10b981', marginTop: '2px' }}>{selectedChar === 'toji' ? '소모: 0' : '소모: 35'}</div>
              </button>
            </div>
          </div>
        </div>
      )}

      {(gameState === 'victory' || gameState === 'defeat') && (
        <div style={{ background: 'rgba(15, 23, 42, 0.95)', border: `2px solid ${gameState === 'victory' ? '#10b981' : '#ef4444'}`, borderRadius: '12px', padding: '32px', width: '90%', maxWidth: '500px', textAlign: 'center', boxShadow: `0 0 25px rgba(${gameState === 'victory' ? '16, 185, 129' : '239, 68, 68'}, 0.4)` }}>
          <h1 style={{ color: gameState === 'victory' ? '#10b981' : '#ef4444', fontSize: '36px', margin: '0 0 12px 0' }}>
            {gameState === 'victory' ? '🎉 대결 승리! (VICTORY)' : '💀 패배... (DEFEAT)'}
          </h1>
          <p style={{ color: '#cbd5e1', fontSize: '14px', margin: '0 0 24px 0' }}>
            {gameState === 'victory' 
              ? `${CHARACTERS[selectedChar].name}의 압도적인 술식 전개로 ${CHARACTERS[selectedAIChar].name}을(를) 제압했습니다!`
              : `${CHARACTERS[selectedAIChar].name}의 파괴적 공세에 무너졌습니다. 주력의 연마를 지속하십시오.`}
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <button 
              className="hologram-btn" 
              onClick={() => startGame(selectedChar, selectedAIChar)}
              style={{ borderColor: '#8b5cf6', color: '#c084fc', padding: '10px 24px', cursor: 'pointer' }}
            >
              🔄 즉시 재대결 (Rematch)
            </button>
            <button 
              className="hologram-btn" 
              onClick={() => setGameState('title')}
              style={{ borderColor: gameState === 'victory' ? '#10b981' : '#ef4444', color: gameState === 'victory' ? '#10b981' : '#ef4444', padding: '10px 24px', cursor: 'pointer' }}
            >
              🚪 대기실로 퇴장
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// 16가지 주술 캐릭터 상세 스탯 스키마 전역 매핑
const CHARACTERS = {
  // === 주술사 (Jujutsu Sorcerers - 8 Characters) ===
  gojo: {
    name: '고죠 사토루',
    side: 'sorcerer',
    color: '#a78bfa',
    avatar: '👁️',
    maxHealth: 150,
    speed: 0.12,
    passive: '무하한 배리어 (대미지 차단. 단, 토지의 천역모에는 차단 해제)',
    skinColor: '#fee2e2',
    clothingColor: '#1e1b4b',
    hairColor: '#ffffff',
    skills: [
      { name: '술식순전 창', cooldown: 15, cost: 10, type: 'ao' },
      { name: '술식역전 혁', cooldown: 25, cost: 20, type: 'aka' },
      { name: '허식 자', cooldown: 50, cost: 40, type: 'murasaki' },
      { name: '영역전개 무량공처', cooldown: 250, cost: 100, type: 'void' }
    ]
  },
  yuji: {
    name: '이타도리 유지',
    side: 'sorcerer',
    color: '#22d3ee',
    avatar: '🥊',
    maxHealth: 130,
    speed: 0.14,
    passive: '흑섬 격발 확률 55% & 신속 기동',
    skinColor: '#fee2e2',
    clothingColor: '#1e293b',
    hairColor: '#f472b6',
    skills: [
      { name: '만지사슬 주먹', cooldown: 8, cost: 0, type: 'fist' },
      { name: '경정권', cooldown: 18, cost: 10, type: 'divergent' },
      { name: '유도 천혈', cooldown: 22, cost: 15, type: 'homing_blood' },
      { name: '흑섬 연타', cooldown: 180, cost: 80, type: 'yuji_combo' }
    ]
  },
  yuta: {
    name: '옷코츠 유타',
    side: 'sorcerer',
    color: '#34d399',
    avatar: '⚔️',
    maxHealth: 140,
    speed: 0.12,
    passive: '주력 회복속도 및 대기시간 30% 단축',
    skinColor: '#fee2e2',
    clothingColor: '#f8fafc',
    hairColor: '#0f172a',
    skills: [
      { name: '술식 모조', cooldown: 15, cost: 10, type: 'copy' },
      { name: '리카 현현', cooldown: 80, cost: 30, type: 'rika' },
      { name: '순애 포격', cooldown: 50, cost: 40, type: 'love_beam' },
      { name: '진조 결계전개', cooldown: 200, cost: 90, type: 'yuta_domain' }
    ]
  },
  megumi: {
    name: '후시구로 메구미',
    side: 'sorcerer',
    color: '#60a5fa',
    avatar: '🐺',
    maxHealth: 120,
    speed: 0.11,
    passive: '그림자 회피 (20% 확률 피격 무시)',
    skinColor: '#fee2e2',
    clothingColor: '#0f172a',
    hairColor: '#1e293b',
    skills: [
      { name: '식신: 옥견', cooldown: 15, cost: 12, type: 'divine_dog' },
      { name: '식신: 누에', cooldown: 25, cost: 18, type: 'nue' },
      { name: '식신: 탈토 (Decoy)', cooldown: 35, cost: 25, type: 'rabbits' },
      { name: '영역 감합암예정', cooldown: 220, cost: 100, type: 'shadow_garden' }
    ]
  },
  nanami: {
    name: '나나미 켄토',
    side: 'sorcerer',
    color: '#f59e0b',
    avatar: '👓',
    maxHealth: 130,
    speed: 0.115,
    passive: '7:3 급소 타격 (48% 확률로 9배 치명 대미지)',
    skinColor: '#fee2e2',
    clothingColor: '#fef08a',
    hairColor: '#eab308',
    skills: [
      { name: '7:3 참격 (Ratio)', cooldown: 10, cost: 0, type: 'ratio' },
      { name: '붕와 (Collapse)', cooldown: 24, cost: 15, type: 'collapse' },
      { name: '속박 해제', cooldown: 120, cost: 40, type: 'overtime' },
      { name: '정밀 7:3 격강', cooldown: 200, cost: 90, type: 'nanami_ultimate' }
    ]
  },
  nobara: {
    name: '쿠기사키 노바라',
    side: 'sorcerer',
    color: '#ec4899',
    avatar: '🔨',
    maxHealth: 120,
    speed: 0.11,
    passive: '못 관통 시 35% 추가 폭발 유발',
    skinColor: '#fee2e2',
    clothingColor: '#1e293b',
    hairColor: '#f97316',
    skills: [
      { name: '추령주법 못 던지기', cooldown: 10, cost: 5, type: 'nail' },
      { name: '헤어핀 (폭발)', cooldown: 24, cost: 15, type: 'hairpin' },
      { name: '공명 (Resonance)', cooldown: 45, cost: 25, type: 'resonance' },
      { name: '지푸라기 인형 난발', cooldown: 180, cost: 80, type: 'straw_barrage' }
    ]
  },
  toge: {
    name: '이누마키 토게',
    side: 'sorcerer',
    color: '#818cf8',
    avatar: '🍙',
    maxHealth: 125,
    speed: 0.125,
    passive: '주언 피격 시 적 45% 감속',
    skinColor: '#fee2e2',
    clothingColor: '#111827',
    hairColor: '#cbd5e1',
    skills: [
      { name: '주언: 움직이지 마', cooldown: 16, cost: 12, type: 'speech_stop' },
      { name: '주언: 터져라', cooldown: 26, cost: 22, type: 'speech_blast' },
      { name: '목캔디 복용', cooldown: 60, cost: 0, type: 'throat_candy' },
      { name: '주언: 찌부러져라', cooldown: 200, cost: 90, type: 'speech_crush' }
    ]
  },
  todo: {
    name: '토도 아오이',
    side: 'sorcerer',
    color: '#f97316',
    avatar: '🤝',
    maxHealth: 220,
    speed: 0.17,
    passive: '격투 물리 대미지 2.5배 상승',
    skinColor: '#fed7aa',
    clothingColor: '#020617',
    hairColor: '#1e293b',
    skills: [
      { name: '부기우기 타격', cooldown: 10, cost: 0, type: 'boogie_slap' },
      { name: '부기우기 (위치 스왑)', cooldown: 12, cost: 15, type: 'boogie_clap' },
      { name: '주력 깃든 조약돌', cooldown: 11, cost: 8, type: 'pebble_swap' },
      { name: '초고속 연수 타격', cooldown: 120, cost: 70, type: 'todo_rush' }
    ]
  },

  // === 주저사 & 주령 (Curse Users & Antagonists - 8 Characters) ===
  sukuna: {
    name: '료멘 스쿠나',
    side: 'curse',
    color: '#f87171',
    avatar: '👹',
    maxHealth: 180,
    speed: 0.11,
    passive: '참격 피해량 1.8배 증가',
    skinColor: '#fca5a5',
    clothingColor: '#f1f5f9',
    hairColor: '#f472b6',
    skills: [
      { name: '해 (Dismantle)', cooldown: 12, cost: 8, type: 'dismantle' },
      { name: '팔 (Cleave)', cooldown: 20, cost: 15, type: 'cleave' },
      { name: '화살 「개」 (Fuga)', cooldown: 60, cost: 35, type: 'fuga' },
      { name: '영역전개 복마어주자', cooldown: 250, cost: 100, type: 'shrine' }
    ]
  },
  geto: {
    name: '게토 스구루',
    side: 'curse',
    color: '#fbbf24',
    avatar: '🎐',
    maxHealth: 135,
    speed: 0.11,
    passive: '주령 조술 흡혈 (주령 타격 시 피해량 5% 생명력 회복)',
    skinColor: '#fee2e2',
    clothingColor: '#0f172a',
    hairColor: '#1e293b',
    skills: [
      { name: '주령 사출 (Flyhead)', cooldown: 12, cost: 8, type: 'flyhead' },
      { name: '강습 주령 (Assault)', cooldown: 25, cost: 15, type: 'curse_assault' },
      { name: '주령 소환 「홍룡」', cooldown: 55, cost: 40, type: 'rainbow_dragon' },
      { name: '백귀야행 주령군세', cooldown: 220, cost: 100, type: 'curse_swarm' }
    ]
  },
  toji: {
    name: '토우지 후시구로',
    side: 'curse',
    color: '#94a3b8',
    avatar: '🗡️',
    maxHealth: 170,
    speed: 0.16,
    passive: '천여주박 (기동 회피 기믹, 이속 1.6배, 공격력 2배)',
    skinColor: '#fed7aa',
    clothingColor: '#1e293b',
    hairColor: '#020617',
    skills: [
      { name: '천역모', cooldown: 16, cost: 0, type: 'spear_of_heaven' },
      { name: '석혼도 참격', cooldown: 20, cost: 0, type: 'soul_split' },
      { name: '권총 속사', cooldown: 15, cost: 0, type: 'toji_pistol' },
      { name: '천여주박 돌격', cooldown: 150, cost: 0, type: 'toji_ultimate' }
    ]
  },
  mahito: {
    name: '마히토',
    side: 'curse',
    color: '#2dd4bf',
    avatar: '🧵',
    maxHealth: 140,
    speed: 0.12,
    passive: '영혼 타격 (일반 대미지의 15% 가드/실드 무시)',
    skinColor: '#ccfbf1',
    clothingColor: '#475569',
    hairColor: '#5eead4',
    skills: [
      { name: '무위전변 (접촉)', cooldown: 18, cost: 15, type: 'idle_transfigure' },
      { name: '개조인간 소환', cooldown: 35, cost: 20, type: 'spawn_transfigured' },
      { name: '다중 영혼 투척', cooldown: 45, cost: 25, type: 'soul_multiplicity' },
      { name: '자폐원돈과', cooldown: 240, cost: 100, type: 'self_embodiment' }
    ]
  },
  jogo: {
    name: '죠고',
    side: 'curse',
    color: '#f97316',
    avatar: '🌋',
    maxHealth: 120,
    speed: 0.13,
    passive: '화염 스펠 적중 시 적 3초 도트 피해',
    skinColor: '#ffedd5',
    clothingColor: '#78350f',
    hairColor: '#cbd5e1',
    skills: [
      { name: '화염의 곤충 (Ember)', cooldown: 14, cost: 10, type: 'ember_insect' },
      { name: '화산 폭발', cooldown: 22, cost: 18, type: 'volcano_eruption' },
      { name: '극번 혜성 (Meteor)', cooldown: 65, cost: 40, type: 'jogo_meteor' },
      { name: '영역 개화 철화산', cooldown: 250, cost: 100, type: 'iron_mountain' }
    ]
  },
  hanami: {
    name: '하나미',
    side: 'curse',
    color: '#16a34a',
    avatar: '🌱',
    maxHealth: 160,
    speed: 0.11,
    passive: '상대방 주력 충전 차단 및 감속 마찰',
    skinColor: '#f0fdf4',
    clothingColor: '#14532d',
    hairColor: '#ffffff',
    skills: [
      { name: '나무뿌리 돌격', cooldown: 15, cost: 10, type: 'wood_root' },
      { name: '주력 흡수 꽃봉오리', cooldown: 24, cost: 15, type: 'cursed_bud' },
      { name: '재화의 밭 (슬로우)', cooldown: 45, cost: 20, type: 'flower_field' },
      { name: '조화의 빛 영역전개', cooldown: 220, cost: 90, type: 'wasteland_domain' }
    ]
  },
  choso: {
    name: '초소',
    side: 'curse',
    color: '#dc2626',
    avatar: '🩸',
    maxHealth: 135,
    speed: 0.12,
    passive: '적혈 장막 (체력이 낮을수록 참격 물리 대미지 상승)',
    skinColor: '#fee2e2',
    clothingColor: '#581c87',
    hairColor: '#020617',
    skills: [
      { name: '적혈조술 참격', cooldown: 12, cost: 5, type: 'blood_slicing' },
      { name: '적혈조술 「초강」', cooldown: 26, cost: 20, type: 'blood_supernova' },
      { name: '적혈조술 「백렴」', cooldown: 45, cost: 25, type: 'blood_beam' },
      { name: '혁린약동 (방어막)', cooldown: 60, cost: 15, type: 'blood_armor' }
    ]
  },
  kenjaku: {
    name: '켄자쿠',
    side: 'curse',
    color: '#701a75',
    avatar: '🧠',
    maxHealth: 150,
    speed: 0.115,
    passive: '영역 내부에서 매 2초마다 5의 배리어 보호막 충전',
    skinColor: '#fee2e2',
    clothingColor: '#0f172a',
    hairColor: '#020617',
    skills: [
      { name: '중력 조작 (Grav)', cooldown: 15, cost: 10, type: 'gravity_push' },
      { name: '주령 폭발 포진', cooldown: 26, cost: 20, type: 'curse_column' },
      { name: '극번 소용돌이 복제', cooldown: 60, cost: 35, type: 'uzumaki' },
      { name: '영역전개 태장편야', cooldown: 240, cost: 100, type: 'womb_profusion' }
    ]
  },
  naoya: {
    name: '젠인 나오야',
    side: 'curse',
    color: '#a3e635',
    avatar: '⚡',
    maxHealth: 135,
    speed: 0.18,
    passive: '투사주법 (초고속 이속 및 피격 시 24프레임 레일 잔상)',
    skinColor: '#fee2e2',
    clothingColor: '#0f172a',
    hairColor: '#cbd5e1',
    skills: [
      { name: '투사주법: 24프레임 레일', cooldown: 8, cost: 5, type: 'projection_rail' },
      { name: '투사주법: 프레임 고정', cooldown: 16, cost: 15, type: 'frame_freeze' },
      { name: '초가속 축적', cooldown: 40, cost: 20, type: 'speed_accumulate' },
      { name: '영역전개 시호포향', cooldown: 220, cost: 100, type: 'moon_palace' }
    ]
  }
};
