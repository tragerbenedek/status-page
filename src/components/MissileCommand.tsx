import React, { useRef } from 'react';
import { useMissileCommand } from '../hooks/useMissileCommand';

export default function MissileCommand() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const {
    score, wave, gameState, citiesAlive,
    handleMouseMove, handleClick,
    startGame, nextWave,
    canvasWidth, canvasHeight,
  } = useMissileCommand(canvasRef);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black select-none">
      {/* Title bar */}
      <div className="mb-3 text-center">
        <h1 className="text-4xl font-black tracking-widest text-transparent bg-clip-text"
          style={{ backgroundImage: 'linear-gradient(90deg,#ff4444,#ff8800,#ffcc00)', fontFamily: '"Courier New", monospace' }}>
          ⚡ MISSILE COMMAND ⚡
        </h1>
        <p className="text-xs text-green-400 tracking-widest mt-1" style={{ fontFamily: 'monospace' }}>
          DEFEND YOUR CITIES — CLICK TO FIRE INTERCEPTORS
        </p>
      </div>

      {/* Canvas wrapper */}
      <div className="relative" style={{ width: '100%', maxWidth: canvasWidth }}>
        <canvas
          ref={canvasRef}
          width={canvasWidth}
          height={canvasHeight}
          onMouseMove={handleMouseMove}
          onClick={handleClick}
          style={{
            width: '100%',
            height: 'auto',
            cursor: gameState === 'playing' ? 'none' : 'default',
            display: 'block',
            border: '2px solid #1a3a1a',
            boxShadow: '0 0 30px rgba(0,255,80,0.15), 0 0 60px rgba(0,100,40,0.1)',
          }}
        />

        {/* Overlay panels */}
        {gameState === 'idle' && (
          <Overlay>
            <div className="text-center px-8 py-10 rounded-2xl"
              style={{ background: 'rgba(0,8,20,0.92)', border: '2px solid #00aa44' }}>
              <div className="text-6xl mb-4">🚀</div>
              <h2 className="text-3xl font-black text-yellow-400 tracking-widest mb-2"
                style={{ fontFamily: 'monospace' }}>MISSILE COMMAND</h2>
              <p className="text-green-300 mb-6 text-sm tracking-wider" style={{ fontFamily: 'monospace' }}>
                Protect your 6 cities from the missile barrage!<br />
                Click anywhere to launch interceptor missiles.<br />
                Earn bonus points for surviving cities & ammo.
              </p>
              <div className="text-xs text-gray-400 mb-6 space-y-1" style={{ fontFamily: 'monospace' }}>
                <div>🎯 Enemy missile destroyed = <span className="text-yellow-400">+25 pts</span></div>
                <div>🏙️ City surviving wave = <span className="text-yellow-400">+100 pts</span></div>
                <div>💥 Unused ammo = <span className="text-yellow-400">+5 pts/shell</span></div>
              </div>
              <button
                onClick={startGame}
                className="px-10 py-3 text-xl font-black tracking-widest rounded-lg transition-all duration-150"
                style={{
                  background: 'linear-gradient(135deg,#ff4400,#ff8800)',
                  color: '#fff',
                  fontFamily: 'monospace',
                  boxShadow: '0 0 20px rgba(255,100,0,0.6)',
                  border: 'none',
                  cursor: 'pointer',
                }}
                onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.06)')}
                onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
              >
                ▶ LAUNCH DEFENSE
              </button>
            </div>
          </Overlay>
        )}

        {gameState === 'wave_clear' && (
          <Overlay>
            <div className="text-center px-8 py-8 rounded-2xl"
              style={{ background: 'rgba(0,8,20,0.92)', border: '2px solid #00ff88' }}>
              <div className="text-5xl mb-3">🛡️</div>
              <h2 className="text-2xl font-black text-green-400 tracking-widest mb-1"
                style={{ fontFamily: 'monospace' }}>WAVE {wave} CLEARED!</h2>
              <p className="text-yellow-300 text-sm tracking-wider mb-1" style={{ fontFamily: 'monospace' }}>
                Score: <span className="text-white font-bold">{score.toString().padStart(6, '0')}</span>
              </p>
              <p className="text-blue-300 text-sm mb-6" style={{ fontFamily: 'monospace' }}>
                Cities surviving: <span className="text-white font-bold">{citiesAlive}</span> / 6
              </p>
              <button
                onClick={nextWave}
                className="px-10 py-3 text-lg font-black tracking-widest rounded-lg transition-all duration-150"
                style={{
                  background: 'linear-gradient(135deg,#0066ff,#00ccff)',
                  color: '#fff',
                  fontFamily: 'monospace',
                  boxShadow: '0 0 20px rgba(0,150,255,0.6)',
                  border: 'none',
                  cursor: 'pointer',
                }}
                onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.06)')}
                onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
              >
                ▶ NEXT WAVE ({wave + 1})
              </button>
            </div>
          </Overlay>
        )}

        {gameState === 'game_over' && (
          <Overlay>
            <div className="text-center px-8 py-10 rounded-2xl"
              style={{ background: 'rgba(10,0,0,0.95)', border: '2px solid #ff2200' }}>
              <div className="text-6xl mb-4">☢️</div>
              <h2 className="text-3xl font-black text-red-500 tracking-widest mb-2"
                style={{ fontFamily: 'monospace' }}>CITIES DESTROYED</h2>
              <p className="text-gray-300 text-sm mb-1" style={{ fontFamily: 'monospace' }}>
                You survived <span className="text-yellow-400 font-bold">{wave}</span> waves
              </p>
              <p className="text-gray-300 text-xl font-bold mb-6" style={{ fontFamily: 'monospace' }}>
                FINAL SCORE: <span className="text-yellow-400">{score.toString().padStart(6, '0')}</span>
              </p>
              <button
                onClick={startGame}
                className="px-10 py-3 text-xl font-black tracking-widest rounded-lg transition-all duration-150"
                style={{
                  background: 'linear-gradient(135deg,#880000,#ff2200)',
                  color: '#fff',
                  fontFamily: 'monospace',
                  boxShadow: '0 0 20px rgba(255,0,0,0.5)',
                  border: 'none',
                  cursor: 'pointer',
                }}
                onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.06)')}
                onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
              >
                ↺ PLAY AGAIN
              </button>
            </div>
          </Overlay>
        )}
      </div>

      {/* Bottom controls legend */}
      <div className="mt-3 flex gap-8 text-xs text-gray-500" style={{ fontFamily: 'monospace' }}>
        <span>🖱️ Move — aim crosshair</span>
        <span>🖱️ Click — fire interceptor</span>
        <span>🏙️ Protect all 6 cities</span>
      </div>
    </div>
  );
}

function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)' }}>
      {children}
    </div>
  );
}
