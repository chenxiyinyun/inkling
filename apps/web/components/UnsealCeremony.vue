<script setup lang="ts">
import { gsap } from 'gsap';

const root = ref<HTMLElement | null>(null);
let ctx: ReturnType<typeof gsap.context> | undefined;

onMounted(() => {
  if (!root.value) return;
  ctx = gsap.context(() => {
    const mm = gsap.matchMedia();
    mm.add('(prefers-reduced-motion: reduce)', () => {
      gsap.set('.seal', { opacity: 0 });
      gsap.set('.letter', { opacity: 1, y: 0 });
    });
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      gsap.set('.letter', { opacity: 0, y: 28 });
      const tl = gsap.timeline();
      tl.from('.seal', { scale: 0.6, opacity: 0, duration: 0.3, ease: 'back.out(2)' })
        .to('.seal-body', { scale: 0.9, duration: 0.16, ease: 'power2.in' }, '+=0.12')
        .addLabel('crack')
        .to('.half-l', { x: -28, rotation: -16, opacity: 0, duration: 0.5, ease: 'power2.out' }, 'crack')
        .to('.half-r', { x: 28, rotation: 16, opacity: 0, duration: 0.5, ease: 'power2.out' }, 'crack')
        .fromTo('.shard', { scale: 0, y: 0, opacity: 1 }, { scale: 1, y: 22, opacity: 0, stagger: 0.04, duration: 0.5, ease: 'power1.out' }, 'crack')
        .to('.letter', { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out' }, 'crack+=0.2');
    });
  }, root.value);
});

onUnmounted(() => ctx?.revert());
</script>

<template>
  <div ref="root" class="fixed inset-0 z-50 flex flex-col items-center justify-center bg-ink/45 backdrop-blur-sm">
    <svg viewBox="0 0 120 120" class="w-28 h-28" role="img" aria-label="拆开火漆">
      <!-- 信封透出 -->
      <g class="letter">
        <rect x="28" y="40" width="64" height="44" rx="6" fill="#FAF6EE" stroke="#EFE7D6" />
        <path d="M28 46 L60 66 L92 46" fill="none" stroke="#D85A30" stroke-width="2" />
      </g>
      <!-- 火漆印 -->
      <g class="seal">
        <g class="seal-body">
          <path class="half-l" d="M60 36 a24 24 0 0 0 0 48 z" fill="#C2461F" />
          <path class="half-r" d="M60 36 a24 24 0 0 1 0 48 z" fill="#D85A30" />
          <text x="60" y="61" font-size="20" text-anchor="middle" dominant-baseline="central" fill="#FAECE7">封</text>
        </g>
        <circle class="shard" cx="44" cy="60" r="3" fill="#D85A30" />
        <circle class="shard" cx="76" cy="60" r="3" fill="#C2461F" />
        <circle class="shard" cx="60" cy="42" r="2.5" fill="#D85A30" />
        <circle class="shard" cx="60" cy="80" r="2.5" fill="#C2461F" />
      </g>
    </svg>
    <p class="mt-4 font-serif text-paper/95 text-sm">正在拆开火漆…</p>
  </div>
</template>
