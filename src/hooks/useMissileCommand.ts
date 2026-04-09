import { useRef, useState, useEffect, useCallback } from 'react';
import {
  Vec2, Missile, Explosion, City, Battery, GameState,
} from '../types/game';

const CANVAS_W = 900;
const CANVAS_H = 600;
const GROUND_Y = CANVAS_H - 60;
const CITY_Y = GROUND_Y - 20;
const BATTERY_Y = GROUND_Y - 10;
const EXPLOSION_MAX_RADIUS = 52;
const PLAYER_EXPLOSION_MAX_RADIUS = 52;
const ENEMY_EXPLOSION_RADIUS = 38;
const BASE_SPEED = 0.6;
const TRAIL_LENGTH = 28;
const AMMO_PER_BATTERY = 10;

const CITY_POSITIONS = [120, 240, 360, 510, 630, 750];
const BATTERY_POSITIONS = [60, 450, 840];

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function dist(a: Vec2, b: Vec2) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function initCities(): City[] {
  return CITY_POSITIONS.map((x, i) => ({ id: `city-${i}`, x, destroyed: false }));
}

function initBatteries(): Battery[] {
  return BATTERY_POSITIONS.map((x, i) => ({
    id: `bat-${i}`,
    x,
    ammo: AMMO_PER_BATTERY,
    maxAmmo: AMMO_PER_BATTERY,
  }));
}

function waveConfig(wave: number) {
  const count = Math.min(4 + wave * 2, 20);
  const speed = BASE_SPEED + wave * 0.12;
  const interval = Math.max(600 - wave * 40, 220);
  return { count, speed, interval };
}

