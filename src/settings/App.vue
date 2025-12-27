<script setup lang="ts">
import { onMounted } from 'vue'
import { useSettingsStore } from '@/stores/settings'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import GeneralSettings from '@/components/settings/GeneralSettings.vue'
import ProviderSettings from '@/components/settings/ProviderSettings.vue'
import ModelConfig from '@/components/settings/ModelConfig.vue'
import PromptEditor from '@/components/settings/PromptEditor.vue'

const settingsStore = useSettingsStore()

onMounted(() => {
  settingsStore.applyTheme()
})
</script>

<template>
  <div class="min-h-screen bg-background text-foreground">
    <!-- Header -->
    <header class="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
      <div class="container flex h-14 items-center px-4">
        <div class="flex items-center gap-3">
          <img src="/logo_48.png" alt="OrangeSideBar" class="h-8 w-8" />
          <h1 class="text-lg font-semibold">OrangeSideBar Settings</h1>
        </div>
      </div>
    </header>

    <!-- Main Content -->
    <main class="container px-4 py-6">
      <Tabs default-value="general" class="w-full">
        <TabsList class="grid w-full grid-cols-4 mb-6">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="providers">Providers</TabsTrigger>
          <TabsTrigger value="model">Model</TabsTrigger>
          <TabsTrigger value="prompts">Prompts</TabsTrigger>
        </TabsList>

        <ScrollArea class="h-[calc(100vh-180px)]">
          <TabsContent value="general" class="mt-0">
            <GeneralSettings />
          </TabsContent>

          <TabsContent value="providers" class="mt-0">
            <ProviderSettings />
          </TabsContent>

          <TabsContent value="model" class="mt-0">
            <ModelConfig />
          </TabsContent>

          <TabsContent value="prompts" class="mt-0">
            <PromptEditor />
          </TabsContent>
        </ScrollArea>
      </Tabs>
    </main>
  </div>
</template>
