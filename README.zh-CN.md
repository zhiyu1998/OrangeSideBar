<div align="center">
  <img src="https://s2.loli.net/2025/12/14/eTM6BG78Q2kRujH.png" width="180" height="180" alt="OrangeSideBar logo" />

# OrangeSideBar

一个开源的 Chrome 浏览器扩展，为网页提供 AI 侧边栏总结与对话能力。

[English README](./README.md)
</div>

<img width="2425" height="1284" alt="OrangeSideBar screenshot" src="https://github.com/user-attachments/assets/c4693ad8-de38-45ac-add3-e4461122fd76" />

## 项目简介

OrangeSideBar 是一个基于 Manifest V3 的 Chrome 扩展，使用 Vue 3、TypeScript、Vite 和 Pinia 构建。它可以提取网页、PDF 和视频字幕内容，并在侧边栏中发送给你选择的 LLM，用于摘要生成或多轮对话。

## 功能特性

- 一键网页摘要
- 侧边栏多轮对话
- 支持网页、PDF、YouTube 和 Bilibili 内容提取
- 支持双栏对比模式
- 提供多种系统提示词模式，适配不同阅读场景
- 助手消息支持 Mermaid 与 KaTeX 渲染
- 支持将对话截图分享为图片
- 支持 OpenAI、Anthropic 以及多个 OpenAI 兼容提供商
- 支持自定义提供商、自定义 API Base URL 和 API Key

## 内置提供商

- OpenAI
- Anthropic
- 智谱 GLM
- DeepSeek
- Moonshot (Kimi)
- SiliconFlow
- OpenRouter
- Groq
- Grok
- Mistral
- Ollama

此外也支持添加符合 OpenAI、Anthropic 或 Google 风格 API 的自定义提供商。

## 开发

### 环境要求

- Bun
- Vite 7 推荐 Node.js 20.19+

### 安装依赖

```bash
bun install
```

### 启动开发服务器

```bash
bun run dev
```

### 类型检查并构建

```bash
bun run build
```

## 在 Chrome 中加载扩展

1. 运行 `bun run build`。
2. 打开 `chrome://extensions/`。
3. 开启 `开发者模式`。
4. 点击 `加载已解压的扩展程序`。
5. 选择 `dist/` 目录。

如果需要读取本地 PDF，请在 Chrome 扩展详情页中开启 `Allow access to file URLs`。

## 发布版本

打包版本可在 GitHub Releases 页面下载：

https://github.com/zhiyu1998/OrangeSideBar/releases

## 技术栈

- Vue 3
- TypeScript
- Vite + CRXJS
- Pinia
- Tailwind CSS v4
- shadcn-vue / reka-ui
