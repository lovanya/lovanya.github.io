import { useState, useRef, useEffect, useCallback } from 'react';

interface Action {
  label: string;
  url: string;
}

interface Message {
  id: string;
  role: 'user' | 'bot';
  text: string;
  actions?: Action[];
}

const NAV_COMMANDS: { keywords: string[]; label: string; url: string }[] = [
  { keywords: ['简历', 'resume', '关于', 'about', '个人'], label: '📄 简历 / Resume', url: '/about' },
  { keywords: ['博客', 'blog', '文章', 'posts', '所有文章'], label: '📝 博客 / Blog', url: '/blog' },
  { keywords: ['首页', 'home', '主页', '主頁'], label: '🏠 首页 / Home', url: '/' },
];

const WELCOME_MSG = `👋 你好！我是站内助手。

你可以：
• 输入关键词搜索博客内容
• 说"简历"跳转到关于页
• 说"博客"查看文章列表
• 直接问我技术问题`;

const WELCOME_MSG_EN = `👋 Hi! I'm your site assistant.

You can:
• Type keywords to search blog posts
• Say "resume" to go to the about page
• Say "blog" to see all posts
• Ask me technical questions`;

const API_KEY = (typeof import.meta !== 'undefined' && import.meta.env?.PUBLIC_GEMINI_API_KEY) || '';
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

function isZh(): boolean {
  if (typeof document === 'undefined') return true;
  return document.documentElement.lang === 'zh' || location.pathname === '/' || !location.pathname.startsWith('/en');
}

let pagefindCache: any = null;

function loadPagefind(): Promise<any> {
  if (pagefindCache) return Promise.resolve(pagefindCache);
  if ((window as any).pagefind) {
    pagefindCache = (window as any).pagefind;
    return Promise.resolve(pagefindCache);
  }
  return new Promise((resolve) => {
    const s = document.createElement('script');
    s.src = '/pagefind/pagefind.js';
    s.onload = () => {
      pagefindCache = (window as any).pagefind;
      resolve(pagefindCache);
    };
    s.onerror = () => resolve(null);
    document.head.appendChild(s);
  });
}

async function searchPagefind(query: string): Promise<Action[]> {
  const pf = await loadPagefind();
  if (!pf) return [];
  const result = await pf.search(query);
  if (!result?.results?.length) return [];
  const items = await Promise.all(result.results.slice(0, 6).map((r: any) => r.data()));
  return items.map((d: any) => ({
    label: d.meta?.title || (isZh() ? '未命名' : 'Untitled'),
    url: d.url,
  }));
}

