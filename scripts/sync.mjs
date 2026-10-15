import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import matter from "gray-matter";
import GithubSlugger from "github-slugger";
import { pinyin } from "pinyin-pro";
import slugify from "slugify";

export const CATEGORY_NAMES = ["价值投资", "初级会计", "杂项"];
export const DEFAULT_VAULT =
  "/Users/yinming/Library/CloudStorage/GoogleDrive-yinming8086@gmail.com/我的云端硬盘/Obsidian";
export const DEFAULT_OUT = "src/content/posts";
export const SECRET_IGNORE_MARK = "sync-ignore-secrets";
const IMAGE_EXTS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".svg",
  ".bmp",
  ".avif",
]);
const ONE_MB = 1024 * 1024;

const ID_WEIGHTS = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2];
const ID_CHECKS = "10X98765432";

export function toSlug(input) {
  const spelled = pinyin(String(input), {
    toneType: "none",
    nonZh: "consecutive",
    separator: "-",
  });
  return slugify(spelled, { lower: true, strict: true, trim: true })
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function isChineseId(value) {
  if (!/^\d{17}[\dXx]$/.test(value)) return false;
  let sum = 0;
  for (let i = 0; i < 17; i += 1) sum += Number(value[i]) * ID_WEIGHTS[i];
  return ID_CHECKS[sum % 11] === value[17].toUpperCase();
}

function relPosix(root, file) {
  return path.relative(root, file).split(path.sep).join("/");
}

function isAttachmentRel(rel) {
  return rel.split("/").includes("附件");
}

function isInside(root, target) {
  const rel = path.relative(root, target);
  return rel === "" || (rel !== ".." && !rel.startsWith(`..${path.sep}`) && !path.isAbsolute(rel));
}

function lineAt(text, index) {
  return text.slice(0, index).split("\n").length;
}

function covered(index, ranges) {
  return ranges.some(range => index >= range.start && index < range.end);
}

function findCodeRanges(body) {
  const ranges = [];
  for (const match of body.matchAll(/```[\s\S]*?```|~~~[\s\S]*?~~~/g)) {
    ranges.push({ start: match.index, end: match.index + match[0].length });
  }
  for (const match of body.matchAll(/`[^`\n]+`/g)) {
    if (!covered(match.index, ranges)) {
      ranges.push({ start: match.index, end: match.index + match[0].length });
    }
  }
  return ranges;
}

function findCommentRanges(body, codeRanges) {
  const ranges = [];
  for (const match of body.matchAll(/%%[\s\S]*?%%/g)) {
    if (!covered(match.index, codeRanges)) {
      ranges.push({ start: match.index, end: match.index + match[0].length });
    }
  }
  return ranges;
}

function walkFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const files = [];
  const stack = [dir];
  while (stack.length) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (entry.name === ".obsidian" || entry.name === ".git" || entry.name === "node_modules") {
        continue;
      }
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (entry.isFile()) files.push(full);
    }
  }
  return files;
}

function formatDate(value, label, file, errors) {
  if (value == null || value === "") {
    errors.push({ file, line: 1, message: `缺少必填 ${label}（YYYY-MM-DD）` });
    return "";
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const y = value.getUTCFullYear();
    const m = String(value.getUTCMonth() + 1).padStart(2, "0");
    const d = String(value.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  const text = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  errors.push({ file, line: 1, message: `${label} 必须是 YYYY-MM-DD` });
  return "";
}

function normalizeTags(value) {
  if (value == null || value === "") return [];
  const list = Array.isArray(value) ? value : [value];
  return list.map(tag => String(tag).trim()).filter(Boolean);
}

function yamlQuote(value) {
  return JSON.stringify(String(value));
}

function renderPost({ title, date, updated, description, slug, tags, body }) {
  const lines = ["---", "publish: true", `title: ${yamlQuote(title)}`, `date: ${date}`];
  if (updated) lines.push(`updated: ${updated}`);
  lines.push(`description: ${yamlQuote(description)}`, `slug: ${yamlQuote(slug)}`);
  if (tags.length) {
    lines.push("tags:");
    for (const tag of tags) lines.push(`  - ${yamlQuote(tag)}`);
  }
  lines.push("---", "", body.trimEnd(), "");
  return lines.join("\n");
}

function plainDescription(body, title) {
  const text = body
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/<img\b[^>]*>/g, " ")
    .replace(/!\[[^\]]*]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)]\([^)]*\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/[*_`>#-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return (text || title).slice(0, 120);
}

function headingIds(body) {
  const slugger = new GithubSlugger();
  const codeRanges = findCodeRanges(body);
  const ids = new Map();
  for (const match of body.matchAll(/^(#{1,6})[ \t]+(.+)$/gm)) {
    if (covered(match.index, codeRanges)) continue;
    const text = match[2].trim();
    ids.set(text, slugger.slug(text));
  }
  return ids;
}

function parseWikiInner(inner) {
  let name = inner.trim();
  let extra = "";
  const pipe = name.indexOf("|");
  if (pipe !== -1) {
    extra = name.slice(pipe + 1).trim();
    name = name.slice(0, pipe).trim();
  }
  let heading = "";
  const hash = name.indexOf("#");
  if (hash !== -1) {
    heading = name.slice(hash + 1).trim();
    name = name.slice(0, hash).trim();
  }
  return { name, heading, extra };
}

function isImageName(name) {
  return IMAGE_EXTS.has(path.extname(name).toLowerCase());
}

function secretFindings(text) {
  const findings = [];
  const idRe = /(?<!\d)\d{17}[\dXx](?!\d)/g;
  const idSpans = [];
  for (const match of text.matchAll(idRe)) {
    if (!isChineseId(match[0])) continue;
    findings.push("身份证号");
    idSpans.push([match.index, match.index + match[0].length]);
  }
  const email = text.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
  if (email) findings.push("邮箱");
  const phoneRe = /(?<!\d)(?:\+?86[-\s]?)?1[3-9]\d{9}(?!\d)/g;
  for (const match of text.matchAll(phoneRe)) {
    if (idSpans.some(([start, end]) => match.index >= start && match.index < end)) continue;
    findings.push("手机号");
    break;
  }
  if (/\/Users\/[^\s)'"`]+/.test(text)) findings.push("本机路径");
  if (
    /(?:ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{10,}|-----BEGIN [A-Z ]*PRIVATE KEY-----|(?:api[_-]?key|secret|token)\s*[:=]\s*['"]?[A-Za-z0-9_-]{20,})/i.test(
      text
    )
  ) {
    findings.push("疑似密钥");
  }
  return [...new Set(findings)];
}

function resolveImage(vault, images, note, ref) {
  const normalized = ref.replaceAll("\\", "/").trim();
  if (normalized.includes("/")) {
    const relative = path.resolve(note.dir, normalized);
    const fromRoot = path.resolve(vault, normalized);
    if (isInside(vault, relative) && fs.existsSync(relative) && fs.statSync(relative).isFile()) {
      return { file: relative };
    }
    if (isInside(vault, fromRoot) && fs.existsSync(fromRoot) && fs.statSync(fromRoot).isFile()) {
      return { file: fromRoot };
    }
    return { file: null };
  }
  const matches = images.filter(file => path.basename(file) === normalized);
  if (matches.length === 0) return { file: null };
  const ranked = matches
    .map(file => {
      const rel = relPosix(vault, file);
      const inOwnAttachment = rel === `${note.category}/附件/${normalized}`;
      const inNoteDir = path.dirname(file) === note.dir;
      const inAnyAttachment = rel.split("/").includes("附件");
      const score = inOwnAttachment ? 0 : inNoteDir ? 1 : inAnyAttachment ? 2 : 3;
      return { file, score, rel };
    })
    .sort((a, b) => a.score - b.score || a.rel.length - b.rel.length || a.rel.localeCompare(b.rel));
  if (ranked.length > 1 && ranked[0].score === ranked[1].score && ranked[0].rel !== ranked[1].rel) {
    return { file: null, ambiguous: ranked.map(item => item.rel) };
  }
  return { file: ranked[0].file };
}

function safeImageName(filename, used) {
  const ext = path.extname(filename).toLowerCase() || ".img";
  const base = path.basename(filename, path.extname(filename));
  let slug = toSlug(base) || "image";
  let name = `${slug}${ext}`;
  let n = 2;
  while (used.has(name)) {
    name = `${slug}-${n}${ext}`;
    n += 1;
  }
  used.add(name);
  return name;
}

function findNote(notes, from, name) {
  const normalized = name.replaceAll("\\", "/").replace(/\.mdx?$/i, "").trim();
  if (!normalized) return { note: from };
  if (normalized.includes("/")) {
    const found = notes.find(
      note => note.relNoExt === normalized || note.relNoExt.endsWith(`/${normalized}`)
    );
    return { note: found ?? null };
  }
  const matches = notes.filter(note => note.base === path.posix.basename(normalized));
  if (matches.length === 1) return { note: matches[0] };
  if (matches.length > 1) {
    const same = matches.filter(note => note.category === from.category);
    if (same.length === 1) return { note: same[0] };
    return { note: null, ambiguous: matches.map(note => note.rel) };
  }
  return { note: null };
}

function transformBody(vault, notes, images, note, warnings, errors) {
  const body = note.body;
  const codeRanges = findCodeRanges(body);
  const commentRanges = findCommentRanges(body, codeRanges);
  const tokens = [];
  for (const match of body.matchAll(/(!?)\[\[([^\[\]\n]+)]]/g)) {
    if (covered(match.index, codeRanges) || covered(match.index, commentRanges)) continue;
    tokens.push({
      kind: "wiki",
      start: match.index,
      end: match.index + match[0].length,
      bang: match[1] === "!",
      raw: match[0],
      inner: match[2],
    });
  }
  for (const match of body.matchAll(/!\[([^\]]*)]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
    if (covered(match.index, codeRanges) || covered(match.index, commentRanges)) continue;
    const url = match[2];
    if (/^[a-z]+:/i.test(url)) continue;
    tokens.push({
      kind: "md-image",
      start: match.index,
      end: match.index + match[0].length,
      alt: match[1],
      url,
      raw: match[0],
    });
  }
  tokens.sort((a, b) => a.start - b.start);
  const events = [
    ...commentRanges.map(range => ({ ...range, kind: "comment" })),
    ...tokens,
  ].sort((a, b) => a.start - b.start);
  const usedNames = new Set();
  const copied = new Map();
  const imageFiles = new Map();
  let cursor = 0;
  let out = "";

  const takeImage = (ref, line) => {
    const resolved = resolveImage(vault, images, note, ref);
    if (resolved.ambiguous) {
      errors.push({
        file: note.rel,
        line,
        message: `图片「${ref}」对应多个文件：${resolved.ambiguous.join("、")}`,
      });
      return null;
    }
    if (!resolved.file) {
      errors.push({ file: note.rel, line, message: `找不到图片「${ref}」` });
      return null;
    }
    if (copied.has(resolved.file)) return copied.get(resolved.file);
    const bytes = fs.readFileSync(resolved.file);
    if (bytes.length > ONE_MB) {
      warnings.push({
        file: note.rel,
        line,
        message: `图片超过 1MB：${relPosix(vault, resolved.file)}`,
      });
    }
    const safe = safeImageName(path.basename(resolved.file), usedNames);
    copied.set(resolved.file, safe);
    imageFiles.set(safe, bytes);
    return safe;
  };

  for (const event of events) {
    if (event.start < cursor) continue;
    out += body.slice(cursor, event.start);
    const line = note.bodyLine + lineAt(body, event.start) - 1;
    if (event.kind === "comment") {
      cursor = event.end;
      continue;
    }
    if (event.kind === "md-image") {
      const safe = takeImage(event.url, line);
      out += safe ? `![](./${safe})` : event.raw ?? "";
      cursor = event.end;
      continue;
    }
    const wiki = parseWikiInner(event.inner);
    if (event.bang) {
      if (!isImageName(wiki.name)) {
        errors.push({
          file: note.rel,
          line,
          message: `不支持嵌入整篇笔记 ${event.raw}`,
        });
        out += event.raw;
      } else {
        const safe = takeImage(wiki.name, line);
        if (!safe) out += event.raw;
        else if (/^\d+$/.test(wiki.extra)) out += `<img src="./${safe}" alt="" width="${wiki.extra}">`;
        else out += `![](./${safe})`;
      }
      cursor = event.end;
      continue;
    }
    const target = findNote(notes, note, wiki.name);
    if (target.ambiguous) {
      errors.push({
        file: note.rel,
        line,
        message: `笔记「${wiki.name}」对应多个文件：${target.ambiguous.join("、")}`,
      });
      out += event.raw;
    } else if (!target.note) {
      errors.push({ file: note.rel, line, message: `找不到笔记「${wiki.name || wiki.heading}」` });
      out += event.raw;
    } else if (target.note.data.publish !== true) {
      const label = wiki.extra || target.note.title;
      warnings.push({
        file: note.rel,
        line,
        message: `未发布笔记不生成链接：${target.note.rel}`,
      });
      out += label;
    } else {
      const label = wiki.extra || wiki.heading || target.note.title;
      let href = `/posts/${target.note.slug}/`;
      if (wiki.heading) {
        const id = target.note.headings.get(wiki.heading) ?? new GithubSlugger().slug(wiki.heading);
        href += `#${id}`;
      }
      out += `[${label}](${href})`;
    }
    cursor = event.end;
  }
  out += body.slice(cursor);
  return { body: out, images: imageFiles };
}

function loadNotes(vault) {
  const notes = [];
  for (const category of CATEGORY_NAMES) {
    const dir = path.join(vault, category);
    if (!fs.existsSync(dir)) continue;
    for (const file of walkFiles(dir)) {
      if (!/\.mdx?$/i.test(file)) continue;
      const rel = relPosix(vault, file);
      if (isAttachmentRel(rel)) continue;
      const raw = fs.readFileSync(file, "utf8");
      const parsed = matter(raw);
      const bodyStart = raw.lastIndexOf(parsed.content);
      const bodyLine = bodyStart < 0 ? 1 : raw.slice(0, bodyStart).split("\n").length;
      notes.push({
        file,
        dir: path.dirname(file),
        rel,
        relNoExt: rel.replace(/\.mdx?$/i, ""),
        base: path.basename(file, path.extname(file)),
        category,
        raw,
        data: parsed.data,
        body: parsed.content,
        bodyLine,
        title: "",
        slug: "",
        headings: new Map(),
      });
    }
  }
  const usedSlugs = new Map();
  for (const note of notes) {
    const explicit = typeof note.data.slug === "string" ? note.data.slug.trim() : "";
    let slug = /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(explicit) ? explicit : toSlug(note.base);
    if (!slug) slug = "post";
    const owner = usedSlugs.get(slug);
    if (owner) {
      let n = 2;
      while (usedSlugs.has(`${slug}-${n}`)) n += 1;
      slug = `${slug}-${n}`;
    }
    usedSlugs.set(slug, note.rel);
    note.slug = slug;
    note.title =
      typeof note.data.title === "string" && note.data.title.trim()
        ? note.data.title.trim()
        : note.base;
    note.headings = headingIds(note.body.replace(/%%[\s\S]*?%%/g, ""));
  }
  return notes;
}

function loadImages(vault) {
  return walkFiles(vault).filter(file => IMAGE_EXTS.has(path.extname(file).toLowerCase()));
}

function inventory(outDir) {
  const posts = new Map();
  if (!fs.existsSync(outDir)) return posts;
  for (const category of CATEGORY_NAMES) {
    const catDir = path.join(outDir, category);
    if (!fs.existsSync(catDir)) continue;
    for (const entry of fs.readdirSync(catDir, { withFileTypes: true })) {
      if (entry.name === ".gitkeep" || entry.name === "附件") continue;
      const full = path.join(catDir, entry.name);
      if (entry.isDirectory()) {
        const mdPath = path.join(full, "index.md");
        if (!fs.existsSync(mdPath)) continue;
        const data = matter(fs.readFileSync(mdPath, "utf8")).data;
        const slug = typeof data.slug === "string" && data.slug ? data.slug : entry.name;
        const files = new Map();
        for (const file of walkFiles(full)) {
          files.set(relPosix(outDir, file), fs.readFileSync(file));
        }
        posts.set(`${category}/${slug}`, {
          root: relPosix(outDir, full),
          files,
        });
      } else if (entry.isFile() && /\.mdx?$/i.test(entry.name)) {
        const data = matter(fs.readFileSync(full, "utf8")).data;
        const slug =
          typeof data.slug === "string" && data.slug
            ? data.slug
            : entry.name.replace(/\.mdx?$/i, "");
        posts.set(`${category}/${slug}`, {
          root: `${category}/${entry.name}`,
          files: new Map([[`${category}/${entry.name}`, fs.readFileSync(full)]]),
        });
      }
    }
  }
  return posts;
}

function outsideWarnings(vault, notes) {
  const known = new Set(notes.map(note => note.file));
  const warnings = [];
  for (const file of walkFiles(vault)) {
    if (!/\.mdx?$/i.test(file) || known.has(file)) continue;
    const rel = relPosix(vault, file);
    let data;
    try {
      data = matter(fs.readFileSync(file, "utf8")).data;
    } catch {
      continue;
    }
    if (data.publish !== true) continue;
    const message = isAttachmentRel(rel)
      ? `附件目录中的笔记不会导出：${rel}`
      : `分类文件夹之外的笔记不会导出：${rel}`;
    warnings.push({ file: rel, line: 1, message });
  }
  return warnings;
}

export function syncVault({ vault, outDir, dryRun = false }) {
  const vaultPath = path.resolve(vault);
  const output = path.resolve(outDir);
  const result = {
    vault: vaultPath,
    outDir: output,
    dryRun,
    createdFolders: [],
    posts: { add: [], update: [], unchanged: [], delete: [] },
    images: { add: [], update: [], delete: [] },
    warnings: [],
    errors: [],
  };
  if (!fs.existsSync(vaultPath) || !fs.statSync(vaultPath).isDirectory()) {
    result.errors.push({ file: vaultPath, line: 1, message: "找不到 Obsidian 库目录" });
    return result;
  }

  for (const category of CATEGORY_NAMES) {
    const dir = path.join(vaultPath, category);
    if (!fs.existsSync(dir)) {
      result.createdFolders.push(category);
      if (!dryRun) fs.mkdirSync(dir, { recursive: true });
    }
  }

  const notes = loadNotes(vaultPath);
  const images = loadImages(vaultPath);
  result.warnings.push(...outsideWarnings(vaultPath, notes));
  const desired = new Map();

  for (const note of notes) {
    const errors = [];
    const warnings = [];
    if (note.data.publish !== true) continue;
    const date = formatDate(note.data.date, "date", note.rel, errors);
    const updated = note.data.updated
      ? formatDate(note.data.updated, "updated", note.rel, errors)
      : "";
    const ignoreSecrets = /%%\s*sync-ignore-secrets\s*%%/.test(note.raw);
    const transformed = transformBody(vaultPath, notes, images, note, warnings, errors);
    const tags = normalizeTags(note.data.tags);
    const description =
      typeof note.data.description === "string" && note.data.description.trim()
        ? note.data.description.trim()
        : plainDescription(transformed.body, note.title);
    if (!ignoreSecrets) {
      const scanned = [note.title, description, tags.join("\n"), transformed.body].join("\n");
      for (const kind of secretFindings(scanned)) {
        errors.push({ file: note.rel, line: 1, message: `敏感信息（${kind}）阻止导出` });
      }
    }
    result.warnings.push(...warnings);
    result.errors.push(...errors);
    if (errors.length) continue;
    const root = `${note.category}/${note.slug}`;
    const files = new Map();
    files.set(
      `${root}/index.md`,
      Buffer.from(
        renderPost({
          title: note.title,
          date,
          updated,
          description,
          slug: note.slug,
          tags,
          body: transformed.body,
        })
      )
    );
    for (const [name, bytes] of transformed.images) {
      files.set(`${root}/${name}`, bytes);
    }
    desired.set(`${note.category}/${note.slug}`, { root, files });
  }

  const existing = inventory(output);
  for (const [key, post] of desired) {
    const previous = existing.get(key);
    if (!previous || previous.root !== post.root) {
      if (previous) result.posts.delete.push(previous.root);
      result.posts.add.push(`${post.root}/index.md`);
      for (const rel of post.files.keys()) {
        if (rel.endsWith("/index.md")) continue;
        result.images.add.push(rel);
      }
      continue;
    }
    let changed = false;
    for (const [rel, bytes] of post.files) {
      const before = previous.files.get(rel);
      if (!before) {
        changed = true;
        if (rel.endsWith("/index.md")) result.posts.add.push(rel);
        else result.images.add.push(rel);
      } else if (!before.equals(bytes)) {
        changed = true;
        if (rel.endsWith("/index.md")) result.posts.update.push(rel);
        else result.images.update.push(rel);
      }
    }
    for (const rel of previous.files.keys()) {
      if (post.files.has(rel)) continue;
      changed = true;
      if (rel.endsWith("/index.md")) result.posts.delete.push(rel);
      else result.images.delete.push(rel);
    }
    if (!changed) result.posts.unchanged.push(`${post.root}/index.md`);
  }
  for (const [key, post] of existing) {
    if (desired.has(key)) continue;
    result.posts.delete.push(post.root);
    if (!post.root.endsWith(".md") && !post.root.endsWith(".mdx")) {
      for (const rel of post.files.keys()) {
        if (!rel.endsWith("/index.md")) result.images.delete.push(rel);
      }
    }
  }

  if (!dryRun) {
    for (const rel of result.posts.delete) {
      fs.rmSync(path.join(output, rel), { recursive: true, force: true });
    }
    for (const rel of [...result.images.delete]) {
      const abs = path.join(output, rel);
      if (fs.existsSync(abs)) fs.rmSync(abs, { force: true });
    }
    for (const post of desired.values()) {
      for (const [rel, bytes] of post.files) {
        const abs = path.join(output, rel);
        fs.mkdirSync(path.dirname(abs), { recursive: true });
        fs.writeFileSync(abs, bytes);
      }
    }
  }
  return result;
}

export function formatReport(result) {
  const lines = [
    `vault: ${result.vault}`,
    `out: ${result.outDir}`,
    `mode: ${result.dryRun ? "dry-run" : "write"}`,
  ];
  const section = (title, items) => {
    lines.push("", `${title}:`);
    if (!items.length) lines.push("  （无）");
    for (const item of items) lines.push(`  ${item}`);
  };
  section("create vault folder", result.createdFolders.map(name => `+ ${name}`));
  section("posts add", result.posts.add.map(item => `+ ${item}`));
  section("posts update", result.posts.update.map(item => `~ ${item}`));
  section("posts delete", result.posts.delete.map(item => `- ${item}`));
  section("posts unchanged", result.posts.unchanged);
  section("images add", result.images.add.map(item => `+ ${item}`));
  section("images update", result.images.update.map(item => `~ ${item}`));
  section("images delete", result.images.delete.map(item => `- ${item}`));
  section(
    "warnings",
    result.warnings.map(item => `${item.file}:${item.line} ${item.message}`)
  );
  section(
    "errors",
    result.errors.map(item => `${item.file}:${item.line} ${item.message}`)
  );
  return lines.join("\n");
}

export function resolveVault(cliVault) {
  if (cliVault) return path.resolve(cliVault);
  if (process.env.OBSIDIAN_VAULT) return path.resolve(process.env.OBSIDIAN_VAULT);
  const configPath = path.resolve("sync.config.json");
  if (fs.existsSync(configPath)) {
    const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
    if (config.vaultPath) return path.resolve(config.vaultPath);
  }
  return DEFAULT_VAULT;
}

function parseArgs(argv) {
  const args = { dryRun: false, vault: "", out: "", help: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--dry-run") args.dryRun = true;
    else if (arg === "--vault") args.vault = argv[++i] ?? "";
    else if (arg === "--out") args.out = argv[++i] ?? "";
    else if (arg === "--help" || arg === "-h") args.help = true;
    else throw new Error(`未知参数 ${arg}`);
  }
  return args;
}

function isCli() {
  const entry = process.argv[1];
  if (!entry) return false;
  return import.meta.url === pathToFileURL(path.resolve(entry)).href;
}

if (isCli()) {
  try {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
      console.log(`pnpm sync [--dry-run] [--vault <库路径>] [--out <输出目录>]

默认库路径：${DEFAULT_VAULT}
也可用环境变量 OBSIDIAN_VAULT，或 sync.config.json 的 vaultPath。
先运行 pnpm sync --dry-run，确认列表后再执行 pnpm sync。`);
      process.exit(0);
    }
    const result = syncVault({
      vault: resolveVault(args.vault),
      outDir: args.out ? path.resolve(args.out) : path.resolve(DEFAULT_OUT),
      dryRun: args.dryRun,
    });
    console.log(formatReport(result));
    process.exit(result.errors.length ? 1 : 0);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
