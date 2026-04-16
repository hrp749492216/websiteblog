import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import vercel from "@astrojs/vercel";
import { remarkReadingTime } from "./src/utils/remark-reading-time.ts";

export default defineConfig({
  site: "https://hariramanpokhrel.com.np",
  // Static-first; API routes opt out individually via `export const prerender = false`.
  output: "static",
  adapter: vercel({ imageService: true }),
  integrations: [mdx(), sitemap()],
  markdown: {
    remarkPlugins: [remarkReadingTime],
    shikiConfig: {
      theme: "github-light",
    },
  },
});