async function askGemini(prompt: string, lang: 'zh' | 'en'): Promise<string> {
  if (!API_KEY) return '';
  const siteDesc = lang === 'zh'
    ? '林健(紫牙)的前端技术博客，涵盖前端架构、性能优化、AI 工程化。'
    : "Jian Lin (Ziya)'s frontend tech blog covering architecture, performance, and AI engineering.";
  try {
    const res = await fetch(`${GEMINI_URL}?key=${API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `You are a helpful assistant for a tech blog. ${siteDesc}
Answer concisely in ${lang === 'zh' ? 'Chinese' : 'English'}. If the question is about the blog, suggest searching or navigating.
User: ${prompt}`,
          }],
        }],
      }),
    });
    const data = await res.json();
    return data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  } catch {
    return '';
  }
}

function matchNav(text: string): Action | null {
  const lower = text.toLowerCase().trim();
  for (const cmd of NAV_COMMANDS) {
    if (cmd.keywords.some(k => lower === k || lower.includes(k))) {
      return { label: cmd.label, url: cmd.url };
    }
  }
  return null;
}

function genId() { return Math.random().toString(36).slice(2, 10); }

export default function ChatBot() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [hasAi, setHasAi] = useState(!!API_KEY);
  const msgsRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const lang = isZh() ? 'zh' : 'en';

  const addBotMsg = useCallback((text: string, actions?: Action[]) => {
    setMessages(prev => [...prev, { id: genId(), role: 'bot', text, actions }]);
  }, []);

  const addUserMsg = useCallback((text: string) => {
    setMessages(prev => [...prev, { id: genId(), role: 'user', text }]);
  }, []);

  useEffect(() => {
    if (!open || messages.length) return;
    addBotMsg(lang === 'zh' ? WELCOME_MSG : WELCOME_MSG_EN);
    setHasAi(!!API_KEY);
  }, [open]);

  useEffect(() => {
    msgsRef.current?.scrollTo({ top: msgsRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    addUserMsg(text);
    setLoading(true);

    const nav = matchNav(text);
    if (nav) {
      addBotMsg(lang === 'zh' ? '跳转到：' : 'Navigate to:', [nav]);
      setLoading(false);
      return;
    }

    const results = await searchPagefind(text);

    if (results.length) {
      addBotMsg(
        lang === 'zh' ? `找到 ${results.length} 个相关结果：` : `Found ${results.length} results:`,
        results,
      );
    } else {
      addBotMsg(lang === 'zh' ? '没搜到相关内容。' : 'No relevant content found.');
    }

    if (hasAi) {
      const aiReply = await askGemini(text, lang);
      if (aiReply) addBotMsg(aiReply);
    }

    setLoading(false);
  }, [input, loading, addBotMsg, addUserMsg, lang, hasAi]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const s: { [key: string]: React.CSSProperties } = {
    fab: {
      position: 'fixed',
      bottom: '1.5rem',
      right: '1.5rem',
      width: '3.5rem',
      height: '3.5rem',
      borderRadius: '50%',
      border: '2px solid var(--color-accent)',
      background: 'var(--color-bg-secondary)',
      color: 'var(--color-accent)',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      boxShadow: '0 0 20px var(--color-accent-glow)',
      transition: 'all 0.3s ease',
    },
    panel: {
      position: 'fixed',
      bottom: '5.5rem',
      right: '1.5rem',
      width: '360px',
      maxWidth: 'calc(100vw - 2rem)',
      height: '520px',
      maxHeight: 'calc(100vh - 8rem)',
      background: 'var(--color-bg-secondary)',
      border: '1px solid var(--color-border)',
      borderRadius: '12px',
      display: 'flex',
      flexDirection: 'column',
      zIndex: 9998,
      boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
      overflow: 'hidden',
    },
    header: {
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem',
      padding: '0.75rem 1rem',
      borderBottom: '1px solid var(--color-border)',
      background: 'var(--color-bg)',
    },
    msgs: {
      flex: 1,
      overflowY: 'auto',
      padding: '0.75rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.5rem',
    },
    msg: (role: 'user' | 'bot') => ({
      maxWidth: '85%',
      padding: '0.5rem 0.75rem',
      borderRadius: role === 'user' ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
      background: role === 'user' ? 'var(--color-accent-dim)' : 'var(--color-card)',
      color: 'var(--color-text)',
      fontSize: '0.875rem',
      lineHeight: 1.5,
      whiteSpace: 'pre-wrap',
      alignSelf: role === 'user' ? 'flex-end' : 'flex-start',
    }),
    actions: {
      display: 'flex',
      flexDirection: 'column',
      gap: '0.375rem',
      marginTop: '0.5rem',
    },
    actionBtn: {
      padding: '0.375rem 0.75rem',
      borderRadius: '6px',
      border: '1px solid var(--color-accent)',
      background: 'transparent',
      color: 'var(--color-accent)',
      cursor: 'pointer',
      fontSize: '0.8rem',
      textAlign: 'left',
      transition: 'all 0.2s',
    },
    inputArea: {
      display: 'flex',
      gap: '0.5rem',
      padding: '0.75rem',
      borderTop: '1px solid var(--color-border)',
    },
    inputField: {
      flex: 1,
      padding: '0.5rem 0.75rem',
      borderRadius: '8px',
      border: '1px solid var(--color-border)',
      background: 'var(--color-bg)',
      color: 'var(--color-text)',
      fontSize: '0.875rem',
      outline: 'none',
    },
    sendBtn: {
      padding: '0.5rem 1rem',
      borderRadius: '8px',
      border: 'none',
      background: 'var(--color-accent)',
      color: 'var(--color-bg)',
      cursor: 'pointer',
      fontSize: '0.875rem',
      fontWeight: 600,
      opacity: loading ? 0.5 : 1,
    },
    loader: {
      display: 'flex',
      gap: '4px',
      padding: '0.5rem 0.75rem',
      alignSelf: 'flex-start',
    },
    dot: {
      width: '6px',
      height: '6px',
      borderRadius: '50%',
      background: 'var(--color-accent)',
      animation: 'chatbot-bounce 1s infinite',
    },
  };

  return (
    <>
      <button
        style={s.fab}
        onClick={() => setOpen(v => !v)}
        aria-label={lang === 'zh' ? '打开助手' : 'Open assistant'}
        onMouseEnter={e => {
          (e.currentTarget as HTMLElement).style.transform = 'scale(1.1)';
          (e.currentTarget as HTMLElement).style.boxShadow = '0 0 30px var(--color-accent-glow)';
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
          (e.currentTarget as HTMLElement).style.boxShadow = '0 0 20px var(--color-accent-glow)';
        }}
      >
        <svg viewBox="0 0 100 100" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="2.5">
          <line x1="50" y1="12" x2="50" y2="26" strokeLinecap="round" />
          <circle cx="50" cy="9" r="5" fill="var(--color-accent)" stroke="none" />
          <rect x="16" y="26" width="68" height="54" rx="14" fill="var(--color-bg)" stroke="currentColor" />
          <circle cx="36" cy="48" r="6" fill="var(--color-accent)" stroke="none" />
          <circle cx="64" cy="48" r="6" fill="var(--color-accent)" stroke="none" />
          <path d="M 30 66 Q 50 76 70 66" strokeLinecap="round" fill="none" />
        </svg>
      </button>

      {open && (
        <div style={s.panel}>
          <div style={s.header}>
            <svg viewBox="0 0 100 100" width="24" height="24" fill="none" stroke="var(--color-accent)" strokeWidth="2.5">
              <rect x="20" y="24" width="60" height="48" rx="10" fill="var(--color-accent-dim)" stroke="currentColor" />
              <circle cx="36" cy="44" r="5" fill="var(--color-accent)" stroke="none" />
              <circle cx="64" cy="44" r="5" fill="var(--color-accent)" stroke="none" />
              <path d="M 32 60 Q 50 68 68 60" strokeLinecap="round" fill="none" />
            </svg>
            <span style={{ flex: 1, fontWeight: 600, fontSize: '0.9rem', color: 'var(--color-text)' }}>
              {lang === 'zh' ? '🤖 站内助手' : '🤖 Site Assistant'}
            </span>
            {hasAi && <span style={{ fontSize: '0.65rem', color: 'var(--color-neon)', background: 'var(--color-neon-dim)', padding: '0.15rem 0.4rem', borderRadius: '4px' }}>AI</span>}
            <button
              onClick={() => setOpen(false)}
              style={{ background: 'none', border: 'none', color: 'var(--color-text-secondary)', cursor: 'pointer', fontSize: '1.2rem', lineHeight: 1 }}
            >
              ✕
            </button>
          </div>

          <div ref={msgsRef} style={s.msgs}>
            {messages.map(m => (
              <div key={m.id}>
                <div style={s.msg(m.role)}>{m.text}</div>
                {m.actions && (
                  <div style={s.actions}>
                    {m.actions.map((a, i) => (
                      <button
                        key={i}
                        style={s.actionBtn}
                        onClick={() => { window.location.href = a.url; }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--color-accent-dim)'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                      >
                        {a.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {loading && (
              <div style={s.loader}>
                <span style={{ ...s.dot, animationDelay: '0s' }} />
                <span style={{ ...s.dot, animationDelay: '0.15s' }} />
                <span style={{ ...s.dot, animationDelay: '0.3s' }} />
              </div>
            )}
          </div>

          <div style={s.inputArea}>
            <input
              ref={inputRef}
              style={s.inputField}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={lang === 'zh' ? '搜索博客或提问...' : 'Search or ask...'}
            />
            <button
              style={s.sendBtn}
              onClick={handleSend}
              disabled={loading || !input.trim()}
            >
              ➤
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes chatbot-bounce {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
          40% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </>
  );
}
