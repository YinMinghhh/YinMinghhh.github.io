---
publish: true
title: "踩坑：VS Code 远程开发搞定 Codex 插件网络代理"
date: 2026-03-03
description: "踩坑：VS Code 远程开发搞定 Codex 插件网络代理 日期 ：2026年3月3日 标签 ： VS Code Remote SSH Proxy Codex 今天花了不少时间折腾 VS Code 远程环境下的 Codex 插件（ ope"
slug: 20260303
tags:
  - "VS Code"
  - "Remote-SSH"
  - "Proxy"
  - "Codex"
---


# 踩坑：VS Code 远程开发搞定 Codex 插件网络代理

**日期**：2026年3月3日
**标签**：`VS Code` `Remote-SSH` `Proxy` `Codex`

今天花了不少时间折腾 VS Code 远程环境下的 Codex 插件（`openai.chatgpt`）。因为平时需要在远程服务器上写代码，但服务器本身没有科学上网环境（其实是刚开始不知道有没有，想尝试一下不用服务器科学上网也不干扰同事的方法），加上 ChatGPT Plus 的包月套餐必须走 OAuth 网页验证才能免除 API 计费，整个配置过程堪称一波三折。好在最后终于用一种最干净、不干扰同事的方式解决了。

记录一下整个踩坑与解决的过程。

---

## ✅ 最终的成功方案：工作区环境隔离代理

经过多次试错，最终的方案是：直接在远程服务器上配置代理（还是得科学上网），但不碰系统的 `~/.bashrc`，而是利用 VS Code 的工作区设置来进行环境变量隔离。

我在远程服务器的 VS Code 设置（`settings.json`）中直接指定了 HTTP 代理，并给集成终端注入了独立的环境变量。之前以为必须加上的 `no_proxy` 白名单，实际上在这个配置下并不需要，系统依然能正常处理 OAuth 的回调。

最终跑通的配置代码如下：

```json
{
    "http.proxy": "http://127.0.0.1:7890",
    "http.proxySupport": "override",
    "http.proxyStrictSSL": false,
    "terminal.integrated.env.linux": {
        "http_proxy": "http://127.0.0.1:7890",
        "https_proxy": "http://127.0.0.1:7890",
        "all_proxy": "socks5://127.0.0.1:7891"
    }
}

```

保存后重载窗口（> Reload Window），终端和插件都能顺利访问外部网络，成功弹出了 OAuth 登录页面，Google 账号授权后的回调能平稳落地。没有影响到同服务器的其他开发者。

---

## ❌ 失败尝试一：SSH 隧道转发到本地（引发网络海啸）

最开始，我想到的方案是借用本地电脑的代理网络。于是我在本地电脑的 SSH `config` 文件里加了端口转发：`RemoteForward 7890 127.0.0.1:7890`，并在 VS Code 里设置全局走这个 7890 端口。

**结果引发了灾难性的代理死循环：**

1. 刚开始连上时好像很正常。
2. 当我点击插件的“登录”按钮，并在本地浏览器完成 Google 授权后，网页尝试跳转回 `127.0.0.1` 的本地回调地址。
3. VS Code 远程服务侦测到本地请求，通过 SSH 隧道把它扔回给本地代理；本地代理又把它当成外部请求处理……流量打结。
4. **故障表现**：本地的代理软件瞬间崩溃假死，本地浏览器连带系统所有网络全部提示“（某域名）未发送任何数据”。只有强行关闭 VS Code，切断 SSH 隧道后，本地网络才恢复正常。

## ❌ 失败尝试二：强制插件在本地运行（UI正常，功能瘫痪）

为了绕开第一步尝试的远程网络回环，我尝试了 VS Code Remote 的一个高级特性：强行把这个插件当成 UI 组件，让它完全在我本地的电脑上运行。

我在本地的 `settings.json` 中加入了以下配置：

```json
{
    "remote.extensionKind": {
        "openai.chatgpt": [
            "ui"
        ]
    }
}

```

**结果**：网络确实不崩溃了，登录页面也能正常唤起，但这是一个“花架子”。虽然插件 UI 顺利加载，但当我尝试发起对话时直接报错，插件似乎无法在本地运行的状态下正常读取和分析远程工作区的代码上下文，核心功能彻底瘫痪。此方案宣告失败。

---

**总结**：在 Linux 服务器上搞远程开发，网络代理的层级（SSH、VS Code、终端、系统）非常容易发生嵌套碰撞。用 VS Code 自身的 `terminal.integrated.env.linux` 隔离环境变量，才是成本最低的解法。

## 参考文献

1. [知乎：codex登录失败：Token exchange failed](https://zhuanlan.zhihu.com/p/2004958184473903528)

2. Gemini 3.1 Pro 辅助解决
