import { readFileSync, writeFileSync } from 'node:fs';

const FILES = [
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

// Chinese: replace specific private company names with generic phrasing
const ZH_SUBS = [
  // 顺丰 ERP / 顺丰+柔宇
  [/顺丰 ERP/g, '大型 ERP'],
  [/顺丰/g, ''],
  // 柔宇 / 柔记
  [/柔记 PC 端/g, '带 USB 硬件通信的桌面应用'],
  [/柔记/g, ''],
  [/柔宇/g, ''],
  // 信锐 / 联友
  [/信锐 \/ 联友/g, '多家企业'],
  [/信锐时期 /g, ''],
  [/信锐/g, ''],
  [/联友/g, ''],
  // 8 个跨 Vue\/React 通用组件 / 12min→3min / 4.2s → 1.8s — keep numbers but remove the "简历里" framing already done
  // "iView (柔宇" — already partial. fix remaining
  [/\(柔宇,/g, '(某企业,'],  // In component lib parenthetical
  // cleanup orphaned commas after removal
  [/某企业,/g, '某企业'],
];

// English equivalents
const EN_SUBS = [
  [/SF Express ERP/g, 'large ERP'],
  [/SF Express \+ Rouyu/g, 'multi-project'],
  [/SF Express/g, ''],
  [/Rouyu PC client/g, 'USB-hardware desktop app'],
  [/Rouyu/g, ''],
  [/Xinrui \/ Lianyou/g, 'multi-enterprise'],
  [/Xinrui era /g, ''],
  [/Xinrui/g, ''],
  [/Lianyou/g, ''],
  [/\(Rouyu,/g, '(enterprise,'], // In component lib parenthetical
];

let zhChanges = 0, enChanges = 0;

for (const name of FILES) {
  for (const [file, subs, isEn] of [
    [`src/content/blog/${name}.mdx`, ZH_SUBS, false],
    [`src/content/blog/en/${name}.mdx`, EN_SUBS, true],
  ]) {
    let content;
    try {
      content = readFileSync(file, 'utf-8');
    } catch (e) { continue; }
    const before = content;
    for (const [re, rep] of subs) content = content.replace(re, rep);
    if (content !== before) {
      writeFileSync(file, content, 'utf-8');
      if (isEn) enChanges++; else zhChanges++;
    }
  }
}

console.log(`ZH modified: ${zhChanges}, EN modified: ${enChanges}`);