import assert from "node:assert/strict";
import test from "node:test";
import { normalizeCovers } from "../src/utils/covers.mjs";

test("site cover normalization: 0–3, truncation warns with slug", () => {
  const warns = [];
  const warn = m => warns.push(m);
  assert.deepEqual(normalizeCovers(undefined, "a", warn), []);
  assert.deepEqual(normalizeCovers([], "a", warn), []);
  assert.deepEqual(normalizeCovers("x", "a", warn), ["x"]);
  assert.deepEqual(normalizeCovers([1, 2, 3, 4, 5], "many", warn), [1, 2, 3]);
  assert.equal(warns.length, 1);
  assert.match(warns[0], /many: 5 张/);
});
