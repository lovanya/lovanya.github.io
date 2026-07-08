import { getCollection } from 'astro:content';
import rss from '@astrojs/rss';

export async function GET(context) {
  const posts = await getCollection('blog');
  const chinesePosts = posts.filter((post) => !post.id.startsWith('en/'));

  return rss({
    title: '紫牙的博客 - 林健(紫牙)前端架构师',
    description:
      '紫牙(林健)的前端技术博客。11 年前端架构经验,专注于企业级中后台、微前端、跨端开发、性能优化与 AI 工程实践。',
    site: context.site,
    customData:
      '<language>zh-CN</language><atom:link href="https://lovanya.github.io/rss.xml" rel="self" type="application/rss+xml" xmlns:atom="http://www.w3.org/2005/Atom" />',
    trailingSlash: false,
    items: chinesePosts.map((post) => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.pubDate,
      link: `/blog/${post.id}`,
      categories: post.data.tags || [],
      author: '紫牙(林健)',
      content: undefined, // Astro will use the rendered content automatically
    })),
    xmlns: {
      atom: 'http://www.w3.org/2005/Atom',
    },
    stylesheet: '/rss/styles.xsl',
  });
}
