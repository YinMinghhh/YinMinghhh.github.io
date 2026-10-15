import rss from "@astrojs/rss";
import { getCollection, render } from "astro:content";
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { getSortedPosts } from "@/utils/getSortedPosts";
import { getPostUrl } from "@/utils/getPostPaths";
import config from "@/config";

export async function GET() {
  const posts = getSortedPosts(await getCollection("posts"));
  const container = await AstroContainer.create();

  const items = await Promise.all(
    posts.map(async post => {
      const { Content } = await render(post);
      const content = await container.renderToString(Content);
      return {
        link: getPostUrl(post.id, post.filePath, config.site.lang, post.data.slug),
        title: post.data.title,
        description: post.data.description,
        pubDate: new Date(post.data.pubDatetime),
        content,
      };
    })
  );

  return rss({
    title: config.site.title,
    description: config.site.description,
    site: config.site.url,
    customData: "<language>zh-CN</language>",
    items,
  });
}
