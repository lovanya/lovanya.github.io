# 博客迁移计划 - lovanya.github.io

## 技术栈
- **框架**: Astro 7 + MDX
- **评论**: Giscus (GitHub Discussions)
- **统计**: Umami Cloud (待配置)
- **国际化**: Astro i18n (中/英)
- **主题**: 暗/亮切换，跟随系统默认
- **部署**: GitHub Actions → GitHub Pages

## 项目结构

```
lovanya.github.io/
├── src/
│   ├── content/
│   │   └── blog/
│   │       ├── zh/           # 中文文章
│   │       │   ├── hello-world.mdx
│   │       │   ├── macos-git-branch.mdx
│   │       │   ├── mongodb-install.mdx
│   │       │   └── local-storage.mdx
│   │       └── en/           # 英文文章
│   │           ├── hello-world.mdx
│   │           ├── macos-git-branch.mdx
│   │           ├── mongodb-install.mdx
│   │           └── local-storage.mdx
│   ├── components/
│   │   ├── Resume/
│   │   │   ├── Hero.astro           # 粒子背景 + 3D 名片
│   │   │   ├── RadarChart.tsx       # 技能雷达图
│   │   │   ├── Timeline.tsx         # 工作时间线
│   │   │   ├── ProjectCard.tsx      # 项目卡片
│   │   │   └── SkillTree.tsx        # 技能树
│   │   ├── Blog/
│   │   │   ├── PostCard.astro
│   │   │   └── PostList.astro
│   │   ├── Comments.astro           # Giscus
│   │   ├── Analytics.astro          # Umami
│   │   ├── LanguageSwitcher.astro
│   │   ├── ThemeToggle.astro        # 主题切换
│   │   └── Header.astro
│   ├── data/
│   │   ├── resume.ts                # 简历数据
│   │   └── i18n.ts                  # UI 文案
│   ├── i18n/
│   │   ├── zh.json
│   │   └── en.json
│   ├── layouts/
│   │   ├── BaseLayout.astro
│   │   └── BlogPost.astro
│   ├── pages/
│   │   ├── zh/
│   │   │   ├── index.astro
│   │   │   ├── about.astro
│   │   │   └── blog/
│   │   │       └── [...slug].astro
│   │   └── en/
│   │       ├── index.astro
│   │       ├── about.astro
│   │       └── blog/
│   │           └── [...slug].astro
│   └── styles/
│       └── global.css
├── public/
│   └── images/
├── astro.config.mjs
├── package.json
└── tsconfig.json
```

## 执行步骤

### Phase 1: 项目初始化
1. 更新 `astro.config.mjs` - 添加 i18n 配置
2. 创建 `src/i18n/zh.json` 和 `src/i18n/en.json`
3. 更新 `src/consts.ts` - 添加多语言常量
4. 创建 `src/data/resume.ts` - 简历数据

### Phase 2: 核心布局
5. 更新 `src/layouts/BaseLayout.astro` - 支持 i18n + 主题
6. 创建 `src/components/Header.astro` - 导航栏
7. 创建 `src/components/ThemeToggle.astro` - 主题切换
8. 创建 `src/components/LanguageSwitcher.astro` - 语言切换

### Phase 3: 简历组件
9. 创建 `src/components/Resume/Hero.astro` - 粒子背景 + 个人介绍
10. 创建 `src/components/Resume/RadarChart.tsx` - 技能雷达图
11. 创建 `src/components/Resume/Timeline.tsx` - 工作时间线
12. 创建 `src/components/Resume/ProjectCard.tsx` - 项目卡片
13. 创建 `src/components/Resume/SkillTree.tsx` - 技能树

### Phase 4: 博客组件
14. 创建 `src/components/Blog/PostCard.astro` - 文章卡片
15. 创建 `src/components/Blog/PostList.astro` - 文章列表
16. 创建 `src/components/Comments.astro` - Giscus 评论

### Phase 5: 页面创建
17. 创建 `src/pages/zh/index.astro` - 中文首页
18. 创建 `src/pages/en/index.astro` - 英文首页
19. 创建 `src/pages/zh/about.astro` - 中文简历
20. 创建 `src/pages/en/about.astro` - 英文简历
21. 创建 `src/pages/zh/blog/[...slug].astro` - 中文文章
22. 创建 `src/pages/en/blog/[...slug].astro` - 英文文章

### Phase 6: 内容迁移
23. 迁移 4 篇文章（中/英）
24. 创建 `src/content.config.ts` 更新

### Phase 7: 部署配置
25. 创建 `.github/workflows/deploy.yml`
26. 更新 `package.json` 依赖

## 待用户提供
- [ ] Umami Cloud Website ID
- [ ] GitHub Discussions 是否已启用
