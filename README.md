<div align="center">
  <img src="https://s2.loli.net/2025/12/14/eTM6BG78Q2kRujH.png" width="180" height="180" alt="OrangeSideBar logo" />

# OrangeSideBar

An open-source Chrome extension that adds an AI side panel for page summarization and chat.

[中文说明](./README.zh-CN.md)
</div>

<img width="2425" height="1284" alt="OrangeSideBar screenshot" src="https://github.com/user-attachments/assets/c4693ad8-de38-45ac-add3-e4461122fd76" />

## Overview

OrangeSideBar is a Manifest V3 Chrome extension built with Vue 3, TypeScript, Vite, and Pinia. It can extract content from web pages, PDFs, and video transcripts, then send that content to your preferred LLM in a side panel for summarization or multi-turn chat.

## Features

- One-click page summarization
- Multi-turn chat in the side panel
- Content extraction for web pages, PDFs, YouTube, and Bilibili
- Dual-panel comparison mode
- Multiple system prompt modes for different reading workflows
- Mermaid and KaTeX rendering in assistant messages
- Share conversation snapshots as images
- Support for OpenAI, Anthropic, and multiple OpenAI-compatible providers
- Custom providers with configurable API base URLs and keys

## Built-in Providers

- OpenAI
- Anthropic
- Zhipu GLM
- DeepSeek
- Moonshot (Kimi)
- SiliconFlow
- OpenRouter
- Groq
- Grok
- Mistral
- Ollama

You can also add custom providers that follow OpenAI, Anthropic, or Google-style APIs.

## Development

### Requirements

- Bun
- Node.js 20.19+ recommended by Vite 7

### Install

```bash
bun install
```

### Start development server

```bash
bun run dev
```

### Type-check and build

```bash
bun run build
```

## Load the Extension in Chrome

1. Run `bun run build`.
2. Open `chrome://extensions/`.
3. Enable `Developer mode`.
4. Click `Load unpacked`.
5. Select the `dist/` directory.

If you want to read local PDF files, enable `Allow access to file URLs` for the extension in Chrome.

## Releases

Download packaged builds from the GitHub releases page:

https://github.com/zhiyu1998/OrangeSideBar/releases

## Tech Stack

- Vue 3
- TypeScript
- Vite + CRXJS
- Pinia
- Tailwind CSS v4
- shadcn-vue / reka-ui

