import type { CollectionEntry } from "astro:content";

export const CATEGORIES = [
  { name: "价值投资", slug: "jiazhi-touzi" },
  { name: "初级会计", slug: "chuji-kuaiji" },
  { name: "杂项", slug: "zaxiang" },
] as const;

export type Category = (typeof CATEGORIES)[number];

export function getCategoryFolder(
  filePath: string | undefined
): string | undefined {
  if (!filePath) return undefined;
  const normalized = filePath.replaceAll("\\", "/");
  const marker = "/content/posts/";
  const idx = normalized.lastIndexOf(marker);
  const rel = idx >= 0 ? normalized.slice(idx + marker.length) : normalized;
  const [folder, ...rest] = rel.split("/").filter(Boolean);
  if (!folder || rest.length === 0) return undefined;
  return folder;
}

export function getCategoryByFolder(
  folder: string | undefined
): Category | undefined {
  return CATEGORIES.find(category => category.name === folder);
}

export function getCategoryBySlug(slug: string): Category | undefined {
  return CATEGORIES.find(category => category.slug === slug);
}

export function getCategoryByFilePath(
  filePath: string | undefined
): Category | undefined {
  return getCategoryByFolder(getCategoryFolder(filePath));
}

export function assertPostCategory(post: CollectionEntry<"posts">): Category {
  const category = getCategoryByFilePath(post.filePath);
  if (!category) {
    const names = CATEGORIES.map(item => item.name).join(" / ");
    throw new Error(
      `文章必须放在分类文件夹（${names}）下，且不在 front matter 写 category：${post.filePath ?? post.id}`
    );
  }
  return category;
}
