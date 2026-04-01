import getReadingTime from "reading-time";
import { toString } from "mdast-util-to-string";
import type { Root } from "mdast";

export function remarkReadingTime() {
  return function (tree: Root, { data }: { data: Record<string, unknown> }) {
    const text = toString(tree);
    const readingTime = getReadingTime(text);
    const astro = data.astro as { frontmatter: Record<string, unknown> };
    astro.frontmatter.readingTime = readingTime.text;
  };
}
