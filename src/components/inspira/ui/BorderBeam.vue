<script setup lang="ts">
import { computed } from "vue";
import { cn } from "@/lib/utils";

interface Props {
  className?: string;
  size?: number;
  duration?: number;
  borderWidth?: number;
  anchor?: number;
  colorFrom?: string;
  colorTo?: string;
  delay?: number;
}

const props = withDefaults(defineProps<Props>(), {
  size: 200,
  duration: 15,
  anchor: 90,
  borderWidth: 1.5,
  colorFrom: "#ffaa40",
  colorTo: "#9c40ff",
  delay: 0,
});

const beamStyle = computed(() => ({
  "--size": `${props.size}`,
  "--duration": `${props.duration}`,
  "--anchor": `${props.anchor}`,
  "--border-width": `${props.borderWidth}`,
  "--color-from": props.colorFrom,
  "--color-to": props.colorTo,
  "--delay": `-${props.delay}`,
}));
</script>

<template>
  <div
    :style="beamStyle"
    :class="
      cn(
        'pointer-events-none absolute inset-0 rounded-[inherit] [border:calc(var(--border-width)*1px)_solid_transparent]',

        // mask styles
        '![mask-clip:padding-box,border-box] ![mask-composite:intersect] [mask:linear-gradient(transparent,transparent),linear-gradient(white,white)]',

        // pseudo styles
        'after:absolute after:aspect-square after:w-[calc(var(--size)*1px)] after:animate-[border-beam_calc(var(--duration)*1s)_linear_infinite] after:[animation-delay:calc(var(--delay)*1s)] after:[background:linear-gradient(to_left,var(--color-from),var(--color-to),transparent)] after:[offset-anchor:calc(var(--anchor)*1%)_50%] after:[offset-path:rect(0_auto_auto_0_round_calc(var(--size)*1px))]',
        className,
      )
    "
  ></div>
</template>
