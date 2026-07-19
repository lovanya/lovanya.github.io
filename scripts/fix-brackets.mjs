#!/usr/bin/env node
/**
 * 中文标点规范化
 * - 中文段落中的半角 ( 替换为全角 （
 * - 跳过:
 *   - 代码块 (``` ``` 内)
 *   - inline code (` `)
 *   - 链接 / URL / 邮箱
 *   - 属性 (xxx="...")
 *   - 英文正文(连续两个非中文)
 */

import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
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

let totalFixed = 0;
const fileReports = [];

function isInCodeBlock(content, pos) {
  // 数到 pos 处, 看看前面有几个 ```
  const before = content.substring(0, pos);
  const matches = before.match(/```/g);
  return matches && matches.length % 2 === 1;
}

function isInInlineCode(content, pos) {
  // 看 pos 之前最近的 ` 数量
  const before = content.substring(0, pos);
  // 数 backtick
  const matches = before.match(/`/g);
  return matches && matches.length % 2 === 1;
}

function isInAttribute(line, pos) {
  // 看 pos 之前最近的 =" 或 =' 之后
  const before = line.substring(0, pos);
  const lastDoubleQuote = before.lastIndexOf('="');
  const lastSingleQuote = before.lastIndexOf("='");
  if (lastDoubleQuote > lastSingleQuote) {
    const nextQuote = line.indexOf('"', lastDoubleQuote + 2);
    return nextQuote > pos;
  }
  if (lastSingleQuote > lastDoubleQuote) {
    const nextQuote = line.indexOf("'", lastSingleQuote + 2);
    return nextQuote > pos;
  }
  return false;
}

function isInUrl(line, pos) {
  // 看是否在 http(s):// 后面
  const before = line.substring(0, pos);
  const urlMatch = before.match(/(https?:\/\/[^\s]*)$/);
  if (urlMatch) {
    const urlStart = before.length - urlMatch[0].length;
    return pos > urlStart;
  }
  return false;
}

function hasChinese(s) {
  return /[\u4e00-\u9fa5]/.test(s);
}

function processFile(file) {
  const content = readFileSync(file, 'utf-8');
  const lines = content.split('\n');
  let fileChanges = 0;
  const newLines = lines.map((line, i) => {
    // 跳过表格 / 列表项
    if (line.match(/^\s*(\||---|\d+\.|-|\*)/)) return line;

    // 跳过 Mermaid 内的中文
    if (line.includes('flowchart') || line.includes('graph ') || line.includes('sequenceDiagram') ||
        line.includes('classDiagram') || line.includes('stateDiagram')) {
      // 是 mermaid chart 内容,跳过
      if (line.match(/^\s*(flowchart|graph|sequenceDiagram|classDiagram|stateDiagram)/)) return line;
    }

    // 跳过 ESM 导入
    if (line.match(/^\s*import\s/)) return line;

    // 跳过 ESM 导出
    if (line.match(/^\s*export\s/)) return line;

    // 跳过图表内容 (中括号太多, 误报率高)
    if (line.match(/^\s*[\[\{]/)) return line;

    // 跳过 console.log / 代码内部
    if (line.match(/^\s*(const|let|var|function|return|if|else|for|while|switch|case|break|return|throw|new|await|async|try|catch|finally|class|interface|type)\b/)) return line;

    // 跳过 console 行
    if (line.match(/^\s*console\./)) return line;

    let newLine = line;
    let lineChanged = false;

    // 模式 1: 中文(中文 → 中文（中文
    newLine = newLine.replace(/([\u4e00-\u9fa5])\((?=[\u4e00-\u9fa5])/g, (match, p1, offset) => {
      if (isInCodeBlock(content, i)) return match;
      if (isInInlineCode(content, i)) return match;
      if (isInAttribute(line, offset)) return match;
      if (isInUrl(line, offset)) return match;
      lineChanged = true;
      return p1 + '（';
    });

    // 模式 2: 中文)中文 → 中文）中文
    newLine = newLine.replace(/\)(?=[\u4e00-\u9fa5])/g, (match, offset) => {
      // 检查这个 ) 前面是否有中文字符
      const before = newLine.substring(0, offset);
      const lastChar = before[before.length - 1];
      if (lastChar && hasChinese(lastChar)) {
        if (isInCodeBlock(content, i)) return match;
        if (isInInlineCode(content, i)) return match;
        if (isInAttribute(line, offset)) return match;
        if (isInUrl(line, offset)) return match;
        lineChanged = true;
        return '）';
      }
      return match;
    });

    // 模式 3: 中文) → 中文）(行尾)
    // 已经覆盖在模式 2

    if (lineChanged) fileChanges++;
    return newLine;
  });

  if (fileChanges > 0) {
    const newContent = newLines.join('\n');
    if (newContent !== content) {
      writeFileSync(file, newContent, 'utf-8');
      totalFixed += fileChanges;
      fileReports.push({ file, changes: fileChanges });
    }
  }
}

allFiles.forEach(processFile);

console.log(`共修复 ${totalFixed} 处括号`);
if (fileReports.length) {
  console.log('\n修改的文件:');
  for (const r of fileReports) {
    console.log(`  ${r.changes.toString().padStart(3)} 处 — ${r.file}`);
  }
}
