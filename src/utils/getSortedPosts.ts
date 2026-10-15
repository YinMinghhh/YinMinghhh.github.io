import type { CollectionEntry } from "astro:content";
import { postFilter } from "./postFilter";

/**
 * Posts visible to readers, newest publication date first.
 */
export function getSortedPosts(posts: CollectionEntry<"posts">[]) {
  return posts.filter(postFilter).sort((a, b) => {
    return (
      Math.floor(new Date(b.data.pubDatetime).getTime() / 1000) -
      Math.floor(new Date(a.data.pubDatetime).getTime() / 1000)
    );
  });
}
