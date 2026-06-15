<script setup lang="ts">
import { useOceanStore } from '~/stores/ocean';

const ocean = useOceanStore();

onMounted(() => {
  if (!ocean.unsealed) navigateTo('/ocean');
});

const deadlineText = computed(() => {
  if (!ocean.unsealed) return '';
  const d = new Date(ocean.unsealed.replyDeadline);
  const days = Math.max(0, Math.ceil((d.getTime() - Date.now()) / 86400000));
  return `还剩 ${days} 天，回信后你们便结缘成笔友`;
});
</script>

<template>
  <div v-if="ocean.unsealed" class="pt-6 pb-10">
    <div class="flex items-center justify-between">
      <div class="font-serif text-lg font-700">{{ ocean.unsealed.author.penName }}</div>
      <NuxtLink :to="`/profiles/${ocean.unsealed.author.publicId}`" class="text-xs text-inkFaint">查看名片</NuxtLink>
    </div>
    <div class="mt-1 flex flex-wrap gap-1.5">
      <span v-for="t in ocean.unsealed.author.interestTags" :key="t" class="chip">{{ t }}</span>
    </div>
    <p v-if="ocean.unsealed.author.oneLiner" class="mt-2 text-sm text-inkSoft italic">「{{ ocean.unsealed.author.oneLiner }}」</p>

    <article class="letter-paper rounded-2xl p-5 mt-5 text-[15px] whitespace-pre-wrap">{{ ocean.unsealed.body }}</article>

    <div class="mt-5 text-center text-xs text-terra">⏳ {{ deadlineText }}</div>

    <div class="mt-4 grid grid-cols-2 gap-3">
      <NuxtLink to="/ocean" class="btn-ghost text-center">暂不回信</NuxtLink>
      <NuxtLink to="/ocean/reply" class="btn-primary text-center">提笔回信</NuxtLink>
    </div>
  </div>
</template>
