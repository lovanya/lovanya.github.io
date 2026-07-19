#!/usr/bin/env node
/**
 * 严格检查 AIAsk question 属性 + 内部链接
 * 不检查括号(太多假阳性)
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, basename } from 'node:path';

const ROOT = process.cwd();
const BLOG_DIR = join(ROOT, 'src/content/blog');
const EN_DIR = join(BLOG_DIR, 'en');

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (name.endsWith('.mdx') || name.endsWith('.md')) out.push(full);
  }
  return out;
}

const allFiles = [...walk(BLOG_DIR).filter(f => !f.includes('/en/')), ...walk(EN_DIR)];
const SLUGS = new Set();
for (const f of allFiles) SLUGS.add(basename(f, '.mdx'));

const ISSUES = [];

// === AIAsk 严格检查 ===
function checkAIAsk(file, content) {
  const lines = content.split('\n');
  lines.forEach((line, i) => {
    const re = /<AIAsk\s+([^>]+?)\/?>/g;
    let m;
    while ((m = re.exec(line)) !== null) {
      const attrs = m[1];
      // 必须有 question="..." 或 question='...'
      const qd = attrs.match(/question\s*=\s*"((?:[^"\\]|\\.)*)"/);
      const qs = attrs.match(/question\s*=\s*'((?:[^'\\]|\\.)*)'/);
      if (!qd && !qs) {
        ISSUES.push({ file, line: i + 1, severity: 'high', type: 'aiask-no-question', message: `<AIAsk> 缺少 question 属性: ${line.trim()}` });
        continue;
      }
      const value = qd ? qd[1] : qs[1];
      // 只检查双引号外层的情况:内部有 " 字符(未转义)会破坏外层 "
      // 单引号外层允许内部有 "
      if (qd) {
        // 内部不应该有 " (除了 \")
        const innerDoubleQuotes = (value.match(/(?<!\\)"/g) || []).length;
        if (innerDoubleQuotes > 0) {
          ISSUES.push({ file, line: i + 1, severity: 'high', type: 'aiask-broken-quote', message: `AIAsk question="..." 属性值内有未转义 " 字符: ${line.trim()}` });
        }
      }
    }
  });
}

// === 内部链接严格检查 ===
function checkInternalLinks(file, content) {
  const lines = content.split('\n');
  lines.forEach((line, i) => {
    // 匹配 /blog/<slug> 后面跟 ) 或 / 或 #
    const re = new RegExp('\\[([^\\]]+)\\]\\((\\/blog\\/([A-Za-z0-9_-]+))(?:\\.mdx)?(?:[?#/][^)]*)?\\)', 'g');
    let m;
    while ((m = re.exec(line)) !== null) {
      const slug = m[3];
      if (slug && !SLUGS.has(slug)) {
        ISSUES.push({ file, line: i + 1, severity: 'high', type: 'broken-link', message: `内部链接 /blog/${slug} 不存在 (共 ${SLUGS.size} 个博客)` });
      }
    }
  });
}

// === 关键损坏字符: 反引号/井号/特殊字符出现在意外位置 ===
function checkCorruption(file, content) {
  const lines = content.split('\n');
  lines.forEach((line, i) => {
    // 反引号不闭合
    const backticks = (line.match(/`/g) || []).length;
    // 单行内如果反引号是奇数,可能有错位
    if (backticks > 0 && backticks % 2 !== 0 && !line.includes('```')) {
      // 跳过 code block 行
      if (line.trim().startsWith('```') || line.trim().endsWith('```')) return;
      // 简单标记
      // ISSUES.push({ file, line: i + 1, severity: 'low', type: 'unpaired-backtick', message: `单行内反引号数量为奇数: ${line.trim().substring(0, 80)}` });
    }
  });
}

// === AIAsk / frontmatter 完整性 ===
function checkFrontmatter(file, content) {
  if (!content.startsWith('---\n')) {
    ISSUES.push({ file, line: 1, severity: 'high', type: 'no-frontmatter', message: '文件没有 frontmatter' });
    return;
  }
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!fmMatch) {
    ISSUES.push({ file, line: 1, severity: 'high', type: 'bad-frontmatter', message: 'frontmatter 格式错误' });
    return;
  }
  const fm = fmMatch[1];
  if (!/^title:/m.test(fm)) {
    ISSUES.push({ file, line: 1, severity: 'high', type: 'no-title', message: 'frontmatter 缺少 title' });
  }
  if (!/^pubDate:/m.test(fm)) {
    ISSUES.push({ file, line: 1, severity: 'high', type: 'no-pubdate', message: 'frontmatter 缺少 pubDate' });
  }
  if (!/^description:/m.test(fm)) {
    ISSUES.push({ file, line: 1, severity: 'high', type: 'no-description', message: 'frontmatter 缺少 description' });
  }
}

// === 中英文章对应(已经做了,但再确认) ===
function checkBilingual() {
  const zhFiles = allFiles.filter(f => !f.includes('/en/'));
  const enFiles = allFiles.filter(f => f.includes('/en/'));
  const zhSlugs = new Set(zhFiles.map(f => basename(f, '.mdx')));
  const enSlugs = new Set(enFiles.map(f => basename(f, '.mdx')));
  for (const slug of zhSlugs) {
    if (!enSlugs.has(slug)) {
      ISSUES.push({ file: `src/content/blog/${slug}.mdx`, line: 0, severity: 'high', type: 'no-en', message: `中文版 ${slug} 缺少英文版` });
    }
  }
  for (const slug of enSlugs) {
    if (!zhSlugs.has(slug)) {
      ISSUES.push({ file: `src/content/blog/en/${slug}.mdx`, line: 0, severity: 'high', type: 'no-zh', message: `英文版 ${slug} 缺少中文版` });
    }
  }
}

// === 主流程 ===
allFiles.forEach(file => {
  const content = readFileSync(file, 'utf-8');
  checkFrontmatter(file, content);
  checkAIAsk(file, content);
  checkInternalLinks(file, content);
});
checkBilingual();

// === 输出 ===
if (ISSUES.length === 0) {
  console.log('✅ 关键检查全部通过,无问题。');
} else {
  const high = ISSUES.filter(i => i.severity === 'high');
  const low = ISSUES.filter(i => i.severity === 'low');
  console.log(`共发现 ${ISSUES.length} 个问题 (high: ${high.length}, low: ${low.length})\n`);

  if (high.length) {
    console.log('=== HIGH ===');
    for (const i of high) {
      console.log(`  ${i.file}:${i.line}  [${i.type}]\n    ${i.message}\n`);
    }
  }
  if (low.length) {
    console.log('=== LOW (前 30) ===');
    for (const i of low.slice(0, 30)) {
      console.log(`  ${i.file}:${i.line}  [${i.type}]\n    ${i.message}\n`);
    }
    if (low.length > 30) console.log(`  ... 还有 ${low.length - 30} 项`);
  }
}
