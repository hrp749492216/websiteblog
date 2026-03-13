import getReadingTime from "reading-time";
import { toString } from "mdast-util-to-string";

export function remarkReadingTime() {
  return function (tree: any, { data }: any) {
    const text = toString(tree);
    const readingTime = getReadingTime(text);
    data.astro.frontmatter.readingTime = readingTime.text;
  };
}
