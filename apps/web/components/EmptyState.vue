<script setup lang="ts">
defineProps<{ icon?: string; title: string; hint?: string }>();
</script>

<template>
  <div class="py-16 text-center">
    <div v-if="icon" class="text-5xl mb-3 select-none opacity-80">{{ icon }}</div>
    <p class="font-serif text-inkSoft whitespace-pre-line">{{ title }}</p>
    <p v-if="hint" class="mt-2 text-sm text-inkFaint whitespace-pre-line">{{ hint }}</p>
    <div class="mt-5">
      <slot />
    </div>
  </div>
</template>
