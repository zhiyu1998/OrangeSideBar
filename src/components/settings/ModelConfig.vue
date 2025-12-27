<script setup lang="ts">
import { computed } from 'vue'
import { RotateCcw } from 'lucide-vue-next'
import { useSettingsStore } from '@/stores/settings'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Button } from '@/components/ui/button'

const settingsStore = useSettingsStore()

const params = computed(() => settingsStore.modelParameters)

interface ParamConfig {
  key: keyof typeof params.value
  label: string
  description: string
  min: number
  max: number
  step: number
  useSlider: boolean
}

const paramConfigs: ParamConfig[] = [
  {
    key: 'temperature',
    label: 'Temperature',
    description: 'Controls randomness. Lower values make responses more focused and deterministic.',
    min: 0,
    max: 2,
    step: 0.1,
    useSlider: true,
  },
  {
    key: 'topP',
    label: 'Top P',
    description: 'Controls diversity via nucleus sampling. 0.5 means half of all likelihood-weighted options are considered.',
    min: 0,
    max: 1,
    step: 0.05,
    useSlider: true,
  },
  {
    key: 'maxTokens',
    label: 'Max Tokens',
    description: 'Maximum number of tokens to generate in the response.',
    min: 1,
    max: 128000,
    step: 1,
    useSlider: false,
  },
  {
    key: 'frequencyPenalty',
    label: 'Frequency Penalty',
    description: 'Reduces repetition by penalizing tokens that have already appeared.',
    min: 0,
    max: 2,
    step: 0.1,
    useSlider: true,
  },
  {
    key: 'presencePenalty',
    label: 'Presence Penalty',
    description: 'Encourages new topics by penalizing tokens that have appeared at all.',
    min: 0,
    max: 2,
    step: 0.1,
    useSlider: true,
  },
]

function updateParam(key: keyof typeof params.value, value: number) {
  settingsStore.updateModelParameters({ [key]: value })
}

function resetParams() {
  settingsStore.resetModelParameters()
}
</script>

<template>
  <div class="space-y-6">
    <Card>
      <CardHeader class="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle>Model Parameters</CardTitle>
          <CardDescription>
            Fine-tune the model behavior with these parameters.
          </CardDescription>
        </div>
        <Button variant="outline" size="sm" @click="resetParams">
          <RotateCcw class="mr-2 h-4 w-4" />
          Reset to Defaults
        </Button>
      </CardHeader>
      <CardContent class="space-y-6">
        <div
          v-for="config in paramConfigs"
          :key="config.key"
          class="space-y-3"
        >
          <div class="flex items-center justify-between">
            <Label :for="config.key">{{ config.label }}</Label>
            <span class="text-sm font-medium tabular-nums">
              {{ params[config.key] }}
            </span>
          </div>

          <template v-if="config.useSlider">
            <Slider
              :id="config.key"
              :model-value="[params[config.key]]"
              :min="config.min"
              :max="config.max"
              :step="config.step"
              class="w-full"
              @update:model-value="(v) => v && updateParam(config.key, v[0])"
            />
          </template>
          <template v-else>
            <Input
              :id="config.key"
              type="number"
              :value="params[config.key]"
              :min="config.min"
              :max="config.max"
              :step="config.step"
              @input="(e: Event) => updateParam(config.key, Number((e.target as HTMLInputElement).value))"
            />
          </template>

          <p class="text-xs text-muted-foreground">
            {{ config.description }}
          </p>
        </div>
      </CardContent>
    </Card>
  </div>
</template>
