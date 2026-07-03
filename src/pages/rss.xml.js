import { getCollection } from 'astro:content';
import rss from '@astrojs/rss';

export async function GET(context) {
  const posts = await getCollection('blog');
  const chinesePosts = posts.filter((post) => !post.id.startsWith('en/'));

  return rss({
    title: '紫牙的技术博客',
    description: '11 年前端经验 | 企业级中后台架构设计 | 微前端 / 跨端 / 性能优化',
    site: context.site,
    items: chinesePosts.map((post) => ({
      ...post.data,
      link: `/blog/${post.id}/`,
    })),
  });
}
