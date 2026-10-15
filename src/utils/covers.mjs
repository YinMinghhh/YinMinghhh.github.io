/** Normalize front matter `cover` (string | array) to at most 3 entries; warn when truncated. */
export function normalizeCovers(value, slug, warn = console.warn) {
  const list = value == null || value === "" ? [] : Array.isArray(value) ? value : [value];
  if (list.length > 3) warn(`[cover] ${slug}: ${list.length} 张封面，只取前 3 张`);
  return list.slice(0, 3);
}
