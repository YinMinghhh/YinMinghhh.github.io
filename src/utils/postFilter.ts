import type { CollectionEntry } from "astro:content";
import config from "@/config";
import { assertPostCategory } from "./categories";

/**
 * Whether a post can be listed.
 *
 * - Requires `publish: true` and rejects drafts
 * - Category must be one of the three content folders
 * - In production, hides scheduled posts until `pubDatetime` minus the margin
 * - In dev, shows non-draft published posts so authoring is easier
 */
export function postFilter(post: CollectionEntry<"posts">) {
  assertPostCategory(post);
  const { data } = post;
  if (data.publish !== true || data.draft) return false;
  const isPublishTimePassed =
    Date.now() >
    new Date(data.pubDatetime).getTime() - config.posts.scheduledPostMargin;
  return import.meta.env.DEV || isPublishTimePassed;
}
