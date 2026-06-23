import { useState } from 'react';

interface ExperienceItem {
  company: string;
  companyEn: string;
  role: string;
  roleEn: string;
  period: string;
  highlights: string[];
  highlightsEn: string[];
}

interface TimelineProps {
  experience: ExperienceItem[];
  lang: 'zh' | 'en';
}

export default function Timeline({ experience, lang }: TimelineProps) {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  return (
    <div className="relative w-full max-w-4xl mx-auto">
      {/* Central circuit line — spans the full timeline */}
      <div
        className="absolute left-1/2 -translate-x-1/2 top-0 bottom-0 w-px"
        aria-hidden
      >
        <div
          className="w-full h-full"
          style={{
            background:
              'linear-gradient(to bottom, transparent, var(--color-accent) 8%, var(--color-accent) 92%, transparent)',
            opacity: 0.3,
          }}
        />
        {/* Data-flow pulse on the line */}
        <div
          className="absolute left-0 w-full"
          style={{
            top: 0,
            height: '4rem',
            background:
              'linear-gradient(to bottom, var(--color-accent-glow), transparent)',
            animation: 'tl-pulse 4s ease-in-out infinite',
          }}
        />
      </div>

      <div className="flex flex-col" style={{ gap: 'var(--space-12)' }}>
        {experience.map((exp, idx) => {
          const isLeft = idx % 2 === 0;
          const isExpanded = expandedIdx === idx;
          const name = lang === 'zh' ? exp.company : exp.companyEn;
          const role = lang === 'zh' ? exp.role : exp.roleEn;
          const highlights = lang === 'zh' ? exp.highlights : exp.highlightsEn;

          return (
            <div
              key={idx}
              className={`relative grid items-center ${isLeft ? '' : ''}`}
              style={{
                gridTemplateColumns: '1fr auto 1fr',
                gap: 'var(--space-4)',
              }}
            >
              {/* LEFT: card OR empty spacer */}
              {isLeft ? (
                <div className="flex justify-end">
                  <div style={{ width: '100%', maxWidth: '28rem' }}>
                    <TimelineCard
                      period={exp.period}
                      name={name}
                      role={role}
                      highlights={highlights}
                      isExpanded={isExpanded}
                      isLeft={isLeft}
                      onToggle={() => setExpandedIdx(isExpanded ? null : idx)}
                      lang={lang}
                    />
                  </div>
                </div>
              ) : (
                <div />
              )}

              {/* CENTER: node circle (vertically aligned with card center) */}
              <div className="flex items-center justify-center" style={{ width: '2.5rem', height: '2.5rem' }}>
                <div
                  className="rounded-full border flex items-center justify-center"
                  style={{
                    width: '2rem',
                    height: '2rem',
                    borderColor: 'var(--color-accent-glow)',
                    boxShadow: '0 0 12px var(--color-accent-glow)',
                  }}
                >
                  <div
                    className="rounded-full"
                    style={{
                      width: '0.6rem',
                      height: '0.6rem',
                      background: 'var(--color-accent)',
                      boxShadow: '0 0 8px var(--color-accent)',
                      animation: 'glow-pulse 3s ease-in-out infinite',
                      animationDelay: `${idx * 0.5}s`,
                    }}
                  />
                </div>
              </div>

              {/* RIGHT: card OR empty spacer */}
              {!isLeft ? (
                <div className="flex justify-start">
                  <div style={{ width: '100%', maxWidth: '28rem' }}>
                    <TimelineCard
                      period={exp.period}
                      name={name}
                      role={role}
                      highlights={highlights}
                      isExpanded={isExpanded}
                      isLeft={isLeft}
                      onToggle={() => setExpandedIdx(isExpanded ? null : idx)}
                      lang={lang}
                    />
                  </div>
                </div>
              ) : (
                <div />
              )}
            </div>
          );
        })}
      </div>

      <style>{`
        @keyframes tl-pulse {
          0%, 100% { transform: translateY(0); opacity: 0; }
          50% { transform: translateY(0); opacity: 1; }
        }
        @keyframes glow-pulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}

interface TimelineCardProps {
  period: string;
  name: string;
  role: string;
  highlights: string[];
  isExpanded: boolean;
  isLeft: boolean;
  onToggle: () => void;
  lang: 'zh' | 'en';
}

function TimelineCard({ period, name, role, highlights, isExpanded, isLeft, onToggle, lang }: TimelineCardProps) {
  return (
    <div
      className="card cursor-pointer group"
      style={{
        padding: 'var(--card-padding)',
        textAlign: isLeft ? 'right' : 'left',
      }}
      onClick={onToggle}
    >
      <div
        className="text-xs font-mono mb-2"
        style={{ color: 'var(--color-accent)', opacity: 0.7 }}
      >
        [{period}]
      </div>
      <h3
        className="text-lg font-bold mb-1 transition-colors"
        style={{ color: 'var(--color-text)' }}
        onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--color-accent)')}
        onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--color-text)')}
      >
        {name}
      </h3>
      <p
        className="text-sm font-mono mb-3"
        style={{ color: 'var(--color-text-secondary)' }}
      >
        {role}
      </p>
      <div
        className="text-xs font-mono transition-opacity"
        style={{ color: 'var(--color-accent)', opacity: 0.5 }}
      >
        {isExpanded
          ? (lang === 'zh' ? '[-] 收起' : '[-] Collapse')
          : (lang === 'zh' ? '[+] 展开详情' : '[+] Expand details')}
      </div>
      <div
        className="overflow-hidden transition-all duration-500 ease-out"
        style={{
          maxHeight: isExpanded ? '32rem' : '0',
          opacity: isExpanded ? 1 : 0,
        }}
      >
        <ul
          className="mt-4 space-y-2 text-sm"
          style={{ color: 'var(--color-text-secondary)', textAlign: isLeft ? 'right' : 'left' }}
        >
          {highlights.map((h, i) => (
            <li
              key={i}
              className="flex items-start gap-2"
              style={{ justifyContent: isLeft ? 'flex-end' : 'flex-start' }}
            >
              <span style={{ color: 'var(--color-accent)', opacity: 0.5, flexShrink: 0, marginTop: '0.125rem' }}>▸</span>
              <span>{h}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
