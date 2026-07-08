<?xml version="1.0" encoding="utf-8"?>
<xsl:stylesheet
  version="3.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:atom="http://www.w3.org/2005/Atom"
>
  <xsl:output method="html" version="1.0" encoding="utf-8" indent="yes"/>
  <xsl:template match="/">
    <html lang="zh-CN">
      <head>
        <meta charset="utf-8"/>
        <meta name="viewport" content="width=device-width, initial-scale=1"/>
        <title><xsl:value-of select="/rss/channel/title"/> · RSS Feed</title>
        <link rel="preconnect" href="https://fonts.googleapis.com"/>
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous"/>
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&amp;display=swap"/>
        <style>
          :root {
            color-scheme: light dark;
            --bg: #0a0e1a;
            --bg-secondary: #131826;
            --text: #e5e7eb;
            --text-secondary: #9ca3af;
            --accent: #00e5ff;
            --border: #1f2937;
          }
          @media (prefers-color-scheme: light) {
            :root {
              --bg: #ffffff;
              --bg-secondary: #f9fafb;
              --text: #111827;
              --text-secondary: #6b7280;
              --accent: #0891b2;
              --border: #e5e7eb;
            }
          }
          * { box-sizing: border-box; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            background: var(--bg);
            color: var(--text);
            margin: 0;
            padding: 2rem 1rem;
            line-height: 1.6;
          }
          .container {
            max-width: 720px;
            margin: 0 auto;
            background: var(--bg-secondary);
            border: 1px solid var(--border);
            border-radius: 12px;
            padding: 2rem;
          }
          h1 {
            font-family: 'JetBrains Mono', monospace;
            color: var(--accent);
            margin: 0 0 0.5rem 0;
            font-size: 1.75rem;
          }
          .meta {
            color: var(--text-secondary);
            font-size: 0.875rem;
            margin-bottom: 2rem;
            padding-bottom: 1rem;
            border-bottom: 1px solid var(--border);
          }
          .description {
            margin: 1rem 0 2rem 0;
            color: var(--text-secondary);
          }
          .item {
            padding: 1.5rem 0;
            border-bottom: 1px solid var(--border);
          }
          .item:last-child { border-bottom: none; }
          .item h2 {
            font-size: 1.25rem;
            margin: 0 0 0.5rem 0;
          }
          .item h2 a {
            color: var(--text);
            text-decoration: none;
          }
          .item h2 a:hover { color: var(--accent); }
          .item .date {
            font-family: 'JetBrains Mono', monospace;
            font-size: 0.75rem;
            color: var(--text-secondary);
            margin-bottom: 0.5rem;
          }
          .item .desc {
            color: var(--text-secondary);
            font-size: 0.875rem;
          }
          .tag {
            display: inline-block;
            font-family: 'JetBrains Mono', monospace;
            font-size: 0.7rem;
            color: var(--accent);
            border: 1px solid var(--accent);
            border-radius: 4px;
            padding: 2px 6px;
            margin-right: 4px;
            margin-top: 4px;
          }
          .actions {
            margin-top: 2rem;
            padding-top: 1.5rem;
            border-top: 1px solid var(--border);
            display: flex;
            gap: 1rem;
            flex-wrap: wrap;
          }
          .btn {
            display: inline-block;
            font-family: 'JetBrains Mono', monospace;
            font-size: 0.875rem;
            color: var(--accent);
            border: 1px solid var(--accent);
            border-radius: 6px;
            padding: 0.5rem 1rem;
            text-decoration: none;
          }
          .btn:hover { background: var(--accent); color: var(--bg); }
        </style>
      </head>
      <body>
        <div class="container">
          <h1><xsl:value-of select="/rss/channel/title"/></h1>
          <div class="meta">
            📡 RSS Feed · 共 <xsl:value-of select="count(/rss/channel/item)"/> 篇文章
          </div>
          <div class="description">
            <xsl:value-of select="/rss/channel/description"/>
          </div>
          <xsl:for-each select="/rss/channel/item">
            <article class="item">
              <h2>
                <a href="{link}">
                  <xsl:value-of select="title"/>
                </a>
              </h2>
              <div class="date">
                📅 <xsl:value-of select="pubDate"/>
              </div>
              <div class="desc">
                <xsl:value-of select="description"/>
              </div>
              <xsl:if test="category">
                <div style="margin-top: 0.5rem;">
                  <xsl:for-each select="category">
                    <span class="tag">#<xsl:value-of select="."/></span>
                  </xsl:for-each>
                </div>
              </xsl:if>
            </article>
          </xsl:for-each>
          <div class="actions">
            <a class="btn" href="/">← 返回首页</a>
            <a class="btn" href="/blog">查看博客</a>
          </div>
        </div>
      </body>
    </html>
  </xsl:template>
</xsl:stylesheet>
