<script setup lang="ts">
import type { PenPalSummary } from '@inkling/shared';

const api = useApi();
const toast = useToast();
const penpals = ref<PenPalSummary[]>([]);
const loading = ref(true);

onMounted(async () => {
  try {
    penpals.value = await api.get<PenPalSummary[]>('/penpals');
  } catch (e: any) {
    toast.error(e.message);
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <div class="pt-4">
    <h1 class="font-serif text-2xl font-700">笔友信匣</h1>
    <p class="mt-1 text-sm text-inkSoft">与你结缘的人，慢慢往来。</p>

    <PageLoading v-if="loading" />

    <EmptyState v-else-if="penpals.length === 0" icon="🕊" title="还没有笔友。" hint="去漂流海，拆开一封信，回信结缘吧。" />

    <div v-else class="mt-5 space-y-3">
      <NuxtLink v-for="p in penpals" :key="p.relationId" :to="`/penpals/${p.relationId}`" class="card flex items-center justify-between">
        <div>
          <div class="font-serif font-600">{{ p.partner.penName }}</div>
          <div class="mt-1 text-xs text-inkFaint">往来 {{ p.exchangeCount }} 封信</div>
        </div>
        <span class="text-inkFaint">›</span>
      </NuxtLink>
    </div>
  </div>
</template>
