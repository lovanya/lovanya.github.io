// @ts-check

import mdx from '@astrojs/mdx';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';
import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import Mermaid from './src/components/Blog/Mermaid.tsx';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Read post frontmatter at config time so the sitemap can use real
// pubDate / updatedDate / heroImage without depending on astro:content
// (which is not available in astro.config.mjs).
const frontmatterCache = new Map();
function loadFrontmatter(dir, prefix = '') {
  if (!existsSync(dir)) return;
  for (const file of readdirSync(dir)) {
    if (!file.endsWith('.mdx') && !file.endsWith('.md')) continue;
    const fp = join(dir, file);
    const slug = file.replace(/\.mdx?$/, '');
    const id = prefix ? `${prefix}/${slug}` : slug;
    const content = readFileSync(fp, 'utf-8');
    const m = content.match(/^---\n([\s\S]*?)\n---/);
    if (!m) continue;
    const fm = m[1];
    const get = (key) => {
      const re = new RegExp(`^${key}:\\s*(.+)$`, 'm');
      const v = fm.match(re);
      return v ? v[1].trim().replace(/^["']|["']$/g, '') : undefined;
    };
    frontmatterCache.set(id, {
      pubDate: get('pubDate'),
      updatedDate: get('updatedDate'),
      heroImage: get('heroImage'),
      title: get('title'),
    });
  }
}
loadFrontmatter(join(__dirname, 'src/content/blog'));
loadFrontmatter(join(__dirname, 'src/content/blog/en'), 'en');

// Map a sitemap URL path → cached frontmatter key
function lookupPost(pathname) {
  const isEn = pathname.startsWith('/en/');
  const slug = pathname.replace(/^\/(en\/)?blog\//, '').replace(/\/$/, '');
  if (!slug || slug === 'blog') return null;
  return frontmatterCache.get(slug) || frontmatterCache.get(`en/${slug}`);
}

export default defineConfig({
  site: 'https://lovanya.github.io',
  integrations: [
    mdx({
      // Make <Mermaid client:load chart={...} /> work in every MDX file
      // without an explicit import.
      components: { Mermaid },
    }),
    react(),
    sitemap({
      // Bilingual hreflang auto-generated from URL structure
      i18n: {
        defaultLocale: 'zh',
        locales: {
          zh: 'zh-CN',
          en: 'en',
        },
      },
      // Sensible defaults; per-URL values come from serialize()
      changefreq: 'monthly',
      priority: 0.5,
      // Per-URL customization: real lastmod from frontmatter, hreflang, priority
      serialize: (item) => {
        const url = new URL(item.url);
        const path = url.pathname;
        const cleanPath = path.replace(/^\/en/, '').replace(/\/$/, '') || '/';
        const origin = url.origin;

        let priority = 0.5;
        let changefreq = 'monthly';
        let lastmod = item.lastmod;

        if (cleanPath === '/') {
          priority = 1.0;
          changefreq = 'weekly';
        } else if (cleanPath === '/blog') {
          priority = 0.9;
          changefreq = 'daily';
        } else if (cleanPath === '/about') {
          priority = 0.7;
          changefreq = 'monthly';
        } else if (cleanPath.startsWith('/blog/')) {
          priority = 0.8;
          changefreq = 'monthly';
          const post = lookupPost(path);
          if (post) {
            const lm = post.updatedDate || post.pubDate;
            if (lm) lastmod = new Date(lm).toISOString();
          }
        }

        // Manual hreflang — the i18n config can't infer the en/ prefix
        // pattern from Astro's prefixDefaultLocale:false routing
        const links = [];
        if (path.startsWith('/en/')) {
          const zhPath = path.replace(/^\/en/, '') || '/';
          links.push({ lang: 'zh-CN', url: `${origin}${zhPath}` });
          links.push({ lang: 'en', url: item.url });
          links.push({ lang: 'x-default', url: `${origin}${zhPath}` });
        } else {
          const enPath = `/en${path === '/' ? '' : path}`;
          links.push({ lang: 'zh-CN', url: item.url });
          links.push({ lang: 'en', url: `${origin}${enPath}` });
          links.push({ lang: 'x-default', url: item.url });
        }

        return { url: item.url, lastmod, changefreq, priority, links };
      },
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
  i18n: {
    defaultLocale: 'zh',
    locales: ['zh', 'en'],
    routing: {
      prefixDefaultLocale: false,
    },
  },
  markdown: {
    shikiConfig: {
      themes: {
        light: 'github-light',
        dark: 'github-dark',
      },
      wrap: true,
    },
  },
  build: {
    // 启用内联样式表以减少请求数
    inlineStylesheets: 'auto',
  },
  compressHTML: true,
  prefetch: {
    prefetchAll: true,
    defaultStrategy: 'viewport',
  },
});
