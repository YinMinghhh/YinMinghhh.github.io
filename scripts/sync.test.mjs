import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { isChineseId, syncVault, toSlug } from "./sync.mjs";

const SITE_DIR = "src/content/posts";
const SITE_POSTS = fs
  .readdirSync(SITE_DIR, { recursive: true })
  .map(f => path.join(SITE_DIR, String(f)))
  .filter(f => fs.statSync(f).isFile());
const siteBefore = Object.fromEntries(
  SITE_POSTS.map(file => [file, fs.readFileSync(file)])
);

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "obsidian-sync-"));
}

function write(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

function note(vault, rel, { publish = true, title, date = "2026-01-02", slug, body = "正文。" } = {}) {
  const lines = ["---"];
  if (publish !== "omit") lines.push(`publish: ${publish}`);
  if (title) lines.push(`title: ${JSON.stringify(title)}`);
  if (date) lines.push(`date: ${date}`);
  if (slug) lines.push(`slug: ${slug}`);
  lines.push("---", "", body, "");
  write(path.join(vault, rel), lines.join("\n"));
}

function lineOf(file, needle) {
  const text = fs.readFileSync(file, "utf8");
  const index = text.indexOf(needle);
  assert.notEqual(index, -1, needle);
  return text.slice(0, index).split("\n").length;
}

function readOut(out, rel) {
  return fs.readFileSync(path.join(out, rel), "utf8");
}

test("toSlug and Chinese ID checksum", () => {
  assert.equal(toSlug("图"), "tu");
  assert.equal(toSlug("已发布笔记"), "yi-fa-bu-bi-ji");
  assert.equal(toSlug("第二篇"), "di-er-pian");
  assert.equal(toSlug("20230726-配网吧的LED广告屏"), "20230726-pei-wang-ba-de-led-guang-gao-ping");
  assert.equal(isChineseId("110101199003078515"), true);
  assert.equal(isChineseId("110101199003078516"), false);
});

test("acceptance 5: only publish true is exported, dry-run matches writes", () => {
  const vault = tempDir();
  const out = tempDir();
  fs.rmSync(out, { recursive: true });
  note(vault, "价值投资/已发布甲.md", { body: "甲的正文。" });
  note(vault, "初级会计/已发布乙.md", { body: "乙的正文。" });
  note(vault, "价值投资/未发布.md", { publish: false, body: "不应出现。" });
  note(vault, "价值投资/缺省.md", { publish: "omit", body: "不应出现。" });
  fs.mkdirSync(path.join(vault, "杂项"));

  const dry = syncVault({ vault, outDir: out, dryRun: true });
  assert.equal(dry.errors.length, 0);
  assert.equal(fs.existsSync(out), false);
  assert.deepEqual(
    dry.posts.add.sort(),
    [`价值投资/${toSlug("已发布甲")}/index.md`, `初级会计/${toSlug("已发布乙")}/index.md`].sort()
  );

  const real = syncVault({ vault, outDir: out, dryRun: false });
  assert.equal(real.errors.length, 0);
  assert.deepEqual(real.posts, dry.posts);
  assert.deepEqual(real.images, dry.images);
  assert.equal(fs.readdirSync(out).sort().join(), "价值投资,初级会计");
  assert.match(readOut(out, real.posts.add[0]), /甲的正文|乙的正文/);
  assert.equal(fs.existsSync(path.join(out, "价值投资", toSlug("未发布"))), false);
  assert.equal(fs.existsSync(path.join(out, "价值投资", toSlug("缺省"))), false);
});

test("acceptance 6: attachments, wikilinks, and width", () => {
  const vault = tempDir();
  const out = path.join(tempDir(), "out");
  const own = Buffer.from("own-png");
  const other = Buffer.from("other-png");
  const jpg = Buffer.from("jpg-bytes");
  const remote = Buffer.from("remote-png");
  write(path.join(vault, "价值投资/附件/图.png"), own);
  write(path.join(vault, "价值投资/附件/1.jpg"), jpg);
  write(path.join(vault, "初级会计/附件/x.png"), other);
  write(path.join(vault, "价值投资/附件/x.png"), own);
  write(path.join(vault, "初级会计/附件/only-remote.png"), remote);
  note(vault, "价值投资/附件/伪装.md", { body: "这不是文章。" });
  note(vault, "日记/今天.md", { body: "库外笔记。" });
  note(vault, "初级会计/第二篇.md", {
    body: "## 安装步骤\n\n先接线。",
  });
  note(vault, "价值投资/未发布笔记.md", { publish: false, body: "草稿。" });
  note(vault, "价值投资/已发布笔记.md", {
    body: [
      "开头",
      "",
      "![[图.png]]",
      "",
      "![[图.png|300]]",
      "",
      "![](附件/1.jpg)",
      "",
      "[[已发布笔记]]",
      "",
      "[[未发布笔记|别名]]",
      "",
      "[[第二篇#安装步骤]]",
      "",
      "![[x.png]]",
      "",
      "```",
      "![[图.png]]",
      "```",
    ].join("\n"),
  });
  note(vault, "杂项/标准图.md", { body: "看图 ![](附件/1.jpg)" });
  write(path.join(vault, "杂项/附件/1.jpg"), jpg);
  note(vault, "杂项/远图.md", { body: "![[only-remote.png]]" });

  const result = syncVault({ vault, outDir: out, dryRun: false });
  assert.equal(result.errors.length, 0, JSON.stringify(result.errors, null, 2));
  const post = readOut(out, `价值投资/${toSlug("已发布笔记")}/index.md`);
  assert.match(post, /!\[\]\(\.\/tu\.png\)/);
  assert.match(post, /<img src="\.\/tu\.png" alt="" width="300">/);
  assert.match(post, /!\[\]\(\.\/1\.jpg\)/);
  assert.match(post, /\[已发布笔记\]\(\/posts\/yi-fa-bu-bi-ji\/\)/);
  assert.match(post, /别名/);
  assert.doesNotMatch(post, /\[别名\]/);
  assert.match(post, /\[安装步骤\]\(\/posts\/di-er-pian\/#安装步骤\)/);
  assert.match(post, /```\n!\[\[图\.png\]\]\n```/);
  assert.equal(fs.readFileSync(path.join(out, "价值投资", toSlug("已发布笔记"), "tu.png"), "utf8"), "own-png");
  assert.equal(fs.readFileSync(path.join(out, "价值投资", toSlug("已发布笔记"), "x.png"), "utf8"), "own-png");
  assert.equal(fs.readFileSync(path.join(out, "杂项", toSlug("标准图"), "1.jpg"), "utf8"), "jpg-bytes");
  assert.match(readOut(out, `杂项/${toSlug("标准图")}/index.md`), /!\[\]\(\.\/1\.jpg\)/);
  assert.equal(
    fs.readFileSync(path.join(out, "杂项", toSlug("远图"), "only-remote.png"), "utf8"),
    "remote-png"
  );
  assert.equal(fs.existsSync(path.join(out, "价值投资", toSlug("伪装"))), false);
  assert.ok(result.warnings.some(item => item.message.includes("附件目录中的笔记不会导出")));
  assert.ok(result.warnings.some(item => item.message.includes("分类文件夹之外的笔记不会导出")));
  assert.ok(result.warnings.some(item => item.message.includes("未发布笔记不生成链接")));
  assert.equal(
    result.posts.add.some(item => item.includes("附件")),
    false
  );
});

test("missing image, missing note, and whole-note embed block that article", () => {
  const vault = tempDir();
  const out = path.join(tempDir(), "out");
  note(vault, "价值投资/已发布笔记.md", { body: "完好。" });
  note(vault, "价值投资/缺图.md", { body: "前\n![[不存在.png]]" });
  note(vault, "初级会计/嵌入.md", { body: "![[已发布笔记]]" });
  note(vault, "杂项/缺笔记.md", { body: "[[没有这篇]]" });

  const result = syncVault({ vault, outDir: out, dryRun: false });
  const missingImage = result.errors.find(item => item.message.includes("找不到图片"));
  const embed = result.errors.find(item => item.message.includes("不支持嵌入整篇笔记"));
  const missingNote = result.errors.find(item => item.message.includes("找不到笔记"));
  assert.ok(missingImage);
  assert.equal(missingImage.file, "价值投资/缺图.md");
  assert.equal(missingImage.line, lineOf(path.join(vault, "价值投资/缺图.md"), "![[不存在.png]]"));
  assert.ok(embed);
  assert.equal(embed.line, lineOf(path.join(vault, "初级会计/嵌入.md"), "![[已发布笔记]]"));
  assert.match(embed.message, /!\[\[已发布笔记\]\]/);
  assert.ok(missingNote);
  assert.equal(fs.existsSync(path.join(out, "价值投资", toSlug("缺图"))), false);
  assert.equal(fs.existsSync(path.join(out, "初级会计", toSlug("嵌入"))), false);
  assert.equal(fs.existsSync(path.join(out, "杂项", toSlug("缺笔记"))), false);
  assert.match(readOut(out, `价值投资/${toSlug("已发布笔记")}/index.md`), /完好/);
});

test("acceptance 7: email, phone, id, path, and key block export", () => {
  const vault = tempDir();
  const out = path.join(tempDir(), "out");
  note(vault, "价值投资/邮箱.md", { body: "联系 me@example.com" });
  note(vault, "价值投资/手机.md", { body: "电话 13800138000" });
  note(vault, "初级会计/身份证.md", { body: "号码 110101199003078515" });
  note(vault, "杂项/路径.md", { body: "见 /Users/yinming/secret" });
  note(vault, "杂项/密钥.md", { body: "token ghp_abcdefghijklmnopqrst" });
  note(vault, "杂项/干净.md", { body: "可以发布。" });

  const result = syncVault({ vault, outDir: out, dryRun: false });
  for (const kind of ["邮箱", "手机号", "身份证号", "本机路径", "疑似密钥"]) {
    assert.ok(
      result.errors.some(item => item.message === `敏感信息（${kind}）阻止导出`),
      kind
    );
  }
  assert.equal(result.posts.add.length, 1);
  assert.match(readOut(out, result.posts.add[0]), /可以发布/);
});

test("sync-ignore-secrets overrides the scan and comments are stripped", () => {
  const vault = tempDir();
  const out = path.join(tempDir(), "out");
  note(vault, "价值投资/放行.md", {
    body: "%%sync-ignore-secrets%%\n联系 me@example.com",
  });
  note(vault, "杂项/注释.md", {
    body: "可见 %%hidden@example.com 和 [[未发布笔记]]%% 可见",
  });

  const result = syncVault({ vault, outDir: out, dryRun: false });
  assert.equal(result.errors.length, 0, JSON.stringify(result.errors));
  const allowed = readOut(out, `价值投资/${toSlug("放行")}/index.md`);
  assert.match(allowed, /me@example\.com/);
  assert.doesNotMatch(allowed, /sync-ignore-secrets/);
  const commented = readOut(out, `杂项/${toSlug("注释")}/index.md`);
  assert.match(commented, /可见\s+可见/);
  assert.doesNotMatch(commented, /hidden@example\.com/);
  assert.doesNotMatch(commented, /\/posts\//);
  assert.equal(
    result.warnings.some(item => item.file === "杂项/注释.md"),
    false
  );
});

test("missing category folders are listed on dry-run and created on write", () => {
  const vault = tempDir();
  const out = path.join(tempDir(), "out");
  note(vault, "价值投资/只有一篇.md");
  const dry = syncVault({ vault, outDir: out, dryRun: true });
  assert.deepEqual(dry.createdFolders, ["初级会计", "杂项"]);
  assert.equal(fs.existsSync(path.join(vault, "杂项")), false);
  assert.equal(fs.existsSync(path.join(vault, "初级会计")), false);
  const real = syncVault({ vault, outDir: out, dryRun: false });
  assert.ok(fs.statSync(path.join(vault, "杂项")).isDirectory());
  assert.ok(fs.statSync(path.join(vault, "初级会计")).isDirectory());
  assert.equal(real.errors.length, 0);
});

test("oversized images warn, exclusive images are removed, second sync is unchanged", () => {
  const vault = tempDir();
  const out = path.join(tempDir(), "out");
  for (const name of ["价值投资", "初级会计", "杂项"]) fs.mkdirSync(path.join(vault, name));
  write(path.join(vault, "价值投资/附件/大图.png"), Buffer.alloc(1024 * 1024 + 1, 7));
  note(vault, "价值投资/大图笔记.md", { body: "![[大图.png]]" });
  write(path.join(out, "杂项/附件/keep.txt"), "keep");

  const first = syncVault({ vault, outDir: out, dryRun: false });
  assert.equal(first.errors.length, 0, JSON.stringify(first.errors));
  assert.ok(first.warnings.some(item => item.message.includes("图片超过 1MB")));
  const slug = toSlug("大图笔记");
  assert.equal(fs.statSync(path.join(out, "价值投资", slug, "da-tu.png")).size, 1024 * 1024 + 1);
  assert.equal(fs.readFileSync(path.join(out, "杂项/附件/keep.txt"), "utf8"), "keep");

  const second = syncVault({ vault, outDir: out, dryRun: false });
  assert.deepEqual(second.posts.add, []);
  assert.deepEqual(second.posts.delete, []);
  assert.deepEqual(second.posts.update, []);
  assert.deepEqual(second.posts.unchanged, [`价值投资/${slug}/index.md`]);

  fs.rmSync(path.join(vault, "价值投资/大图笔记.md"));
  const third = syncVault({ vault, outDir: out, dryRun: false });
  assert.ok(third.posts.delete.includes(`价值投资/${slug}`));
  assert.ok(third.images.delete.some(item => item.endsWith("/da-tu.png")));
  assert.equal(fs.existsSync(path.join(out, "价值投资", slug)), false);
  assert.equal(fs.readFileSync(path.join(out, "杂项/附件/keep.txt"), "utf8"), "keep");
});

test("drops non-whitelisted front matter and requires date", () => {
  const vault = tempDir();
  const out = path.join(tempDir(), "out");
  write(
    path.join(vault, "价值投资/字段.md"),
    ["---", "publish: true", "date: 2026-04-05", "author: ming", "slug: kept-slug", "tags:", "  - 会计", "---", "", "正文。", ""].join("\n")
  );
  note(vault, "杂项/无日期.md", { date: null, body: "没有日期。" });
  const result = syncVault({ vault, outDir: out, dryRun: false });
  const text = readOut(out, "价值投资/kept-slug/index.md");
  assert.match(text, /slug: "kept-slug"/);
  assert.match(text, /date: 2026-04-05/);
  assert.match(text, /会计/);
  assert.doesNotMatch(text, /author/);
  assert.ok(result.errors.some(item => item.file === "杂项/无日期.md" && item.message.includes("date")));
  assert.equal(fs.existsSync(path.join(out, "杂项", toSlug("无日期"))), false);
});

test("CLI dry-run and failing sync", () => {
  const vault = tempDir();
  const out = path.join(tempDir(), "out");
  for (const name of ["价值投资", "初级会计", "杂项"]) fs.mkdirSync(path.join(vault, name));
  note(vault, "价值投资/好.md");
  const dry = spawnSync(
    process.execPath,
    ["scripts/sync.mjs", "--vault", vault, "--out", out, "--dry-run"],
    { encoding: "utf8" }
  );
  assert.equal(dry.status, 0, dry.stderr);
  assert.match(dry.stdout, /mode: dry-run/);
  assert.equal(fs.existsSync(out), false);

  const byEnv = spawnSync(process.execPath, ["scripts/sync.mjs", "--out", out, "--dry-run"], {
    encoding: "utf8",
    env: { ...process.env, OBSIDIAN_VAULT: vault },
  });
  assert.equal(byEnv.status, 0, byEnv.stderr);
  assert.match(byEnv.stdout, new RegExp(vault.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));

  note(vault, "初级会计/坏.md", { body: "a@b.com" });
  const bad = spawnSync(process.execPath, ["scripts/sync.mjs", "--vault", vault, "--out", out], {
    encoding: "utf8",
  });
  assert.equal(bad.status, 1);
  assert.match(bad.stdout, /敏感信息（邮箱）/);
  assert.match(readOut(out, `价值投资/${toSlug("好")}/index.md`), /正文/);
  assert.equal(fs.existsSync(path.join(out, "初级会计", toSlug("坏"))), false);
});

test("site placeholders stay untouched", () => {
  for (const file of SITE_POSTS) {
    assert.equal(fs.readFileSync(file).equals(siteBefore[file]), true);
  }
});
