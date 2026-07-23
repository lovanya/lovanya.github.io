import { useCallback, useEffect, useRef, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { askGemini, buildPrompt, detectPageLangFromDocument, type Lang } from '../../lib/ai';

/**
 * AI 线程管理器（单一 React 根）：
 * - 扫描页面上所有 .ai-ask-btn 按钮
 * - 在按钮所属 blockquote 后插入 host div
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
      const fn = (s: string) => m.parse(s, { async: false }) as string;
      setHtml(fn(injectFollowupButtons(text)));
      setLoaded(true);
    });
    return () => { cancelled = true; };
  }, [text]);

  if (!loaded) {
    return <div className="md-fallback">{injectFollowupButtons(text)}</div>;
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

function AIThread({ question, storageKey, lang }: AIThreadProps) {
  const t = lang === 'zh';
  const [expanded, setExpanded] = useState(true);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // 读 localStorage
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

  // 写回
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

  // 自动首次提问
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
          prev.map((t, i) => (i === prev.length - 1 ? { ...t, answer: text, loading: true } : t))
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
          <span className="ai-thread-icon">{expanded ? '▼' : '▶'}</span>
          <span className="ai-thread-title">{t ? '🎯 AI 解析' : '🎯 AI Analysis'}</span>
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
            >
              🔄
            </button>
            <button
              type="button"
              className="ai-thread-btn ai-thread-btn-danger"
              onClick={handleClear}
              title={t ? '清空所有回答' : 'Clear all'}
            >
              🗑
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
            <div className="ai-turn-empty">{t ? '点击 🔄 开始提问' : 'Click 🔄 to start'}</div>
          )}
        </div>
      )}
    </div>
  );
}

export default function AIThreads() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rootsRef = useRef<Map<string, Root>>(new Map());

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;

    const findOrCreateHost = (btn: HTMLElement): HTMLElement | null => {
      const blockquote = btn.closest('blockquote');
      const parent = blockquote?.parentElement;
      if (!parent) return null;
      const question = btn.dataset.aiPayload || '';
      if (!question) return null;
      const hostId = 'ai-thread-host-' + hashStr(question);
      let host = parent.querySelector(`:scope > .ai-thread-host[data-ai-id="${hostId}"]`) as HTMLElement | null;
      if (!host) {
        host = document.createElement('div');
        host.className = 'ai-thread-host';
        host.dataset.aiId = hostId;
        if (blockquote?.nextSibling) {
          parent.insertBefore(host, blockquote.nextSibling);
        } else {
          parent.appendChild(host);
        }
      }
      return host;
    };

    const mount = (host: HTMLElement, question: string) => {
      const lang = detectPageLangFromDocument();
      const storageKey = `lovanya-ai-thread:${hashStr(question)}`;
      let root = rootsRef.current.get(host.dataset.aiId || '');
      if (!root) {
        root = createRoot(host);
        rootsRef.current.set(host.dataset.aiId || '', root);
      }
      root.render(<AIThread question={question} storageKey={storageKey} lang={lang} />);
    };

    const handleClick = (e: Event) => {
      const btn = (e.target as HTMLElement).closest('.ai-ask-btn');
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
        if ((btn as HTMLElement).dataset.bound === '1') return;
        (btn as HTMLElement).dataset.bound = '1';
        btn.addEventListener('click', handleClick);
      });
    };

    bindButtons();

    // 页面内容动态变化时重新绑定
    const observer = new MutationObserver(() => bindButtons());
    observer.observe(document.body, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, []);

  return <div ref={containerRef} style={{ display: 'none' }} aria-hidden="true" />;
}