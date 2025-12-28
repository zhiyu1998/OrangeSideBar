import { defineManifest } from '@crxjs/vite-plugin'
import pkg from './package.json'

export default defineManifest({
  manifest_version: 3,
  name: pkg.name,
  version: pkg.version,
  description: '✨大橘侧边栏：一个开源的网页侧边栏对话总结工具，支持 OpenAI、Gemini、Anthropic 规范的 API，支持自动摘要、网页及视频翻译、多轮对话等功能✨',
  icons: {
    16: 'public/logo_16.png',
    32: 'public/logo_32.png',
    48: 'public/logo_48.png',
    128: 'public/logo_128.png',
  },
  action: {
    default_icon: {
      48: 'public/logo_48.png',
    },
    // No popup - clicking icon opens side panel via background.js
  },
  content_scripts: [
    {
      js: ['src/content/main.ts'],
      matches: ['https://*/*', 'http://*/*'],
    },
  ],
  permissions: [
    'sidePanel',
    'storage',
    'activeTab',
    'tabs',
    'clipboardWrite',
  ],
  host_permissions: ['<all_urls>'],
  side_panel: {
    default_path: 'src/sidepanel/index.html',
  },
  background: {
    service_worker: 'src/background/index.ts',
    type: 'module',
  },
  options_page: 'src/settings/index.html',
  web_accessible_resources: [
    {
      resources: ['src/content/youtube-injector.ts'],
      matches: ['https://www.youtube.com/*', 'https://youtube.com/*', 'https://m.youtube.com/*'],
    },
  ],
})
