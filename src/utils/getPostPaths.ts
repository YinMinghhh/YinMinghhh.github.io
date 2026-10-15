import { getRelativeLocaleUrl } from "astro:i18n";
import { slugifyStr } from "./slugify";
import config from "@/config";

function getIdSlug(id: string): string {
  const postId = id.split("/");
  return postId.length > 0 ? String(postId[postId.length - 1]) : id;
}

/**
 * English/pinyin slug only. Category folders stay out of the URL.
 * e.g. `/m1-smoke`
 */
export function getPostSlug(
  id: string,
  _filePath: string | undefined,
  explicitSlug?: string
): string {
  const slug = explicitSlug?.trim() || getIdSlug(id);
  return `/${slugifyStr(slug)}`;
}

/**
 * Navigable post URL with locale routing and the configured base.
 * e.g. `/posts/m1-smoke`
 */
export function getPostUrl(
  id: string,
  filePath: string | undefined,
  locale: string | undefined = config.site.lang,
  explicitSlug?: string
): string {
  const slug = getPostSlug(id, filePath, explicitSlug).replace(/^\//, "");
  return getRelativeLocaleUrl(locale, `posts/${slug}`);
}
