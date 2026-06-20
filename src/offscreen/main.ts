import Defuddle, { createMarkdownContent } from 'defuddle/full'

function quoteFrontmatter(value: string) {
  return JSON.stringify(value)
}

function formatFrontmatter(result: ReturnType<InstanceType<typeof Defuddle>['parse']>, url: string) {
  const fields = [
    ['title', result.title],
    ['author', result.author],
    ['site', result.site],
    ['published', result.published],
    ['source', url],
    ['domain', result.domain],
    ['language', result.language],
    ['description', result.description],
    ['word_count', result.wordCount],
  ] as const

  const lines = fields
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => typeof value === 'number'
      ? `${key}: ${value}`
      : `${key}: ${quoteFrontmatter(String(value))}`)

  return ['---', ...lines, '---', ''].join('\n')
}

function htmlToMarkdown(html: string, url: string): string | null {
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')
  const extractor = new Defuddle(doc, {
    url,
    useAsync: false,
    separateMarkdown: true,
  })
  const result = extractor.parse()
  const markdown = result.contentMarkdown || createMarkdownContent(result.content, url)

  if (!markdown.trim()) {
    return null
  }

  const title = result.title || doc.title || 'Untitled'
  const header = [
    formatFrontmatter(result, url),
    `# ${title}`,
    '',
  ].join('\n')

  return `${header}${markdown.trim()}`
}

function copyText(text: string) {
  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.style.position = 'fixed'
  textarea.style.top = '0'
  textarea.style.left = '0'
  textarea.style.width = '1px'
  textarea.style.height = '1px'
  textarea.style.opacity = '0'
  textarea.setAttribute('readonly', '')

  document.body.appendChild(textarea)
  textarea.focus()
  textarea.select()

  try {
    const copied = document.execCommand('copy')
    if (!copied) {
      throw new Error('Clipboard copy command was rejected')
    }
  } finally {
    document.body.removeChild(textarea)
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action !== 'COPY_MARKDOWN_HTML_TO_CLIPBOARD') {
    return false
  }

  void (async () => {
    try {
      let text = ''

      const html = typeof message.html === 'string' ? message.html : ''
      const url = typeof message.url === 'string' ? message.url : ''
      text = htmlToMarkdown(html, url) || ''

      if (!text) {
        throw new Error('No content was extracted')
      }

      copyText(text)
      sendResponse({ success: true, length: text.length })
    } catch (error) {
      sendResponse({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  })()

  return true
})
