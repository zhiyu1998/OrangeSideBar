import { defineManifest } from '@crxjs/vite-plugin'
import pkg from './package.json'

export default defineManifest({
  manifest_version: 3,
  name: pkg.name,
  version: pkg.version,
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
    default_popup: 'src/popup/index.html',
  },
  content_scripts: [{
    js: ['src/content/main.ts'],
    matches: ['https://*/*'],
  }],
  permissions: [
    'sidePanel',
    'contentSettings',
  ],
  side_panel: {
    default_path: 'src/sidepanel/index.html',
  },
})
