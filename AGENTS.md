# AGENTS.md

## 项目概述

OrangeSideBar 是一个 Chrome 浏览器扩展（Manifest V3），提供 AI 驱动的侧边栏，用于网页摘要和对话。基于 Vue 3 + TypeScript + Vite（CRXJS）构建，状态管理使用 Pinia。支持多 LLM 提供商（OpenAI、Anthropic 及多个 OpenAI 兼容接口）、多轮对话、双栏对比、多种系统提示词模式。助手消息的 Markdown 渲染支持 Mermaid 图表（含 `mindmap`）和 KaTeX 数学公式。

## 开发命令

```bash
# 安装依赖（使用 Bun）
bun install

# 启动开发服务器（热更新）
bun run dev

# 类型检查 + 生产构建
bun run build
```

### 加载扩展进行测试

1. 运行 `bun run build` 生成 `dist/` 目录
2. 打开 `chrome://extensions/`
3. 开启「开发者模式」
4. 点击「加载已解压的扩展程序」，选择 `dist/` 目录

注意：Vite 7 建议 Node.js `20.19+`（或 `22.12+`）。较旧版本可能仍可构建，但升级可避免警告。

### CI/CD

- `.github/workflows/build-crx.yml` — 构建 crx 文件
- `.github/workflows/release-draft.yml` — 草拟 Release

## 架构概览

### 扩展入口点

- `src/background/index.ts` — MV3 Service Worker（消息路由、标签页管理、右键菜单「Copy Page as Markdown」、YouTube 字幕读取）
- `src/content/main.ts` — 内容脚本（基于 defuddle 的内容提取）
- `src/content/youtube-injector.ts` — YouTube 字幕注入器（`world: 'MAIN'`，注入到页面主世界以拦截字幕数据）
- `src/sidepanel/main.ts` / `src/sidepanel/App.vue` — 主侧边栏 UI
- `src/settings/main.ts` / `src/settings/App.vue` — 设置页面 UI
- `src/popup/main.ts` / `src/popup/App.vue` — 浏览器工具栏弹窗（提供「打开侧边栏」快捷入口）
- `src/offscreen/main.ts` / `src/offscreen/index.html` — 离屏文档（用于剪切板写入，通过 `chrome.offscreen` API 创建）

### 内容提取管线

`src/composables/useContent.ts` 提供统一的内容提取接口，根据 URL 自动选择提取方式：

- `src/lib/content/web.ts` — 网页内容，使用 `defuddle` 库提取正文
- `src/lib/content/pdf.ts` — PDF 内容，使用 `pdfjs-dist` 解析（支持本地文件和远程 URL）
- `src/lib/content/youtube.ts` — YouTube/Bilibili 字幕提取与格式化
- `src/lib/content/types.ts` — 提取内容的类型定义

后台右键菜单「Copy Page as Markdown」通过 `src/offscreen/main.ts` 将页面 HTML 转为 Markdown 后复制到剪切板。

### 状态管理与持久化

Pinia stores：

- `src/stores/settings.ts` — 提供商（API 密钥/Base URL/启用状态）、模型参数、提示词模式、每提供商模型缓存、主题
- `src/stores/chat.ts` — 聊天会话/消息、流式状态、双栏状态
- `src/stores/ui.ts` — UI 状态（对话框/布局模式等）

持久化 + 跨上下文同步：

- `src/stores/plugins/chromeStorage.ts` 将 store 状态同步到 `chrome.storage.local`，键名为 `orangesidebar_<storeId>`。
- 同时监听 `chrome.storage.onChanged`，使设置页的修改能即时反映到侧边栏/弹窗，无需手动刷新。
- 从持久化中排除的运行时键：`isStreaming`、`abortController`、`isLoadingModels`。

提供商启用/禁用行为（重要）：

- 禁用提供商会清除其缓存的模型列表，模型选择器不再显示。
- 若当前 `defaultModel` 属于已禁用的提供商，settings store 会尝试切换到已启用的模型。

