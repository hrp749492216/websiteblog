import type { Root } from "mdast";
import { toString as mdastToString } from "mdast-util-to-string";
import getReadingTime from "reading-time";

export function remarkReadingTime() {
  return (tree: Root, { data }: { data: Record<string, unknown> }) => {
    const text = mdastToString(tree);
    const readingTime = getReadingTime(text);
    const astro = data.astro as { frontmatter: Record<string, unknown> };
    astro.frontmatter.readingTime = readingTime.text;
  };
}
