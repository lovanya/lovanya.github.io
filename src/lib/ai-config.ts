/**
 * Cloudflare Worker 代理的公共配置
 * 前端只暴露 Worker URL。ZHIPU_API_KEY 不进生产 bundle（见 ai.ts）。
 */

export const WORKER_URL = (import.meta as any).env?.PUBLIC_WORKER_URL || 'https://api-proxy.<you>.workers.dev';

export function workerHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    ...extra,
  };
}
