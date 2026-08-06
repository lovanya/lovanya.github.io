import { useCallback, useEffect, useRef, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { askGemini, buildPrompt, detectPageLangFromDocument, type Lang } from '../../lib/ai';
import { injectFollowupButtons } from '../../lib/parse-followup';

/**
 * AI 内嵌线程
 * - 纯展示组件：接收 question + storageKey + lang，负责该线程的所有 UI 与状态
 * - 由 AIThreads 编排器挂载到对应按钮的下一个兄弟节点
 * - localStorage 持久化对话内容
 * - 追问 = 在 turns 数组追加新 turn，不清空原内容
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

// SVG icons (不依赖 emoji 字体)
const IconChevron = ({ open }: { open: boolean }) => (
  <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ transform: open ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.15s' }}>
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

const IconRefresh = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <path d="M3 3v5h5" />
    <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
    <path d="M16 16h5v5" />
  </svg>
);

const IconTrash = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 6h18" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
    <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    <line x1="10" y1="11" x2="10" y2="17" />
    <line x1="14" y1="11" x2="14" y2="17" />
  </svg>
);

// ============ MarkdownBody ============
// 渲染 markdown 为 HTML，并在 marked 之前注入追问按钮 HTML
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
      // 关键顺序：先注入按钮 HTML → 再过 marked（marked 会保留 inline HTML）
      setHtml(fn(injectFollowupButtons(text)));
      setLoaded(true);
    });
    return () => { cancelled = true; };
  }, [text]);

  if (!loaded) return <div className="md-fallback">{text}</div>;

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

// ============ AIThread (单个线程) ============
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

  // localStorage 读取
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

  // localStorage 写入
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

  // 自动开始首次提问
  useEffect(() => {
    if (!hydrated || !expanded) return;
    if (turns.length === 0) startTurn(question);
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

  // 卸载时 abort
  useEffect(() => () => abortRef.current?.abort(), []);

  // 重新生成最后一条
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

  // 清空全部
  const handleClear = useCallback(() => {
    abortRef.current?.abort();
    setTurns([]);
  }, []);

  // 追问：追加新 turn
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
                  <span className="ai-typing"><span /><span /><span /></span>
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

// ============ AIThreads (编排器) ============
// 单 React 根实例化：扫描页面上所有 .ai-ask-btn 按钮，
// 点击后在该按钮所在 <p> 后插入 host div 并挂载 AIThread。
export default function AIThreads() {
  useEffect(() => {
    const findOrCreateHost = (btn: HTMLElement): HTMLElement | null => {
      const question = btn.getAttribute('data-ai-payload') || '';
      if (!question) return null;
      const hostId = 'ai-thread-host-' + hashStr(question);

      const insertAfter = btn.parentElement;
      if (!insertAfter) return null;

      // 复用已存在的 host（避免重复插入）
      let next = insertAfter.nextElementSibling;
      while (next) {
        if (next.classList?.contains('ai-thread-host') && (next as HTMLElement).dataset.aiId === hostId) {
          return next as HTMLElement;
        }
        next = next.nextElementSibling;
      }

      const container = insertAfter.parentElement;
      if (!container) return null;
      const host = document.createElement('div');
      host.className = 'ai-thread-host';
      host.dataset.aiId = hostId;
      container.insertBefore(host, insertAfter.nextSibling);
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
      root.render(<AIThread question={question} storageKey={storageKey} lang={lang} />);
    };

    const handleClick = (e: Event) => {
      const target = e.target as HTMLElement;
      if (!target?.closest) return;
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

    // 自动挂载有历史的线程（折叠态）
    // 让用户刷新页面后能直接看到"之前问过"的折叠提示，而不是再点一次机器人
    const tryAutoMount = (btn: HTMLElement) => {
      const question = btn.getAttribute('data-ai-payload') || '';
      if (!question) return;
      const storageKey = `lovanya-ai-thread:${hashStr(question)}`;
      let data: { turns?: unknown[]; expanded?: boolean } | null = null;
      try {
        const raw = localStorage.getItem(storageKey);
        if (raw) data = JSON.parse(raw);
      } catch {}
      if (!data || !Array.isArray(data.turns) || data.turns.length === 0) return;
      const host = findOrCreateHost(btn);
      if (!host) return;
      mount(host, question);
    };
    document.querySelectorAll('.ai-ask-btn[data-ai-template][data-ai-payload]').forEach((btn) => {
      tryAutoMount(btn as HTMLElement);
    });

    const observer = new MutationObserver(() => bindButtons());
    observer.observe(document.body, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, []);

  return null;
}