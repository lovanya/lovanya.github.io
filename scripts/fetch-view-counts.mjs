// Fetch GoatCounter view counts for all blog posts at build time.
// Writes a JSON map at public/view-counts.json read by ViewCount.astro.
import { readdirSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const COUNTER_API = 'https://purpletooth.goatcounter.com/counter';
const CONTENT_DIR = resolve('src/content/blog');
const OUTPUT_FILE = resolve('src/data/view-counts.json');

function getSlugs(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter(f => f.endsWith('.mdx'))
    .map(f => f.replace(/\.mdx$/, ''));
}

async function fetchCount(slug, prefix = '') {
  // GoatCounter paths: /blog/{slug}/ for zh, /en/blog/{slug}/ for en
  const path = prefix ? `/${prefix}/blog/${slug}/` : `/blog/${slug}/`;
  const url = `${COUNTER_API}${path}.json`;
  try {
    const resp = await fetch(url);
    const data = await resp.json();
    return { count: data.count, count_unique: data.count_unique };
  } catch {
    return { count: '0', count_unique: '0' };
  }
}

async function main() {
  const slugs = getSlugs(CONTENT_DIR);
  const counts = {};
  for (const slug of slugs) {
    if (slug === 'en') continue;
    const zh = await fetchCount(slug);
    const en = await fetchCount(slug, 'en');
    counts[slug] = { zh: zh.count, en: en.count };
    process.stdout.write(`  ${slug}: zh=${zh.count} en=${en.count}\n`);
  }
  writeFileSync(OUTPUT_FILE, JSON.stringify(counts, null, 2));
  process.stdout.write(`\nWrote ${Object.keys(counts).length} post counts to ${OUTPUT_FILE}\n`);
}

main().catch(e => { console.error(e); process.exit(1); });
