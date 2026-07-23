import { useCallback, useEffect, useRef, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { askGemini, buildPrompt, detectPageLangFromDocument, type Lang } from '../../lib/ai';

/**
 * AI 线程管理器（单一 React 根）：
 * - 扫描页面上所有 .ai-ask-btn 按钮
 * - 在按钮所在 blockquote 之后插入 host div
 * - 每个 host 独立挂载一个 AIThread
 * - 状态独立、localStorage 持久化
 */

interface Turn {
  question: string;
  answer: string;
  loading: boolean;
  error?: string;
}

function hashStr(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36);
}

// 把 AI 输出里的追问行替换成可点击按钮
function injectFollowupButtons(text: string): string {
  const escape = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  let result = text.replace(
    /((?:\*\*)?(?:问题|追问)\s*(\d+)(?:\*\*)?\s*[:：]\s*)([^\n]+)/g,
    (_, prefix, num, question) => {
      const safe = escape(question);
      return `${prefix}<button type="button" class="ai-followup-btn" data-fuq-q="${safe}">${safe}</button>`;
    }
  );

  const headerRe = /(延伸追问[：:][^\n]*\n+)/;
  const headerMatch = result.match(headerRe);
  if (!headerMatch || headerMatch.index === undefined) return result;
  const headerIdx = headerMatch.index + headerMatch[0].length;
  const afterHeader = result.substring(headerIdx);
  const nextH2 = afterHeader.search(/\n##\s+/);
  const sectionEnd = nextH2 === -1 ? result.length : headerIdx + nextH2;
  const before = result.substring(0, headerIdx);
  const section = result.substring(headerIdx, sectionEnd);
  const after = result.substring(sectionEnd);

  const processed = section.replace(
    /^(\s*(?:[-*]|\d+\.)\s+|\s*)([^\n]+?)\s*$/gm,
    (line, indent, raw) => {
      const cleaned = raw.replace(/\*\*/g, '').trim();
      if (!cleaned) return line;
      if (!/[？?]/.test(cleaned)) return line;
      if (/^(思路|提示|参考|补充|备注|说明|面试官)[：:]/.test(cleaned)) return line;
      const safe = escape(cleaned);
      return `${indent}<button type="button" class="ai-followup-btn" data-fuq-q="${safe}"><strong>${safe}</strong></button>`;
    }
  );

  return before + processed + after;
}

function MarkdownBody({ text, onFollowup }: { text: string; onFollowup: (q: string) => void }) {
  const [html, setHtml] = useState<string>('');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    import('marked').then((mod) => {
      if (cancelled) return;
      const m = mod.marked;
      m.setOptions({ gfm: true, breaks: true });
      // 关键：marked 渲染后再注入 followup 按钮，否则 markdown 语法会破坏按钮
      const fn = (s: string) => m.parse(s, { async: false }) as string;
      setHtml(injectFollowupButtons(fn(text)));
      setLoaded(true);
    });
    return () => { cancelled = true; };
  }, [text]);

  if (!loaded) {
    return <div className="md-fallback">{text}</div>;
  }
  return (
    <div
      className="md-body"
      dangerouslySetInnerHTML={{ __html: html }}
      onClick={(e) => {
        const t = e.target as HTMLElement;
        if (t && t.classList && t.classList.contains('ai-followup-btn')) {
          const q = t.getAttribute('data-fuq-q') || t.textContent || '';
          if (q) onFollowup(q);
        }
      }}
    />
  );
}

interface AIThreadProps {
  question: string;
  storageKey: string;
  lang: Lang;
}

function IconRefresh() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
      <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
      <path d="M16 16h5v5" />
    </svg>
  );
}

function IconTrash() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 6h18" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  );
}

