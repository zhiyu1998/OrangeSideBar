<script setup lang="ts">
import { ref } from "vue";

const isPointerInside = ref(false);
const refElement = ref<HTMLElement | null>(null);

const state = ref({
  glare: { x: 50, y: 50 },
  rotate: { x: 0, y: 0 },
});

function handlePointerMove(event: PointerEvent) {
  const rotateFactor = 0.4;
  const rect = refElement.value?.getBoundingClientRect();
  if (!rect) return;

  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  
  const percentageX = (x / rect.width) * 100;
  const percentageY = (y / rect.height) * 100;

  state.value.glare.x = percentageX;
  state.value.glare.y = percentageY;
  state.value.rotate.x = -((percentageY - 50) * rotateFactor);
  state.value.rotate.y = (percentageX - 50) * rotateFactor;

  if (refElement.value) {
    refElement.value.style.setProperty("--m-x", `${percentageX}%`);
    refElement.value.style.setProperty("--m-y", `${percentageY}%`);
    refElement.value.style.setProperty("--r-x", `${state.value.rotate.x}deg`);
    refElement.value.style.setProperty("--r-y", `${state.value.rotate.y}deg`);
    refElement.value.style.setProperty("--opacity", "0.6");
  }
}

function handlePointerEnter() {
  isPointerInside.value = true;
}

function handlePointerLeave() {
  isPointerInside.value = false;
  if (refElement.value) {
    refElement.value.style.setProperty("--r-x", `0deg`);
    refElement.value.style.setProperty("--r-y", `0deg`);
    refElement.value.style.setProperty("--opacity", `0`);
  }
}
</script>

<template>
  <div
    ref="refElement"
    class="relative isolate [perspective:1000px] w-full transition-all duration-300"
    @pointermove="handlePointerMove"
    @pointerenter="handlePointerEnter"
    @pointerleave="handlePointerLeave"
  >
    <div
      class="h-full w-full overflow-hidden rounded-xl border border-white/10 dark:border-white/5 bg-background transition-transform duration-200 ease-out [transform:rotateX(var(--r-x))_rotateY(var(--r-y))]"
    >
      <div
        class="h-full w-full relative z-10"
      >
        <slot />
      </div>
      
      <!-- Glare Effect -->
      <div
        class="pointer-events-none absolute inset-0 z-20 opacity-[var(--opacity,0)] transition-opacity duration-300 [background:radial-gradient(farthest-corner_circle_at_var(--m-x,50%)_var(--m-y,50%),rgba(255,255,255,0.15)_0%,transparent_80%)]"
      ></div>
    </div>
  </div>
</template>
