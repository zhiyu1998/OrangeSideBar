# Repository Guidelines

This file provides guidance to Claude Code (claude.ai/code) when working in this repository.

## Project Overview

OrangeSideBar is a Chrome extension (Manifest V3) that provides an AI-powered side panel for webpage summarization and chat. It is built with Vue 3 + TypeScript + Vite (CRXJS) and uses Pinia for state management. The extension supports multiple LLM providers (OpenAI, Anthropic, and several OpenAI-compatible endpoints), multi-turn chat, dual-column comparison, and multiple system-prompt modes. Assistant Markdown rendering supports Mermaid diagrams (including `mindmap`).

## Development Commands

```bash
# Install dependencies (uses Bun)
bun install

# Start development server with hot reload
bun run dev

# Type-check and build for production
bun run build
```

### Loading the extension for testing

1. Run `bun run build` to generate the `dist/` folder
2. Open `chrome://extensions/`
3. Enable “Developer mode”
4. Click “Load unpacked” and select the `dist/` directory

Note: Vite 7 recommends Node.js `20.19+` (or `22.12+`). Builds may still succeed on slightly older Node versions, but upgrading avoids warnings.

## Architecture Overview

### Extension entrypoints

- `src/background/index.ts` — MV3 service worker (message routing, tab management)
- `src/content/main.ts` — content script (Readability-based extraction)
- `src/sidepanel/main.ts` / `src/sidepanel/App.vue` — main side panel UI
- `src/settings/main.ts` / `src/settings/App.vue` — settings page UI
- `src/popup/main.ts` / `src/popup/App.vue` — browser action popup

### State management and persistence

Pinia stores:

- `src/stores/settings.ts` — providers (API keys/base URLs/enabled), model parameters, prompt modes, per-provider model cache
- `src/stores/chat.ts` — chat sessions/messages, streaming state, dual-column state
- `src/stores/ui.ts` — UI state (dialogs/layout mode, etc.)

Persistence + cross-context sync:

- `src/stores/plugins/chromeStorage.ts` syncs store state to `chrome.storage.local` under the key `orangesidebar_<storeId>`.
- It also listens to `chrome.storage.onChanged` so changes from the Settings page reflect in the Side panel/Popup (and vice versa) without requiring a full reload.
- Runtime-only keys excluded from persistence: `isStreaming`, `abortController`, `isLoadingModels`.

Provider enable/disable behavior (important):

- Disabling a provider clears its cached models so model selectors stop showing them.
- If the current `defaultModel` belongs to a disabled provider, the settings store will attempt to switch to an enabled model.

### LLM provider system

Provider metadata (mostly UI/reference):

- `src/constants/providers.ts` contains `PROVIDERS` (name/icon/defaultBaseUrl/features) and helper utilities.

Provider implementations:

- `src/lib/llm/openai.ts` — OpenAI-compatible `/chat/completions` + `/models` client (used for OpenAI and most OpenAI-compatible providers)
- `src/lib/llm/anthropic.ts` — Anthropic Claude client (static model list; no models endpoint)

Provider factory and routing:

- `src/lib/llm/factory.ts` manages provider instances and model→provider routing.
- OpenAI-compatible providers are served by cloned `OpenAIProvider` instances (providerId overridden).

Chat pipeline:

- `src/composables/useChat.ts` builds API messages + system prompt, resolves the provider, verifies the provider is enabled/configured, then streams responses.
- Provider resolution prefers the cached model list (more reliable for 3rd‑party model IDs that don’t match simple prefixes).

### Settings UI (providers/models/prompts)

- `src/components/settings/ProviderSettings.vue`
  - Enables/disables providers (reka-ui `Switch` uses `modelValue` / `update:modelValue`)
  - Configures API key + base URL per provider
  - “Test Connection” fetches models and caches them into `settingsStore.cachedModels[providerId]`
- `src/components/settings/ModelConfig.vue` fetches models from enabled providers and selects the global `defaultModel`
- `src/components/settings/PromptEditor.vue` edits the 3 system prompts (Default/Paper/Learning)

Note: provider definitions currently exist in multiple places (constants, store defaults, settings UI list). When adding/removing a provider, update all relevant lists.

### Markdown rendering (Side panel)

- `src/components/chat/MarkdownRenderer.vue` renders assistant messages via:
  - `marked` (Markdown → HTML)
  - `highlight.js` (code highlighting)
  - `DOMPurify` (sanitization)
- Mermaid is supported via fenced code blocks:
  - ```mermaid
  - ```mindmap (treated as Mermaid `mindmap`)

## Code Style Guidelines

- 2-space indentation
- Prefer small, focused changes (avoid unrelated refactors)
- Vue Composition API with `<script setup lang="ts">`
- Use path alias `@/` for imports from `src/`

## Build & Release

- `bun run build` outputs `dist/` (load as unpacked extension) and also creates a ZIP under `release/` (via `vite-plugin-zip-pack`).