### LLM 提供商系统

提供商元数据（用于 UI 和参考）：

- `src/constants/providers.ts` 包含 `PROVIDERS`（名称/图标/defaultBaseUrl/features）和辅助工具函数。

内置提供商（11 个）：

| 提供商 ID | 名称 | API 规范 |
|---|---|---|
| `openai` | OpenAI | openai |
| `anthropic` | Anthropic | anthropic |
| `zhipu` | 智谱清言 (GLM) | openai (兼容) |
| `deepseek` | DeepSeek | openai (兼容) |
| `moonshot` | Moonshot (Kimi) | openai (兼容) |
| `siliconflow` | SiliconFlow | openai (兼容) |
| `openrouter` | OpenRouter | openai (兼容) |
| `groq` | Groq | openai (兼容) |
| `grok` | Grok | openai (兼容) |
| `mistral` | Mistral | openai (兼容) |
| `ollama` | Ollama | openai (兼容) |

此外支持自定义提供商（`AddProviderDialog`），可选择 `openai`/`anthropic`/`google` 三种 API 规范。

提供商实现：

- `src/lib/llm/openai.ts` — OpenAI 兼容 `/chat/completions` + `/models` 客户端（用于 OpenAI 及大多数 OpenAI 兼容提供商）
- `src/lib/llm/anthropic.ts` — Anthropic Claude 客户端（静态模型列表；无 models 端点）

工厂与路由：

- `src/lib/llm/factory.ts` 管理提供商实例和模型→提供商路由。
- OpenAI 兼容提供商通过克隆 `OpenAIProvider` 实例实现（重写 `providerId`）。

聊天管线：

- `src/composables/useChat.ts` 构建 API 消息 + 系统提示词，解析提供商，验证提供商已启用/已配置，然后流式返回响应。
- 提供商解析优先使用缓存的模型列表（对前缀不匹配的第三方模型 ID 更可靠）。

推理强度（Reasoning Effort）：

- `src/components/chat/ReasoningEffortSelector.vue` 允许用户选择推理强度（`auto`/`none`/`minimal`/`low`/`medium`/`high`/`xhigh`），通过 `ChatParams.reasoningEffort` 传递给 LLM。
- `src/lib/llm/openai.ts` 中针对 OpenAI 兼容接口处理 `reasoning_effort` 和 `OpenAIRequestMode`（`chat_completions` / `responses`）。

注意：提供商定义目前存在于多处（`constants/providers.ts`、store 默认值、设置 UI 列表）。添加/移除提供商时需更新所有相关位置。

### 设置 UI（提供商/模型/提示词）

- `src/components/settings/ProviderSettings.vue`
  - 启用/禁用提供商（reka-ui `Switch` 使用 `modelValue` / `update:modelValue`）
  - 配置 API 密钥 + Base URL
  - 「测试连接」获取模型并缓存到 `settingsStore.cachedModels[providerId]`
- `src/components/settings/AddProviderDialog.vue` — 添加自定义提供商
- `src/components/settings/ModelConfig.vue` — 从已启用提供商获取模型，选择全局 `defaultModel`
- `src/components/settings/PromptEditor.vue` — 编辑系统提示词（Default/Paper/Learning）
- `src/components/settings/GeneralSettings.vue` — 通用设置

### UI 体系

组件库基于 **shadcn-vue**（底层使用 reka-ui），配置在 `components.json`，样式使用 **Tailwind CSS v4** + `tw-animate-css`。

`src/components/ui/` 下包含 12 类 UI 组件：accordion、avatar、badge、button、card、dialog、dropdown-menu、input、pagination、scroll-area、select、separator、slider、switch、tabs、textarea、tooltip。

其他功能组件：

