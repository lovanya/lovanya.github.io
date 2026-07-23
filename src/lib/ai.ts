/**
 * AI 请求路由
 *
 * dev（npm run dev / Astro dev server）→ 直连 Gemini，需要 PUBLIC_GEMINI_API_KEY
 * prod（npm run build）→ 走 Cloudflare Worker proxy，无 key
 *
 * 生产 bundle 不含 `askDirect` 的可执行路径（DCE by Vite），
 * PUBLIC_GEMINI_API_KEY 在生产构建里没值（GitHub Actions 不传）。
 */

import { WORKER_URL, workerHeaders } from './ai-config';

const __isProdBuild__ = (import.meta as any).env?.PROD === true;
const __hostname__ = typeof location !== 'undefined' ? location.hostname : '';

export type Lang = 'zh' | 'en';

export type TemplateId =
  | 'explain'
  | 'translate'
  | 'summarize'
  | 'codeExplain'
  | 'interview'
  | 'mermaidExplain';

export type TargetLang = 'zh' | 'en';

export interface BuildPromptOpts {
  template: TemplateId;
  payload: string;
  lang: Lang;
  targetLang?: TargetLang;
}

const GEMINI_DIRECT = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent';

function getDirectKey(): string {
  if (typeof import.meta === 'undefined') return '';
  return (import.meta as unknown as { env?: Record<string, string> }).env?.PUBLIC_GEMINI_API_KEY || '';
}

function detectPageLang(): Lang {
  if (typeof document === 'undefined') return 'zh';
  return document.documentElement.lang === 'en' ? 'en' : 'zh';
}

export const detectPageLangFromDocument = (): Lang => detectPageLang();

function targetLangLabel(target: TargetLang): string {
  return target === 'en' ? 'English' : '中文';
}

export function buildPrompt({ template, payload, lang, targetLang }: BuildPromptOpts): string {
  const trimmed = payload.trim();
  const target = targetLang || (lang === 'zh' ? 'en' : 'zh');

  switch (template) {
    case 'explain':
      return lang === 'zh'
        ? `请用通俗易懂的方式解释下面这段内容。如果有技术术语，请用一句通俗类比解释它，然后给出技术性定义。要求：1) 解释清楚是什么；2) 解决什么问题；3) 在前端/工程实践中如何应用：\n\n"""\n${trimmed}\n"""\n\n回答使用中文。`
        : `Please explain the following content in plain, accessible language. If there are technical terms, give a one-line analogy first, then the formal definition. Requirements: 1) what it is; 2) what problem it solves; 3) how it applies in frontend/engineering practice.\n\n"""\n${trimmed}\n"""\n\nAnswer in English.`;

    case 'translate':
      return lang === 'zh'
        ? `请把下面这段内容翻译成${targetLangLabel(target)}。要求：1) 保留原意；2) 保留代码、链接、专有名词不译；3) 段落结构保持一致：\n\n"""\n${trimmed}\n"""`
        : `Please translate the following into ${targetLangLabel(target)}. Requirements: 1) preserve meaning; 2) keep code, links, and proper nouns intact; 3) keep paragraph structure consistent.\n\n"""\n${trimmed}\n"""\n\nAnswer in ${targetLangLabel(target)}.`;

    case 'summarize':
      return lang === 'zh'
        ? `请把下面这段内容总结成 3-5 个要点，每个要点一行。要求：抓住关键结论，不要复述原文细节：\n\n"""\n${trimmed}\n"""`
        : `Please summarize the following into 3-5 bullet points, one line each. Capture the key conclusions, do not paraphrase the original details.\n\n"""\n${trimmed}\n"""\n\nAnswer in English.`;

    case 'codeExplain':
      return lang === 'zh'
        ? `请解释下面这段代码的意图、关键原理、潜在的坑。要求结构：1) 这段代码做什么（2-3 句）；2) 关键原理拆解（3-5 个要点）；3) 生产环境容易踩的坑；4) 优化建议（如果有）：\n\n"""\n${trimmed}\n"""`
        : `Please explain the following code's intent, key principles, and potential pitfalls. Required structure: 1) what the code does (2-3 sentences); 2) key principle breakdown (3-5 bullets); 3) production pitfalls; 4) optimization suggestions if any.\n\n"""\n${trimmed}\n"""\n\nAnswer in English.`;

    case 'interview':
      return lang === 'zh'
        ? `请详细解答下面这道前端面试题。要求结构：1) 简洁答案（1-2 段，先给最终结论）；2) 详细原理（3-5 个核心点深度展开）；3) 代码示例（TypeScript 优先，能体现关键点）；4) 延伸追问（面试官可能继续问的 2-3 道题 + 思路提示）：\n\n"""\n${trimmed}\n"""`
        : `Please thoroughly answer the following frontend interview question. Required structure: 1) concise answer (1-2 paragraphs, conclusion first); 2) detailed principles (3-5 in-depth points); 3) code example (TypeScript preferred, illustrating key points); 4) follow-up questions (2-3 likely next questions + thinking hints).\n\n"""\n${trimmed}\n"""\n\nAnswer in English.`;

    case 'mermaidExplain':
      return lang === 'zh'
        ? `请解释下面这个 Mermaid 流程图。要求：1) 这是什么主题的流程图（1 句话）；2) 节点的拓扑关系（入口 / 中心节点 / 出口分别是什么）；3) 关键流转逻辑（3-5 个核心步骤）；4) 读这篇博客时，应该重点关注哪个分支或节点；5) 可能的优化或简化建议（如果有）：\n\n"""\n${trimmed}\n"""`
        : `Please explain the following Mermaid flowchart. Requirements: 1) what topic this flowchart covers (1 sentence); 2) topology (entry / central nodes / exits); 3) key flow logic (3-5 core steps); 4) which branch or node to focus on when reading this blog post; 5) possible optimization or simplification suggestions if any.\n\n"""\n${trimmed}\n"""\n\nAnswer in English.`;

    default:
      return trimmed;
  }
}

