# Ming

个人博客，部署在 <https://yinminghhh.github.io>。

界面与骨架基于 [AstroPaper](https://github.com/satnaing/astro-paper) v6.1.0。主题代码已复制进本仓库自行维护（非 submodule），许可证为 MIT，Copyright (c) 2023 Sat Naing，见 [`LICENSE`](./LICENSE)。

## 环境

与主题一致：

- Node.js `>=22.12.0`（GitHub Actions 使用 Node 24，与主题 CI 相同）
- pnpm `11.3.0`（锁定在 `package.json` 的 `packageManager`）

## 命令

```bash
pnpm install
pnpm dev
pnpm build
```

`pnpm sync` 是 Astro 的类型生成，不是内容同步。

## 内容

文章放在 `src/content/posts/` 下的三个分类文件夹：`价值投资`、`初级会计`、`杂项`。分类由文件夹决定，front matter 不写 category。只有 `publish: true` 的文章会进入站点。URL 使用英文或拼音 `slug`。

当前「杂项」里的两篇是 M1 冒烟占位，非正式文章。
