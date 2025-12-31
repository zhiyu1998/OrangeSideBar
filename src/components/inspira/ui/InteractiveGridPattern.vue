<script setup lang="ts">
import { ref } from "vue";

interface Props {
  width?: number;
  height?: number;
  squares?: [number, number]; // [horizontal, vertical]
  className?: string;
}

const props = withDefaults(defineProps<Props>(), {
  width: 40,
  height: 40,
  squares: () => [24, 24],
});

const hoveredSquare = ref<string | null>(null);

function handleMouseEnter(x: number, y: number) {
  hoveredSquare.value = `${x}-${y}`;
}

function handleMouseLeave() {
  hoveredSquare.value = null;
}
</script>

<template>
  <svg
    :width="width * squares[0]"
    :height="height * squares[1]"
    class="pointer-events-none absolute inset-0 h-full w-full stroke-gray-400/30"
    v-bind="$attrs"
  >
    <defs>
      <pattern
        id="grid-pattern"
        :width="width"
        :height="height"
        patternUnits="userSpaceOnUse"
        x="-1"
        y="-1"
      >
        <path
          :d="`M.5 ${height}V.5H${width}`"
          fill="none"
          stroke-dasharray="0"
        />
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill="url(#grid-pattern)" />
    
    <!-- Interactive layer -->
    <g class="pointer-events-auto">
      <template v-for="x in squares[0]" :key="`col-${x}`">
        <rect
          v-for="y in squares[1]"
          :key="`square-${x}-${y}`"
          :x="(x - 1) * width"
          :y="(y - 1) * height"
          :width="width"
          :height="height"
          fill="transparent"
          class="transition-colors duration-300 hover:fill-orange-500/10"
          @mouseenter="handleMouseEnter(x, y)"
          @mouseleave="handleMouseLeave"
        />
      </template>
    </g>
  </svg>
</template>