function IconChevron({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ transform: open ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.15s' }}>
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function AIThread({ question, storageKey, lang }: AIThreadProps) {
  const t = lang === 'zh';
  const [expanded, setExpanded] = useState(true);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.turns)) setTurns(parsed.turns);
        if (typeof parsed.expanded === 'boolean') setExpanded(parsed.expanded);
      }
    } catch {}
    setHydrated(true);
  }, [storageKey]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      if (turns.length === 0 && !expanded) {
        localStorage.removeItem(storageKey);
      } else {
        localStorage.setItem(storageKey, JSON.stringify({ turns, expanded }));
      }
    } catch {}
  }, [turns, expanded, storageKey, hydrated]);

  useEffect(() => {
    if (!hydrated || !expanded) return;
    if (turns.length === 0) {
      startTurn(question);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, expanded]);

  const startTurn = useCallback((q: string) => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setTurns((prev) => [...prev, { question: q, answer: '', loading: true }]);

    const prompt = buildPrompt({
      template: 'interview',
      payload: q,
      lang,
      targetLang: lang === 'zh' ? 'en' : 'zh',
    });

    let isClosed = false;
    askGemini({
      prompt,
      lang,
      signal: ac.signal,
      onChunk: (text) => {
        if (isClosed) return;
        setTurns((prev) =>
          prev.map((tt, i) => (i === prev.length - 1 ? { ...tt, answer: text, loading: true } : tt))
        );
      },
    }).then((res) => {
      if (isClosed) return;
      setTurns((prev) =>
        prev.map((tt, i) =>
          i === prev.length - 1
            ? res.ok
              ? { ...tt, answer: res.text, loading: false, error: undefined }
              : { ...tt, answer: '', loading: false, error: res.error || 'unknown' }
            : tt
        )
      );
    }).catch(() => {
      if (isClosed) return;
      setTurns((prev) =>
        prev.map((tt, i) =>
          i === prev.length - 1 ? { ...tt, answer: '', loading: false, error: 'unknown' } : tt
        )
      );
    });
  }, [lang]);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const handleReask = useCallback(() => {
    if (turns.length === 0) {
      startTurn(question);
      return;
    }
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    const lastQ = turns[turns.length - 1].question;
    setTurns((prev) => prev.map((tt, i) =>
      i === prev.length - 1 ? { question: lastQ, answer: '', loading: true } : tt
    ));

    const prompt = buildPrompt({
      template: 'interview',
      payload: lastQ,
      lang,
      targetLang: lang === 'zh' ? 'en' : 'zh',
    });

    let isClosed = false;
    askGemini({
      prompt,
      lang,
      signal: ac.signal,
      onChunk: (text) => {
        if (isClosed) return;
        setTurns((prev) =>
          prev.map((tt, i) => (i === prev.length - 1 ? { ...tt, answer: text, loading: true } : tt))
        );
      },
    }).then((res) => {
      if (isClosed) return;
      setTurns((prev) =>
        prev.map((tt, i) =>
          i === prev.length - 1
            ? res.ok
              ? { ...tt, answer: res.text, loading: false }
              : { ...tt, answer: '', loading: false, error: res.error || 'unknown' }
            : tt
        )
      );
    });
  }, [turns, lang, question]);

  const handleClear = useCallback(() => {
    abortRef.current?.abort();
    setTurns([]);
  }, []);

  const handleFollowup = useCallback((q: string) => {
    if (!q) return;
    startTurn(q);
  }, [startTurn]);

  return (
    <div className={`ai-thread ${expanded ? '' : 'is-collapsed'}`}>
      <div className="ai-thread-head">
        <button
          type="button"
          className="ai-thread-toggle"
          onClick={() => setExpanded((v) => !v)}
          aria-label={expanded ? (t ? '收起' : 'Collapse') : (t ? '展开' : 'Expand')}
        >
          <IconChevron open={expanded} />
          <span className="ai-thread-title">{t ? 'AI 解析' : 'AI Analysis'}</span>
          {turns.length > 0 && <span className="ai-thread-count">{turns.length}</span>}
        </button>
        {expanded && turns.length > 0 && (
          <div className="ai-thread-actions">
            <button
              type="button"
              className="ai-thread-btn"
              onClick={handleReask}
              disabled={turns[turns.length - 1]?.loading}
              title={t ? '重新生成最后一条' : 'Regenerate last'}
              aria-label={t ? '重新生成' : 'Regenerate'}
            >
              <IconRefresh />
            </button>
            <button
              type="button"
              className="ai-thread-btn ai-thread-btn-danger"
              onClick={handleClear}
              title={t ? '清空所有回答' : 'Clear all'}
              aria-label={t ? '清空' : 'Clear'}
            >
              <IconTrash />
            </button>
          </div>
        )}
      </div>

      {expanded && (
        <div className="ai-thread-body">
          {turns.map((turn, idx) => (
            <div key={idx} className="ai-turn">
              <div className="ai-turn-q">
                <span className="ai-turn-tag">Q{idx + 1}</span>
                <span className="ai-turn-q-text">{turn.question}</span>
              </div>
              <div className="ai-turn-a">
                {turn.loading && !turn.answer && (
                  <span className="ai-typing">
                    <span /><span /><span />
                  </span>
                )}
                {turn.error && <span className="ai-turn-error">{turn.error}</span>}
                {turn.answer && (
                  <>
                    <MarkdownBody text={turn.answer} onFollowup={handleFollowup} />
                    {turn.loading && <span className="ai-cursor" />}
                  </>
                )}
              </div>
            </div>
          ))}
          {turns.length === 0 && hydrated && (
            <div className="ai-turn-empty">{t ? '点击 ↻ 重新开始' : 'Click ↻ to start'}</div>
          )}
        </div>
      )}
    </div>
  );
}

