<script setup lang="ts">
import { useQuotaStore } from '~/stores/quota';

const quota = useQuotaStore();
onMounted(() => {
  if (!quota.loaded) quota.load().catch(() => {});
});
</script>

<template>
  <header class="sticky top-0 z-10 bg-paper/85 backdrop-blur border-b border-paperEdge">
    <div class="max-w-screen-sm mx-auto px-4 h-14 flex items-center justify-between">
      <NuxtLink to="/ocean" class="font-serif text-lg font-700 text-ink">信逢 <span class="text-terra">·</span> 漂流邮局</NuxtLink>
      <div class="flex items-center gap-3 text-xs text-inkSoft">
        <span title="今日投递">🖋 {{ quota.send }}</span>
        <span title="今日打捞">🪝 {{ quota.fish }}</span>
        <span title="今日拆封">✉ {{ quota.unseal }}</span>
      </div>
    </div>
  </header>
</template>
