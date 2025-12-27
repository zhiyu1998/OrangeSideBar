import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { chromeStoragePlugin } from '@/stores/plugins/chromeStorage'
import App from './App.vue'
import '@/assets/styles/main.css'

const pinia = createPinia()
pinia.use(chromeStoragePlugin)

const app = createApp(App)
app.use(pinia)
app.mount('#app')
