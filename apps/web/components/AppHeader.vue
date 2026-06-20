<script setup lang="ts">
import { useQuotaStore } from '~/stores/quota';

const quota = useQuotaStore();
const { unread, startPolling } = useNotifications();
onMounted(() => {
  if (!quota.loaded) quota.load().catch(() => {});
  startPolling();
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
        <NuxtLink to="/me/notifications" class="relative ml-1 text-base leading-none" title="通知" aria-label="通知">
          🔔
          <span
            v-if="unread > 0"
            class="absolute -top-2 -right-2 min-w-4 h-4 px-1 rounded-full bg-terra text-white text-[10px] leading-4 text-center font-600"
          >{{ unread > 9 ? '9+' : unread }}</span>
        </NuxtLink>
      </div>
    </div>
  </header>
</template>
