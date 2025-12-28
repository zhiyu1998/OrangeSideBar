# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

OrangeSideBar is a Chrome extension that provides an AI-powered sidebar for webpage summarization and interaction. Built with Vue 3, TypeScript, and Vite. Supports 10+ LLM providers with features like dual-column model comparison, multi-turn conversations, and interactive learning modes.

## Development Commands

```bash
# Install dependencies (uses Bun)
bun install

# Start development server with hot reload
bun run dev

# Type-check and build for production
bun run build
```

**Loading the extension for testing:**
1. Run `bun run build` to generate the `dist/` folder
2. Navigate to `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked" and select the `dist/` directory

**Note:** During development with `bun run dev`, the extension can hot-reload but you may need to reload the extension page for manifest/background changes.

## Development Philosophy

- **KISS (Keep It Simple, Stupid)**: Favor simple, readable solutions over complex abstractions
- **YAGNI (You Aren't Gonna Need It)**: Implement features only when actually needed
- **SOLID Principles**: Single responsibility per component, open for extension, dependency inversion

## Architecture Overview

### Technology Stack

- **Framework:** Vue 3 with Composition API
- **Language:** TypeScript (strict mode)
- **State Management:** Pinia with Chrome storage persistence
- **Styling:** Tailwind CSS 4
- **UI Components:** Radix UI (via reka-ui) + Lucide icons
- **Build Tool:** Vite with CRXJS plugin for Chrome extension bundling
- **Package Manager:** Bun

### Source Structure

```
src/
├── background/           # Service worker (Chrome extension background)
│   └── index.ts          # Message routing, tab management
├── content/              # Content scripts injected into web pages
│   ├── main.ts           # Page content extraction with Readability
│   └── youtube-injector.ts  # YouTube subtitle interception (MAIN world)
├── sidepanel/            # Main sidebar UI
│   ├── index.html
│   ├── main.ts           # Vue app entry point
│   └── App.vue           # Root component
├── settings/             # Options/settings page
│   ├── index.html
│   ├── main.ts
│   └── App.vue
├── lib/
│   ├── llm/              # LLM provider abstraction layer
│   │   ├── types.ts      # Core LLM types
│   │   ├── base.ts       # Abstract BaseLLMProvider class
│   │   ├── openai.ts     # OpenAI-compatible provider
│   │   ├── anthropic.ts  # Anthropic Claude provider
│   │   └── factory.ts    # Provider factory & model routing
│   └── content/          # Content extraction utilities
│       ├── types.ts
│       ├── web.ts        # Readability-based extraction
│       ├── pdf.ts        # PDF.js processing
│       └── youtube.ts    # YouTube-specific handling
├── stores/               # Pinia state management
│   ├── chat.ts           # Chat sessions, messages, streaming state
│   ├── settings.ts       # Provider configs, prompts, theme
│   ├── ui.ts             # UI state (dialogs, layout)
│   └── plugins/chromeStorage.ts  # Auto-sync to chrome.storage.local
├── types/                # TypeScript type definitions
│   ├── provider.ts       # ProviderId, ProviderInfo, ProviderConfig
│   ├── settings.ts       # Theme, PromptMode, ModelParameters
│   ├── chat.ts           # Message, ChatSession, DualColumnState
│   └── index.ts
├── constants/            # Configuration constants
│   ├── providers.ts      # Provider definitions, MODEL_PROVIDER_MAPPING
│   ├── prompts.ts        # System prompts (default, paper, learning modes)
│   └── index.ts
├── components/           # Vue components
│   ├── ui/               # Base UI components (Button, Card, Dialog, etc.)
│   ├── layout/           # AppHeader, FeatureGrid
│   ├── chat/             # MessageList, InputGroup, ModelSelector
│   └── settings/         # ProviderSettings, PromptEditor
├── composables/          # Vue composables
│   ├── useChat.ts        # Chat logic and message handling
│   ├── useContent.ts     # Content extraction from pages
│   └── useTheme.ts       # Theme switching
└── assets/styles/        # Tailwind CSS
```

### Key Configuration Files

- `manifest.config.ts` - Chrome Manifest V3 definition (permissions, content scripts, service worker)
- `vite.config.ts` - Vite build config with Vue, Tailwind, CRXJS plugins
- `tsconfig.json` - TypeScript config with path alias `@/*` → `src/*`
- `package.json` - Dependencies and npm scripts

### Multi-LLM Provider System

**Supported Providers:** OpenAI, Anthropic, DeepSeek, Moonshot (Kimi), SiliconFlow, OpenRouter, Groq, Grok, Mistral, Ollama

**Provider Architecture:**
- `src/constants/providers.ts` - `PROVIDERS` object with base URLs, API paths, feature support flags
- `src/lib/llm/factory.ts` - `LLMProviderFactory` singleton that routes models to providers
- `src/lib/llm/openai.ts` - `OpenAIProvider` handles OpenAI-compatible APIs (most providers)
- `src/lib/llm/anthropic.ts` - `AnthropicProvider` handles Claude API

**Adding a new provider:**
1. Add entry to `PROVIDERS` in `src/constants/providers.ts`
2. Add model prefix mapping to `MODEL_PROVIDER_MAPPING`
3. If OpenAI-compatible, no new provider class needed
4. Add to `DEFAULT_PROVIDERS` in `src/stores/settings.ts`
5. If thinking/reasoning model, add to `THINKING_MODELS`

### State Management

Pinia stores with automatic Chrome storage persistence via `chromeStoragePlugin`:

- **chat store** - Sessions, messages, streaming state, dual-column layout
- **settings store** - Provider configs (API keys, base URLs), model parameters, system prompts, theme
- **ui store** - Dialog visibility, layout mode

**Excluded from persistence:** `isStreaming`, `abortController`, `isLoadingModels`

### Chrome Extension Message Passing

**Background → Content Script actions:**
- `PING` - Check if content script loaded
- `FETCH_PAGE_CONTENT` - Get structured HTML via Readability
- `FETCH_TEXT_CONTENT` - Get plain text
- `GET_PAGE_URL` - Current URL
- `GET_VIDEO_INFO` - YouTube/Bilibili detection
- `GET_YOUTUBE_SUBTITLES` - Cached subtitle data

**Side panel → Background actions:**
- `GET_TAB_INFO` - Active tab info
- `getYouTubeSubtitles` - Request subtitles from content script
- `openSettings` - Open options page

### Prompt System

Three modes defined in `src/constants/prompts.ts`:
- **Default** - General conversation with time awareness
- **Paper** - Academic paper analysis
- **Learning** - Interactive Socratic tutoring (160+ lines)

User customizations stored per mode in settings store.

## Code Style Guidelines

- 2-space indentation
- Conventional commits with emoji prefixes (✨ feat, 🐛 fix, 📄 docs, 🦄 refactor)
- Path alias `@/` for imports from `src/`
- Vue Composition API with `<script setup lang="ts">`
- Async/await for asynchronous operations
- Streaming responses with AbortController for cancellation

## Build & Release

**GitHub Actions Workflows:**
- `build-crx.yml` - Builds and signs CRX on release publication
- `release-draft.yml` - Manages draft releases

**Output:**
- `dist/` - Vite build output (load as unpacked extension)
- `release/crx-orangesidebar-{version}.zip` - Packaged ZIP for distribution
