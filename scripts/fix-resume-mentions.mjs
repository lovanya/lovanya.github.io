import { readFileSync, writeFileSync } from 'node:fs';

const ZH_FILES = [
  'admin-backend-patterns',
  'angular-enterprise-di-rxjs',
  'build-tools-webpack-vite-rspack',
  'client-ai-future-of-frontend',
  'css-html5-advanced',
  'electron-desktop-app',
  'enterprise-ui-component-library',
  'first-screen-performance-optimization',
  'framework-history-mvvm',
  'frontend-architecture-cultivation-path',
  'frontend-engineering-ci-cd',
  'frontend-monitoring',
  'frontend-security-xss-csrf',
  'frontend-testing-pyramid',
  'how-browser-renders-page',
  'http-network-advanced',
  'hybrid-dev-taro-uniapp-ionic',
  'iframe-postmessage-microfrontend',
  'js-v8-gc-eventloop',
  'lowcode-platform-design',
  'microfrontend-module-federation',
  'package-management-monorepo',
  'rbac-permission-system',
  'react-fiber-hooks-concurrent',
  'responsive-mobile-adaptation',
  'runtime-performance-virtual-scrolling',
  'senior-to-architect',
  'typescript-advanced-types',
  'vue-reactivity-composition',
  'web-components-cross-framework',
];

