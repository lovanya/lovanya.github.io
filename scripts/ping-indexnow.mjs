#!/usr/bin/env node
// Ping IndexNow with every URL from dist/sitemap-0.xml after each build.
// Covers Bing / Yandex / Naver / Seznam / DuckDuckGo in one shot.
// Docs: https://www.indexnow.org/

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DIST = join(ROOT, 'dist');
const SITEMAP = join(DIST, 'sitemap-0.xml');

// Find the key file in public/ (Bing naming: {key}.txt)
import { readdirSync } from 'fs';
const publicDir = join(ROOT, 'public');
const keyFile = readdirSync(publicDir).find(f => /^[a-f0-9]{32}\.txt$/.test(f));
if (!keyFile) {
  console.log('[indexnow] no key file in public/, skipping');
  process.exit(0);
}
const KEY = readFileSync(join(publicDir, keyFile), 'utf-8').trim();

if (!existsSync(DIST) || !existsSync(SITEMAP)) {
  console.log('[indexnow] dist/ or sitemap-0.xml not found, skipping');
  process.exit(0);
}

const sitemap = readFileSync(SITEMAP, 'utf-8');
const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);

if (urls.length === 0) {
  console.log('[indexnow] no URLs in sitemap, skipping');
  process.exit(0);
}

const host = new URL(urls[0]).host;

try {
  const res = await fetch('https://api.indexnow.org/indexnow', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ host, key: KEY, urlList: urls }),
  });

  // 200 = all OK, 202 = accepted (some URLs unknown), 4xx = bad request
  if (res.status === 200) {
    console.log(`[indexnow] ✓ submitted ${urls.length} URLs to Bing/Yandex/Naver`);
  } else if (res.status === 202) {
    console.log(`[indexnow] ✓ accepted ${urls.length} URLs (202 — some may be unknown to this engine)`);
  } else {
    console.log(`[indexnow] ✗ ${res.status} ${res.statusText}: ${await res.text()}`);
  }
} catch (e) {
  console.log(`[indexnow] ✗ fetch failed: ${e.message}`);
}
