import { useCallback, useEffect, useRef, useState } from 'react';
import { askGemini, buildPrompt, detectPageLangFromDocument, type Lang, type TemplateId } from '../../lib/ai';

export { dispatchAiOpen } from '../../lib/ai';

/**
 * 实际导出的 helper，保持向后兼容（在 lib/ai.ts 也导出了）。
 * 这里再导出一次让调用点更短。
 */
export { buildPrompt } from '../../lib/ai';
export type { TemplateId, Lang } from '../../lib/ai';

// marked 异步加载（不影响首屏），用 ref 缓存以避免每次重渲染重 import
type MarkedFn = (src: string) => string;
const markedPromise: Promise<MarkedFn> = import('marked').then((mod) => {
  const m = mod.marked;
  m.setOptions({ gfm: true, breaks: true });
  return ((src: string) => m.parse(src, { async: false }) as string);
});
let markedCache: MarkedFn | null = null;
markedPromise.then((fn) => { markedCache = fn; });

// 把 AI 输出里的追问行替换成可点击按钮
// 支持两类格式：
// 1) 带数字前缀：**问题 1**: text / 追问1: text / 问题 N: text
// 2) 无前缀（在 "延伸追问：" 段内）：**如何处理模块间的数据共享？**
function injectFollowupButtons(text: string): string {
  const escape = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  // 格式 1：数字前缀
  let result = text.replace(
    /((?:\*\*)?(?:问题|追问)\s*(\d+)(?:\*\*)?\s*[:：]\s*)([^\n]+)/g,
    (_, prefix, num, question) => {
      const safe = escape(question);
      return `${prefix}<button type="button" class="ai-followup-btn" data-fuq-num="${num}" data-fuq-q="${safe}">${safe}</button>`;
    }
  );

  // 格式 2：定位 "延伸追问：" 段，把该段内每行结尾为 ？/? 的行变按钮
  const headerRe = /(延伸追问[：:][^\n]*\n+)/;
  const headerMatch = result.match(headerRe);
  if (!headerMatch || headerMatch.index === undefined) return result;
  const headerIdx = headerMatch.index + headerMatch[0].length;
  const afterHeader = result.substring(headerIdx);
  // 段尾：下一个二级标题（## xxx）或文末
  const nextH2 = afterHeader.search(/\n##\s+/);
  const sectionEnd = nextH2 === -1 ? result.length : headerIdx + nextH2;
  const before = result.substring(0, headerIdx);
  const section = result.substring(headerIdx, sectionEnd);
  const after = result.substring(sectionEnd);

  const processed = section.replace(
    /^(\s*)(\*\*?)([^\n]+?[？?])(\*\*?)(\s*)$/gm,
    (line, indent, bOpen, question, bClose, tail) => {
      const trimmed = question.trim();
      if (!trimmed) return line;
      // 跳过思路提示行
      if (/^(思路|提示|参考|补充|备注|说明)[：:]/.test(trimmed)) return line;
      const safe = escape(trimmed);
      return `${indent}<button type="button" class="ai-followup-btn" data-fuq-q="${safe}"><strong>${safe}</strong></button>${tail}`;
    }
  );

  return before + processed + after;
}

interface OpenDetail {
  template: TemplateId;
  payload: string;
  anchor?: { x: number; y: number };
  /** 翻译指定目标语言（默认翻成页面反方向） */
  targetLang?: 'zh' | 'en';
}

interface ResponseState {
  loading: boolean;
  text: string;
  error: string | null;
}

const TEMPLATE_LABELS_ZH: Record<TemplateId, string> = {
  explain: '💡 解释',
  translate: '🌐 翻译',
  summarize: '📋 总结',
  codeExplain: '💻 代码解读',
  interview: '🎯 面试题解答',
  mermaidExplain: '📊 图表解析',
};

const TEMPLATE_LABELS_EN: Record<TemplateId, string> = {
  explain: '💡 Explain',
  translate: '🌐 Translate',
  summarize: '📋 Summarize',
  codeExplain: '💻 Code Analysis',
  interview: '🎯 Interview Answer',
  mermaidExplain: '📊 Diagram Analysis',
};

export default function AIPanel() {
  const [open, setOpen] = useState(false);
  const [template, setTemplate] = useState<TemplateId>('explain');
  const [payload, setPayload] = useState('');
  const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null);
  const [lang, setLang] = useState<Lang>('zh');
  const [response, setResponse] = useState<ResponseState>({ loading: false, text: '', error: null });
  const panelRef = useRef<HTMLDivElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [copied, setCopied] = useState(false);

  // 监听全局 ai:open 事件
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<OpenDetail>).detail;
      if (!detail) return;
      const pageLang = detectPageLangFromDocument();
      setLang(pageLang);
      setTemplate(detail.template);
      setPayload(detail.payload);
      setAnchor(detail.anchor || null);
      setResponse({ loading: false, text: '', error: null });
      setOpen(true);
      setCopied(false);
    };
    window.addEventListener('ai:open', handler as EventListener);
    return () => window.removeEventListener('ai:open', handler as EventListener);
  }, []);

  // 打开后计算位置 + 发起请求
  useEffect(() => {
    if (!open) return;

    // 计算 anchor 位置（viewport 坐标，因为 Panel 用 position: fixed）
    const BOTTOM_MARGIN = 24; // 面板底部距 viewport 底的最小间距
    let top = window.innerHeight * 0.15;
    let left = window.innerWidth / 2 - 360;
    if (anchor) {
      // anchor.y 已经含 scrollY（document 坐标），先转 viewport 坐标
      const viewportY = anchor.y - window.scrollY;
      const idealHeight = Math.min(window.innerHeight * 0.7, window.innerHeight - BOTTOM_MARGIN * 2);
      const panelHeight = 420;
      // 优先放到 anchor 下方
      let belowTop = viewportY + 12;
      // 放不下就放上方
      const aboveTop = viewportY - panelHeight - 12;
      if (belowTop + panelHeight < window.innerHeight - BOTTOM_MARGIN) {
        top = belowTop;
      } else if (aboveTop > 0) {
        top = aboveTop;
      } else {
        // 都放不下就用屏幕中央偏下
        top = window.innerHeight * 0.15;
      }
      // 终极夹紧：保证面板底部留 BOTTOM_MARGIN 距离
      const maxAllowedTop = Math.max(16, window.innerHeight - idealHeight - BOTTOM_MARGIN);
      top = Math.min(top, maxAllowedTop);
      // 横向：根据 anchor.x 居中放置（夹紧到屏幕内）
      const idealLeft = anchor.x - 180;
      const minLeft = 16;
      const maxLeft = window.innerWidth - 720 - 16;
      left = Math.max(minLeft, Math.min(idealLeft, maxLeft));
    }
    setPos({ top, left });

    // 发起 AI 请求
    const ac = new AbortController();
    abortRef.current?.abort();
    abortRef.current = ac;

    const prompt = buildPrompt({
      template,
      payload,
      lang,
      targetLang: lang === 'zh' ? 'en' : 'zh',
    });

    setResponse({ loading: true, text: '', error: null });

    // 用 ref 持有最新的 setter,避免 useEffect 依赖变化导致早期 abort
    const isClosed = { current: false };

    askGemini({
      prompt,
      lang,
      signal: ac.signal,
      onChunk: (text) => {
        if (isClosed.current) return;
        setResponse({ loading: true, text, error: null });
      },
    }).then((res) => {
      if (isClosed.current) return;
      if (res.ok) {
        setResponse({ loading: false, text: res.text, error: null });
      } else {
        setResponse({ loading: false, text: '', error: res.error || 'unknown' });
      }
    }).catch(() => {
      if (isClosed.current) return;
      setResponse({ loading: false, text: '', error: 'unknown' });
    });

    return () => {
      isClosed.current = true;
      ac.abort();
    };
  }, [open, template, payload, anchor, lang]);

  // 点击面板外或按 ESC 关闭
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const onClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        // 点击页面其他位置 → 关闭
        setOpen(false);
      }
    };
    document.addEventListener('keydown', onKey);
    // 用 setTimeout 避免点击触发器本身时立即关闭
    const t = setTimeout(() => document.addEventListener('mousedown', onClickOutside), 0);
    return () => {
      document.removeEventListener('keydown', onKey);
      clearTimeout(t);
      document.removeEventListener('mousedown', onClickOutside);
    };
  }, [open]);

  const handleCopy = useCallback(() => {
    if (!response.text) return;
    navigator.clipboard?.writeText(response.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [response.text]);

  const handleRetry = useCallback(() => {
    if (!payload) return;
    // 重新触发
    setOpen(false);
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('ai:open', { detail: { template, payload, anchor: anchor || undefined } }));
    }, 50);
  }, [template, payload, anchor]);

  // 追问：用追问问题作为新 payload 重新发起
  const handleFollowup = useCallback((question: string) => {
    if (!question) return;
    setOpen(false);
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('ai:open', {
        detail: {
          template: 'interview' as TemplateId,
          payload: question,
          anchor: anchor || undefined,
        },
      }));
    }, 50);
  }, [anchor]);

  if (!open || !pos) return null;

  const labels = lang === 'zh' ? TEMPLATE_LABELS_ZH : TEMPLATE_LABELS_EN;

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-label={labels[template]}
      style={{
        position: 'fixed',
        top: `${pos.top}px`,
        left: `${Math.max(16, Math.min(pos.left, typeof window !== 'undefined' ? window.innerWidth - 740 : pos.left))}px`,
        width: '720px',
        maxWidth: 'calc(100vw - 32px)',
        maxHeight: '70vh',
        zIndex: 9997,
        background: 'var(--color-bg-secondary)',
        border: '1px solid var(--color-accent)',
        borderRadius: '12px',
        boxShadow: '0 16px 48px rgba(0,0,0,0.45), 0 0 0 1px rgba(0, 229, 255, 0.15)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        color: 'var(--color-text)',
        fontFamily: 'JetBrains Mono, ui-monospace, monospace',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.6rem 1rem',
          borderBottom: '1px solid var(--color-border)',
          background: 'var(--color-bg)',
        }}
      >
        <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{labels[template]}</span>
        <span
          style={{
            marginLeft: 'auto',
            fontSize: '0.65rem',
            color: 'var(--color-neon)',
            background: 'var(--color-neon-dim)',
            padding: '0.15rem 0.45rem',
            borderRadius: '4px',
          }}
        >
          GLM-4-Flash
        </span>
        <button
          onClick={() => setOpen(false)}
          aria-label={lang === 'zh' ? '关闭' : 'Close'}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--color-text-secondary)',
            cursor: 'pointer',
            fontSize: '1.2rem',
            lineHeight: 1,
            padding: '0 0.4rem',
          }}
        >
          ✕
        </button>
      </div>

      {/* Payload preview */}
      {payload && (
        <details
          style={{
            padding: '0.5rem 1rem',
            borderBottom: '1px solid var(--color-border)',
            fontSize: '0.78rem',
            color: 'var(--color-text-secondary)',
          }}
        >
          <summary style={{ cursor: 'pointer', listStyle: 'none', userSelect: 'none' }}>
            {lang === 'zh' ? '📎 原文（点击展开）' : '📎 Source text (click to expand)'}
          </summary>
          <pre
            style={{
              marginTop: '0.5rem',
              padding: '0.5rem',
              background: 'var(--color-code-bg)',
              borderRadius: '6px',
              maxHeight: '120px',
              overflow: 'auto',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              fontSize: '0.75rem',
              lineHeight: 1.5,
            }}
          >
            {payload}
          </pre>
        </details>
      )}

      {/* Response */}
      <div
        className="ai-response"
        style={{
          flex: 1,
          overflow: 'auto',
          padding: '0.85rem 1rem',
          fontSize: '0.85rem',
          lineHeight: 1.65,
        }}
      >
        {response.loading && !response.text && (
          <div style={{ display: 'flex', gap: '6px', padding: '0.5rem 0' }}>
            <Dot delay={0} />
            <Dot delay={0.15} />
            <Dot delay={0.3} />
          </div>
        )}
        {response.loading && response.text && (
          <MarkdownView text={response.text} onFollowup={handleFollowup} />
        )}
        {!response.loading && response.error && (
          <div style={{ color: 'var(--color-text-secondary)' }}>{response.error}</div>
        )}
        {!response.loading && !response.error && response.text && (
          <MarkdownView text={response.text} onFollowup={handleFollowup} />
        )}
        {response.loading && response.text && <Cursor />}
      </div>

      {/* Footer actions */}
      <div
        style={{
          display: 'flex',
          gap: '0.5rem',
          padding: '0.5rem 0.85rem',
          borderTop: '1px solid var(--color-border)',
          background: 'var(--color-bg)',
        }}
      >
        <button
          onClick={handleCopy}
          disabled={!response.text}
          style={{
            ...btnStyle,
            opacity: response.text ? 1 : 0.4,
          }}
        >
          {copied ? (lang === 'zh' ? '✓ 已复制' : '✓ Copied') : (lang === 'zh' ? '📋 复制' : '📋 Copy')}
        </button>
        <button
          onClick={handleRetry}
          style={btnStyle}
        >
          {lang === 'zh' ? '🔄 重新生成' : '🔄 Regenerate'}
        </button>
        <span style={{ marginLeft: 'auto', fontSize: '0.7rem', color: 'var(--color-text-secondary)', alignSelf: 'center' }}>
          {lang === 'zh' ? '按 ESC 关闭' : 'ESC to close'}
        </span>
      </div>
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  height: '32px',
  padding: '0 0.75rem',
  borderRadius: '6px',
  border: '1px solid var(--color-accent)',
  background: 'transparent',
  color: 'var(--color-accent)',
  cursor: 'pointer',
  fontSize: '0.8rem',
  fontFamily: 'JetBrains Mono, monospace',
  transition: 'all 0.2s',
};

function Dot({ delay }: { delay: number }) {
  return (
    <span
      style={{
        width: '7px',
        height: '7px',
        borderRadius: '50%',
        background: 'var(--color-accent)',
        animation: 'aipanel-dot 1s infinite',
        animationDelay: `${delay}s`,
        opacity: 0.6,
      }}
    />
  );
}

function MarkdownView({ text, onFollowup }: { text: string; onFollowup: (question: string) => void }) {
  // marked 异步加载阶段 → 回退纯文本（pre-wrap 保持换行）
  if (!markedCache) {
    return <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{injectFollowupButtons(text)}</div>;
  }
  const html = markedCache(injectFollowupButtons(text));
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

function Cursor() {
  return (
    <span
      style={{
        display: 'inline-block',
        width: '6px',
        height: '1em',
        background: 'var(--color-accent)',
        marginLeft: '2px',
        verticalAlign: 'text-bottom',
        animation: 'aipanel-blink 0.8s infinite',
      }}
    />
  );
}
