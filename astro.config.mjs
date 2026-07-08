// @ts-check

import mdx from '@astrojs/mdx';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://lovanya.github.io',
  integrations: [
    mdx(),
    react(),
    sitemap({
      // 自定义 URL 及其优先级和最后修改时间
      changefreq: 'weekly',
      priority: 0.7,
      lastmod: new Date(),
      // 不包含的页面（如果有的话）
      // filter: (page) => !page.includes('/private/'),
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
