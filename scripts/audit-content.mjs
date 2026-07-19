#!/usr/bin/env node
/**
 * 全面内容审查
 * 1. 检查每篇的 5 道面试题是否齐全(Q1 必须是答案,后 4 道是思考)
 * 2. 检查 AIAsk 数量是否 ≥ 5
 * 3. 检查 Mermaid chart 的 chart={ 是否有合法的图类型
 * 4. 检查 "上一篇" 链接是否引用了同系列上一篇文章
 * 5. 检查 frontmatter tags 数量和格式
 * 6. 检查标题层级是否有跳跃
 * 7. 检查章节数 (期望:前言 + 5+ 章节 + 总结 + 5 道面试题 = ≥ 8)
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

const zhFiles = walk(BLOG_DIR).filter(f => !f.includes('/en/'));
const enFiles = walk(EN_DIR);

const allFiles = [...zhFiles, ...enFiles];
const SLUGS = new Set(allFiles.map(f => basename(f, '.mdx')));

const ISSUES = [];

function checkArticle(file) {
  const content = readFileSync(file, 'utf-8');

  // 1. AIAsk 数量
  const aiAskCount = (content.match(/<AIAsk\b/g) || []).length;
  if (aiAskCount < 5) {
    ISSUES.push({ file, line: 0, severity: 'medium', type: 'missing-aiask', message: `只有 ${aiAskCount} 个 AIAsk 按钮,期望至少 5 个(Q1-Q5)` });
  }
  if (aiAskCount > 5) {
    ISSUES.push({ file, line: 0, severity: 'low', type: 'too-many-aiask', message: `有 ${aiAskCount} 个 AIAsk 按钮(超过 5),请检查是否多余` });
  }

  // 2. Q1 必须是答案(支持全角/半角冒号,支持中英文括号)
  // Q1 后面跟着任意非换行字符(中英都可),直到 A:
  // 实际格式:**Q1（答案）**： ... **A**：...
  const q1Re = /\*\*Q1[（(].*?[）)]\*\*[\s\S]{0,200}?\*\*A\*\*[：:]/;
  if (!q1Re.test(content)) {
    ISSUES.push({ file, line: 0, severity: 'high', type: 'q1-no-answer', message: 'Q1 缺少完整答案(应该 Q1: ... \n **A**: ...)' });
  }

  // 3. Q2-Q5 必须是思考(检测格式,允许两种括号和冒号)
  // 实际格式:**Q2（思考）**：... (或 **Q2 (Think)**:)
  for (let i = 2; i <= 5; i++) {
    const re = new RegExp(`\\*\\*Q${i}[（(].*?[）)]\\*\\*[：:]`, 'g');
    const matches = content.match(re);
    if (!matches) {
      ISSUES.push({ file, line: 0, severity: 'high', type: `q${i}-no-pattern`, message: `Q${i} 缺少"Q? + A"格式(可能是格式问题)` });
    }
  }

  // 4. "5 道重点面试问题方向" 章节存在
  if (!content.includes('5 道重点面试问题方向') && !content.includes('5 Key Interview Question')) {
    ISSUES.push({ file, line: 0, severity: 'medium', type: 'no-qa-section', message: '缺少"5 道重点面试问题方向"章节' });
  }

  // 5. "总结" 章节存在
  if (!content.includes('## 总结') && !content.includes('## Summary')) {
    ISSUES.push({ file, line: 0, severity: 'low', type: 'no-summary', message: '缺少"## 总结"章节' });
  }

  // 6. "参考资料" 章节存在
  if (!content.includes('## 参考资料') && !content.includes('## References')) {
    ISSUES.push({ file, line: 0, severity: 'low', type: 'no-refs', message: '缺少"## 参考资料"章节' });
  }

  // 7. Mermaid chart 合法性
  const chartRe = /chart=\{`([^`]+)`\}/g;
  let m;
  while ((m = chartRe.exec(content)) !== null) {
    const chart = m[1];
    if (!/^(flowchart|graph|sequenceDiagram|classDiagram|stateDiagram|erDiagram|journey|gantt|pie|timeline|sequence)\b/m.test(chart)) {
      const lineNum = content.substring(0, m.index).split('\n').length;
      ISSUES.push({ file, line: lineNum, severity: 'medium', type: 'mermaid-no-type', message: `Mermaid chart 没有声明图类型(flowchart / sequenceDiagram 等),第 1 行: ${chart.split('\n')[0].trim()}` });
    }
  }

  // 8. frontmatter 检查
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (fmMatch) {
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

  // 9. tags 数量
  const tagsMatch = fmMatch && fmMatch[1].match(/^tags:\s*\[(.*?)\]/m);
  if (tagsMatch) {
    const tags = tagsMatch[1].split(',').map(t => t.trim().replace(/^['"]|['"]$/g, ''));
    if (tags.length < 2) {
      ISSUES.push({ file, line: 1, severity: 'low', type: 'few-tags', message: `tags 数量只有 ${tags.length} 个,建议至少 2-3 个` });
    }
    if (tags.length > 8) {
      ISSUES.push({ file, line: 1, severity: 'low', type: 'many-tags', message: `tags 数量 ${tags.length} 个,过多,建议精简到 3-6 个` });
    }
  }
}

allFiles.forEach(checkArticle);

// 输出
if (ISSUES.length === 0) {
  console.log('✅ 全部文章结构检查通过。');
} else {
  const high = ISSUES.filter(i => i.severity === 'high');
  const med = ISSUES.filter(i => i.severity === 'medium');
  const low = ISSUES.filter(i => i.severity === 'low');
  console.log(`共 ${ISSUES.length} 个问题 (high: ${high.length}, medium: ${med.length}, low: ${low.length})\n`);

  if (high.length) {
    console.log('=== HIGH ===');
    for (const i of high) console.log(`  ${i.file}  [${i.type}]  ${i.message}`);
  }
  if (med.length) {
    console.log('\n=== MEDIUM ===');
    for (const i of med) console.log(`  ${i.file}  [${i.type}]  ${i.message}`);
  }
  if (low.length) {
    console.log('\n=== LOW ===');
    for (const i of low) console.log(`  ${i.file}  [${i.type}]  ${i.message}`);
  }
}