- `src/components/chat/` — 聊天相关组件：`MessageItem`、`MessageList`、`InputGroup`、`ModelSelector`、`ReasoningEffortSelector`、`TabMentionPopover`
- `src/components/layout/` — 布局组件：`AppHeader`、`FeatureGrid`、`SessionHistoryPanel`
- `src/components/share/` — 分享组件：`ShareImageDialog`（基于 `html2canvas-pro` 的截图分享）、`ConversationShareCard`
- `src/components/settings/` — 设置页组件（见上文）
- `src/components/inspira/ui/` — 装饰性 UI 组件（BorderBeam、GlareCard、InteractiveGridPattern）
- `src/components/features/` — 特性展示组件

主题系统（`src/composables/useTheme.ts`）：支持 light / dark / system 三态切换，通过 `src/settings/settingsStore.applyTheme()` 在 `<html>` 上切换 `.dark` 类。

图标管理：`src/assets/icons/providerIcons.ts` 以 base64 SVG 字符串导出所有提供商图标。

### Markdown 渲染（侧边栏）

`src/components/chat/MarkdownRenderer.vue` 渲染助手消息，管线：

- `marked`（Markdown → HTML）
- `highlight.js`（代码高亮）
- `DOMPurify`（安全净化）
- `mermaid`（Mermaid 图表客户端渲染）
- `katex`（数学公式渲染）
- Mermaid 支持 fenced code blocks：
  - ` ```mermaid `
  - ` ```mindmap `（视为 Mermaid `mindmap`）

## 代码风格约定

- 2 空格缩进
- 优先小步、聚焦的改动（避免无关的重构）
- Vue Composition API + `<script setup lang="ts">`
- 使用 `@/` 路径别名导入 `src/` 下的文件
- `components.json` 为 shadcn-vue 的组件注册表

## 构建与发布

- `bun run build` 输出 `dist/`（作为未打包扩展加载），同时通过 `vite-plugin-zip-pack` 在 `release/` 下生成 ZIP。
- 扩展图标位于 `public/logo_*.png`。

## 备注

- `src/lib/markdown/` 和 `src/lib/share/` 目前为空目录，预留扩展。
- `src/constants/prompts.ts` 独立存放三套系统提示词（Default/Paper/Learning），由 `src/stores/settings.ts` 引用。
- `src/composables/useTabs.ts` 管理标签页提及和跨标签页通信。
- `motion-v` 用于 Vue 动画效果。

## 第三方 Anthropic 兼容提供商的 CORS/403 问题

**背景**：使用非官方 Anthropic endpoint（如 `api.openmodel.ai`）时，浏览器扩展直接 `fetch` 会返回 403。

**根本原因（三层）**：

1. Anthropic SDK 自动添加 `anthropic-dangerous-direct-browser-access: true` 和 `x-stainless-*` headers → 第三方服务器不识别，CORS 预检失败或被拒。
2. Chrome 对所有 `fetch`（含 background service worker）强制注入 `Sec-Fetch-Mode`、`Sec-Fetch-Site`、`Sec-Fetch-Dest` → JS 层无法删除，服务器据此识别浏览器来源返回 403。
3. Extension origin 的 `Origin: chrome-extension://...` header → 服务器可能据此拦截。

**解决方案**（见 `src/lib/llm/anthropic.ts` + `src/background/index.ts`）：

- `isOfficialApi` 检测：仅对非 `api.anthropic.com` 的 endpoint 启用代理，官方 API 不受影响。
- 在 JS 层（`backgroundProxyFetch`）剥掉 SDK 附加的 headers（`anthropic-dangerous-direct-browser-access`、`x-stainless-*`）以及不可序列化的 `signal`。
- 请求路由到 background service worker（`chrome.runtime.connect` port 传流）。
- background 在发请求前用 `declarativeNetRequest.updateDynamicRules` 动态添加规则，在网络栈层删除 `Sec-Fetch-*` 和 `Origin`，请求完成后立即清理规则。
- 需在 `manifest.config.ts` 的 `permissions` 中声明 `declarativeNetRequest`。
