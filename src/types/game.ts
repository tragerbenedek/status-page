export interface Vec2 {
  x: number;
  y: number;
}

export interface Missile {
  id: string;
  start: Vec2;
  pos: Vec2;
  target: Vec2;
  speed: number;
  trail: Vec2[];
  isEnemy: boolean;
}

export interface Explosion {
  id: string;
  pos: Vec2;
  maxRadius: number;
  radius: number;
  growing: boolean;
  opacity: number;
  color: string;
}

export interface City {
  id: string;
  x: number;
  destroyed: boolean;
}

export interface Battery {
  id: string;
  x: number;
  ammo: number;
  maxAmmo: number;
}

export type GameState = 'idle' | 'playing' | 'wave_clear' | 'game_over';

export interface GameData {
  score: number;
  wave: number;
  cities: City[];
  batteries: Battery[];
  missiles: Missile[];
  explosions: Explosion[];
  gameState: GameState;
  crosshair: Vec2;
}
