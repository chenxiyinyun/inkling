<script setup lang="ts">
import type { LetterPreview } from '@inkling/shared';
defineProps<{ preview: LetterPreview }>();
</script>

<template>
  <div class="card">
    <div class="flex items-center justify-between">
      <div class="font-serif text-base font-600">{{ preview.penName }}</div>
      <div class="text-xs text-inkFaint">{{ preview.distanceLabel }} · {{ preview.vehicleLabel }}</div>
    </div>
    <div class="mt-2 flex flex-wrap gap-1.5">
      <span v-for="t in preview.partialTags" :key="t" class="chip">{{ t }}</span>
      <span class="chip bg-paperEdge text-inkSoft">···</span>
    </div>
    <p v-if="preview.theme" class="mt-3 text-xs text-inkSoft">今日信笺 · {{ preview.theme }}</p>
    <p class="mt-2 text-sm text-ink/90 leading-relaxed">{{ preview.bodyExcerpt }}</p>
    <p class="mt-3 text-[11px] text-inkFaint">拆封后才能读到全文，而它将只属于你们俩。</p>
  </div>
</template>
