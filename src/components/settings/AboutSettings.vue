<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ExternalLink, Github, MessageCircle, RefreshCw, Shield, Tag } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { getVersionInfo, getCurrentVersion, type VersionInfo } from '@/lib/version'

const REPO_URL = 'https://github.com/zhiyu1998/OrangeSideBar'

const currentVersion = getCurrentVersion()
const checking = ref(false)
const info = ref<VersionInfo | null>(null)

const links = [
  { key: 'github', icon: Github, url: REPO_URL },
  { key: 'issues', icon: MessageCircle, url: `${REPO_URL}/issues` },
  { key: 'releases', icon: Tag, url: `${REPO_URL}/releases` },
  { key: 'privacy', icon: Shield, url: `${REPO_URL}/blob/main/PRIVACY_POLICY.md` },
] as const

type UpdateStatus = 'idle' | 'checking' | 'latest' | 'available' | 'error'

const updateStatus = computed<UpdateStatus>(() => {
  if (checking.value) return 'checking'
  if (!info.value) return 'idle'
  // Latest fetch failed (e.g. network) — surface as check failure
  if (info.value.latest === null) return 'error'
  return info.value.updateAvailable ? 'available' : 'latest'
})

function openUrl(url: string) {
  chrome.tabs.create({ url })
}

async function checkUpdates() {
  checking.value = true
  try {
    info.value = await getVersionInfo()
  } finally {
    checking.value = false
  }
}

onMounted(() => {
  void checkUpdates()
})
</script>

<template>
  <div class="space-y-12">
    <!-- Hero: App info & update check -->
    <section class="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
      <div class="space-y-2">
        <h3 class="text-sm font-bold tracking-tight">{{ $t('settings.about.title') }}</h3>
        <p class="text-xs text-muted-foreground leading-relaxed">
          {{ $t('settings.about.titleDesc') }}
        </p>
      </div>

      <div class="lg:col-span-2">
        <div class="bg-muted/20 border rounded-2xl p-6 space-y-6">
          <div class="flex items-center gap-4">
            <div class="w-14 h-14 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center shadow-inner">
              <img src="/logo_48.png" alt="OrangeSideBar" class="h-9 w-9 drop-shadow-md" />
            </div>
            <div>
              <h4 class="text-lg font-black tracking-tight">OrangeSideBar</h4>
              <p class="text-[10px] font-mono uppercase tracking-widest text-primary">{{ currentVersion }}</p>
            </div>
          </div>

          <p class="text-xs text-muted-foreground leading-relaxed">
            {{ $t('settings.about.tagline') }}
          </p>

          <div class="border-t pt-5">
            <div class="flex items-center justify-between gap-4">
              <div class="space-y-0.5 min-w-0">
                <Label class="text-sm font-semibold">{{ $t('settings.about.checkUpdates') }}</Label>
                <p
                  v-if="updateStatus === 'checking'"
                  class="text-[10px] text-muted-foreground"
                >
                  {{ $t('settings.about.checking') }}
                </p>
                <p
                  v-else-if="updateStatus === 'latest'"
                  class="text-[10px] text-emerald-600 dark:text-emerald-400"
                >
                  {{ $t('settings.about.upToDate') }}
                </p>
                <p
                  v-else-if="updateStatus === 'available'"
                  class="text-[10px] text-primary font-medium"
                >
                  {{ $t('settings.about.updateAvailable', { version: info?.latest }) }}
                </p>
                <p
                  v-else-if="updateStatus === 'error'"
                  class="text-[10px] text-muted-foreground/70"
                >
                  {{ $t('settings.about.checkFailed') }}
                </p>
              </div>

              <div class="flex items-center gap-2 flex-shrink-0">
                <Button
                  v-if="updateStatus === 'available'"
                  size="sm"
                  class="h-7 text-[10px]"
                  @click="openUrl(`${REPO_URL}/releases`)"
                >
                  {{ $t('settings.about.viewRelease') }}
                  <ExternalLink class="ml-1 h-3 w-3" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  class="h-7 text-[10px]"
                  :disabled="checking"
                  @click="checkUpdates"
                >
                  <RefreshCw :class="['mr-1 h-3 w-3', checking ? 'animate-spin' : '']" />
                  {{ $t('settings.about.checkUpdates') }}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Links -->
    <section class="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start border-t pt-12">
      <div class="space-y-2">
        <h3 class="text-sm font-bold tracking-tight">{{ $t('settings.about.links') }}</h3>
        <p class="text-xs text-muted-foreground leading-relaxed">
          {{ $t('settings.about.linksDesc') }}
        </p>
      </div>

      <div class="lg:col-span-2">
        <div class="rounded-2xl border bg-muted/20 p-2 space-y-1">
          <button
            v-for="link in links"
            :key="link.key"
            class="w-full flex items-center justify-between px-4 py-3 rounded-xl hover:bg-accent/60 transition-colors group"
            @click="openUrl(link.url)"
          >
            <span class="flex items-center gap-3 text-sm font-semibold">
              <component :is="link.icon" class="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
              {{ $t(`settings.about.${link.key}`) }}
            </span>
            <ExternalLink class="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-primary transition-colors" />
          </button>
        </div>
      </div>
    </section>

    <!-- Footer -->
    <div class="pt-2 text-center text-[10px] text-muted-foreground/50 italic">
      {{ $t('settings.about.copyright') }}
    </div>
  </div>
</template>
