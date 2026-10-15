import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import matter from "gray-matter";

export const DEFAULT_POSTS = "src/content/posts";

function walkMarkdown(dir) {
  if (!fs.existsSync(dir)) return [];
  const files = [];
  const stack = [dir];
  while (stack.length) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (entry.name === "附件" || entry.name === ".git") continue;
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (entry.isFile() && /\.mdx?$/i.test(entry.name)) files.push(full);
    }
  }
  return files;
}

export function unpublishedPosts(dir) {
  const root = path.resolve(dir);
  const bad = [];
  for (const file of walkMarkdown(root)) {
    const rel = path.relative(root, file).split(path.sep).join("/");
    let publish;
    try {
      publish = matter(fs.readFileSync(file, "utf8")).data.publish;
    } catch (error) {
      bad.push(`${rel}（无法读取 front matter：${error instanceof Error ? error.message : error}）`);
      continue;
    }
    if (publish !== true) bad.push(rel);
  }
  return bad;
}

function isCli() {
  const entry = process.argv[1];
  if (!entry) return false;
  return import.meta.url === pathToFileURL(path.resolve(entry)).href;
}

if (isCli()) {
  const dir = process.argv[2] ? path.resolve(process.argv[2]) : path.resolve(DEFAULT_POSTS);
  const bad = unpublishedPosts(dir);
  if (bad.length) {
    console.error("以下文章缺少 publish: true，构建失败：");
    for (const file of bad) console.error(`  ${file}`);
    process.exit(1);
  }
}
