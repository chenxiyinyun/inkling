<script setup lang="ts">
import { gsap } from 'gsap';

const props = defineProps<{ fishing?: boolean }>();
const root = ref<HTMLElement | null>(null);
let ctx: ReturnType<typeof gsap.context> | undefined;

onMounted(() => {
  if (!root.value) return;
  ctx = gsap.context(() => {
    gsap.matchMedia().add('(prefers-reduced-motion: no-preference)', () => {
      gsap.to('.bottle', { y: -8, rotation: 4, transformOrigin: '50% 100%', duration: 2.4, repeat: -1, yoyo: true, ease: 'sine.inOut' });
      gsap.to('.waves', { y: 3, duration: 3.2, repeat: -1, yoyo: true, ease: 'sine.inOut' });
    });
  }, root.value);
});

onUnmounted(() => ctx?.revert());

/** 抛竿入海：涟漪扩散 + 漂流瓶轻沉。 */
function playCast() {
  if (!root.value) return;
  const q = gsap.utils.selector(root.value);
  const ripple = q('.ripple');
  gsap.killTweensOf(ripple);
  gsap.fromTo(ripple, { scale: 0, opacity: 0.5, transformOrigin: '50% 50%' }, { scale: 3.4, opacity: 0, duration: 1.1, ease: 'power1.out' });
  gsap.fromTo('.bottle', { y: -8 }, { y: 7, duration: 0.5, yoyo: true, repeat: 1, ease: 'sine.inOut' });
}

watch(
  () => props.fishing,
  (v) => {
    if (v) playCast();
  },
);
</script>

<template>
  <div ref="root" class="mx-auto w-full max-w-[320px] select-none">
    <svg viewBox="0 0 320 150" class="w-full h-auto" role="img" aria-label="漂流海">
      <defs>
        <linearGradient id="sea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#E6F1FB" />
          <stop offset="100%" stop-color="#378ADD" stop-opacity="0.85" />
        </linearGradient>
      </defs>
      <!-- 海面 -->
      <rect x="0" y="70" width="320" height="80" rx="18" fill="url(#sea)" />
      <g class="waves" fill="none" stroke="#FFFFFF" stroke-opacity="0.5" stroke-width="2" stroke-linecap="round">
        <path d="M14 92 q 18 -10 36 0 t 36 0 t 36 0 t 36 0 t 36 0 t 36 0 t 36 0" />
        <path d="M22 110 q 18 -9 36 0 t 36 0 t 36 0 t 36 0 t 36 0 t 36 0" stroke-opacity="0.3" />
      </g>
      <!-- 涟漪（抛竿时扩散） -->
      <circle class="ripple" cx="160" cy="86" r="10" fill="none" stroke="#FFFFFF" stroke-width="2" opacity="0" />
      <!-- 漂流瓶 -->
      <text class="bottle" x="160" y="74" font-size="34" text-anchor="middle" dominant-baseline="central">🫙</text>
    </svg>
  </div>
</template>