export default function AIThreads() {
  useEffect(() => {
    const findOrCreateHost = (btn: HTMLElement): HTMLElement | null => {
      const question = btn.getAttribute('data-ai-payload') || '';
      if (!question) return null;
      const hostId = 'ai-thread-host-' + hashStr(question);

      // MDX 里所有 Q+A 行在同一个 blockquote，所以 closest('blockquote') 不够细。
      // 用 button.parentElement（通常是 <p>），在它后面插入 host——每个 Q 独立。
      const insertAfter = btn.parentElement;
      if (!insertAfter) return null;

      const container = insertAfter.parentElement;
      if (!container) return null;

      // 检查这个按钮的下一个兄弟节点是否已是 host（避免重复）
      let host: HTMLElement | null = null;
      let next = insertAfter.nextElementSibling;
      while (next) {
        if (next.classList?.contains('ai-thread-host') && (next as HTMLElement).dataset.aiId === hostId) {
          host = next as HTMLElement;
          break;
        }
        // 跳过空文本节点，继续找
        next = next.nextElementSibling;
      }

      if (!host) {
        host = document.createElement('div');
        host.className = 'ai-thread-host';
        host.dataset.aiId = hostId;
        container.insertBefore(host, insertAfter.nextSibling);
      }
      return host;
    };

    const rootsMap = new Map<string, Root>();

    const mount = (host: HTMLElement, question: string) => {
      const lang = detectPageLangFromDocument();
      const key = host.dataset.aiId || '';
      const storageKey = `lovanya-ai-thread:${hashStr(question)}`;
      let root = rootsMap.get(key);
      if (!root) {
        root = createRoot(host);
        rootsMap.set(key, root);
      }
      // 动态 import AIThread 组件（已经在 AIThread.tsx 同模块）
      // 这里直接用 window 全局，因为 AIThreads 和 AIThread 在同一个 bundle 里
      root.render(<AIThread question={question} storageKey={storageKey} lang={lang} />);
    };

    const handleClick = (e: Event) => {
      const target = e.target as HTMLElement;
      if (!target || !target.closest) return;
      const btn = target.closest('.ai-ask-btn');
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();
      const host = findOrCreateHost(btn as HTMLElement);
      if (!host) return;
      const question = btn.getAttribute('data-ai-payload') || '';
      if (!question) return;
      mount(host, question);
      setTimeout(() => host.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
    };

    const bindButtons = () => {
      document.querySelectorAll('.ai-ask-btn[data-ai-template][data-ai-payload]').forEach((btn) => {
        const el = btn as HTMLElement;
        if (el.dataset.aiBound === '1') return;
        el.dataset.aiBound = '1';
        el.addEventListener('click', handleClick);
      });
    };

    bindButtons();
    const observer = new MutationObserver(() => bindButtons());
    observer.observe(document.body, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, []);

  return null;
}