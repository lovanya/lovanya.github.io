export interface Skill {
  name: string;
  nameEn: string;
  level: number;
  category: string;
}

export interface Experience {
  company: string;
  companyEn: string;
  role: string;
  roleEn: string;
  period: string;
  highlights: string[];
  highlightsEn: string[];
}

export interface Project {
  name: string;
  nameEn: string;
  role: string;
  roleEn: string;
  period: string;
  stack: string[];
  description: string;
  descriptionEn: string;
  highlights: string[];
  highlightsEn: string[];
}

export interface TechCategory {
  name: string;
  nameEn: string;
  items: string[];
}

export const skills: Skill[] = [
  { name: '架构设计', nameEn: 'Architecture', level: 95, category: 'core' },
  { name: '性能优化', nameEn: 'Performance', level: 90, category: 'core' },
  { name: '跨端开发', nameEn: 'Cross-Platform', level: 88, category: 'core' },
  { name: '团队管理', nameEn: 'Team Leadership', level: 85, category: 'core' },
  { name: '前端工程化', nameEn: 'Engineering', level: 92, category: 'core' },
  { name: '大型中后台', nameEn: 'Enterprise Apps', level: 93, category: 'core' },
];

export const experience: Experience[] = [
  {
    company: '顺丰科技有限公司',
    companyEn: 'SF Express Technology Co., Ltd.',
    role: '高级前端开发工程师',
    roleEn: 'Senior Frontend Engineer',
    period: '2022.01 – 2026.04',
    highlights: [
      '主导 ERP 财务系统全栈重构项目前端架构，系统承载 800+ 页面，覆盖应收/应付/总账/报表/合并全财务链路',
      '主导微前端架构（模块联邦）设计与落地，支持多团队独立开发、独立部署，构建耗时从 12min 降至 3min',
      '主导 FinSpread 自研工具研发，通过 iframe 隔离 SpreadJS 能力，降低授权成本约 30%',
      '搭建半低码方案：抽象 20+ 高频模式化页面模板，需求交付周期缩短 60%',
      '设计统一的错误监控与性能埋点体系（Sentry + 自研 SDK），线上问题发现率提升 80%',
      '管理 3-5 人外包团队，负责需求拆分、Code Review、技术方案评审',
      '主导性能优化专项：首屏加载时间从 4.2s 降至 1.8s（路由懒加载 + 资源预加载 + CDN）',
    ],
    highlightsEn: [
      'Led frontend architecture for ERP financial system full-stack rebuild (800+ pages, full financial chain)',
      'Designed Module Federation micro-frontend architecture, build time reduced from 12min to 3min',
      'Built FinSpread tool via iframe isolation, reducing SpreadJS licensing costs by ~30%',
      'Built semi-low-code system with 20+ page templates, delivery cycle reduced by 60%',
      'Designed unified error monitoring & performance tracking (Sentry + custom SDK)',
      'Managed 3-5 person contractor team with code review and tech review',
      'Led performance optimization: first-load from 4.2s to 1.8s',
    ],
  },
  {
    company: '深圳柔宇电子技术有限公司',
    companyEn: 'Shenzhen Royole Technologies',
    role: '高级前端开发工程师',
    roleEn: 'Senior Frontend Engineer',
    period: '2018.09 – 2021.12',
    highlights: [
      '主导 SSO 统一权限管理系统架构设计，打通 5+ 业务线后台的统一登录、统一授权、统一审计',
      '实现基于 RBAC 的动态路由系统，支持按钮级权限控制，覆盖 500+ 内部用户',
      '自研基于 iView 的企业级 UI 组件库（20+ 组件），被部门所有管理系统复用，开发效率提升约 40%',
      '主导制定 RESTful API 规范与前端开发规范，推动前后端协作效率提升',
      '搭建前端监控体系（埋点 + 性能采集 + 异常上报），输出月度前端质量报告',
    ],
    highlightsEn: [
      'Architected SSO unified permission management system across 5+ business lines for 500+ users',
      'Implemented RBAC-based dynamic routing with button-level permission control',
      'Built enterprise UI component library (20+ components) based on iView, improving efficiency by ~40%',
      'Defined RESTful API & coding standards, improving cross-team collaboration',
      'Set up frontend monitoring (analytics + performance + error reporting)',
    ],
  },
  {
    company: '深圳信锐网科技术有限公司',
    companyEn: 'Shenzhen Sundray Technologies',
    role: '前端开发工程师',
    roleEn: 'Frontend Engineer',
    period: '2017.06 – 2018.07',
    highlights: [
      '负责信锐云管理平台前端架构，使用 Vue.js + Webpack 构建企业级网络设备管理系统',
      '使用 Ionic + Angular + TypeScript 开发移动端 App，实现网络设备远程管控',
      '搭建 Node.js Mock Server，支持团队离线开发与接口联调',
      '参与前端工程化建设：Webpack 配置优化、HMR 热更新、代码分割',
    ],
    highlightsEn: [
      'Led frontend architecture for Cloud Management Platform using Vue.js + Webpack',
      'Built mobile app using Ionic + Angular + TypeScript for remote device management',
      'Built Node.js Mock Server for offline development and API integration',
      'Contributed to frontend engineering: Webpack optimization, HMR, code splitting',
    ],
  },
  {
    company: '深圳联友科技有限公司',
    companyEn: 'Shenzhen Lianyou Technology Co., Ltd.',
    role: '前端开发工程师',
    roleEn: 'Frontend Engineer',
    period: '2015.07 – 2017.03',
    highlights: [
      '使用 Framework7 + Cordova 开发多款企业移动端 App（OA 审批、考勤、巡检）',
      '使用 EasyUI + jQuery 开发 PC 端 OA 系统，实现流程审批、报表展示等核心功能',
      '获得早期混合跨端开发经验：Cordova 插件开发、原生桥接、离线缓存',
      '参与需求分析与技术方案设计，与产品经理、后端工程师紧密协作',
    ],
    highlightsEn: [
      'Built enterprise mobile apps using Framework7 + Cordova (OA approval, attendance, inspection)',
      'Developed PC-side OA system using EasyUI + jQuery',
      'Gained early hybrid cross-platform experience: Cordova plugins, native bridge, offline caching',
      'Participated in requirements analysis and technical design, closely collaborating with PM and backend team',
    ],
  },
];

