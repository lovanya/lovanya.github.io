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
  confirm?: {
    yesLabel: string;
    noLabel: string;
    onYes: () => void;
    onNo: () => void;
  };
}

const PAGES = [
  { path: '/about', labelZh: '简历 / 关于', labelEn: 'Resume / About' },
  { path: '/blog', labelZh: '博客列表', labelEn: 'Blog' },
  { path: '/', labelZh: '首页', labelEn: 'Home' },
];

const POSTS_ZH = [
  { slug: 'agent-architecture-patterns', title: 'Agent 架构：ReAct、Plan-and-Execute 与多 Agent 协作', date: '2026-07-07' },
  { slug: 'ai-ui-new-era', title: 'AI 时代的新 UI：当下与近未来的界面应该长什么样', date: '2026-07-07' },
  { slug: 'build-ai-chatbot-astro', title: '给静态博客加上 AI 助手：Pagefind + Gemini 纯前端方案', date: '2026-07-08' },
  { slug: 'embedding-and-vector-db', title: 'Embedding 模型与向量数据库选型实战', date: '2026-07-07' },
  { slug: 'function-calling-and-tools', title: 'Function Calling 与 Tool Use：从协议到工程实现', date: '2026-07-07' },
  { slug: 'llm-cost-and-performance', title: 'LLM 成本与性能优化：Caching、Streaming 与模型路由', date: '2026-07-07' },
  { slug: 'llm-evaluation', title: 'LLM 应用的评估体系：Metrics、LLM-as-Judge 与 A/B 测试', date: '2026-07-07' },
  { slug: 'llm-fundamentals', title: '大模型入门：Transformer 与 LLM 是怎么工作的', date: '2026-07-03' },
  { slug: 'llm-guardrails', title: 'LLM 应用的 Guardrails：Prompt Injection 与输出安全', date: '2026-07-07' },
  { slug: 'llm-memory-systems', title: 'LLM 应用的 Memory 系统设计', date: '2026-07-07' },
  { slug: 'llm-observability', title: 'LLM 可观测性：Tracing、Logging 与调试', date: '2026-07-07' },
  { slug: 'llm-production-engineering', title: '从 Demo 到 Production：LLM 应用的工程化与团队协作', date: '2026-07-07' },
  { slug: 'llm-selection-framework', title: '闭源 vs 开源 LLM：架构师选型决策框架', date: '2026-07-03' },
  { slug: 'macos-git-branch', title: 'Git 分支管理完全指南：从入门到团队协作', date: '2018-11-12' },
  { slug: 'oh-my-zsh', title: 'Oh My Zsh 终极配置指南：从入门到高效开发', date: '2018-12-22' },
  { slug: 'rag-from-naive-to-production', title: 'RAG 检索增强生成：从基础 RAG 到生产级架构', date: '2026-07-07' },
  { slug: 'starship-prompt', title: 'Starship 终端提示符安装与使用指南', date: '2026-07-07' },
  { slug: 'tokens-context-and-prompts', title: 'Token、Context Window 与 Prompt Engineering 核心模式', date: '2026-07-03' },
];