export interface AskOpts {
  prompt: string;
  lang?: Lang;
  signal?: AbortSignal;
  onChunk?: (text: string) => void;
}

export interface AskResult {
  ok: boolean;
  text: string;
  error?: string;
}

/** 浏览器运行时：hostname 命中生产域名 → 走 proxy，否则 → 直连 dev */
function useProxyAtRuntime(): boolean {
  return /(^|\.)lovanya\.github\.io$/.test(__hostname__);
}

async function askDirect({ prompt, lang, signal, onChunk }: AskOpts): Promise<AskResult> {
  const l = lang || detectPageLang();
  const key = getDirectKey();
  if (!key) {
    return {
      ok: false,
      text: '',
      error: l === 'zh' ? '⚠️ 本地未配置 PUBLIC_GEMINI_API_KEY（dev only）' : '⚠️ PUBLIC_GEMINI_API_KEY not configured (dev only)',
    };
  }
  const body = JSON.stringify({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.3, topP: 0.95 },
  });

  if (onChunk) {
    try {
      const res = await fetch(`${GEMINI_DIRECT}?key=${key}&alt=sse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        signal,
      });
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let full = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split('\n\n');
        buffer = events.pop() || '';
        for (const ev of events) {
          const line = ev.split('\n').find((ll) => ll.startsWith('data:')) || '';
          const data = line.replace(/^data:\s*/, '').trim();
          if (!data || data === '[DONE]') continue;
          try {
            const json = JSON.parse(data);
            const piece = json?.candidates?.[0]?.content?.parts?.[0]?.text || '';
            if (piece) { full += piece; onChunk(full); }
          } catch {}
        }
      }
      return { ok: true, text: full };
    } catch (err) {
      if ((err as Error).name === 'AbortError') return { ok: false, text: '', error: 'aborted' };
    }
  }

  try {
    const res = await fetch(`${GEMINI_DIRECT}?key=${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      signal,
    });
    const data = await res.json();
    if (data?.error?.status === 'RESOURCE_EXHAUSTED') {
      return { ok: false, text: '', error: l === 'zh' ? '⚠️ AI 配额已用完' : '⚠️ AI quota exhausted' };
    }
    if (!res.ok) return { ok: false, text: '', error: `HTTP ${res.status}` };
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return { ok: true, text };
  } catch {
    return { ok: false, text: '', error: l === 'zh' ? '⚠️ AI 连接失败' : '⚠️ AI connection failed' };
  }
}

async function askViaProxy({ prompt, lang, signal, onChunk }: AskOpts): Promise<AskResult> {
  const l = lang || detectPageLang();
  const upstreamBody = JSON.stringify({ prompt, lang: l, temperature: 0.3 });

  if (onChunk) {
    try {
      const res = await fetch(`${WORKER_URL}/api/ask`, {
        method: 'POST',
        headers: workerHeaders({ Accept: 'text/event-stream' }),
        body: upstreamBody,
        signal,
      });
      if (!res.ok || !res.body) {
        let msg = `HTTP ${res.status}`;
        try { msg = (await res.json()).error || msg; } catch {}
        throw new Error(msg);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let full = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split('\n\n');
        buffer = events.pop() || '';
        for (const ev of events) {
          const line = ev.split('\n').find((ll) => ll.startsWith('data:')) || '';
          const data = line.replace(/^data:\s*/, '').trim();
          if (!data || data === '[DONE]') continue;
          try {
            const json = JSON.parse(data);
            const piece = json?.candidates?.[0]?.content?.parts?.[0]?.text || '';
            if (piece) { full += piece; onChunk(full); }
          } catch {}
        }
      }
      return { ok: true, text: full };
    } catch (err) {
      if ((err as Error).name === 'AbortError') return { ok: false, text: '', error: 'aborted' };
    }
  }

  try {
    const res = await fetch(`${WORKER_URL}/api/answer`, {
      method: 'POST',
      headers: workerHeaders(),
      body: upstreamBody,
      signal,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, text: '', error: data?.error || `HTTP ${res.status}` };
    if (!data.ok) return { ok: false, text: '', error: data.error || 'unknown' };
    if (onChunk && data.text) onChunk(data.text);
    return { ok: true, text: data.text || '' };
  } catch {
    return { ok: false, text: '', error: l === 'zh' ? '⚠️ AI 连接失败' : '⚠️ AI connection failed' };
  }
}

export async function askGemini(opts: AskOpts): Promise<AskResult> {
  if (useProxyAtRuntime()) return askViaProxy(opts);
  return askDirect(opts);
}

export interface OpenEventDetail {
  template: TemplateId;
  payload: string;
  anchor?: { x: number; y: number };
}

export function dispatchAiOpen(detail: OpenEventDetail): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('ai:open', { detail }));
}
