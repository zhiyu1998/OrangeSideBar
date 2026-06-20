<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import DOMPurify from 'dompurify'
import { marked } from 'marked'
import hljs from 'highlight.js'
import mermaid from 'mermaid'

interface Props {
  content: string
  isStreaming?: boolean
  theme?: 'auto' | 'light' | 'dark'
}

const props = withDefaults(defineProps<Props>(), {
  theme: 'auto',
})

const renderedContent = ref('')
const containerRef = ref<HTMLElement | null>(null)

function formatMermaidError(error: unknown): unknown {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    }
  }

  if (error && typeof error === 'object') {
    try {
      return JSON.parse(JSON.stringify(error))
    } catch {
      return error
    }
  }

  return error
}

function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function getMermaidTheme(): 'default' | 'dark' {
  if (props.theme === 'light') return 'default'
  if (props.theme === 'dark') return 'dark'
  return document.documentElement.classList.contains('dark') ? 'dark' : 'default'
}

async function renderMermaid() {
  if (props.isStreaming) return

  await nextTick()
  const container = containerRef.value
  if (!container) return

  const nodes = Array.from(container.querySelectorAll<HTMLElement>('.mermaid'))
  if (nodes.length === 0) return

  try {
    mermaid.initialize({
      startOnLoad: false,
      theme: getMermaidTheme(),
      securityLevel: 'strict',
    })

    for (const node of nodes) {
      node.removeAttribute('data-processed')
    }

    await mermaid.run({ nodes })
  } catch (error) {
    console.warn('[MarkdownRenderer] Mermaid render failed:', formatMermaidError(error))
  }
}

// Configure marked with syntax highlighting
marked.setOptions({
  breaks: true,
  gfm: true,
})

// Custom renderer for code blocks with syntax highlighting
const renderer = new marked.Renderer()

renderer.code = ({ text, lang }) => {
  const rawLang = (lang || '').trim().toLowerCase()

  if (rawLang === 'mermaid' || rawLang === 'mindmap') {
    const diagram = rawLang === 'mindmap' ? `mindmap\n${text}` : text
    return `<div class="mermaid">${escapeHtml(diagram)}</div>`
  }

  const language = rawLang && hljs.getLanguage(rawLang) ? rawLang : 'plaintext'
  const highlighted = hljs.highlight(text, { language }).value
  return `<pre class="hljs"><code class="language-${language}">${highlighted}</code></pre>`
}

renderer.codespan = ({ text }) => {
  return `<code class="inline-code">${escapeHtml(text)}</code>`
}

marked.use({ renderer })

// Render markdown content
async function renderContent(content: string) {
  if (!content) {
    renderedContent.value = ''
    return
  }

  try {
    const html = await marked.parse(content)
    renderedContent.value = DOMPurify.sanitize(html, {
      ADD_TAGS: ['iframe'],
      ADD_ATTR: ['allow', 'allowfullscreen', 'frameborder', 'scrolling'],
    })
    if (!props.isStreaming) {
      await renderMermaid()
    }
  } catch (error) {
    console.error('Markdown render error:', error)
    renderedContent.value = content
  }
}

// Watch for content changes
watch(
  () => props.content,
  (newContent) => {
    renderContent(newContent)
  },
  { immediate: true }
)

watch(
  () => props.isStreaming,
  (streaming) => {
    if (!streaming) {
      renderMermaid()
    }
  }
)
</script>

<template>
  <div
    ref="containerRef"
    class="markdown-body prose prose-sm dark:prose-invert max-w-none"
    v-html="renderedContent"
  />
</template>

<style>
.markdown-body {
  font-size: 0.875rem;
  line-height: 1.6;
}

.markdown-body p {
  margin: 0.5em 0;
}

.markdown-body p:first-child {
  margin-top: 0;
}

.markdown-body p:last-child {
  margin-bottom: 0;
}

.markdown-body ul,
.markdown-body ol {
  margin: 0.5em 0;
  padding-left: 1.5em;
}

.markdown-body li {
  margin: 0.25em 0;
}

.markdown-body h1,
.markdown-body h2,
.markdown-body h3,
.markdown-body h4,
.markdown-body h5,
.markdown-body h6 {
  margin-top: 1em;
  margin-bottom: 0.5em;
  font-weight: 600;
}

.markdown-body h1 { font-size: 1.5em; }
.markdown-body h2 { font-size: 1.3em; }
.markdown-body h3 { font-size: 1.15em; }

.markdown-body blockquote {
  border-left: 3px solid var(--primary);
  padding-left: 1em;
  margin: 0.5em 0;
  color: var(--muted-foreground);
}

.markdown-body pre {
  margin: 0.75em 0;
  padding: 0.75em;
  border-radius: 0.5rem;
  background-color: var(--muted);
  overflow-x: auto;
}

.markdown-body pre code {
  font-size: 0.8em;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

.markdown-body .mermaid {
  margin: 0.75em 0;
  overflow-x: auto;
}

.markdown-body .mermaid svg {
  max-width: 100%;
  height: auto;
}

.markdown-body .inline-code {
  padding: 0.15em 0.4em;
  border-radius: 0.25rem;
  background-color: var(--muted);
  font-size: 0.85em;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

.markdown-body a {
  color: var(--primary);
  text-decoration: underline;
  text-underline-offset: 2px;
}

.markdown-body a:hover {
  opacity: 0.8;
}

.markdown-body table {
  border-collapse: collapse;
  margin: 0.75em 0;
  width: 100%;
}

.markdown-body th,
.markdown-body td {
  border: 1px solid var(--border);
  padding: 0.5em 0.75em;
  text-align: left;
}

.markdown-body th {
  background-color: var(--muted);
  font-weight: 600;
}

.markdown-body img {
  max-width: 100%;
  border-radius: 0.5rem;
  margin: 0.5em 0;
}

.markdown-body hr {
  border: none;
  border-top: 1px solid var(--border);
  margin: 1em 0;
}

/* Syntax highlighting - One Dark style */
.hljs {
  color: #abb2bf;
  background: #282c34;
}

.hljs-comment,
.hljs-quote {
  color: #5c6370;
  font-style: italic;
}

.hljs-keyword,
.hljs-selector-tag {
  color: #c678dd;
}

.hljs-string,
.hljs-template-literal {
  color: #98c379;
}

.hljs-number,
.hljs-literal {
  color: #d19a66;
}

.hljs-built_in,
.hljs-type {
  color: #e5c07b;
}

.hljs-function,
.hljs-title {
  color: #61afef;
}

.hljs-variable,
.hljs-attr {
  color: #e06c75;
}

.hljs-params {
  color: #abb2bf;
}
</style>