// Chinese substitutions — remove "简历里" lead phrases and rephrase.
const ZH_SUBS = [
  // "**简历里" → "**"  (inside bold)
  [/\*\*简历里/g, '**'],
  // "简历里" + space (after punctuation / start of sentence)
  [/简历里 /g, ''],
  // standalone "简历里" → ''
  [/简历里/g, ''],
  // 简历对照 / 简历实战锚点 — section renames (in prologue only)
  [/系列导论 \+ 阅读路径 \+ 简历对照/g,
    '系列导论 + 阅读路径 + 知识对照'],
  [/简历实战锚点（how I did it）—— 这是我和别人的最大区别：用生产数据讲透/g,
    '实战锚点（落地经验）—— 把生产数据和架构原理结合讲透'],
  [/## 五、简历技术栈 vs 全系列对照/g,
    '## 五、知识体系 vs 全系列对照'],
  [/\| 简历标签 \| 对应篇 \|/g, '| 知识主题 | 对应篇 |'],
  [/表格左列都是简历里出现过的；右列是对应的深入阅读。\*\*不止于简历\*\*——本系列还覆盖了简历里没写、但同样重要的底层原理（V8 \/ 浏览器 \/ 安全 \/ TS）以及架构师视角的软技能（第 29 篇）。/g,
    '表格左列是常见架构师必备主题；右列是对应的深入阅读。**不止于此**——本系列还覆盖了常被忽视但同样重要的底层原理（V8 / 浏览器 / 安全 / TS）以及架构师视角的软技能（第 29 篇）。'],
  [/## 简历实战锚点/g, '## 实战锚点'],
  // Second-person in body text — preface reading path
  [/- 你是 1-2 年的初级工程师 → 从练气期第 1 篇开始/g,
    '- 1-2 年经验的初级工程师 → 从练气期第 1 篇开始'],
  [/- 你是 3-4 年的中级工程师 → 跳过浏览器基础，从 TypeScript 或 HTTP 开始/g,
    '- 3-4 年经验的中级工程师 → 跳过浏览器基础，从 TypeScript 或 HTTP 开始'],
  [/- 你是 5-7 年的资深工程师 → 从筑基期框架对比开始，重点攻金丹期/g,
    '- 5-7 年经验的资深工程师 → 从筑基期框架对比开始，重点攻金丹期'],
  [/- 你是 8\+ 年的架构师 → 直接进元婴 \+ 化神，把练气和筑基当查手册/g,
    '- 8+ 年经验的架构师 → 直接进元婴 + 化神，把练气和筑基当查手册'],
  // Body text second-person — minor rephrases
  [/这正是你要的"按比例分配剩余空间"/g,
    '这正是"按比例分配剩余空间"的核心设计'],
  [/通常不是你想要的/g, '通常并非期望效果'],
  [/依赖你的组件库/g, '依赖该组件库'],
  [/说明你能把优化落地到生产/g, '说明能将优化落地到生产'],
  [/说明你能把优化落地到生产/g, '说明能将优化落地到生产'],
  [/如果你看到 `left` \/ `top` \/ `width` 在被高频改动/g, '如发现 `left` / `top` / `width` 在被高频改动'],
  [/如果你看到 left \/ top \/ width 在被高频改动/g, '如发现 left / top / width 在被高频改动'],
  [/从你当前的境界开始/g, '从读者当前的境界开始'],
];

// English body text second-person rephrases (interview Q&A keep "your")
const EN_BODY_SUBS = [
  [/50 business teams depend on your component library/g,
    '50 business teams depend on the component library'],
  [/Start from your current stage/g, 'Start from the current stage'],
  [/you're just tuning the framework layer blindly/g,
    'the result is tuning the framework layer blindly'],
  [/your first paint is delayed/g, 'the first paint is delayed'],
  [/don't report FP as your first-screen metric/g,
    "don't report FP as the first-screen metric"],
  [/once you're on HTTPS/g, 'once HTTPS is enforced'],
  [/Technology selection stops fooling you/g,
    'Technology selection stops being guesswork'],
];

// English substitutions
const EN_SUBS = [
  // "The "X" on resume is Y" → ""X" is Y"
  [/The "([^"]+)" on resume is/g, '"$1" is'],
  [/The ([A-Za-z0-9 +\-/]+?) on resume is/g, 'The $1 is'],
  // "The resume mentions "X"..." — flexible trailing
  [/The resume mentions "([^"]+)"\.?\*?\*? ?/g, '"$1"'],
  // Body text "on resume" / "resume line" / "on my resume"
  [/on my resume/g, ''],
  [/The ([A-Za-z0-9 +\-/]+?) on resume/g, 'The $1'],
  [/on resume/g, ''],
  [/A resume that lists/g, 'A track record that lists'],
  [/resume line "/g, '"'],
  [/resume line \*\*/g, '**'],
  [/resume's core architecture is/g, "core architecture is"],
  [/resume's core architecture/g, 'core architecture'],
  // Prologue renames
  [/Series intro \+ reading paths \+ resume mapping/g,
    'Series intro + reading paths + knowledge mapping'],
  [/The real source of the resume's 12min → 3min build and 4\.2s → 1\.8s first-paint numbers\./g,
    'The real source of the 12min → 3min build and 4.2s → 1.8s first-paint optimizations.'],
  [/Left column shows what's on the resume; right column shows where to deepen\. \*\*Beyond the resume\*\* — this series also covers resume-absent-but-essential fundamentals \(V8 \/ browser \/ security \/ TS\) and architect-view soft skills \(#29\)\./g,
    "Left column shows what's needed; right column shows where to deepen. **Beyond the basics** — this series also covers often-overlooked fundamentals (V8 / browser / security / TS) and architect-view soft skills (#29)."],
];

let totalZhChanges = 0;
let totalEnChanges = 0;

function processFile(file, subs, isEn) {
  let content;
  try {
    content = readFileSync(file, 'utf-8');
  } catch (e) {
    return 0;
  }

  const before = content;
  for (const [re, rep] of subs) {
    content = content.replace(re, rep);
  }

  if (content !== before) {
    writeFileSync(file, content, 'utf-8');
    const delta = before.length - content.length;
    console.log(`${isEn ? 'EN' : 'ZH'}: ${file} (-${Math.abs(delta)} chars)`);
    return 1;
  }
  return 0;
}

for (const name of ZH_FILES) {
  totalZhChanges += processFile(`src/content/blog/${name}.mdx`, ZH_SUBS, false);
}

for (const name of ZH_FILES) {
  totalEnChanges += processFile(`src/content/blog/en/${name}.mdx`, [...EN_SUBS, ...EN_BODY_SUBS], true);
}

console.log(`\nDone. ZH modified: ${totalZhChanges}, EN modified: ${totalEnChanges}`);