/**
 * api-proxy — Cloudflare Worker 转发 Gemini API 请求
 *
 * 部署：`cd worker && npm install && wrangler deploy`
 * Secrets（必填）：wrangler secret put GEMINI_API_KEY
 *
 * 防滥用：Origin 白名单 + KV 速率限制（可选,wrangler.toml 里 KV id 配上即可启用）
 *
 * 端点：
 *   POST /api/ask     — 流式 (SSE) 转发, body: { prompt, lang, temperature? }
 *   POST /api/answer  — 非流式, body: { prompt, lang }
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

const RATE_LIMIT = 30;
const RATE_WINDOW = 60_000;

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

const buildCorsHeaders = (origin: string | null, allowed: string): Record<string, string> => {
  const h: Record<string, string> = {
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
  const allowList = allowed.split(',').map(s => s.trim()).filter(Boolean);
  if (origin && allowList.includes(origin)) {
    h['Access-Control-Allow-Origin'] = origin;
  }
  return h;
};

const originAllowed = (origin: string | null, allowed: string): boolean => {
  if (!origin) return false;
  const allowList = allowed.split(',').map(s => s.trim()).filter(Boolean);
  return allowList.includes(origin);
};

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
};

function json(data: unknown, status: number, cors: Record<string, string>, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...cors,
      ...extra,
    },
  });
}

async function handleAsk(req: Request, env: Env, cors: Record<string, string>): Promise<Response> {
  let body: { prompt?: string; lang?: string; temperature?: number };
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: 'invalid JSON body' }, 400, cors);
  }
  const prompt = body.prompt?.trim();
  if (!prompt) return json({ ok: false, error: 'missing prompt' }, 400, cors);
  if (prompt.length > 32000) return json({ ok: false, error: 'prompt too long' }, 413, cors);

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
    return json({ ok: false, error: `upstream ${upstream.status}`, upstream: errText.slice(0, 500) }, 502, cors);
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      ...cors,
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
    },
  });
}

async function handleAnswer(req: Request, env: Env, cors: Record<string, string>): Promise<Response> {
  let body: { prompt?: string; lang?: string };
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: 'invalid JSON body' }, 400, cors);
  }
  const prompt = body.prompt?.trim();
  if (!prompt) return json({ ok: false, error: 'missing prompt' }, 400, cors);

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
    return json({ ok: false, error: data?.error?.message || `upstream ${upstream.status}` }, 502, cors);
  }

  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  return json({ ok: true, text }, 200, cors);
}

export default {
  async fetch(req: Request, env: Env, ctx: { clientIP?: string }): Promise<Response> {
    const origin = req.headers.get('Origin');
    const cors = buildCorsHeaders(origin, env.ALLOWED_ORIGINS);

    // CORS 预检
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }

    const url = new URL(req.url);

    if (url.pathname === '/healthz') {
      return json({ ok: true, ts: Date.now() }, 200, cors);
    }

    if (url.pathname !== '/api/ask' && url.pathname !== '/api/answer') {
      return json({ ok: false, error: 'not found' }, 404, cors);
    }

    // 1) Origin 白名单
    if (!originAllowed(origin, env.ALLOWED_ORIGINS)) {
      return json({ ok: false, error: 'forbidden origin' }, 403, cors);
    }

    // 2) 速率限制
    const ip = ctx.clientIP || req.headers.get('CF-Connecting-IP') || 'unknown';
    const rate = await checkRate(ip, env.RATE_KV);
    if (!rate.allowed) {
      return json({ ok: false, error: 'rate limited' }, 429, cors, { 'Retry-After': String(rate.retryAfter) });
    }

    if (url.pathname === '/api/ask') return handleAsk(req, env, cors);
    return handleAnswer(req, env, cors);
  },
};