const POSTS_EN = [
  { slug: 'agent-architecture-patterns', title: 'Agent Architecture: ReAct, Plan-and-Execute & Multi-Agent', date: '2026-07-07' },
  { slug: 'ai-ui-new-era', title: 'AI-Native UI: What Interfaces Should Look Like in the New Era', date: '2026-07-07' },
  { slug: 'build-ai-chatbot-astro', title: 'Add an AI Assistant to Your Static Blog: Pagefind + Gemini', date: '2026-07-08' },
  { slug: 'embedding-and-vector-db', title: 'Embedding Models & Vector Database Selection in Practice', date: '2026-07-07' },
  { slug: 'function-calling-and-tools', title: 'Function Calling & Tool Use: From Protocol to Engineering', date: '2026-07-07' },
  { slug: 'llm-cost-and-performance', title: 'LLM Cost & Performance Optimization', date: '2026-07-07' },
  { slug: 'llm-evaluation', title: 'LLM Evaluation: Metrics, LLM-as-Judge & A/B Testing', date: '2026-07-07' },
  { slug: 'llm-fundamentals', title: 'LLM Fundamentals: How Transformers & LLMs Actually Work', date: '2026-07-03' },
  { slug: 'llm-guardrails', title: 'LLM Guardrails: Prompt Injection & Output Safety', date: '2026-07-07' },
  { slug: 'llm-memory-systems', title: 'Memory System Design for LLM Applications', date: '2026-07-07' },
  { slug: 'llm-observability', title: 'LLM Observability: Tracing, Logging & Debugging', date: '2026-07-07' },
  { slug: 'llm-production-engineering', title: 'From Demo to Production: Engineering LLM Apps at Scale', date: '2026-07-07' },
  { slug: 'llm-selection-framework', title: 'Closed vs Open-Source LLMs: An Architect\'s Decision Framework', date: '2026-07-03' },
  { slug: 'macos-git-branch', title: 'The Complete Guide to Git Branching', date: '2018-11-12' },
  { slug: 'oh-my-zsh', title: 'Oh My Zsh Ultimate Configuration Guide', date: '2018-12-22' },
  { slug: 'rag-from-naive-to-production', title: 'RAG: From Naive RAG to Production-Grade Architecture', date: '2026-07-07' },
  { slug: 'starship-prompt', title: 'Starship Terminal Prompt: Install and Usage Guide', date: '2026-07-07' },
  { slug: 'tokens-context-and-prompts', title: 'Tokens, Context Window & Prompt Engineering Patterns', date: '2026-07-03' },
];

const WELCOME_MSG = `👋 你好！我是站内助手，由 AI 驱动。

你可以：
• 让我搜索博客内容（如"找一下关于 AI 的文章"）
• 让我跳转到特定页面（如"打开简历"）
• 直接问我技术问题`;

const WELCOME_MSG_EN = `👋 Hi! I'm your AI-powered site assistant.

You can:
• Ask me to find articles (e.g., "find articles about AI")
• Ask me to navigate to a page (e.g., "open my resume")
• Ask me technical questions`;

import { WORKER_URL, workerHeaders } from '../../lib/ai-config';

const isProd = () =>
  typeof location !== 'undefined' && /(^|\.)lovanya\.github\.io$/.test(location.hostname);

const ZHIPU_PROXY_URL = `${WORKER_URL}/api/answer`;
const ZHIPU_DIRECT = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';
const ZHIPU_MODEL = 'glm-4-flash';

const STORAGE_KEY = 'chatbot-history';
const MAX_HISTORY = 50;

function loadHistory(): Message[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(-MAX_HISTORY);
  } catch {
    return [];
  }
}

