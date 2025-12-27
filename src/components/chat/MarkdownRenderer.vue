<script setup lang="ts">
import { ref, watch } from 'vue'
import DOMPurify from 'dompurify'
import { marked } from 'marked'
import hljs from 'highlight.js'

interface Props {
  content: string
  isStreaming?: boolean
}

const props = defineProps<Props>()

const renderedContent = ref('')

// Configure marked with syntax highlighting
marked.setOptions({
  breaks: true,
  gfm: true,
})

// Custom renderer for code blocks with syntax highlighting
const renderer = new marked.Renderer()

renderer.code = ({ text, lang }) => {
  const language = lang && hljs.getLanguage(lang) ? lang : 'plaintext'
  const highlighted = hljs.highlight(text, { language }).value
  return `<pre class="hljs"><code class="language-${language}">${highlighted}</code></pre>`
}

renderer.codespan = ({ text }) => {
  return `<code class="inline-code">${text}</code>`
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
</script>

<template>
  <div
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
  border-left: 3px solid hsl(var(--primary));
  padding-left: 1em;
  margin: 0.5em 0;
  color: hsl(var(--muted-foreground));
}

.markdown-body pre {
  margin: 0.75em 0;
  padding: 0.75em;
  border-radius: 0.5rem;
  background-color: hsl(var(--muted));
  overflow-x: auto;
}

.markdown-body pre code {
  font-size: 0.8em;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

.markdown-body .inline-code {
  padding: 0.15em 0.4em;
  border-radius: 0.25rem;
  background-color: hsl(var(--muted));
  font-size: 0.85em;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

.markdown-body a {
  color: hsl(var(--primary));
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
  border: 1px solid hsl(var(--border));
  padding: 0.5em 0.75em;
  text-align: left;
}

.markdown-body th {
  background-color: hsl(var(--muted));
  font-weight: 600;
}

.markdown-body img {
  max-width: 100%;
  border-radius: 0.5rem;
  margin: 0.5em 0;
}

.markdown-body hr {
  border: none;
  border-top: 1px solid hsl(var(--border));
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
