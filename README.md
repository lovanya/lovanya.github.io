# lovanya.github.io

林健(紫牙)的技术博客与简历 —— Astro 5 + React 19 静态站，部署在 GitHub Pages。

## 本地开发

```sh
npm install
cp .env.example .env   # 填入 PUBLIC_GEMINI_API_KEY（可选）
npm run dev
```

## 构建

```sh
npm run build
# → astro build → 生成静态站
# → pagefind    → 全文搜索索引
# → ping-indexnow → 通知 Bing/Yandex/Naver
```

## 部署

`git push origin master` → GitHub Actions (`.github/workflows/deploy.yml`) 自动构建并部署到 GitHub Pages。

**需要的环境变量**（GitHub repo → Settings → Secrets → Actions）：

| Name | 用途 |
|---|---|
| `PUBLIC_GEMINI_API_KEY` | ChatBot 调用 Gemini（从 https://aistudio.google.com/apikey 拿，referrer 限制到 `lovanya.github.io`）|

## 内容约定

- 博客源文件：`src/content/blog/<slug>.mdx`（中文）+ `src/content/blog/en/<slug>.mdx`（英文）
- Frontmatter：`title` / `description` / `pubDate` / `tags` / `heroImage`(可选)
- 新增文章后必须同步更新 `public/llms.txt` 和 `src/data/resume.ts`（如适用），见 `AGENTS.md`

## 目录速览

```
src/
  content/blog/        # MDX 博客（zh + en/）
  layouts/             # BaseLayout.astro（主）, BlogPost.astro（详情）
  pages/               # 路由
  components/          # Header / Footer / ChatBot / Canvas ...
  data/resume.ts       # 简历数据
  styles/global.css    # 设计系统 token
public/
  llms.txt             # AI 索引
  robots.txt
public/<indexnow-key>.txt  # IndexNow 验证文件（脚本生成）
.github/workflows/     # CI/CD
astro.config.mjs       # sitemap + i18n + 构建配置
```

## 规范与扩展

详见 `AGENTS.md`（发布流程、设计系统、10 分制内容审核、AI 友好性）。
