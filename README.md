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
pnpm test
pnpm build
```

同步 Obsidian 笔记时先预览，再写入：

```bash
pnpm sync --dry-run
pnpm sync
```

默认库路径是 `/Users/yinming/Library/CloudStorage/GoogleDrive-yinming8086@gmail.com/我的云端硬盘/Obsidian`。可用 `--vault`、环境变量 `OBSIDIAN_VAULT`，或把 `sync.config.example.json` 复制为 `sync.config.json` 后修改 `vaultPath`（该文件不入库）。`--out` 可改输出目录，默认 `src/content/posts`。

只扫描 `价值投资`、`初级会计`、`随手札记`。图片放在各分类的 `附件/`（Obsidian 的 `attachmentFolderPath` 为 `./附件`），笔记用 `![[x.png]]` 或 `![](附件/1.jpg)`。`附件/` 不会被当成文章。Astro 类型生成是 `pnpm astro:sync`。

## 内容

文章放在 `src/content/posts/` 下的三个分类文件夹：`价值投资`、`初级会计`、`随手札记`。分类由文件夹决定，front matter 不写 category。只有 `publish: true` 的文章会进入站点；缺少该字段时 `pnpm build` 会失败。URL 使用英文或拼音 `slug`。

当前「随手札记」里的两篇是 M1 冒烟占位，非正式文章。本机第一次正式 `pnpm sync` 时，库里没有同 slug 的笔记就会删掉它们。
