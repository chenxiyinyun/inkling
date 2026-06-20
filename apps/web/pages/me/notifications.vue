<script setup lang="ts">
import type { NotificationItem } from '@inkling/shared';

const { items, unread, refresh, markRead } = useNotifications();
const loading = ref(true);

onMounted(async () => {
  await refresh();
  loading.value = false;
});

const typeIcon: Record<string, string> = {
  LETTER_DELIVERED: '📮',
  LETTER_FISHED: '🪝',
  PENPAL_REPLY_ARRIVED: '💌',
  UNSEAL_REPLY_WINDOW_WARNING: '⏳',
  UNSEAL_EXPIRED_REDRIFT: '🌊',
};

function linkOf(n: NotificationItem): string | undefined {
  const ref = n.ref as Record<string, unknown> | undefined;
  if (n.type === 'PENPAL_REPLY_ARRIVED' && typeof ref?.relationPublicId === 'string') {
    return `/penpals/${ref.relationPublicId}`;
  }
  return undefined;
}
</script>

<template>
  <div class="pt-4">
    <div class="flex items-center justify-between">
      <h1 class="font-serif text-2xl font-700">通知</h1>
      <button v-if="unread > 0" class="text-xs text-sea" @click="markRead()">全部已读</button>
    </div>

    <PageLoading v-if="loading" />

    <EmptyState
      v-else-if="!items.length"
      icon="🔔"
      title="还没有通知"
      hint="信件抵达、被拾起、笔友回信时，会在这里轻轻提醒你"
    />

    <ul v-else class="mt-5 space-y-2">
      <li v-for="n in items" :key="n.publicId">
        <component
          :is="linkOf(n) ? 'NuxtLink' : 'div'"
          :to="linkOf(n)"
          class="card flex items-start gap-3"
          :class="{ 'opacity-60': n.read }"
        >
          <span class="text-xl leading-none">{{ typeIcon[n.type] ?? '🔔' }}</span>
          <div class="flex-1 min-w-0">
            <div class="text-sm text-ink">{{ n.title }}</div>
            <div class="mt-1 text-xs text-inkFaint">{{ n.createdBand }}</div>
          </div>
          <span v-if="!n.read" class="mt-1.5 w-2 h-2 rounded-full bg-terra shrink-0" aria-label="未读"></span>
        </component>
      </li>
    </ul>
  </div>
</template>
