import { useState } from 'react';

interface Skill {
  name: string;
  nameEn: string;
  level: number;
}

interface RadarChartProps {
  skills: Skill[];
  lang: 'zh' | 'en';
}

export default function RadarChart({ skills, lang }: RadarChartProps) {
  const [hoveredSkill, setHoveredSkill] = useState<number | null>(null);

  const size = 400;
  const center = size / 2;
  const radius = 150;
  const levels = 5;

  function getPoint(index: number, level: number) {
    const angle = (Math.PI * 2 * index) / skills.length - Math.PI / 2;
    const r = (radius * level) / levels;
    return {
      x: center + r * Math.cos(angle),
      y: center + r * Math.sin(angle),
    };
  }

  function getPolygonPath(scale: number = 1) {
    return skills
      .map((skill, i) => {
        const point = getPoint(i, (skill.level / 100) * levels * scale);
        return `${point.x},${point.y}`;
      })
      .join(' ');
  }

  return (
    <div className="w-full max-w-md mx-auto flex flex-col items-center">
      <svg
        className="w-full h-auto"
        viewBox={`0 0 ${size} ${size}`}
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <filter id="radar-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <radialGradient id="radar-fill" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.25" />
            <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0.05" />
          </radialGradient>
        </defs>

        {/* Background circles */}
        {Array.from({ length: levels }).map((_, i) => (
          <circle
            key={i}
            cx={center}
            cy={center}
            r={(radius * (i + 1)) / levels}
            fill="none"
            stroke="var(--color-border)"
            strokeWidth="1"
            opacity="0.4"
            strokeDasharray={i === levels - 1 ? "none" : "2 4"}
          />
        ))}

        {/* Axis lines */}
        {skills.map((_, i) => {
          const point = getPoint(i, levels);
          return (
            <line
              key={i}
              x1={center}
              y1={center}
              x2={point.x}
              y2={point.y}
              stroke="var(--color-border)"
              strokeWidth="1"
              opacity="0.3"
            />
          );
        })}

        {/* Data polygon with glow */}
        <polygon
          points={getPolygonPath(1)}
          fill="url(#radar-fill)"
          stroke="var(--color-accent)"
          strokeWidth="2"
          filter="url(#radar-glow)"
          style={{ transition: 'all 0.8s ease-out' }}
        />

        {/* Data points */}
        {skills.map((skill, i) => {
          const point = getPoint(i, (skill.level / 100) * levels);
          const isHovered = hoveredSkill === i;
          return (
            <g key={i}>
              {/* Outer glow */}
              {isHovered && (
                <circle
                  cx={point.x} cy={point.y} r="10"
                  fill="var(--color-accent)" opacity="0.15"
                />
              )}
              <circle
                cx={point.x} cy={point.y}
                r={isHovered ? 6 : 4}
                fill="var(--color-accent)"
                filter="url(#radar-glow)"
                style={{ transition: 'all 0.3s ease', cursor: 'pointer' }}
                onMouseEnter={() => setHoveredSkill(i)}
                onMouseLeave={() => setHoveredSkill(null)}
              />
              <circle
                cx={point.x} cy={point.y}
                r={isHovered ? 2.5 : 1.5}
                fill="#ffffff" opacity="0.8"
              />
            </g>
          );
        })}

        {/* Labels */}
        {skills.map((skill, i) => {
          const point = getPoint(i, levels + 1.3);
          const label = lang === 'zh' ? skill.name : skill.nameEn;
          return (
            <text
              key={i}
              x={point.x}
              y={point.y}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize="11"
              fontFamily="'JetBrains Mono', monospace"
              fill={hoveredSkill === i ? 'var(--color-accent)' : 'var(--color-text-secondary)'}
              style={{ transition: 'fill 0.3s ease' }}
            >
              {label}
            </text>
          );
        })}
      </svg>

      {/* Hover tooltip */}
      {hoveredSkill !== null && (
        <div className="mt-4 px-4 py-2 font-mono text-sm"
             style={{
               background: 'var(--color-card)',
               border: '1px solid var(--color-accent)',
               borderRadius: 'var(--radius)',
               boxShadow: '0 0 15px rgba(0, 229, 255, 0.15)',
             }}>
          <span className="text-[var(--color-text)]">
            {lang === 'zh' ? skills[hoveredSkill].name : skills[hoveredSkill].nameEn}
          </span>
          <span className="ml-3 text-[var(--color-accent)]">
            {skills[hoveredSkill].level}%
          </span>
        </div>
      )}
    </div>
  );
}
