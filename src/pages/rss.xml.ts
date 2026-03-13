import rss from "@astrojs/rss";
import { getCollection, render } from "astro:content";
import type { APIContext } from "astro";

export async function GET(context: APIContext) {
  const posts = (await getCollection("blog", ({ data }) => !data.draft))
    .sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());

  const items = await Promise.all(
    posts.map(async (post) => {
      const { Content } = await render(post);
      return {
        title: post.data.title,
        pubDate: post.data.pubDate,
        description: post.data.description,
        link: `/blog/${post.id}/`,
      };
    })
  );

  return rss({
    title: "Hari Raman Pokhrel",
    description: "Thoughts, ideas, and things I'm learning along the way.",
    site: context.site!,
    items,
  });
}
