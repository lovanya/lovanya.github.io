/**
 * api-proxy — Cloudflare Worker 转发 Gemini API 请求
 *
 * 部署：`cd worker && npm install && wrangler deploy`
 * Secrets（必填）：wrangler secret put GEMINI_API_KEY
 *
 * 防滥用：
 *   1. Origin 白名单（只允许 ALLOWED_ORIGINS 里的页面调用，浏览器跨域必带 Origin）
 *   2. KV 速率限制（每个 IP 每分钟 N 次，防止配额被烧光）
 *
 * 暴露端点：
 *   POST /api/ask     — 流式（SSE）转发，body: { prompt, lang, temperature? }
 *   POST /api/answer  — 非流式，body: { prompt, lang }
 *   GET  /healthz     — 健康检查
 */

interface Env {
  GEMINI_API_KEY: string;
  ALLOWED_ORIGINS: string;
  GEMINI_MODEL: string;
  RATE_KV?: KVNamespace;
}

interface RateInfo {
  count: number;
  resetAt: number;
}

const RATE_LIMIT = 30;        // 每个 IP 每窗口允许的请求数
const RATE_WINDOW = 60_000;   // 窗口长度,ms

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

const corsHeaders = (origin: string | null, allowed: string): Headers => {
  const h = new Headers();
  const allowList = allowed.split(',').map(s => s.trim()).filter(Boolean);
  if (origin && allowList.includes(origin)) {
    h.set('Access-Control-Allow-Origin', origin);
    h.set('Vary', 'Origin');
  }
  h.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  h.set('Access-Control-Allow-Headers', 'Content-Type');
  h.set('Access-Control-Max-Age', '86400');
  return h;
};

function originAllowed(origin: string | null, allowed: string): boolean {
  if (!origin) return false;
  const allowList = allowed.split(',').map(s => s.trim()).filter(Boolean);
  return allowList.includes(origin);
}

async function checkRate(ip: string, kv?: KVNamespace): Promise<{ allowed: boolean; retryAfter: number }> {
  if (!kv) return { allowed: true, retryAfter: 0 };
  const key = `rate:${ip}`;
  const now = Date.now();
  const raw = await kv.get(key);
  const info: RateInfo = raw ? JSON.parse(raw) : { count: 0, resetAt: now + RATE_WINDOW };

  if (now > info.resetAt) {
    info.count = 0;
    info.resetAt = now + RATE_WINDOW;
  }

  info.count += 1;
  await kv.put(key, JSON.stringify(info), { expirationTtl: 120 });

  if (info.count > RATE_LIMIT) {
    return { allowed: false, retryAfter: Math.ceil((info.resetAt - now) / 1000) };
  }
  return { allowed: true, retryAfter: 0 };
}

const jsonResponse = (data: unknown, status: number, env: Env, extraHeaders: HeadersInit = {}): Response => {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...extraHeaders },
  });
};

async function handleAsk(req: Request, env: Env, extraHeaders: HeadersInit): Promise<Response> {
  let body: { prompt?: string; lang?: string; temperature?: number };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ ok: false, error: 'invalid JSON body' }, 400, env, extraHeaders);
  }
  const prompt = body.prompt?.trim();
  if (!prompt) return jsonResponse({ ok: false, error: 'missing prompt' }, 400, env, extraHeaders);
  if (prompt.length > 32000) return jsonResponse({ ok: false, error: 'prompt too long' }, 413, env, extraHeaders);

  const upstream = await fetch(`${GEMINI_BASE}/${env.GEMINI_MODEL}:generateContent?alt=sse`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': env.GEMINI_API_KEY,
    },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: body.temperature ?? 0.3, topP: 0.95 },
    }),
  });

  if (!upstream.ok || !upstream.body) {
    const errText = await upstream.text().catch(() => '');
    return new Response(
      JSON.stringify({ ok: false, error: `upstream ${upstream.status}`, upstream: errText.slice(0, 500) }),
      { status: 502, headers: { 'Content-Type': 'application/json; charset=utf-8', ...extraHeaders } },
    );
  }

  const headers = new Headers(extraHeaders);
  headers.set('Content-Type', 'text/event-stream; charset=utf-8');
  headers.set('Cache-Control', 'no-cache, no-transform');
  headers.set('X-Accel-Buffering', 'no');
  return new Response(upstream.body, { status: 200, headers });
}

async function handleAnswer(req: Request, env: Env, extraHeaders: HeadersInit): Promise<Response> {
  let body: { prompt?: string; lang?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ ok: false, error: 'invalid JSON body' }, 400, env, extraHeaders);
  }
  const prompt = body.prompt?.trim();
  if (!prompt) return jsonResponse({ ok: false, error: 'missing prompt' }, 400, env, extraHeaders);

  const upstream = await fetch(`${GEMINI_BASE}/${env.GEMINI_MODEL}:generateContent`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': env.GEMINI_API_KEY,
    },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.3, topP: 0.95 },
    }),
  });

  const data = await upstream.json().catch(() => ({}));
  if (!upstream.ok) {
    return new Response(
      JSON.stringify({ ok: false, error: data?.error?.message || `upstream ${upstream.status}` }),
      { status: 502, headers: { 'Content-Type': 'application/json; charset=utf-8', ...extraHeaders } },
    );
  }

  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  return new Response(
    JSON.stringify({ ok: true, text }),
    { status: 200, headers: { 'Content-Type': 'application/json; charset=utf-8', ...extraHeaders } },
  );
}

export default {
  async fetch(req: Request, env: Env, ctx: { clientIP?: string }): Promise<Response> {
    const origin = req.headers.get('Origin');
    const c = corsHeaders(origin, env.ALLOWED_ORIGINS);

    // CORS 预检
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: c });
    }

    const url = new URL(req.url);

    if (url.pathname === '/healthz') {
      return new Response(JSON.stringify({ ok: true, ts: Date.now() }), {
        headers: { 'Content-Type': 'application/json', ...Object.fromEntries(c) },
      });
    }

    if (url.pathname !== '/api/ask' && url.pathname !== '/api/answer') {
      return jsonResponse({ ok: false, error: 'not found' }, 404, env, Object.fromEntries(c));
    }

    // 1) Origin 白名单
    if (!originAllowed(origin, env.ALLOWED_ORIGINS)) {
      return jsonResponse({ ok: false, error: 'forbidden origin' }, 403, env, Object.fromEntries(c));
    }

    // 2) 速率限制
    const ip = ctx.clientIP || req.headers.get('CF-Connecting-IP') || 'unknown';
    const rate = await checkRate(ip, env.RATE_KV);
    if (!rate.allowed) {
      return new Response(
        JSON.stringify({ ok: false, error: 'rate limited' }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Retry-After': String(rate.retryAfter),
            ...Object.fromEntries(c),
          },
        },
      );
    }

    const extra: Record<string, string> = {};
    c.forEach((v, k) => { extra[k] = v; });
    void extra;

    if (url.pathname === '/api/ask') return handleAsk(req, env, c);
    return handleAnswer(req, env, c);
  },
};
