import { useState } from 'react';
import './ProjectCard.css';

interface Project {
  name: string;
  nameEn: string;
  role: string;
  roleEn: string;
  period: string;
  stack: string[];
  description: string;
  descriptionEn: string;
  highlights: string[];
  highlightsEn: string[];
}

interface ProjectCardProps {
  projects: Project[];
  lang: 'zh' | 'en';
}

export default function ProjectCard({ projects, lang }: ProjectCardProps) {
  const [flippedIndex, setFlippedIndex] = useState<number | null>(null);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 w-full" style={{ gap: 'var(--space-6)' }}>
      {projects.map((project, index) => {
        const isFlipped = flippedIndex === index;

        return (
          <div
            key={index}
            className="project-card-container"
            onClick={() => setFlippedIndex(isFlipped ? null : index)}
          >
            <div className={`project-card-inner ${isFlipped ? 'flipped' : ''}`}>
              {/* Front */}
              <div className="project-card-face project-card-front" style={{ padding: 'var(--card-padding)' }}>
                <div className="flex items-center justify-between" style={{ marginBottom: 'var(--space-2)' }}>
                  <span className="text-xs text-[var(--color-accent)] font-mono opacity-70">[{project.period}]</span>
                  <span className="text-xs text-[var(--color-text-secondary)] font-mono opacity-50">{lang === 'zh' ? '点击翻转' : 'Click to flip'}</span>
                </div>
                <h3 className="text-base font-bold text-[var(--color-text)] leading-snug" style={{ marginBottom: 'var(--space-1)' }}>
                  {lang === 'zh' ? project.name : project.nameEn}
                </h3>
                <p className="text-xs text-[var(--color-accent)] font-mono" style={{ marginBottom: 'var(--space-3)' }}>
                  {'> '}{lang === 'zh' ? project.role : project.roleEn}
                </p>
                <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed flex-1">
                  {lang === 'zh' ? project.description : project.descriptionEn}
                </p>
                <div
                  className="flex flex-wrap border-t border-[var(--color-border)]"
                  style={{ gap: 'var(--space-2)', paddingTop: 'var(--space-3)', marginTop: 'var(--space-3)' }}
                >
                  {project.stack.slice(0, 4).map((tech, i) => (
                    <span key={i} className="tag text-xs">{tech}</span>
                  ))}
                  {project.stack.length > 4 && (
                    <span className="tag text-xs opacity-50">+{project.stack.length - 4}</span>
                  )}
                </div>
              </div>

              {/* Back */}
              <div className="project-card-face project-card-back" style={{ padding: 'var(--card-padding)' }}>
                <div className="flex items-center justify-between" style={{ marginBottom: 'var(--space-3)' }}>
                  <h4 className="text-sm font-bold text-[var(--color-accent)] font-mono">
                    {lang === 'zh' ? '项目亮点' : 'Key Highlights'}
                  </h4>
                  <span className="text-xs text-[var(--color-text-secondary)] font-mono opacity-50">{lang === 'zh' ? '← 返回' : '← Back'}</span>
                </div>
                <ul className="flex-1" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                  {(lang === 'zh' ? project.highlights : project.highlightsEn).map((highlight, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-[var(--color-text-secondary)] leading-relaxed">
                      <span className="text-[var(--color-neon)] shrink-0" style={{ marginTop: '0.125rem' }}>▸</span>
                      <span>{highlight}</span>
                    </li>
                  ))}
                </ul>
                <div
                  className="flex flex-wrap border-t border-[var(--color-border)]"
                  style={{ gap: 'var(--space-2)', paddingTop: 'var(--space-3)', marginTop: 'var(--space-3)' }}
                >
                  {project.stack.map((tech, i) => (
                    <span key={i} className="tag text-xs">{tech}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