export const projects: Project[] = [
  {
    name: 'ERP 财务系统全栈重构',
    nameEn: 'ERP Financial System Full-Stack Rebuild',
    role: '前端架构师',
    roleEn: 'Frontend Architect',
    period: '2024.06 – 2026.04',
    stack: ['Vue 3', 'Vite 4', 'FinUI', 'SpreadJS', 'Module Federation', 'Pinia', 'TypeScript'],
    description: '主导公司核心 ERP 财务系统前后端同步重构，系统承载 800+ 页面，覆盖应收、应付、总账、报表、合并等全财务链路，服务集团 2000+ 用户日常财务核算与审计工作',
    descriptionEn: 'Led full-stack rebuild of core ERP financial system (800+ pages), covering AR, AP, GL, reporting, and consolidation for 2000+ users',
    highlights: [
      '主导微前端架构（Module Federation）设计与落地，实现多团队独立开发、独立部署，构建耗时从 12min 降至 3min',
      '搭建半低码方案：抽象 20+ 高频模式化页面模板，支持配置化生成，需求交付周期缩短 60%',
      '主导引入 Web Component 方案（Lit），实现跨 Vue/React 技术栈的组件复用，累计沉淀 8 个通用业务组件',
      '设计统一的错误监控与性能埋点体系（Sentry + 自研 SDK），线上问题发现率提升 80%',
      '制定前端工程化规范（Monorepo + ESlint + Husky + Changesets），团队代码质量显著提升',
      '主导首屏性能优化专项：路由懒加载 + 资源预加载 + 图片压缩 + CDN 配置，首屏加载时间从 4.2s 降至 1.8s',
    ],
    highlightsEn: [
      'Designed Module Federation micro-frontend architecture for multi-team independent dev/deploy, build time reduced from 12min to 3min',
      'Built semi-low-code system with 20+ page templates, delivery cycle reduced by 60%',
      'Introduced Web Components (Lit) for cross-framework reuse, 8 business components built',
      'Designed unified error monitoring & performance tracking (Sentry + custom SDK), issue detection rate up 80%',
      'Established frontend engineering standards (Monorepo + ESLint + Husky + Changesets)',
      'Led performance optimization: lazy loading + preloading + image compression + CDN, first-load from 4.2s to 1.8s',
    ],
  },
  {
    name: 'FinSpread 自研工具',
    nameEn: 'FinSpread Internal Tool',
    role: '主程',
    roleEn: 'Lead Developer',
    period: '2024.06 – 2024.11',
    stack: ['SpreadJS', 'iframe', 'postMessage', 'Vue 3', 'TypeScript'],
    description: '自研电子表格能力平台，通过 iframe 架构隔离 SpreadJS 核心能力，以微服务形式向财务系统、预算系统、报表系统等多个业务线提供在线表格编辑与计算服务，降低 SpreadJS 授权成本约 30%',
    descriptionEn: 'Built spreadsheet capability platform via iframe isolation, serving multiple business lines and reducing licensing costs by ~30%',
    highlights: [
      '设计统一的 postMessage 通信协议（请求-响应模式 + 事件订阅模式），支持跨域双向通信',
      '封装 SpreadJS 核心 API 为独立服务，暴露统一的 CRUD + 公式计算 + 格式化接口',
      '输出完整的接入文档与 SDK，3 个业务系统在 2 周内完成接入',
      '实现操作录制与回放能力，支持用户操作审计与问题追溯',
      '设计插件化架构，支持按需加载行列操作、数据透视、图表等能力模块',
    ],
    highlightsEn: [
      'Designed unified postMessage protocol (request-response + event subscription) for cross-domain communication',
      'Encapsulated SpreadJS API as standalone service with CRUD + formula + formatting interfaces',
      'Produced SDK and documentation, 3 business systems integrated within 2 weeks',
      'Implemented operation recording & playback for audit and troubleshooting',
      'Designed plugin architecture for on-demand loading of pivot tables, charts, etc.',
    ],
  },
  {
    name: 'SSO 统一权限管理系统',
    nameEn: 'SSO Unified Permission System',
    role: '前端负责人',
    roleEn: 'Frontend Lead',
    period: '2018.09 – 2021.12',
    stack: ['Vue 2.6', 'iView', 'Nuxt.js', 'Less', 'Vuex', 'Node.js'],
    description: '主导柔宇科技统一认证与权限管理系统架构设计与开发，打通 5+ 业务线后台系统的统一登录、统一授权、统一审计，覆盖 500+ 内部用户的日常权限管理需求',
    descriptionEn: 'Architected unified authentication & permission system across 5+ business lines for 500+ internal users',
    highlights: [
      '实现基于 RBAC 的动态路由系统：后端下发权限树，前端动态生成路由与菜单，支持按钮级权限控制',
      '设计统一登录方案：OAuth 2.0 + JWT，支持 SSO 单点登录、Token 无感刷新、多端互踢',
      '自研基于 iView 的企业级组件库（20+ 组件），包含高级表格、表单引擎、权限指令等，被部门所有管理系统复用',
      '搭建前端监控体系（埋点 + 性能采集 + 异常上报），输出月度前端质量报告',
      '主导制定 RESTful API 规范与前端开发规范，推动前后端协作效率提升 40%',
    ],
    highlightsEn: [
      'Implemented RBAC-based dynamic routing: backend permission tree → frontend dynamic routes & menus with button-level control',
      'Designed SSO solution: OAuth 2.0 + JWT with silent token refresh and multi-device logout',
      'Built enterprise component library (20+ components) based on iView, adopted by all management systems',
      'Set up frontend monitoring (analytics + performance + error reporting), monthly quality reports',
      'Defined RESTful API & coding standards, improving cross-team efficiency by 40%',
    ],
  },
  {
    name: '柔记 PC 端（Electron）',
    nameEn: 'Rouyu Note PC (Electron)',
    role: '核心开发',
    roleEn: 'Core Developer',
    period: '2019.10 – 2020.04',
    stack: ['Electron', 'Vue 2.6', 'Node.js', 'Less', 'Canvas'],
    description: '跨平台桌面应用（Windows / macOS），连接柔记智能手写板硬件，实现手写输入、绘画创作、笔记管理等功能，支持手写板与屏幕双画布实时同步渲染',
    descriptionEn: 'Cross-platform desktop app connecting Royole handwriting tablet, supporting real-time dual-canvas sync rendering',
    highlights: [
      '实现手写板 USB 驱动通信与数据解析，基于 Node.js native addon 封装硬件 SDK',
      '设计双画布实时同步渲染架构：手写板画布 → 数据压缩 → 屏幕画布，延迟控制在 16ms 以内',
      '实现笔迹压感模拟与平滑曲线算法（贝塞尔曲线插值），还原真实书写体验',
      '处理 macOS / Windows 双平台兼容问题：文件路径、系统托盘、快捷键、窗口管理',
      '实现笔记导入导出功能：支持 PDF、PNG、JPG 格式，批量导出性能优化（100 页 < 3s）',
    ],
    highlightsEn: [
      'Implemented USB driver communication & data parsing via Node.js native addon',
      'Designed dual-canvas real-time sync: tablet canvas → data compression → screen canvas, latency < 16ms',
      'Implemented pressure-sensitive stroke simulation with Bézier curve interpolation',
      'Handled cross-platform compatibility: file paths, system tray, shortcuts, window management',
      'Implemented import/export (PDF/PNG/JPG), batch export optimized (100 pages < 3s)',
    ],
  },
];

