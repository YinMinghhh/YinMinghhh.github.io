import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { unpublishedPosts } from "./check-publish.mjs";

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "check-publish-"));
}

test("flags posts without boolean publish true and skips 附件", () => {
  const dir = tempDir();
  fs.mkdirSync(path.join(dir, "杂项/附件"), { recursive: true });
  fs.mkdirSync(path.join(dir, "价值投资"), { recursive: true });
  fs.writeFileSync(
    path.join(dir, "杂项/ok.md"),
    "---\npublish: true\ntitle: ok\n---\n\n正文\n"
  );
  fs.writeFileSync(path.join(dir, "杂项/缺.md"), "---\ntitle: 缺\n---\n\n正文\n");
  fs.writeFileSync(
    path.join(dir, "价值投资/字符串.md"),
    "---\npublish: \"true\"\n---\n\n正文\n"
  );
  fs.writeFileSync(
    path.join(dir, "杂项/附件/不算文章.md"),
    "---\ntitle: 附件里的文件\n---\n\n正文\n"
  );

  assert.deepEqual(unpublishedPosts(dir).sort(), ["价值投资/字符串.md", "杂项/缺.md"]);
});

test("current site posts pass", () => {
  assert.deepEqual(unpublishedPosts("src/content/posts"), []);
});

test("CLI fails the build when publish is missing", () => {
  const dir = tempDir();
  fs.mkdirSync(path.join(dir, "杂项"), { recursive: true });
  fs.writeFileSync(path.join(dir, "杂项/nope.md"), "---\ntitle: nope\n---\n\n正文\n");
  const result = spawnSync(process.execPath, ["scripts/check-publish.mjs", dir], {
    encoding: "utf8",
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /publish: true/);
  assert.match(result.stderr, /杂项\/nope\.md/);

  const ok = spawnSync(process.execPath, ["scripts/check-publish.mjs", "src/content/posts"], {
    encoding: "utf8",
  });
  assert.equal(ok.status, 0, ok.stderr);
});