function saveHistory(messages: Message[]) {
  if (typeof localStorage === 'undefined') return;
  try {
    const trimmed = messages.slice(-MAX_HISTORY);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {}
}

function isZh(): boolean {
  if (typeof document === 'undefined') return true;
  return document.documentElement.lang === 'zh' || location.pathname === '/' || !location.pathname.startsWith('/en');
}

interface AiDecision {
  action: 'navigate' | 'answer' | 'search';
  url?: string;
  answer?: string;
  slugs?: string[];
}

async function askAiToDecide(userInput: string, lang: 'zh' | 'en'): Promise<AiDecision> {
  const posts = lang === 'zh' ? POSTS_ZH : POSTS_EN;
  const pageList = PAGES.map(p => `- ${p.path} → ${lang === 'zh' ? p.labelZh : p.labelEn}`).join('\n');
  const postList = posts.map(p => `- [${p.date}] /blog/${p.slug} → ${p.title}`).join('\n');

  const systemPrompt = lang === 'zh'
    ? `你是林健(紫牙)技术博客的 AI 助手。

【页面】
${pageList}

【博客文章】（格式：[发布日期] /url → 标题）
${postList}

根据用户输入，返回 JSON（只返回 JSON，不要其他内容）：
- 跳转页面：{"action":"navigate","url":"页面路径"}
- 搜索文章：{"action":"search","slugs":["slug1","slug2","slug3"]}（最多 5 个最相关的；如果是找"最新"的文章，按日期倒序挑）
- 回答问题：{"action":"answer","answer":"你的回答"}

判断规则：
- 用户想看某类文章 → search，从列表挑最相关的 slug
- 用户想看"最新"文章 → search，按日期倒序挑最近的
- 用户想去某个页面 → navigate
- 闲聊或技术问题 → answer`
    : `You are the AI assistant for Jian Lin (Ziya)'s tech blog.

【Pages】
${pageList}

【Blog Posts】(format: [pubDate] /url → title)
${postList}

Based on user input, return JSON only (no other text):
- Navigate: {"action":"navigate","url":"page path"}
- Search articles: {"action":"search","slugs":["slug1","slug2","slug3"]} (max 5 most relevant; for "latest" queries, sort by date desc)
- Answer: {"action":"answer","answer":"your answer"}

Decision rules:
- User wants articles about a topic → search, pick most relevant slugs
- User wants "latest" articles → search, sort by date desc
- User wants to go to a page → navigate
- Chat or tech question → answer`;

  const prompt = `${systemPrompt}\n\nUser: ${userInput}`;

  // 路由：生产 → Worker proxy；本地 dev → 直连智谱
  if (isProd()) {
    if (!WORKER_URL) {
      return { action: 'answer', answer: lang === 'zh' ? '⚠️ Worker URL 未配置' : '⚠️ Worker URL not configured' };
    }
    try {
      const res = await fetch(ZHIPU_PROXY_URL, {
        method: 'POST',
        headers: workerHeaders(),
        body: JSON.stringify({ prompt, lang }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        const msg = String(data?.error || `HTTP ${res.status}`);
        if (msg.toLowerCase().includes('quota') || msg.toLowerCase().includes('rate')) {
          return { action: 'answer', answer: lang === 'zh' ? '⚠️ AI 配额已用完' : '⚠️ AI quota exhausted.' };
        }
        return { action: 'answer', answer: lang === 'zh' ? '⚠️ AI 暂时不可用' : '⚠️ AI unavailable' };
      }
      const text = data?.text || '';
      const jsonMatch = text.match(/\{[\s\S]*?\}/);
      if (jsonMatch) {
        try { return JSON.parse(jsonMatch[0]); }
        catch { return { action: 'answer', answer: text }; }
      }
      return { action: 'answer', answer: text };
    } catch {
      return { action: 'answer', answer: lang === 'zh' ? '⚠️ AI 连接失败' : '⚠️ AI connection failed' };
    }
  }

  // 本地 dev：直连智谱
  const key = (import.meta as any).env?.PUBLIC_ZHIPU_API_KEY || '';
  if (!key) {
    return { action: 'answer', answer: lang === 'zh' ? '⚠️ 本地未配置 PUBLIC_ZHIPU_API_KEY' : '⚠️ PUBLIC_ZHIPU_API_KEY not set locally' };
  }
  try {
    const res = await fetch(ZHIPU_DIRECT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: ZHIPU_MODEL,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    const data = await res.json();
    if (data?.error?.code === 'rate_limit_exceeded' || res.status === 429) {
      return { action: 'answer', answer: lang === 'zh' ? '⚠️ AI 限流，请稍后再试' : '⚠️ AI rate limit, retry shortly' };
    }
    if (!res.ok) {
      return { action: 'answer', answer: lang === 'zh' ? '⚠️ AI 暂时不可用' : '⚠️ AI unavailable' };
    }
    const text = data?.choices?.[0]?.message?.content || '';
    const jsonMatch = text.match(/\{[\s\S]*?\}/);
    if (jsonMatch) {
      try { return JSON.parse(jsonMatch[0]); }
      catch { return { action: 'answer', answer: text }; }
    }
    return { action: 'answer', answer: text };
  } catch {
    return { action: 'answer', answer: lang === 'zh' ? '⚠️ AI 连接失败' : '⚠️ AI connection failed' };
  }
}

function genId() { return Math.random().toString(36).slice(2, 10); }

export default function ChatBot() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>(() => loadHistory());
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [hasAi, setHasAi] = useState(() => !!WORKER_URL);
  const msgsRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const fabRef = useRef<HTMLButtonElement>(null);
  const [animState, setAnimState] = useState<'peeking' | 'out' | 'talking'>('peeking');
  const [eyeDir, setEyeDir] = useState<'left' | 'center' | 'right'>('center');
  const [showTip, setShowTip] = useState(false);
  const [tipIndex, setTipIndex] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const eyeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const TIPS_ZH = ['需要帮助吗？', '试试问我技术问题～', '想找哪篇文章？', '我可以跳转页面哦', '今天写代码了吗？'];
  const TIPS_EN = ['Need help?', 'Ask me a tech question~', 'Looking for an article?', 'I can navigate pages!', 'Wrote any code today?'];

  const lang = isZh() ? 'zh' : 'en';

  const addBotMsg = useCallback((text: string, actions?: Action[], confirm?: Message['confirm']) => {
    setMessages(prev => [...prev, { id: genId(), role: 'bot', text, actions, confirm }]);
  }, []);

  const addUserMsg = useCallback((text: string) => {
    setMessages(prev => [...prev, { id: genId(), role: 'user', text }]);
  }, []);

  const clearHistory = useCallback(() => {
    setMessages([{ id: genId(), role: 'bot', text: lang === 'zh' ? WELCOME_MSG : WELCOME_MSG_EN }]);
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
  }, [lang]);

  useEffect(() => {
    saveHistory(messages);
  }, [messages]);

  useEffect(() => {
    if (!open) return;
    setHasAi(!!WORKER_URL);
    if (messages.length === 0) {
      addBotMsg(lang === 'zh' ? WELCOME_MSG : WELCOME_MSG_EN);
    }
  }, [open]);

  useEffect(() => {
    msgsRef.current?.scrollTo({ top: msgsRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
      requestAnimationFrame(() => {
        msgsRef.current?.scrollTo({ top: msgsRef.current.scrollHeight, behavior: 'auto' });
      });
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (panelRef.current?.contains(target)) return;
      if (fabRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)');
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    const clearAll = () => {
      if (idleTimer.current) { clearTimeout(idleTimer.current); idleTimer.current = null; }
      if (eyeTimer.current) { clearTimeout(eyeTimer.current); eyeTimer.current = null; }
      if (tipTimer.current) { clearTimeout(tipTimer.current); tipTimer.current = null; }
    };
    if (open || hovered) {
      clearAll();
      setAnimState('out');
      setShowTip(false);
      setEyeDir('center');
      return;
    }
    const rnd = (min: number, max: number) => min + Math.random() * (max - min);
    const cycle = () => {
      // 1. 探出半边，眼睛好奇地看
      setAnimState('peeking');
      setTipIndex(Math.floor(Math.random() * 5));
      setEyeDir('left');
      eyeTimer.current = setTimeout(() => setEyeDir('right'), 600);
      eyeTimer.current = setTimeout(() => setEyeDir('left'), 1200);
      eyeTimer.current = setTimeout(() => setEyeDir('center'), 1700);
      // 2. 完全出来 + 微笑
      idleTimer.current = setTimeout(() => {
        setAnimState('out');
        // 3. 张嘴讲话 + 弹气泡
        idleTimer.current = setTimeout(() => {
          setAnimState('talking');
          setShowTip(true);
          // 4. 收回半边（不消失）
          idleTimer.current = setTimeout(() => {
            setShowTip(false);
            setAnimState('peeking');
            // 5. 等待后再次循环
            idleTimer.current = setTimeout(cycle, rnd(8000, 15000));
          }, rnd(3500, 5000));
        }, 800);
      }, 1800);
    };
    idleTimer.current = setTimeout(cycle, rnd(2500, 4000));
    return clearAll;
  }, [open]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    addUserMsg(text);
    setLoading(true);

    if (!hasAi) {
      addBotMsg(lang === 'zh' ? '⚠️ AI 未配置，无法处理请求。' : '⚠️ AI not configured.');
      setLoading(false);
      return;
    }

    const decision = await askAiToDecide(text, lang);
    const posts = lang === 'zh' ? POSTS_ZH : POSTS_EN;

    switch (decision.action) {
      case 'navigate': {
        const url = decision.url || '/';
        const page = PAGES.find(p => p.path === url);
        const label = page ? (lang === 'zh' ? page.labelZh : page.labelEn) : url;
        addBotMsg(lang === 'zh' ? `📄 正在跳转到：` : `📄 Navigating to:`, [{ label, url }]);
        setTimeout(() => { window.location.href = url; }, 600);
        break;
      }
      case 'search': {
        const slugs = decision.slugs || [];
        let found = slugs
          .map(s => posts.find(p => p.slug === s))
          .filter((p): p is typeof posts[0] => !!p)
          .map(p => ({ label: p.title, url: `/blog/${p.slug}` }));

        if (found.length === 0) {
          found = [...posts]
            .sort((a, b) => b.date.localeCompare(a.date))
            .slice(0, 5)
            .map(p => ({ label: p.title, url: `/blog/${p.slug}` }));
        }

        addBotMsg(
          lang === 'zh' ? `🔍 为你找到 ${found.length} 篇相关文章：` : `🔍 Found ${found.length} relevant articles:`,
          found,
        );
        break;
      }
      case 'answer':
      default: {
        const answerText = decision.answer || (lang === 'zh' ? '抱歉，我不确定如何处理。' : 'Sorry, I\'m not sure how to help.');
        const uncertaintyZh = ['不确定', '不太清楚', '抱歉', '无法', '不知道', '建议', '没有相关', '没有找到'];
        const uncertaintyEn = ['sorry', 'not sure', 'don\'t know', 'unable', 'unfortunately', 'no relevant', 'no matching'];
        const list = lang === 'zh' ? uncertaintyZh : uncertaintyEn;
        const looksUncertain = list.some(k => answerText.toLowerCase().includes(k));

        if (looksUncertain) {
          const yes = () => {
            const byDate = [...posts]
              .sort((a, b) => b.date.localeCompare(a.date))
              .slice(0, 5)
              .map(p => ({ label: p.title, url: `/blog/${p.slug}` }));
            addBotMsg(
              lang === 'zh' ? `🔍 为你找到 ${byDate.length} 篇相关文章：` : `🔍 Found ${byDate.length} relevant articles:`,
              byDate,
            );
          };
          const no = () => {};
          addBotMsg(answerText, undefined, {
            yesLabel: lang === 'zh' ? '是，搜博客' : 'Yes, search blog',
            noLabel: lang === 'zh' ? '不用' : 'No',
            onYes: yes,
            onNo: no,
          });
        } else {
          addBotMsg(answerText);
        }
        break;
      }
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
      top: '50%',
      right: '1.5rem',
      transform: 'translateY(-50%)',
      width: '4rem',
      height: '4rem',
      borderRadius: '50%',
      border: 'none',
      // background: 'var(--color-bg-secondary)',
      color: 'var(--color-accent)',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      // boxShadow: '0 0 24px var(--color-accent-glow)',
      filter: 'drop-shadow(var(--color-accent) 0 0 8px)',
      transition: 'right 0.5s cubic-bezier(0.4, 0, 0.2, 1), transform 0.3s ease, box-shadow 0.3s ease',
    },
    panel: {
      position: 'fixed',
      top: '50%',
      right: '6rem',
      transform: 'translateY(-50%)',
      width: '360px',
      maxWidth: 'calc(100vw - 7rem)',
      height: '520px',
      maxHeight: 'calc(100vh - 4rem)',
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
    confirmRow: {
      display: 'flex',
      gap: '0.375rem',
      marginTop: '0.5rem',
    },
    inputArea: {
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem',
      padding: '0.75rem',
      borderTop: '1px solid var(--color-border)',
    },
    inputField: {
      flex: 1,
      height: '38px',
      padding: '0 0.75rem',
      borderRadius: '8px',
      border: '1px solid var(--color-border)',
      background: 'var(--color-bg)',
      color: 'var(--color-text)',
      fontSize: '0.875rem',
      outline: 'none',
    },
    clearBtn: {
      height: '38px',
      width: '38px',
      flexShrink: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: '8px',
      border: '1px solid var(--color-border)',
      background: 'transparent',
      color: 'var(--color-text-secondary)',
      cursor: 'pointer',
      transition: 'all 0.2s',
    },
    sendBtn: {
      height: '38px',
      width: '38px',
      flexShrink: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: '8px',
      border: 'none',
      background: 'var(--color-accent)',
      color: 'var(--color-bg)',
      cursor: 'pointer',
      opacity: loading ? 0.5 : 1,
      transition: 'all 0.2s',
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
    tip: {
      position: 'fixed',
      top: '50%',
      transform: 'translateY(-50%)',
      right: '5.5rem',
      zIndex: 9998,
      pointerEvents: 'none',
      animation: 'chatbot-tip-in 0.3s ease-out',
    },
    tipBubble: {
      position: 'relative',
      padding: '0.5rem 0.75rem',
      background: 'var(--color-bg-secondary)',
      border: '1px solid var(--color-accent)',
      borderRadius: '12px',
      color: 'var(--color-text)',
      fontSize: '0.85rem',
      whiteSpace: 'nowrap',
      boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
      animation: 'chatbot-tip-pulse 2s ease-in-out infinite',
    },
  };

  return (
    <>
      <button
        ref={fabRef}
        style={{
          ...s.fab,
          right: hovered ? '1.5rem' : animState === 'peeking' ? '-2rem' : '1.5rem',
          ...(isMobile && open ? { display: 'none' } : {}),
        }}
        onClick={() => setOpen(v => !v)}
        aria-label={lang === 'zh' ? '打开助手' : 'Open assistant'}
        onMouseEnter={e => {
          setHovered(true);
          (e.currentTarget as HTMLElement).style.transform = 'translateY(-50%) scale(1.1)';
          // (e.currentTarget as HTMLElement).style.boxShadow = '0 0 30px var(--color-accent-glow)';
        }}
        onMouseLeave={e => {
          setHovered(false);
          (e.currentTarget as HTMLElement).style.transform = 'translateY(-50%) scale(1)';
          // (e.currentTarget as HTMLElement).style.boxShadow = '0 0 24px var(--color-accent-glow)';
        }}
      >
        <svg viewBox="0 0 100 100" width="44" height="44" fill="none" stroke="currentColor" strokeWidth="2.5">
          <line x1="50" y1="12" x2="50" y2="26" strokeLinecap="round" />
          <circle cx="50" cy="9" r="5" fill="var(--color-accent)" stroke="none" />
          <rect x="16" y="26" width="68" height="54" rx="14" fill="var(--color-bg)" stroke="currentColor" />
          <circle
            cx={36 + (eyeDir === 'left' ? -2 : eyeDir === 'right' ? 2 : 0)}
            cy="48"
            r="6"
            fill="var(--color-accent)"
            stroke="none"
            style={{ transition: 'cx 0.3s ease' }}
          />
          <circle
            cx={64 + (eyeDir === 'left' ? -2 : eyeDir === 'right' ? 2 : 0)}
            cy="48"
            r="6"
            fill="var(--color-accent)"
            stroke="none"
            style={{ transition: 'cx 0.3s ease' }}
          />
          {animState !== 'talking' && <path d="M 30 66 Q 50 76 70 66" strokeLinecap="round" fill="none" />}
          {animState === 'talking' && <ellipse cx="50" cy="70" rx="8" ry="6" fill="var(--color-accent)" stroke="none" />}
        </svg>
      </button>

      {showTip && !open && (
        <div style={{ ...s.tip, right: '5.5rem' }} key={tipIndex}>
          <div style={s.tipBubble}>
            {(lang === 'zh' ? TIPS_ZH : TIPS_EN)[tipIndex]}
          </div>
        </div>
      )}

      {open && (
        <div
          ref={panelRef}
          style={isMobile ? {
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            width: '100vw',
            height: '100dvh',
            maxWidth: '100vw',
            maxHeight: '100dvh',
            background: 'var(--color-bg-secondary)',
            display: 'flex',
            flexDirection: 'column',
            zIndex: 10000,
            boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
            overflow: 'hidden',
          } : s.panel}
        >
          <div style={s.header}>
            <svg viewBox="0 0 100 100" width="24" height="24" fill="none" stroke="var(--color-accent)" strokeWidth="2.5">
              <rect x="20" y="24" width="60" height="48" rx="10" fill="var(--color-accent-dim)" stroke="currentColor" />
              <circle cx="36" cy="44" r="5" fill="var(--color-accent)" stroke="none" />
              <circle cx="64" cy="44" r="5" fill="var(--color-accent)" stroke="none" />
              <path d="M 32 60 Q 50 68 68 60" strokeLinecap="round" fill="none" />
            </svg>
            <span style={{ flex: 1, fontWeight: 600, fontSize: '0.9rem', color: 'var(--color-text)' }}>
              {lang === 'zh' ? '🤖 AI 助手' : '🤖 AI Assistant'}
            </span>
            {hasAi && <span style={{ fontSize: '0.65rem', color: 'var(--color-neon)', background: 'var(--color-neon-dim)', padding: '0.15rem 0.4rem', borderRadius: '4px' }}>AI</span>}
            <button
              onClick={() => setOpen(false)}
              style={{ background: 'none', border: 'none', color: 'var(--color-text-secondary)', cursor: 'pointer', fontSize: '1.4rem', lineHeight: 1, padding: '0.25rem 0.5rem' }}
              aria-label={lang === 'zh' ? '关闭' : 'Close'}
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
                {m.confirm && (
                  <div style={s.confirmRow}>
                    <button
                      style={{ ...s.actionBtn, flex: 1 }}
                      onClick={() => { m.confirm!.onYes(); setMessages(prev => prev.map(x => x.id === m.id ? { ...x, confirm: undefined } : x)); }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--color-accent-dim)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                    >
                      {m.confirm.yesLabel}
                    </button>
                    <button
                      style={{ ...s.actionBtn, flex: 1, borderColor: 'var(--color-border)' }}
                      onClick={() => { m.confirm!.onNo(); setMessages(prev => prev.map(x => x.id === m.id ? { ...x, confirm: undefined } : x)); }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--color-card)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                    >
                      {m.confirm.noLabel}
                    </button>
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
            {messages.length > 0 && (
              <button
                style={s.clearBtn}
                onClick={clearHistory}
                title={lang === 'zh' ? '清除对话记录' : 'Clear history'}
                aria-label={lang === 'zh' ? '清除对话记录' : 'Clear history'}
              >
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                  <path d="M10 11v6" />
                  <path d="M14 11v6" />
                  <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
                </svg>
              </button>
            )}
            <input
              ref={inputRef}
              style={s.inputField}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={lang === 'zh' ? '告诉我你需要什么...' : 'Tell me what you need...'}
            />
            <button
              style={s.sendBtn}
              onClick={handleSend}
              disabled={loading || !input.trim()}
              aria-label={lang === 'zh' ? '发送' : 'Send'}
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="13 6 19 12 13 18" />
              </svg>
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes chatbot-bounce {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
          40% { transform: scale(1); opacity: 1; }
        }
        @keyframes chatbot-tip-in {
          0% { opacity: 0; transform: translateX(10px) scale(0.8); }
          100% { opacity: 1; transform: translateX(0) scale(1); }
        }
        @keyframes chatbot-tip-pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
      `}</style>
    </>
  );
}