export const techStack: TechCategory[] = [
  {
    name: '框架',
    nameEn: 'Frameworks',
    items: ['Vue 3', 'Vue 2', 'React 18', 'Angular', 'Nuxt.js'],
  },
  {
    name: '构建',
    nameEn: 'Build Tools',
    items: ['Vite 4', 'Webpack', 'Rspack', 'Monorepo'],
  },
  {
    name: '架构',
    nameEn: 'Architecture',
    items: ['Module Federation', 'Web Components', 'SSR', 'SPA'],
  },
  {
    name: '跨端',
    nameEn: 'Cross-Platform',
    items: ['Electron', 'Taro', 'Cordova', 'Ionic'],
  },
  {
    name: '语言',
    nameEn: 'Languages',
    items: ['TypeScript', 'JavaScript', 'HTML5', 'CSS3'],
  },
  {
    name: 'UI 库',
    nameEn: 'UI Libraries',
    items: ['Element Plus', 'iView', 'Ant Design', 'FinUI'],
  },
  {
    name: '后端协作',
    nameEn: 'Backend',
    items: ['Node.js', 'Express', 'Koa', 'RESTful API'],
  },
  {
    name: '业务库',
    nameEn: 'Business',
    items: ['SpreadJS', 'ECharts', 'Rich Text Editor'],
  },
];
