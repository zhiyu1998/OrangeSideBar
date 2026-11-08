import { defineManifest } from '@crxjs/vite-plugin'
import pkg from './package.json'

export default defineManifest({
  manifest_version: 3,
  name: pkg.name,
  version: pkg.version,
  default_locale: 'en',
  description: '__MSG_manifestDescription__',
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
    default_title: '__MSG_actionTitle__',
    // No popup - clicking icon opens side panel via background.js
  },
  content_scripts: [
    {
      js: ['src/content/main.ts'],
      matches: ['https://*/*', 'http://*/*'],
    },
    {
      js: ['src/content/youtube-injector.ts'],
      matches: ['https://www.youtube.com/*', 'https://youtube.com/*', 'https://m.youtube.com/*', 'https://youtu.be/*'],
      run_at: 'document_start',
      world: 'MAIN',
    },
  ],
  permissions: [
    'sidePanel',
    'storage',
    'activeTab',
    'tabs',
    'clipboardWrite',
    'scripting',
    'contextMenus',
    'notifications',
    'offscreen',
    'declarativeNetRequest',
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
})
