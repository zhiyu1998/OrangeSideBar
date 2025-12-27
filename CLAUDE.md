# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

OrangeSideBar is a Chrome extension that provides an AI-powered sidebar for webpage summarization and interaction. It supports 18+ LLM providers, knowledge base integration with vector database (Qdrant), dual-column model comparison, and features like automatic summarization, translation, multi-turn conversations, and interactive learning modes.

## Development Commands

As this is a Chrome extension project, there are no build commands like npm/yarn. Development involves:

1. **Loading the extension for testing:**
   - Navigate to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked" and select the project directory

2. **Installing from release:**
   - Download `.crx` file from GitHub releases
   - Drag and drop into `chrome://extensions/`

3. **Automated builds:**
   - CRX files are automatically built via GitHub Actions on release
   - See `.github/workflows/build-crx.yml` for the build pipeline

## Development Philosophy
- **KISS (Keep It Simple, Stupid)**: Favor simple, readable solutions over complex abstractions
- **YAGNI (You Aren't Gonna Need It)**: Implement features only when actually needed
- **SOLID Principles**: Follow single responsibility per component, open for extension, and dependency inversion

## Architecture Overview

### File Structure

```
/root
├── manifest.json          # Manifest V3, Chrome 114+
├── background.js          # Service worker
├── side_panel.html        # Main UI sidebar
├── settings.html          # Configuration page
├── popup/                 # Popup component (currently unused)
├── css/
│   ├── styles.css         # Side panel styles
│   └── settings.css       # Settings page styles
├── scripts/
│   ├── constants.js       # 18+ providers, 3 system prompts, configurations
│   ├── llm.js             # Multi-provider LLM interface
│   ├── side_panel.js      # UI logic, dual-column mode, conversations
│   ├── settings.js        # Provider config, theme management
│   ├── content.js         # Page content extraction
│   ├── utils.js           # Helpers: PDF, subtitles, format utilities
│   ├── embedding.js       # Vector embedding generation (SiliconFlow API)
│   ├── qdrant.js          # Qdrant vector database wrapper
│   ├── youtube_subtitle_injector.js  # YouTube subtitle interception
│   └── third/             # Third-party libraries
├── images/                # Logos, icons
└── .github/workflows/     # CRX building, release management
```

### Core Components

**Chrome Extension Architecture:**
- `manifest.json` - Extension configuration with permissions and content scripts (Manifest V3)
- `background.js` - Service worker handling cross-tab communication and settings
- `side_panel.html/js` - Main UI sidebar with dual-column comparison mode
- `settings.html` - Configuration page for API keys, models, prompts, and knowledge base
- `content.js` - Content script injected into web pages for data extraction

**Script Organization:**
- `scripts/constants.js` - Central configuration including API endpoints, model mappings, system prompts, and provider definitions
- `scripts/llm.js` - LLM communication layer supporting multiple providers (OpenAI, Gemini, Anthropic format APIs)
- `scripts/settings.js` - Settings page functionality and storage management
- `scripts/side_panel.js` - Main sidebar logic, UI interactions, dual-column mode, and conversation management
- `scripts/utils.js` - Utility functions for content extraction, PDF processing, and subtitle handling
- `scripts/embedding.js` - Text embedding generation using SiliconFlow API for knowledge base
- `scripts/qdrant.js` - Qdrant vector database client wrapper for knowledge base operations
- `scripts/youtube_subtitle_injector.js` - YouTube-specific subtitle interception (runs in MAIN world)
- `scripts/third/` - Third-party libraries (PDF.js, Readability.js, Marked, Mermaid, KaTeX, html2canvas, qdrant-js)

### Multi-LLM Provider System

The extension supports 18+ LLM providers through a unified architecture:

**Supported Providers:**
- OpenAI, Azure OpenAI, Google Gemini, Anthropic Claude
- DeepSeek, Moonshot (Kimi), GLM (智谱清言)
- Groq, Grok, Mistral, SiliconFlow
- OpenRouter, GitHub Models, ModelScope
- NVIDIA, Poe, VolcEngine (火山引擎)
- Ollama (local/offline)

**Provider Constants (`constants.js`):**
- `PROVIDERS` object maps provider keys to identifiers
- `MODEL_MAPPINGS` array defines model prefix-to-provider relationships
- Each provider has dedicated base URLs, API paths, and default models
- Provider-specific features: fixed model lists, thinking process support, popular models

**LLM Communication (`llm.js`):**
- `chatWithOpenAIFormat()` - Handles OpenAI-compatible APIs (most providers)
- `chatWithGemini()` - Google Gemini-specific implementation
- `chatWithAnthropic()` - Anthropic Claude-specific implementation
- Universal functions automatically detect provider and route to appropriate handler
- Streaming support with AbortController for cancellation
- Thinking/reasoning process display for supported models (DeepSeek-R1, GLM-4.5, Gemini-2.5-pro, kimi-k2-thinking, etc.)

### Knowledge Base & Vector Database System

**Vector Embedding (`embedding.js`):**
- Generates text embeddings using SiliconFlow API
- Supports multiple embedding models (BAAI/bge-m3, Qwen3-Embedding variants)
- Configurable chunk size and overlap for document processing

**Qdrant Integration (`qdrant.js`):**
- Full CRUD operations for knowledge base collections
- Vector similarity search for RAG (Retrieval-Augmented Generation)
- Collection management and point operations

**Knowledge Base Features:**
- Collection selection and management in settings
- KB-augmented prompts via `buildKbAugmentedPrompt()` function
- Auto-save capability for responses to knowledge base
- Configurable retrieval limits

### Dual-Column Comparison Mode

The side panel supports a dual-column layout for model comparison:
- Run two different models simultaneously on the same prompt
- Quick action drawer for rapid feature access
- Layout toggle between single and dual-column modes
- Independent conversation threads per column

### Prompt System Architecture

**Three-Mode System:**
- **Default Mode**: General conversation with customizable system prompts (includes time awareness)
- **Paper Mode**: Academic paper analysis using `PAPER_SYSTEM_PROMPT`
- **Learning Mode**: Interactive tutoring using `LEARNING_MODE_PROMPT` (Socratic method, 600+ lines)

**Prompt Management:**
- System prompts stored in `constants.js` as defaults
- User customizations saved in Chrome local storage
- Mode-specific prompt selection in `side_panel.js` conversation flow
- Settings UI in `settings.html` allows per-mode prompt customization

### Storage and Configuration

**Chrome Storage Usage:**
- API keys and base URLs stored per provider in local storage
- Model lists cached after successful API connectivity tests
- User prompt customizations stored separately by type
- Theme preferences (light/dark/system) and UI state persistence
- Enabled providers toggle
- Qdrant configuration (URL, API key)
- Knowledge base settings (selected collection, retrieval limits)

**Settings Architecture:**
- Tab-based UI for different provider configurations
- Dynamic model loading with pagination and filtering
- Real-time API connectivity testing before saving
- Model filtering (free-only, popular, recommended) per provider
- Model parameters UI (Temperature, Top P, Frequency Penalty, Presence Penalty, Max Tokens)

### Content Extraction Pipeline

**Multi-Format Support:**
- **Web Pages**: Uses Readability.js for content extraction
- **PDF Files**: PDF.js for local file processing
- **Images**: Base64 encoding for multimodal model support
- **Videos**: Content extraction from video pages
- **YouTube**: Specialized subtitle interception via injector script

**YouTube Subtitle Interception (`youtube_subtitle_injector.js`):**
- Runs in MAIN world context on YouTube pages
- Intercepts fetch and XHR requests for subtitle data
- Caches subtitles in `window.__ytSubtitleCache`
- Captures both automatic and manual captions separately

**Message Actions in content.js:**
- `ACTION_FETCH_PAGE_CONTENT` - HTML content extraction
- `ACTION_FETCH_TEXT_CONTENT` - Plain text extraction
- `ACTION_COPY_PAGE_CONTENT` - HTML to clipboard
- `ACTION_COPY_PURE_PAGE_CONTENT` - Text to clipboard
- `ACTION_GET_PAGE_URL` - Current page URL
- `ACTION_FETCH_VIDEO_SUBTITLE_INFO` - Video subtitle detection

**Processing Flow:**
1. Content script (`content.js`) extracts page content
2. Background script facilitates cross-component communication
3. Side panel receives content and applies selected prompt mode
4. Optional: Knowledge base retrieval for RAG augmentation
5. LLM processing with provider-specific formatting
6. Response rendering with Markdown, LaTeX, and Mermaid support

### Key Extension Patterns

**Message Passing:**
- Background script coordinates between content scripts and side panel
- Action-based message routing (`ACTION_FETCH_PAGE_CONTENT`, etc.)
- Asynchronous response handling for cross-context communication

**Permission Management:**
- `activeTab` for current page access
- `storage` for configuration persistence
- `sidePanel` for sidebar functionality
- `<all_urls>` for universal content access

### Build & Release Pipeline

**GitHub Actions Workflows:**
- `build-crx.yml` - Automated CRX building on releases using `cardinalby/webext-buildtools`
- `release-draft.yml` - Draft release management with changelog automation
- Automatic contributor attribution in releases

## Important Implementation Notes

**Model Integration:**
- New LLM providers require entries in `PROVIDERS`, `MODEL_MAPPINGS`, and `DEFAULT_LLM_URLS`
- Provider-specific API handling may need new functions in `llm.js`
- UI tabs in `settings.html` need corresponding logic in `settings.js`
- Consider adding to `THINKING_MODELS` if the model supports reasoning display

**Prompt System:**
- New prompt modes require constants in `constants.js`
- Mode selection logic in `side_panel.js` conversation handlers
- Settings UI components for prompt customization

**Knowledge Base Integration:**
- Embedding model configuration in `embedding.js`
- Qdrant collection operations in `qdrant.js`
- RAG prompt building in `side_panel.js` via `buildKbAugmentedPrompt()`

**Content Security:**
- API keys stored locally, never transmitted to unauthorized endpoints
- Input sanitization for user content before LLM submission
- Base64 encoding for image handling to prevent XSS

**Chrome Extension Constraints:**
- Manifest V3 service worker limitations (no persistent background page)
- Content Security Policy restrictions on inline scripts
- Cross-origin requests handled through extension permissions
- YouTube subtitle injection requires MAIN world context

## Code Style Guidelines

Following the established patterns in the codebase:
- Use consistent 2-space indentation
- Follow conventional commit format with emoji prefixes (✨ feat, 🐛 fix, 📄 docs, etc.)
- Store constants in `constants.js` rather than hardcoding values
- Use Chrome storage API for persistence across sessions
- Handle provider-specific API differences in dedicated functions
- Maintain separation between UI logic (`settings.js`, `side_panel.js`) and LLM communication (`llm.js`)
- Use async/await for asynchronous operations
- Support streaming responses where applicable
