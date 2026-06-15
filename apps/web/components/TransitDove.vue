<script setup lang="ts">
import { gsap } from 'gsap';

const root = ref<HTMLElement | null>(null);
let ctx: ReturnType<typeof gsap.context> | undefined;

onMounted(() => {
  if (!root.value) return;
  ctx = gsap.context(() => {
    gsap.matchMedia().add('(prefers-reduced-motion: no-preference)', () => {
      gsap.to('.dove', { x: 30, y: -4, duration: 2.2, repeat: -1, yoyo: true, ease: 'sine.inOut' });
    });
  }, root.value);
});

onUnmounted(() => ctx?.revert());
</script>

<template>
  <span ref="root" class="inline-flex items-center gap-1.5 text-inkFaint italic">
    <span class="dove inline-block not-italic">🕊</span>
    <slot>在途中…</slot>
  </span>
</template>