export function useMissileCommand(canvasRef: React.RefObject<HTMLCanvasElement | null>) {
  const [score, setScore] = useState(0);
  const [wave, setWave] = useState(1);
  const [gameState, setGameState] = useState<GameState>('idle');
  const [citiesAlive, setCitiesAlive] = useState(6);

  const stateRef = useRef({
    missiles: [] as Missile[],
    explosions: [] as Explosion[],
    cities: initCities(),
    batteries: initBatteries(),
    crosshair: { x: CANVAS_W / 2, y: CANVAS_H / 2 } as Vec2,
    score: 0,
    wave: 1,
    gameState: 'idle' as GameState,
    missilesFired: 0,
    totalWaveMissiles: 0,
    spawnTimer: 0,
    spawnInterval: 800,
    waveSpeed: BASE_SPEED,
    waveClearing: false,
    animFrame: 0,
    lastTime: 0,
  });

  const animRef = useRef<number>(0);

  // ─── Drawing ────────────────────────────────────────────────────────────────

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const s = stateRef.current;

    // Background gradient
    const bg = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
    bg.addColorStop(0, '#000510');
    bg.addColorStop(0.6, '#010d1f');
    bg.addColorStop(1, '#0a1628');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Stars
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    // Use a seeded deterministic set of stars (pre-drawn once via offset trick)
    const starData = (canvas as any).__stars as { x: number; y: number; r: number }[] | undefined;
    if (starData) {
      for (const st of starData) {
        ctx.beginPath();
        ctx.arc(st.x, st.y, st.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Ground
    const groundGrad = ctx.createLinearGradient(0, GROUND_Y, 0, CANVAS_H);
    groundGrad.addColorStop(0, '#1a3a1a');
    groundGrad.addColorStop(1, '#0d1f0d');
    ctx.fillStyle = groundGrad;
    ctx.fillRect(0, GROUND_Y, CANVAS_W, CANVAS_H - GROUND_Y);

    // Ground line glow
    ctx.strokeStyle = '#2ecc40';
    ctx.lineWidth = 2;
    ctx.shadowColor = '#2ecc40';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.moveTo(0, GROUND_Y);
    ctx.lineTo(CANVAS_W, GROUND_Y);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Cities
    for (const city of s.cities) {
      if (city.destroyed) {
        // Rubble
        ctx.fillStyle = '#555';
        ctx.fillRect(city.x - 18, CITY_Y + 10, 36, 10);
        ctx.fillStyle = '#333';
        for (let i = 0; i < 5; i++) {
          ctx.fillRect(city.x - 16 + i * 7, CITY_Y + 6, 5, 6);
        }
      } else {
        drawCity(ctx, city.x, CITY_Y);
      }
    }

    // Batteries
    for (const bat of s.batteries) {
      drawBattery(ctx, bat.x, BATTERY_Y, bat.ammo, bat.maxAmmo);
    }

    // Enemy missile trails
    for (const m of s.missiles) {
      if (!m.isEnemy) continue;
      if (m.trail.length > 1) {
        ctx.lineWidth = 1.5;
        for (let i = 1; i < m.trail.length; i++) {
          const alpha = i / m.trail.length;
          ctx.strokeStyle = `rgba(255,60,60,${alpha * 0.7})`;
          ctx.beginPath();
          ctx.moveTo(m.trail[i - 1].x, m.trail[i - 1].y);
          ctx.lineTo(m.trail[i].x, m.trail[i].y);
          ctx.stroke();
        }
      }
      // Enemy missile head
      ctx.fillStyle = '#ff4444';
      ctx.shadowColor = '#ff0000';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(m.pos.x, m.pos.y, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // Player missile trails
    for (const m of s.missiles) {
      if (m.isEnemy) continue;
      if (m.trail.length > 1) {
        ctx.lineWidth = 2;
        for (let i = 1; i < m.trail.length; i++) {
          const alpha = i / m.trail.length;
          ctx.strokeStyle = `rgba(0,200,255,${alpha * 0.9})`;
          ctx.beginPath();
          ctx.moveTo(m.trail[i - 1].x, m.trail[i - 1].y);
          ctx.lineTo(m.trail[i].x, m.trail[i].y);
          ctx.stroke();
        }
      }
      ctx.fillStyle = '#00ccff';
      ctx.shadowColor = '#00ccff';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(m.pos.x, m.pos.y, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // Explosions
    for (const ex of s.explosions) {
      const grad = ctx.createRadialGradient(ex.pos.x, ex.pos.y, 0, ex.pos.x, ex.pos.y, ex.radius);
      grad.addColorStop(0, ex.color.replace('1)', `${ex.opacity})`));
      grad.addColorStop(0.4, ex.color.replace('1)', `${ex.opacity * 0.6})`));
      grad.addColorStop(1, ex.color.replace('1)', '0)'));
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(ex.pos.x, ex.pos.y, ex.radius, 0, Math.PI * 2);
      ctx.fill();

      // Ring
      ctx.strokeStyle = ex.color.replace('1)', `${ex.opacity * 0.8})`);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(ex.pos.x, ex.pos.y, ex.radius, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Crosshair
    if (s.gameState === 'playing') {
      const cx = s.crosshair.x;
      const cy = s.crosshair.y;
      ctx.strokeStyle = 'rgba(0,255,100,0.9)';
      ctx.lineWidth = 1.5;
      ctx.shadowColor = '#00ff64';
      ctx.shadowBlur = 6;

      const size = 16;
      const gap = 5;
      // Horizontal lines
      ctx.beginPath();
      ctx.moveTo(cx - size, cy);
      ctx.lineTo(cx - gap, cy);
      ctx.moveTo(cx + gap, cy);
      ctx.lineTo(cx + size, cy);
      // Vertical lines
      ctx.moveTo(cx, cy - size);
      ctx.lineTo(cx, cy - gap);
      ctx.moveTo(cx, cy + gap);
      ctx.lineTo(cx, cy + size);
      ctx.stroke();

      // Center dot
      ctx.fillStyle = 'rgba(0,255,100,0.9)';
      ctx.beginPath();
      ctx.arc(cx, cy, 2, 0, Math.PI * 2);
      ctx.fill();

      // Corner ticks
      const tickLen = 6;
      ctx.beginPath();
      ctx.moveTo(cx - size, cy - tickLen);
      ctx.lineTo(cx - size, cy + tickLen);
      ctx.moveTo(cx + size, cy - tickLen);
      ctx.lineTo(cx + size, cy + tickLen);
      ctx.moveTo(cx - tickLen, cy - size);
      ctx.lineTo(cx + tickLen, cy - size);
      ctx.moveTo(cx - tickLen, cy + size);
      ctx.lineTo(cx + tickLen, cy + size);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // HUD
    drawHUD(ctx, s.score, s.wave, s.batteries);
  }, [canvasRef]);

  function drawCity(ctx: CanvasRenderingContext2D, x: number, y: number) {
    ctx.shadowColor = '#00aaff';
    ctx.shadowBlur = 6;

    // Buildings
    const buildings = [
      { dx: -14, w: 10, h: 22 },
      { dx: -3, w: 8, h: 30 },
      { dx: 6, w: 10, h: 18 },
      { dx: 2, w: 6, h: 26 },
    ];
    for (const b of buildings) {
      const grad = ctx.createLinearGradient(x + b.dx, y - b.h, x + b.dx + b.w, y);
      grad.addColorStop(0, '#3399ff');
      grad.addColorStop(1, '#004488');
      ctx.fillStyle = grad;
      ctx.fillRect(x + b.dx, y - b.h, b.w, b.h);

      // Windows
      ctx.fillStyle = 'rgba(255,255,150,0.8)';
      for (let wy = y - b.h + 3; wy < y - 4; wy += 5) {
        for (let wx = x + b.dx + 2; wx < x + b.dx + b.w - 1; wx += 4) {
          if (Math.random() > 0.3) {
            ctx.fillRect(wx, wy, 2, 3);
          }
        }
      }
    }
    ctx.shadowBlur = 0;
  }

  function drawBattery(
    ctx: CanvasRenderingContext2D,
    x: number, y: number,
    ammo: number, maxAmmo: number,
  ) {
    // Base
    ctx.shadowColor = '#ffaa00';
    ctx.shadowBlur = 8;
    ctx.fillStyle = '#665500';
    ctx.fillRect(x - 18, y, 36, 14);
    ctx.fillStyle = '#887700';
    ctx.fillRect(x - 15, y - 6, 30, 8);

    // Turret
    ctx.strokeStyle = '#ffcc00';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y - 6);
    ctx.lineTo(x, y - 18);
    ctx.stroke();

    ctx.shadowBlur = 0;

    // Ammo indicators
    const dotSpacing = 7;
    const startX = x - ((maxAmmo - 1) * dotSpacing) / 2;
    for (let i = 0; i < maxAmmo; i++) {
      const dotX = startX + i * dotSpacing;
      ctx.beginPath();
      ctx.arc(dotX, y + 20, 2.5, 0, Math.PI * 2);
      if (i < ammo) {
        ctx.fillStyle = '#ffdd00';
        ctx.shadowColor = '#ffdd00';
        ctx.shadowBlur = 4;
      } else {
        ctx.fillStyle = '#333';
        ctx.shadowBlur = 0;
      }
      ctx.fill();
    }
    ctx.shadowBlur = 0;
  }

  function drawHUD(
    ctx: CanvasRenderingContext2D,
    score: number, wave: number,
    batteries: Battery[],
  ) {
    ctx.font = 'bold 18px "Courier New", monospace';
    ctx.fillStyle = '#00ff88';
    ctx.shadowColor = '#00ff88';
    ctx.shadowBlur = 8;
    ctx.fillText(`SCORE: ${score.toString().padStart(6, '0')}`, 16, 28);
    ctx.textAlign = 'center';
    ctx.fillText(`WAVE ${wave}`, CANVAS_W / 2, 28);
    ctx.textAlign = 'right';
    const totalAmmo = batteries.reduce((a, b) => a + b.ammo, 0);
    ctx.fillText(`AMMO: ${totalAmmo}`, CANVAS_W - 16, 28);
    ctx.textAlign = 'left';
    ctx.shadowBlur = 0;
  }

  // ─── Game Logic ─────────────────────────────────────────────────────────────

  const updateGame = useCallback((dt: number) => {
    const s = stateRef.current;
    if (s.gameState !== 'playing') return;

    // Spawn enemy missiles
    if (s.missilesFired < s.totalWaveMissiles) {
      s.spawnTimer -= dt;
      if (s.spawnTimer <= 0) {
        spawnEnemyMissile();
        s.missilesFired++;
        s.spawnTimer = s.spawnInterval + (Math.random() - 0.5) * s.spawnInterval * 0.5;
      }
    }

    // Move missiles
    const toRemove: string[] = [];
    for (const m of s.missiles) {
      const dx = m.target.x - m.pos.x;
      const dy = m.target.y - m.pos.y;
      const d = Math.hypot(dx, dy);

      if (d < m.speed * (dt / 16) + 3) {
        // Missile reached target
        toRemove.push(m.id);
        if (m.isEnemy) {
          createExplosion(m.target, ENEMY_EXPLOSION_RADIUS, 'rgba(255,100,20,1)', false);
          // Check city hits
          for (const city of s.cities) {
            if (!city.destroyed && Math.abs(city.x - m.target.x) < 30 && m.target.y > CITY_Y - 10) {
              city.destroyed = true;
            }
          }
        } else {
          createExplosion(m.target, PLAYER_EXPLOSION_MAX_RADIUS, 'rgba(0,180,255,1)', true);
        }
      } else {
        const speed = m.speed * (dt / 16);
        const nx = dx / d;
        const ny = dy / d;
        m.pos = { x: m.pos.x + nx * speed, y: m.pos.y + ny * speed };
        m.trail.push({ ...m.pos });
        if (m.trail.length > TRAIL_LENGTH) m.trail.shift();
      }
    }
    s.missiles = s.missiles.filter(m => !toRemove.includes(m.id));

    // Update explosions
    for (const ex of s.explosions) {
      if (ex.growing) {
        ex.radius += (dt / 16) * 2.2;
        if (ex.radius >= ex.maxRadius) {
          ex.growing = false;
        }
        // Intercept check
        if (ex.growing || ex.opacity > 0) {
          const intercepted: string[] = [];
          for (const m of s.missiles) {
            if (m.isEnemy && dist(m.pos, ex.pos) < ex.radius) {
              intercepted.push(m.id);
              s.score += 25;
              setScore(s.score);
              createExplosion(m.pos, EXPLOSION_MAX_RADIUS * 0.7, 'rgba(255,200,0,1)', false);
            }
          }
          s.missiles = s.missiles.filter(m => !intercepted.includes(m.id));
        }
      } else {
        ex.opacity -= (dt / 16) * 0.035;
        ex.radius += (dt / 16) * 0.3;
      }
    }
    s.explosions = s.explosions.filter(ex => ex.opacity > 0);

    // Check wave complete
    const allFired = s.missilesFired >= s.totalWaveMissiles;
    const noMissiles = s.missiles.filter(m => m.isEnemy).length === 0;
    const noExplosions = s.explosions.length === 0;
    if (allFired && noMissiles && noExplosions && !s.waveClearing) {
      s.waveClearing = true;
      // Wave clear bonus
      const survivingCities = s.cities.filter(c => !c.destroyed).length;
      const survivingBats = s.batteries.reduce((a, b) => a + b.ammo, 0);
      s.score += survivingCities * 100 + survivingBats * 5 + s.wave * 50;
      setScore(s.score);
      const allDestroyed = s.cities.every(c => c.destroyed);
      if (allDestroyed) {
        s.gameState = 'game_over';
        setGameState('game_over');
      } else {
        s.gameState = 'wave_clear';
        setGameState('wave_clear');
        setWave(s.wave);
        setCitiesAlive(s.cities.filter(c => !c.destroyed).length);
      }
    }

    // Check instant game over (all cities destroyed)
    if (!s.waveClearing && s.cities.every(c => c.destroyed)) {
      s.waveClearing = true;
      s.gameState = 'game_over';
      setGameState('game_over');
    }

  }, []);

  function spawnEnemyMissile() {
    const s = stateRef.current;
    const startX = Math.random() * CANVAS_W;
    const targets = [
      ...s.cities.filter(c => !c.destroyed).map(c => ({ x: c.x, y: CITY_Y })),
      ...s.batteries.map(b => ({ x: b.x, y: BATTERY_Y })),
    ];
    if (targets.length === 0) return;

    // Weighted random – prefer cities
    const target = targets[Math.floor(Math.random() * targets.length)];
    const m: Missile = {
      id: uid(),
      start: { x: startX, y: 0 },
      pos: { x: startX, y: 0 },
      target: { x: target.x + (Math.random() - 0.5) * 20, y: target.y },
      speed: s.waveSpeed + Math.random() * 0.3,
      trail: [],
      isEnemy: true,
    };
    s.missiles.push(m);
  }

  function createExplosion(
    pos: Vec2, maxRadius: number, color: string, isPlayer: boolean,
  ) {
    const s = stateRef.current;
    s.explosions.push({
      id: uid(),
      pos: { ...pos },
      maxRadius,
      radius: isPlayer ? 4 : 6,
      growing: true,
      opacity: 1,
      color,
    });
  }

  // ─── Loop ───────────────────────────────────────────────────────────────────

  const loop = useCallback((ts: number) => {
    const s = stateRef.current;
    const dt = Math.min(ts - s.lastTime, 50);
    s.lastTime = ts;

    if (s.gameState === 'playing') {
      updateGame(dt);
    }
    draw();
    animRef.current = requestAnimationFrame(loop);
  }, [draw, updateGame]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // Generate stars once
    const stars: { x: number; y: number; r: number }[] = [];
    for (let i = 0; i < 120; i++) {
      stars.push({
        x: Math.random() * CANVAS_W,
        y: Math.random() * (GROUND_Y - 40),
        r: Math.random() * 1.2 + 0.2,
      });
    }
    (canvas as any).__stars = stars;

    animRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animRef.current);
  }, [loop, canvasRef]);

  // ─── Input ──────────────────────────────────────────────────────────────────

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = CANVAS_W / rect.width;
    const scaleY = CANVAS_H / rect.height;
    stateRef.current.crosshair = {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }, [canvasRef]);

  const firePlayerMissile = useCallback((targetX: number, targetY: number) => {
    const s = stateRef.current;
    if (s.gameState !== 'playing') return;

    // Find best battery (closest with ammo)
    const batsWithAmmo = s.batteries.filter(b => b.ammo > 0);
    if (batsWithAmmo.length === 0) return;

    const bat = batsWithAmmo.reduce((best, b) =>
      Math.abs(b.x - targetX) < Math.abs(best.x - targetX) ? b : best,
    );

    bat.ammo--;

    const m: Missile = {
      id: uid(),
      start: { x: bat.x, y: BATTERY_Y - 18 },
      pos: { x: bat.x, y: BATTERY_Y - 18 },
      target: { x: targetX, y: targetY },
      speed: 5,
      trail: [],
      isEnemy: false,
    };
    s.missiles.push(m);
  }, []);

  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const s = stateRef.current;
    if (s.gameState !== 'playing') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = CANVAS_W / rect.width;
    const scaleY = CANVAS_H / rect.height;
    const tx = (e.clientX - rect.left) * scaleX;
    const ty = (e.clientY - rect.top) * scaleY;
    firePlayerMissile(tx, ty);
  }, [firePlayerMissile, canvasRef]);

  // ─── Game control ────────────────────────────────────────────────────────────

  const startGame = useCallback(() => {
    const s = stateRef.current;
    s.cities = initCities();
    s.batteries = initBatteries();
    s.missiles = [];
    s.explosions = [];
    s.score = 0;
    s.wave = 1;
    s.missilesFired = 0;
    s.waveClearing = false;
    s.lastTime = performance.now();
    const cfg = waveConfig(1);
    s.totalWaveMissiles = cfg.count;
    s.waveSpeed = cfg.speed;
    s.spawnInterval = cfg.interval;
    s.spawnTimer = cfg.interval;
    s.gameState = 'playing';
    setScore(0);
    setWave(1);
    setCitiesAlive(6);
    setGameState('playing');
  }, []);

  const nextWave = useCallback(() => {
    const s = stateRef.current;
    s.wave++;
    // Reload batteries
    for (const bat of s.batteries) {
      bat.ammo = bat.maxAmmo;
    }
    s.missiles = [];
    s.explosions = [];
    s.missilesFired = 0;
    s.waveClearing = false;
    const cfg = waveConfig(s.wave);
    s.totalWaveMissiles = cfg.count;
    s.waveSpeed = cfg.speed;
    s.spawnInterval = cfg.interval;
    s.spawnTimer = cfg.interval;
    s.gameState = 'playing';
    setWave(s.wave);
    setCitiesAlive(s.cities.filter(c => !c.destroyed).length);
    setGameState('playing');
  }, []);

  return {
    score, wave, gameState, citiesAlive,
    handleMouseMove, handleClick,
    startGame, nextWave,
    canvasWidth: CANVAS_W,
    canvasHeight: CANVAS_H,
  };
}
