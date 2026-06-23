import { useState, useEffect, useRef } from 'react';

interface TechCategory {
  name: string;
  nameEn: string;
  items: string[];
}

interface SkillTreeProps {
  techStack: TechCategory[];
  lang: 'zh' | 'en';
}

interface Satellite {
  name: string;
  angle: number;
  size: number;
}

interface Orbit {
  category: TechCategory;
  radius: number;
  speed: number;
  reverse: boolean;
  satellites: Satellite[];
  color: string;
}

const ORBIT_COLORS = ['#00e5ff', '#00ff88', '#ff6b6b', '#ffa726', '#ab47bc', '#26c6da', '#9ccc65', '#ec407a'];
// Light mode variants (slightly darker for contrast on white)
const ORBIT_COLORS_LIGHT = ['#0091ae', '#00875a', '#d32f2f', '#e65100', '#7b1fa2', '#00838f', '#558b2f', '#c2185b'];

export default function SkillTree({ techStack, lang }: SkillTreeProps) {
  const [hovered, setHovered] = useState<string | null>(null);
  const [isDark, setIsDark] = useState(true);
  const [tick, setTick] = useState(0);
  const rafRef = useRef<number>(0);

  // Theme detection
  useEffect(() => {
    const check = () => setIsDark(document.documentElement.classList.contains('dark'));
    check();
    const obs = new MutationObserver(check);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);

  // Animation tick (drives rotation)
  useEffect(() => {
    let last = performance.now();
    const loop = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      setTick(t => (t + dt) % 1000);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  const colors = isDark ? ORBIT_COLORS : ORBIT_COLORS_LIGHT;

  // Build orbits — distribute 8 categories across 8 rings
  const orbits: Orbit[] = techStack.slice(0, 8).map((cat, idx) => {
    const radius = 110 + idx * 38; // 110, 148, 186, ..., 374
    const speed = 0.08 + (idx % 3) * 0.04; // different speeds
    const reverse = idx % 2 === 1;
    const itemCount = cat.items.length;
    const satellites: Satellite[] = cat.items.map((item, i) => {
      const angle = (i / itemCount) * Math.PI * 2 + (idx * 0.3); // stagger
      const sizeVariation = item.length > 8 ? 0.9 : 1.1; // longer names smaller
      return {
        name: item,
        angle,
        size: sizeVariation,
      };
    });
    return {
      category: cat,
      radius,
      speed,
      reverse,
      satellites,
      color: colors[idx % colors.length],
    };
  });

  const cx = 500;
  const cy = 500;

  return (
    <div className="relative w-full flex justify-center">
      <div
        className="relative w-full max-w-3xl mx-auto"
        style={{ aspectRatio: '1 / 1' }}
      >
        {/* Background card */}
        <div
          className="absolute inset-0 rounded-[var(--radius)] border"
          style={{
            background: 'var(--color-card)',
            borderColor: 'var(--color-border)',
            backdropFilter: 'blur(12px)',
          }}
        />

        <svg
          className="relative w-full h-full"
          viewBox="0 0 1000 1000"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            {/* Sun gradient */}
            <radialGradient id="sunGradient" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={isDark ? '#00ffff' : '#0091ae'} stopOpacity="1" />
              <stop offset="50%" stopColor={isDark ? '#00e5ff' : '#006d85'} stopOpacity="0.9" />
              <stop offset="100%" stopColor={isDark ? '#0091ae' : '#003d4d'} stopOpacity="0.4" />
            </radialGradient>
            <radialGradient id="sunGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={isDark ? '#00e5ff' : '#0091ae'} stopOpacity="0.5" />
              <stop offset="100%" stopColor={isDark ? '#00e5ff' : '#0091ae'} stopOpacity="0" />
            </radialGradient>
            <filter id="sunBlur" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="6" />
            </filter>
            <filter id="orbitGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Background stars */}
          {Array.from({ length: 60 }, (_, i) => {
            const x = (i * 137.5) % 1000;
            const y = (i * 73.3) % 1000;
            const r = (i % 3) * 0.4 + 0.3;
            const o = 0.3 + (i % 4) * 0.15;
            return (
              <circle key={`star-${i}`} cx={x} cy={y} r={r} fill="var(--color-accent)" opacity={isDark ? o : o * 0.5} />
            );
          })}

          {/* Orbit rings (static, dashed) */}
          {orbits.map((orbit, idx) => (
            <g key={`orbit-ring-${idx}`}>
              <circle
                cx={cx}
                cy={cy}
                r={orbit.radius}
                fill="none"
                stroke={orbit.color}
                strokeWidth="0.5"
                strokeDasharray="2 4"
                opacity={isDark ? 0.3 : 0.5}
              />
            </g>
          ))}

          {/* Sun glow halo */}
          <circle cx={cx} cy={cy} r="100" fill="url(#sunGlow)" opacity={isDark ? 0.6 : 0.4} />

          {/* Sun core */}
          <g>
            {/* Outer rotating ring */}
            <circle
              cx={cx} cy={cy} r="55"
              fill="none"
              stroke={isDark ? '#00e5ff' : '#0091ae'}
              strokeWidth="1"
              opacity="0.4"
              strokeDasharray="4 6"
              style={{
                transformOrigin: `${cx}px ${cy}px`,
                transform: `rotate(${tick * 30}deg)`,
              }}
            />
            <circle
              cx={cx} cy={cy} r="45"
              fill="url(#sunGradient)"
              filter="url(#sunBlur)"
            />
            <circle cx={cx} cy={cy} r="38" fill="url(#sunGradient)" />
            {/* Sun center label */}
            <text
              x={cx}
              y={cy + 4}
              textAnchor="middle"
              fontSize="18"
              fontWeight="700"
              fontFamily="'JetBrains Mono', monospace"
              fill={isDark ? '#06080d' : '#ffffff'}
            >
              {lang === 'zh' ? '技术' : 'TECH'}
            </text>
          </g>

          {/* Orbital systems — each rotates independently */}
          {orbits.map((orbit, oIdx) => {
            const rotation = orbit.reverse
              ? -tick * orbit.speed * 60
              : tick * orbit.speed * 60;

            return (
              <g
                key={`orbit-${oIdx}`}
                style={{
                  transformOrigin: `${cx}px ${cy}px`,
                  transform: `rotate(${rotation}deg)`,
                }}
              >
                {/* Orbit line accent (one highlighted orbit) */}
                {oIdx === 0 && (
                  <circle
                    cx={cx} cy={cy} r={orbit.radius}
                    fill="none"
                    stroke={orbit.color}
                    strokeWidth="1"
                    opacity="0.4"
                  />
                )}

                {/* Satellites */}
                {orbit.satellites.map((sat, sIdx) => {
                  const x = cx + Math.cos(sat.angle) * orbit.radius;
                  const y = cy + Math.sin(sat.angle) * orbit.radius;
                  const isHovered = hovered === `${oIdx}-${sIdx}`;

                  return (
                    <g
                      key={`sat-${oIdx}-${sIdx}`}
                      style={{
                        transform: `rotate(${-rotation}deg)`,
                        transformOrigin: `${x}px ${y}px`,
                      }}
                      onMouseEnter={() => setHovered(`${oIdx}-${sIdx}`)}
                      onMouseLeave={() => setHovered(null)}
                      className="cursor-pointer"
                    >
                      {/* Satellite glow halo */}
                      {isHovered && (
                        <circle
                          cx={x} cy={y} r="22"
                          fill={orbit.color}
                          opacity="0.25"
                          filter="url(#orbitGlow)"
                        />
                      )}
                      {/* Satellite body */}
                      <circle
                        cx={x} cy={y}
                        r={isHovered ? 7 : 5}
                        fill={orbit.color}
                        filter="url(#orbitGlow)"
                        style={{ transition: 'r 0.2s ease' }}
                      />
                      {/* Inner bright core */}
                      <circle
                        cx={x} cy={y}
                        r={isHovered ? 3 : 2}
                        fill="#ffffff"
                        opacity="0.95"
                      />
                      {/* Label */}
                      {isHovered ? (
                        <g>
                          <rect
                            x={x - sat.name.length * 3.5 - 6}
                            y={y - 22}
                            width={sat.name.length * 7 + 12}
                            height="16"
                            rx="3"
                            fill="var(--color-card-solid)"
                            stroke={orbit.color}
                            strokeWidth="1"
                            opacity="0.95"
                          />
                          <text
                            x={x}
                            y={y - 10}
                            textAnchor="middle"
                            fontSize="10"
                            fontWeight="600"
                            fontFamily="'JetBrains Mono', monospace"
                            fill={orbit.color}
                          >
                            {sat.name}
                          </text>
                        </g>
                      ) : (
                        <text
                          x={x}
                          y={y + 18}
                          textAnchor="middle"
                          fontSize="9"
                          fontFamily="'JetBrains Mono', monospace"
                          fill="var(--color-text-secondary)"
                          opacity="0.7"
                        >
                          {sat.name}
                        </text>
                      )}
                    </g>
                  );
                })}
              </g>
            );
          })}

          {/* Legend in corner */}
          <g transform="translate(20, 20)">
            <text
              x="0" y="0"
              fontSize="11"
              fontFamily="'JetBrains Mono', monospace"
              fill="var(--color-text-secondary)"
              opacity="0.6"
            >
              {lang === 'zh' ? '// 太阳系' : '// SOLAR SYSTEM'}
            </text>
            <text
              x="0" y="16"
              fontSize="9"
              fontFamily="'JetBrains Mono', monospace"
              fill="var(--color-text-secondary)"
              opacity="0.4"
            >
              {lang === 'zh' ? '中心 = 技术核心 · 卫星 = 技能' : 'CORE = STACK · SATELLITES = SKILLS'}
            </text>
          </g>

          {/* Stats bottom-right */}
          <g transform="translate(980, 980)">
            <text
              x="0" y="0"
              textAnchor="end"
              fontSize="10"
              fontFamily="'JetBrains Mono', monospace"
              fill="var(--color-text-secondary)"
              opacity="0.5"
            >
              {orbits.length} {lang === 'zh' ? '轨道' : 'ORBITS'} · {orbits.reduce((s, o) => s + o.satellites.length, 0)} {lang === 'zh' ? '技能' : 'SKILLS'}
            </text>
          </g>
        </svg>
      </div>
    </div>
  );
}
